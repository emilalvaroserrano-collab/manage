# Production domain configuration

Public origin: `https://managetech.abitech.site`

- Staff URL: `https://managetech.abitech.site/admin`
- Customer URL: `https://managetech.abitech.site/user`
- Login URL: `https://managetech.abitech.site/login`
- API base: `https://managetech.abitech.site/api/`
- Zendesk backend: `https://managetechservices-16737.zendesk.com` (server-side only)

## Environment

```env
MTS_APP_URL=https://managetech.abitech.site
ZENDESK_SUBDOMAIN=managetechservices-16737
ZENDESK_OAUTH_CLIENT_ID=managetech
ZENDESK_OAUTH_CLIENT_SECRET=<NEW_SUPPORT_OAUTH_CLIENT_SECRET>
ZENDESK_OAUTH_SCOPE=read write
SESSION_SECRET=<RANDOM_32_PLUS_BYTE_SECRET>
RESEND_API_KEY=<VERIFIED_SENDER_API_KEY>
AUTH_EMAIL_FROM=Manage Tech Services <login@your-verified-domain.com>
```

Do not add `ZENDESK_REDIRECT_URI`. Zendesk OAuth `client_credentials` does not use an auth redirect URL. A complete, matching Support OAuth client secret is required, and the previously disclosed keys must be rotated.

## DNS and deployment

1. Deploy the Next.js app (run `npm run build` and `npm run start`, or choose an equivalent Next.js platform).
2. Add `managetech.abitech.site` as a custom domain at your hosting provider.
3. Create the host's requested DNS CNAME/A record at your DNS provider and enable HTTPS. Do not invent an IP/CNAME before choosing a host.
4. Add server-side environment variables to the hosting provider. The app's `.env.local` stays uncommitted.
5. Verify `/admin`, `/user`, `/login`, `/api/health`, OTP delivery, API authorization and Zendesk-backed CRUD.
6. Remove legacy callback addresses from the new Zendesk OAuth client: the new portal has no browser-based OAuth callbacks.

## Legacy URLs (reference only; not deployed handlers)

If a separate old application needs literal host replacement, here are the four unique paths you supplied:

```text
https://managetech.abitech.site/api/auth/oauth2/callback/zendesk
https://managetech.abitech.site/api/zendesk/customer/callback
https://managetech.abitech.site/production/signin
https://managetech.abitech.site/api/zendesk/oauth/callback
```

**Do not register these as OAuth callbacks for the v3 portal**. `/production/signin` is an old login page, not an OAuth callback. Use `https://managetech.abitech.site/login`.
