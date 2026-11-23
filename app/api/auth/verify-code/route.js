import {NextResponse} from 'next/server';
import {config,assertConfig} from '@/lib/config.mjs';
import {checkOrigin,fail} from '@/lib/http.mjs';
import {ZendeskError} from '@/lib/zendesk.mjs';
import {loginMode,lookupZendeskUser,verifyOtp,OTP_COOKIE} from '@/lib/login.mjs';
import {SESSION_COOKIE,unseal,seal,cookieOptions} from '@/lib/session.mjs';
export const runtime='nodejs';
export async function POST(request){
 try{
  checkOrigin(request);const c=assertConfig(config());
  const challenge=unseal(request.cookies.get(OTP_COOKIE)?.value,c.sessionSecret,Date.now(),600000);
  if(!challenge||challenge.attempts>=5)throw new ZendeskError(401,'Code expired or attempts exceeded. Request a new code.');
  const body=await request.json(),mode=loginMode(body.mode);
  if(mode!==challenge.mode)throw new ZendeskError(403,'Portal type mismatch');
  if(!verifyOtp(challenge,body.code,c.sessionSecret)){
   const response=NextResponse.json({error:'Invalid or expired code'},{status:401});
   response.cookies.set(OTP_COOKIE,seal({...challenge,attempts:challenge.attempts+1},c.sessionSecret),{...cookieOptions(),maxAge:600});return response;
  }
  const user=await lookupZendeskUser(challenge.email,challenge.mode);
  if(!user)throw new ZendeskError(403,'This verified email has no eligible Zendesk role');
  const response=NextResponse.json({ok:true,redirect:mode==='admin'?'/admin':'/user'});
  response.cookies.set(SESSION_COOKIE,seal({user,authMethod:'email-otp'},c.sessionSecret),cookieOptions());
  response.cookies.delete(OTP_COOKIE);return response;
 }catch(error){return fail(error)}
}
