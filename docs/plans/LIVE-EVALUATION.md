# Is a live Current different? The evaluation instrument

**Status:** the instrument is built and tested. **The study has not been run.** Nothing here says a live Current is better than anything. Running it needs people, consent, and whatever ethical review the organisation requires; none of that is something the instrument, or the agent that wrote it, can supply.

**Current scope (2026-10-04):** this study targets a live Current, which is deferred ([decision](../product/discussions/2026-10-04-composer-decision.md)). The Composer edition's first reader sessions (V1) are formative and use their own protocol.

## The question, and why it may come out badly

RISE claims a live Current is a response medium of its own: not text chat, not ordinary AI voice, not voice over a generic audio-reactive visualizer. If it is only prettier than the third, that is the finding, and this study is written so that it cannot say otherwise: below ten participants per compared group it says only that it cannot conclude; a difference that is not larger than chance is reported as none; and if a live Current wins only in how it was rated, the summary says it differs in *experience*, which is a preference and not evidence that it helps anyone understand.

## Design

Between participants. Each person meets **one** condition, because meeting the same answer four times teaches them the answer. Content is the same fixed answer (`src/live/fixtures/black-holes.js`) in every condition; only its presentation differs. Conditions are assigned in balance from a participant number and a seed, so the assignment can be reproduced and audited (`conditionFor`).

| Condition | What the participant gets |
|---|---|
| `text` | The whole answer as text, with its sources as notes and the side answer in place. What a chat answer is. |
| `spoken` | A voice says it, naming each source after its passage. Nothing to look at. Ordinary AI voice. |
| `spoken-visualizer` | The same voice over an imagery field that pulses on each word and knows nothing of the content. |
| `rise-current` | The answer as RISE presents it (the real runtime and Chamber), with a prompt to ask about the event horizon at one place, then Surface. |

**What the visualizer control is, and is not.** A browser's speech output cannot be analysed by Web Audio, so the visualizer cannot react to the *audio*. It reacts to the voice's word-boundary events: the same renderer family, the same voice, imagery timed to the speech and unconnected to what is said. That is the right control for "imagery that follows the passages" but a weaker one for "audio-reactive" in the signal-processing sense, and a result should be described that way.

## Measures, in order of weight

- **Primary:** comprehension right after (six questions about what the answer said) and delayed recall (the same six again, later, by `?eval=later`).
- **Secondary:** evidence identification (which publication supported a named claim) and orientation after an interruption (where the main answer carried on after the side answer).
- **Exploratory:** ratings (1 to 7) of coherence, of the imagery informing, and of the imagery being mostly decoration (asked separately, so agreement with both is visible).

Question choices are shuffled per participant and question, and a record stores the *original* meaning of each choice, so position cannot be gamed and is not confounded with the answer. Every right answer is checked against the fixed answer by a test, so the questions cannot drift from it.

The interruption is the same in every condition: after the passage on the size of the horizon, a side question about the event horizon is answered, in the condition's own form, and the main answer resumes. In the live Current condition the participant asks it themselves and Surfaces; the record notes that they did (`dived`).

## Running it

- A participant: `/live?eval=1&n=<participant number>&seed=<any whole number>`. With no `n` the condition is random and the page says it is not balanced. Use the same seed for a whole study.
- The later questions, some hours to a day on: `/live?eval=later`, and the participant opens the file they downloaded.
- Records come back as files. `node scripts/summarize-live-study.mjs <folder>` reads them, names and skips any file that is not a study record, and prints the table, the contrasts with 95% intervals, and the one conclusion the study may draw.

Use a real voice for the three spoken conditions. A run in which nothing was actually spoken (a silent, paced run, which is what a device with no voice gives, and what the automated tests use) is kept but **left out of the analysis and counted**, because it measures nothing about speech.

## What a record holds, and what leaves the device

A random twelve-character code, the condition, the answers, the ratings, timestamps, and a small whitelist about the device and what the participant did (voice kind, viewport, reduced motion, touch, WebGL2, whether they asked). Nothing that identifies a person can be added: the validator refuses any other field, and a test holds it. Nothing is sent anywhere and nothing is written to storage: the record exists on the page until the participant downloads it, which is what a browser test asserts.

## What this does not do

- **Ethics and consent.** The instrument shows a plain statement of what is kept and that leaving keeps nothing, and asks for agreement. That is not a substitute for review by whoever governs research here, and it is not legal advice.
- **Sample size.** Ten per group is the floor below which the study refuses to speak, not a recommendation. Detecting anything modest needs far more, and no power calculation has been done.
- **One answer, one topic, one modality of question.** A result is about black holes, multiple choice, and this one answer. It says nothing about longer, harder or open questions.
- **Multiple comparisons.** Four objective measures are compared without correction, and the summary says so whenever it reports an advantage.
- **Novelty and demand.** A new medium is interesting; people who know they are testing it may try harder. Neither is controlled beyond the design being between-participants.
- **Devices vary.** Voices, screens and speeds differ; the record notes some of it, and nothing adjusts for it.
- **Nobody has run it.** The numbers in the tests are synthetic and exist only to hold the analysis to its promises.

## Where things are

`src/live/eval/study.js` (design, scoring, analysis), `script.js` and `presenters.js` (the conditions), `src/live/host/EvalRunner.js` (the participant's path), `scripts/summarize-live-study.mjs` (the analysis), `e2e/live-eval.spec.js` (one participant per condition, in a browser).
