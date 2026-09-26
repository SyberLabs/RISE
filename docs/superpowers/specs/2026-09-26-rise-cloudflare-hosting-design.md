# RISE Cloudflare hosting and Jev release

## Goal and ownership

Make `https://rise.syberlabs.io` the user-owned RISE production origin. A reading decision initiated in the browser must reach the RISE API on the same origin, call the fixed Jev model through OpenRouter, and return a bounded decision to the reader. The domain, Cloudflare account, OpenRouter key, and GitHub release credentials belong to Seth. This design covers RISE only; the SyberLabs homepage and Relay have separate deployments and release plans.

The first release must not depend on Netlify. Keep `rise.syberlabs.space` available while its existing browser-local data remains there. Do not redirect that old hostname until a complete, tested transfer path or an explicit retirement decision exists. The `.io` apex `/rise` path redirects to `https://rise.syberlabs.io/`; RISE itself stays at the hostname root so its routes, assets, and browser storage use one isolated origin.

## Chosen approach

Deploy one Cloudflare Worker with Static Assets for the Vite build and a Worker script for `/api/*`. Use `single-page-application` handling for app navigation and route `/api/*` to the script first. Preserve the two existing Netlify API contracts: `/api/jev-decision` for a server-owned OpenRouter key and `/api/jev/route` for the existing Scriptorium bring-your-own-key flow. API failures return API errors, never the SPA HTML shell.

This follows the draft Jev integration in PR #178. Reconcile that branch with current `main`, including the later removal of the reading path gate in #181, before releasing. Port the functions and their focused tests without changing the reading decision schema, user consent checks, input bounds, fixed model, or fail-closed behavior.

Because #181 removed the prior reading gate, add a small, explicitly user-triggered Jev preview page within the RISE build. It sends one bounded sample reading state from the browser to the same-origin endpoint and displays the validated action, model, and request ID. It must not change playback, route a reader automatically, retain an excerpt, or require a personal OpenRouter key. This provides an observable frontend-to-provider test without restoring the removed gate.

Cloudflare Pages plus a separate API Worker adds another deployment and routing boundary. Hosting RISE under `syberlabs.io/rise` requires rebasing root-relative paths, the manifest, and API routes. Neither extra layer earns its cost for the first release.

## Runtime and security

Use distinct staging and production Workers. Attach `rise.syberlabs.io` as a production Custom Domain only after the `syberlabs.io` zone is active. The existing account-wide Cloudflare Access policy protects every Worker by default. Keep staging protected; create a Worker-level public bypass for the RISE production Worker only, and verify Relay remains behind Access. The production Worker holds a separate spend-capped OpenRouter key as a Worker Secret named `OPENROUTER_API_KEY`; never place it in source, GitHub logs, browser storage, or a public environment variable. The model identifier stays fixed server-side.

Apply the existing request validation and size bounds before the provider call. Add an API-specific Cloudflare rate-limit binding with the current 30-request-per-IP-per-minute intent; treat it as abuse friction rather than exact accounting, and use the OpenRouter key cap as the hard spending guard. Preserve or deliberately replace the Netlify CSP, security headers, cache policy, and SPA fallback behavior. Do not log prompts, reading excerpts, API keys, or full provider responses. Log only enough bounded metadata to correlate a test decision and diagnose failures.

The `/api/jev/route` bring-your-own-key flow must preserve its existing browser consent and key handling. It must not start using the server-owned key by accident.

## Delivery and verification

The GitHub deployment workflow builds the exact commit that passed the repository's required `CI` check, then deploys staging. After staging checks pass, a protected production job deploys that same artifact. Keep Cloudflare deployment credentials scoped to the needed account and Worker resources, in GitHub environment secrets. Declare required Worker secrets so a deploy fails when the key is absent. Keep a known-good deployment available for rollback.

Staging verification covers root and deep links, static media, PWA manifest, cache and security headers, both API routes, API error responses, the rate limit, and the Jev preview page. A live test submits one sample reading state from that page and confirms one paid Jev decision in OpenRouter usage and bounded Cloudflare logs. Production verification repeats the frontend preview decision and HTTPS checks on `rise.syberlabs.io` after the custom domain is active. No Go server or Kafka queue is in this release path.

Before launch, update canonical and public-host references, QR/link defaults, privacy and terms copy, and any deployment documentation that names Netlify as the new production host. Announce the new origin as a fresh browser storage location. The current export is incomplete and there is no full import, so it is not a verified migration mechanism.

## Release gates and rollback

1. `syberlabs.io` resolves through the assigned Cloudflare nameservers and the zone is active.
2. Staging deploys from a passing commit and all non-provider checks pass.
3. The staging UI completes a paid Jev decision with the expected fixed model and no exposed key.
4. Production serves the app and API publicly over HTTPS, Relay still requires Access sign-in, and RISE completes its own UI decision.
5. The old `.space` RISE origin remains reachable for existing browser data.

If production fails, roll the RISE Worker back to the known-good deployment and keep the old site accessible. Do not change Relay's hostname, Access policy, or database as part of this rollback.
