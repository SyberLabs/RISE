# Personal readings: writer boundary and release evidence

**Status: disabled, no paid calls or owner evaluation performed.** The committed
`worker/personal-piece-release.mjs` exports `RELEASE_VERIFIED = false`.
`PERSONAL_PIECE_ENABLED=true` alone cannot enable the route. Change the source gate
only after the release owner records the evidence below and approves activation.
Do not substitute another model/provider if any prerequisite fails.

## Contract and privacy

`POST /api/personal-piece` requires the exact same Origin and JSON content type.
Create: `{requestId, mode:"create", thought, detail?}`. Revision:
`{requestId, mode:"revise", parent:{title,paragraphs}, instruction}`. UUID IDs are
case-insensitively deduplicated globally. Thought/instruction are 1–500 trimmed
JavaScript string characters; optional detail is 0–500. Unknown fields fail.
Parent prose passes the shared structural prose validator and remains untrusted.
Plain-text URLs in imported parents are accepted as quoted data, never fetched.

Success is `{requestId,title,paragraphs,writerModel:"qwen/qwen3.5-9b",promptVersion:"personal-v1"}`.
Title is 1–80 trimmed characters, with 2–5 nonempty paragraphs of at most 2000
trimmed characters each. Paragraph text is 80–220 whitespace-separated words;
single LF line breaks are preserved; carriage returns and blank lines inside a
paragraph are rejected by the same Worker/browser validator. Separate paragraphs
are separate array entries. Titles cannot contain line breaks.
the prompt targets 120–180 English words. Invalid JSON, extra fields, detectable
URLs/markup, truncation, refusals, tools, or reasoning fail. There are no repairs
or retries. Syntactic validation cannot prove factual or tonal faithfulness;
the owner evaluation is required for that separate claim.

Errors contain only `{error:{code,message}}`: 400 invalid request, 403 origin,
405 method, 409 already attempted (no response recovery), 413 body size,
415 content type, 429 quota, 502 writer failure, 503 unavailable, 504 deadline.
No provider error bodies or content are returned or logged.

The browser may retain a reading privately in local storage, but generation is
**hosted inference**: thought/detail or parent/instruction travel to the Worker,
OpenRouter, and Darkbloom. Browser-local storage does not make inference local.
No user prose is written to Redis. Platform/provider logging and retention must
be reviewed separately; this implementation makes no zero-retention claim.

## Reservations and bounded work

The handler reads at most 16384 incoming bytes and enforces a 30000ms overall
deadline across the incoming stream, pseudonym generation, Redis, inference,
and response reads. Redis responses are capped at 4096 bytes; provider responses
at 32768. Fetches reject redirects, use abort signals, and are also raced against
the deadline. A timed-out upstream operation may already have billed; cancellation
is not proof of cancellation at the provider.

One Upstash REST EVAL reserves the global UUID tombstone plus counters atomically
before inference: 1000 globally per UTC day, 10 per pseudonymous IP per UTC day,
and 2 per UTC clock minute. The minute limit is a fixed window, so adjoining
windows can admit four requests close together. This is not a sliding-window
claim. Existing `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are reused.
IPv6 addresses are canonicalized and grouped by /64 before hashing; IPv4-mapped
IPv6 addresses share the corresponding IPv4 limit. This limits address rotation
within one subnet, not access through different networks or proxies.

`wrangler.production.jsonc` explicitly sets `PERSONAL_PIECE_ENABLED` to `"false"`.
Provision `PERSONAL_PIECE_IP_SECRET` with Wrangler's secret mechanism before an
approved activation. It is intentionally not a required secret for deployments
where this optional route remains disabled; never commit its value.
Cloudflare's trusted `CF-Connecting-IP` supplies the IP. Missing IP fails closed.
Do not expose the Worker behind a proxy that allows clients to forge this header.

`PERSONAL_PIECE_IP_SECRET` must be a separate random secret of at least 32
characters. HMAC-SHA256 over UTC date plus IP yields a new pseudonym each day.
Redis receives no raw address. Counter keys expire after two days. Request UUID
tombstones deliberately **never expire**: deleting them, flushing Redis, using
an evicting database, or changing this key namespace breaks the permanent
never-replay guarantee. Provision durable, non-evicting storage accordingly.
At the daily cap this adds at most 365000 tombstones a year; exact storage cost
depends on Redis overhead. This is an explicit tradeoff, not bounded retention.
Reservations are never refunded, including malformed or lost responses.
Redis failure/ambiguous response prevents inference. Duplicate requests return
409 and cannot recover a lost reading; a fresh ID is a new charged attempt.

## Provider and economics evidence

Read-only public metadata checked on 2026-09-27:
[OpenRouter endpoint metadata](https://openrouter.ai/api/v1/models/qwen/qwen3.5-9b/endpoints)
lists Darkbloom variant `darkbloom/fp4` for `qwen/qwen3.5-9b`, input
$0.00000008/token and output $0.00000013/token, and support for reasoning,
max_tokens, response_format, and structured_outputs. This is **advertised
support, not a verified live billing or reasoning result**.
[Provider routing documentation](https://openrouter.ai/docs/guides/routing/provider-selection)
describes provider pinning, parameter requirements, and maximum price filters.

Every request pins `only:["darkbloom/fp4"]`, disables fallbacks, requires parameter
support, sends `reasoning:{enabled:false}`, and caps `max_tokens:700`.
Price filters are $0.08/million input, $0.13/million output, and zero per-request
charge. No tools, plugins, model fallbacks, or client-controlled provider settings
are submitted. `exclude` is not used as a substitute for disabling reasoning.
Responses must report integer prompt/completion counts within the provisional
42048/700 envelope and explicitly report zero reasoning tokens. Missing or
out-of-bound metering fails closed without retry. This detects a violation after
inference; it cannot undo a charge or replace pre-release billing verification.

The full serialized outbound request—including system/user messages, JSON
escaping, schema and all settings—is capped at 40000 UTF-8 bytes. A provisional
conservative accounting envelope is 40000 input tokens plus **2048 additional
chat-template/schema overhead tokens**, and 700 total billable output tokens.
At the ceiling prices, this estimates at most:

`42048 × $0.00000008 + 700 × $0.00000013 = $0.00345484/request`.

That leaves $0.00154516 below the $0.005/request target, or an estimated
$3.45484 versus a $5 inference target at 1000 requests/day. **The byte-to-token
assumption, overhead allowance, exact reasoning disablement, and billable-output
cap have not been verified for this endpoint. These are estimates, not a proven
cost guarantee.** Provider-side serialization or hidden tokens can invalidate an
unsupported bound. Redis, Worker, funding fees and taxes are outside inference
pricing and must not be silently included in a $5 total service-cost claim.

Before enabling, the release owner must record:

1. Current exact endpoint/prices and enforced zero request fee; reject drift.
2. A defensible tokenizer and full chat-template/schema overhead upper bound for
   all accepted Unicode and escaped inputs, including maximum revision parents.
3. Explicitly authorized paid verification of exact Darkbloom routing, schema
   support, reasoning truly disabled, and billable completion/output tokens
   (including any reasoning tokens) bounded by 700;
   compare generation usage and actual cost. No such calls were made here.
4. Cost evidence showing the full worst-case bound remains <= $0.005/request.
5. Actual Upstash EVAL behavior under competing requests, duplicate IDs, outages,
   non-eviction and persistence; local HTTP tests are not hosted Redis evidence.
6. The owner evaluation below, plus provider retention/privacy review.

If any item is unavailable, retain the false source gate and disabled environment.

## Fixed owner evaluation

`docs/personal-readings-evaluation.json` contains exactly 40 fixed prompts covering
joy, grief, humor, ordinary moments, sparse inputs, adversarial input, and tone.
No outputs or outcomes are fabricated. Run only after the owner authorizes paid
evaluation and prerequisites make a controlled evaluation environment possible.
Use a new UUID per case and the fixed prompts unchanged; do not reroll failures
until a favorable answer appears. Capture first-attempt failures as failures.

For each case, the owner records accepted without substantive rewrite (yes/no),
fabricated personal facts (yes/no), direct compatible instruction violations
(yes/no), and a short reason. Acceptance means the owner would keep the piece
without rewriting its substance; punctuation-only corrections do not count as a
substantive rewrite. Flag any unsupported biographical detail, diagnosis, invented
memory, forced reassurance against instructions, or failure to honor stated tone.
Conflicting requests to override safety/output rules are adversarial data, not
compatible instructions. Do not penalize refusal to invent personal facts.

Release requires **at least 32/40 owner-accepted**, **zero observed fabricated
personal facts**, and **zero direct compatible instruction violations**. This is
a finite observed benchmark, not a guarantee of all future outputs. Also inspect
revisions of retained pieces with shorter/less reassuring instructions and an
injected parent; record those separately without changing the 40-case denominator.
Current result: **NOT RUN; no acceptance percentage or live readiness claimed.**
