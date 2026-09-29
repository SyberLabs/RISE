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
2. **OpenAI Realtime**: WebRTC in the browser, ephemeral client secret only. Following the rule already in ARCHITECTURE §8.28, the reader supplies their own key, it lives in page memory, and a same-origin Worker route exchanges it for a short-lived client secret and stores nothing. No RISE-funded inference. *Decision D1 below.*
3. A second provider or a fixture-only proof of independence, after the first flagship demo.

## 8. Semantic state, evidence, and depth

**Experiential state** is the intended condition of a segment, never a claim about the reader: `tension`, `warmth`, `expansiveness`, `perceptualDensity`, `motionEnergy`, `solemnity`, `novelty`, `uncertainty`, `intimacy`, `arousal`, each 0 to 1 and each optional (absent is not zero). A trusted mapping modulates an authored visual's own bounded parameters; it never selects a renderer and never flattens two visuals into one generic animation.

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
| First load | 0 bytes added; the budget number is not moved |

| Piece | Implemented | Unit | Browser | Mock provider | Live provider |
|---|---|---|---|---|---|
| Protocol, validator, reducer | yes | yes | no | yes | n/a |
| Mock adapter and conformance fixture | yes | yes | no | yes | n/a |
| Player live mode | yes | yes | no | n/a | n/a |
| Speech clock and voice renderers | no | no | no | no | no |
| Runtime, Dive and Surface | no | no | no | no | no |
| `/live` host | no | no | no | no | no |
| Capability negotiation | no | no | no | no | no |
| Evidence and experiential state | no | no | no | no | no |
| OpenAI Realtime adapter | no | no | no | no | no |
| MCP host | no | no | no | no | no |
| Evaluation harness | no | no | no | no | no |

## 12. Decisions that are the creator's

- **D1. Live provider key.** I recommend the §8.28 pattern: the reader's own key, held in page memory, exchanged once through the same-origin Worker for a short-lived client secret, never stored. A developer-only local token script is the alternative for self-hosting. Neither exists yet.
- **D2. Literal text.** `rise.current.v1` refuses `[PAUSE]`, `|` and U+E000 because the chunker reads them. The safe path I propose is a per-segment `literal: true` that escapes those tokens at the chunker boundary, which needs a chunker option and its own review. It is not needed for the demo and I will not weaken the refusal first.
- **D3. Order.** I propose: protocol and reducer, mock and conformance, Player live mode, speech clock, runtime with Dive, the `/live` host with browser tests, capabilities, evidence and state, the OpenAI adapter, the MCP host, the harness. Each is its own pull request.
