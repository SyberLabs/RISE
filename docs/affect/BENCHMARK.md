# RISE affect benchmark

Runnable models were executed on passages held in the RISE archive.
`pert-emopair` and `reward-emopair` are cached CPU scores from roberta-large checkpoints. `minilm-l6-probe` is a frozen all-MiniLM-L6-v2 embedding plus a linear head; the cell is the leave-one-out prediction, not the in-sample fit. A teacher column appears only when `AFFECT_TEACHER_URL` returned axes. None of these models run inside the player. A model listed under "Models not executed" was not scored, and its published numbers are not copied here.

## meditations-temper

Origin: rise-archive. Cases: philosophy, prose.
Archive: `src/content/archive/works/literary-meditations.js` · Meditations · Marcus Aurelius.

> From my grandfather Verus I learned good morals and the government of my temper.

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | 0.18 (0.17 inferred) | 0.15 (0.46 inferred) | 0.04 (0.55 inferred) | 0.10 (0.55 inferred) | -0.00 (0.55 inferred) | 0.50 (0.35 inferred) |
| arousal | 0.26 (0.17 inferred) | 0.14 (0.46 inferred) | 0.20 (0.55 inferred) | 0.40 (0.55 inferred) | 0.44 (0.55 inferred) | 0.70 (0.35 inferred) |
| dominance | 0.15 (0.17 inferred) | 0.14 (0.46 inferred) | 0.07 (0.55 inferred) | 0.36 (0.55 inferred) | -0.19 (0.55 inferred) | 0.30 (0.35 inferred) |
| tension | — | 0.10 (0.46 derived) | — | — | — | — |
| intimacy | — | 0.07 (0.46 inferred) | — | — | — | — |
| warmth | — | 0.04 (0.46 inferred) | — | — | — | — |
| uncertainty | — | — | — | — | — | — |
| expansiveness | — | 0.03 (0.46 inferred) | — | — | — | — |
| perceptualDensity | — | 0.47 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.04 (0.46 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.41 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.907 ms, mean confidence 0.17, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.749 ms, mean confidence 0.45, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- pert-emopair: 237.931 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 407.225 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.086 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 6385.439 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.35 (0.15, 0.50).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.46 (0.04, 0.50).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.40 (0.10, 0.50).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.50 (-0.00, 0.50).
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.44 (0.26, 0.70).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.56 (0.14, 0.70).
- Disagreement on arousal: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.50 (0.20, 0.70).
- Disagreement on dominance: reward-emopair vs minilm-l6-probe differ by 0.55 (0.36, -0.19).
- Disagreement on dominance: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.49 (-0.19, 0.30).
- Teacher hosted-teacher: ok.

## dickinson-death

Origin: rise-archive. Cases: poetry, irony, difficult.
Archive: `src/content/archive/works/literary-poems-dickinson.js` · Poems · Emily Dickinson.

> Because I could not stop for Death, He kindly stopped for me; The carriage held but just ourselves And Immortality.

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | -0.02 (0.16 inferred) | 0.43 (0.45 inferred) | 0.16 (0.55 inferred) | 0.15 (0.55 inferred) | -0.10 (0.55 inferred) | 0.99 (0.35 inferred) |
| arousal | 0.21 (0.16 inferred) | 0.13 (0.45 inferred) | 0.39 (0.55 inferred) | 0.56 (0.55 inferred) | 0.52 (0.55 inferred) | 0.96 (0.35 inferred) |
| dominance | -0.02 (0.16 inferred) | 0.13 (0.45 inferred) | -0.53 (0.55 inferred) | -0.51 (0.55 inferred) | -0.18 (0.55 inferred) | 0.93 (0.35 inferred) |
| tension | — | 0.12 (0.45 derived) | — | — | — | — |
| intimacy | — | 0.16 (0.45 inferred) | — | — | — | — |
| warmth | — | 0.60 (0.45 inferred) | — | — | — | — |
| uncertainty | — | 0.05 (0.45 inferred) | — | — | — | — |
| expansiveness | — | 0.08 (0.45 inferred) | — | — | — | — |
| perceptualDensity | — | 0.53 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.03 (0.45 inferred) | — | — | — | — |
| solemnity | — | 0.09 (0.45 inferred) | — | — | — | — |
| novelty | — | 0.47 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.251 ms, mean confidence 0.16, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.296 ms, mean confidence 0.44, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped, contrast-marker-present.
- pert-emopair: 133.693 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 301.814 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.029 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 5474.096 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs contextual-window-v1 differ by 0.46 (-0.02, 0.43).
- Disagreement on valence: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.01 (-0.02, 0.99).
- Disagreement on valence: contextual-window-v1 vs minilm-l6-probe differ by 0.53 (0.43, -0.10).
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.55 (0.43, 0.99).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.82 (0.16, 0.99).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.84 (0.15, 0.99).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.08 (-0.10, 0.99).
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.75 (0.21, 0.96).
- Disagreement on arousal: contextual-window-v1 vs reward-emopair differ by 0.43 (0.13, 0.56).
- Disagreement on arousal: contextual-window-v1 vs minilm-l6-probe differ by 0.39 (0.13, 0.52).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.83 (0.13, 0.96).
- Disagreement on arousal: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.57 (0.39, 0.96).
- Disagreement on arousal: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.40 (0.56, 0.96).
- Disagreement on arousal: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.44 (0.52, 0.96).
- Disagreement on dominance: lexical-vad-v1 vs pert-emopair differ by 0.51 (-0.02, -0.53).
- Disagreement on dominance: lexical-vad-v1 vs reward-emopair differ by 0.49 (-0.02, -0.51).
- Disagreement on dominance: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.95 (-0.02, 0.93).
- Disagreement on dominance: contextual-window-v1 vs pert-emopair differ by 0.66 (0.13, -0.53).
- Disagreement on dominance: contextual-window-v1 vs reward-emopair differ by 0.64 (0.13, -0.51).
- Disagreement on dominance: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.79 (0.13, 0.93).
- Disagreement on dominance: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.46 (-0.53, 0.93).
- Disagreement on dominance: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.44 (-0.51, 0.93).
- Disagreement on dominance: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.11 (-0.18, 0.93).
- Teacher hosted-teacher: ok.

## austen-opening

Origin: rise-archive. Cases: prose, irony, difficult.
Archive: `src/content/archive/works/pride-and-prejudice.js` · Pride and Prejudice · Jane Austen.

> It is a truth universally acknowledged, that a single man in possession of a good fortune must be in want of a wife.

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | 0.11 (0.28 inferred) | 0.09 (0.70 inferred) | 0.05 (0.55 inferred) | 0.06 (0.55 inferred) | 0.02 (0.55 inferred) | 0.58 (0.35 inferred) |
| arousal | 0.21 (0.28 inferred) | 0.12 (0.70 inferred) | 0.19 (0.55 inferred) | 0.36 (0.55 inferred) | 0.15 (0.55 inferred) | 0.96 (0.35 inferred) |
| dominance | 0.15 (0.28 inferred) | 0.11 (0.70 inferred) | 0.26 (0.55 inferred) | 0.52 (0.55 inferred) | -0.03 (0.55 inferred) | 0.27 (0.35 inferred) |
| tension | — | 0.09 (0.70 derived) | — | — | — | — |
| intimacy | — | 0.01 (0.70 inferred) | — | — | — | — |
| warmth | — | 0.02 (0.70 inferred) | — | — | — | — |
| uncertainty | — | — | — | — | — | — |
| expansiveness | — | 0.09 (0.70 inferred) | — | — | — | — |
| perceptualDensity | — | 0.61 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.03 (0.70 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.45 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.119 ms, mean confidence 0.28, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.135 ms, mean confidence 0.64, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- pert-emopair: 138.795 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 468.658 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.069 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 5042.354 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.47 (0.11, 0.58).
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.49 (0.09, 0.58).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.54 (0.05, 0.58).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.52 (0.06, 0.58).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.56 (0.02, 0.58).
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.75 (0.21, 0.96).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.84 (0.12, 0.96).
- Disagreement on arousal: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.78 (0.19, 0.96).
- Disagreement on arousal: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.60 (0.36, 0.96).
- Disagreement on arousal: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.81 (0.15, 0.96).
- Disagreement on dominance: lexical-vad-v1 vs reward-emopair differ by 0.37 (0.15, 0.52).
- Disagreement on dominance: contextual-window-v1 vs reward-emopair differ by 0.41 (0.11, 0.52).
- Disagreement on dominance: reward-emopair vs minilm-l6-probe differ by 0.55 (0.52, -0.03).
- Teacher hosted-teacher: ok.

## ishmael-water

Origin: rise-archive. Cases: prose, descriptive.
Archive: `src/content/archive/works/moby-dick-or-the-whale.js` · Moby-Dick · Herman Melville.

> Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | 0.05 (0.14 inferred) | 0.01 (0.58 inferred) | 0.02 (0.55 inferred) | 0.04 (0.55 inferred) | -0.05 (0.55 inferred) | 0.58 (0.35 inferred) |
| arousal | 0.23 (0.14 inferred) | 0.14 (0.58 inferred) | 0.18 (0.55 inferred) | 0.42 (0.55 inferred) | 0.41 (0.55 inferred) | 0.96 (0.35 inferred) |
| dominance | 0.12 (0.14 inferred) | 0.00 (0.58 inferred) | -0.37 (0.55 inferred) | -0.30 (0.55 inferred) | -0.11 (0.55 inferred) | 0.27 (0.35 inferred) |
| tension | — | 0.15 (0.58 derived) | — | — | — | — |
| intimacy | — | 0.04 (0.58 inferred) | — | — | — | — |
| warmth | — | 0.00 (0.58 inferred) | — | — | — | — |
| uncertainty | — | 0.04 (0.58 inferred) | — | — | — | — |
| expansiveness | — | 0.07 (0.58 inferred) | — | — | — | — |
| perceptualDensity | — | 0.45 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.05 (0.58 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.40 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.269 ms, mean confidence 0.14, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.184 ms, mean confidence 0.55, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped, low-lexicon-coverage.
- pert-emopair: 158.188 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 290.153 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.023 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 5090.894 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.53 (0.05, 0.58).
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.57 (0.01, 0.58).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.56 (0.02, 0.58).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.55 (0.04, 0.58).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.63 (-0.05, 0.58).
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.73 (0.23, 0.96).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.83 (0.14, 0.96).
- Disagreement on arousal: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.78 (0.18, 0.96).
- Disagreement on arousal: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.54 (0.42, 0.96).
- Disagreement on arousal: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.55 (0.41, 0.96).
- Disagreement on dominance: lexical-vad-v1 vs pert-emopair differ by 0.49 (0.12, -0.37).
- Disagreement on dominance: lexical-vad-v1 vs reward-emopair differ by 0.42 (0.12, -0.30).
- Disagreement on dominance: contextual-window-v1 vs pert-emopair differ by 0.37 (0.00, -0.37).
- Disagreement on dominance: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.64 (-0.37, 0.27).
- Disagreement on dominance: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.57 (-0.30, 0.27).
- Disagreement on dominance: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.38 (-0.11, 0.27).
- Teacher hosted-teacher: ok.

## eyre-will

Origin: rise-archive. Cases: prose, dialogue.
Archive: `src/content/archive/works/jane-eyre.js` · Jane Eyre · Charlotte Brontë.

> I am no bird; and no net ensnares me; I am a free human being with an independent will

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | 0.07 (0.25 inferred) | 0.18 (0.70 inferred) | 0.06 (0.55 inferred) | 0.06 (0.55 inferred) | 0.01 (0.55 inferred) | 0.98 (0.35 inferred) |
| arousal | 0.31 (0.25 inferred) | 0.18 (0.70 inferred) | 0.50 (0.55 inferred) | 0.76 (0.55 inferred) | 0.38 (0.55 inferred) | 0.97 (0.35 inferred) |
| dominance | 0.16 (0.25 inferred) | 0.31 (0.70 inferred) | 0.46 (0.55 inferred) | 0.97 (0.55 inferred) | 0.19 (0.55 inferred) | 0.96 (0.35 inferred) |
| tension | — | 0.20 (0.70 derived) | — | — | — | — |
| intimacy | — | 0.06 (0.70 inferred) | — | — | — | — |
| warmth | — | 0.04 (0.70 inferred) | — | — | — | — |
| uncertainty | — | 0.05 (0.70 inferred) | — | — | — | — |
| expansiveness | — | 0.05 (0.70 inferred) | — | — | — | — |
| perceptualDensity | — | 0.55 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.05 (0.70 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.41 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.069 ms, mean confidence 0.25, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.085 ms, mean confidence 0.65, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- pert-emopair: 129.650 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 318.680 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.022 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 4729.496 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.91 (0.07, 0.98).
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.80 (0.18, 0.98).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.92 (0.06, 0.98).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.92 (0.06, 0.98).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.97 (0.01, 0.98).
- Disagreement on arousal: lexical-vad-v1 vs reward-emopair differ by 0.45 (0.31, 0.76).
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.66 (0.31, 0.97).
- Disagreement on arousal: contextual-window-v1 vs reward-emopair differ by 0.58 (0.18, 0.76).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.79 (0.18, 0.97).
- Disagreement on arousal: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.47 (0.50, 0.97).
- Disagreement on arousal: reward-emopair vs minilm-l6-probe differ by 0.38 (0.76, 0.38).
- Disagreement on arousal: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.59 (0.38, 0.97).
- Disagreement on dominance: lexical-vad-v1 vs reward-emopair differ by 0.81 (0.16, 0.97).
- Disagreement on dominance: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.80 (0.16, 0.96).
- Disagreement on dominance: contextual-window-v1 vs reward-emopair differ by 0.66 (0.31, 0.97).
- Disagreement on dominance: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.65 (0.31, 0.96).
- Disagreement on dominance: pert-emopair vs reward-emopair differ by 0.51 (0.46, 0.97).
- Disagreement on dominance: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.50 (0.46, 0.96).
- Disagreement on dominance: reward-emopair vs minilm-l6-probe differ by 0.78 (0.97, 0.19).
- Disagreement on dominance: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.77 (0.19, 0.96).
- Teacher hosted-teacher: ok.

## dalloway-morning

Origin: rise-archive. Cases: prose, descriptive.
Archive: `src/content/archive/works/mrs-dalloway.js` · Mrs Dalloway · Virginia Woolf.

> Mrs. Dalloway said she would buy the flowers herself.

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | 0.45 (0.14 inferred) | 0.41 (0.26 inferred) | 0.03 (0.55 inferred) | 0.05 (0.55 inferred) | 0.03 (0.55 inferred) | 0.50 (0.35 inferred) |
| arousal | 0.25 (0.14 inferred) | 0.14 (0.26 inferred) | 0.04 (0.55 inferred) | 0.18 (0.55 inferred) | 0.36 (0.55 inferred) | 0.75 (0.35 inferred) |
| dominance | 0.00 (0.14 inferred) | — | -0.29 (0.55 inferred) | -0.28 (0.55 inferred) | 0.01 (0.55 inferred) | 0.25 (0.35 inferred) |
| tension | — | 0.07 (0.26 derived) | — | — | — | — |
| intimacy | — | 0.05 (0.26 inferred) | — | — | — | — |
| warmth | — | 0.35 (0.26 inferred) | — | — | — | — |
| uncertainty | — | — | — | — | — | — |
| expansiveness | — | 0.01 (0.26 inferred) | — | — | — | — |
| perceptualDensity | — | 0.48 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.04 (0.26 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.45 (0.26 derived) | — | — | — | — |

- lexical-vad-v1: 0.068 ms, mean confidence 0.14, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.089 ms, mean confidence 0.28, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped, low-lexicon-coverage.
- pert-emopair: 115.439 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 332.639 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.025 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 4512.518 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs pert-emopair differ by 0.42 (0.45, 0.03).
- Disagreement on valence: lexical-vad-v1 vs reward-emopair differ by 0.40 (0.45, 0.05).
- Disagreement on valence: lexical-vad-v1 vs minilm-l6-probe differ by 0.42 (0.45, 0.03).
- Disagreement on valence: contextual-window-v1 vs pert-emopair differ by 0.38 (0.41, 0.03).
- Disagreement on valence: contextual-window-v1 vs reward-emopair differ by 0.36 (0.41, 0.05).
- Disagreement on valence: contextual-window-v1 vs minilm-l6-probe differ by 0.39 (0.41, 0.03).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.47 (0.03, 0.50).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.45 (0.05, 0.50).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.47 (0.03, 0.50).
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.50 (0.25, 0.75).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.61 (0.14, 0.75).
- Disagreement on arousal: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.71 (0.04, 0.75).
- Disagreement on arousal: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.57 (0.18, 0.75).
- Disagreement on arousal: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.39 (0.36, 0.75).
- Disagreement on dominance: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.54 (-0.29, 0.25).
- Disagreement on dominance: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.53 (-0.28, 0.25).
- Teacher hosted-teacher: ok.

## paradise-woe

Origin: rise-archive. Cases: poetry, solemn.
Archive: `src/content/archive/works/paradise-lost.js` · Paradise Lost · John Milton.

> Of that forbidden Tree, whose mortal taste Brought death into the world, and all our woe, With loss of Eden

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | -0.48 (0.18 inferred) | -0.44 (0.56 inferred) | -0.31 (0.55 inferred) | -0.27 (0.55 inferred) | -0.12 (0.55 inferred) | -0.98 (0.35 inferred) |
| arousal | 0.28 (0.18 inferred) | 0.17 (0.56 inferred) | 0.58 (0.55 inferred) | 0.79 (0.55 inferred) | 0.49 (0.55 inferred) | 0.75 (0.35 inferred) |
| dominance | -0.17 (0.18 inferred) | -0.12 (0.56 inferred) | -0.36 (0.55 inferred) | -0.48 (0.55 inferred) | -0.36 (0.55 inferred) | -0.26 (0.35 inferred) |
| tension | — | 0.15 (0.56 derived) | — | — | — | — |
| intimacy | — | 0.02 (0.56 inferred) | — | — | — | — |
| warmth | — | -0.13 (0.56 inferred) | — | — | — | — |
| uncertainty | — | — | — | — | — | — |
| expansiveness | — | 0.08 (0.56 inferred) | — | — | — | — |
| perceptualDensity | — | 0.55 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.04 (0.56 inferred) | — | — | — | — |
| solemnity | — | 0.12 (0.56 inferred) | — | — | — | — |
| novelty | — | 0.45 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.082 ms, mean confidence 0.18, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.121 ms, mean confidence 0.53, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- pert-emopair: 128.600 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 306.644 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.024 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 4091.281 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs minilm-l6-probe differ by 0.36 (-0.48, -0.12).
- Disagreement on valence: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.49 (-0.48, -0.98).
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.54 (-0.44, -0.98).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.67 (-0.31, -0.98).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.71 (-0.27, -0.98).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.86 (-0.12, -0.98).
- Disagreement on arousal: lexical-vad-v1 vs reward-emopair differ by 0.51 (0.28, 0.79).
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.47 (0.28, 0.75).
- Disagreement on arousal: contextual-window-v1 vs pert-emopair differ by 0.42 (0.17, 0.58).
- Disagreement on arousal: contextual-window-v1 vs reward-emopair differ by 0.62 (0.17, 0.79).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.58 (0.17, 0.75).
- Disagreement on dominance: contextual-window-v1 vs reward-emopair differ by 0.36 (-0.12, -0.48).
- Teacher hosted-teacher: ok.

## comedy-dark

Origin: rise-archive. Cases: poetry, solemn.
Archive: `src/content/archive/works/the-divine-comedy.js` · The Divine Comedy · Dante Alighieri.

> Midway upon the journey of our life I found myself within a forest dark, For the straightforward pathway had been lost.

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | -0.21 (0.17 inferred) | -0.18 (0.54 inferred) | -0.10 (0.55 inferred) | -0.11 (0.55 inferred) | 0.02 (0.55 inferred) | 0.50 (0.35 inferred) |
| arousal | 0.23 (0.17 inferred) | 0.13 (0.54 inferred) | 0.43 (0.55 inferred) | 0.59 (0.55 inferred) | 0.40 (0.55 inferred) | 0.70 (0.35 inferred) |
| dominance | -0.11 (0.17 inferred) | -0.06 (0.54 inferred) | -0.59 (0.55 inferred) | -0.79 (0.55 inferred) | -0.17 (0.55 inferred) | 0.30 (0.35 inferred) |
| tension | — | 0.10 (0.54 derived) | — | — | — | — |
| intimacy | — | 0.05 (0.54 inferred) | — | — | — | — |
| warmth | — | -0.05 (0.54 inferred) | — | — | — | — |
| uncertainty | — | — | — | — | — | — |
| expansiveness | — | 0.07 (0.54 inferred) | — | — | — | — |
| perceptualDensity | — | 0.52 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.03 (0.54 inferred) | — | — | — | — |
| solemnity | — | 0.02 (0.54 inferred) | — | — | — | — |
| novelty | — | 0.45 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.088 ms, mean confidence 0.17, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.142 ms, mean confidence 0.51, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- pert-emopair: 129.815 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 298.279 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.024 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 4023.499 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.71 (-0.21, 0.50).
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.68 (-0.18, 0.50).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.60 (-0.10, 0.50).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.61 (-0.11, 0.50).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.48 (0.02, 0.50).
- Disagreement on arousal: lexical-vad-v1 vs reward-emopair differ by 0.36 (0.23, 0.59).
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.47 (0.23, 0.70).
- Disagreement on arousal: contextual-window-v1 vs reward-emopair differ by 0.46 (0.13, 0.59).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.57 (0.13, 0.70).
- Disagreement on dominance: lexical-vad-v1 vs pert-emopair differ by 0.48 (-0.11, -0.59).
- Disagreement on dominance: lexical-vad-v1 vs reward-emopair differ by 0.68 (-0.11, -0.79).
- Disagreement on dominance: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.41 (-0.11, 0.30).
- Disagreement on dominance: contextual-window-v1 vs pert-emopair differ by 0.53 (-0.06, -0.59).
- Disagreement on dominance: contextual-window-v1 vs reward-emopair differ by 0.73 (-0.06, -0.79).
- Disagreement on dominance: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.36 (-0.06, 0.30).
- Disagreement on dominance: pert-emopair vs minilm-l6-probe differ by 0.42 (-0.59, -0.17).
- Disagreement on dominance: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.89 (-0.59, 0.30).
- Disagreement on dominance: reward-emopair vs minilm-l6-probe differ by 0.62 (-0.79, -0.17).
- Disagreement on dominance: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.09 (-0.79, 0.30).
- Disagreement on dominance: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.47 (-0.17, 0.30).
- Teacher hosted-teacher: ok.

## blake-tyger

Origin: rise-archive. Cases: poetry, difficult.
Archive: `src/content/archive/works/literary-poems-blake.js` · Songs of Innocence and of Experience · William Blake.

> burning bright In the forests of the night, What immortal hand or eye Could frame thy fearful symmetry?

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | -0.09 (0.21 inferred) | -0.07 (0.68 inferred) | -0.02 (0.55 inferred) | -0.07 (0.55 inferred) | -0.11 (0.55 inferred) | 0.50 (0.35 inferred) |
| arousal | 0.40 (0.21 inferred) | 0.24 (0.68 inferred) | 0.57 (0.55 inferred) | 0.81 (0.55 inferred) | 0.41 (0.55 inferred) | 0.90 (0.35 inferred) |
| dominance | 0.02 (0.21 inferred) | 0.01 (0.68 inferred) | -0.47 (0.55 inferred) | -0.30 (0.55 inferred) | -0.32 (0.55 inferred) | -0.20 (0.35 inferred) |
| tension | — | 0.16 (0.68 derived) | — | — | — | — |
| intimacy | — | — | — | — | — | — |
| warmth | — | -0.02 (0.68 inferred) | — | — | — | — |
| uncertainty | — | 0.40 (0.68 inferred) | — | — | — | — |
| expansiveness | — | 0.11 (0.68 inferred) | — | — | — | — |
| perceptualDensity | — | 0.57 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.09 (0.68 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.45 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.135 ms, mean confidence 0.21, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.131 ms, mean confidence 0.62, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- pert-emopair: 123.114 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 304.250 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.025 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 4115.356 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.59 (-0.09, 0.50).
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.57 (-0.07, 0.50).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.52 (-0.02, 0.50).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.57 (-0.07, 0.50).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.61 (-0.11, 0.50).
- Disagreement on arousal: lexical-vad-v1 vs reward-emopair differ by 0.41 (0.40, 0.81).
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.50 (0.40, 0.90).
- Disagreement on arousal: contextual-window-v1 vs reward-emopair differ by 0.57 (0.24, 0.81).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.66 (0.24, 0.90).
- Disagreement on arousal: reward-emopair vs minilm-l6-probe differ by 0.40 (0.81, 0.41).
- Disagreement on arousal: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.49 (0.41, 0.90).
- Disagreement on dominance: lexical-vad-v1 vs pert-emopair differ by 0.49 (0.02, -0.47).
- Disagreement on dominance: contextual-window-v1 vs pert-emopair differ by 0.49 (0.01, -0.47).
- Teacher hosted-teacher: ok.

## whitman-celebrate

Origin: rise-archive. Cases: poetry, intimacy.
Archive: `src/content/archive/works/literary-leaves-of-grass.js` · Leaves of Grass · Walt Whitman.

> I celebrate myself, and sing myself, And what I assume you shall assume, For every atom belonging to me as good belongs to you.

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | 0.54 (0.15 inferred) | 0.49 (0.43 inferred) | 0.34 (0.55 inferred) | 0.31 (0.55 inferred) | -0.04 (0.55 inferred) | 0.99 (0.35 inferred) |
| arousal | 0.39 (0.15 inferred) | 0.23 (0.43 inferred) | 0.63 (0.55 inferred) | 0.86 (0.55 inferred) | 0.38 (0.55 inferred) | 0.96 (0.35 inferred) |
| dominance | 0.25 (0.15 inferred) | 0.22 (0.43 inferred) | 0.31 (0.55 inferred) | 0.68 (0.55 inferred) | 0.14 (0.55 inferred) | 0.93 (0.35 inferred) |
| tension | — | 0.12 (0.43 derived) | — | — | — | — |
| intimacy | — | 0.13 (0.43 inferred) | — | — | — | — |
| warmth | — | 0.39 (0.43 inferred) | — | — | — | — |
| uncertainty | — | — | — | — | — | — |
| expansiveness | — | 0.06 (0.43 inferred) | — | — | — | — |
| perceptualDensity | — | 0.43 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.06 (0.43 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.36 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.082 ms, mean confidence 0.15, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.099 ms, mean confidence 0.42, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- pert-emopair: 166.464 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 369.357 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.027 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 5266.762 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs minilm-l6-probe differ by 0.58 (0.54, -0.04).
- Disagreement on valence: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.45 (0.54, 0.99).
- Disagreement on valence: contextual-window-v1 vs minilm-l6-probe differ by 0.53 (0.49, -0.04).
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.50 (0.49, 0.99).
- Disagreement on valence: pert-emopair vs minilm-l6-probe differ by 0.38 (0.34, -0.04).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.64 (0.34, 0.99).
- Disagreement on valence: reward-emopair vs minilm-l6-probe differ by 0.35 (0.31, -0.04).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.67 (0.31, 0.99).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.03 (-0.04, 0.99).
- Disagreement on arousal: lexical-vad-v1 vs reward-emopair differ by 0.46 (0.39, 0.86).
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.57 (0.39, 0.96).
- Disagreement on arousal: contextual-window-v1 vs pert-emopair differ by 0.40 (0.23, 0.63).
- Disagreement on arousal: contextual-window-v1 vs reward-emopair differ by 0.63 (0.23, 0.86).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.73 (0.23, 0.96).
- Disagreement on arousal: reward-emopair vs minilm-l6-probe differ by 0.48 (0.86, 0.38).
- Disagreement on arousal: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.59 (0.38, 0.96).
- Disagreement on dominance: lexical-vad-v1 vs reward-emopair differ by 0.43 (0.25, 0.68).
- Disagreement on dominance: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.68 (0.25, 0.93).
- Disagreement on dominance: contextual-window-v1 vs reward-emopair differ by 0.46 (0.22, 0.68).
- Disagreement on dominance: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.71 (0.22, 0.93).
- Disagreement on dominance: pert-emopair vs reward-emopair differ by 0.37 (0.31, 0.68).
- Disagreement on dominance: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.62 (0.31, 0.93).
- Disagreement on dominance: reward-emopair vs minilm-l6-probe differ by 0.54 (0.68, 0.14).
- Disagreement on dominance: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.79 (0.14, 0.93).
- Teacher hosted-teacher: ok.

## heights-souls

Origin: rise-archive. Cases: prose, dialogue, intimacy.
Archive: `src/content/archive/works/wuthering-heights.js` · Wuthering Heights · Emily Brontë.

> Whatever our souls are made of, his and mine are the same

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | 0.15 (0.14 inferred) | 0.12 (0.26 inferred) | 0.09 (0.55 inferred) | 0.13 (0.55 inferred) | -0.00 (0.55 inferred) | 0.50 (0.35 inferred) |
| arousal | 0.25 (0.14 inferred) | 0.15 (0.26 inferred) | 0.33 (0.55 inferred) | 0.50 (0.55 inferred) | 0.53 (0.55 inferred) | 0.75 (0.35 inferred) |
| dominance | 0.05 (0.14 inferred) | 0.06 (0.26 inferred) | 0.26 (0.55 inferred) | 0.07 (0.55 inferred) | 0.08 (0.55 inferred) | 0.25 (0.35 inferred) |
| tension | — | 0.10 (0.26 derived) | — | — | — | — |
| intimacy | — | 0.10 (0.26 inferred) | — | — | — | — |
| warmth | — | 0.03 (0.26 inferred) | — | — | — | — |
| uncertainty | — | — | — | — | — | — |
| expansiveness | — | 0.03 (0.26 inferred) | — | — | — | — |
| perceptualDensity | — | 0.50 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.04 (0.26 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.45 (0.26 derived) | — | — | — | — |

- lexical-vad-v1: 0.055 ms, mean confidence 0.14, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.073 ms, mean confidence 0.28, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped, low-lexicon-coverage.
- pert-emopair: 152.083 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 302.058 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.019 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 4074.121 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.35 (0.15, 0.50).
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.38 (0.12, 0.50).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.41 (0.09, 0.50).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.37 (0.13, 0.50).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.50 (-0.00, 0.50).
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.50 (0.25, 0.75).
- Disagreement on arousal: contextual-window-v1 vs reward-emopair differ by 0.36 (0.15, 0.50).
- Disagreement on arousal: contextual-window-v1 vs minilm-l6-probe differ by 0.38 (0.15, 0.53).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.60 (0.15, 0.75).
- Disagreement on arousal: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.42 (0.33, 0.75).
- Teacher hosted-teacher: ok.

## spoon-hill

Origin: rise-archive. Cases: poetry, solemn.
Archive: `src/content/archive/works/spoon-river-anthology.js` · Spoon River Anthology · Edgar Lee Masters.

> Where are Elmer, Herman, Bert, Tom and Charley, The weak of will, the strong of arm, the clown, the boozer, the fighter? All, all are sleeping on the hill.

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | -0.04 (0.18 inferred) | -0.04 (0.64 inferred) | -0.02 (0.55 inferred) | -0.06 (0.55 inferred) | -0.15 (0.55 inferred) | 0.58 (0.35 inferred) |
| arousal | 0.31 (0.18 inferred) | 0.21 (0.64 inferred) | 0.43 (0.55 inferred) | 0.83 (0.55 inferred) | 0.46 (0.55 inferred) | 0.96 (0.35 inferred) |
| dominance | 0.07 (0.18 inferred) | 0.05 (0.64 inferred) | 0.08 (0.55 inferred) | 0.01 (0.55 inferred) | -0.11 (0.55 inferred) | 0.73 (0.35 inferred) |
| tension | — | 0.13 (0.64 derived) | — | — | — | — |
| intimacy | — | — | — | — | — | — |
| warmth | — | -0.01 (0.64 inferred) | — | — | — | — |
| uncertainty | — | 0.20 (0.64 inferred) | — | — | — | — |
| expansiveness | — | 0.04 (0.64 inferred) | — | — | — | — |
| perceptualDensity | — | 0.60 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.06 (0.64 inferred) | — | — | — | — |
| solemnity | — | 0.02 (0.64 inferred) | — | — | — | — |
| novelty | — | 0.45 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.088 ms, mean confidence 0.18, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.117 ms, mean confidence 0.59, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- pert-emopair: 184.379 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 300.626 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.018 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 4655.335 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.62 (-0.04, 0.58).
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.62 (-0.04, 0.58).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.60 (-0.02, 0.58).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.64 (-0.06, 0.58).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.73 (-0.15, 0.58).
- Disagreement on arousal: lexical-vad-v1 vs reward-emopair differ by 0.52 (0.31, 0.83).
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.66 (0.31, 0.96).
- Disagreement on arousal: contextual-window-v1 vs reward-emopair differ by 0.62 (0.21, 0.83).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.76 (0.21, 0.96).
- Disagreement on arousal: pert-emopair vs reward-emopair differ by 0.39 (0.43, 0.83).
- Disagreement on arousal: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.53 (0.43, 0.96).
- Disagreement on arousal: reward-emopair vs minilm-l6-probe differ by 0.36 (0.83, 0.46).
- Disagreement on arousal: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.50 (0.46, 0.96).
- Disagreement on dominance: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.66 (0.07, 0.73).
- Disagreement on dominance: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.67 (0.05, 0.73).
- Disagreement on dominance: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.65 (0.08, 0.73).
- Disagreement on dominance: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.72 (0.01, 0.73).
- Disagreement on dominance: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.84 (-0.11, 0.73).
- Teacher hosted-teacher: ok.

## tao-unnamed

Origin: rise-archive. Cases: scripture, ambiguity, difficult.
Archive: `src/content/archive/works/sacred-tao-te-ching.js` · Tao Te Ching · Laozi.

> The Tao that can be trodden is not the enduring and unchanging Tao. The name that can be named is not the enduring and unchanging name.

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | 0.03 (0.29 inferred) | -0.01 (0.70 inferred) | -0.03 (0.55 inferred) | -0.02 (0.55 inferred) | -0.02 (0.55 inferred) | 0.00 (0.35 inferred) |
| arousal | 0.09 (0.29 inferred) | 0.05 (0.70 inferred) | 0.27 (0.55 inferred) | 0.34 (0.55 inferred) | 0.36 (0.55 inferred) | 0.00 (0.35 inferred) |
| dominance | 0.09 (0.29 inferred) | -0.01 (0.70 inferred) | 0.44 (0.55 inferred) | 0.54 (0.55 inferred) | -0.11 (0.55 inferred) | 0.00 (0.35 inferred) |
| tension | — | 0.08 (0.70 derived) | — | — | — | — |
| intimacy | — | — | — | — | — | — |
| warmth | — | -0.00 (0.70 inferred) | — | — | — | — |
| uncertainty | — | 0.05 (0.70 inferred) | — | — | — | — |
| expansiveness | — | 0.09 (0.70 inferred) | — | — | — | — |
| perceptualDensity | — | 0.41 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.01 (0.70 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.26 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.113 ms, mean confidence 0.29, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.094 ms, mean confidence 0.64, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- pert-emopair: 170.478 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 296.255 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.016 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 3294.693 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on arousal: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.36 (0.36, 0.00).
- Disagreement on dominance: lexical-vad-v1 vs reward-emopair differ by 0.45 (0.09, 0.54).
- Disagreement on dominance: contextual-window-v1 vs pert-emopair differ by 0.44 (-0.01, 0.44).
- Disagreement on dominance: contextual-window-v1 vs reward-emopair differ by 0.55 (-0.01, 0.54).
- Disagreement on dominance: pert-emopair vs minilm-l6-probe differ by 0.55 (0.44, -0.11).
- Disagreement on dominance: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.44 (0.44, 0.00).
- Disagreement on dominance: reward-emopair vs minilm-l6-probe differ by 0.65 (0.54, -0.11).
- Disagreement on dominance: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.54 (0.54, 0.00).
- Teacher hosted-teacher: ok.

## hamlet-question

Origin: rise-archive. Cases: dialogue, difficult, uncertainty.
Archive: `src/content/archive/works/hamlet.js` · Hamlet · William Shakespeare.

> nobler in the mind to suffer The slings and arrows of outrageous fortune, Or to take arms against a sea of troubles, And by opposing end them

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | -0.15 (0.26 inferred) | -0.12 (0.70 inferred) | -0.09 (0.55 inferred) | -0.06 (0.55 inferred) | 0.08 (0.55 inferred) | 0.58 (0.35 inferred) |
| arousal | 0.39 (0.26 inferred) | 0.22 (0.70 inferred) | 0.54 (0.55 inferred) | 0.78 (0.55 inferred) | 0.52 (0.55 inferred) | 0.96 (0.35 inferred) |
| dominance | 0.06 (0.26 inferred) | 0.05 (0.70 inferred) | -0.16 (0.55 inferred) | -0.01 (0.55 inferred) | 0.03 (0.55 inferred) | 0.73 (0.35 inferred) |
| tension | — | 0.16 (0.70 derived) | — | — | — | — |
| intimacy | — | — | — | — | — | — |
| warmth | — | -0.03 (0.70 inferred) | — | — | — | — |
| uncertainty | — | — | — | — | — | — |
| expansiveness | — | 0.10 (0.70 inferred) | — | — | — | — |
| perceptualDensity | — | 0.60 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.06 (0.70 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.45 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.062 ms, mean confidence 0.26, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.111 ms, mean confidence 0.63, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- pert-emopair: 163.368 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 293.276 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.013 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 4678.041 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.73 (-0.15, 0.58).
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.70 (-0.12, 0.58).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.67 (-0.09, 0.58).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.64 (-0.06, 0.58).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.50 (0.08, 0.58).
- Disagreement on arousal: lexical-vad-v1 vs reward-emopair differ by 0.38 (0.39, 0.78).
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.57 (0.39, 0.96).
- Disagreement on arousal: contextual-window-v1 vs reward-emopair differ by 0.55 (0.22, 0.78).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.74 (0.22, 0.96).
- Disagreement on arousal: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.42 (0.54, 0.96).
- Disagreement on arousal: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.45 (0.52, 0.96).
- Disagreement on dominance: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.67 (0.06, 0.73).
- Disagreement on dominance: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.68 (0.05, 0.73).
- Disagreement on dominance: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.89 (-0.16, 0.73).
- Disagreement on dominance: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.73 (-0.01, 0.73).
- Disagreement on dominance: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.69 (0.03, 0.73).
- Teacher hosted-teacher: ok.

## crime-question

Origin: rise-archive. Cases: prose, tension.
Archive: `src/content/archive/works/crime-and-punishment.js` · Crime and Punishment · Fyodor Dostoevsky.

> fearful, frenzied and fantastic question, which tortured his heart and mind, clamouring insistently for an answer.

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | -0.21 (0.33 inferred) | -0.11 (0.70 inferred) | -0.14 (0.55 inferred) | -0.22 (0.55 inferred) | -0.04 (0.55 inferred) | -0.67 (0.35 inferred) |
| arousal | 0.51 (0.33 inferred) | 0.31 (0.70 inferred) | 0.82 (0.55 inferred) | 0.93 (0.55 inferred) | 0.42 (0.55 inferred) | 0.83 (0.35 inferred) |
| dominance | -0.07 (0.33 inferred) | -0.07 (0.70 inferred) | -0.56 (0.55 inferred) | -0.92 (0.55 inferred) | -0.06 (0.55 inferred) | -0.50 (0.35 inferred) |
| tension | — | 0.18 (0.70 derived) | — | — | — | — |
| intimacy | — | 0.07 (0.70 inferred) | — | — | — | — |
| warmth | — | 0.22 (0.70 inferred) | — | — | — | — |
| uncertainty | — | 0.03 (0.70 inferred) | — | — | — | — |
| expansiveness | — | 0.04 (0.70 inferred) | — | — | — | — |
| perceptualDensity | — | 0.68 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.10 (0.70 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.45 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.057 ms, mean confidence 0.33, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.082 ms, mean confidence 0.65, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- pert-emopair: 154.455 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 287.970 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.012 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 4229.099 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.46 (-0.21, -0.67).
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.56 (-0.11, -0.67).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.53 (-0.14, -0.67).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.45 (-0.22, -0.67).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.63 (-0.04, -0.67).
- Disagreement on arousal: lexical-vad-v1 vs reward-emopair differ by 0.41 (0.51, 0.93).
- Disagreement on arousal: contextual-window-v1 vs pert-emopair differ by 0.51 (0.31, 0.82).
- Disagreement on arousal: contextual-window-v1 vs reward-emopair differ by 0.62 (0.31, 0.93).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.52 (0.31, 0.83).
- Disagreement on arousal: pert-emopair vs minilm-l6-probe differ by 0.40 (0.82, 0.42).
- Disagreement on arousal: reward-emopair vs minilm-l6-probe differ by 0.51 (0.93, 0.42).
- Disagreement on arousal: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.41 (0.42, 0.83).
- Disagreement on dominance: lexical-vad-v1 vs pert-emopair differ by 0.48 (-0.07, -0.56).
- Disagreement on dominance: lexical-vad-v1 vs reward-emopair differ by 0.84 (-0.07, -0.92).
- Disagreement on dominance: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.43 (-0.07, -0.50).
- Disagreement on dominance: contextual-window-v1 vs pert-emopair differ by 0.49 (-0.07, -0.56).
- Disagreement on dominance: contextual-window-v1 vs reward-emopair differ by 0.85 (-0.07, -0.92).
- Disagreement on dominance: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.43 (-0.07, -0.50).
- Disagreement on dominance: pert-emopair vs reward-emopair differ by 0.36 (-0.56, -0.92).
- Disagreement on dominance: pert-emopair vs minilm-l6-probe differ by 0.50 (-0.56, -0.06).
- Disagreement on dominance: reward-emopair vs minilm-l6-probe differ by 0.86 (-0.92, -0.06).
- Disagreement on dominance: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.42 (-0.92, -0.50).
- Disagreement on dominance: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.44 (-0.06, -0.50).
- Teacher hosted-teacher: ok.

## doll-tricks

Origin: rise-archive. Cases: dialogue.
Archive: `src/content/archive/works/a-doll-s-house.js` · A Doll's House · Henrik Ibsen.

> I have existed merely to perform tricks for you, Torvald. But you would have it so.

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | -0.07 (0.17 inferred) | -0.06 (0.38 inferred) | 0.03 (0.55 inferred) | -0.12 (0.55 inferred) | 0.05 (0.55 inferred) | -0.50 (0.35 inferred) |
| arousal | 0.32 (0.17 inferred) | 0.20 (0.38 inferred) | 0.48 (0.55 inferred) | 0.69 (0.55 inferred) | 0.43 (0.55 inferred) | 0.70 (0.35 inferred) |
| dominance | -0.05 (0.17 inferred) | -0.03 (0.38 inferred) | 0.07 (0.55 inferred) | -0.02 (0.55 inferred) | -0.09 (0.55 inferred) | -0.30 (0.35 inferred) |
| tension | — | 0.17 (0.38 derived) | — | — | — | — |
| intimacy | — | 0.02 (0.38 inferred) | — | — | — | — |
| warmth | — | -0.01 (0.38 inferred) | — | — | — | — |
| uncertainty | — | 0.03 (0.38 inferred) | — | — | — | — |
| expansiveness | — | 0.02 (0.38 inferred) | — | — | — | — |
| perceptualDensity | — | 0.52 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.05 (0.38 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.49 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.050 ms, mean confidence 0.17, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.068 ms, mean confidence 0.38, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped, contrast-marker-present.
- pert-emopair: 152.365 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 289.856 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.017 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 3462.307 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.42 (-0.07, -0.50).
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.44 (-0.06, -0.50).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.53 (0.03, -0.50).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.38 (-0.12, -0.50).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.55 (0.05, -0.50).
- Disagreement on arousal: lexical-vad-v1 vs reward-emopair differ by 0.36 (0.32, 0.69).
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.38 (0.32, 0.70).
- Disagreement on arousal: contextual-window-v1 vs reward-emopair differ by 0.49 (0.20, 0.69).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.50 (0.20, 0.70).
- Disagreement on dominance: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.37 (0.07, -0.30).
- Teacher hosted-teacher: ok.

## epictetus-power

Origin: rise-archive. Cases: philosophy.
Archive: `src/content/archive/works/epictetus-encheiridion.js` · Encheiridion · Epictetus.

> you will find not one which is capable of contemplating itself

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | 0.08 (0.20 inferred) | 0.06 (0.42 inferred) | -0.04 (0.55 inferred) | -0.07 (0.55 inferred) | -0.06 (0.55 inferred) | -1.00 (0.35 inferred) |
| arousal | 0.20 (0.20 inferred) | 0.11 (0.42 inferred) | 0.16 (0.55 inferred) | 0.50 (0.55 inferred) | 0.40 (0.55 inferred) | 0.50 (0.35 inferred) |
| dominance | 0.28 (0.20 inferred) | 0.21 (0.42 inferred) | 0.28 (0.55 inferred) | 0.58 (0.55 inferred) | -0.12 (0.55 inferred) | -1.00 (0.35 inferred) |
| tension | — | 0.08 (0.42 derived) | — | — | — | — |
| intimacy | — | — | — | — | — | — |
| warmth | — | 0.02 (0.42 inferred) | — | — | — | — |
| uncertainty | — | — | — | — | — | — |
| expansiveness | — | 0.03 (0.42 inferred) | — | — | — | — |
| perceptualDensity | — | 0.53 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.03 (0.42 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.45 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.050 ms, mean confidence 0.20, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.064 ms, mean confidence 0.42, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- pert-emopair: 120.997 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 292.927 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.013 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 2907.553 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.07 (0.08, -1.00).
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.06 (0.06, -1.00).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.96 (-0.04, -1.00).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.93 (-0.07, -1.00).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.94 (-0.06, -1.00).
- Disagreement on arousal: contextual-window-v1 vs reward-emopair differ by 0.39 (0.11, 0.50).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.39 (0.11, 0.50).
- Disagreement on dominance: lexical-vad-v1 vs minilm-l6-probe differ by 0.39 (0.28, -0.12).
- Disagreement on dominance: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.27 (0.28, -1.00).
- Disagreement on dominance: contextual-window-v1 vs reward-emopair differ by 0.37 (0.21, 0.58).
- Disagreement on dominance: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.21 (0.21, -1.00).
- Disagreement on dominance: pert-emopair vs minilm-l6-probe differ by 0.40 (0.28, -0.12).
- Disagreement on dominance: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.28 (0.28, -1.00).
- Disagreement on dominance: reward-emopair vs minilm-l6-probe differ by 0.70 (0.58, -0.12).
- Disagreement on dominance: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.58 (0.58, -1.00).
- Disagreement on dominance: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.88 (-0.12, -1.00).
- Teacher hosted-teacher: ok.

## analects-learn

Origin: rise-archive. Cases: philosophy.
Archive: `src/content/archive/works/confucius-analects.js` · Analects · Confucius.

> Is it not pleasant to learn with a constant perseverance and application?

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | 0.33 (0.30 inferred) | -0.18 (0.70 inferred) | 0.23 (0.55 inferred) | 0.22 (0.55 inferred) | -0.08 (0.55 inferred) | 0.90 (0.35 inferred) |
| arousal | 0.26 (0.30 inferred) | 0.15 (0.70 inferred) | 0.40 (0.55 inferred) | 0.54 (0.55 inferred) | 0.28 (0.55 inferred) | 0.85 (0.35 inferred) |
| dominance | 0.21 (0.30 inferred) | 0.05 (0.70 inferred) | -0.04 (0.55 inferred) | 0.01 (0.55 inferred) | 0.01 (0.55 inferred) | 0.70 (0.35 inferred) |
| tension | — | 0.22 (0.70 derived) | — | — | — | — |
| intimacy | — | 0.00 (0.70 inferred) | — | — | — | — |
| warmth | — | -0.33 (0.70 inferred) | — | — | — | — |
| uncertainty | — | 0.45 (0.70 inferred) | — | — | — | — |
| expansiveness | — | 0.03 (0.70 inferred) | — | — | — | — |
| perceptualDensity | — | 0.63 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.04 (0.70 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.45 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.070 ms, mean confidence 0.30, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.069 ms, mean confidence 0.65, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- pert-emopair: 118.306 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 292.897 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.013 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 3928.177 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs contextual-window-v1 differ by 0.51 (0.33, -0.18).
- Disagreement on valence: lexical-vad-v1 vs minilm-l6-probe differ by 0.41 (0.33, -0.08).
- Disagreement on valence: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.57 (0.33, 0.90).
- Disagreement on valence: contextual-window-v1 vs pert-emopair differ by 0.41 (-0.18, 0.23).
- Disagreement on valence: contextual-window-v1 vs reward-emopair differ by 0.40 (-0.18, 0.22).
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.08 (-0.18, 0.90).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.67 (0.23, 0.90).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.68 (0.22, 0.90).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.98 (-0.08, 0.90).
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.59 (0.26, 0.85).
- Disagreement on arousal: contextual-window-v1 vs reward-emopair differ by 0.39 (0.15, 0.54).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.70 (0.15, 0.85).
- Disagreement on arousal: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.45 (0.40, 0.85).
- Disagreement on arousal: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.57 (0.28, 0.85).
- Disagreement on dominance: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.49 (0.21, 0.70).
- Disagreement on dominance: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.65 (0.05, 0.70).
- Disagreement on dominance: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.74 (-0.04, 0.70).
- Disagreement on dominance: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.69 (0.01, 0.70).
- Disagreement on dominance: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.69 (0.01, 0.70).
- Teacher hosted-teacher: ok.

## vitruvius-order

Origin: rise-archive. Cases: neutral, descriptive.
Archive: `src/content/archive/works/vitruvius-architecture.js` · On Architecture · Vitruvius.

> Architecture depends on Order (in Greek [Greek: taxis]), Arrangement (in Greek [Greek: diathesis]), Eurythmy, Symmetry, Propriety, and Economy

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | 0.06 (0.21 inferred) | 0.05 (0.67 inferred) | 0.02 (0.55 inferred) | 0.05 (0.55 inferred) | 0.05 (0.55 inferred) | 0.50 (0.35 inferred) |
| arousal | 0.10 (0.21 inferred) | 0.10 (0.67 inferred) | 0.08 (0.55 inferred) | 0.22 (0.55 inferred) | 0.16 (0.55 inferred) | 0.70 (0.35 inferred) |
| dominance | 0.17 (0.21 inferred) | 0.13 (0.67 inferred) | 0.09 (0.55 inferred) | 0.26 (0.55 inferred) | 0.02 (0.55 inferred) | 0.30 (0.35 inferred) |
| tension | — | 0.04 (0.67 derived) | — | — | — | — |
| intimacy | — | — | — | — | — | — |
| warmth | — | 0.01 (0.67 inferred) | — | — | — | — |
| uncertainty | — | — | — | — | — | — |
| expansiveness | — | 0.05 (0.67 inferred) | — | — | — | — |
| perceptualDensity | — | 0.54 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.02 (0.67 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.35 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.056 ms, mean confidence 0.21, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.077 ms, mean confidence 0.61, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- pert-emopair: 148.283 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 299.830 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.012 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 3806.834 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.43 (0.06, 0.50).
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.45 (0.05, 0.50).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.48 (0.02, 0.50).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.45 (0.05, 0.50).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.45 (0.05, 0.50).
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.60 (0.10, 0.70).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.60 (0.10, 0.70).
- Disagreement on arousal: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.62 (0.08, 0.70).
- Disagreement on arousal: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.48 (0.22, 0.70).
- Disagreement on arousal: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.54 (0.16, 0.70).
- Teacher hosted-teacher: ok.

## dow-balance

Origin: rise-archive. Cases: neutral, descriptive.
Archive: `src/content/archive/works/dow-composition.js` · Composition · Arthur Wesley Dow.

> balance of proportions, tone and color. A change in one member changes the whole.

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | 0.10 (0.23 inferred) | 0.08 (0.61 inferred) | 0.03 (0.55 inferred) | 0.03 (0.55 inferred) | 0.09 (0.55 inferred) | 0.50 (0.35 inferred) |
| arousal | 0.14 (0.23 inferred) | 0.09 (0.61 inferred) | 0.11 (0.55 inferred) | 0.21 (0.55 inferred) | 0.33 (0.55 inferred) | 0.75 (0.35 inferred) |
| dominance | 0.05 (0.23 inferred) | 0.04 (0.61 inferred) | 0.13 (0.55 inferred) | 0.17 (0.55 inferred) | 0.07 (0.55 inferred) | 0.25 (0.35 inferred) |
| tension | — | 0.06 (0.61 derived) | — | — | — | — |
| intimacy | — | — | — | — | — | — |
| warmth | — | 0.02 (0.61 inferred) | — | — | — | — |
| uncertainty | — | — | — | — | — | — |
| expansiveness | — | 0.02 (0.61 inferred) | — | — | — | — |
| perceptualDensity | — | 0.57 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.02 (0.61 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.45 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.049 ms, mean confidence 0.23, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.066 ms, mean confidence 0.57, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- pert-emopair: 124.909 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 287.799 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.012 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 4221.982 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.40 (0.10, 0.50).
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.42 (0.08, 0.50).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.47 (0.03, 0.50).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.47 (0.03, 0.50).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.41 (0.09, 0.50).
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.61 (0.14, 0.75).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.66 (0.09, 0.75).
- Disagreement on arousal: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.64 (0.11, 0.75).
- Disagreement on arousal: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.54 (0.21, 0.75).
- Disagreement on arousal: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.42 (0.33, 0.75).
- Teacher hosted-teacher: ok.

## gita-universe

Origin: rise-archive. Cases: scripture, scale.
Archive: `src/content/archive/works/extended-bhagavad-gita-full.js` · Bhagavad Gita · attributed to Vyasa.

> By Me the whole vast Universe of things Is spread abroad;--by Me, the Unmanifest!

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | 0.08 (0.18 inferred) | 0.07 (0.48 inferred) | 0.15 (0.55 inferred) | 0.11 (0.55 inferred) | -0.01 (0.55 inferred) | 0.98 (0.35 inferred) |
| arousal | 0.28 (0.18 inferred) | 0.42 (0.48 inferred) | 0.66 (0.55 inferred) | 0.80 (0.55 inferred) | 0.45 (0.55 inferred) | 0.98 (0.35 inferred) |
| dominance | 0.08 (0.18 inferred) | 0.07 (0.48 inferred) | 0.34 (0.55 inferred) | 0.69 (0.55 inferred) | 0.04 (0.55 inferred) | 0.98 (0.35 inferred) |
| tension | — | 0.12 (0.48 derived) | — | — | — | — |
| intimacy | — | 0.04 (0.48 inferred) | — | — | — | — |
| warmth | — | 0.02 (0.48 inferred) | — | — | — | — |
| uncertainty | — | 0.02 (0.48 inferred) | — | — | — | — |
| expansiveness | — | 0.26 (0.48 inferred) | — | — | — | — |
| perceptualDensity | — | 0.51 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.24 (0.48 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.40 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.053 ms, mean confidence 0.18, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.070 ms, mean confidence 0.46, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- pert-emopair: 132.621 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 288.536 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.011 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 4577.984 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.90 (0.08, 0.98).
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.92 (0.07, 0.98).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.84 (0.15, 0.98).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.87 (0.11, 0.98).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.99 (-0.01, 0.98).
- Disagreement on arousal: lexical-vad-v1 vs pert-emopair differ by 0.38 (0.28, 0.66).
- Disagreement on arousal: lexical-vad-v1 vs reward-emopair differ by 0.52 (0.28, 0.80).
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.69 (0.28, 0.98).
- Disagreement on arousal: contextual-window-v1 vs reward-emopair differ by 0.38 (0.42, 0.80).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.55 (0.42, 0.98).
- Disagreement on arousal: reward-emopair vs minilm-l6-probe differ by 0.36 (0.80, 0.45).
- Disagreement on arousal: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.53 (0.45, 0.98).
- Disagreement on dominance: lexical-vad-v1 vs reward-emopair differ by 0.61 (0.08, 0.69).
- Disagreement on dominance: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.90 (0.08, 0.98).
- Disagreement on dominance: contextual-window-v1 vs reward-emopair differ by 0.62 (0.07, 0.69).
- Disagreement on dominance: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.91 (0.07, 0.98).
- Disagreement on dominance: pert-emopair vs reward-emopair differ by 0.35 (0.34, 0.69).
- Disagreement on dominance: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.65 (0.34, 0.98).
- Disagreement on dominance: reward-emopair vs minilm-l6-probe differ by 0.65 (0.69, 0.04).
- Disagreement on dominance: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.94 (0.04, 0.98).
- Teacher hosted-teacher: ok.

## faustus-wrath

Origin: rise-archive. Cases: dialogue, tension.
Archive: `src/content/archive/works/the-tragical-history-of-doctor-faustus.js` · Doctor Faustus · Christopher Marlowe.

> heap God's heavy wrath upon thy head!

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | -0.70 (0.14 inferred) | -0.56 (0.25 inferred) | -0.20 (0.55 inferred) | -0.29 (0.55 inferred) | -0.03 (0.55 inferred) | -1.00 (0.35 inferred) |
| arousal | 0.86 (0.14 inferred) | 0.74 (0.25 inferred) | 0.78 (0.55 inferred) | 1.00 (0.55 inferred) | 0.53 (0.55 inferred) | 1.00 (0.35 inferred) |
| dominance | 0.35 (0.14 inferred) | 0.26 (0.25 inferred) | 0.45 (0.55 inferred) | 0.88 (0.55 inferred) | -0.05 (0.55 inferred) | -1.00 (0.35 inferred) |
| tension | — | 0.34 (0.25 derived) | — | — | — | — |
| intimacy | — | — | — | — | — | — |
| warmth | — | -0.14 (0.25 inferred) | — | — | — | — |
| uncertainty | — | — | — | — | — | — |
| expansiveness | — | 0.02 (0.25 inferred) | — | — | — | — |
| perceptualDensity | — | 0.51 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.33 (0.25 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.45 (0.25 derived) | — | — | — | — |

- lexical-vad-v1: 0.041 ms, mean confidence 0.14, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.062 ms, mean confidence 0.27, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped, low-lexicon-coverage.
- pert-emopair: 117.970 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 291.032 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.014 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 2599.970 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs pert-emopair differ by 0.50 (-0.70, -0.20).
- Disagreement on valence: lexical-vad-v1 vs reward-emopair differ by 0.41 (-0.70, -0.29).
- Disagreement on valence: lexical-vad-v1 vs minilm-l6-probe differ by 0.67 (-0.70, -0.03).
- Disagreement on valence: contextual-window-v1 vs pert-emopair differ by 0.36 (-0.56, -0.20).
- Disagreement on valence: contextual-window-v1 vs minilm-l6-probe differ by 0.53 (-0.56, -0.03).
- Disagreement on valence: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.44 (-0.56, -1.00).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.80 (-0.20, -1.00).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.71 (-0.29, -1.00).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.97 (-0.03, -1.00).
- Disagreement on arousal: reward-emopair vs minilm-l6-probe differ by 0.47 (1.00, 0.53).
- Disagreement on arousal: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.47 (0.53, 1.00).
- Disagreement on dominance: lexical-vad-v1 vs reward-emopair differ by 0.53 (0.35, 0.88).
- Disagreement on dominance: lexical-vad-v1 vs minilm-l6-probe differ by 0.40 (0.35, -0.05).
- Disagreement on dominance: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.35 (0.35, -1.00).
- Disagreement on dominance: contextual-window-v1 vs reward-emopair differ by 0.62 (0.26, 0.88).
- Disagreement on dominance: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.26 (0.26, -1.00).
- Disagreement on dominance: pert-emopair vs reward-emopair differ by 0.43 (0.45, 0.88).
- Disagreement on dominance: pert-emopair vs minilm-l6-probe differ by 0.50 (0.45, -0.05).
- Disagreement on dominance: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.45 (0.45, -1.00).
- Disagreement on dominance: reward-emopair vs minilm-l6-probe differ by 0.93 (0.88, -0.05).
- Disagreement on dominance: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.88 (0.88, -1.00).
- Disagreement on dominance: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.95 (-0.05, -1.00).
- Teacher hosted-teacher: ok.

## koan-difference

Origin: rise-archive. Cases: scripture, ambiguity, difficult.
Archive: `src/content/archive/works/sacred-zen-koans.js` · Zen koans · collected.

> Is there any difference between the teaching of the Patriarch and that of the Sutras, or not?

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | 0.05 (0.18 inferred) | 0.04 (0.40 inferred) | 0.01 (0.55 inferred) | 0.04 (0.55 inferred) | 0.06 (0.55 inferred) | 0.25 (0.35 inferred) |
| arousal | 0.17 (0.18 inferred) | 0.11 (0.40 inferred) | 0.16 (0.55 inferred) | 0.34 (0.55 inferred) | 0.18 (0.55 inferred) | 0.75 (0.35 inferred) |
| dominance | 0.07 (0.18 inferred) | 0.05 (0.40 inferred) | -0.30 (0.55 inferred) | -0.18 (0.55 inferred) | 0.12 (0.55 inferred) | 0.25 (0.35 inferred) |
| tension | — | 0.08 (0.40 derived) | — | — | — | — |
| intimacy | — | — | — | — | — | — |
| warmth | — | 0.01 (0.40 inferred) | — | — | — | — |
| uncertainty | — | 0.42 (0.40 inferred) | — | — | — | — |
| expansiveness | — | 0.04 (0.40 inferred) | — | — | — | — |
| perceptualDensity | — | 0.54 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.03 (0.40 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.45 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.053 ms, mean confidence 0.18, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.067 ms, mean confidence 0.40, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- pert-emopair: 125.873 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 282.717 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.012 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 4260.005 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.57 (0.17, 0.75).
- Disagreement on arousal: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.64 (0.11, 0.75).
- Disagreement on arousal: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.59 (0.16, 0.75).
- Disagreement on arousal: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.41 (0.34, 0.75).
- Disagreement on arousal: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.57 (0.18, 0.75).
- Disagreement on dominance: lexical-vad-v1 vs pert-emopair differ by 0.38 (0.07, -0.30).
- Disagreement on dominance: pert-emopair vs minilm-l6-probe differ by 0.42 (-0.30, 0.12).
- Disagreement on dominance: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.55 (-0.30, 0.25).
- Disagreement on dominance: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.43 (-0.18, 0.25).
- Teacher hosted-teacher: ok.

## probe-negation

Origin: constructed-probe. Cases: negation.

> I am not happy.

| dimension | lexical-vad-v1 | contextual-window-v1 | pert-emopair | reward-emopair | minilm-l6-probe | Qwen/Qwen2.5-1.5B-Instruct |
| --- | --- | --- | --- | --- | --- | --- |
| valence | 0.82 (0.23 inferred) | -0.76 (0.38 inferred) | -0.62 (0.55 inferred) | -0.31 (0.55 inferred) | 0.09 (0.55 inferred) | -1.00 (0.35 inferred) |
| arousal | 0.42 (0.23 inferred) | 0.23 (0.38 inferred) | 0.43 (0.55 inferred) | 0.64 (0.55 inferred) | 0.42 (0.55 inferred) | 0.00 (0.35 inferred) |
| dominance | 0.25 (0.23 inferred) | -0.15 (0.38 inferred) | -0.33 (0.55 inferred) | -0.53 (0.55 inferred) | 0.23 (0.55 inferred) | -1.00 (0.35 inferred) |
| tension | — | 0.39 (0.38 derived) | — | — | — | — |
| intimacy | — | 0.00 (0.38 inferred) | — | — | — | — |
| warmth | — | -0.69 (0.38 inferred) | — | — | — | — |
| uncertainty | — | 0.10 (0.38 inferred) | — | — | — | — |
| expansiveness | — | 0.01 (0.38 inferred) | — | — | — | — |
| perceptualDensity | — | 0.55 (0.45 derived) | — | — | — | — |
| motionEnergy | — | 0.06 (0.38 inferred) | — | — | — | — |
| solemnity | — | — | — | — | — | — |
| novelty | — | 0.45 (0.35 derived) | — | — | — | — |

- lexical-vad-v1: 0.036 ms, mean confidence 0.23, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.055 ms, mean confidence 0.38, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- pert-emopair: 110.237 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, pert-valence-emobank-arousal-operating-range, not-a-rise-human-norm.
- reward-emopair: 280.070 ms, mean confidence 0.55, parameters 355000000, trained true.
  Caveats: offline-checkpoint, vad-only, reward-valence-emobank-ad-published-norm, not-a-rise-human-norm.
- minilm-l6-probe: 0.012 ms, mean confidence 0.55, parameters 22700000, trained true.
  Caveats: leave-one-out-prediction, distilled-from-pert-emopair, vad-only, twenty-four-passages-leave-one-out.
- Qwen/Qwen2.5-1.5B-Instruct: 3114.247 ms, mean confidence 0.35, parameters 1500000000, trained false.
  Caveats: language-model-teacher, local-cpu-no-hosted-credential.
- Disagreement on valence: lexical-vad-v1 vs contextual-window-v1 differ by 1.58 (0.82, -0.76).
- Disagreement on valence: lexical-vad-v1 vs pert-emopair differ by 1.44 (0.82, -0.62).
- Disagreement on valence: lexical-vad-v1 vs reward-emopair differ by 1.13 (0.82, -0.31).
- Disagreement on valence: lexical-vad-v1 vs minilm-l6-probe differ by 0.73 (0.82, 0.09).
- Disagreement on valence: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.82 (0.82, -1.00).
- Disagreement on valence: contextual-window-v1 vs reward-emopair differ by 0.45 (-0.76, -0.31).
- Disagreement on valence: contextual-window-v1 vs minilm-l6-probe differ by 0.85 (-0.76, 0.09).
- Disagreement on valence: pert-emopair vs minilm-l6-probe differ by 0.71 (-0.62, 0.09).
- Disagreement on valence: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.38 (-0.62, -1.00).
- Disagreement on valence: reward-emopair vs minilm-l6-probe differ by 0.41 (-0.31, 0.09).
- Disagreement on valence: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.69 (-0.31, -1.00).
- Disagreement on valence: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.09 (0.09, -1.00).
- Disagreement on arousal: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.42 (0.42, 0.00).
- Disagreement on arousal: contextual-window-v1 vs reward-emopair differ by 0.40 (0.23, 0.64).
- Disagreement on arousal: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.43 (0.43, 0.00).
- Disagreement on arousal: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.64 (0.64, 0.00).
- Disagreement on arousal: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.42 (0.42, 0.00).
- Disagreement on dominance: lexical-vad-v1 vs contextual-window-v1 differ by 0.40 (0.25, -0.15).
- Disagreement on dominance: lexical-vad-v1 vs pert-emopair differ by 0.58 (0.25, -0.33).
- Disagreement on dominance: lexical-vad-v1 vs reward-emopair differ by 0.78 (0.25, -0.53).
- Disagreement on dominance: lexical-vad-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.25 (0.25, -1.00).
- Disagreement on dominance: contextual-window-v1 vs reward-emopair differ by 0.38 (-0.15, -0.53).
- Disagreement on dominance: contextual-window-v1 vs minilm-l6-probe differ by 0.38 (-0.15, 0.23).
- Disagreement on dominance: contextual-window-v1 vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.85 (-0.15, -1.00).
- Disagreement on dominance: pert-emopair vs minilm-l6-probe differ by 0.56 (-0.33, 0.23).
- Disagreement on dominance: pert-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.67 (-0.33, -1.00).
- Disagreement on dominance: reward-emopair vs minilm-l6-probe differ by 0.76 (-0.53, 0.23).
- Disagreement on dominance: reward-emopair vs Qwen/Qwen2.5-1.5B-Instruct differ by 0.47 (-0.53, -1.00).
- Disagreement on dominance: minilm-l6-probe vs Qwen/Qwen2.5-1.5B-Instruct differ by 1.23 (0.23, -1.00).
- Teacher hosted-teacher: ok.

## Models not executed


## Watched failure classes

Irony, ambiguity, and difficult literary cases are listed with their outputs above. A high confidence on those passages would be a claim this encoder is not entitled to make. The contextual model caps confidence at 0.7 because its readout is an unfitted prior.

## Footer

Passages: 24. Recorded disagreements: 386.
