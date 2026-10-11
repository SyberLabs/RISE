# RISE Plus customer delivery plan

**Goal:** ship a coherent, recoverable customer subscription path and a professional customer/hiring presentation.

**Architecture:** extend existing Stripe/Worker subscription code; lazy customer UI; retain static SyberLabs marketing and separate staff access.

**Spec:** [Approved direction](../specs/2026-10-11-plus-customer-launch.md).

## Implementation and verification

- [ ] Backend owner: `worker/plus.mjs` and lifecycle/budget tests. Prove server-selected pricing, funded offer, browser-bound claim, secure one-use recovery, active subscription selection across customer records, canceled-customer portal, renewal, and legacy compatibility. Run the focused Worker suites and required CI.
- [ ] Client owner: customer API helper, Plus component, callback handling, Settings route, free-demo continuation, tests. Prove unavailable/error/active/canceled states, duplicate prevention, callback URL clearing and explicit browser-local continuation. Run unit tests and browser acceptance.
- [ ] Website owner: Plus sales page, shared navigation and Mateo's selected work. Verify factual contribution attribution, price/allowance consistency, desktop/mobile rendering, internal links and the website's required validation.
- [ ] Release owner: publish matching privacy/terms, explicit closed-sale configuration, include new lifecycle tests in required CI, independently review changes, merge through required checks and verify exact release markers plus public customer/free journeys.
- [ ] Production acceptance: complete owner-only Stripe verification and confirm legal operator; configure sender/portal/webhook; exercise real deployed payment, first voice, recovery and cancellation before opening sales.

## Decisions and omissions

No replacement billing stack, general cloud account, invented customer metrics, unverified premium sample, hidden allowance reduction, or forced guest registration. New sales can close without taking away existing customers' billing management.

## Evidence

Baseline latest main d659b6a9: 101 fast-test files passed, 2,326 tests passed and four skipped after content generation; initial assets 61.8 KB Brotli under 64 KB. These are baseline measurements, not evidence for the implementation above.
