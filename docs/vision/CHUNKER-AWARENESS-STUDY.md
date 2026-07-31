# Chunker awareness — the study

*Measured 2026-07-31 across twelve works of the Archive — verse, drama,
aphorism, essay, and four centuries of prose — through the real chunker
at 200 wpm, 120,000 characters per work. Reproduce with
`npm run study:awareness`.*

**This document proposes no change.** It tests two hypotheses so that a
design can be chosen from evidence rather than from intuition.

---

## 0. The findings in three lines

1. **Works separate strongly.** Semicolon density varies 81×, lines per
   sentence 19×, median sentence length 16×. A per-work profile is
   justified, and every discriminating feature is derivable from the
   text — none needs declaring.
2. **The floor is genre-blind, and two genres defeat it.** Drama is
   still 31% fragments after the floor; Milton falls to 0.1%. One
   constant cannot serve both.
3. **The interrupted subject is real, common, and a floor cannot fix
   it.** 1,365 instances in twelve works. The floor removes 557 of them
   — every one where the subject happened to be short — and **786
   survive that no floor of any size can reach.** This is the case for a
   grammatical layer, and it is the only finding here that a metric
   cannot solve.

---

## 1. Literary shape — is a per-work profile justified?

| work | genre | med sent | p95 | max | dispersion | comma % | semi % | lines/sent |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Paradise Lost | verse | 33 | 109 | 308 | 0.93 | **13.0** | 2.14 | **5.6** |
| Dickinson | verse | 15 | 39 | 112 | 0.83 | 10.5 | 1.79 | 1.7 |
| Hamlet | drama | **2** | 14 | 112 | **1.79** | 8.6 | 1.26 | 1.1 |
| Meditations | aphorism | 21 | 72 | 171 | 0.91 | 9.3 | 1.39 | **0.3** |
| Walden | essay | 23 | 68 | 234 | 0.82 | 8.4 | 0.81 | 0.3 |
| Pride and Prejudice | prose | 12 | 45 | 94 | 0.84 | 7.7 | 1.36 | 2.1 |
| Moby-Dick | prose | 18 | 52 | 151 | 0.83 | 8.3 | 1.28 | 2.0 |
| Karamazov | prose | 14 | 45 | 102 | 0.79 | 8.2 | 0.26 | 1.7 |
| Mrs Dalloway | modernist | 10 | 59 | 140 | 1.11 | 9.6 | **2.44** | 1.7 |
| Swann's Way | modernist | 22 | **105** | **304** | 1.07 | 7.8 | 0.70 | 3.1 |
| Ulysses | modernist | 6 | 21 | 76 | 0.83 | 7.5 | **0.03** | 1.1 |
| Storm of Steel | modern | 17 | 39 | 134 | **0.64** | **4.8** | 0.14 | 2.4 |

The separation is not subtle:

- **semicolons** 0.03% (Joyce) → 2.44% (Woolf) — **81×**
- **lines per sentence** 0.3 (Marcus) → 5.6 (Milton) — **19×**
- **median sentence** 2 (Hamlet) → 33 (Milton) — **16×**
- **commas** 4.8% (Jünger) → 13.0% (Milton) — **2.7×**
- **dispersion** 0.64 (Jünger) → 1.79 (Hamlet) — **2.8×**

Each is computable at ingest with no linguistic knowledge whatever.
**A literary profile does not need to be authored; it can be measured.**

### The Joyce hypothesis is not supported by this sample

The premise was that Joyce is extreme in sentence-length dispersion.
Measured, he is not: **median 6 words, dispersion 0.83** — statistically
the most ordinary prose in the table, and his semicolon density is the
lowest ever recorded here by a factor of five.

That is a sampling artefact and should be read as one. 120,000
characters of *Ulysses* is Telemachus through Proteus — dialogue and
interior monologue with conventional punctuation. **Penelope, the
episode that motivates the whole claim, is at the far end of the book
and was never sampled.** The correct conclusion is not "Joyce is
ordinary" but "*Ulysses* is not one prose, and a work-level profile
would be wrong for it."

That is itself a finding: the unit of a profile may be the **division**,
not the work. Milton's twelve books are consistent; Joyce's eighteen
episodes are deliberately not.

---

## 2. The floor is genre-blind

Phrase mode, floor off → on:

| work | atoms | median | fragments | stutter runs |
|---|---|---|---|---|
| Paradise Lost | 5173→2884 | 4→7 | 25.6%→**0.1%** | 215→**0** |
| Swann's Way | 3854→2423 | 5→8 | 26.9%→0.9% | 120→0 |
| Karamazov | 4299→2580 | 4→8 | 29.5%→1.2% | 163→1 |
| Mrs Dalloway | 4789→2689 | 4→7 | 34.8%→1.5% | 297→2 |
| Moby-Dick | 4223→2596 | 4→8 | 27.8%→1.5% | 133→3 |
| Storm of Steel | 4055→2582 | 5→8 | 25.3%→2.1% | 76→2 |
| Walden | 2986→2458 | 7→9 | 12.7%→3.0% | 37→0 |
| Pride and Prejudice | 4271→2634 | 4→7 | 30.3%→5.6% | 166→9 |
| Meditations | 3392→2670 | 6→8 | 16.5%→7.3% | 69→3 |
| Dickinson | 4056→2926 | 5→7 | 22.3%→**9.5%** | 126→11 |
| Ulysses | 5353→3168 | 3→6 | 41.6%→**10.1%** | 394→38 |
| **Hamlet** | 5271→3727 | 3→5 | 45.9%→**31.0%** | 413→**168** |

Nine works land under 3% fragments. Three do not, and they fail for
three different reasons:

- **Hamlet (31%)** — dramatic verse. Speaker names, half-lines shared
  between speakers, and stage directions are all short by design. A
  floor is fighting the form.
- **Ulysses (10.1%)** — interior monologue is deliberately fragmentary.
  Joyce's short pieces are the style.
- **Dickinson (9.5%)** — the compressed lyric. Her dashes are structural
  and her lines are the unit.

All three are the study's original warning in a new place: **the metrics
detect a defect in mechanically-split prose and misread deliberate
compression as the same defect.** A single floor constant cannot serve
Milton and Hamlet at once, which is the strongest available argument for
Literary Awareness — not elegance, but that one number demonstrably
cannot cover the corpus.

---

## 3. The interrupted subject — the linguistic defect

The pattern named in the design conversation:

> "I, who have seen things, believe that seeing is believing."

Counted here as **an atom ending on a comma whose successor opens with a
relative pronoun** — a subject severed from the clause qualifying it.
This needs no parser to *count*; it is a property of the boundary.

| | total | short subject | long subject |
|---|---:|---:|---:|
| floor off | 1365 | 700 | 665 |
| floor on | **808** | **22** | **786** |

"Short" means the subject falls under the 5-word floor, so a floor can
absorb it. "Long" means it clears the floor, so **no floor of any size
reaches it** — raising the floor only merges more elsewhere.

The worked example is exact:

```
short subject: I, who have seen things, believe that seeing is believing.
  floor off → ["I,", "who have seen things,", "believe that seeing is believing."]
  floor on  → ["I, who have seen things,", "believe that seeing is believing."]   ✓

long subject: The philosopher and teacher Socrates, who taught Plato in Athens,
              spoke of the examined life.
  floor off → ["The philosopher and teacher Socrates,", "who taught Plato in Athens,",
               "spoke of the examined life."]
  floor on  → ["The philosopher and teacher Socrates,", "who taught Plato in Athens,",
               "spoke of the examined life."]   ✗ unchanged
```

The subject is cut from `spoke` in both. The floor did not fail; it was
never able to succeed, because it reasons about **length** and the defect
is about **grammatical role**.

Note also that long-subject strands *rose* 665 → 786 with the floor on.
Merging a short subject into what precedes it produces a longer piece
that still ends before the relative pronoun. The floor does not remove
the pattern; it moves instances between size classes.

**This is the finding that justifies Linguistic Awareness.** Everything
else in this document could in principle be solved with better constants.
This cannot.

---

## 4. On "blind versus explicit", and on ML

The design tension is real but it rests on a premise worth checking:
that grammatical analysis must happen at reading time.

It does not. **The Archive is ingested offline by scripts.** Divisions
are already derived at ingest and shipped as
`src/content/archive/division-index.json`; the runtime consumes them and
does no division logic of its own.

Grammatical boundaries can take exactly the same path:

```
INGEST (Node, offline, unbounded)        RUNTIME (browser, bounded)
──────────────────────────────────       ─────────────────────────
full parser, any dependency size    →    chunker stays blind and fast
clause and constituent boundaries        honours precomputed boundaries
measured literary profile                reads the profile it was given
```

This dissolves the tension rather than resolving it:

- **Explicit grammar, offline.** Bundle size, parse latency and library
  weight stop being constraints. A dependency parser that would be
  unacceptable in the client is free at ingest.
- **Blind runtime.** `chunkText` stays synchronous, deterministic, and
  able to handle two million characters — which it must, because the
  Workshop chunks *user* text that was never ingested.
- **The three-layer law holds.** Content authors, the runtime follows. A
  parser at ingest is authoring; a parser at runtime would be the
  runtime making editorial decisions.
- **It composes with the existing gap.** The prior study's step 1 is
  boundary provenance — teaching `splitPhrases` which boundaries it
  invented and which it was given. A precomputed grammatical boundary is
  simply another AUTHORED boundary, arriving through the same door as
  Dr. Ackerman's `|`.

User text still needs *something*, and that is where the honest answer is
"a heuristic, and it will be worse." Ingested works get the good path;
pasted text gets the floor. That is an acceptable asymmetry and should be
stated rather than hidden.

### Where ML actually fits

- **Profile derivation — yes, and it is barely ML.** §1's features are
  cheap statistics, and clustering twelve-dimensional feature vectors
  into a handful of profiles is a few lines. This is the useful
  application and it can be done today.
- **Clause segmentation — a parser, not a model.** Dependency parsing is
  a solved, deterministic, inspectable technology. A learned model here
  would add nondeterminism and opacity to a component whose output must
  be reproducible across sessions, because visual programs are anchored
  to it.
- **A learned "where would a reader breathe" model — the interesting
  one, and premature.** It needs labelled data that does not exist. The
  honest first step is to *collect* it: the Workshop could record where
  authors manually place `|`, which would be exactly the corpus such a
  model would need. That is a reason to build the score editor first.

**Determinism is the hard constraint.** Chunking decides atom
boundaries; the Experience Program anchors to source spans precisely so
it survives them — but the reading itself must be the same reading twice.
Anything nondeterministic is disqualified regardless of quality.

---

## 5. What this does NOT establish

- **One sample per work, from the front.** 120,000 characters from the
  beginning of each. The Joyce result above shows how badly that can
  mislead. Any real profile work must sample across a work, and probably
  per division.
- **No reader was asked.** Every number is structural. That 2,884 atoms
  reads better than 5,173 is a judgement these metrics cannot make.
- **The interrupted-subject count is a proxy.** It catches relative
  pronouns and will miss bare appositives ("Socrates, the teacher,
  spoke") and participials ("Socrates, having spoken, left"). The true
  count is higher than 1,365, not lower.
- **Verse was measured but not modelled.** Milton scores 0.1% fragments
  with the floor, which looks like success — but nothing in the chunker
  knows a verse line exists, and the line may be the right unit for him
  regardless of what the fragment metric says. That is a separate study.
- **Translations are not the authors.** Karamazov's semicolon rate is
  Garnett's, not Dostoevsky's. Profiles derived from translated text
  describe an edition. For chunking purposes that is the correct object —
  it is what a reader reads — but it should not be called an author's
  style.

---

## 6. Suggested next experiment

In order, smallest first:

1. **Sample properly.** Re-run §1 across whole works, per division, and
   see whether divisions of one work cluster together. If *Ulysses*
   scatters and *Paradise Lost* does not, the profile's unit is settled
   by evidence.
2. **Boundary provenance** (the prior study's step 1, still unbuilt).
   Everything below depends on the chunker being able to tell a boundary
   it invented from one it was given.
3. **A verse profile.** Line-aware chunking for Milton, Dickinson and
   Hamlet, measured against the floor. This is the largest single win
   available and the least risky, because verse lines are already in the
   text.
4. **A parser at ingest, on one work.** Emit clause boundaries for
   Book VI alone, ship them as authored boundaries, and measure the
   interrupted-subject count against the 101 that survive there today.
   One work, one number, no runtime change.
5. **Only then** consider profile-driven constants, and only for
   features §1 shows to be discriminating.

Step 3 is worth doing regardless of everything else in this document.
