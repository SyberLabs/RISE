# Handoff: EnterpRise live room and on-device Kev

Date: 2026-09-28. Read `AGENTS.md` first and follow it.

## Where things stand

Everything below is merged to `main` and deployed to https://rise.syberlabs.io.
Merging `main` deploys production automatically (the `production` job in
`.github/workflows/ci.yml`).

| PR | What |
|---|---|
| #274 | EnterpRise prototype: prepared talk, speaker rail, stage, gate |
| #275 | Live loop: context protocol v1, prepare → decide → resolve, JEV/Kev route, speech, trace |
| #283 | Live-talk page (transcript, Ask channel, status strip, keys, themes, zero layout shift) and on-device Kev |
| #284 | Rail fixes: eviction protects only cards on stage; speech margin ignores asked cards |
| #285 | Kev-4B device pin equals the server Kev revision (`139fdd94…`), with a test keeping them equal |

Pages: `/enterprise` (live room), `/kev-check` (on-device measurement).

Design and decisions:
- `docs/superpowers/specs/2026-09-27-enterprise-room-design.md` (room)
- `docs/superpowers/specs/2026-09-28-enterprise-live-loop-design.md` (live loop)
- `docs/specs/ARCHITECTURE.md` §8.30, §8.31, §8.32

## Map of the code (`src/enterprise/`)

- `session.js`: `prepare` / `prepareReasoning` → frozen turn with context; `resolve` accepts one answer per turn, per channel (`speech`, `ask`); follow-up records only declined audience speech.
- `decision.js`: rail reducer (cooldown, dwell, margin, eviction). Asked cards skip the waits and don't pace speech.
- `context.js`: `rise.enterprise-context.v1` (Evidence / Structure / Authority), strict validation.
- `live.js`: one decision in flight per channel, timeout, cancellation.
- `rail-question.js`: the opaque-option question and the answer reader, shared by the Worker route and the device decider.
- `remote-decider.js`: browser client for `/api/enterprise-decision` (`worker/enterprise-decision.mjs`).
- `device-model.js`, `device-decider.js`, `kev-worker.js`: Kev in a WebGPU worker via `@ai-ecoverse/kev.js@0.6.0` + `onnxruntime-web@1.30.0`. It refuses any manifest not at the pinned `run`, and the runtime `.wasm` must match a pinned SHA-256.
- `demo-page.js` + `enterprise.html`: the live room. `kev-check.js` + `kev-check.html`: the measurement page.
- The Cloudflare Worker serves `/assets/kev-worker-*` with its own security policy (model hosts + `wasm-unsafe-eval`). `public/_headers` grants those to nothing.

Invariants (each has tests): nothing reaches the stage without Promote, and Promote re-runs the gate; the board memo's 880 never appears; the decider never sees card bodies; a failed decision holds and never falls back; the trace records speech as character counts only.

## Open work, in priority order

1. **Kev-4B runs out of memory in Chrome on Windows** (AMD RDNA1, probably 8 GB VRAM, Chrome 153): the tab crashes with "Out of Memory" during load. Likely cause: kev.js `loadKev` fetches every weight file into a JS `Uint8Array` (about 4.7 GB) and passes them all to `InferenceSession.create` as `externalData`, so the worker's memory holds the whole model at once, plus copies. Options to try, cheapest first:
   - Confirm with 0.8B that the pipeline works end to end (re-pinned on the `enterprise/handoff` branch; see below).
   - Check whether ORT `externalData` accepts a URL/path so it streams to the GPU instead of taking JS buffers, or load from OPFS (`ModelSource` as a `FileSystemDirectoryHandle`) to avoid a second copy.
   - Check kev.js issues and releases for a streaming or low-memory load.
   - Otherwise make Kev-0.8B the device default, if `/kev-check` shows it agrees well enough with the server.
2. **Kev-0.8B pin** was stale (the published bundle is `jaredpalmer/kev-0.8b@9a45d25eb2ab761841196625383fa1dff0e56c1e`). It's re-pinned on branch `enterprise/handoff`, which also holds this document. Open a PR, merge, then have the user run `/kev-check` with Kev-0.8B and send the JSON.
3. **Agentic review always fails**: the required check (`.github/workflows/agentic-review.yml`, OpenAI Codex) needs an `OPENAI_API_KEY` repo secret the user doesn't have. PRs were merged anyway at the user's request. Ask the user whether to remove it from the required checks or add a key.
4. **After the device model works**: real-microphone test of `/enterprise` with Kev (device) and with JEV; export the trace; compare latency.
5. **Next product steps agreed earlier**: a stage-only second window for the projector (today the stage shares the presenter's screen); a hold-`Q` key to mark audience questions (cheap speaker labelling); loading real decks and corpora instead of the demo fixture. Full voice diarization was deferred: it needs server-side audio and has biometric/legal implications.

## How to verify changes

```bash
npm ci
npx vitest run src/enterprise worker src/core/system-design.test.js src/core/csp.test.js
npx playwright test e2e/enterprise.spec.js   # headless Chromium; see note below
node scripts/ci-hygiene.mjs
npm run measure:first-load                   # 63.7 of 64 KB: almost no headroom
npm run docs:diagram                         # must leave ARCHITECTURE.md unchanged
```

- If the Playwright browser version doesn't match, launch with `executablePath: '/opt/pw-browsers/chromium'` via a throwaway config; don't run `playwright install`.
- `wrangler dev -c wrangler.staging.jsonc` serves `dist` with the real Worker, so security headers can be checked locally.
- Chromium with `--enable-unsafe-webgpu --use-webgpu-adapter=swiftshader` gives a software WebGPU adapter that drives the real worker until weights are needed. The cloud container cannot reach huggingface.co, so real inference must run on the user's PC.

## User context

The user is on Windows, has an AMD GPU, and is low on budget. They asked to merge and deploy without waiting for Agentic review. Keep reports short; say plainly what is and isn't verified.
