import {assertConfig} from './config.mjs';
let cached=null;
let pending=null;
export async function clientCredentials(c=assertConfig(),fetcher=fetch){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  let response;
  try {response=await fetcher(`${c.base}/oauth/tokens`,{
    method:'POST',headers:{'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify({grant_type:'client_credentials',client_id:c.clientId,client_secret:c.clientSecret,scope:c.scopes,expires_in:1800}),
    cache:'no-store',signal:controller.signal});}
  catch {throw new Error('Zendesk OAuth token endpoint is unavailable');}
  finally {clearTimeout(timer);}
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`Zendesk client-credentials grant failed (HTTP ${response.status}): verify OAuth client identifier, real Support OAuth secret and scopes.`);
  if(!data.access_token)throw new Error('Zendesk did not return an OAuth access token');
  return data;
}
export async function serviceToken(c=assertConfig(),fetcher=fetch){
  const key=c.base+':'+c.clientId+':'+c.clientSecret+':'+c.scopes;
  if(cached&&cached.key===key&&Date.now()<cached.until)return cached.token;
  if(!pending)pending=clientCredentials(c,fetcher).then(data=>{
    cached={key,token:data.access_token,until:Date.now()+Math.max(60,Number(data.expires_in)||1800)*1000-60000};
    return cached.token;
  }).finally(()=>{pending=null});
  return pending;
}
export function clearServiceToken(){cached=null;}
