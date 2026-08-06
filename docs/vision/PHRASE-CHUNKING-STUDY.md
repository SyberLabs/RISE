# Phrase-mode chunking — the study

*Measured 2026-07-28 against the Literary corpus (8 works, 30 sequences,
658 text atoms) through the real chunker at 250 wpm. Reproduce with
`npm run study:chunking`.*

**This document proposes no change.** It establishes what phrase mode
does to real prose so that an experiment can be chosen from evidence.

---

## 0. The finding in one line

The reported symptom — clauses chopped as *"yada yada, and"* — is real,
but its stated mechanism is not. **Dangling tails are 1.4% of atoms. The
actual defects are orphan heads (30.9%) and fragments (17.9%), and both
come from one structural gap: the chunker has a ceiling but no floor.**

---

## 1. What was measured

| pattern | count | share | meaning |
|---|---:|---:|---|
| fragments (≤2 words) | 118 | **17.9%** | a whole screen for `"meddling,"` |
| orphan heads (begins with a connective) | 203 | **30.9%** | `"and its beauty,"` — the joint arrives before the thing joined |
| dangling tails (ends with a connective) | 9 | 1.4% | the reported shape; rare |
| below reading speed | 0 | 0.0% | **timing is not the problem** |

Length distribution: 4.1% one word, 13.8% two words, 42.6% three-to-four,
38.3% five-to-eight. Nothing exceeds the 16-word ceiling.

That last row matters: every atom is on screen long enough to read. The
durations are correct. **The units are wrong.**

---

## 2. Why it happens

`splitPhrases` (chunker.js) splits after every `, ; : — – |` and after a
sentence period. `splitLongChunk` then subdivides anything over
`MAX_CHUNK_WORDS = 16`.

So there is a **ceiling and no floor**. Nothing ever merges a short piece
back into its neighbour. A comma-separated list — which is *one thought*
— becomes one atom per item.

The clearest case, Marcus Aurelius:

```
"I shall encounter" → "meddling," → "ungrateful," → "violent,"
→ "treacherous," → "envious," → "unsociable people."
```

Seven screens for one sentence. Thoreau's is the same failure:

```
"of opinion" → "and prejudice" → "and tradition" → "and delusion"
→ "and appearance,"
```

The study counts these as **stutter runs** (3+ consecutive atoms of ≤3
words) and finds **30 of them** in 8 works. This is the reader's actual
experience of the bug, and it is why the complaint *felt* like chopped
clauses even though the tails measure clean.

---

## 3. What a floor would do (simulated, not implemented)

Greedily merge an atom into its predecessor while the result stays under
the existing 16-word ceiling:

| rule | atoms | fragments | stutter runs | cross-sentence merges |
|---|---:|---:|---:|---:|
| none (today) | 658 | 118 | 26 | — |
| floor 3 | 566 | 4 | 6 | 12 |
| floor 4 | 473 | 4 | 0 | **29** |
| floor 5 | 407 | 4 | 0 | 39 |

A naive floor fixes the stutter but introduces a **new** defect: it
merges across sentence ends, producing
`"unsociable people. But all of this arises"`. One sentence should not
share an atom with the next.

Blocking a merge when the previous piece already closed a sentence:

| rule | atoms | fragments | stutter runs | cross-sentence |
|---|---:|---:|---:|---:|
| floor 4, sentence-safe | 496 | 16 | 0 | **0** |
| floor 4, sentence-safe, absorb short tails | **415** | **3** | **0** | **0** |

The 16 residual fragments in the first row are all sentence-*final*, and
several are sentence tails rather than whole thoughts (`"and contained."`,
`"is unfathomable."`, `"of me."`) — orphaned because a backward-only
merge cannot rescue the last piece of a sentence. Allowing a piece to
absorb a short follower *within the same sentence* clears them.

The three survivors are one-word sentences and should stand alone.

**Net effect on the Marcus Aurelius passage:**

```
"Begin the morning by saying to yourself:"
"I shall encounter meddling,"
"ungrateful, violent, treacherous, envious,"
"unsociable people."
```

---

## 4. What this does NOT establish

- **Only the Literary corpus.** 8 works, heavy on aphorism and verse
  (Blake, Dickinson, Whitman). Scripture, the Atrium's philosophy, and
  the Vault's academic prose are unmeasured and may behave differently —
  verse in particular may *want* short atoms, and a floor could damage
  it. Line-break-driven splits were not separated from comma-driven ones.
- **No reader was asked.** Every number here is structural. Whether 415
  atoms reads better than 658 is a judgement the metrics cannot make;
  they can only say the strobe is gone.
- **Authored `|` markers must never be merged.** This was checked, and
  it is the study's most important qualification. The Vault's sequences —
  where Dr. Ackerman's papers carry hand-placed `|` boundaries — score
  **19.5% fragments and 38 stutter runs**, *worse* than the Literary
  corpus by the metrics above. But those atoms are short **by design**:

  ```
   5w  "This is a new approach"
   3w  "to writing songs"
   3w  "that requires minimal"
   4w  "to no musical training."
   2w  "reducing songwriting"
  ```

  That is the phrase-marked breath she asked for, and it reads correctly.
  A 4-word floor would merge these and destroy the authored phrasing.

  **The metrics therefore do not generalise.** They detect a defect in
  text split MECHANICALLY on punctuation; they misread deliberate
  phrasing as the same defect. Any implementation must distinguish an
  authored boundary from a derived one and leave the authored one alone —
  content authors, the runtime follows. Without that distinction a floor
  would improve the Literary corpus and damage the Vault.

---

## 5. Suggested next experiment

The Vault result above changes what the next step should be. A floor
cannot be applied unconditionally, so the first task is not the floor —
it is teaching the chunker **which boundaries it invented and which it
was given**. `splitPhrases` currently discards that: `|`, comma, and
newline all become the same anonymous split.

Order:

1. **Preserve boundary provenance.** Mark each phrase boundary as
   AUTHORED (`|`, and arguably a line break in verse) or DERIVED
   (punctuation the splitter chose). No behaviour change; this is the
   information the rest depends on.
2. **Re-run this study split by provenance**, and across the remaining
   corpora — scripture, the Atrium, and verse especially, since Blake
   and Dickinson may want short atoms the way the Vault does.
3. **Only then**, if derived boundaries still show the defect, implement
   the floor as a **post-pass over phrase atoms** — never a change to
   `splitPhrases` — such that:
   - the ceiling still governs (no atom over `MAX_CHUNK_WORDS`),
   - a sentence end is never crossed,
   - an AUTHORED boundary is never merged away,
   - and word/sentence/paragraph modes are untouched.

Step 1 is the real prerequisite, and it is worth doing regardless: the
three-layer law says content authors and the runtime follows, and right
now the runtime cannot tell the difference.

---

# Addendum — sentence mode, and the floor as built

*Measured 2026-07-31 against the three works of the War Journey — Book VI,
Iliad XXII, Guillemont — through the real chunker at 200 wpm.*

## 6. The Journey was never in phrase mode

The study above measured **phrase** mode. The War Journey ran **sentence**
mode, where the defect is different and worse.

Milton's sentences run ten lines. Sentence mode therefore almost never
reaches a period before `MAX_CHUNK_WORDS`, so `splitLongChunk` windows
the remainder by word count — and word count knows nothing about syntax.

| work | mode | atoms | fragments | dangling tails | stutter | median |
|---|---|---:|---:|---:|---:|---:|
| Paradise Lost VI | sentence | 776 | 7.7% | **71.6%** | 1 | 9 |
| | phrase | 1742 | 27.1% | 1.0% | **95** | 4 |
| Iliad XXII | sentence | 621 | 6.4% | **60.1%** | 2 | 9 |
| | phrase | 1004 | 24.8% | 9.9% | 18 | 5 |
| Guillemont | sentence | 633 | 9.8% | **41.2%** | 2 | 9 |
| | phrase | 1063 | 27.3% | 12.2% | 24 | 5 |

Dangling tails were 1.4% in the original study. In sentence mode they are
**71.6%**. What a reader met:

```
 6w  darkness in perpetual round Lodge and
 4w  dislodge by turns, which
 8w  makes through Heaven Grateful vicissitude, like day and
 5w  night; Light issues forth, and
```

Phrase mode alone is not the answer — it is the original defect at full
strength, 95 stutter runs in one book:

```
 5w  All night the dreadless Angel,
 1w  unpursued,
 7w  Through Heaven's wide champain held his way;
 2w  till Morn,
```

**Phrase mode gets the boundaries right and the lengths wrong. Sentence
mode gets neither.**

### A rejected fix, recorded

`splitLongChunk` splits *after* the connective —
`/(?<=\s(?:and|but|or|that|with|which))\s+/` — which is why the tails
dangle. Flipping the lookbehind to a lookahead was simulated: tails fall
70.0% → 5.4% and orphan heads rise 2.6% → 68.5%. It moves the defect
rather than fixing it, and the metric cannot say which shape reads
better. Not done.

## 7. The floor, implemented

Exactly §5's rule, and its three refusals:

| work | phrase | phrase + floor 5 |
|---|---|---|
| Paradise Lost VI | 1742 atoms, 27.1% frag, 95 stutter, median 4 | **968, 0.1%, 0, median 7** |
| Iliad XXII | 1004, 24.8%, 18, median 5 | **632, 0.3%, 0, median 8** |
| Guillemont | 1063, 27.3%, 24, median 5 | **680, 4.6%, 2, median 8** |

```
 5w  Lodge and dislodge by turns,
 6w  which makes through Heaven Grateful vicissitude,
 7w  like day and night; Light issues forth,
```

`applyPhraseFloor` (chunker.js) never crosses the ceiling, never crosses
a sentence end, and never touches a paragraph containing an authored `|`.
It runs per paragraph, so a running head such as `Book VI` cannot be
absorbed into the first line. Dialogue with `preserveSpeakerHead`
declines it outright — a speaker label is the strongest authored boundary
there is.

### It is OPT-IN, and that is the finding

Enabled globally, the floor rewrote the Atrium's pinned durations and
merged a stranded `SOCRATES:` that a test used as its control. That is
§4's warning arriving on schedule: **these metrics detect a defect in
text split mechanically on punctuation, and misread deliberate phrasing
as the same defect.**

So `phraseFloor` is a session flag. `WAR_JOURNEY` sets it; nothing else
does. Turning it on elsewhere is a per-corpus decision requiring the
measurement above, not a default anyone inherits.

## 7b. The floor, measured across the shelf — 2026-08-06

§7 ruled the floor opt-in and said turning it on elsewhere "is a
per-corpus decision requiring the measurement above". This is that
measurement, prompted by a reader's report that phrase lengths vary too
wildly — a single "with" alone beside a ten-word sentence.

**Method.** 24 works drawn from the 91 in the Archive by a seeded
shuffle (seed 20260806, reproducible), up to three divisions each so no
long book dominates. **Paired**: the same text under both conditions, so
every difference is the floor and nothing else. The metric is the
coefficient of variation (sd / mean), unitless and therefore comparable
across texts of different natural phrase length.

| measure (on − off) | mean | 95% CI | t | Cohen's d |
|---|---|---|---|---|
| coefficient of variation | **−0.227** | [−0.258, −0.196] | −14.30 | **−2.92** |
| % phrases ≤ 2 words | **−23.1 pts** | [−27.2, −19.1] | −11.22 | −2.29 |
| % ending on a connective | −0.78 pts | [−1.11, −0.45] | −4.61 | −0.94 |
| mean words per phrase | +2.53 | [2.22, 2.84] | +15.81 | +3.23 |

**Improved in 23 of 24 works.** The effect is not marginal: d = −2.92 is
roughly three standard deviations of the paired difference.

### The one work that worsened is not evidence against it

`the-ramayan-of-valmiki`, by 0.018. Its **verse is byte-identical under
both conditions** — checked by eye, canto by canto. The difference comes
entirely from its title pages and index. Verse protects itself here: the
floor never crosses a sentence end and only touches pieces under the
floor, and a verse line is usually neither.

(Two apparatus findings fell out of looking: the Ramayan serves a title
page and `a-hundred-verses-from-old-japan` serves an INDEX inside the
reading stream. That is a cleansing matter, not a chunking one.)

### And the recorded dialogue harm does not reproduce

§7's evidence was that the floor "merged a stranded `SOCRATES:` that a
test used as its control". Measured directly:

| | floor OFF | floor ON |
|---|---|---|
| dialogue, no profile | **3 stranded labels** | **0** |
| dialogue, `dialogue` profile | 0 | 0 — output byte-identical |

The floor **un-strands** a speaker label; it does not strand one. And
under the profile it is inert, because `preserveSpeakerHead` makes
`applyPhraseFloor` decline outright. What was harmed in 2026-07 was a
test's fixture, not a reader.

### What this justifies

A **`prose` chunk profile**, added here: it changes no text and carries
only the floor decision, because a profile is where a per-corpus ruling
lives and inventing a normalisation to justify the shape would be worse
than an honest no-op.

**It also makes a global default defensible**, which §7 did not have the
evidence to say. The cost is measured: 97 of 101 Atrium durations move,
mean 0.613%, max 1.780% — a re-pin, of the same size as two others made
on 2026-08-06. That remains a decision for the creator; the evidence for
it is now on the table rather than absent.

---

## 8. Still open

- §5 step 1 — **per-boundary provenance** through `splitPhrases`, which
  still treats `|`, `,` and a newline as the same anonymous split. The
  paragraph-level `|` check is a coarse stand-in for it.
- **Verse is not modelled at all.** Milton's line is a unit, and nothing
  in the chunker knows it. There is no verse chunk profile; the only
  profile is the Chapel's verse *sentinel* stripper, which is unrelated.
  A line-aware profile for poetry is the obvious next study, and it may
  beat the floor for verse outright.
- `splitPhrases` splits after `.` before a capital, but **not after `?`
  or `!`** — so `"Question? SOCRATES:"` is one piece. Pre-existing, and
  visible in the dialogue tests.
- The orphan-head metric misreads floored text: 42.6% of Book VI's atoms
  begin with a connective, but with 0.1% fragments those are clauses
  (`"which makes through Heaven Grateful vicissitude,"`), not orphans.
  The metric was built for 2-word fragments and should not be read
  without the fragment column beside it.
