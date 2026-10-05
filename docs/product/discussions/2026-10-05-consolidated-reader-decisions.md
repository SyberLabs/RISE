# Decision: the Consolidated Reader's six questions

Status: Record. Date: 2026-10-05. Decided by Mateo, adopting the answers the [Consolidated Reader proposal](../CONSOLIDATED-READER.md) recommends. The proposal named Seth for Q1–Q4; Seth gave his full agreement on 2026-10-05, as Mateo reported, and his review is asked for in the pull requests that build them. The same day Mateo authorized the build of B4 (the canonical Home) with Seth reviewing. Q5 was decided earlier the same day.

## The answers

| | Question | Answer | Builds |
|---|---|---|---|
| Q1 | Home | **Adopt "a home with a window".** The featured reading's field moves full screen; words do not stream on Home; Begin is the only primary action; Continue leads when there is a reading to resume. Home's structure changes only by a joint dated decision after five readers are observed against the acceptance criteria in §2 of the proposal. | B4, D1 |
| Q2 | The looks and their names | **Adopt the ten looks**: Plain, Gallery, Nocturne, Garden, Flame, Signal, Iris, Revel, Vigil, Inlay. Stances and tempers merge into them; salon folds into Garden; the ember temper becomes Iris, so "ember" stays a colour only. | C1 |
| Q3 | Inlay on desktop | **Phone first.** Inlay is offered only on screens 820 px wide or less until the desktop drift check in §4.2 passes. Rolls and Today's poem do not draw Inlay until the five-reader observation (package V). | C6 |
| Q4 | Follow text | **Inside one look.** Follow text varies intensity and composition within the reading's own engines and colour theme, and never switches engine family or colour during a reading (R6). #266's per-passage engine switching ends. | C4 |
| Q5 | Attractor frame policy | #371's 25 fps threshold was not deliberate. Step down when the median frame is slower than 30 fps or the slow tail passes 50 ms. Built in #417. | B1 (done) |
| Q6 | One colour vocabulary | **The nine themes are the only colours a reader or a model sees.** The Settings accent is removed and page chrome follows the reading's theme; the ambient drone is removed. The cost is known: RDR-004 fixed the accent's loading on 2026-10-04. | B2, D2 |

## The evidence behind the Phrase default

Phrase became the default rhythm in #407 because readers in the owner's user testing widely preferred it to single words. No recording of those sessions exists; this record is the written account of that evidence.

## What follows

Phases B to D of the proposal are seeded in the tracker with these answers: B2 (FND-008), B3 (FND-009), B4 (RDR-019), C1–C6 (RDR-020 to RDR-025), D1 (FND-010) and D2 (RDR-026). The five-reader observation (package V) is RDR-007 and RDR-009. The contracts the ChatGPT presentation stands on stay fixed (§5 of the proposal); B2 adds its colour maps beside `RISE_CURRENT_THEMES` and never edits it.
