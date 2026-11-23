import {NextResponse} from 'next/server';
import {config,assertConfig} from '@/lib/config.mjs';
import {checkOrigin,fail} from '@/lib/http.mjs';
import {ZendeskError} from '@/lib/zendesk.mjs';
import {normalizeEmail,loginMode,throttle,lookupZendeskUser,makeChallenge,sendOtp,OTP_COOKIE} from '@/lib/login.mjs';
import {seal,cookieOptions} from '@/lib/session.mjs';
export const runtime='nodejs';
export async function POST(request){
 try{
  checkOrigin(request);const c=assertConfig(config());
  if(!c.emailReady)throw new ZendeskError(503,'Configure RESEND_API_KEY and AUTH_EMAIL_FROM for branded MTS login');
  const body=await request.json(),email=normalizeEmail(body.email),mode=loginMode(body.mode);
  if(!mode)throw new ZendeskError(400,'Invalid portal type');
  throttle(`email:${email}`);
  const user=await lookupZendeskUser(email,mode);
  const response=NextResponse.json({ok:true,message:'If this email is registered for this portal, a sign-in code has been sent.'});
  response.headers.set('cache-control','no-store');
  if(user){const {code,challenge}=makeChallenge(email,mode,c.sessionSecret);await sendOtp(email,code,c);
   response.cookies.set(OTP_COOKIE,seal(challenge,c.sessionSecret),{...cookieOptions(),maxAge:600});}
  return response;
 }catch(error){return fail(error)}
}
