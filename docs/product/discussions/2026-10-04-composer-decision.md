# Decision: RISE in ChatGPT is Composer

Status: Record. Date: 2026-10-04. Decided by Mateo after the controlled ChatGPT host session of the same day. This adds to the [October direction decisions](2026-10-03-direction-decisions.md); it does not rewrite them.

## The decision

**Composer is the right approach for RISE inside ChatGPT.** Composer is a one-shot sequence creator and RISE presentation:

1. The host model composes one sealed Current, a short guided explanation, and hands it to RISE in a single `rise_present` tool call.
2. The RISE Worker validates and admits it. A refused Current never becomes playable.
3. The widget shows the answer's title over Begin. Nothing plays until the reader presses Begin.
4. RISE presents the sequence: text, voice, pacing and the visuals the Current chose, through the existing Experience Program, Session, Player and Chamber.
5. The reader controls the presentation locally and at once, with no model in the loop: Begin, Interrupt and Resume, Stop, and the bounded visual change.

The model's part ends when its Current is admitted. Nothing it says afterwards changes the presentation that is playing. A new answer is a new Current and a new widget.

"Composer" here names this host contract. It is not the Scriptorium's composer, which authors Experience Programs inside RISE.

## Why

The host session ([record](../../experiments/CHATGPT-HOST-2026-10-04.md), PR #400) tested both models against the exact release `891aa878`.

- **Composer works in real ChatGPT.** A plain request produced an admitted Current and a Begin card; Begin started narration the reader confirmed hearing; Interrupt, Stop, the refusal of a compound visual request and reload-without-autoplay behaved as designed.
- **Live does not, by construction of the host.** In the decoupled probe (#372) one widget persisted and the reader's own changes applied in it at once, but four admitted model changes never reached that widget on their own: it stayed at sequence 2 until a manual read jumped it to 6. ChatGPT gives a tool call's result only to that call's widget, and offers no channel from a later call into an open one. Voice was not shown to interleave speech and tool calls.
- The [Composer-first roadmap](../../COMPOSER-FIRST-ROADMAP.md) already put realtime mutation off the first edition's path; this evidence closes it for ChatGPT.

## Out of current scope

- **Dive.** A reader's question to the model at a passage, its answer, and the model-authored Dive notes a Current may carry are not part of the current product. Models are not asked to write Dive notes, and the ChatGPT presentation does not offer Dive. The code stays in the tree, dormant. Bringing Dive back is a separate decision.
- **Realtime Live.** A model changing the experience while it speaks, reciprocal reader events, a voice clock and model perception are deferred. #372 is closed; its exact head stays pinned in the host record. A future Live needs a host RISE owns, and a concrete hypothesis, before any work starts.

Not affected: the Reader's own gesture of holding or tapping a passage to look beneath it (`src/core/dive.js`, the Chamber's undercurrent panel). It shares the word "dive" and nothing else.

## Effect on the plan

- The first edition is M0 foundation, M1 one composed explanation, M2 reader control and replay, V1 reader sessions, then M4 release. M3 (exploration and return) is removed.
- Tracker: LIVE-008 (exploration), LIVE-R02 (reciprocal Live), LIVE-H01 (events and temporal authority) and LIVE-H02 (voice clock and perception) are removed; LIVE-009 now follows LIVE-007. LIVE-R01 closes with the host session as its evidence.
- The tracker's second lane is Composer + RiseSDK. SDK work still waits for observed integration demand.
- Documents that describe Live or Dive as current or planned carry a pointer to this record. Historical handoffs, dated plans and the verbatim October roadmap stay as they were written.
