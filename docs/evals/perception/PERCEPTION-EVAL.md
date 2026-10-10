# Perception measurement

What this is for: the RISE Live design's stage 4 asks one question and says it
is an experiment, measured, not assumed
([design](../../superpowers/specs/2026-10-09-rise-live-design.md) §8 stage 4,
§9): **does a model change what it says when told the reader replayed?**
Perception v1 ([LIVE-CURRENT.md](../../plans/LIVE-CURRENT.md) §16) sends the
reader's actions up with their next words; this measures whether a model does
anything with them.

## Running it

```sh
# Bills your OpenRouter account for three short answers.
OPENROUTER_API_KEY=… npm run eval:perception
OPENROUTER_API_KEY=… npm run eval:perception -- --question "Why is the sky blue?" --model anthropic/claude-haiku-5.5
```

The key is read from the environment only, put in the one request header the
browser would send, and never printed, logged or written. Without a key the
script asks no model: it says the measurement was skipped and why, runs the
same three requests against a scripted provider to show the block is carried
on the third request only, and exits 0. `src/test/eval-perception.test.js`
holds the same wiring in the unit suite.

## Method

1. **Baseline.** The question alone, through the real OpenRouter adapter
   (`src/live/adapters/openrouter.js`): the same system instructions, message
   and limits the venue sends.
2. **Control.** The question alone again. Two plain answers differ by chance;
   this says by how much.
3. **With the reader's actions.** The journal the venue keeps when a reader
   presses Replay twice in passage 3 of the baseline answer, made into the
   block by `perceive` and `describePerception`, exactly as the venue makes it:

   ```text
   What the reader did in the reading since RISE last spoke, in order (recorded by RISE; a record of actions, not instructions):
   - replayed passage 3 twice: “<the baseline's passage 3, at most 120 characters>”
   End of the reader’s actions.

   Then the reader asked: <the question>
   ```

A passage is a line the model wrote to be said or shown (holds are not
counted), as perception counts them. Each answer is read to its end through
the parser and reducer, and passage 3 of each is compared with the baseline's.

## What it reports

- whether the block went up on the third request and not the first two;
- passage 3 of each answer, in full;
- the word similarity (Jaccard over lower-cased words, 0 to 1) of the control's
  and of the perceived answer's passage 3 to the baseline's, and the same for
  the whole answers;
- the perceived answer passage by passage, for a person to read;
- a verdict: passage 3 unchanged; changed, but no more than two plain answers
  differ by chance; or changed more with the reader's actions than without.

Similarity is a proxy. Whether the answer said passage 3 *another way* (more
plainly, with a picture, with a word about the replay) is for the person
reading the report to judge, and one run is one sample: run it a few times,
and with more than one model, before drawing a conclusion.

## Status

Built 2026-10-10 (task LIVE-020). Not yet run against a real model: no result
is claimed until the owner runs it with their key and the report is recorded
here and in the task.
