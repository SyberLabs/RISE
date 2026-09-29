# RISE affect benchmark

Runnable models were executed on passages held in the RISE archive.
External models listed as unavailable were not run. Their published scores are not repeated here.

## meditations-temper

Origin: rise-archive. Cases: philosophy, prose.
Archive: `src/content/archive/works/literary-meditations.js` · Meditations · Marcus Aurelius.

> From my grandfather Verus I learned good morals and the government of my temper.

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | 0.18 (0.17 inferred) | 0.15 (0.46 inferred) |
| arousal | 0.26 (0.17 inferred) | 0.14 (0.46 inferred) |
| dominance | 0.15 (0.17 inferred) | 0.14 (0.46 inferred) |
| tension | — | 0.10 (0.46 derived) |
| intimacy | — | 0.07 (0.46 inferred) |
| warmth | — | 0.04 (0.46 inferred) |
| uncertainty | — | — |
| expansiveness | — | 0.03 (0.46 inferred) |
| perceptualDensity | — | 0.47 (0.45 derived) |
| motionEnergy | — | 0.04 (0.46 inferred) |
| solemnity | — | — |
| novelty | — | 0.41 (0.35 derived) |

- lexical-vad-v1: 0.807 ms, mean confidence 0.17, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.715 ms, mean confidence 0.45, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## dickinson-death

Origin: rise-archive. Cases: poetry, irony, difficult.
Archive: `src/content/archive/works/literary-poems-dickinson.js` · Poems · Emily Dickinson.

> Because I could not stop for Death, He kindly stopped for me; The carriage held but just ourselves And Immortality.

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | -0.02 (0.16 inferred) | 0.43 (0.45 inferred) |
| arousal | 0.21 (0.16 inferred) | 0.13 (0.45 inferred) |
| dominance | -0.02 (0.16 inferred) | 0.13 (0.45 inferred) |
| tension | — | 0.12 (0.45 derived) |
| intimacy | — | 0.16 (0.45 inferred) |
| warmth | — | 0.60 (0.45 inferred) |
| uncertainty | — | 0.05 (0.45 inferred) |
| expansiveness | — | 0.08 (0.45 inferred) |
| perceptualDensity | — | 0.53 (0.45 derived) |
| motionEnergy | — | 0.03 (0.45 inferred) |
| solemnity | — | 0.09 (0.45 inferred) |
| novelty | — | 0.47 (0.35 derived) |

- lexical-vad-v1: 0.235 ms, mean confidence 0.16, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.358 ms, mean confidence 0.44, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped, contrast-marker-present.
- Disagreement on valence: lexical-vad-v1 vs contextual-window-v1 differ by 0.46 (-0.02, 0.43).
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## austen-opening

Origin: rise-archive. Cases: prose, irony, difficult.
Archive: `src/content/archive/works/pride-and-prejudice.js` · Pride and Prejudice · Jane Austen.

> It is a truth universally acknowledged, that a single man in possession of a good fortune must be in want of a wife.

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | 0.11 (0.28 inferred) | 0.09 (0.70 inferred) |
| arousal | 0.21 (0.28 inferred) | 0.12 (0.70 inferred) |
| dominance | 0.15 (0.28 inferred) | 0.11 (0.70 inferred) |
| tension | — | 0.09 (0.70 derived) |
| intimacy | — | 0.01 (0.70 inferred) |
| warmth | — | 0.02 (0.70 inferred) |
| uncertainty | — | — |
| expansiveness | — | 0.09 (0.70 inferred) |
| perceptualDensity | — | 0.61 (0.45 derived) |
| motionEnergy | — | 0.03 (0.70 inferred) |
| solemnity | — | — |
| novelty | — | 0.45 (0.35 derived) |

- lexical-vad-v1: 0.146 ms, mean confidence 0.28, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.183 ms, mean confidence 0.64, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## ishmael-water

Origin: rise-archive. Cases: prose, descriptive.
Archive: `src/content/archive/works/moby-dick-or-the-whale.js` · Moby-Dick · Herman Melville.

> Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | 0.05 (0.14 inferred) | 0.01 (0.58 inferred) |
| arousal | 0.23 (0.14 inferred) | 0.14 (0.58 inferred) |
| dominance | 0.12 (0.14 inferred) | 0.00 (0.58 inferred) |
| tension | — | 0.15 (0.58 derived) |
| intimacy | — | 0.04 (0.58 inferred) |
| warmth | — | 0.00 (0.58 inferred) |
| uncertainty | — | 0.04 (0.58 inferred) |
| expansiveness | — | 0.07 (0.58 inferred) |
| perceptualDensity | — | 0.45 (0.45 derived) |
| motionEnergy | — | 0.05 (0.58 inferred) |
| solemnity | — | — |
| novelty | — | 0.40 (0.35 derived) |

- lexical-vad-v1: 0.297 ms, mean confidence 0.14, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.180 ms, mean confidence 0.55, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped, low-lexicon-coverage.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## eyre-will

Origin: rise-archive. Cases: prose, dialogue.
Archive: `src/content/archive/works/jane-eyre.js` · Jane Eyre · Charlotte Brontë.

> I am no bird; and no net ensnares me; I am a free human being with an independent will

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | 0.07 (0.25 inferred) | 0.18 (0.70 inferred) |
| arousal | 0.31 (0.25 inferred) | 0.18 (0.70 inferred) |
| dominance | 0.16 (0.25 inferred) | 0.31 (0.70 inferred) |
| tension | — | 0.20 (0.70 derived) |
| intimacy | — | 0.06 (0.70 inferred) |
| warmth | — | 0.04 (0.70 inferred) |
| uncertainty | — | 0.05 (0.70 inferred) |
| expansiveness | — | 0.05 (0.70 inferred) |
| perceptualDensity | — | 0.55 (0.45 derived) |
| motionEnergy | — | 0.05 (0.70 inferred) |
| solemnity | — | — |
| novelty | — | 0.41 (0.35 derived) |

- lexical-vad-v1: 0.415 ms, mean confidence 0.25, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.081 ms, mean confidence 0.65, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## dalloway-morning

Origin: rise-archive. Cases: prose, descriptive.
Archive: `src/content/archive/works/mrs-dalloway.js` · Mrs Dalloway · Virginia Woolf.

> Mrs. Dalloway said she would buy the flowers herself.

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | 0.45 (0.14 inferred) | 0.41 (0.26 inferred) |
| arousal | 0.25 (0.14 inferred) | 0.14 (0.26 inferred) |
| dominance | 0.00 (0.14 inferred) | — |
| tension | — | 0.07 (0.26 derived) |
| intimacy | — | 0.05 (0.26 inferred) |
| warmth | — | 0.35 (0.26 inferred) |
| uncertainty | — | — |
| expansiveness | — | 0.01 (0.26 inferred) |
| perceptualDensity | — | 0.48 (0.45 derived) |
| motionEnergy | — | 0.04 (0.26 inferred) |
| solemnity | — | — |
| novelty | — | 0.45 (0.26 derived) |

- lexical-vad-v1: 0.047 ms, mean confidence 0.14, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.053 ms, mean confidence 0.28, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped, low-lexicon-coverage.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## paradise-woe

Origin: rise-archive. Cases: poetry, solemn.
Archive: `src/content/archive/works/paradise-lost.js` · Paradise Lost · John Milton.

> Of that forbidden Tree, whose mortal taste Brought death into the world, and all our woe, With loss of Eden

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | -0.48 (0.18 inferred) | -0.44 (0.56 inferred) |
| arousal | 0.28 (0.18 inferred) | 0.17 (0.56 inferred) |
| dominance | -0.17 (0.18 inferred) | -0.12 (0.56 inferred) |
| tension | — | 0.15 (0.56 derived) |
| intimacy | — | 0.02 (0.56 inferred) |
| warmth | — | -0.13 (0.56 inferred) |
| uncertainty | — | — |
| expansiveness | — | 0.08 (0.56 inferred) |
| perceptualDensity | — | 0.55 (0.45 derived) |
| motionEnergy | — | 0.04 (0.56 inferred) |
| solemnity | — | 0.12 (0.56 inferred) |
| novelty | — | 0.45 (0.35 derived) |

- lexical-vad-v1: 0.039 ms, mean confidence 0.18, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.072 ms, mean confidence 0.53, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## comedy-dark

Origin: rise-archive. Cases: poetry, solemn.
Archive: `src/content/archive/works/the-divine-comedy.js` · The Divine Comedy · Dante Alighieri.

> Midway upon the journey of our life I found myself within a forest dark, For the straightforward pathway had been lost.

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | -0.21 (0.17 inferred) | -0.18 (0.54 inferred) |
| arousal | 0.23 (0.17 inferred) | 0.13 (0.54 inferred) |
| dominance | -0.11 (0.17 inferred) | -0.06 (0.54 inferred) |
| tension | — | 0.10 (0.54 derived) |
| intimacy | — | 0.05 (0.54 inferred) |
| warmth | — | -0.05 (0.54 inferred) |
| uncertainty | — | — |
| expansiveness | — | 0.07 (0.54 inferred) |
| perceptualDensity | — | 0.52 (0.45 derived) |
| motionEnergy | — | 0.03 (0.54 inferred) |
| solemnity | — | 0.02 (0.54 inferred) |
| novelty | — | 0.45 (0.35 derived) |

- lexical-vad-v1: 0.041 ms, mean confidence 0.17, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.072 ms, mean confidence 0.51, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## blake-tyger

Origin: rise-archive. Cases: poetry, difficult.
Archive: `src/content/archive/works/literary-poems-blake.js` · Songs of Innocence and of Experience · William Blake.

> burning bright In the forests of the night, What immortal hand or eye Could frame thy fearful symmetry?

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | -0.09 (0.21 inferred) | -0.07 (0.68 inferred) |
| arousal | 0.40 (0.21 inferred) | 0.24 (0.68 inferred) |
| dominance | 0.02 (0.21 inferred) | 0.01 (0.68 inferred) |
| tension | — | 0.16 (0.68 derived) |
| intimacy | — | — |
| warmth | — | -0.02 (0.68 inferred) |
| uncertainty | — | 0.40 (0.68 inferred) |
| expansiveness | — | 0.11 (0.68 inferred) |
| perceptualDensity | — | 0.57 (0.45 derived) |
| motionEnergy | — | 0.09 (0.68 inferred) |
| solemnity | — | — |
| novelty | — | 0.45 (0.35 derived) |

- lexical-vad-v1: 0.104 ms, mean confidence 0.21, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.077 ms, mean confidence 0.62, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## whitman-celebrate

Origin: rise-archive. Cases: poetry, intimacy.
Archive: `src/content/archive/works/literary-leaves-of-grass.js` · Leaves of Grass · Walt Whitman.

> I celebrate myself, and sing myself, And what I assume you shall assume, For every atom belonging to me as good belongs to you.

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | 0.54 (0.15 inferred) | 0.49 (0.43 inferred) |
| arousal | 0.39 (0.15 inferred) | 0.23 (0.43 inferred) |
| dominance | 0.25 (0.15 inferred) | 0.22 (0.43 inferred) |
| tension | — | 0.12 (0.43 derived) |
| intimacy | — | 0.13 (0.43 inferred) |
| warmth | — | 0.39 (0.43 inferred) |
| uncertainty | — | — |
| expansiveness | — | 0.06 (0.43 inferred) |
| perceptualDensity | — | 0.43 (0.45 derived) |
| motionEnergy | — | 0.06 (0.43 inferred) |
| solemnity | — | — |
| novelty | — | 0.36 (0.35 derived) |

- lexical-vad-v1: 0.050 ms, mean confidence 0.15, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.080 ms, mean confidence 0.42, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## heights-souls

Origin: rise-archive. Cases: prose, dialogue, intimacy.
Archive: `src/content/archive/works/wuthering-heights.js` · Wuthering Heights · Emily Brontë.

> Whatever our souls are made of, his and mine are the same

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | 0.15 (0.14 inferred) | 0.12 (0.26 inferred) |
| arousal | 0.25 (0.14 inferred) | 0.15 (0.26 inferred) |
| dominance | 0.05 (0.14 inferred) | 0.06 (0.26 inferred) |
| tension | — | 0.10 (0.26 derived) |
| intimacy | — | 0.10 (0.26 inferred) |
| warmth | — | 0.03 (0.26 inferred) |
| uncertainty | — | — |
| expansiveness | — | 0.03 (0.26 inferred) |
| perceptualDensity | — | 0.50 (0.45 derived) |
| motionEnergy | — | 0.04 (0.26 inferred) |
| solemnity | — | — |
| novelty | — | 0.45 (0.26 derived) |

- lexical-vad-v1: 0.028 ms, mean confidence 0.14, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.062 ms, mean confidence 0.28, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped, low-lexicon-coverage.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## spoon-hill

Origin: rise-archive. Cases: poetry, solemn.
Archive: `src/content/archive/works/spoon-river-anthology.js` · Spoon River Anthology · Edgar Lee Masters.

> Where are Elmer, Herman, Bert, Tom and Charley, The weak of will, the strong of arm, the clown, the boozer, the fighter? All, all are sleeping on the hill.

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | -0.04 (0.18 inferred) | -0.04 (0.64 inferred) |
| arousal | 0.31 (0.18 inferred) | 0.21 (0.64 inferred) |
| dominance | 0.07 (0.18 inferred) | 0.05 (0.64 inferred) |
| tension | — | 0.13 (0.64 derived) |
| intimacy | — | — |
| warmth | — | -0.01 (0.64 inferred) |
| uncertainty | — | 0.20 (0.64 inferred) |
| expansiveness | — | 0.04 (0.64 inferred) |
| perceptualDensity | — | 0.60 (0.45 derived) |
| motionEnergy | — | 0.06 (0.64 inferred) |
| solemnity | — | 0.02 (0.64 inferred) |
| novelty | — | 0.45 (0.35 derived) |

- lexical-vad-v1: 0.060 ms, mean confidence 0.18, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.122 ms, mean confidence 0.59, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## tao-unnamed

Origin: rise-archive. Cases: scripture, ambiguity, difficult.
Archive: `src/content/archive/works/sacred-tao-te-ching.js` · Tao Te Ching · Laozi.

> The Tao that can be trodden is not the enduring and unchanging Tao. The name that can be named is not the enduring and unchanging name.

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | 0.03 (0.29 inferred) | -0.01 (0.70 inferred) |
| arousal | 0.09 (0.29 inferred) | 0.05 (0.70 inferred) |
| dominance | 0.09 (0.29 inferred) | -0.01 (0.70 inferred) |
| tension | — | 0.08 (0.70 derived) |
| intimacy | — | — |
| warmth | — | -0.00 (0.70 inferred) |
| uncertainty | — | 0.05 (0.70 inferred) |
| expansiveness | — | 0.09 (0.70 inferred) |
| perceptualDensity | — | 0.41 (0.45 derived) |
| motionEnergy | — | 0.01 (0.70 inferred) |
| solemnity | — | — |
| novelty | — | 0.26 (0.35 derived) |

- lexical-vad-v1: 0.070 ms, mean confidence 0.29, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.137 ms, mean confidence 0.64, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## hamlet-question

Origin: rise-archive. Cases: dialogue, difficult, uncertainty.
Archive: `src/content/archive/works/hamlet.js` · Hamlet · William Shakespeare.

> nobler in the mind to suffer The slings and arrows of outrageous fortune, Or to take arms against a sea of troubles, And by opposing end them

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | -0.15 (0.26 inferred) | -0.12 (0.70 inferred) |
| arousal | 0.39 (0.26 inferred) | 0.22 (0.70 inferred) |
| dominance | 0.06 (0.26 inferred) | 0.05 (0.70 inferred) |
| tension | — | 0.16 (0.70 derived) |
| intimacy | — | — |
| warmth | — | -0.03 (0.70 inferred) |
| uncertainty | — | — |
| expansiveness | — | 0.10 (0.70 inferred) |
| perceptualDensity | — | 0.60 (0.45 derived) |
| motionEnergy | — | 0.06 (0.70 inferred) |
| solemnity | — | — |
| novelty | — | 0.45 (0.35 derived) |

- lexical-vad-v1: 0.070 ms, mean confidence 0.26, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.784 ms, mean confidence 0.63, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## crime-question

Origin: rise-archive. Cases: prose, tension.
Archive: `src/content/archive/works/crime-and-punishment.js` · Crime and Punishment · Fyodor Dostoevsky.

> fearful, frenzied and fantastic question, which tortured his heart and mind, clamouring insistently for an answer.

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | -0.21 (0.33 inferred) | -0.11 (0.70 inferred) |
| arousal | 0.51 (0.33 inferred) | 0.31 (0.70 inferred) |
| dominance | -0.07 (0.33 inferred) | -0.07 (0.70 inferred) |
| tension | — | 0.18 (0.70 derived) |
| intimacy | — | 0.07 (0.70 inferred) |
| warmth | — | 0.22 (0.70 inferred) |
| uncertainty | — | 0.03 (0.70 inferred) |
| expansiveness | — | 0.04 (0.70 inferred) |
| perceptualDensity | — | 0.68 (0.45 derived) |
| motionEnergy | — | 0.10 (0.70 inferred) |
| solemnity | — | — |
| novelty | — | 0.45 (0.35 derived) |

- lexical-vad-v1: 0.071 ms, mean confidence 0.33, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.144 ms, mean confidence 0.65, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## doll-tricks

Origin: rise-archive. Cases: dialogue.
Archive: `src/content/archive/works/a-doll-s-house.js` · A Doll's House · Henrik Ibsen.

> I have existed merely to perform tricks for you, Torvald. But you would have it so.

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | -0.07 (0.17 inferred) | -0.06 (0.38 inferred) |
| arousal | 0.32 (0.17 inferred) | 0.20 (0.38 inferred) |
| dominance | -0.05 (0.17 inferred) | -0.03 (0.38 inferred) |
| tension | — | 0.17 (0.38 derived) |
| intimacy | — | 0.02 (0.38 inferred) |
| warmth | — | -0.01 (0.38 inferred) |
| uncertainty | — | 0.03 (0.38 inferred) |
| expansiveness | — | 0.02 (0.38 inferred) |
| perceptualDensity | — | 0.52 (0.45 derived) |
| motionEnergy | — | 0.05 (0.38 inferred) |
| solemnity | — | — |
| novelty | — | 0.49 (0.35 derived) |

- lexical-vad-v1: 0.035 ms, mean confidence 0.17, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.061 ms, mean confidence 0.38, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped, contrast-marker-present.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## epictetus-power

Origin: rise-archive. Cases: philosophy.
Archive: `src/content/archive/works/epictetus-encheiridion.js` · Encheiridion · Epictetus.

> you will find not one which is capable of contemplating itself

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | 0.08 (0.20 inferred) | 0.06 (0.42 inferred) |
| arousal | 0.20 (0.20 inferred) | 0.11 (0.42 inferred) |
| dominance | 0.28 (0.20 inferred) | 0.21 (0.42 inferred) |
| tension | — | 0.08 (0.42 derived) |
| intimacy | — | — |
| warmth | — | 0.02 (0.42 inferred) |
| uncertainty | — | — |
| expansiveness | — | 0.03 (0.42 inferred) |
| perceptualDensity | — | 0.53 (0.45 derived) |
| motionEnergy | — | 0.03 (0.42 inferred) |
| solemnity | — | — |
| novelty | — | 0.45 (0.35 derived) |

- lexical-vad-v1: 0.024 ms, mean confidence 0.20, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.051 ms, mean confidence 0.42, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## analects-learn

Origin: rise-archive. Cases: philosophy.
Archive: `src/content/archive/works/confucius-analects.js` · Analects · Confucius.

> Is it not pleasant to learn with a constant perseverance and application?

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | 0.33 (0.30 inferred) | -0.18 (0.70 inferred) |
| arousal | 0.26 (0.30 inferred) | 0.15 (0.70 inferred) |
| dominance | 0.21 (0.30 inferred) | 0.05 (0.70 inferred) |
| tension | — | 0.22 (0.70 derived) |
| intimacy | — | 0.00 (0.70 inferred) |
| warmth | — | -0.33 (0.70 inferred) |
| uncertainty | — | 0.45 (0.70 inferred) |
| expansiveness | — | 0.03 (0.70 inferred) |
| perceptualDensity | — | 0.63 (0.45 derived) |
| motionEnergy | — | 0.04 (0.70 inferred) |
| solemnity | — | — |
| novelty | — | 0.45 (0.35 derived) |

- lexical-vad-v1: 0.027 ms, mean confidence 0.30, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.058 ms, mean confidence 0.65, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- Disagreement on valence: lexical-vad-v1 vs contextual-window-v1 differ by 0.51 (0.33, -0.18).
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## vitruvius-order

Origin: rise-archive. Cases: neutral, descriptive.
Archive: `src/content/archive/works/vitruvius-architecture.js` · On Architecture · Vitruvius.

> Architecture depends on Order (in Greek [Greek: taxis]), Arrangement (in Greek [Greek: diathesis]), Eurythmy, Symmetry, Propriety, and Economy

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | 0.06 (0.21 inferred) | 0.05 (0.67 inferred) |
| arousal | 0.10 (0.21 inferred) | 0.10 (0.67 inferred) |
| dominance | 0.17 (0.21 inferred) | 0.13 (0.67 inferred) |
| tension | — | 0.04 (0.67 derived) |
| intimacy | — | — |
| warmth | — | 0.01 (0.67 inferred) |
| uncertainty | — | — |
| expansiveness | — | 0.05 (0.67 inferred) |
| perceptualDensity | — | 0.54 (0.45 derived) |
| motionEnergy | — | 0.02 (0.67 inferred) |
| solemnity | — | — |
| novelty | — | 0.35 (0.35 derived) |

- lexical-vad-v1: 0.035 ms, mean confidence 0.21, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.067 ms, mean confidence 0.61, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## dow-balance

Origin: rise-archive. Cases: neutral, descriptive.
Archive: `src/content/archive/works/dow-composition.js` · Composition · Arthur Wesley Dow.

> balance of proportions, tone and color. A change in one member changes the whole.

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | 0.10 (0.23 inferred) | 0.08 (0.61 inferred) |
| arousal | 0.14 (0.23 inferred) | 0.09 (0.61 inferred) |
| dominance | 0.05 (0.23 inferred) | 0.04 (0.61 inferred) |
| tension | — | 0.06 (0.61 derived) |
| intimacy | — | — |
| warmth | — | 0.02 (0.61 inferred) |
| uncertainty | — | — |
| expansiveness | — | 0.02 (0.61 inferred) |
| perceptualDensity | — | 0.57 (0.45 derived) |
| motionEnergy | — | 0.02 (0.61 inferred) |
| solemnity | — | — |
| novelty | — | 0.45 (0.35 derived) |

- lexical-vad-v1: 0.026 ms, mean confidence 0.23, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.072 ms, mean confidence 0.57, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## gita-universe

Origin: rise-archive. Cases: scripture, scale.
Archive: `src/content/archive/works/extended-bhagavad-gita-full.js` · Bhagavad Gita · attributed to Vyasa.

> By Me the whole vast Universe of things Is spread abroad;--by Me, the Unmanifest!

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | 0.08 (0.18 inferred) | 0.07 (0.48 inferred) |
| arousal | 0.28 (0.18 inferred) | 0.42 (0.48 inferred) |
| dominance | 0.08 (0.18 inferred) | 0.07 (0.48 inferred) |
| tension | — | 0.12 (0.48 derived) |
| intimacy | — | 0.04 (0.48 inferred) |
| warmth | — | 0.02 (0.48 inferred) |
| uncertainty | — | 0.02 (0.48 inferred) |
| expansiveness | — | 0.26 (0.48 inferred) |
| perceptualDensity | — | 0.51 (0.45 derived) |
| motionEnergy | — | 0.24 (0.48 inferred) |
| solemnity | — | — |
| novelty | — | 0.40 (0.35 derived) |

- lexical-vad-v1: 0.031 ms, mean confidence 0.18, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.059 ms, mean confidence 0.46, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## faustus-wrath

Origin: rise-archive. Cases: dialogue, tension.
Archive: `src/content/archive/works/the-tragical-history-of-doctor-faustus.js` · Doctor Faustus · Christopher Marlowe.

> heap God's heavy wrath upon thy head!

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | -0.70 (0.14 inferred) | -0.56 (0.25 inferred) |
| arousal | 0.86 (0.14 inferred) | 0.74 (0.25 inferred) |
| dominance | 0.35 (0.14 inferred) | 0.26 (0.25 inferred) |
| tension | — | 0.34 (0.25 derived) |
| intimacy | — | — |
| warmth | — | -0.14 (0.25 inferred) |
| uncertainty | — | — |
| expansiveness | — | 0.02 (0.25 inferred) |
| perceptualDensity | — | 0.51 (0.45 derived) |
| motionEnergy | — | 0.33 (0.25 inferred) |
| solemnity | — | — |
| novelty | — | 0.45 (0.25 derived) |

- lexical-vad-v1: 0.021 ms, mean confidence 0.14, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.049 ms, mean confidence 0.27, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped, low-lexicon-coverage.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## koan-difference

Origin: rise-archive. Cases: scripture, ambiguity, difficult.
Archive: `src/content/archive/works/sacred-zen-koans.js` · Zen koans · collected.

> Is there any difference between the teaching of the Patriarch and that of the Sutras, or not?

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | 0.05 (0.18 inferred) | 0.04 (0.40 inferred) |
| arousal | 0.17 (0.18 inferred) | 0.11 (0.40 inferred) |
| dominance | 0.07 (0.18 inferred) | 0.05 (0.40 inferred) |
| tension | — | 0.08 (0.40 derived) |
| intimacy | — | — |
| warmth | — | 0.01 (0.40 inferred) |
| uncertainty | — | 0.42 (0.40 inferred) |
| expansiveness | — | 0.04 (0.40 inferred) |
| perceptualDensity | — | 0.54 (0.45 derived) |
| motionEnergy | — | 0.03 (0.40 inferred) |
| solemnity | — | — |
| novelty | — | 0.45 (0.35 derived) |

- lexical-vad-v1: 0.026 ms, mean confidence 0.18, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.054 ms, mean confidence 0.40, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- Disagreements: none at the 0.35 threshold on shared axes.
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## probe-negation

Origin: constructed-probe. Cases: negation.

> I am not happy.

| dimension | lexical-vad-v1 | contextual-window-v1 |
| --- | --- | --- |
| valence | 0.82 (0.23 inferred) | -0.76 (0.38 inferred) |
| arousal | 0.42 (0.23 inferred) | 0.23 (0.38 inferred) |
| dominance | 0.25 (0.23 inferred) | -0.15 (0.38 inferred) |
| tension | — | 0.39 (0.38 derived) |
| intimacy | — | 0.00 (0.38 inferred) |
| warmth | — | -0.69 (0.38 inferred) |
| uncertainty | — | 0.10 (0.38 inferred) |
| expansiveness | — | 0.01 (0.38 inferred) |
| perceptualDensity | — | 0.55 (0.45 derived) |
| motionEnergy | — | 0.06 (0.38 inferred) |
| solemnity | — | — |
| novelty | — | 0.45 (0.35 derived) |

- lexical-vad-v1: 0.018 ms, mean confidence 0.23, parameters 0, trained false.
  Caveats: weak-baseline, negation-ignored, bag-of-words.
- contextual-window-v1: 0.040 ms, mean confidence 0.38, parameters 40, trained false.
  Caveats: unfitted-linear-prior, confidence-capped.
- Disagreement on valence: lexical-vad-v1 vs contextual-window-v1 differ by 1.58 (0.82, -0.76).
- Disagreement on dominance: lexical-vad-v1 vs contextual-window-v1 differ by 0.40 (0.25, -0.15).
- Teacher hosted-teacher: unavailable. AFFECT_TEACHER_URL is unset. No hosted model was called.

## Models not executed

- emopair-family (external-candidate): No EmoPair checkpoint is vendored. Published scores were not copied in as RISE results.
- minilm-distillation (external-candidate): A MiniLM-class distillation was not trained. There is no human preference set here to supervise it, and author-invented targets were refused as labels.

## Watched failure classes

Irony, ambiguity, and difficult literary cases are listed with their outputs above. A high confidence on those passages would be a claim this encoder is not entitled to make. The contextual model caps confidence at 0.7 because its readout is an unfitted prior.

## Footer

Passages: 24. Recorded disagreements: 4.
