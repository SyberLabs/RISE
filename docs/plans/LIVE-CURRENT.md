# The live Current: an experiential runtime for machine intelligence

**Status:** plan and decisions, 29 September 2026. Written after merged PR #300 (the sealed `rise.current.v1`) and the Phase 1 consolidation (PR #298). Nothing here is built until a row in §11 says so.

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
3. **A generic text-stream adapter** (`text-stream.js`), which OpenAI's is one `connect` function of. Provider independence is shown by conformance: the mock, the generic adapter over a fake provider, and the OpenAI adapter over a fake data channel all pass the same suite (`src/test/live-conformance.js`). A model's words are read only through a defensive line format (`segment-parser.js`); it carries no evidence and no Dives, and a stream that drops cannot be continued, so it says so and ends failed with every whole passage intact.

## 8. Semantic state, evidence, and depth

**Experiential state** is the intended condition of a segment, never a claim about the reader: `tension`, `warmth`, `expansiveness`, `perceptualDensity`, `motionEnergy`, `solemnity`, `novelty`, `uncertainty`, `intimacy`, `arousal`, each 0 to 1 and each optional (absent is not zero). A trusted mapping modulates an authored visual's own bounded parameters; it never selects a renderer and never flattens two visuals into one generic animation. As built (`src/live/state-visuals.js`), only two dimensions have a renderer that can express them honestly: `motionEnergy` sets an attractor's speed (0.6 to 1.6) and `perceptualDensity` its brightness (0.4 to 0.75), both narrower than the renderer's own limits so the words stay legible. Every other dimension, and every other renderer, is left alone and is shown to the reader as coarse words (low, medium, high) in “About this passage”, never as a claim about them. The sealed Current never carries state: the runtime adjusts the compiled visual program.

**Evidence** is a bounded record: source identity, title, an optional location or span, a URI only through a validated `https` path, the claim or segment it supports, and whether it was `supplied`, `retrieved` or `model-proposed`. A model's origin is attribution, not evidence. Absent evidence is represented as absent and shown as absent. Evidence is reachable through Dive, never forced into the primary stream.

**Depth.** *Stable depth* (citations, prepared diagrams, authored notes) lowers to the existing `thread` track. *Generative depth* (the reader asks a question at a position) opens a `branch`: a child Current that records its parent, the exact atom it was invoked from, the question, inherited context and evidence, and its own identity. Nested Dive is not built. The UI marks which kind of depth it is showing.

## 9. Hosts

- **Standalone `/live`** (first): a prompt, start, microphone state, the presentation, speaking state, interrupt or Dive, Surface, stop, and a clear error state. No product chrome. Deterministic provider by default; the live provider only by explicit configuration.
- **MCP app** (after the runtime is proven standalone): a thin host exposing present, start/continue, Dive, Surface and adjust. It contains no runtime logic. Where a platform cannot expose host-owned voice timing, RISE's own voice is used and the limitation is stated.

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
| Speaking to interrupt (microphone) | no, typed only | no | no | no | no |
| Evidence and experiential state | yes | yes | yes | yes | n/a |
| Text-stream adapter, segment parser | yes | yes (parser fuzzed, chunk-invariant) | yes (through the OpenAI path) | yes (fake provider) | n/a |
| OpenAI Realtime adapter, WebRTC transport, relay route | yes | yes | yes, with a fake peer and a stubbed relay | n/a | **not verified: no key, no live session** |
| MCP host | no | no | no | no | no |
| Evaluation harness | no | no | no | no | no |

**Measured in a real browser (headless Chromium, production build, deterministic provider, silent paced voice; `e2e/live.spec.js`, one machine, one run).** Click to first atom on the page: **about 0.73 s**, of which the mock’s first segment is 0.22 s and the rest is fetching what the reading needs and mounting the Chamber. Segment boundaries: the first atom is within **−33 to +16 ms** of the voice starting the segment. Inside a segment: within **−54 to +22 ms** of where the voice was. Both are inside the budgets above, which the suite asserts with margin for slower machines. First load moved from 59.8 to 59.9 KB brotli (Player’s `govern` and `replayCurrent`, and the route); the 64.0 KB budget is unmoved. Reduced motion was checked by comparing screenshots of the imagery 1.5 s apart (identical under reduced motion, different otherwise), not by reading the CSS.

**Performance, measured (`src/live/perf.test.js` in Node, `e2e/live.spec.js` in the browser; one machine, one run each).** Applying an event: p50 0.011 ms, p95 0.017 ms, max 2.2 ms over 2,960 maximum-size events (budget 2 ms at p95). Lowering a maximum Current (5 × 4,000 characters) to a Session, once per ended segment: p95 4.1 ms, max 14 ms. Memory in Node: one whole reading holds at most 0.13 MB more than it started with and 0.11 MB after Stop; thirty readings each with a Dive retain 0.09 MB (budget 5 MB, back to baseline). In the browser: through a whole reading with a Dive there were two long tasks, the longest 52 ms, and no frame worse than 50 ms in 1,663; and three cycles of reading, Dive, Surface and Stop grew the heap by 0.41 MB after the first, which loads code and caches (a rerun of the same loop on the dev server grew 0.24, 0.20 and 0.04 MB). The suite asserts thresholds several times these.

**Not verified, and known limits of the platform.** No real speech engine has been used, so every claim about `speechSynthesis` is against a fake device that models the behaviours a renderer depends on. Chrome’s network voices report no word boundaries, in which case the reading is corrected only at segment starts and ends, and a Dive that holds such a voice restarts its segment when it is released. Some Chrome builds cut a long utterance off after about fifteen seconds; the speech clock then stands down to the Player’s timer, as it does for any voice that stops. A microphone is not used: interrupting is typed, and the page says so where speech recognition is unavailable.

**Measured so far on a virtual clock (mock provider, synthetic voice; `src/live/runtime.test.js`, `speech-governor.test.js`).** The segment-boundary budget (a segment's first atom within 100 ms of the voice starting it) and the in-segment budget (every atom within 250 ms of where the voice was) hold, asserted per atom. After a Dive, every later segment begins later by the length of the Dive to within 400 ms, and the voice's own times shift by it exactly. Time to first visible atom and to first audio are the moment the first *segment* is committed plus one event turn, because only a finished segment is lowered. That makes **first-segment length the lever on time to first response**: the mock's 120-character opening finishes at 220 ms; a real provider writes more slowly, so it should open with a short segment. This is a finding about the design, not a solved problem, and it has not been measured against a live provider.

## 12. Decisions that are the creator's

- **D1. Live provider key.** Built as the narrowest form of the §8.28 pattern: the reader's own key, held in page memory, used once per session by the same-origin Worker to open it, never stored. No client secret is minted, so there is nothing to expose. It ships switched off; enabling it (`LIVE_REALTIME_ENABLED`) is the creator's decision, and so is whether the reader-supplied-key page should ever be public. A developer-only local script for self-hosting was not built. Nothing has been run against OpenAI.
- **D2. Literal text.** `rise.current.v1` refuses `[PAUSE]`, `|` and U+E000 because the chunker reads them. The safe path I propose is a per-segment `literal: true` that escapes those tokens at the chunker boundary, which needs a chunker option and its own review. It is not needed for the demo and I will not weaken the refusal first.
- **D3. Order.** I propose: protocol and reducer, mock and conformance, Player live mode, speech clock, runtime with Dive, the `/live` host with browser tests, capabilities, evidence and state, the OpenAI adapter, the MCP host, the harness. Each is its own pull request.
