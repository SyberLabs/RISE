# User-owned AI in RISE

RISE never spends SyberLabs inference credentials. AI features run on a
connection the reader owns, and reading and manual settings need none.

| Option | What runs | Who pays | Where the credential lives |
| --- | --- | --- | --- |
| **Connect OpenRouter** | Hosted Jev (`typesafe/jev-1.13`) through OpenRouter's Decisions API, called straight from the reader's browser | The reader's OpenRouter account | In the tab's memory only; gone on reload, close, or Disconnect |
| **Run locally** | Local RISE plus pinned Kev-4B on the reader's computer ([LOCAL-RISE.md](LOCAL-RISE.md)) | Nobody. There is no hosted inference bill | A per-run key between the local bridge and Kev; the page never sees it |

## One decision contract

`src/core/decision/` is used by the browser (hosted Jev), local RISE (Kev), and evaluation:

- `recommend.js` builds the finite choice questions from the public catalog, admits an answer only if every choice was offered, and maps it to reading settings with deterministic code. A model answer can pick an offered value and nothing else.
- `call.js` makes exactly one call with a deadline and the reader's cancel signal. It never retries and never falls back to another provider. A timeout, a cancellation, a `401` (revoked or expired key; the key is dropped), a `402` (no credits), or a malformed answer all end the request without a paid retry.
- `providers.js` accepts a Jev answer only as `provider: TypeSafe` with the `typesafe/jev-1.13` family, and a Kev answer only with the pinned `X-Kev-Revision` attestation.
- `catalog.js` validates the public catalog in the Worker, the browser, and the local bridge.

The same connection serves the auxiliary features: Scriptorium routing (`route.js`), section visual direction (`src/core/passage-visuals/score-provider.js`), and the EnterpRise "Kev (local RISE)" decider (`src/enterprise/remote-decider.js`, local only).

## Connect OpenRouter (OAuth PKCE)

Following [OpenRouter's OAuth PKCE guide](https://openrouter.ai/docs/guides/overview/auth/oauth), `src/core/openrouter-oauth.js`:

1. Makes a random verifier and a one-time state. It stores only those two values and a timestamp in `sessionStorage` (this tab only), then sends the reader to `https://openrouter.ai/auth` with an S256 challenge. OpenRouter has no `state` parameter, so the state rides in RISE's own callback URL (`/connect/openrouter?rise_state=…`).
2. On return, `src/app.js` removes the code from the address bar before anything else runs. The stored state is deleted whatever happens next. A callback that this tab did not start, that is older than ten minutes, or that carries a different state is ignored and never reaches OpenRouter. A callback without a code counts as cancellation, and any other page load abandons a started sign-in.
3. Exchanges the code with the verifier at `https://openrouter.ai/api/v1/auth/keys` (no cookies, no referrer) and keeps the key in memory.

The key goes only to `https://openrouter.ai`: the CSP `connect-src` names that exact origin. It never reaches a SyberLabs server, storage, analytics (RISE has none), logs, exports, or error reports (RISE sends none). This is not a vault: browser extensions and any script in the page can read page memory. RISE loads no third-party scripts (`script-src 'self'`) to keep that surface small, and the Home panel says so to the reader.

What the reader is billed for: each Home request, each Scriptorium route, and, while connected, section visual direction as they read a released text (the reading panel says so). A repeated identical Home request in the same tab reuses the earlier answer at no charge.

## Server side

The Worker (`worker/index.mjs`) holds no model credential and calls no model:

- `GET /api/decision-catalog` publishes released books, active sounds, and active type options from Neon through a 30-second Redis cache, with public columns only. It is rate limited, and Neon and Upstash credentials never leave the Worker. Deactivating a row in Neon withdraws it from every reader within a minute.
- `/api/jev-recommend`, `/api/jev-decision`, `/api/jev/route`, `/api/jev-visual-score`, `/api/enterprise-decision`, and `/api/personal-piece` answer `410 SHARED_INFERENCE_RETIRED` with instructions to reload and connect. Netlify previews answer the same way (`netlify/functions/retired-inference.mjs`).

Features that depended on a shared model are now either on the reader's connection (recommendations, Scriptorium routing, visual direction), local only (the EnterpRise room's Kev decider; the public room keeps Local rules and on-device Kev), or explicitly unavailable: personal readings (`/create`) were never released and now say that RISE no longer pays for AI writing.

## Release order

1. Merge. The frontend and Worker ship together in one production deploy, so stale tabs get a clear 410 instead of a paid call.
2. The production workflow checks the exact release, the public catalog, and that every retired route answers 410. It no longer calls a model; the old check spent a live Jev request on every release.
3. Only after that verification, delete the unused Worker secret `OPENROUTER_API_KEY` (`wrangler secret delete OPENROUTER_API_KEY --config wrangler.production.jsonc`), any `KEV_API_KEY`, `KEV_BASE_URL`, and `KEV_REVISION` Worker secrets, the `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` repository secrets, and the `KEV_PRODUCTION_VERIFIED`, `KEV_REVISION`, `KEV_MODEL`, and `DECISION_PROVIDER` repository variables. Stop any `rise-kev` Modal app still running. Keep `NEON_DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CLOUDFLARE_API_TOKEN`, and the unrelated `OPENAI_API_KEY` (advisory code review).

## Evaluation

`scripts/decision-eval.mjs` keeps the 39 fixed cases (`scripts/jev-eval-cases.json`), the offered-choice snapshot, and `scoreDecisions`. It builds the exact browser request against the committed seed catalog and labels every capture with its mode:

```sh
# Pipeline integrity only: never counted as a model result.
node scripts/decision-eval.mjs capture --mode mock --cases scripts/jev-eval-cases.json --options scripts/jev-eval-options-candidate.json --output mock.json
# Kev through a running local RISE (npm run local).
node scripts/decision-eval.mjs capture --mode local --origin http://127.0.0.1:5780 --cases scripts/jev-eval-cases.json --options scripts/jev-eval-options-candidate.json --output kev-local.json
# Jev on your own OpenRouter account: 39 billed requests.
READER_OPENROUTER_KEY=… node scripts/decision-eval.mjs capture --mode live --bill-my-openrouter-account --cases scripts/jev-eval-cases.json --options scripts/jev-eval-options-candidate.json --output jev-live.json
node scripts/decision-eval.mjs compare --cases scripts/jev-eval-cases.json --options scripts/jev-eval-options-candidate.json --baseline jev-live.json --candidate kev-local.json
```

The old staging procedure assumed a Worker that owned the provider key and compared through it. That assumption is gone. The gates are unchanged: every case valid, zero out-of-menu values, explicit preferences and contrast pairs at least as good as the live Jev baseline, and every Kev answer inside the 8-second browser deadline. `compare` refuses a mocked capture on either side and requires the pinned Kev revision.

## What is verified

See the pull request for the current record. In short: the unit and browser tests cover OAuth success, cancellation, invalid and unsolicited callbacks, disconnect, revoked keys, no key in storage or on a SyberLabs route, no request without a connection, invalid choices rejected in both modes, timeouts without fallback, manual reading, and the bridge's security. Live Jev authentication with a reader test account and Kev on a reader's GPU count as verified only when the pull request records them.
