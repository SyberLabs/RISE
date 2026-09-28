# Opus amendment record

Review target: `ded3512`, baseline `5e26c0b`. Hosted writing remains disabled.

Confirmed and repaired: shared server/browser prose validation; duplicate submit
and unrelated-action cancellation; all stale-build reload paths; meaningful
unknown-presentation neutral fallback; Chamber content logging; reload guard
release after Keep; Darkbloom disclosure; IPv6 /64 quota grouping; unrelated
composition history; storage failure recovery copy; revision of imported URLs.

The privacy source and generated page now describe Create. Wrangler explicitly
disables the optional route and documents provisioning its secret without making
that secret a prerequisite for deployments that keep the route disabled.

## Retained requirement: request-ID deduplication

The suggested 48-hour expiry was not applied. Quotas bound attempt volume;
deduplication prevents dispatching the same request identity twice. These are
different guarantees, even though a malicious caller can choose a new UUID.
Permanent records preserve the approved never-replay contract. They cost up to
365,000 small keys annually at the pilot cap and require durable, non-evicting
storage. A finite deduplication window requires an explicit design amendment.

## Existing Portal layout issue

At 1280×800, Chamber's top was y=822.3125 with and without the new Create button.
Opus independently reproduced the same overflow on baseline and review HEAD.
The real-pointer test now scrolls before clicking and proves reachability after
scroll, not first-screen visibility. Restoring Chamber to the first viewport
remains an existing Portal layout task, outside this reading-slice amendment.
The checked-in Portal currently does contain `portal-jev-form`; the review's
claim that no request form exists does not match this checkout. The test comment
now describes its exact guarantee without relying on that layout explanation.

## Activation evidence is still absent

Neither $0.00345484/attempt nor $5/day is a verified billed ceiling. Exact provider
support and metering, hosted Redis behavior, provider privacy review, owner
writing qualification, participant discovery, and acoustic acceptance remain
gates. No paid calls, activation, or deployment were performed for this amendment.
