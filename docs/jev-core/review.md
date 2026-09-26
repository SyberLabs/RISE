> Historical Jev checkpoint review. Superseded for provider integration by [the OpenRouter review](openrouter-review.md); these test counts and TypeSafe statements describe the earlier implementation.

# Independent Jev review

Review by Luna on `codex/jev-core`, focused on the protected decision service, Netlify routing, browser-test fixture, and reading integration boundaries. This is a review record, not approval to merge or deploy.

## Findings and disposition

- No unresolved static code-quality or boundary finding remains in the reviewed scope. The TypeSafe call is server-side only; the client cannot choose its model or action. Same-origin JSON, input size/field bounds, strict response validation, rate limits, no-store responses, and bounded upstream timeouts are enforced. Errors avoid returning provider response bodies, credentials, or reader text; request/provider data is not logged.
- The service prompt considers passage density and specialized concepts relative to the reader's intent and configured WPM. It prohibits rewriting, summarizing, reordering, skipping, or adding to the source passage. A slower choice is actionable in automatic playback; page-controlled and manual devotional reading display a nonblocking “take more time” cue without changing their authored order or reader-controlled timing.
- Page mode sends one bounded decision for the visible page text, rather than separate requests for each passage. This keeps the action scoped to the page the reader is considering and avoids conflicting slower/continue results and repeated retries.
- `collectAcrossPages` now waits for the initial `.page-article` and initial Jev approval, as well as page-turn approval and approval after restoring page zero. This prevents a test from counting transient, unapproved page content.
- The initial broad browser-gate failure was a harness route collision: a later catch-all used `route.continue()` and bypassed the shared Jev mock. It now uses `route.fallback()`. Page-mode assertions also reflect Jev's required pagination and whole-document print refusal. The test-only fixture supplies request-correlated `continue` decisions and accepts the consent prompt; Jev-specific browser specs keep direct Playwright control to test consent and failures.

## Verification evidence

- Parent reports the final focused endpoint suite passed 14 tests; the endpoint syntax check passed. The endpoint tests cover request shape/criteria, malformed responses, outages, timeout, missing credentials, bounds, and safe errors.
- Parent reports the dedicated Jev browser checks passed 2/2, covering normal-reading consent/failure/retry and devotional consent with a held prayer until approval.
- The final browser gate built the site and completed **33 passed, 14 skipped, 0 failed** (47 discovered); the skips follow the suite's configured conditions.
- After the final Chamber pause change landed later than the full-gate build, the updated production build and affected Jev Page browser check passed **1/1**. The dedicated Page/core browser group passed **8/8** before that Chamber change.
- Runtime reports the final focused Jev suite passed **47 tests across six files**; parent reports the final endpoint suite passed 14 tests and endpoint syntax check passed. These cover Page-level approval/retry behavior and the service contract, respectively.

## Evidence boundary

No `TYPESAFE_API_KEY` is available. No live TypeSafe request, provider decision-quality assessment, deployed rate-limit behavior, or production activation has been verified. Root subsequently verified successful Netlify preview packaging and a real HTTP 503 `JEV_NOT_CONFIGURED` response on checkpoint `0af77fa`; see the coordinator's latest evidence in README.md. Reading progression stays blocked without the key; there is no alternate-provider fallback.

Static Netlify review found the function's default directory, exported path/method, and per-IP rate-limit configuration consistent with the documented platform contract. The current `connect-src 'self'` policy permits the same-origin client request, so no redirect or CSP change was needed.
