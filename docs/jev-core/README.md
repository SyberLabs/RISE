# Required reading guide powered by OpenRouter

Status: the user approved replacing Jev with OpenRouter on 25 September 2026. Implementation is on `codex/jev-core` in [PR #175](https://github.com/SyberLabs/RISE/pull/175). The branch and internal `jev` names are retained to keep the provider switch narrow; they no longer imply a TypeSafe dependency.

## Current requirement

Every reading session obtains a live reading decision before progression. The selected OpenRouter model chooses continue, slower, or pause from the reader's intent, optional feedback, current excerpt, mode, and pace. Source text and devotional order remain fixed. An unavailable or invalid decision blocks progression with retry and exit available.

This replaces the previous Jev-specific requirement. There is one provider integration, no Jev fallback, no local substitute decision, and no new SDK dependency.

## Implementation checklist

- [x] Server: OpenRouter chat completions with strict action schema, bounded input, timeout, safe errors, and server-only credentials.
- [x] Client: accept only request-correlated action and model; remove Jev confidence claims.
- [x] Consent and policies: disclose OpenRouter and the selected model provider.
- [ ] Verification: focused unit tests, required project checks, browser consent/failure tests, and preview deployment.
- [ ] Activation: configure an OpenRouter key and validate real decisions before production promotion.

## Contract and boundaries

`POST /api/jev-decision` remains the internal same-origin route. Input fields are `requestId`, `intent`, `feedback`, `excerpt`, `mode`, and `pace`. Intent and feedback are at most 500 characters each; excerpts are at most 2,000 characters. The response is `{ requestId, action, model }`, with action limited to `continue`, `slower`, or `pause`. It contains no claimed probability or confidence.

The server uses `OPENROUTER_API_KEY` and optional `OPENROUTER_MODEL`. The browser never receives these credentials. Reading consent remains explicit for each session. Old or aborted responses cannot reveal a superseded passage or restart an exited session.

Page remains paginated so only the requested page is evaluated. Whole-book print and elongated Page remain unavailable during guided sessions. Automatic library selection and a Hugging Face runtime are outside this change.

## Setup and evidence

See [service setup](service.md), [provider decision](provider-decision.md), and [OpenRouter review](openrouter-review.md). The older [Jev review](review.md) and [runtime review](runtime-review.md) are historical checkpoints, not proof that OpenRouter works.

Set `OPENROUTER_API_KEY` in the Netlify site's environment variables with Functions scope, including deploy previews. Obtain a key at [OpenRouter](https://openrouter.ai/settings/keys). Do not paste it into Git, browser configuration, or a PR comment. Redeploy after changing environment variables. A missing key returns `503 DECISION_NOT_CONFIGURED`; the application does not silently continue.

[Deploy preview](https://deploy-preview-175--rise-v2-symbolic-experience.netlify.app). A successful static deployment alone does not establish a working model request.

## Local verification

The full unit run passed **3,484 tests**, with **63 skipped** (282 test files passed, five skipped). The service suite passed **20/20**, and the final consent component rerun passed **6/6**. The dedicated consent, outage/retry, devotional hold, and Page browser checks passed **4/4** with simulated service responses. Production build first load is **59.4 KB Brotli**, within the 64 KB budget. Hygiene, dependency compatibility, architecture guard, and generated-policy consistency checks passed. These checks do not establish live OpenRouter behavior.

## Next seven days

1. Complete this provider switch and its failure/consent checks.
2. Configure the OpenRouter key and verify real responses on the preview.
3. Evaluate a small authored set of straightforward, dense, and devotional passages with reader intent and feedback; record expected actions, actual actions, latency, and errors without retaining personal text.
4. Try complete readings across Stream, Page, Rosary, and Stations. Measure interruptions and whether slower reading helps.
5. Correct repeated pauses, excessive latency, or rate-limit problems found in those readings.
6. Verify the proposed release commit and real service outage/recovery behavior.
7. Promote after authenticated checks pass. Evaluate Laya only if evidence supports investing in self-hosting.
