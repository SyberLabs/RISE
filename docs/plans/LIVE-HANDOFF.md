# The live Current: where it stands

Written at the end of the first build. It says what exists, what has been shown to work and how, and, more than either, what has **not**. Nothing here is verified that was not run; each row says which of *implemented / unit tested / browser tested / tested with the deterministic provider / tested with a live provider / not yet verified* it is.

**Current scope (2026-10-04):** deferred. RISE in ChatGPT is Composer ([decision](../product/discussions/2026-10-04-composer-decision.md)); the live Current and Dive described here are out of current scope. This stays the record of what was built.

## What was built

RISE can now present an answer that arrives over time as a **live Current**: words shown and spoken as they are written, imagery that follows the passages, a question asked at an exact place (a **Dive**) answered as a Current of its own, and **Surface** returning to the same atom. The canonical flow (ask, hear it begin, interrupt and dive on the event horizon, Surface, carry on) runs in a real browser at `/live`, offline, on a deterministic provider.

It is built as a sequence of ten stacked pull requests, each reviewable alone:

| PR | What |
|---|---|
| #301 | The plan, `rise.current-events.v1` (protocol and reducer), the boundary test |
| #302 | Provider adapter contract, deterministic mock, conformance suite |
| #303 | The one Player extended for words still arriving (live hold, `extend`) |
| #304 | The runtime: ask, interrupt, Dive, Surface, voice as the clock |
| #305 | The `/live` host, browser voice, capability detection, the Chamber following a live reading |
| #307 | Evidence, intended condition, and depth, told apart and shown |
| #309 | Performance budgets held as tests |
| #311 | Text-stream adapter, OpenAI Realtime path (opt-in, **unverified against OpenAI**) |
| #314 | The evaluation instrument (**the study has not been run**) |
| #315 | MCP adapter and port (**no real MCP host tried; no server or app bundle**) |

## Architecture

```
provider ─ adapter ─▶ rise.current-events.v1 ─▶ reducer (src/live/stream.js)
                                                   │ ended segments only
                                                   ▼
                      compileRiseCurrent ─▶ Session ─▶ Player.extend  ─▶ Chamber (the one view)
   voice renderer ◀── runtime (src/live/runtime.js) ─ speech clock: the voice decides when an atom ends
   Dive: parent's Player paused, voice held; a Current of its own; Surface releases the parent at the same atom
```

- **The seam is unchanged.** `rise.current.v1` stays strict and sealed; the live layer is above it. Committed words are immutable, so each lowering is a prefix of the next and the one Player is extended, never replaced. There is still exactly one `new Player(` (the Chamber factory), and a test says so.
- **One clock.** Before speech, the Player's timer; while a voice speaks, the voice (`speech-governor.js`: exact at a segment's start and end, interpolated between the voice's marks, so approximate timing resets at every boundary); during a Dive, nobody (the parent is held).
- **Speech is the runtime's, not the provider's.** A provider stream cannot be held and a Dive has to hold the voice. The reducer's stream is what was *composed* and is sealed at `current.complete`; what the reader lived through is the runtime's own journal.
- **Provider boundary.** An adapter is `open`, `events`, `interrupt`, `resume`, `close`, and nothing else. A provider's words are read through a defensive line format; provider events never leave the adapter. The mock, a generic text-stream adapter, the OpenAI adapter and the MCP adapter all pass one conformance suite (`src/test/live-conformance.js`), each stating what it honestly cannot carry.
- **`src/live` is a lazily loaded layer.** Nothing outside `src/live` imports it statically (`boundary.test.js`). First load moved from 59.8 to 59.9 KB brotli; the 64.0 KB budget is not moved.
- **Not a room.** The host lives in `src/live/host/`, is unlinked, and the system-design guard is unchanged.

Contracts: `docs/plans/LIVE-CURRENT.md` (plan and decisions), `docs/specs/LIVE-CURRENT-EVENTS-V1.md` (the protocol schema, limits, ordering and failure rules), `docs/specs/ARCHITECTURE.md` §8.34.

## Status of each piece

| Piece | Implemented | Unit | Browser | Deterministic provider | Live provider |
|---|---|---|---|---|---|
| Protocol, validator, reducer (fuzzed) | yes | yes | n/a | yes | n/a |
| Player live mode, `govern`, `replayCurrent` | yes | yes | yes | yes | n/a |
| Speech clock, synthetic voice | yes | yes | yes (silent, paced) | yes | n/a |
| Runtime, Dive, Surface | yes | yes | yes | yes | n/a |
| `/live` host, capabilities, controls | yes | yes | yes | yes | n/a |
| Browser voice (`speechSynthesis`) | yes | yes, fake device | **no real voice heard** | n/a | n/a |
| Evidence, condition, depth | yes | yes | yes | yes | n/a |
| Text-stream adapter, parser (fuzzed) | yes | yes | yes | yes | n/a |
| OpenAI Realtime, relay route | yes | yes | yes, fake peer | n/a | **not verified** |
| MCP adapter and port | yes | yes, fake host | n/a | n/a | **not verified; no product host** |
| MCP server, relay app, embedded page | yes, **off by default** | yes | yes, fake host page | yes, SDK client and the reference host class (local one-offs) | **not verified; no product host** |
| Microphone input | yes | yes, fake recogniser | yes, fake recogniser | yes | **not verified; no real recogniser** |
| Evaluation instrument | yes | yes | yes | yes | **study not run** |
| Literal-text path (D2) | **no** | no | no | no | no |

## Commands run, and what they said

All on the developer machine (Windows, Node 20.18, headless Chromium), on the production build where a browser was involved. The full unit suite is deliberately left to CI (it is heavy on the developer's machine).

- `npx vitest run src/live` — 32 files, 529 passed, 1 skipped (the interrupt scenario for the MCP adapter, held by its own test), exit 0.
- Wider targeted runs on the PRs that touched shared code: Chamber, app, Player, router, worker suites all passed (e.g. 66 files / 843 tests; worker 9 files / 232 tests).
- `npx playwright test e2e/live.spec.js e2e/live-openai.spec.js e2e/live-eval.spec.js` — 24 passed. `npm run test:e2e:gate` — 35 passed, 14 skipped (skips pre-existing).
- `node scripts/ci-hygiene.mjs`, `npm run security:audit`, `npm run security:compat`, `npm run wiki:build`, `npm run docs:diagram` (leaves the tree unchanged), `npm run measure:first-load` — pass; first load 59.9 KB brotli of 64.0.
- Mutation checks (deliberately breaking the behaviour to see the tests fail) on: the voice's hold, the parent's pause on a Dive, speak-after-present, timer lateness, the Chamber's schedule extension, the exclusive hold, the parser's marker holding and header parsing.

## Measured

Virtual clock and real browser, one machine, one run each (details and thresholds in `docs/plans/LIVE-CURRENT.md` §11):

- Applying an event: p95 **0.017 ms** (budget 2 ms). Lowering a maximum Current: p95 4.1 ms.
- Click to first atom on screen: about **0.73 s**, of which the mock's first segment is 0.22 s. Time to first response is the moment the first *segment* commits plus one event turn, so **first-segment length is the lever**; a real provider is slower.
- Sync: segment-boundary error **−33 to +16 ms** (budget 100); inside a segment **−54 to +22 ms** (budget 250).
- Memory: one reading retains 0.11 MB after Stop; thirty with a Dive retain 0.09 MB; in the browser the heap grew 0.41 MB across repeated cycles after the first. Main thread: two long tasks, longest 52 ms; no frame worse than 50 ms in 1,663.

## To see it

`npm run dev`, then open `/live?voice=paced` (silent, paced as if spoken; deterministic) or `/live` (speaks, if the browser has a voice). Press Start. When the answer reaches the size of the horizon, type `dive on event horizon` and press Dive; read the side answer; press Surface; the parent carries on from the same words. Open "About this passage" for the passage's intended condition, its sources (or the statement that there are none), and the difference between notes written with the answer and a question asked now. `?measure=1` exposes the read-only timing record the sync tests use. The study instrument: `/live?eval=1&n=0`. The OpenAI path needs the relay switched on and a key, and has never been run: see the risks.

## Does it differ from a visualizer? Honestly: unknown

The brief asked that this be recorded honestly. What is established: the imagery is *connected* to the passages (per-passage visual, condition mapped to bounded renderer numbers, sources and depth shown), which a generic visualizer's is not, and a test shows the mapped numbers reach the running attractor. What is **not** established is that any of it helps anyone understand or remember more. The evaluation instrument exists to find out and is written to say "aesthetics and experience, not understanding" if that is all it finds. It has not been run. Until it has, the defensible statement is that a live Current is *different* from a generic visualizer in what it does, and *unshown* to be better in what people take from it.

## Open risks

1. **No real speech engine has been heard.** Chrome's network voices give no word boundaries (the clock then corrects only at segment edges); some builds cut a long utterance off near fifteen seconds; a Dive that holds a boundary-less voice restarts its segment when released, except that once a speed is known the voice takes up at the start of the phrase on screen (docs/plans/LIVE-CURRENT.md). All from knowledge of the platform, none observed here.
2. **OpenAI has never been reached.** The wire names, the unified-interface request, and whether a text-only session accepts a receive-only audio section are unconfirmed. Every name is in one table. One key and ten minutes would settle it.
3. **The reader-supplied-key page.** The relay is narrow (one request, key never stored or echoed, off unless `LIVE_REALTIME_ENABLED`), but whether such a page should ever be public is your decision, and nothing here turns it on.
4. **MCP is built and checked against the reference, not a product.** It is off by default, and turning it on loosens the site's framing for one page, which is your decision (`docs/plans/LIVE-MCP.md`, *Turning it on*). No product host has been tried, and a Dive needs the host to offer sampling.
5. **Time to first response** depends on how short a provider's first segment is; the OpenAI instructions ask for one short sentence, unverified.
6. **Surfacing rebuilds the Chamber**, so the parent's attractor restarts its trajectory: same visual identity, not the same instant. And a Dive is visually quiet (a still), which may read as plain rather than as "deeper".
7. **Accessibility is checked structurally, not with a screen reader**: labelled regions, one live region, real buttons, 44 px targets, reduced motion measured. No assistive-technology session, no automated audit.
8. **No microphone.** Interrupting is typed; the page says so where speech recognition is missing.
9. **The study is an instrument, not a study.** Consent and ethical review are not something it supplies.
10. **D2, safe literal text, is not built.** Adapters neutralise the chunker's markers upstream of the (unweakened) strict refusal, which changes what a model said; a real literal path is a chunker change that wants its own review.

## The next smallest product experiment

Two steps, in this order, each about an hour:

1. **Reach OpenAI once.** Switch the relay on in a preview, use one key, and run the canonical flow with `?provider=openai`. It settles risk 2 and gives the first real time-to-first-response number.
2. **Run the study as a pilot of eight** (two per condition) in person with a real voice. Not to conclude anything (the instrument will refuse to below ten per group), but to find what is wrong with the instrument before anyone spends a day on it.

Neither adds a feature. Both replace an assumption with an observation.
