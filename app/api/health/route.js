export const dynamic='force-dynamic';
import { config } from '@/lib/config.mjs';
export async function GET(){
  const c=config();
  return Response.json({service:'mts-zendesk-portal',mode:'zendesk-only',subdomain:c.subdomain,oauthConfigured:c.oauthReady,emailConfigured:c.emailReady,conversationsConfigured:c.conversationsReady},{headers:{'cache-control':'no-store'}});
}
