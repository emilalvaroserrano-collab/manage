import {config} from './config.mjs';
import {SESSION_COOKIE,unseal} from './session.mjs';
import {ZendeskError,backendZendesk} from './zendesk.mjs';
export function readSession(request){
 const c=config();if(!c.sessionReady)throw new ZendeskError(503,'SESSION_SECRET is not configured');
 return unseal(request.cookies.get(SESSION_COOKIE)?.value,c.sessionSecret);
}
export async function verifiedSession(session,requester=backendZendesk){
 if(!session?.user?.id)throw new ZendeskError(401,'MTS sign-in required');
 const id=String(session.user.id);
 if(!/^\d+$/.test(id))throw new ZendeskError(401,'Invalid MTS session');
 const data=await requester(`/api/v2/users/${id}.json`);
 const u=data.user;
 if(!u||String(u.id)!==id||u.suspended||String(u.email||'').toLowerCase()!==String(session.user.email||'').toLowerCase())throw new ZendeskError(401,'MTS identity is no longer active');
 return {...session,user:{id:u.id,name:u.name,email:u.email,role:u.role,organization_id:u.organization_id}};
}
export function respond(data,session,original,status=200){return Response.json(data,{status,headers:{'cache-control':'no-store'}})}
export function fail(error){
 const status=error instanceof ZendeskError?(error.status>=400&&error.status<600?error.status:500):500;
 const message=error instanceof ZendeskError?error.message:(String(error?.message||'').startsWith('Zendesk')?error.message:'Unexpected server error');
 return Response.json({error:message,detail:error instanceof ZendeskError?error.detail:undefined},{status,headers:{'cache-control':'no-store'}});
}
export function checkOrigin(request){
 if(['GET','HEAD','OPTIONS'].includes(request.method))return;
 const origin=request.headers.get('origin');
 if(!origin){if(request.headers.get('x-mts-action')!=='1')throw new ZendeskError(403,'Origin or action header required');return;}
 if(new URL(origin).origin!==new URL(request.url).origin)throw new ZendeskError(403,'Cross-origin write blocked');
}
