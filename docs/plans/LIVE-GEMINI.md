# A live Current from Gemini, with the reader's own key

**Status:** built and tested against fakes and in a real browser with Google's endpoint stubbed. **Never run against Google's service**, so treat it as unverified until the steps at the end of this page have been done with a real key. It ships **off**: the page reaches Gemini only when the address asks for `?provider=gemini`, and the reader types their own key.

**Current scope (2026-10-04):** deferred with the live Current ([decision](../product/discussions/2026-10-04-composer-decision.md)).

## What it is, and what it is not

RISE's live layer already has one seam for any provider that streams text (`src/live/adapters/text-stream.js`): a provider is one `connect(request, sink)` that calls `sink.delta`, `sink.done` or `sink.error`. OpenAI Realtime is one such provider. This adds a second, Google's **streaming text generation** (`models/{model}:streamGenerateContent`, server-sent events), to show that the runtime is provider-independent: the existing conformance suite must pass for it unchanged.

It is **not** the Gemini Live API. Live is a session over a WebSocket whose current models answer in audio (text only as a transcript), which is the wrong shape for RISE: RISE wants the words, and speaks them with its own voice so that a Dive can hold the voice. Plain streaming has no session, no audio-only-model problem, and can be called straight from the reader's browser with their own key.

### Voice input is not blocked by this

Speaking to RISE already works with any provider: the Speak button turns the reader's speech into text with the browser's recogniser, and that text goes down the same Dive path (`docs/plans/LIVE-CURRENT.md`). If raw audio is wanted later, Google's request format lets a part carry `inlineData` (a blob with a MIME type), so a recorded push-to-talk clip can ride the same call as an added optional field. A Live session, if ever wanted for a conversational multimodal mode, would be a **sibling** adapter with different physics, not a replacement. Not built, not tested, and audio-input quality has not been tried.

## The design

- `src/live/adapters/gemini-sse.js`: a bounded server-sent-events parser. Fed text in any cut (CRLF, LF, CR; a field split across chunks; comments; multi-line `data`), it calls back once per event. An unterminated line or event over a limit is dropped, never buffered without bound.
- `src/live/adapters/gemini-wire.js`: the request body, and Google's response chunks as text-stream events. Every provider-specific name is in one table. Only `candidates[0].content.parts[].text` (skipping parts marked as thoughts) is read as words. A `finishReason` of `STOP` ends the answer. `MAX_TOKENS` is an answer **cut off** at its length limit, so it is a failure, not a finish: the whole passages stay and the one being written is let go (as for a lost connection), and the reader is told the answer stopped early. A safety or other stop, a `promptFeedback.blockReason`, and an in-stream `error` object end it failed, in words. A stream that ends without a finish reason is a lost connection.
- `src/live/adapters/gemini-fetch.js`: the browser transport. `open({ body, signal })` does the `fetch` and resolves once Google has answered with headers, so a refused key or a missing model is refused *at open*, exactly where the OpenAI transport refuses its key, and the host already forgets a refused key there. It then streams the body through the parser.
- `src/live/adapters/gemini.js`: about forty lines, the twin of `openai-realtime.js`, handing `connect` to the text-stream adapter.
- `LiveHost` (`?provider=gemini`): a key field held in page memory only, forgotten when the session ends or the key is refused, and a model field. The page says where the key goes: to Google, from this browser, and never to RISE.

### The key

It travels in the `x-goog-api-key` header and nowhere else: never in a URL, never logged, never put in an error (any error text has the key scrubbed as a last defence). It goes from the reader's browser to Google; RISE's Worker does not see it. Google's own preflight allows exactly that header from a browser origin, and returns its CORS header on errors too, so the page can read Google's reason for a refusal (checked against the live endpoint without a key on 2026-09-30).

### What Google says about a failure

The reader's key must not appear in anything the reader, the journal or a log can see, however Google words a failure. Refusals at the HTTP level are scrubbed by the transport. A failure reported *inside* a successful stream is decoded by the wire, which never sees the key, so the wire shows Google's words only after a scrubber the transport supplies has cleaned the decoded text (which also defeats a key written with JSON escapes), and it scrubs before it clips. A transport that supplies none, or a scrubber that fails, gets only "The provider reported an error", never Google's words: the wire fails closed. (Found in review of #347 and fixed.)

### An answer that is cut off

When a response reaches `maxOutputTokens`, Google reports `MAX_TOKENS`. Treating that as a finish would close the passage that was being written and mark the Current complete, so a half sentence would be read as the end of the answer. It is a failure instead, worded "The answer reached its length limit and was cut off." The runtime still reads every passage that was whole (what arrived is worth reading), and the controls now say so in words: while it reads, "The answer stopped early: …", and when it is done, "Finished reading what arrived. The answer stopped early: …", not "Finished." This applies to any provider whose Current fails after some of it arrived, not only Gemini's. (Raised in the Codex review of #347; the wire was fixed as it asked, and the controls gap behind it was found while testing it in a browser.)

### What the browser sends along

Cookies are omitted and the response is not cached. The referrer is left to the browser's default (only the page's origin, across sites). An earlier version sent no referrer, which hid nothing that the `Origin` header of a cross-site request does not already say, and would have failed a key restricted to a site: Google checks such a key against the `Referer` header, and restricting a key that is used in a browser is the recommended practice.

### Where it is loaded

The page's own chunk holds only the default model's name (`gemini-model.js`). The wire and the transport are separate chunks, loaded with `import()` only when `?provider=gemini` is asked for; `boundary.test.js` holds that the host imports nothing else from the adapters statically. (An earlier version imported the name from the wire, which put the whole wire in every `/live` visit. It was never in the first page load.)

### The shared suite and an answer cut off

The conformance suite has a scenario every adapter must stage in its own provider's words: the provider stops at its length limit part way through a passage, after a whole one. Whatever the words (Gemini's `MAX_TOKENS`, OpenAI's `incomplete`, an error), the Current ends failed, never complete, the whole passages stay, and the passage being written is never ended or lowered into what is read. MCP skips it: an answer arrives whole. Reintroducing either provider's original mistake (counting the cut as a finish) fails this scenario alone, which is how a third provider is kept from repeating it.

### The model

A free-text model id, checked against `^[a-z0-9][a-z0-9.-]{0,63}$` so that it cannot leave the URL path. The default is `gemini-3.5-flash`, which the creator asked for and which **has not been checked against Google's model list** (that needs a key). Google renames models, and a fixed list would go stale.

### Spend

`maxOutputTokens: 4096`, as the OpenAI session has. When the text adapter has shown all it can, it cancels the provider and completes the Current. Thinking settings are left to the model's default: setting them for a model that does not support them is an error.

### Stop

The runtime's abort signal reaches `fetch`, so Stop while connecting sends nothing further and shows nothing, the same guarantee the red team required of the OpenAI path (`docs/plans/LIVE-RED-TEAM.md`). This holds after Google has refused too: the transport stays wired to Stop until a refusal's body has been read, and reading it ends at once on Stop, so a refusal whose body stalls cannot hold the request open or block the next Start (also found in review of #347).

### The site's security policy changes, once

`https://generativelanguage.googleapis.com` is added to `connect-src` in `netlify.toml` and in `public/_headers` (which a test holds equal to it), and a test pins it to that exact origin: no other Google host and no wildcard, as OpenRouter's is. This is what lets RISE's own pages contact Google. `script-src 'self'` is unchanged, so only RISE's own code can. It is allowed for every page, not just `/live`, because the policy is static. `local/bridge.mjs` is **not** changed, on purpose: its policy is the production one minus the hosts local RISE never needs, which already leaves out OpenRouter, because local RISE keeps the reader's prompts on their own computer. It now leaves out Google's Gemini API too, a test holds that, and `?provider=gemini` therefore cannot reach Google when RISE is served by the local bridge. **The creator approved this** ("3. (a)").

## Left out, on purpose

The Live API and its WebSocket, ephemeral tokens (Live-only, and in preview), Vertex AI (which needs a server holding Google credentials), native audio and video, a shared "credential broker" or "producer" abstraction (with two providers that differ this much, it would be an abstraction with no second use), and any change to `text-stream.js`, the runtime, or the parser.

## Build plan

Each task starts with a failing test, and ends with the targeted tests passing and a commit.

1. **SSE parser** (`gemini-sse.js`). Tests: every cut of a transcript gives the same events (exhaustive over two- and three-way splits, then a seeded fuzz); the three line endings; multi-line data; comments and unknown fields ignored; an oversize line or event dropped and the parser recovers; garbage never throws.
2. **Wire** (`gemini-wire.js`). Tests over a transcript built from Google's published response schema: words in order, thought parts skipped, each finish reason, a block reason, an in-stream error object, an unfinished stream, nothing read after cancel, hostile shapes ignored, the body contains the system instruction, the prompt, and the token cap and nothing else.
3. **Adapter and conformance** (`gemini.js`, a fake transport). The shared conformance suite passes unchanged, with the same scenarios as OpenAI (read, interrupt, transport loss, provider failure). Stop before open resolves sends nothing.
4. **Fetch transport** (`gemini-fetch.js`). Tests with a stubbed `fetch`: the URL and headers (key only in `x-goog-api-key`), abort before and during, HTTP 400/401/403/404/429/5xx each mapped to a refusal in words with the key scrubbed, a body streamed in odd chunk sizes, a body that never ends is cut off by abort.
5. **Host** (`LiveHost`). Tests: `?provider=gemini` shows the key and model fields and the plain statement of where the key goes; an empty key is refused; a refused key is forgotten; the key is never in the page after Start.
6. **Security policy.** The two files (`netlify.toml`, `public/_headers`) and the tests that hold them. The dev and preview servers do not apply the site's headers, so a browser test cannot enforce the policy; whether a real browser permits the call under the real headers is checked in the real-key run below.
7. **Browser test** with a stubbed Google endpoint: ask, read, interrupt, Dive, Surface, Stop; the key appears in one request header and nowhere else in any request; Stop during connect sends nothing.
8. **Mutation checks** on the parser, wire, adapter, transport, host, policy and the browser test; docs (`LIVE-CURRENT.md` status row, `ARCHITECTURE.md` §8.40, this file's status); hygiene and targeted suites.

## What was verified, and how

| | How | Result |
|---|---|---|
| Event-stream parser | 20 tests, including every single and every pair of cuts of a transcript and seeded random cuts; 9 deliberate breaks | pass, all caught |
| Wire | 38 tests over a transcript in the shape of Google's published response schema; 18 deliberate breaks | pass, all caught |
| Adapter, and the **shared conformance suite** | 29 tests (17 adapter, 12 conformance); a fake stream speaking the documented wire. The suite passed unchanged for Gemini, then gained a `cut-short` scenario (below), which Gemini, OpenAI, the generic adapter and the mock all pass | pass |
| Fetch transport | 42 tests with a stubbed `fetch`, including the key's whole path and Stop at every moment (a stalled refusal included); about 35 deliberate breaks | pass, all caught |
| Host | 9 new tests (39 in the file, OpenAI's unchanged); 10 deliberate breaks | pass, all caught |
| Security policy | the header tests, plus an exact-origin pin; a wildcard break | pass, caught |
| Browser, production build, Google stubbed | `e2e/live-gemini.spec.js`, 11 tests; four deliberate breaks | pass, all caught |
| **Google's real service** | not run | **unverified** |
| Google's preflight from a browser origin | `curl` against the live endpoint without a key: it allows our origin and the `x-goog-api-key` header, and returns its CORS header on an error too | as expected, 2026-09-30 |

### Known limits

- The wire is written from Google's published API description (v1beta, revision 20260928) and not from a captured session. Every name is in one table in `gemini-wire.js`.
- The default model, `gemini-3.5-flash`, was chosen by the creator and has not been checked against Google's model list.
- Thinking settings are left at the model's default, which may add delay before the first word on a thinking model. Not measured.
- The whole of an answer is limited by `maxOutputTokens: 4096`; a Dive is a second request.
- A refused key is forgotten; Google's permission errors (403) are treated as a refused key too, so a key that lacks access to the chosen model is forgotten and must be typed again.
- Voice input works as with every provider (browser speech recognition to text). Native audio input is not built.

## Verifying it with a real key (about ten minutes, a few cents)

Until this is done the integration is **unverified**.

Run it where the site's real security headers apply, which `npm run dev` and `vite preview` do not: the pull request's Netlify deploy preview, or the deployed site once merged. `npm run dev` is fine for trying the flow, but it cannot show whether the policy lets the call through.

1. Open `<the deploy preview or site>/live?provider=gemini`. First check with `curl -sI <that address>/live` that the `content-security-policy` header names `https://generativelanguage.googleapis.com` in `connect-src`. (Locally: `npm run dev`, `http://localhost:5173/live?provider=gemini`, without the policy.)
2. Paste your Gemini API key. Leave the model as `gemini-3.5-flash` or type another.
3. Press Start. Expect words within a couple of seconds and the reading to begin.
4. Press Interrupt, type `dive on <something in the answer>`, press Dive, then Surface.
5. Press Speak and say "go back" (Chrome).
6. In the browser's network panel, check that the request goes to `generativelanguage.googleapis.com`, that the key is only in the `x-goog-api-key` header, and that nothing goes to this site carrying it.
7. Try a wrong key and a wrong model name; each should say so in words.
8. Then try a key **restricted to this site's address** (an HTTP-referrer restriction in Google's console, for the address you are testing from). The request carries the browser's default referrer, which Google checks. If it answers 403, tell me: a 403 is treated as a refused key and the key is forgotten.
9. Report anything that differs from the above, including the exact model list your key can see. The wire is one table in `gemini-wire.js`.

## Where things are

`src/live/adapters/gemini-*.js` and their tests, `src/test/fake-gemini-transport.js`, `src/live/host/LiveHost.js`, `e2e/live-gemini.spec.js`, and the two policy files above (`netlify.toml`, `public/_headers`). `local/bridge.mjs` is deliberately not one of them.
