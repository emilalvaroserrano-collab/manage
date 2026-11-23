# MTS branded portal / Zendesk system of record — TODO

## Implemented in v2 source
- [x] Custom MTS routes `/admin`, `/user`, `/login`; legacy `/portal` -> `/user`.
- [x] Remove end-user browser redirects to Zendesk authorization/agent/help-center pages.
- [x] Support OAuth **client_credentials** server to server; no callback URI.
- [x] Portal-native email one-time-code authentication; verified identity resides in Zendesk users.
- [x] Zendesk role revalidation and customer requester-ownership checks on ticket APIs.
- [x] Suppress internal notes from customer ticket conversations.
- [x] Keep operational entities remote-only; no local Postgres/PGLite business database.
- [x] Automated unit/security tests (19 passing in local Node runner).

- [x] Set production app origin to `https://managetech.abitech.site` and document removal of legacy redirect URLs.

## Blockers / before production
- [ ] Rotate exposed keys; configure genuine Zendesk Support OAuth secret.
- [ ] Configure Resend sender domain, API key and FROM address for branded sign-in emails.
- [ ] Provision Zendesk staff and end users and custom objects.
- [ ] Install Next.js dependencies and run a successful `npm run build` (registry access unavailable in this environment).
- [ ] Perform live Zendesk client credentials, ticket CRUD and staff/customer login E2E tests.
- [ ] External, shared (multi-node) auth throttling; abuse/credential audit and monitoring.
- [ ] Validate Zendesk agent group / brand / field permission restrictions and write attribution.
- [ ] Deploy on owned HTTPS domain, configure security headers and tests.
- [ ] Implement real payments and Sunshine Conversations messaging only if required.
