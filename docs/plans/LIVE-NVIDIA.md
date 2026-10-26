# A live Current from NVIDIA, with the reader's own key

**Status (2026-10-26):** built and tested against fakes and in a real browser with NVIDIA's endpoint stubbed. **Never run against NVIDIA's service**, and **not reachable from rise.syberlabs.io today**: NVIDIA's preflight admits browser requests only from NVIDIA's own sites (below). Offered in the Live venue as `NVIDIA (your key)`, with that said to the reader before they type a key.

**NVIDIA's models, free, today:** through OpenRouter, which a browser on this site can reach. Choose OpenRouter in the venue and name `nvidia/nemotron-3.5-lightning:free` under **Model** (OpenRouter's free models: 20 a minute, 50 a day, 1,000 a day once an account has bought US$10 of credit). Measured on 2026-10-26 through RISE's own OpenRouter adapter and parser: every reading complete with nothing refused, about 1.5 s each with reasoning off (23 to 54 s with it on, which is why the adapter turns it off). Nemotron 3 Super 120B's free endpoint was down (status −5, no uptime) that day. Lightning often writes `@scene` lines RISE cannot use (`@scene sky attractor=thomas`), which the parser drops, so its readings may have no visuals.

## What it is

A fourth keyed text stream beside Anthropic and OpenAI chat (`src/live/adapters/keyed-stream.js`): `src/live/adapters/nvidia.js` asks NVIDIA's OpenAI-compatible chat completions, `POST https://integrate.api.nvidia.com/v1/chat/completions` with `stream: true`, from the reader's browser with the key the reader typed. The stream is OpenAI's chat completions wire, read by `openai-chat.js`'s own `wire` (only `delta.content`, so a reasoning model's `reasoning_content` is never read). No Worker route, no new client, no change to the runtime or the parser.

- **Request.** A `system` message with RISE's instructions, one `user` message (`openai-instructions.js`, as OpenAI chat), `max_tokens: 4096`, `stream_options.include_usage`, and `chat_template_kwargs.enable_thinking: false`, which NVIDIA documents for its Nemotron models and which keeps thinking from spending the cap before the first word.
- **Model.** Default `nvidia/nemotron-3.5-lightning-30b-a3b` (in `GET /v1/models` and on build.nvidia.com, 2026-10-26). A reader-named model must match `publisher/name` in lower case (`isNvidiaModel`), so it cannot be a path or address.
- **Key.** One `Authorization: Bearer` header, nothing else: never in an address, a log, About or an error. NVIDIA's refusals are problem documents (`{status, title, detail}`); `errorOf` reads `detail`, and the keyed stream cleans it of the key and anything shaped `nvapi-…` before it is shown. A 401 or 403 is a refused key (NVIDIA answers an unknown key with 403), and the venue forgets it. A model NVIDIA does not serve is a plain-text 404.
- **Usage.** The tokens of the usage chunk go to About; NVIDIA reports no price.
- **Policy.** `https://integrate.api.nvidia.com` is added to `connect-src` in `netlify.toml` and `public/_headers`, pinned exactly by `src/core/csp.test.js`. `local/bridge.mjs` is unchanged, as it is for Anthropic and OpenAI.

## Why it does not reach NVIDIA from this site yet

Checked with `curl` and no key on 2026-10-26: an `OPTIONS` preflight to the chat endpoint with `Origin: https://build.nvidia.com`, `https://docs.api.nvidia.com` or `https://www.nvidia.com` is answered with `Access-Control-Allow-Origin` echoing that origin and `Authorization, Content-Type` allowed. From `https://rise.syberlabs.io`, `http://localhost:5173` or a look-alike such as `nvidia.com.evil.example`, it is answered 200 with no CORS headers at all. A browser therefore refuses the request before sending it, key included, and `fetch` fails with a network error. The adapter turns that into "Could not reach NVIDIA: Failed to fetch. NVIDIA's API lets a browser reach it only from NVIDIA's own sites today, so it may refuse this page." The venue shows the same sentence under the key field before anything is typed. The key is not forgotten, because it was not refused.

A Worker relay would make it work today, but the reader's key would pass through RISE's Worker, which the registry's rule ("offered here only if its key goes from the browser to that provider and nowhere else") and `docs/USER-OWNED-AI.md` refuse. That is the owner's decision to change, not this adapter's. Until then NVIDIA must admit browser origins (or the reader runs RISE from a page NVIDIA admits).

## What was verified, and how

| | How | Result |
|---|---|---|
| Adapter | `src/live/adapters/nvidia.test.js`, 26 tests over a fake fetch speaking NVIDIA's documented stream and its observed refusals; mutations of the key scrub, the problem-document reader, the 403 mapping and the thinking switch each caught | pass |
| Shared conformance suite, including `cut-short` | `src/live/adapters/nvidia.conformance.test.js`, unchanged suite, 13 scenarios | pass |
| Registry and venue | `registry.test.js`, `venue.test.js`: offered after Gemini, password field, empty key refused, refused key forgotten (a mutation of `forgetKey` caught), the note shown only for NVIDIA | pass |
| Security policy | `src/core/csp.test.js`: exact origin, both mirrored files | pass |
| Browser, production build, NVIDIA stubbed | `e2e/live-nvidia.spec.js`, 4 tests: the key only in `Authorization` and only to NVIDIA, the reading read, About names the model and NVIDIA; a refused key said without the key and forgotten; asking again while connecting sends nothing more; a request the browser cannot send is said in words and the key kept | pass |
| NVIDIA's real service | not run (no key here) | **unverified** |
| NVIDIA's preflight from this site's origin | `curl`, no key | **refused** (above) |

Playwright's route interception does not apply CORS to its own answers, so the e2e cannot show the preflight refusal itself; it replays it as the network failure the browser reports.

### Known limits

- The venue offers no Stop while a request is connecting, and leaving `/live` with Escape keeps the view (and its request) alive. This is the venue's, for every provider, not NVIDIA's; the adapter aborts a request stopped while it is being made (unit test).
- The privacy policy (`PRIVACY.md`) does not yet name NVIDIA. Today nothing but a keyless preflight reaches NVIDIA from this site; the bullet (like Anthropic's and OpenAI's) must be added before NVIDIA admits this origin. It is held out of this change because the policy's page is the address submitted for the Claude connector directory's review, which only the owner changes.
- `enable_thinking: false` is documented for Nemotron; whether every catalog model's template ignores it, as vLLM-based templates do, is not checked.

## Verifying it with a real key

Only meaningful once NVIDIA's preflight admits the page's origin (re-run the `curl` above first). Then, where the real headers apply (the deployed site): open `/live`, choose **NVIDIA (your key)**, paste a key from build.nvidia.com, ask; expect words within seconds. In the network panel the request goes to `integrate.api.nvidia.com` with the key only in `Authorization`. Try a wrong key (said, and forgotten) and a wrong model (`nvidia/nope`, said).
