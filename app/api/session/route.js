export const dynamic='force-dynamic';
import {config} from '@/lib/config.mjs';
import {readSession,verifiedSession,fail} from '@/lib/http.mjs';
export const runtime='nodejs';
export async function GET(request){try{
 const c=config(),session=readSession(request);
 const user=session?.user?(await verifiedSession(session)).user:null;
 return Response.json({authenticated:!!user,user,oauthConfigured:c.oauthReady,emailConfigured:c.emailReady,subdomain:c.subdomain,conversationsConfigured:c.conversationsReady},{headers:{'cache-control':'no-store'}});
}catch(error){return fail(error)}}
