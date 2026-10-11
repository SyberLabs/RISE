# A complete RISE Plus customer journey

Status: approved implementation direction from the October 11 user request and preceding public-site review. This document records implementation scope, not live launch acceptance.

## Jobs and constraints

A guest can experience their own short writing without an account. A paying reader can activate, recover and cancel a subscription without staff help. A hiring reviewer can find Mateo's verified engineering contributions without decoding the lab's internal operations.

Retain free reading, the existing Worker/Stripe/meter architecture, privacy of browser-local reading content, the 64 KB compressed initial-load budget, and all conservative cost controls. Do not add a general-purpose account or cloud-library subsystem as a prerequisite. Do not claim user demand or individual authorship without evidence.

## Customer contract

The new planned offer is USD 8.99 monthly with 60,000 new voiced characters per paid period, 25,000 per day and 10,000 per request. Cached local audio replay does not make another request. Preserve existing subscriptions' invoice-derived policy. Never advertise availability unless the configured Stripe price, funding policy, webhook, voice provider, recovery sender and billing portal satisfy readiness checks.

Hosted Checkout is created by the server; client input cannot choose price or customer. New Checkout returns to `/plus/claim` and is bound to a signed browser cookie. An email-verified one-use recovery link supports a lost return or a new browser. Its token is carried in the URL fragment and erased before network submission. Billing identity remains separate from voice authorization so customers can manage a canceled subscription.

The customer screen at `/plus/` is lazy-loaded within the existing Settings architecture. An explicit own-text upgrade action can preserve at most 5,000 characters in session storage across Checkout and hand it to the voice workspace after activation; it never starts paid generation automatically.

## Release conditions

Code, required CI, browser layout and provider-independent lifecycle tests must pass before merge. Production must serve the exact merged release. Live payment acceptance additionally needs the business owner's real Stripe verification, the actual legal operator, working transactional email and webhook/portal configuration, and a witnessed payment/render/recovery/cancellation path. Sandbox or automated evidence must not be represented as live acceptance.

## Product hypothesis

Short-form writers and creators are the initial positioning hypothesis. Outside-user observation and paid repeat use remain necessary to establish a recurring job. Marketing makes no efficacy or retention claims in their absence.
