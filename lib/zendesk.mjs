import {config} from './config.mjs';
import {serviceToken,clearServiceToken} from './oauth.mjs';
export class ZendeskError extends Error {
  constructor(status,message,detail=''){super(message);this.name='ZendeskError';this.status=status;this.detail=detail;}
}
export function safeZendeskPath(path,c=config()){
  if(typeof path!=='string'||!path.startsWith('/api/v2/'))throw new ZendeskError(400,'Only Zendesk Support API paths are permitted');
  const url=new URL(path,c.base);
  if(url.origin!==c.base||!url.pathname.startsWith('/api/v2/'))throw new ZendeskError(400,'Cross-origin Zendesk request blocked');
  return url.toString();
}
export async function backendZendesk(path,options={},opts={}){
  const c=opts.config||config(),fetcher=opts.fetcher||fetch;
  const url=safeZendeskPath(path,c),method=(options.method||'GET').toUpperCase();
  if(!['GET','POST','PUT','PATCH','DELETE'].includes(method))throw new ZendeskError(405,'Unsupported method');
  async function execute(){
    const token=await (opts.getToken||serviceToken)(c,fetcher);
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{return await fetcher(url,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/json',...(options.body?{'content-type':'application/json'}:{})},body:options.body?JSON.stringify(options.body):undefined,cache:'no-store',signal:controller.signal});}
    finally{clearTimeout(timeout)}
  }
  let response;
  try{response=await execute();if(response.status===401){clearServiceToken();response=await execute();}}
  catch(error){if(error instanceof ZendeskError)throw error;throw new ZendeskError(502,'Zendesk API connection failed',String(error.message||'').slice(0,200));}
  if(response.status===429&&method==='GET'){
    const retry=Math.min(2,Math.max(0,Number(response.headers.get('retry-after'))||1));
    await new Promise(r=>setTimeout(r,retry*1000));response=await execute();
  }
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const reason=response.status===403?'Zendesk denied this action for this integration or plan':response.status===404?'This Zendesk resource does not exist or is not enabled':`Zendesk returned HTTP ${response.status}`;
    throw new ZendeskError(response.status,reason,String(data.description||data.error||'').slice(0,250));
  }
  return data;
}
export async function rawZendesk(session,path,options={},opts={}){
  if(!session?.user)throw new ZendeskError(401,'MTS sign-in required');
  return {data:await backendZendesk(path,options,opts),session};
}
export function isStaff(session){return ['admin','agent'].includes(session?.user?.role)}
export function isAdmin(session){return session?.user?.role==='admin'}
export function requireRole(session,role='staff'){
  if(!session?.user)throw new ZendeskError(401,'MTS sign-in required');
  if(role==='admin'&&!isAdmin(session))throw new ZendeskError(403,'Zendesk admin role required');
  if(role==='staff'&&!isStaff(session))throw new ZendeskError(403,'Zendesk staff role required');
}
