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

### It is OPT-IN, and that is the finding — **REVERSED 2026-08-06, see §7b**

> The section below is kept as written because the reasoning is still
> worth reading and the reversal is only legible beside it. Both of its
> harms were checked directly in §7b and neither survived: verse comes out
> **byte-identical**, and unprofiled dialogue goes from three stranded
> speaker labels to **none** — the floor un-strands a label rather than
> stranding one. What was damaged in 2026-07 was a test's fixture.


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

**The floor is now the default** (2026-08-06, Mateo). `chunkText` takes
`phraseFloor: true`, and the `prose` profile added that morning was
replaced by its inverse, **`verse`** — while the floor was opt-in the
useful statement was "floor this text"; now it is "leave this one alone",
and a profile asking for what everything already gets is a control that
does nothing. Precedence is **source → session → default**, written with
`??` rather than `||` because the whole point of the inversion is that
`false` must be sayable.

Nothing in the corpus has needed `verse` yet. That is stated rather than
fixed by applying it somewhere to look thorough: the measurement covered
24 works and the shelf holds 91.

### The cost, and the constant it moved

97 of 101 Atrium durations moved — mean 0.613%, max 1.780% — and were
re-pinned. Three point launches then fell under the three-minute
editorial floor.

**The floor was re-derived rather than widened**, and the distinction
matters. It had been widened by 1s that same morning with an attached
warning: *"if a future change puts several launches here, that is a
signal about the change and not an invitation to widen again."* By the
afternoon there were three, so the tolerance was removed instead of
grown.

The readings did not get shorter — **the estimate got honest.** A short
atom carries a minimum duration larger than its share of the word count,
and merging removes that padding along with the atom. The old bound was
measured against a compiler that inflated every list and every fragment.
Re-measured, the shelf spans 2.97m–6.88m with **words per minute flat at
~131 across all of it**: nothing became thin, and `seven-years-war` was
always the shortest text there at 371 words against a 544-word median.

**And the guard changed kind.** A duration floor was only ever a proxy
for "enough substance to be worth entering", and a bad one — it moves
whenever the chunker learns something, which was twice in one day. The
test now asserts on **words**, which do not move: no launch under 350,
set below the shortest on the shelf so it fails on a NEW thin launch
rather than re-litigating the existing three.

---

## 9. Verse, modelled — 2026-08-19

§8 said "verse is not modelled at all" and called a line-aware profile the
obvious next study. It was already half-built — `detectVerseLineation` and
`splitVerseLines` exist and the Journey path uses them — and the finding is
that **the Library never turned it on.**

Mateo read Tintern Abbey and saw it. What the shelf served:

```
  6w  Five years have passed; five summers,
  7w  with the length Of five long winters!
```

The capital `Of` mid-atom is the tell: it is the start of Wordsworth's second
line, glued to the tail of his first. The splitter cut at his commas and the
floor re-joined the pieces across his line ends — the floor doing damage
control on a problem it should not have had.

### Measured, paired, across the canon

Every section under both conditions, so every difference is the setting.

| | today | verse lines | Δ cv |
|---|---|---|---|
| Tintern Abbey | cv 0.310 | **0.172** | −0.138 |
| The Tables Turned | 0.519 | **0.220** | −0.299 |
| Iliad I | 0.293 | **0.175** | −0.117 |
| Paradise Lost I | 0.279 | **0.196** | −0.084 |
| Oedipus Rex | 0.318 | **0.233** | −0.085 |
| Middlemarch I | **0.399** | 0.598 | +0.200 |
| Ulysses 1 | **0.489** | 0.703 | +0.214 |
| Walden, Economy | **0.391** | 0.559 | +0.168 |

The split is total: **every verse section improves, every prose section is
badly damaged.** So the setting is not a default — it is a fact about a
particular reading, and something has to know it.

### The knowledge existed three times and never arrived

1. Standard Ebooks DECLARES it — `<span>…</span><br/>` inside a block.
2. Our ingest READS it — `isVerse`, `verseLines`, a per-part line count.
3. `detectVerseLineation` GUESSES it back at read time, from shape.

Step 2 threw it away: `sectionsFromParts` kept `{ name, content }` and dropped
the rest. That is the flatten-and-reconstruct this archive was rebuilt to
stop, running in the other direction — read, discarded, then inferred.

**The declaration is carried now.** A section says `verse: true` where the
edition's markup said so, `declaredScheme` passes it to the division entry,
and `scriptorium-resolve` sets `verseLines` from it. `detectVerseLineation`
remains, as the fallback for a source that declared nothing.

### Weighed in words, not lines

The first cut of this ratio counted verse lines against prose PARAGRAPHS,
which compares unlike things: a chapter of Middlemarch is one line per
paragraph, so an eight-line epigraph outvoted two thousand words of prose and
called the chapter verse. By words, agreement with the old heuristic is
**98.3% across 944 sections** — and every disagreement is verse the heuristic
structurally cannot see, because it needs eight lines and a Spoon River
epitaph or a chapter of the Tao Te Ching does not have them.

### And a defect the ingest was blind to

Storr sets Oedipus Rex as a table — `<td epub:type="z3998:persona">` beside
`<td epub:type="z3998:verse">` — so the verse markup sits one level BELOW the
cell. Asked of the cell, `isVerse` saw a lone `<p>` child and answered no. The
play arrived as 898 prose blocks, one of them **373 words long**, with
Sophocles' lineation gone and every word present, so word reconciliation had
nothing to say about it. Read down to the cell's blocks: **1,544 verse lines**
where there were none, at zero loss.

Text and line count now come from ONE descent, so they cannot disagree.

---

## 10. The instrument that was missing — 2026-08-19

Every metric this study owns scored Tintern Abbey as healthy. cv 0.310,
fragments 0.6%, stutter runs 0, dangling tails clean — and the reader met an
atom carrying the head of Wordsworth's next line. **The defect was found by a
person reading one poem**, which is the third time that has been true.

So the numbers are no longer asked to stand alone. `npm run sheet:chunks`
renders every reading on the shelf, atom by atom, in every mode, with the
metrics beside the page rather than in place of it. It is the chunker's
version of the Atrium's contact sheet, and for the same stated reason: no
automated metric replaces a human looking at the thing.

### The metric that was missing

**What share of atoms begin where a printed line begins?** No existing measure
asked it, and it is exactly what Tintern Abbey failed.

It must be asked BY POSITION, not by matching opening words. A short line is
carried forward deliberately — "Oedipus" onto what Oedipus then says — and
such an atom still begins where a line began. Comparing head words counted
every carry as a miss and scored a faithful Oedipus Rex at **70.7%**. Asked by
position it is **99.8%**. The first version of a metric was wrong about the
chunker, which is the failure mode this whole section exists to guard against.

### What the first run found

| reading | on a printed line |
|---|---|
| Inferno, Purgatorio, The Hill, Roy Butler, Expostulation | 100% |
| Oedipus Rex, Iliad I & XIII | 99% |
| Paradise Lost, Metamorphoses | 94–99% |
| **The Complaint of a Forsaken Indian Woman** | **80.7%** |

The outlier is real. Wordsworth prefaces the poem with a 152-word PROSE
headnote, and `splitVerseLines` returned a single-line paragraph straight to
the punctuation splitter **without the floor** — so inside a work declared as
verse, one paragraph was still getting the July 2026 behaviour:

```
  4w  When a Northern Indian,
  2w  from sickness,
  1w  food,
  2w  and fuel,
```

Fixed, with a test. Metamorphoses and Paradise Lost improved with it: their
prose arguments were losing the floor the same way. The residual 80.7% is the
headnote itself, which correctly does not sit on verse lines.

**A prose paragraph inside a verse reading is still prose.** The declaration
says what the reading mostly is, not what every paragraph of it is.

---

## 8. Still open

- §5 step 1 — **per-boundary provenance** through `splitPhrases`, which
  still treats `|`, `,` and a newline as the same anonymous split. The
  paragraph-level `|` check is a coarse stand-in for it.
- ~~**Verse is not modelled at all.**~~ **Answered in §9.** The line splitter
  already existed and the Library was not using it; it now runs from the
  edition's own declaration rather than from a heuristic. Still open within
  it: a stanza is not distinguished from a paragraph, and a run-on line
  (Milton's enjambment past the ceiling) still falls back to punctuation.
- `splitPhrases` splits after `.` before a capital, but **not after `?`
  or `!`** — so `"Question? SOCRATES:"` is one piece. Pre-existing, and
  visible in the dialogue tests.
- The orphan-head metric misreads floored text: 42.6% of Book VI's atoms
  begin with a connective, but with 0.1% fragments those are clauses
  (`"which makes through Heaven Grateful vicissitude,"`), not orphans.
  The metric was built for 2-word fragments and should not be read
  without the fragment column beside it.
