const BAD = new Set(['REPLACE_WITH_NEW_SUPPORT_OAUTH_SECRET','REPLACE_WITH_RANDOM_32_PLUS_BYTE_SECRET','', 'YOUR_FULL_CLIENT_SECRET']);
export function config(env=process.env) {
  const subdomain=env.ZENDESK_SUBDOMAIN||'managetechservices-16737';
  const appUrl=(env.MTS_APP_URL||'https://managetech.abitech.site').replace(/\/$/, '');
  const parsedAppUrl=new URL(appUrl);
  if(!['http:','https:'].includes(parsedAppUrl.protocol) || parsedAppUrl.username || parsedAppUrl.password || parsedAppUrl.search || parsedAppUrl.hash || parsedAppUrl.pathname!=='/')throw new Error('MTS_APP_URL must be a valid origin');
  if(parsedAppUrl.protocol!=='https:' && !['localhost','127.0.0.1'].includes(parsedAppUrl.hostname))throw new Error('MTS_APP_URL must use HTTPS outside localhost');
  if(!/^[a-z0-9][a-z0-9-]{1,62}$/i.test(subdomain))throw new Error('Invalid Zendesk subdomain');
  const clientId=env.ZENDESK_OAUTH_CLIENT_ID||'managetech';
  const clientSecret=env.ZENDESK_OAUTH_CLIENT_SECRET||'';
  const sessionSecret=env.SESSION_SECRET||'';
  const resendKey=env.RESEND_API_KEY||'';
  const emailFrom=env.AUTH_EMAIL_FROM||'';
  return {
    subdomain,base:`https://${subdomain}.zendesk.com`,appUrl,clientId,clientSecret,sessionSecret,
    scopes:env.ZENDESK_OAUTH_SCOPE||'read write',
    oauthReady:!!clientId&&!BAD.has(clientSecret),
    sessionReady:!BAD.has(sessionSecret)&&sessionSecret.length>=32,
    emailReady:!!(resendKey&&emailFrom&&!resendKey.startsWith('REPLACE_')),
    resendKey,emailFrom,
    conversationsReady:!!(env.ZENDESK_CONVERSATIONS_APP_ID&&env.ZENDESK_CONVERSATIONS_KEY_ID&&env.ZENDESK_CONVERSATIONS_KEY_SECRET)
  };
}
export function assertConfig(c=config()) {
  if(!c.oauthReady)throw new Error('Configure the genuine Support OAuth client secret (Conversations API secrets are NOT valid).');
  if(!c.sessionReady)throw new Error('SESSION_SECRET must be at least 32 characters.');
  return c;
}
