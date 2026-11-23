# Manage Tech Services — fully branded Zendesk-backed portal (v3)

This rebuild keeps the reference-styled MTS interface at **your own domain**:

- `https://managetech.abitech.site/admin` — staff/admin dashboard
- `https://managetech.abitech.site/user` — customer dashboard
- `https://managetech.abitech.site/login` — branded email-code sign-in
- `https://managetech.abitech.site/api/*` — server-only API gateway

**No regular authentication flow opens Zendesk.** Legacy `/portal/*` routes redirect to `/user/*`, and the old `/api/auth/start` endpoint redirects to MTS `/login` instead of Zendesk. Native Zendesk agent/Help Center links were removed from customer-facing navigation.

## Architecture and authority

```text
MTS React/Next.js UI  (/admin, /user, /login)
      | secure same-origin /api/*
      | encrypted, HttpOnly app session: Zendesk user ID + role
Next.js server
      | (1) MTS one-time-email-code authentication
      |     -> Resend sends code; user email + role resolved from Zendesk Users API
      | (2) Zendesk OAuth grant_type=client_credentials
      |     -> short-lived backend bearer token; no browser authorization URL
      | (3) authorize MTS role and requester ownership per operation
      v
Zendesk Support API / Custom Objects / Help Center
      |
      +-- users, organizations, tickets, products, services,
          orders/quotes represented by tagged tickets
```

All business records remain in **`managetechservices-16737.zendesk.com`**. No PGLite/PostgreSQL, local customer database, seeded records, or pretend payment ledger. This code does not implement payment processing or a Sunshine Conversations inbox; those remain future work.

**Important authorization tradeoff:** Client credentials act on behalf of the Zendesk user who created the OAuth client (typically an admin). This is NOT per-user OAuth delegation. The MTS server must enforce customer record ownership and role restrictions itself; agent group/field/brand-level Zendesk ACL parity is **not yet implemented**, so review those permissions before production. Zendesk will attribute many service-token writes to the OAuth client owner; preserve verified app user IDs in audit logs if you need actual per-person provenance.

## Setup

1. In the **new** Zendesk account's Admin Center, create/verify a **Confidential OAuth client** `managetech` and copy its genuine **Support OAuth client secret**. Your earlier Sunshine Conversations App ID/key/secret do not authenticate this API.
2. In your email provider, verify a sending domain and obtain a **Resend API key** (used only to deliver one-time sign-in codes). This is not a record store.
3. Set `MTS_APP_URL=https://managetech.abitech.site` in `.env.local` (the template already contains this). Copy `.env.example` to `.env.local`, fill `ZENDESK_OAUTH_CLIENT_SECRET`, `SESSION_SECRET`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`. Keep the existing App ID and Key ID only for optional Conversations integration.
4. Ensure the staff/admin and customer email addresses exist as actual Zendesk users. Staff login requires Zendesk `agent` or `admin`; customer login requires Zendesk `end-user`. Users who do not exist in Zendesk cannot sign in; there is no local users table.
5. Run:

```bash
npm install
npm run dev
# http://localhost:5129/admin
# http://localhost:5129/user
```

If `5129` is occupied, use `npx next dev -p 5130`. **No OAuth redirect-URI change is needed** when switching local ports, because this version uses server-to-server OAuth.

If port 5129 is already running an older build, stop that process first. Replace the old source with this version but **preserve and edit your private `.env.local`**; the ZIP never contains it.

## Supported workflows

- Admin: dashboard metrics directly from Zendesk, ticket queue, comments, organizations, users, tagged order/quote/payment tickets, Zendesk Custom Object products/services, configuration and provisioning.
- Customer: own requested tickets, ticket detail with only **public** comments, create tickets/orders/quotes as actual Zendesk tickets with verified requester ID, catalog and knowledge browsing.
- Sign-in: emailed six-digit OTP, encrypted HttpOnly login challenge + app session. Zendesk user identity and suspension/role are revalidated server-side for each API call.
- Backend: short-lived OAuth client-credentials access tokens are cached only in process memory and refreshed on expiration/401. OAuth secrets and bearer tokens are never sent to browsers.
- Role enforcement: customer access to tickets requires requester ownership on **all** detail/read/update routes; other customers' tickets and internal comments are never returned. Staff resources require current Zendesk staff role; object provisioning requires Zendesk admin role.

## Production domain and deprecated callbacks

The public production origin is **https://managetech.abitech.site**. DNS/HTTPS and application hosting must be configured separately; changing this environment variable does not publish a site. Add this domain to your hosting provider, set its DNS record based on that provider's instruction, and deploy the Next.js app. No `/production/signin` or Zendesk-facing UI is used.

**Remove the old Zendesk OAuth redirect URL entries**, including `mts.abitech.site` and `localhost:8080`; the `client_credentials` grant does not use or require browser redirects. The former `/api/auth/oauth2/callback/zendesk`, `/api/zendesk/customer/callback`, `/api/zendesk/oauth/callback`, and `/production/signin` routes are not active in this build. Do NOT register their new-host equivalents just because they existed in the old portal. `/login` is the native MTS sign-in.

If a legacy external integration still independently requires Authorization Code flow, implement and verify its specific callback handler first, then register only its exact HTTPS URL.

## API and sign-in configuration

- No OAuth `redirect_uri` required and none is used.
- `POST /api/auth/request-code` — initiates MTS email OTP; generic response for unknown email.
- `POST /api/auth/verify-code` — exchanges OTP for MTS HttpOnly session.
- `POST /api/auth/logout` — clears session.
- `GET /api/session` — reads/revalidates signed-in user against Zendesk.
- `/api/data/*` — Zendesk-backed resources; fail closed if Zendesk fails.
- `GET /api/health` — non-sensitive integration status.

## Still required for launch

- Replace previously exposed Zendesk/Conversations secrets, and confirm the actual Support OAuth client secret is correct. The older unexplained `SECRET=` value must **not** be assumed to be that secret.
- Register and verify your email sender and set a real Resend API key.
- Perform an actual MTS staff and customer sign-in, plus Zendesk CRUD and permission tests with a real, permissioned tenant.
- Test email throttling behind an **external, shared** production rate limiter (the included in-process throttle is a development baseline and is not sufficient for horizontally scaled deployments).
- Set up HTTPS, secure monitoring, role/group/brand ACL policy, audit attribution and operational backups; run Next.js production build + browser E2E tests.
- Ensure plan supports Custom Objects before provisioning the `mts_product` and `mts_service` objects.

## Verification

```bash
npm run check
npm run build
```

The automated test suite validates client credentials, session sealing, Zendesk path restrictions, verified roles, ownership checks, public-comment filtering and ticket mutations. **A real production build and live authorization test have not been confirmed in this execution environment.**

Official reference: https://developer.zendesk.com/documentation/authentication/api-tokens-to-oauth/

## Vercel deployment

Import the GitHub repository `emilalvaroserrano-collab/manage` at https://vercel.com/new.

- **Framework preset:** Next.js
- **Root directory:** `./`
- **Install command:** `npm install`
- **Build command:** `npm run build`
- **Output directory:** default Next.js setting (leave blank)
- **Node.js runtime:** 22.x
- **Production domain:** `managetech.abitech.site` (configure DNS in Vercel after adding domain)

Add `MTS_APP_URL`, `ZENDESK_SUBDOMAIN`, `ZENDESK_OAUTH_CLIENT_ID`,
`ZENDESK_OAUTH_CLIENT_SECRET`, `ZENDESK_OAUTH_SCOPE`, `SESSION_SECRET`,
`RESEND_API_KEY` and `AUTH_EMAIL_FROM` in Vercel Project Settings >
Environment Variables. Mark all secret values sensitive. Never paste private
credentials into GitHub, Vercel build logs, or frontend `NEXT_PUBLIC_` variables.

The `/api/health` endpoint reports configuration readiness without returning
secrets. Both staff and customers log in at `/login`; `/admin` and `/user`
are served by the same Next.js deployment.

**Production launch gate:** Live Zendesk OAuth credentials, a verified email sender,
and a shared distributed OTP rate limiter are mandatory before opening this
portal to public sign-in. The included in-memory throttle is not reliable across
separate Vercel function instances.
