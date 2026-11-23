import { readSession,verifiedSession,respond,fail,checkOrigin } from '@/lib/http.mjs';
import { listResource,createResource } from '@/lib/resources.mjs';
export const runtime='nodejs';
export async function GET(request,{params}){
  try{
    const resource=(await params).resource;
    const original=await verifiedSession(readSession(request));
    const searchParams=new URL(request.url).searchParams;
    const query=searchParams.get('q')||'';
    const result=await listResource(original,resource,query,undefined,searchParams.get('page')||1,searchParams.get('after')||'');
    const {session,...payload}=result;
    return respond(payload,session,original);
  }catch(error){return fail(error)}
}
export async function POST(request,{params}){
  try{
    checkOrigin(request);
    const resource=(await params).resource;
    const original=await verifiedSession(readSession(request));
    const input=await request.json();
    const result=await createResource(original,resource,input);
    return respond({item:result.item},result.session,original,201);
  }catch(error){return fail(error)}
}
