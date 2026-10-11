# RISE Plus customer lifecycle

Status: implemented in branch; not a claim of live payment availability. The reader remains free and staff Access remains separate.

## Offer and release configuration

The new offer is USD 8.99 per month, plus applicable tax, for 60,000 voiced characters per billing period. Existing subscriptions without `rise_offer=v1_60000` retain their existing funded allowance policy, capped at 105,000. Both paths retain per-subscription, daily, global and collected-revenue spending limits. Voice reads the subscription metadata from Stripe; a client cannot select its own limit.

Checkout is closed unless all of these are configured:

- Existing Stripe key, price, webhook secret, signed-cookie secret, meter, address limiter, safe spending policy and working voice provider.
- `PLUS_CHECKOUT_ENABLED=true` explicitly opens the new offer. Closing it does not disable subscriber voice, recovery or billing management. Production still requires `PLUS_REQUIRE_LIVE=true`; test keys cannot sell there.
- `PLUS_PORTAL_CONFIGURATION` names the Stripe Customer Portal configuration. Enable cancellation, invoice history and payment-method updates there; do not enable upgrades or promotional offers that this initial product does not support.
- `RESEND_API_KEY` and `PLUS_EMAIL_FROM` provide recovery mail through a verified sending domain.

The price must be active, USD 899 cents, monthly, interval count one, licensed usage, per-unit, with exclusive tax and an active product. Checkout uses one item, quantity one, card payment and automatic tax, with no promotion codes. The conservative policy must fund the full allowance even after estimated processing fees on 30% added tax. Actual collected-revenue checks still apply to every voice; exceptional refunds, unusually high fees or policy changes can reduce available service and require owner support. Do not describe the spending guard as a way to quietly change the paid promise.

A repurchase creates a fresh Stripe customer so old credits, discounts and pending invoice items cannot silently underfund it; the previous local billing identity stays intact until the new purchase is claimed. Recovery selects an active subscription across up to ten matching Stripe customers.

The server caches the checked price for 60 seconds for configuration reads and checks it again when creating Checkout. Provider readiness has a five-second bound; Stripe and email requests have ten-second bounds. Address limits apply before new public lifecycle requests. No new background polling or inference is introduced.

## API contract

All customer POSTs require the request's own `Origin`, JSON content type and a body at most 64 KiB. The shared error shape is `{ "error": { "code", "message" } }`.

| Endpoint | Request | Successful response |
| --- | --- | --- |
| `GET /api/plus/config` | — | Existing `paymentLink`; new `checkoutAvailable`, `recoveryAvailable`, `offer` (null while closed, otherwise `{amount:899,currency:"usd",interval:"month",characterLimit:60000}`) |
| `POST /api/plus/checkout` | `{request_id: UUIDv4}` | `{url}` for Stripe Checkout and a 24-hour HttpOnly purchasing-browser cookie. Reuse the request ID after an uncertain network outcome. |
| `POST /api/plus/claim` | `{session_id}` | 204 and voice/billing cookies, only after Stripe verifies payment and subscription. Newly created sessions also require the matching purchasing-browser cookie. |
| `GET /api/plus/status` | Signed cookies | Existing status plus `billingAvailable` and authoritative `canSubscribe` (true for signed-out readers or a verified canceled/incomplete-expired subscription); a verified renewal refreshes voice/billing cookies. |
| `POST /api/plus/portal` | `{}` | `{url}` for Stripe Customer Portal. Customer ID is taken only from verified server-signed identity and checked against Stripe. |
| `POST /api/plus/recover` | `{email}` | 202 `{accepted:true}`, including an unknown email or email-delivery failure. |
| `POST /api/plus/restore` | `{token}` | 204 and cookies. An expired, used or invalid link returns 400 `RECOVERY_INVALID`. |
| `POST /api/plus/forget` | — | Clears local voice and billing identity. Does not cancel a subscription. |

Checkout success returns to `/plus/claim?session_id=...`; cancellation returns to `/plus/`. The client removes the session ID after capturing it. A copied success link or lost purchasing-browser cookie returns 401 `CHECKOUT_BROWSER_REQUIRED`; direct the customer to email recovery. A recognized existing subscription returns 409 `PLUS_EXISTS` instead of starting another. Anonymous customers must be advised to restore an existing subscription before buying again; the app does not infer identity from an unverified email.

Recovery email links use `/plus/restore#token=...`. The fragment does not enter ordinary server request logs. The client must immediately remove the fragment, then POST the token without putting it in local storage or telemetry. Links expire after 15 minutes and consume their proof atomically once. Successful recovery of a canceled subscription restores billing management, never paid voice access. Recovery merges the immediate exact-email customer list with a bounded case-insensitive Stripe search and checks returned email addresses itself. Search can lag a recent purchase; the exact list remains usable then. Recovery prioritizes an active subscription across matching customers. Truncated Stripe customer/subscription lists fail closed rather than selecting incomplete evidence.

## Stored data and trust boundaries

- The existing voice cookie remains the entitlement hint; Stripe and the meter remain authoritative.
- `__Secure-rise_plus_billing` holds signed customer/subscription IDs, Stripe mode and issued/expiry times. It lasts at most 40 days per refresh and permits billing management after paid voice lapses. It uses a different signing purpose from voice and recovery.
- `__Secure-rise_plus_checkout` holds a signed request identifier, Stripe mode and issued/expiry times for 24 hours. Stripe's matching `client_reference_id` binds the new purchase to that browser. It is not a voice entitlement.
- All three cookies are HttpOnly, Secure, SameSite=Lax and scoped to `/api/plus`.
- The subscription's existing Durable Object also keeps the latest Stripe subscription status for cached repurchase eligibility; signed webhook status/deletion events update it. Its recovery record stores only the latest recovery token SHA-256 digest, expiry and issue timestamp. Successful consumption deletes the record; later requests replace it. An expired digest is inert but is not scheduled for deletion. The record also enforces a 60-second per-subscription email cooldown.
- Stripe stores the customer/payment/subscription information; Resend receives the recovery email address and bearer link. The Worker stores no email address, raw recovery token, customer text or audio for this flow and does not log them. Resend's own retention applies.

## Required release evidence

Local fixture tests are not vendor acceptance. Before opening live sales, the owner must finish Stripe business verification, configure the live price, automatic tax and portal, install the correct webhook secret, configure and verify the email sender, and exercise an actual complete live subscription under the release process. The release check must cover a real vendor render, repeat and canceled Checkout, fresh-browser email recovery, invalid/reused recovery links, renewal, payment failure, cancellation, refund/dispute revocation, quota boundaries and billing support. Keep the paid flag closed if these prerequisites are absent.
