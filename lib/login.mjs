import {createHmac,randomInt,randomBytes} from 'node:crypto';
import {ZendeskError,backendZendesk} from './zendesk.mjs';
import {equalSecrets} from './session.mjs';
export const OTP_COOKIE='mts_login_challenge';
const events=new Map();
export function normalizeEmail(input){const s=String(input||'').trim().toLowerCase();if(s.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))throw new ZendeskError(400,'Valid email address required');return s;}
export function loginMode(mode){return mode==='admin'?'admin':mode==='user'?'user':null;}
export function otpDigest(code,nonce,secret){return createHmac('sha256',secret).update(`${nonce}:${code}`).digest('hex');}
export function makeChallenge(email,mode,secret){const code=String(randomInt(0,1000000)).padStart(6,'0'),nonce=randomBytes(16).toString('hex');return {code,challenge:{email,mode,nonce,digest:otpDigest(code,nonce,secret),attempts:0}};}
export function verifyOtp(challenge,code,secret){return /^\d{6}$/.test(String(code||''))&&equalSecrets(challenge?.digest,otpDigest(String(code),challenge.nonce,secret));}
export function throttle(key,now=Date.now()){
  const recent=(events.get(key)||[]).filter(t=>now-t<3600000);
  if(recent.length>=5)throw new ZendeskError(429,'Too many sign-in requests. Try again later.');
  recent.push(now);events.set(key,recent);
  if(events.size>3000){for(const [k,v] of events){if(v.every(t=>now-t>3600000))events.delete(k)}}
}
export async function lookupZendeskUser(email,mode,requester=backendZendesk){
  const query=new URLSearchParams({query:`email:${email}`});
  const result=await requester(`/api/v2/users/search.json?${query}`);
  const matches=Array.isArray(result.users)?result.users:[];
  const u=matches.find(x=>String(x.email||'').toLowerCase()===email&&!x.suspended);
  if(!u||!u.id||!u.role)return null;
  if(mode==='admin'&&!['admin','agent'].includes(u.role))return null;
  if(mode==='user'&&u.role!=='end-user')return null;
  return {id:u.id,name:u.name,email:u.email,role:u.role,organization_id:u.organization_id};
}
export async function sendOtp(email,code,c,fetcher=fetch){
  if(!c.emailReady)throw new ZendeskError(503,'Configure RESEND_API_KEY and AUTH_EMAIL_FROM to enable MTS email sign-in');
  const result=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${c.resendKey}`,'content-type':'application/json'},body:JSON.stringify({from:c.emailFrom,to:[email],subject:'Your Manage Tech Services sign-in code',text:`Your MTS sign-in code: ${code}\n\nThis code expires in 10 minutes. If you did not request it, ignore this email.`}),cache:'no-store'});
  if(!result.ok)throw new ZendeskError(502,'Unable to deliver sign-in email. Verify your sending domain and mail provider configuration.');
}
