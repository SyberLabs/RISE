# User-owned AI in RISE

RISE spends no SyberLabs credential at request time for any model call: AI
features run on a connection the reader owns, and reading and manual settings
need none. The one exception is the Plus voice (`worker/plus.mjs`): with the
Plus voice on, the text of a verified subscriber's or administrator's reading of their own material goes
through the Worker to ElevenLabs on the lab's account, is metered as a
per-subscription character and cost budget for the paid billing period (up to
105,000 characters, at most 25,000 a UTC day, with a potentially lower
invoice-derived spend ceiling), or separate shared administrator daily and monthly meters,
and comes back as audio the reader's browser keeps in IndexedDB. The Worker
keeps no text or audio, runs no model, and makes no decision. Administrators
sign in through a dedicated Cloudflare Access application; the Worker verifies
the signed identity without persisting its subject, email or token. A browser
role flag grants nothing. Subscriber budgets, confirmed standing and usage
records remain server-side. See [Plus voice operations](PLUS-VOICE-OPERATIONS.md)
and [SPK-005](product/tasks/SPK-005.json) for rollout status; these contracts do
not establish that production configuration or real sign-in/voicing has been
verified.

Without the Plus voice, a card speaks with a voice installed on the reader's
own device (`speechSynthesis`): by default the best its platform names
(Premium, Natural or Enhanced before plain, `src/live/voices/browser.js`), and
the reader can pick any other installed voice for the reading's language under
Settings, Sound & voice, where the choice is kept on the device (`cardVoice`).

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

RISE Live (`/live?provider=openrouter`, off by default) asks its live answers through the same OpenRouter connection: `src/live/adapters/openrouter.js` streams OpenRouter's chat completions with the model the reader names (default `anthropic/claude-haiku-5.5`), and carries text only; RISE's own voice speaks it. The adapter never holds the key: `getOpenRouterChat()` in `src/core/ai-connection.js` adds it to the one request, and a `401` drops it as above.

What goes up from a Live reading, and where: the reader's question, and with it, only when they ask, a short record of what they did in the reading before it (play and pause, replay, going back or on, the pace, the Settings they changed, words they spoke to it), built by `src/live/perception.js` from the reading's own journal. It goes in the same one request to the provider the reader chose, on their key, through the adapter and nothing else; nothing is sent on a timer, nothing is stored, and nothing reaches a SyberLabs server. It names actions, never claims about the reader, carries nothing from the page outside the reading, and says a chosen voice only as "another voice". The venue says so before the first question. In Live the model speaks as RISE, and the instructions tell it to say plainly, when asked, which model and service it is; the About panel shows the same.

## Connect OpenRouter (OAuth PKCE)

Following [OpenRouter's OAuth PKCE guide](https://openrouter.ai/docs/guides/overview/auth/oauth), `src/core/openrouter-oauth.js`:

1. Makes a random verifier and a one-time state. It stores only those two values and a timestamp in `sessionStorage` (this tab only), then sends the reader to `https://openrouter.ai/auth` with an S256 challenge. OpenRouter has no `state` parameter, so the state rides in RISE's own callback path (`/connect/openrouter/<state>`), which survives however OpenRouter appends `?code=`. The callback page is served with `Referrer-Policy: no-referrer`.
2. On return, `src/app.js` removes the code from the address bar before anything else runs. The stored state is deleted whatever happens next. A callback that this tab did not start, that is older than ten minutes, or that carries a different state is ignored and never reaches OpenRouter. A callback without a code counts as cancellation, and any other page load abandons a started sign-in.
3. Exchanges the code with the verifier at `https://openrouter.ai/api/v1/auth/keys` (no cookies, no referrer) and keeps the key in memory. The exchange does not block the app from starting.

Disconnect forgets the key in RISE. Each connection mints a new key in the reader's OpenRouter account; the reader can revoke old keys in their OpenRouter settings, and the Home panel says so.

The key goes only to `https://openrouter.ai`: the CSP `connect-src` names that exact origin. It never reaches a SyberLabs server, storage, analytics (RISE has none), logs, exports, or error reports (RISE sends none). This is not a vault: browser extensions and any script in the page can read page memory. RISE loads no third-party scripts (`script-src 'self'`) to keep that surface small, and the Home panel says so to the reader.

What the reader is billed for: each Home request, each Scriptorium route, while connected, section visual direction as they read a released text (the reading panel says so), and each question or Dive asked on RISE Live with OpenRouter as the provider. A repeated identical Home request in the same tab reuses the earlier answer at no charge.

## Server side

The Worker (`worker/index.mjs`) holds no model credential and calls no model:

- `GET /content/catalog.json` is a static file the build writes from `src/content/decision-catalog.json`: released books, active sounds, and active type options, public columns only. Withdrawing a row is an editorial commit and a release: set its `active` field to `false` and the build leaves it out.
- `/api/jev-recommend`, `/api/jev-decision`, `/api/jev/route`, `/api/jev-visual-score`, `/api/enterprise-decision`, and `/api/personal-piece` answer `410 SHARED_INFERENCE_RETIRED` with instructions to reload and connect. Netlify previews answer the same way (`netlify/functions/retired-inference.mjs`).

Features that depended on a shared model are now either on the reader's connection (recommendations, Scriptorium routing, visual direction), local only (the EnterpRise room's Kev decider; the public room keeps Local rules and on-device Kev), or explicitly unavailable: personal readings written by a hosted model were never released, and RISE no longer pays for AI writing.

## Release order

1. Merge. The frontend and Worker ship together in one production deploy, so stale tabs get a clear 410 instead of a paid call.
2. The production workflow checks the exact release, the public catalog, and that every retired route answers 410. It no longer calls a model; the old check spent a live Jev request on every release.
3. Only after that verification, delete the unused Worker secret `OPENROUTER_API_KEY` (`wrangler secret delete OPENROUTER_API_KEY --config wrangler.production.jsonc`), any `KEV_API_KEY`, `KEV_BASE_URL`, and `KEV_REVISION` Worker secrets, the `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` repository secrets, and the `KEV_PRODUCTION_VERIFIED`, `KEV_REVISION`, `KEV_MODEL`, and `DECISION_PROVIDER` repository variables. Remove the staging Worker's `OPENROUTER_API_KEY` and `KEV_API_KEY`, and the staging environment's `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` if nothing else uses them. Stop any `rise-kev` Modal app, and close any tunnel that exposes a local Kev. Also delete the retired catalog secrets `NEON_DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN`. Keep `CLOUDFLARE_API_TOKEN`. An `OPENAI_API_KEY` repository secret, if one exists, has no consumer since the advisory review workflow was retired; delete it too.

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

The Decision Arena (`scripts/arena/arena.mjs`) runs these cases against several deciders, including OpenAI's Decisions API, on the operator's own keys. It is operator-paid offline research, run by hand and frozen into a file (ARCHITECTURE §8.47), not a reversal of #294: no reader request reaches it, and RISE still spends no shared inference.

The old staging procedure, and the `Kev staging evaluation` workflow that automated it, assumed a Worker that owned the provider key. It captured Jev on SyberLabs' OpenRouter key and reached a local Kev through a public tunnel. Both are retired, along with that assumption. The gates are unchanged: every case valid, zero out-of-menu values, explicit preferences and contrast pairs at least as good as the live Jev baseline, and every Kev answer inside the 8-second browser deadline. `compare` refuses a mocked capture on either side and requires the pinned Kev revision.

## What is verified

See the pull request for the current record. In short: the unit and browser tests cover OAuth success, cancellation, invalid and unsolicited callbacks, disconnect, revoked keys, no key in storage or on a SyberLabs route, no request without a connection, invalid choices rejected in both modes, timeouts without fallback, manual reading, and the bridge's security. Live Jev authentication with a reader test account and Kev on a reader's GPU count as verified only when the pull request records them.
