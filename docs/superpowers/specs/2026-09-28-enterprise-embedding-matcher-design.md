# EnterpRise: an embedding matcher, and a question Kev can answer

Date: 2026-09-28. Status: approved direction (product owner, 2026-09-28); details below
chosen by the implementer and open to override.

## Why

A spike (`spike/kev-benchmark`, `bench/RESULTS.md`) scored the room on 62 labelled
lines. Word overlap put the right source first on 30% of answerable lines and found
none of 16 paraphrases. A 34 MB embedding model put it first on 88%. On the same
three candidates, the production rail question made Kev-4B and Kev-0.8B show a card
on only 10 of 40 answerable lines (48% overall); asking Kev to pick one source or
none, blended with the match score, reached 94% in the best blend tried. The room
must run with no API key and no always-on server.

## What changes

1. **Matching uses a real sentence embedding.** `bge-small-en-v1.5`, int8 ONNX,
   pinned by Hugging Face revision and SHA-256 (`src/enterprise/embed-model.js`),
   runs in a dedicated worker (`embed-worker.js`) on the WebAssembly CPU path of
   the `onnxruntime-web` build already in use. It uses the tokenizer package
   already in use. No new dependency. Files are cached in Cache Storage like
   Kev's (`kev-store.js`).
2. **The session stays synchronous.** Card and corpus-sentence vectors are
   computed once, after the room opens, and attached to the session. The live
   loop embeds each final line (and each Ask) before `prepare`, and passes the
   vector in. A line with no vector, because the model is still loading or
   failed, takes today's path; the room never waits on the embedder.
3. **Scores keep their meaning.** Cosine is mapped onto the rail's 0-1 scale by
   a linear calibration stored with the model pin, fitted so the rule decider's
   `showThreshold` sits at the benchmark's best cut. `RAIL_POLICY` is unchanged.
4. **Retrieval ranks by the same vectors.** With a vector, every final (any
   speaker) and every Ask ranks the prepared cards together with all
   permitted sentences and tables by calibrated cosine; an entry a prepared
   card already shows is dropped so the slide title wins. This widens one
   rule: a presenter's line can now surface a permitted sentence the deck did
   not pick, because a prepared card holds one sentence per slide and the
   benchmark showed presenters talking about the others. The gate still
   validates every hit, and only documents permitted to the room's audience
   are ever embedded. Without a vector, retrieval stays as it was: audience
   lines the program misses, and Asks, by word overlap.
5. **Kev is asked to pick one source or none.** `rail-question.js` asks a choice
   among `none` and the candidate titles, with the window, speaker and mode as
   state. Rail titles are no longer sent. The reader blends Kev's probability
   for each source with its match score, half and half, and shows the best
   source when the blend clears a cut, otherwise dismisses. The server route
   and the device ask and read the same question, as before.
6. **The keyless default.** The live room starts on Local (embeddings and the
   rule decider). Kev on the device and the server route stay explicit choices.

## Invariants kept

Nothing reaches the stage without Promote, and Promote re-runs the gate. Board-only
documents are never embedded, retrieved, or offered. The decider never sees card
bodies. A failed or late decision holds and never falls back to another decider.
The trace records speech as character counts only. No transcript is stored.

## Rejected

- `@huggingface/transformers` in the browser: a second copy of the runtime
  (it pins its own `onnxruntime-web`) for what is one model call and a mean.
- A WebGPU embedder: a 34 MB model answers in milliseconds on the CPU, and the
  GPU is Kev's.
- Making `prepare` asynchronous: every guard on stale and superseded turns
  assumes it is not.
- Keeping the three-way show/hold/dismiss question: the benchmark shows Kev
  dismisses answerable lines under it at every model size.

## Verification

Unit tests for pooling, calibration, the vector path in match and retrieval, the
question and the blended reader, and the route. A browser parity check of the
worker against the Node reference (transformers.js), measured at mean cosine
0.9993 and worst 0.9964 over 62 lines and 23 sources: int8 kernel noise between
two runtimes, far below the score gaps decisions turn on. The spike's benchmark
re-run through the production session: 52% with words, 84% with the embedder,
85% with Kev-0.8B and 87% with Kev-4B under the new question. E2E for the room
with model hosts blocked, so the embedder fails and the room matches by words.

## Measured, 2026-09-28

Chrome 153, AMD RX 5700, Windows. Embedder: first load downloads 49 MB (model,
tokenizer, runtime), then loads from cache in about 1.5 s; a line embeds in
about 21 ms (p95 28 ms).
