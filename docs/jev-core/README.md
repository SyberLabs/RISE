# Mandatory Jev conductor

Status: integration and verification on `codex/jev-core`, tracked in [PR #175](https://github.com/SyberLabs/RISE/pull/175). Tested checkpoints are pushed as they finish. Netlify deploy previews run from this branch; production activation and a real Jev decision require a TypeSafe key.

## Approved direction

Every reading session requires a live Jev decision before text progression. Jev selects continue, slower, or pause using the reader's stated intent and a bounded excerpt. Existing source order, devotional order, content rights, and accessibility constraints remain ordinary-code invariants. No alternative model or static decision replaces a failed Jev call.

The first implementation conducts the reader's selected source. Automatic discovery and selection of new library passages is subsequent work; do not represent this first slice as semantic library search.

## Implementation plan

- [x] Luna service: protected Netlify endpoint, bounded validated inputs, TypeSafe structured choices, timeout and unavailable responses, no secret or text logging.
- [x] Luna client: explicit remote-processing consent, reader intent, strict client response validation, abort and stale-request handling.
- [ ] Luna playback: decisions before Stream and Page passage display, bounded slowing, retry, pause and destruction correctness.
- [ ] Coordinator: root session integration, devotional entry and boundaries, README/privacy updates, deployment configuration and validation.
- [ ] Review: focused failure/bypass tests, production build, browser smoke, real Jev and deployment verification when credentials are available.

## Shared contract

`POST /api/jev-decision` takes `requestId`, `intent`, `feedback`, `excerpt`, `mode` (`reading` or `devotional`), and `pace`. It returns `requestId`, `action` (`continue`, `slower`, or `pause`), `model`, and `confidence`. Intent and feedback are each at most 500 characters; the excerpt is at most 2000. The client never sends a provider key. The server uses `TYPESAFE_API_KEY` and optional `JEV_MODEL`, defaulting to `jev-latest`.

Consent is explicit for every session, including personal text. Excerpts are data, not instructions. Provider failure blocks progression but never prevents exit or access to saved work. A decision is specific to the active reading position; late results must not restart an exited or superseded session.

## Evidence and collaboration

The Luna agents own their source files and write evidence to service.md, client.md, and playback.md. The coordinator owns integration, commits, PR updates, and deployment. Keep credentials out of this repository and comments. Official protocol reference: https://docs.typesafe.ai/api.

The dedicated browser tests in `e2e/jev-core.spec.js` exercise actual consent and client requests with explicitly simulated service responses. Existing browser feature tests use `e2e/fixtures.js` to consent and simulate a successful decision; they do not bypass the production gate. Neither test path establishes TypeSafe access or decision quality.

## Current scope and tradeoffs

- Reader intent and passage content inform continue, slower, or pause. A blocked reader can submit fresh feedback and retry.
- Jev decisions never rewrite, reorder, or select replacement text. Devotional order is fixed.
- Page stays paginated so only the page being opened is submitted. Whole-book print and elongated Page are unavailable in a Jev session; preflight submission of every unread passage would be an unnecessary privacy and latency cost.
- No new Hugging Face runtime is added in this slice. Swapping providers would change the approved Jev-specific requirement and needs an explicit product decision.

## Activation

Create a key in the [official TypeSafe console](https://console.typesafe.ai/) and configure `TYPESAFE_API_KEY` for Netlify Functions. Do not put it in browser variables, Git, or a PR comment. Rebuild the preview, verify a real continue/slower/pause response and outage recovery, then promote the reviewed commit. Without the key the endpoint returns `503 JEV_NOT_CONFIGURED` and reading stays blocked by design.

## Next seven days

1. Finish the mandatory reading path and failure tests in this PR. Keep the selected text and fixed devotional order.
2. Obtain TypeSafe access and verify actual service responses on the preview. If access is unavailable, decide explicitly whether the product requirement can change to an open model; do not introduce a silent fallback.
3. Evaluate a small authored set of straightforward, dense, and devotional passages with reader intent and feedback. Record expected control choices, actual choices, response time, and failures without storing personal text.
4. Try full readings across Stream, Page, Rosary, and Stations. Measure interruptions and whether slowing helps; a valid JSON result alone is not evidence of usefulness.
5. Correct failures found in those readings, especially repeated pauses, rate limits, and excessive latency. Keep changes within the three-choice contract.
6. Re-run regression tests and the failure/recovery browser checks on the proposed release commit.
7. Promote only after real provider checks pass. Record the deployed commit and known limitations in this document. Add library discovery or another provider only if the evidence identifies a concrete need.
