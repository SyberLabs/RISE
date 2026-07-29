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
