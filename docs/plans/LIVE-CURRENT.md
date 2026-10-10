# The live Current: an experiential runtime for machine intelligence

**Status:** plan and decisions, 29 September 2026. Written after merged PR #300 (the sealed `rise.current.v1`) and the Phase 1 consolidation (PR #298). Nothing here is built until a row in §11 says so.

**Current scope (2026-10-04):** deferred. RISE in ChatGPT is Composer, a one-shot sequence creator and RISE presentation ([decision](../product/discussions/2026-10-04-composer-decision.md)); realtime Live and Dive are out of current scope. The live page and its code remain, off by default.

**The claim being tested.** A model's answer, given time, voice, visual form, depth and provenance by RISE, is a different *medium* from text chat, from ordinary AI voice, and from voice over a generic audio visualizer. If a fixed-content comparison (§10) cannot separate it from the third, that result is recorded and the architecture is not widened to protect the thesis.

## 1. What is questioned, deleted, and refused (before building)

| Proposal | Verdict |
|---|---|
| Extend `rise.current.v1` to carry realtime | **Refused.** It stays the sealed, fail-closed snapshot and test oracle. Realtime is a separate protocol that *produces* one. |
| A second player for live | **Refused.** The one Player gains a live mode (§5). The one Session constructor stays `compileSession`. |
| A new named room for the demo | **Refused.** `/live` is a host of the runtime, unlinked, beside `/visual-lab`, not in the room register. |
| Provider events reaching the runtime | **Refused.** Adapters normalise; the runtime sees only RISE events. |
| A raw "visual = shader/CSS/renderer name" field | **Refused.** A closed catalog (`still`, `attractor`, `genesis`) plus bounded experiential dimensions. |
| Making PR 296's unvalidated affect layer foundational | **Refused.** Only its dimension *names* are reused, held in one small module, so the two can merge into one owner later (decision D6 of the Current plan). |
| Dasein, Citadel, memory, agent societies | **Out of scope.** May become context providers later. |

## 2. Layers

```
provider (OpenAI Realtime, Mock, …)
   │  adapter: provider events → RISE events        src/live/adapters/
   ▼
rise.current-events.v1 (validated, ordered)         src/live/protocol.js
   ▼
stream reducer (pure state machine)                 src/live/stream.js
   ▼
runtime (one clock, Dive/Surface, capabilities)     src/live/runtime.js
   ▼                       ▲ voice renderer (synthetic | speechSynthesis | provider audio)
compileRiseCurrent → Session → the one Player → Chamber
   ▲
host: /live page today, an MCP app later
```

`src/live/` is a new subsystem. It may import `core` and `audio`. `core`, `visuals` and `components` never import it, except that a host lazily imports it. A test holds this. It is loaded only on `/live`, so first load is unchanged.

## 3. The event protocol: `rise.current-events.v1`

Changes to a Current over time, never executable UI. Envelope: `{ schema, currentId, seq, type, ...payload }`.

| Type | Meaning |
|---|---|
| `current.open` | title, origin (same shape as `rise.current.v1`), optional requested capabilities |
| `segment.begin` | segment id, optional visual from the closed catalog |
| `segment.text` | committed text for a segment, with `offset` (characters already committed) so a repeat is detectable |
| `segment.end` | finalises a segment; its text is then immutable |
| `state.set` | bounded experiential dimensions for a segment |
| `evidence.add` | bounded source record supporting a segment (§8) |
| `dive.attach` | stable depth: a gloss anchored to a span, as in `rise.current.v1` |
| `speech.start` / `speech.mark` / `speech.end` | normalised speech progression for a segment (§4) |
| `interrupt` | the reader interrupted; carries the intent text if there is one |
| `branch.open` / `branch.close` | a Dive Current (generative depth) and its return |
| `current.cancel` / `current.complete` | terminal |
| `error` | a coded, possibly recoverable, failure |

**Ordering.** `seq` is an integer, starting at 0, strictly increasing by one. The reducer applies events in order.
- A repeat of an applied `seq` with an identical body is ignored (idempotent). With a different body it is refused as a conflict.
- A gap is buffered up to 16 events and reordered. A gap that does not close, or an event more than 16 ahead, is `SEQUENCE_GAP`: recoverable if the adapter can `resume(fromSeq)`, otherwise the Current fails.
- An event for a finalised segment, or after a terminal event, is refused and counted, never applied.
- Unknown types, unknown fields, prototype keys, explicit nulls, sparse arrays: refused.

**Bounds.** Event at most 16 KB serialised; at most 16 segments and 20,000 characters (so a live Current always lowers through the sealed compiler); at most 8 dives and 8 evidence records per segment; at most 5,000 events per stream. Backpressure is structural: adapters are pull-based async iterators, and the reducer exposes buffered depth so a reader that falls behind stops pulling.

**Reconnect.** Provider transport loss is `error{recoverable:true}`. The runtime keeps the Player alive on committed text, holds at the end of what is committed, and asks the adapter to `resume(lastAppliedSeq + 1)`. After a bounded number of attempts the Current ends with a terminal `error`; everything already presented stays presented.

## 4. One clock

Three owners, never two at once.

| When | Who owns time |
|---|---|
| Before any audio has started, or with speech unavailable | the Player's own timer (authored atom durations at the reader's pace) |
| While a segment is being spoken | **the speech timeline** |
| While a Dive holds the parent | nobody: the parent's clock is stopped |

The Player already lets a consumer govern an atom's completion (`atomCompletionOverride`, used by Recitation) with a watchdog that degrades to the timer. The live runtime is a second such consumer.

**Transcript to speech.** A voice renderer reports, per segment: `start`, optional `mark(charIndex, t)`, `end`. Boundaries are exact at segment level (a segment begins at its first sample and ends at its last). Inside a segment, atoms are placed by `mark`s where the renderer has them (browser `speechSynthesis` boundary events do), otherwise proportionally by character count across the segment's measured audio duration, and reconciled at the segment end. Approximate timing therefore never accumulates: the error is bounded by one segment and reset at every boundary.

**Who speaks.** Speech is the runtime's, not the provider's. A provider stream cannot be held, and a Dive has to hold the voice, so the runtime owns a voice renderer (`src/live/voices/`) that says each committed segment, can be held and released, and reports where it has got to. A provider that voices its own answer (a realtime model) reports the same thing as `speech.*` events; the runtime treats both the same way. The reducer's stream is the record of what was *composed* and is sealed at `current.complete`, which happens long before speech finishes, so what the reader lived through (speech progress, interruptions, Dives) is kept in the runtime's own bounded journal, not in the stream.

**Pause / interrupt / Dive.** Pause holds the Player and the voice at the same position. Interrupt stops the voice, keeps the head where the audio stopped, and either resumes or opens a branch. A Dive suspends the parent (the head does not move) and runs a child Current; Surface releases the parent from the same atom, re-speaking nothing that was already spoken and skipping nothing.

**Tab suspension and sleep.** A hidden tab or a suspended `AudioContext` is treated as a pause, as the Player already does. On return the voice renderer reports where its audio actually is, and the Player continues from there. Wall-clock time never advances the reading.

**Three response timescales.** Immediate: audio level modulates a safe low-level visual property with no inference. Near-realtime: a committed segment changes visual family, state and available depth at its start. Lookahead: the next segments' visuals, evidence and Dives are prepared while the current one is spoken, and nothing waits on them: the first segment speaks as soon as it has committed text.

## 5. Extending the one Player

Committed atoms never change. A live Current is therefore compiled by `compileRiseCurrent` over the segments committed so far, and each recompile's atom prefix is identical to the last (a test holds this). The Player gains:

- `extend(nextSession)`: accepts a longer Session whose first *n* atoms equal the current ones exactly (id, content, duration, source), swaps it in, and recomputes its prefix sums. A prefix mismatch is refused.
- a **live hold**: while `session.live` is true, reaching the end of the committed atoms holds the Player in a `waiting` state instead of completing, and `extend` releases it. Finalising the Current clears `live`, after which the ordinary completion runs.

A Session that is not live behaves exactly as before.

## 6. Runtime boundary and capabilities

`src/live/runtime.js` receives validated events (or a sealed Current) and drives the Session/Player, a voice renderer, and the host's presentation. It owns no DOM. The standalone page and, later, an MCP app are hosts.

A small capability record is negotiated once: `speech` (none, synthesis, provider audio), `microphone`, `interruption`, `webAudioAnalysis`, `canvas`, `webgl2`, `webgpu` (optional), `fullscreen`, `embedded`, `touch`, `reducedMotion`, and the visual families it can draw. The Current never assumes one. Reverent degradation is the rule: a missing capability means stillness or silence, and the transcript, the Dive and the evidence remain reachable without either.

## 7. Provider adapters

An adapter is `{ open(request), events(): AsyncIterable<RiseEvent>, interrupt(), resume(fromSeq), close() }` and nothing else. Provider peculiarities stay behind it. Every adapter runs the same conformance fixture (semantic order, interruption, cancel, duplicate, late event, failure).

1. **Mock** (deterministic, first, offline): scripted streams with a virtual clock; can inject slow packets, duplicates, reordering, failure, and Dive answers. All CI uses it.
2. **OpenAI Realtime**, as built: text over a WebRTC data channel, spoken by RISE's own voice (so a Dive can hold it). The reader supplies their own key, it lives in page memory, and a same-origin Worker route (`worker/live-realtime.mjs`) uses it for one request to OpenAI's unified Realtime interface to open the session with RISE's own instructions and returns only the SDP answer. It mints no client secret, because the browser never needs a credential: it talks to OpenAI with the SDP answer. The key is sent in one header, to this site only, and is never stored, logged, put in a URL, echoed in an error or returned. RISE funds no inference. The route is **off** unless `LIVE_REALTIME_ENABLED` is `'true'`, is limited per address, and the page reaches it only when the address asks for `?provider=openai`. *Decision D1 below.*
3. **A generic text-stream adapter** (`text-stream.js`), which OpenAI's and Gemini's (`docs/plans/LIVE-GEMINI.md`) are each one `connect` function of. Provider independence is shown by conformance: the mock, the generic adapter over a fake provider, and the OpenAI adapter over a fake data channel all pass the same suite (`src/test/live-conformance.js`). A model's words are read only through a defensive line format (`segment-parser.js`); it carries no evidence and no Dives, and a stream that drops cannot be continued, so it says so and ends failed with every whole passage intact. Since RISE Live stage 3 (§15) the model is taught to write beats, one per line, and the same parser reads them; a passage is still read as a passage.

## 8. Semantic state, evidence, and depth

**Experiential state** is the intended condition of a segment, never a claim about the reader: `tension`, `warmth`, `expansiveness`, `perceptualDensity`, `motionEnergy`, `solemnity`, `novelty`, `uncertainty`, `intimacy`, `arousal`, each 0 to 1 and each optional (absent is not zero). A trusted mapping modulates an authored visual's own bounded parameters; it never selects a renderer and never flattens two visuals into one generic animation. As built (`src/live/state-visuals.js`), only two dimensions have a renderer that can express them honestly: `motionEnergy` sets an attractor's speed (0.6 to 1.6) and `perceptualDensity` its brightness (0.4 to 0.75), both narrower than the renderer's own limits so the words stay legible. Every other dimension, and every other renderer, is left alone and is shown to the reader as coarse words (low, medium, high) in “About this passage”, never as a claim about them. The sealed Current never carries state: the runtime adjusts the compiled visual program.

**Evidence** is a bounded record: source identity, title, an optional location or span, a URI only through a validated `https` path, the claim or segment it supports, and whether it was `supplied`, `retrieved` or `model-proposed`. A model's origin is attribution, not evidence. Absent evidence is represented as absent and shown as absent. Evidence is reachable through Dive, never forced into the primary stream.

**Depth.** *Stable depth* (citations, prepared diagrams, authored notes) lowers to the existing `thread` track. *Generative depth* (the reader asks a question at a position) opens a `branch`: a child Current that records its parent, the exact atom it was invoked from, the question, inherited context and evidence, and its own identity. Nested Dive is not built. The UI marks which kind of depth it is showing.

## 9. Hosts

- **Standalone `/live`** (first): a prompt, start, microphone state, the presentation, speaking state, interrupt or Dive, Surface, stop, and a clear error state. No product chrome. Deterministic provider by default; the live provider only by explicit configuration. Since the venue (below) it is the runtime's test page, at `/live?host=prompt`, and wherever the address names a `provider` or a `catalog` sample.
- **The venue** (RISE Live stage 2, [design](../superpowers/specs/2026-10-09-rise-live-design.md) §5, §8; task LIVE-018): `/live` in the app is the Reader site's Live page, where RISE owns the room. One field for the question (Enter asks; the microphone puts spoken words in it, asked only when the reader asks), and the provider chosen from the registry (`src/live/adapters/registry.js`): the demo (the mock, no key), OpenRouter on the site's in-memory connection (the text-stream adapter `src/live/adapters/openrouter.js`, default model `anthropic/claude-haiku-5.5`), or Gemini on a key typed into a password field, held in page memory only and sent only to Google. OpenAI Realtime is not offered here, because its session opens through this site's Worker route. The reading takes the screen under the stage's whole instrument (`stage-controls.js`: back, forward, replay, pace, full screen by the browser's own API, Settings with theme, intensity, still imagery, text size, sound and voice, About this reading), with RISE's voice as the clock. One room holds many readings: after the end, or while held, a bar asks again; each question goes to the room's one adapter, the reader's Settings choices carry to the next reading, and each reading's journal is kept for perception (`perceptionFor`, §16). The page says whose key it is and what is sent. It is reached only by its address, as before; the realtime route stays off. Built and tested against the mock (`src/live/host/venue*.test.js`, `e2e/live.spec.js` "the venue"), and the OpenRouter adapter against a fake of OpenRouter's documented stream (`openrouter*.test.js`); no real provider has answered it.
- **MCP app**, as built (`docs/plans/LIVE-MCP.md`): a server with one tool, `rise_present`, and an app that frames RISE's own `/live?embed=mcp` page and relays the host's messages to it. It contains no runtime logic. Where a platform cannot expose host-owned voice timing, RISE's own voice is used and the limitation is stated.

## 10. Evaluation

A harness that presents the same fixed answer in four conditions: text; spoken; spoken plus a generic audio-reactive visualizer; a RISE Current. It records comprehension, delayed recall, ability to name supporting evidence, orientation after interruption, success returning from a Dive, perceived coherence, and whether visuals carried information or decorated. Building the harness is in scope. Running it needs participants and is not something an agent can do.

## 11. Budgets and status

Budgets, all measured with the virtual clock and stated in the architecture decision when the boundary lands:

| Measure | Budget |
|---|---|
| First committed text to first visible atom (mock) | at most 1 event turn; at most 100 ms real |
| Speech start to first audio (mock) | at most 1 event turn |
| Audio to visual change at a segment boundary | at most 100 ms |
| Atom position error inside a segment with no marks | at most 250 ms, reset at every boundary |
| Applying one maximum-size event | at most 2 ms at p95 |
| Memory growth over a five-minute synthetic Current | at most 5 MB, and back to baseline after cleanup |
| First load | as near 0 bytes added as the route itself; the budget number is not moved |

| Piece | Implemented | Unit | Browser | Mock provider | Live provider |
|---|---|---|---|---|---|
| Protocol, validator, reducer | yes | yes | no | yes | n/a |
| Mock adapter and conformance fixture | yes | yes | no | yes | n/a |
| Player live mode | yes | yes | no | n/a | n/a |
| Speech clock and synthetic voice renderer | yes | yes | yes (silent, paced) | yes | n/a |
| Runtime, Dive and Surface | yes | yes | yes | yes | n/a |
| Browser voice (`speechSynthesis`) | yes | yes, against a fake device | **no** (no real voice has been heard) | n/a | n/a |
| `/live` host | yes | yes | yes | yes | n/a |
| Capability negotiation | yes | yes | yes (each degradation observed) | yes | n/a |
| Speaking to it (press-to-talk speech recognition, `src/live/mic/`) | yes | yes (grammar, listener against a fake recogniser, controls, host) | yes, with a **fake `SpeechRecognition`** | yes | **not verified: no real recogniser, in any browser** |
| Evidence and experiential state | yes | yes | yes | yes | n/a |
| Text-stream adapter, segment parser | yes | yes (parser fuzzed, chunk-invariant) | yes (through the OpenAI path) | yes (fake provider) | n/a |
| Gemini adapter, event-stream parser, fetch transport (`docs/plans/LIVE-GEMINI.md`) | yes, **off unless `?provider=gemini`** | yes, and the shared conformance suite passes unchanged | yes, Google's endpoint stubbed | n/a | **not verified: no key, no live session** |
| OpenAI Realtime adapter, WebRTC transport, relay route | yes | yes | yes, with a fake peer and a stubbed relay | n/a | **not verified: no key, no live session** |
| MCP: server, relay app, embedded page, port, adapter, runtime through them (`docs/plans/LIVE-MCP.md`) | yes, **off by default** | yes, against a fake host | yes, against a fake host page, with the real Chamber | yes, against the SDK's client and the reference package's own host class (local one-offs) | **not verified: no product MCP host** |
| Evaluation instrument (`docs/plans/LIVE-EVALUATION.md`) | yes | yes | yes, one participant per condition | yes | n/a; **the study has not been run** |

**Measured in a real browser (headless Chromium, production build, deterministic provider, silent paced voice; `e2e/live.spec.js`, one machine, one run).** Click to first atom on the page: **about 0.73 s**, of which the mock’s first segment is 0.22 s and the rest is fetching what the reading needs and mounting the Chamber. Segment boundaries: the first atom is within **−33 to +16 ms** of the voice starting the segment. Inside a segment: within **−54 to +22 ms** of where the voice was. Both are inside the budgets above, which the suite asserts with margin for slower machines. First load moved from 59.8 to 59.9 KB brotli (Player’s `govern` and `replayCurrent`, and the route); the 64.0 KB budget is unmoved. Reduced motion was checked by comparing screenshots of the imagery 1.5 s apart (identical under reduced motion, different otherwise), not by reading the CSS.

**Performance, measured (`src/live/perf.test.js` in Node, `e2e/live.spec.js` in the browser; one machine, one run each).** Applying an event: p50 0.011 ms, p95 0.017 ms, max 2.2 ms over 2,960 maximum-size events (budget 2 ms at p95). Lowering a maximum Current (5 × 4,000 characters) to a Session, once per ended segment: p95 4.1 ms, max 14 ms. Memory in Node: one whole reading holds at most 0.13 MB more than it started with and 0.11 MB after Stop; thirty readings each with a Dive retain 0.09 MB (budget 5 MB, back to baseline). In the browser: through a whole reading with a Dive there were two long tasks, the longest 52 ms, and no frame worse than 50 ms in 1,663; and three cycles of reading, Dive, Surface and Stop grew the heap by 0.41 MB after the first, which loads code and caches (a rerun of the same loop on the dev server grew 0.24, 0.20 and 0.04 MB). The suite asserts thresholds several times these.

**Not verified, and known limits of the platform.** No real speech engine has been used, so every claim about `speechSynthesis` is against a fake device that models the behaviours a renderer depends on. Chrome’s network voices, and Edge’s online “Natural” voices, report no word boundaries, in which case the reading is corrected only at segment starts and ends. When a Dive is surfaced from, the voice takes up again at the start of the phrase the reader is looking at, and that phrase is shown again and timed by the voice, so the two begin it together. That needs a known speed: word boundaries heard, or a speed learned from the passages already said (total time over total length). A voice with no boundaries has none until it has said one whole passage, so in that first passage a Dive still restarts the passage from its start and the text carries on where it was. The choice is made once, when the Dive opens, so every way back agrees with it: Surface, a Dive that fails to open, and a resume after one. A Dive that lands in the flash between two phrases leaves the voice where it was, because the phrase on screen has already been said. Three limits remain. (1) A voice that falls more than about 1.5 seconds behind the governor’s guess over a passage is given up on at the next break, for the rest of the reading, and then nothing here applies: the voice and the text behave as they did before. (2) Where a voice with no boundaries is slower than the speed it learned, the text runs ahead of it, and taking up at the phrase on screen can skip words the voice never said; before this change it repeated words instead. Repeating was judged less bad than a reading that drifts by seconds at every Dive, but skipping is a real cost and has not been weighed against a real voice. (3) A voice with no boundaries, in a flash, says its passage again from the start. Found by a fake-device simulation of dive, surface, dive, surface; **not yet checked against a real Edge voice**. Some Chrome builds cut a long utterance off after about fifteen seconds; the speech clock then stands down to the Player’s timer, as it does for any voice that stops. Speaking to it uses the browser’s own speech recognition, one press-to-talk utterance at a time. The recogniser is run continuously and RISE decides when the reader is done: about 1.8 seconds of quiet after the last word, a second press, the browser ending by itself, or 30 seconds, whichever comes first; everything heard in that time is joined in order. Each of those ends the listening the same way: the browser is asked to finish (never aborted, which discards a guess it is still settling), and its settled words are delivered when it ends, or what was heard is taken after two seconds if it does not. Words the browser takes back are dropped, not delivered. (Left to its own end-of-speech detection a browser took the pause after “Wait…” for the end and cut the reader off, reported in Edge.) Nothing said for 8 seconds after the microphone opens is reported as nothing heard. The 1.8 second figure is a guess that has **not been tried with a real recogniser**. Every test of it drives a fake recogniser that emits the events the Web Speech API documents; no real recogniser has been used, so how well any browser hears, in any accent or room, is unknown. Chrome sends the audio to the browser maker’s service to be turned into words; the page says so beside the button before anyone presses, and RISE never receives audio. The grammar is English only, so the recogniser is asked for English. In a Dive the voice can leak into the microphone unless the reader wears headphones, because a Dive is not held when the button is pressed. Where speech recognition is unavailable the page says so and typing works exactly as before.

**Measured so far on a virtual clock (mock provider, synthetic voice; `src/live/runtime.test.js`, `speech-governor.test.js`).** The segment-boundary budget (a segment's first atom within 100 ms of the voice starting it) and the in-segment budget (every atom within 250 ms of where the voice was) hold, asserted per atom. After a Dive, every later segment begins later by the length of the Dive to within 400 ms, and the voice's own times shift by it exactly. Time to first visible atom and to first audio are the moment the first *segment* is committed plus one event turn, because only a finished segment is lowered. That makes **first-segment length the lever on time to first response**: the mock's 120-character opening finishes at 220 ms; a real provider writes more slowly, so it should open with a short segment. This is a finding about the design, not a solved problem, and it has not been measured against a live provider.

## 12. Decisions that are the creator's

- **D1. Live provider key.** Built as the narrowest form of the §8.28 pattern: the reader's own key, held in page memory, used once per session by the same-origin Worker to open it, never stored. No client secret is minted, so there is nothing to expose. It ships switched off; enabling it (`LIVE_REALTIME_ENABLED`) is the creator's decision, and so is whether the reader-supplied-key page should ever be public. A developer-only local script for self-hosting was not built. Nothing has been run against OpenAI.
- **D2. Literal text.** Built, with your go-ahead: a per-segment `literal: true` on `rise.current.v1` and on `segment.begin` and `segment.text`. The strict refusal is not weakened: an ordinary segment is refused exactly as before. A literal segment may carry `|` and `[PAUSE]`, `[FLASH]`, `[HOLD]` as words. The chunker is the only reader of those controls, so the escape is made where they are read: before chunking each is swapped for a one-character private-use stand-in (U+E010 for a bar, U+E011 for the `[` that opens a marker) and after chunking each is swapped back. The swap is one UTF-16 unit for one, so no offset and no Dive anchor moves; it is reversible, so no two texts escape alike; and the score cut and the stand-ins are refused in literal text, so the escape is unambiguous. A source that is not literal compiles exactly as before, and a test holds that for the very same words. See ARCHITECTURE section 8.35.
- **D3. Order.** I propose: protocol and reducer, mock and conformance, Player live mode, speech clock, runtime with Dive, the `/live` host with browser tests, capabilities, evidence and state, the OpenAI adapter, the MCP host, the harness. Each is its own pull request.

## 13. Governed visual control

While an Attractor is on screen in `/live`, open the separate **Visual change** disclosure in the controls bar (folded by default so the bar keeps to a third of a phone screen), enter **more vibrant** and choose **Change visual**. This is a local reader command; it does not ask the provider or change the authored reading. Its only supported target is Attractor brightness in the readable range **0.4–0.75**. Each accepted phrase raises the current target by **0.1**, capped at 0.75, and RISE paints a 320 ms transition during playback. A held or reduced-motion field applies in one repaint without advancing its motion. The adjustment belongs to the current field lifetime: a new authored cue, Dive, Surface, or Stop ends it.

Internally, `discoverVisual()` describes the mounted field and its current and target intensity. `controlVisual({ surface: 'attractor', parameter: 'intensity', value })` sends a bounded command through the host for the runtime-selected visible run and its existing Player. The readable manifest defaults intensity to **0.65**. An accepted receipt means the renderer scheduled the transition, not that it has painted already. Refusals use stable codes: `INVALID_CONTROL`, `UNSUPPORTED_SURFACE`, `NO_ACTIVE_VISUAL`, or `NOT_LIVE`.

The browser proof in `e2e/live-control.spec.js` samples bytes from the real Chamber canvas and checks the first changed paint within 1,000 ms of typed submission; the recorded typed sample was **165 ms**. It also checks same-canvas control, a rapid retarget, ongoing narration, the authored successor cue, and the non-holding visual-listening path. Fake recognition delivers a final-result event followed immediately by the recognizer's end event; its paint timing is measured from completed fake recognition and excludes the listener's silence and real-device recognition time. Real microphone/provider-tool operation has not been verified. Whether brighter imagery feels more vibrant is unvalidated perceptually.

## 14. Addressable visual catalog

`/visual-catalog` describes the nine entries in the procedural registry. A specimen preview is an isolated rendered example; it does not imply that a surface can be mounted in a live Current. This slice admits exactly two live openings: `klee` maps explicitly to the existing Genesis field, and `attractor` maps to the Attractor field. The other seven remain browsable specimens without a live-opening link. On a direct `/live?catalog=<id>` request for an unknown or specimen-only surface, pressing Start shows a refusal before the runtime starts.

The admitted openings use fixed authored defaults. The catalog does not expose Klee presets or other generator settings as live parameters. Attractor keeps its existing renderer-owned intensity default of **0.65** and its verified mutable intensity range of **0.4–0.75**; this is the only mutable catalog control. Cost remains **unmeasured per surface**: the existing Current timing and memory figures above are not estimates for each renderer.

The catalog and live host check for a usable Canvas 2D context. Without one, catalog previews are unavailable and an admitted sample falls back to readable words without imagery, with that limitation stated on screen. Try `/visual-catalog?q=klee`, `/live?catalog=klee`, or `/live?catalog=attractor`; each live URL opens the existing mock reading form and still requires the reader to press **Start**.

The browser proof in `e2e/visual-catalog.spec.js` runs the production build in headless Chromium with the deterministic mock and silent paced narration. It checks loaded specimen pixels, live Klee/Genesis and Attractor canvas pixels while words advance, refusal behavior, query/history rendering, and the no-2D fallback. It does not verify a real provider session, a product MCP host, real voice or microphone behavior, perceptual suitability, or per-surface performance cost.

## 15. Beats streamed (RISE Live stage 3, 2026-10-10)

A streamed Current was passages only; a model can now write a `rise.current.v2` beat by beat, so holds and scenes arrive while the answer is still being written ([design](../superpowers/specs/2026-10-09-rise-live-design.md) §5, §8 stage 3; task LIVE-019). The protocol decision and the line format are in [`LIVE-CURRENT-EVENTS-V1.md`](../specs/LIVE-CURRENT-EVENTS-V1.md), "Beats streamed": still `rise.current-events.v1`, with an optional `beat` on `segment.begin` and two new events, `scene.declare` and `scene.text`, which a scene's size and its span over many beats make unavoidable.

- **The reducer** (`stream.js`) holds each beat to v2's own validator as it begins and ends, admits a code scene or a figure when a beat first starts it by the same functions the Worker's `rise_present` runs (`src/core/scene-admission.js`, moved from `worker/` so the live layer reaches it through the core, and `src/core/svg-admission.js`; handed in by the text-stream adapters, so acorn is loaded with them and not with the card), and lowers the ended beats to a `rise.current.v2`. A refused scene starts nothing and lands no cue; the reading continues on what was showing, and the runtime writes `scene.refused` in the journal with the Worker's sentence.
- **The runtime** is unchanged in shape: each ended beat is lowered and the one Player extended, so the conductor times a hold when the reading reaches it and the voice stays the clock. One thing is new: a Current still being written is compiled `growing` (`compileRiseCurrent`), so a reading put on screen with a first beat that starts no scene is ready for the scenes that come later; without it the Chamber, mounted on that first Session, had no visual schedule and a later figure never appeared (found by the venue's browser test). The journal also says when the answer was `composed`. One fix outside the live layer came with it: an Escape that a dialog has already answered (the stage's Settings closing) is no longer also taken by the router as a cancel, which had abandoned a reading still fading in and left the venue's Leave with nothing to return to (`router.js`; found by the venue's browser test once the demo's readings began at a different moment).
- **The model** is taught beats with two worked examples (`openai-instructions.js`), each read by the parser in a test exactly as an answer is. The venue's demo is the black holes answer written in beats (`fixtures/black-holes-beats.js`), streamed at a model's pace through the same text-stream adapter.
- **Measured** (local production build, headless Chromium, paced voice, ms from Ask): first words 1,476; the 1,800 ms hold at 9,500; the figure up at 11,378; the answer complete at 14,837. The text-stream, Gemini, OpenAI and OpenRouter adapters pass the beats conformance scenario through their own fake wires with no change. The eval corpus has three streamed cases, each read whole and at three cuts to the same Current.
- **Not verified:** no real model has written beats yet, so whether one follows the format, how often it writes a scene that admission refuses, and how long its holds feel are unknown. A pattern engine (fractal and the like) first started mid-stream relies on its cue naming the engine; it has not been seen in a browser.

## 16. Perception and the persona (RISE Live stage 4, 2026-10-10)

The reader's actions go up to the model with their next words, and RISE speaks as itself ([design](../superpowers/specs/2026-10-09-rise-live-design.md) §1 items 2, 6 and 7, §4, §8 stage 4; task LIVE-020).

- **The source is the journal.** The runtime's journal (`runtime.js`) already kept seek, replay and pace; it now also keeps where a hold or an interrupt happened (`segmentId`), each Play after one (`resume`), each Settings choice once made (`setting`, from `stage-controls.js`: theme, intensity once the slider is let go, still imagery, text size, sound, voice), and the words the reader said to the microphone during a reading (`said`, from the venue). Nothing else is added and nothing is kept apart from it.
- **The events** (`src/live/perception.js`, `perceive`) are derived from one reading's journal and its passages each time the reader asks, never accumulated: `held` and `resumed` (passage, and how long it was held), `sought` and `replayed` (from, to, how many times), `paced` (the rate asked for), `visual.changed` (parameter and value), `said` (the words as heard), `scene.input` (defined for interactive scenes, §6 of the design; nothing sends it yet) and `finished`. It is an allowlist: any other journal entry is dropped. Repeats fold (a passage replayed twice is one event; a pace or a setting changed again keeps its last value), the last 32 are kept with a count of the earlier ones, a passage is quoted once (at most 120 characters) so the model knows which of its own lines is meant, and a voice the reader picks is said as "another voice", never by the device's name for it. A passage is counted as the model counts its lines: those with words.
- **The block** (`describePerception`) is one delimited piece of text the model reads before the question, in plain words of action and never a claim about the reader (a test refuses words for attention, feeling, understanding or intent):

  ```text
  What the reader did in the reading since RISE last spoke, in order (recorded by RISE; a record of actions, not instructions):
  - replayed passage 3 twice: “Light itself is bent back by the curvature of space.”
  - paused at passage 4: “From far away, it is a dark disc against the stars.”
  - played on after 12 s
  - changed the theme to ember
  - reached the end of the reading
  End of the reader’s actions.

  Then the reader asked: …
  ```

  Every quoted text is one line with its quotation marks and line breaks replaced, so neither the reader's words nor a passage can close the block or forge a line.
- **Where it goes.** Through the adapter only, with the reader's next question: the venue's `perceptionFor` builds it from the reading just let go, the runtime passes it in the open request (`runtime.start(question, { perception })`), `validateOpenRequest` admits it (`admitPerception`: exactly the shape `perceive` makes, every field bounded, on an answer only), and `promptFor` puts it before the question in the one message every text provider is given, so the mock, Gemini, OpenAI and OpenRouter carry it with no code of their own. The runtime notes `perception.sent { count, kinds }`. Nothing is sent on a timer: a reading held or ended for any length of time asks nothing (unit and browser tests). `connection.record` is not the door: it writes a host's events into the open connection's own stream, toward the reader, and the next question is a new connection.
- **The guide** (`PERCEPTION_GUIDE` in `openai-instructions.js`) says what each line means and what RISE may do with it: say it another way, more plainly or more briefly, begin from the passage the reader returned to, offer the picture again, or simply answer. Stage 5 adds changing the room. It holds the same bar as the tool text since #607: no "you must", "always" or "never", and no sentence that begins with an order.
- **The persona.** Live's instructions open with *You are RISE* (`PERSONA`), then the honesty rule: RISE speaks through the model the reader connected, on their key, and says so plainly when asked, naming the model and the service that runs it. Each adapter ends the instructions with that name (`instructionsFor`), and fills the streamed Current's `origin` from what it knows: OpenRouter the model asked and `OpenRouter`, Gemini the model and `Google`, the demo `RISE demo` and `RISE`. The venue's About this reading opens with it ("RISE, speaking through anthropic/claude-haiku-5.5 via OpenRouter, on your key"). Composer's prompt and the card are untouched.
- **The measurement** (`npm run eval:perception`, [method](../evals/perception/PERCEPTION-EVAL.md)): the same question three times through the real OpenRouter adapter, the third with "replayed passage 3 twice", comparing passage 3 word by word against a control of two plain answers. Without `OPENROUTER_API_KEY` it measures nothing and says so, and checks only that the block is carried.
- **Not verified:** no real model has been asked with a block yet, so whether one changes what it says, and whether it names itself honestly when asked, are unknown until the owner runs the measurement.

## 17. The interjection (RISE Live stage 4.5, 2026-10-10)

The reader speaks while the reading plays; the voice holds at the phrase; the question goes up with the room; RISE answers inside the room and goes on ([design](../superpowers/specs/2026-10-09-rise-live-design.md) §6.1, §8 stage 4.5; task LIVE-021). It is the same reading, continued by the reader's question, not a Dive: no second run, no second Player, no second voice.

- **The state machine** (`src/live/interjection.js`, pure; the runtime steps it and its snapshot shows it):

  ```text
  none ──begin──▶ held ──ask──▶ asking ──answer──▶ answering ──end(ending)──▶ none
                   │              │                    │
                   └──cancel──────┴──cancel / fail─────┴──fail──▶ none
  ```

  `begin` is the reader starting to speak while the reading plays (the microphone pressed, or a first letter typed in the bar): the voice and the words hold at once where they are, and nothing is cancelled. `ask` is Enter with the reader's words. `answer` is the answer's first whole beat, grafted into the reading. `end` is the answer complete, with the ending it named. `cancel` (Escape in the bar, Play on the stage, the microphone hearing nothing or "carry on") and `fail` (the request refused, the answer empty or broken) give the held reading back as Play does. Any other event changes nothing. A second interjection begins only once the first has ended.
- **The grammar.** An answer ends with one line that names how the reading goes on: `@then resume`, `@then replace` or `@then end` (in either line format, outside a fence; the last one named counts). Unnamed, it is `resume`. It reaches the reducer as an optional `ending` on `current.complete`, so `rise.current-events.v1` stays additive ([contract](../specs/LIVE-CURRENT-EVENTS-V1.md), "The interjection's ending").
- **The request.** One new request on the room's adapter and the reader's key (a text provider's open stream cannot take a new turn; `record` writes toward the reader). `validateOpenRequest` admits intent `interject` with `reading` (the room's passages so far, in reading order, each at most 300 characters, at most 64, and `at`, the passage the reader interrupted) and the reader's actions since RISE last spoke (perception, stage 4). `promptFor` writes the reading block with that passage marked "the reader interrupted here" and those after it "not yet heard", then the perception block, then the reader's words.
- **The graft** (`src/live/graft.js`, pure). The room's reading is an arrangement of pieces: its own beats, each answer's beats, and a *taken-up* beat. An interjection cuts the reading after the passage the reader was in; the answer's beats go there as they arrive, and the rest (the tail) is held aside, so the voice cannot run on into it while the answer is still being written. `resume` puts the tail back after the answer, led by the held passage again from the phrase the voice was held at (a passage the reader had heard to its end is not said again); `replace` and `end` withdraw it (the room's own answer, if still being written, is stopped). The arrangement is lowered to one `rise.current.v2` in reading order, so a beat's id is its place (`beat-<n>`) and is unique across the whole run by construction: the beats after the cut are renumbered, and the runtime gives the voice and the speech clock everything after the cut again, as a seek does. An answer's scenes are named `i<n>-<id>`, so they never meet the room's; when the answer starts one, the reading's own scene starts again where the tail resumes.
- **The one Player** gains `graft(session)`: a Session that keeps every atom up to and including the one the head is on and differs after it, taken only while the reading is held. Everything after the first answer beat is `extend`, as before.
- **The runtime** (`beginInterjection`, `interject(words, { perception })`, `cancelInterjection`). The voice is held through the request's latency: RISE adds no words of its own; the venue shows "Asking RISE…", and a model may make its first beat a short bridging sentence. The answer's first beat lands at the head's boundary and plays at once; the same voice says it, over the same scene unless the answer starts another. Pause, seek, replay and pace act on the answer as on any passage; Back from the first answer passage returns to the held passage. The journal notes `interjection.held { segmentId }`, `interjection.asked { segmentId }`, `interjection.answered { beats, ending }`, `interjection.failed { reason }` and `interjection.cancelled`; none of them goes up as perception (the interjection's own hold is not a pause). On failure the held reading resumes and the venue says so in one line.
- **The venue.** While the reading plays the bar shows the microphone and a small field. Pressing the microphone, or typing, begins the interjection; Enter asks; Escape cancels. A reading the reader paused with Play, or one that has ended, is asked again as before: the next question is a new reading.
- **Measured** (local production build, headless Chromium, the venue's demo and the paced voice): the reader's words (Enter) to RISE's first word of answer, 539 ms and 542 ms in two runs, most of it the demo writing its first beat line at about 150 characters a second; a real model adds its own first-token time. Pause during the answer holds it; after `resume` the held passage is said again from its phrase; after `replace` the rest never plays and the reading ends with the answer; Back from the first answer passage lands on the held passage; no speech starts over another, and one voice is chosen for the whole reading (`e2e/live.spec.js`; the runtime's own tests hold the same on fake timers, `src/live/runtime.interjection.test.js`).
- **Not verified, and known limits:** no real model has answered an interjection, so whether one keeps it brief and names an ending well is unknown. The microphone path is held by unit tests only; no browser here listens. A reading paused with Play is asked again as a new reading, not interjected; so is one whose last words are all shown. Journal entries from before a graft name passages by their old places, so perception may quote the wrong passage for a move made before an earlier answer. The arranged reading is held to one Current's bounds (64 beats, 20,000 characters): an answer that would pass them fails the interjection, and a room still writing its own answer past them after a resume fails as any over-long Current does.
