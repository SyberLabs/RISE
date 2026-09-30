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
| Authored | A number a person wrote on an affect program |
| Offline witnesses | EmoPair checkpoints, the MiniLM probe, and the local teacher. They are benchmark columns. The player does not load them. |

A prior is a scale choice. It is not a result from this corpus.

## Commands

```bash
npm run affect:benchmark
npm run affect:export-brief -- path/to/text.txt path/to/outdir
node scripts/affect/fit-readout.mjs
```

`affect:export-brief` writes `affect-brief.json` and `affect-prompt.md`. The brief is a proposal list. The prompt asks for `rise.affect-program.v1`. A returned program is admitted with `admitAffectProgram` and becomes `user` only when `saveAffectProgram` is called. The player does not read either file.

`modulatePlateColorsAt(look, program, phraseIndex)` turns a procedural plate's `hue` by warmth and scales its `sat` by arousal. `modulateFlameColorsAt` does the same to a Living Flame recipe's `macros.hue` and `tone.vibrancy`. Arousal at 0.5 leaves the authored strength. Valence does not move hue. A phrase with no span returns the same object. Palette names, grain, chroma, geometry, and motion stay put. The visual engines do not import this layer.

Home → More → Emotions opens the map. Texts with valence and arousal sit in the plane. Attractor colors and Living Flame scenes with warmth sit on a spectral ring. A Thomas attractor turns through that ring. Hue follows warmth. White, and any other axis that was not estimated, stays off the map.

`modulateEnergyAt(engine, parameters, program, phraseIndex)` scales the one energy parameter attractor, night-streaks, and Living Flame already expose. The signal is `motionEnergy`. At 0.5 the authored value stays. Attractor and night-streak `speed` stay between 0.25 and 4. Living Flame `energy` stays between 0 and 1, on the field or on the recipe. Arousal does not move it. Apparitio, Ostensoria, Harmonograph, Klee, and Genesis are not channels. Brightness, hue, palette, and transforms stay put.

`fit-readout` exits 2 until a JSON file of judgments contains 24 records with `annotatorKind` of `human`. It does not invent weights.

## Calling it

`maybeEvaluate(candidate, env)` returns `{ status: 'disabled' }` unless `env.RISE_AFFECT` is `1` or `true`. `evaluateCandidate` always evaluates, never writes the candidate, and still returns a pacing or visual state when the text encoder throws.

The candidate is a plain object: `text`, `visualConfig` or `visual.measured`, `audioFeatures`, `pacing` (`wpm`, `chunkMode`, `curve`, `revealMode`), `typography`, and `intent`. `intent.target` names axes. `intent.intentionalContrast` keeps disagreement out of the conflict component. `intent.weights` is the only way a single composite is produced.
