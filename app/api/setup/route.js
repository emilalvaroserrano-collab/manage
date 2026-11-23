import { readSession,verifiedSession,respond,fail,checkOrigin } from '@/lib/http.mjs';
import { requireRole,rawZendesk,ZendeskError } from '@/lib/zendesk.mjs';
import { CUSTOM_OBJECTS } from '@/lib/resources.mjs';
export const runtime='nodejs';
// Explicit admin-only provisioning. Never silently create objects at request time.
export async function POST(request){
  try {
    checkOrigin(request);
    const original=await verifiedSession(readSession(request));requireRole(original,'admin');
    const body=await request.json();
    if(body?.confirm!=='PROVISION_MTS_OBJECTS')throw new ZendeskError(400,'Explicit confirmation required');
    let current=original;
    const results=[];
    for(const [resource,definition] of Object.entries(CUSTOM_OBJECTS)){
      let exists=false;
      try{
        const probe=await rawZendesk(current,`/api/v2/custom_objects/${definition.key}`);
        current=probe.session;exists=true;
      }catch(error){if(error.status!==404)throw error;}
      if(!exists){
        const create=await rawZendesk(current,'/api/v2/custom_objects',{method:'POST',body:{custom_object:{key:definition.key,title:definition.title,title_pluralized:definition.plural}}});
        current=create.session;
      }
      const fieldList=await rawZendesk(current,`/api/v2/custom_objects/${definition.key}/fields`);
      current=fieldList.session;
      const known=new Set((fieldList.data.custom_object_fields||[]).map(field=>field.key));
      const fields=[];
      for(const [key,title,type] of definition.fields){
        if(known.has(key)){fields.push({key,created:false});continue;}
        const created=await rawZendesk(current,`/api/v2/custom_objects/${definition.key}/fields`,{method:'POST',body:{custom_object_field:{key,title,type}}});
        current=created.session;fields.push({key,created:true});
      }
      results.push({resource,key:definition.key,created:!exists,fields});
    }
    return respond({results},current,original);
  }catch(error){return fail(error)}
}
