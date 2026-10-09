# Admin and paid voice operations

Status: implementation and configuration in progress. This guide describes the rollout contract; it is not evidence that admin sign-in or paid voicing works in production. Track implementation, deployment and acceptance separately in [SPK-005](product/tasks/SPK-005.json).

Reading remains free. The Worker may send a reader's own material to ElevenLabs only for a verified Plus subscriber or an administrator signed in through the dedicated Cloudflare Access application. The provider key stays in the Worker. Text and audio are returned to the browser and are not stored by RISE's server.

## Administrator sign-in

Create a dedicated Cloudflare Access self-hosted application for `rise.syberlabs.io/api/plus/admin/*`. Its Allow policy must identify the approved human administrators. Disable Cookie Path Attribute so the signed application cookie also reaches the public voice and status routes, where the Worker verifies it. Do not reuse the audience of a public or general staff application, and do not protect the entire reader behind this application.

Set `PLUS_ADMIN_ACCESS_ISSUER` to the team's exact HTTPS `cloudflareaccess.com` origin and `PLUS_ADMIN_ACCESS_AUD` to that application's audience. These identify the trusted application; they are not credentials. The Worker fetches the issuer's public keys and verifies the signed assertion or `CF_Authorization` cookie, including its algorithm, issuer, audience, application-token type and time bounds. An unverified header, a global session token, a service identity or a browser role flag grants nothing.

The Access application and its identity policy are part of the deployment. Configuring only the two Worker values does not create a sign-in flow. Missing configuration, an invalid token or unavailable public keys must deny admin access. A session expires according to Access policy. Voice and status access also make a fresh, non-cached request to the protected `/api/plus/admin/check` endpoint so Access can enforce revocation. That endpoint verifies the signature and returns the verified subject; it must not recursively make the same probe. Logout and revocation must be checked against the actual protected route and cookie behavior before acceptance. The Cloudflare account API confirms `rise.syberlabs.io` is a Worker Custom Domain for `rise-production`, enabling the same-zone fetch used by this probe.

Administrator allowance is metered separately from subscribers. All administrators share a daily character ceiling and a monthly dollar budget of at most $5; they also remain under the global daily cap. Admin usage does not create subscriber revenue or reset a subscriber's allowance. The Worker verifies the Access subject and email but does not persist either, the token, reading text or audio.

## Subscriber spend policy

A subscriber's character limit is **up to 105,000 per paid billing period**, and at most the configured daily character cap. The effective period limit may be lower: the Worker derives a voice budget from the confirmed paid invoice for the configured Plus price, after the applicable tax, discount, payment-fee reserve and fixed-cost reserve. At most half of the resulting amount is available for voice under this policy.

For the policy example of an $8.99 payment without sales tax: subtract the rounded 5% fee reserve ($0.45) and the $0.50 fixed reserve, leaving $8.04. Half is $4.02. At the conservative configured voice rate of $0.06 per 1,000 characters, that permits 67,000 characters, below the 105,000 outer ceiling. These reserves are policy inputs, not a claim about the actual fee on every payment; a larger confirmed Stripe fee is used instead of the estimate. Taxes, discounts, refunds, credit notes and lower collected amounts can reduce the allowance further. Only a confirmed captured USD payment for the current, sole matching, non-prorated Plus invoice line funds this budget.

The preset is a conservative profit ceiling, not an absolute guarantee about future vendor prices, fees, taxes or refunds. The operator must review the actual ElevenLabs plan, model and allowed voices before enabling the rate. The $0.06 preset is above the current $0.04-per-1,000 reference supplied for this rollout; do not base a durable ceiling on a temporary promotion. [ElevenLabs billing](https://elevenlabs.io/docs/overview/administration/billing) explains that credit costs depend on plan and model; [model pricing guidance](https://help.elevenlabs.io/hc/en-us/articles/21811236079505-How-do-I-find-the-model-ID) also notes voice credit modifiers. Keep a rate that covers the choices the server permits.

Reserve the request's cost before contacting ElevenLabs. Historical charges keep the rate used when reserved; changing a rate must not reprice earlier usage or mint new room. A billed response remains charged even if its audio or timing is unusable. A lost response leaves billing uncertain and must not grant an automatic free retry. Invoice replay, renewal, partial payment and refunds must not duplicate a budget or erase past spend. Refunds may leave no room for further voicing; money already spent cannot be recovered by changing the meter.

The period, subscriber-day and global-day caps remain independent brakes. The Worker reads the paid invoice through Stripe when refreshing confirmed subscription standing; it does not grant a new budget simply because an `invoice.paid` webhook arrives. The standing and its budget-policy snapshot are cached for at most one minute and cleared by subscription/refund events. The browser stores successfully voiced audio locally, so replaying it there makes no new vendor request. A different device, erased cache or changed voice can require another metered request.

## Configuration and verification

Keep the ElevenLabs key and default voice id in Worker secrets (`ELEVENLABS_API_KEY`, `PLUS_VOICE_ID`). Production may instead use its private `PLUS_VOICE_PROVIDER` service binding targeting `rise-plus-preview`, named entrypoint `VoiceProvider`, where the existing encrypted ElevenLabs key remains. No key is copied or returned. The preview wrapper refuses every public `/api/plus/voice` request, including valid test-payment cookies; only private RPC renders with its key. The broker independently bounds text to 10,000 characters, fixes the Flash model and checks the configured voice allow-list. Production must authenticate and reserve both budgets before invoking it, and an uncertain RPC outcome keeps the debit. A default voice ID mismatch between Workers fails closed. Deploy and verify the preview wrapper before enabling the production binding; a configured binding alone is not proof that a provider call will succeed. Required CI dry-runs both bundles and retains the preview bundle/config alongside the tested release. The production job compares both bundles and the preview configuration to that artifact, deploys the private provider first, then deploys production; both deployments require the tested commit to remain the latest main head. Use the server's configured voice allow-list and the bounded `eleven_flash_v2_5` model; never accept a vendor voice id or cost rate from the browser. Subscriber routes also require `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PLUS_COOKIE_SECRET`, `PLUS_PRICE_ID`, a live `PLUS_PAYMENT_LINK`, the `PLUS_METER` binding and the configured rate limiters. Production's `PLUS_REQUIRE_LIVE=true` must refuse test-mode payment credentials and links. Missing required credentials or invalid spend-policy values must fail closed.

| Policy value | Accepted setting |
| --- | --- |
| `PLUS_VENDOR_MICRO_USD_PER_CHAR` | Defaults to 60; at least 60 microdollars per character ($0.06 per 1,000) |
| `PLUS_FEE_BPS` | Defaults to 500; at least 500 basis points (5%) |
| `PLUS_FEE_FIXED_USD_CENTS` | Defaults to 50; at least 50 cents |
| `PLUS_RESERVE_BPS` | Defaults to 5,000; from 5,000 to 10,000 basis points reserved, so voice receives at most half |
| `PLUS_ADMIN_MONTHLY_USD_CENTS` | Must be explicitly set; from 1 to 500 cents shared by all administrators |
| `PLUS_ADMIN_DAILY_CHAR_CAP` | Defaults to 25,000; cannot exceed 25,000 characters shared by all administrators per day |

`GET /api/plus/status` reports verified `admin`, `subscriber`, deployment `available`, configured `adminLogin`, and the effective `allowance` or null. `GET /api/plus/admin/login` verifies Access identity and returns the administrator to `/settings`; an unverified identity is refused. Settings' admin link uses this same-origin route and conveys no credential or client-side authority.

Before calling production ready, record all of the following against the exact deployed commit:

1. Required CI and the relevant full-validation results, with unrelated failures identified.
2. A denied unauthenticated admin request and a real administrator completing Access sign-in; public reading still opens without signing in.
3. A paid subscriber's invoice-derived allowance, a refusal at the spend boundary with no additional vendor call, and continued silent reading after refusal.
4. Concurrent requests, duplicate and out-of-order invoice events, refunds and renewals preserving the budget; administrator and subscriber meters remain separate.
5. A small authorized ElevenLabs voicing and a browser-cache replay making no second vendor request. Do not print credentials, tokens, private text or audio into logs or task evidence.

The dashboard audit identifies the team domain as `sweet-base-63a2.cloudflareaccess.com` and existing Access applications, but no dedicated application for `rise.syberlabs.io/api/plus/admin/*`. The existing `rise-production` Workers application governs a different scope and must not supply the admin audience. Wrangler's organization lookup returned 403, so that token is not evidence of organization visibility. The new application's audience remains to be configured and verified. Keep SPK-005 in progress until configuration, deployment and the real sign-in and voice checks have evidence.
