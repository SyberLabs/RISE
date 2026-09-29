# Affect layer

An optional description of what a RISE experience is doing across text, pace, image, type, and sound. It does not admit configuration and it does not run inside the player.

Read `docs/adr/0001-affective-semantic-layer.md` for the decision and `docs/affect/RESEARCH-LOG.md` for what was refused. The passage-level outputs are in `docs/affect/BENCHMARK.md`.

## What is which

| Kind | Examples |
| --- | --- |
| Measured | Words per minute, palette swatch converted to hue and luminance, a caller-supplied loudness or spectral density, visual mode off |
| Inferred | Text valence and the other lexicon-backed axes |
| Derived | Tension from several text features, perceptual density from type-token ratio, cross-modal contrast |
| Prior | The numeric map from pace onto arousal, from hue onto warmth, from letter-spacing onto expansiveness |
| Not run | EmoPair-family models, MiniLM distillation, hosted teachers, music-emotion networks |

A prior is a scale choice. It is not a result from this corpus.

## Commands

```bash
npm run affect:benchmark
npm run affect:export-onnx
npm run affect:bench-runtime
node scripts/affect/fit-readout.mjs
```

`fit-readout` exits 2 until a JSON file of judgments contains 24 records with `annotatorKind` of `human`. It does not invent weights.

## Calling it

`maybeEvaluate(candidate, env)` returns `{ status: 'disabled' }` unless `env.RISE_AFFECT` is `1` or `true`. `evaluateCandidate` always evaluates, never writes the candidate, and still returns a pacing or visual state when the text encoder throws.

The candidate is a plain object: `text`, `visualConfig` or `visual.measured`, `audioFeatures`, `pacing` (`wpm`, `chunkMode`, `curve`, `revealMode`), `typography`, and `intent`. `intent.target` names axes. `intent.intentionalContrast` keeps disagreement out of the conflict component. `intent.weights` is the only way a single composite is produced.
