# Required reading guide powered by OpenRouter

Status: the user approved replacing Jev with OpenRouter on 25 September 2026. Implementation is on `codex/jev-core` in [PR #175](https://github.com/SyberLabs/RISE/pull/175). The branch and internal `jev` names are retained to keep the provider switch narrow; they no longer imply a TypeSafe dependency.

## Current requirement

Every reading session obtains a live reading decision before progression. The selected OpenRouter model chooses continue, slower, or pause from the reader's intent, optional feedback, current excerpt, mode, and pace. Source text and devotional order remain fixed. An unavailable or invalid decision blocks progression with retry and exit available.

This replaces the previous Jev-specific reading requirement. Reading uses OpenRouter with no Jev fallback or local substitute decision and no new SDK dependency. Main also contains a separate optional, reader-keyed Scriptorium route through TypeSafe; that existing authoring feature is preserved and is not required for reading.

## Implementation checklist

- [x] Server: OpenRouter chat completions with strict action schema, bounded input, timeout, safe errors, and server-only credentials.
- [x] Client: accept only request-correlated action and model; remove Jev confidence claims.
- [x] Consent and policies: disclose OpenRouter and the selected model provider.
- [x] Verification: focused unit tests, required project checks, browser consent/failure tests, and preview deployment.
- [ ] Activation: configure an OpenRouter key and validate real decisions before production promotion.

## Contract and boundaries

`POST /api/jev-decision` remains the internal same-origin route. Input fields are `requestId`, `intent`, `feedback`, `excerpt`, `mode`, and `pace`. Intent and feedback are at most 500 characters each; excerpts are at most 2,000 characters. The response is `{ requestId, action, model }`, with action limited to `continue`, `slower`, or `pause`. It contains no claimed probability or confidence.

The server uses `OPENROUTER_API_KEY` and optional `OPENROUTER_MODEL`. The browser never receives these credentials. Reading consent remains explicit for each session. Old or aborted responses cannot reveal a superseded passage or restart an exited session.

Page remains paginated so only the requested page is evaluated. Whole-book print and elongated Page remain unavailable during guided sessions. Automatic library selection and a Hugging Face runtime are outside this change.

## Setup and evidence

See [service setup](service.md), [provider decision](provider-decision.md), and [OpenRouter review](openrouter-review.md). The older [Jev review](review.md) and [runtime review](runtime-review.md) are historical checkpoints, not proof that OpenRouter works.

Set `OPENROUTER_API_KEY` in the Netlify site's environment variables with both Builds and Functions scopes, including deploy previews. Obtain a key at [OpenRouter](https://openrouter.ai/settings/keys). Do not paste it into Git, browser configuration, or a PR comment. Redeploy after changing environment variables. A missing key returns `503 DECISION_NOT_CONFIGURED` on previews; the application does not silently continue. Production builds run `scripts/check-openrouter-config.mjs` first and stop publication if the key is missing or blank. The existing live deployment remains in place while configuration is pending. This checks key presence, not key validity; real preview decisions must still be verified before activation.

[Deploy preview](https://deploy-preview-175--rise-v2-symbolic-experience.netlify.app). A successful static deployment alone does not establish a working model request.

## Local verification

The full unit run passed **3,484 tests**, with **63 skipped** (282 test files passed, five skipped). The service suite passed **20/20**, and the final consent component rerun passed **6/6**. The dedicated consent, outage/retry, devotional hold, and Page browser checks passed **4/4** with simulated service responses. Production build first load is **59.4 KB Brotli**, within the 64 KB budget. Hygiene, dependency compatibility, architecture guard, and generated-policy consistency checks passed. These checks do not establish live OpenRouter behavior.

The broader browser gate passed **33 tests**, with **14 skipped** and no failures. The documentation index now includes every integration document; the wiki builder passed **55 pages plus sidebar**, including a small Windows path correction needed for local verification. The high-severity dependency audit passed with three existing moderate development advisories; dependencies are unchanged.

Netlify deployed code checkpoint `6b9b041` successfully. A real preview request returned **503 DECISION_NOT_CONFIGURED** with **Cache-Control: no-store**. This verifies the deployed OpenRouter configuration boundary, but confirms that this preview still needs `OPENROUTER_API_KEY`. No authenticated model decision or production activation is claimed.

## Main-branch integration

Integrated main at `093316e`, preserving its UI refinements and separate optional Scriptorium TypeSafe route. The policy and README now distinguish that authoring route from the required OpenRouter reading guide. Integration testing exposed two missing live Scriptorium getters; those were restored without changing the assertions. The affected room/session/prompt and Rosary-door run passed **89 tests** after the fix.

The final merged UI passed the dedicated reading browser checks **4/4** and broader gate **33 passed / 14 skipped**. Those browser builds preceded the two getter-only Scriptorium repairs, which are covered by the 89-test focused run. The production-only key guard and service checks passed **24 tests**. The guard blocks publication without a configured key so the code can be merged without replacing the existing live site with an unusable reading flow.

## Next seven days

1. Complete this provider switch and its failure/consent checks.
2. Configure the OpenRouter key and verify real responses on the preview.
3. Evaluate a small authored set of straightforward, dense, and devotional passages with reader intent and feedback; record expected actions, actual actions, latency, and errors without retaining personal text.
4. Try complete readings across Stream, Page, Rosary, and Stations. Measure interruptions and whether slower reading helps.
5. Correct repeated pauses, excessive latency, or rate-limit problems found in those readings.
6. Verify the proposed release commit and real service outage/recovery behavior.
7. Promote after authenticated checks pass. Evaluate Laya only if evidence supports investing in self-hosting.
