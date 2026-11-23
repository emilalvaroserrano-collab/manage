import { readSession,verifiedSession,respond,fail,checkOrigin } from '@/lib/http.mjs';
import { detailResource,updateResource } from '@/lib/resources.mjs';
export const runtime='nodejs';
export async function GET(request,{params}){
  try{
    const {resource,id}=await params,original=await verifiedSession(readSession(request));
    const result=await detailResource(original,resource,id);
    const {session,...payload}=result;return respond(payload,session,original);
  }catch(error){return fail(error)}
}
export async function PATCH(request,{params}){
  try{
    checkOrigin(request);
    const {resource,id}=await params,original=await verifiedSession(readSession(request));
    const input=await request.json(),result=await updateResource(original,resource,id,input);
    return respond({item:result.item},result.session,original);
  }catch(error){return fail(error)}
}
