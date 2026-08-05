# Archive Cleansing — a scope

**Status:** proposed · not started · §2b decided 2026-08-04
**Scale:** 107 shelved works
**Prior art:** `scripts/audit-text-quality.mjs`, which already exists and already
knows this defect class.

---

## 1. The problem, stated from evidence

R.I.S.E. shelves texts it did not typeset. Scans carry an editorial apparatus,
and OCR folds that apparatus into the prose. Three findings, all real:

- **Hamlet was not Hamlet.** It was the Cambridge variorum, and the sigla came
  through as text: `140. at] Ff. om. Qq.` Withdrawn.
- **Three Shakespeares** withheld behind the same fault, still awaiting an
  edition decision.
- **Vitruvius, Book I** leaks marginalia one atom at a time: `ATHENS]`, `ROME]`,
  `Giocondo, Venice, 1511)]`. These are not merely ugly — the Page's heading
  heuristic promoted two of them into section headings before it was tightened,
  which is what damage does when nothing filters it.

- **Running heads mid-sentence — DECIDED: trim.** See §2b, which is the most
  actionable finding in this document and the one with the clearest evidence.

- **Stranded running heads**, found 2026-08-04 while fixing a division
  boundary. Romance of the Three Kingdoms ends chapter CV with
  `DEFEAT AND DEATH OF KUNGSUN YUAN; PRETENDED ILLNESS OF SSUMA I` — the
  title of chapter CVI, which then opens correctly with its own
  `CHAPTER CVI. / Defeat and Death of Kungsun Yüan; Pretended Illness of
  Ssŭma I.` So a reading finishes by announcing the next one, and the
  announcement is **duplicated verbatim** at the head of that next one.

- **The Mahabharata is partly the First World War.** Found 2026-08-04 by the
  reviewer's first adversarial batch. Its last five "volumes" are the *New York
  Times Current History of the European War* (1915) — Kipling, Alfred Noyes,
  Sir John French's dispatches, the Battle of the Suez Canal. See §1b. This is
  the Hamlet fault again, and it is on the shelf right now.

The rule this scope serves: **no such text in any book.**

---

## 1b. The Mahabharata — wrong work, in part

**Status: found, measured, NOT fixed.** The disposition is `re-source`, which
per §7.3 requires a human. Recorded here with its evidence so the decision can
be made rather than rediscovered.

### The measurement

| volumes | sections | words | Mahābhārata proper nouns | war vocabulary |
|---|---|---|---|---|
| 1–4 | 1,901 | 2,550,173 | **17,583** | 10 |
| 5–9 | 8 | **403,208** | **0** | 894 |

Zero. Across four hundred thousand words presented as the Mahābhārata, not one
occurrence of Bharata, Kuru, Pandava, Arjuna, Krishna, Yudhishthira, Parva,
Rishi or Brahmana. What is there instead:

> `CHAPTER I. / THE FRENCH SETBACKS IN AUGUST.`
> `PART I. / THE CONDUCT OF THE GERMAN TROOPS IN BELGIUM.`
> `MUSIC OF WAR — By Rudyard Kipling`

That is **13.7% of the work**, and because those volumes were never divided,
"Volume 5 — Front matter" is a single reading of 115,312 words. A reader
entering there is handed a 1915 war periodical labelled as Vyasa.

### The cause

The provenance record declares nine artifacts, `#15474`–`#15482`, each labelled
"Project Gutenberg Ganguli volume N". **The ingest assumed a contiguous
identifier range.** Ganguli's Mahābhārata occupies `#15474`–`#15477`; what
follows in Gutenberg's numbering is a different work entirely. The labels are
the ingest's own assertion, not something read back from the files — so the
dossier says "Ganguli volume 5" about a text that says "Kaiser".

### Why nothing caught it

`identity.test.js` asks whether **a work names itself in its own pages**, and
the Mahābhārata does, seventeen thousand times, in volumes 1–4. The check is
made of the WORK and the reading is served at the **DIVISION**. A work can pass
its identity test while five of its divisions are a different book.

**The guard this suggests** — and it is cheap, because the signal is not subtle:
no division may be *devoid* of the vocabulary its work is dense in. Volumes 5–9
score zero against a corpus averaging one proper noun per 145 words. A
per-division identity check is rung 2 of §3 in its simplest possible form.

### Scope, checked rather than assumed

Eight shelved works are built from multiple artifacts; only two assume a
sequential identifier range. The other is Le Morte d'Arthur (`#1251`–`#1252`),
and both its volumes are genuinely Arthurian — 4,893 and 5,464 hits. **This is
one work, not a class.**

### The options, for the human this waits on

1. **Trim volumes 5–9** and keep the 2.55M words of genuine Ganguli. The
   deletion is well-evidenced and leaves the work honest but incomplete — and
   the dossier must then say the edition is volumes 1–4.
2. **Re-source** the true remaining volumes and keep the work whole. Correct,
   and it is an acquisition, not an edit.
3. **Withhold** entirely. Disproportionate: four volumes are sound.

The recommendation is **2, with 1 as the interim** — a shelf should not serve
the First World War as the Mahābhārata while an acquisition is pending.

---

## 2. Defect classes

Naming them is most of the work, because each has a different detector and a
different disposition.

| class | signature | example |
|---|---|---|
| **Apparatus** | sigla, collation, variant lists | `140. at] Ff. om. Qq.` |
| **Orphaned brackets** | unbalanced `] ) }` in short lines | `ATHENS]` |
| **Marginalia** | short all-caps scraps between paragraphs | `ROME]` |
| **Imprint fragments** | printer, city, year, loose from a title page | `Giocondo, Venice, 1511)]` |
| **Front/back matter** | contents, index, colophon, transcriber's notes | *(detector shipped)* |
| **Running heads** | a page header repeated every N paragraphs | `GUILLEMONT 101` — **decided, see §2b** |
| **Page furniture** | bare numerals, catchwords, signature marks | `[Pg 41]`, `iv` |
| **OCR corruption** | impossible letter runs, mojibake, broken ligatures | `tlie`, `Ã©` |
| **Wrong work entirely** | the identity fault | *(detector shipped)* |

The last two rows already have machinery: `identity.test.js` proves a work names
itself in its own pages, and `divisions.js` drops contents pages. Everything
above them is open.

---

## 2b. Running heads — the first trim, specified

**Decided 2026-08-04, on Mateo's call: remove them.** This section exists
because the class earns a decision the others do not yet have, and because it
is the one place where deletion is provably safe rather than merely reasonable.

### What it is

A reader met this on the Page and read it, correctly, as a visual glitch:

> …the men were standing, rifle in hand, their eyes fixed on the ground in front
> of them. **Now and**
> **GUILLEMONT 101**
> **then** by the light of a rocket I saw the gleam of helmet after helmet…

`GUILLEMONT 101` is not a heading, a title, or a seam between movements. It is
the **running head of the printed page** — the chapter name and the recto page
number — and OCR left it wherever the physical page turned, which is normally
mid-clause. The Storm of Steel carries the sequence 93, 95, 97, 99, 101 … 109.

The raw span in the payload shows both halves of the furniture, the verso
numeral and the recto head:

```
…One could see that the man had been \n\n92 \n\n\nGUILLEMONT 93 \n\n\nthrough horror to the limit of despair…
```

Delete the whole span and the sentence is *restored*, not edited:
"…the man had been through horror to the limit of despair…". That is the test
this disposition must meet.

### Scale, measured rather than assumed

Swept over all shelved payloads, 2026-08-04:

| | count |
|---|---|
| works carrying repeated running heads | **6** |
| running heads total | **1,869** |
| …of which land **mid-sentence** | **293** |
| bare numeral lines (page furniture) | 4,531 |

The heaviest carriers are the Shahnama (1,172 — `KAI KHUSRAU`×220,
`GUSHTASP`×124), the Corpus Hermeticum (500), and the Storm of Steel (139, of
which **110 are mid-sentence** — the worst ratio on the shelf, which is why it
surfaced first).

### The rule, and why only part of it is safe

> **Trim a running head only where its POSITION proves it is furniture.**

This is the same evidence canon R11 uses to refuse promoting one to a heading,
applied one layer down to the text itself. A line qualifies when **all** hold:

1. It is a short line of capitals ending in an arabic number, and its
   capitalised stem **repeats** three or more times across the work with
   *different* numbers.
2. The preceding non-empty line does **not** end a sentence.
3. The following non-empty line **resumes in lower case**.

Conditions 2 and 3 are what make this a deletion rather than a guess. **The
other 1,576 occurrences are suspicions, not verdicts**, and go to a reviewer —
because a repeated capitalised stem followed by a number is *also* exactly the
shape of a legitimate division heading. The sweep found `BOOK`×18 in the
Mahabharata and `CH. III. INTRODUCTION.`×5 in the I Ching, and a rule that
trimmed those would delete the work's own structure. That is the entire reason
this section is narrow.

**Bare numerals are explicitly NOT in scope for automatic trimming.** 4,531 of
them exist and many are the work's own structure — a hundred verses from Old
Japan numbers its poems, King Lear's scan numbers its lines. Only a bare
numeral *inside* a qualifying furniture span (the `92` above, adjacent to the
head it belongs with) is removed, and only as part of that span.

### The span, and the sentence

**The span is the whole furniture run, not the head alone.** A printed opening
leaves *both* numbers behind — the verso page number and then the recto running
head:

```
…set up an observation post. \n130\n\n\nIN THE VILLAGE OF FRESNOY 131\n\n\nI took a few men…
```

Spanning only `IN THE VILLAGE OF FRESNOY 131` deletes half the furniture and
leaves a naked `130` standing in the prose, which looks exactly as broken as
leaving all of it. The span therefore runs **from the end of the last real line
of text to the start of the next one**, swallowing the blank lines and any
adjacent bare numeral.

*Found by the reviewer.* The first job builder spanned the head alone; the
reviewer refused five of thirty with `span: "too_small"` and was right. This
section had already said the numeral belongs in the span and the code had not.
That is the span mechanism paying for itself on its first batch.

**What replaces the span depends on whether a sentence was interrupted.**

- The preceding text does **not** end a sentence → replace with a single space,
  so the clause rejoins.
- It does → replace with a paragraph break. We know the furniture was inserted;
  we do **not** know that the paragraphs on either side of it were ever one, and
  joining them would be an edit rather than a deletion.

This test asks less than the positional *proof* does, deliberately. Proof
requires a lower-case continuation because it licenses deletion with no reviewer
at all. Rejoining only asks whether the sentence had ended — *"…furnished by the
canteen at / 12 / FROM BAZANCOURT TO HATTONCHATEL 13 / Montcornet."* is plainly
one sentence, and the capital is a place name, not a new paragraph.

On Storm of Steel's thirty reviewable candidates: 7 rejoin, 23 keep the break.

**The verification is a strict-deletion check**, not a diff review: the result
must be the original text with only the identified spans removed — the
remaining characters, in order, must equal the original minus those spans.
Anything else is a rewrite, and a rewrite here means the edition no longer
describes what is on the shelf (§4's hard rule).

### Order of work

Storm of Steel first: worst ratio, smallest volume, and it is the text a
Journey reads, so the fix is visible immediately in the Demonstration. Then the
Shahnama and the Corpus Hermeticum, which are the volume.

---

## 2c. Shouting, punctuation, brackets — surveyed, and mostly innocent

Asked for by Mateo, 2026-08-05: all-capital words, punctuation in series like
`;;;....`, and brackets. Swept exhaustively over 1,710,281 lines of 91 works
(`scripts/audit-text-artifacts.mjs`).

**The headline is that the counts are misleading, and acting on them would have
been the largest mistake of this pass.** Three of the four biggest buckets are
the edition doing its job.

| shape | count | works | what it actually is | disposition |
|---|---|---|---|---|
| `[1]` `[2]` | 13,013 | 25 | footnote markers **and their footnote bodies** | keep |
| ALL-CAPS in prose | 9,267 | 62 | **stage directions** — `Enter NORA`, `gives to the MAID` | keep |
| `[…]` unclassified | 7,752 | 52 | stage directions again — `_[calls out from his room]_` | keep |
| unbalanced `]` | 7,223 | 39 | **the closing half of a multi-line stage direction** | keep — detector at fault |
| `....` | 3,043 | 37 | four-dot ellipsis — `“But you must, really, Dolly....”` | keep |
| ALL-CAPS ≥12 chars | 1,478 | 47 | `_[THE SAME SCENE.—` and errata lists | keep |
| `[Footnote: …]` | 576 | 9 | the edition's own notes, inline | keep, flag |
| **`[Illustration]` bare** | **205** | **11** | a plate this edition does not have | **trim** |
| `[Illustration: caption]` | 44 | — | carries a caption | keep |
| `[Greek: taxis]` | 224 | 6 | transcriber's script note | keep — see below |
| `;;` `,,` `??` | 143 | 23 | mostly OCR, some genuine (`“No!!”`) | flag |
| `;;;....` | 3 | 2 | pure OCR wreckage — **both works already withheld** | n/a |

### What was trimmed, and why only that

**205 bare `[Illustration]` markers.** They stand for a plate the printed
edition had and this one does not; rendered, the reader is shown those
characters. That is **a broken frame written in words**, and reverent
degradation is the standing rule: a work that will not resolve is absent, never
a broken frame.

**Only the bare ones.** `[Illustration: “I'm the tallest”]` carries a caption.
And `[Illustration] BUTTERFLY DANCE` has its caption *outside* the bracket —
removing that marker would strand an all-capital line between two paragraphs,
which the compositor then reads as a title. Removing furniture in a way that
manufactures a heading is not an improvement; it is R11's fault arriving by
another door.

### Two findings worth keeping

**The orphaned-bracket detector is wrong, and 7,223 counts prove it.** It
balances brackets per LINE, and a stage direction spans lines — so every
`mouth.]_ Come in here, Torvald` looked like `ATHENS]`. The real orphans are
rare; the detector has to balance across a paragraph.

**`[Greek: taxis]` is not removable by deletion.** It is the transcriber's
substitute for Greek characters the plain-text format could not carry, and the
Vitruvius page reads *"Order (in Greek [Greek: taxis])"*. Deleting the bracket
leaves "in Greek )"; deleting the parenthetical removes the Greek term the
translator put there. Turning it into `taxis` would be a **rewrite**, which §4
forbids outright. This one is a rendering problem, not a text problem — the
Page could present it as a gloss — and it is recorded here rather than acted on.

---

## 2d. The four remaining classes, scanned — there is no second Hamlet

**Scanned 2026-08-05 with `npm run audit:text`, which already existed and is the
instrument that found Hamlet.** The question was whether a large-grain defect is
still on the shelf; the answer is no.

```
0 works score above 12 (likely wrong edition or bad scan)
0 more between 6 and 12 (worth a human look)
88 appear clean
```

Hamlet scored **32.3%** apparatus and is withheld. The worst work now on the
shelf scores **2.8**, and its components are fine-grained OCR noise rather than
a wrong edition:

| work | score | apparatus | gibberish | furniture |
|---|---|---|---|---|
| sacred-i-ching | 2.8 | 0.0% | 1.0% | 7.1% |
| literary-letters-young-poet | 2.7 | 0.0% | 3.5% | 0.0% |
| doctor-faustus | 2.5 | **1.9%** | 1.0% | 0.0% |
| a-hundred-verses-from-old-japan | 2.4 | 0.0% | 1.0% | 5.6% |

**The one apparatus signal above 1% was checked and is not a defect.** Doctor
Faustus's 35 apparatus-shaped lines are Alexander Dyce's own footnotes —
`[Footnote 32: concise syllogisms-- Old ed. "Consissylogismes."]` — which is the
edition doing its job, not OCR folding a variorum into the play. It is the
`[Footnote: …]` class of §2c: keep, flag.

### What this justifies, and what it does not

**Justified:** stopping here. There is no Hamlet-scale problem hiding, so
building detectors for apparatus, marginalia, imprint fragments and OCR
corruption would be hunting a 1–3% residue that no reader has complained about,
in preference to work that has been waiting.

**Not justified:** calling those classes closed. They are **unscanned at the
instance level** — this is a per-work score over a 240,000-character sample, not
an exhaustive sweep. It answers "is a whole book wrong", which is the question
that matters, and not "how many stray sigla exist", which is the question that
does not.

The residue is recorded rather than pursued.

---

## 3. The detection ladder

Cheapest first, and **nothing reaches a reviewer that a regex could have
settled** — that is the whole economy of this.

**Rung 1 — deterministic.** Pure functions over the payload, unit-tested against
known-bad fixtures drawn from the findings above. Unbalanced brackets, sigla
patterns, bare numerals, repeated running heads, mojibake ranges. Fast, free,
and it will catch the large majority because scanning artefacts are formulaic.

**Rung 2 — statistical.** Per-work outlier detection: a paragraph whose
character profile departs sharply from the work's own norm (capital ratio,
punctuation density, mean token length). This is what finds a defect nobody
anticipated, and it produces *suspicions*, not verdicts.

**Rung 3 — read it.** Only what survives rungs 1 and 2, and only in the
neighbourhood of the suspicion — never a whole book. This is the handoff.

---

## 4. The handoff

Large volumes of prose reviewed by a cheaper model (Gemini 3.6 Flash or
similar), one bounded task at a time.

### The contract

**Input** — a JSON job per suspect passage:

```json
{
  "workId": "vitruvius-ten-books",
  "edition": "Morris Hicky Morgan, Harvard University Press, 1914",
  "locator": { "division": "Book I", "charStart": 18432, "charEnd": 18510 },
  "before": "…two paragraphs of surrounding prose…",
  "passage": "ATHENS]",
  "after":  "…two paragraphs of surrounding prose…",
  "suspicion": "orphaned-bracket"
}
```

**Output** — a verdict, and nothing else:

```json
{
  "workId": "vitruvius-ten-books",
  "locator": { "…": "…" },
  "verdict": "apparatus",
  "confidence": "high",
  "disposition": "trim",
  "note": "Marginal gloss naming the city discussed; not authorial prose."
}
```

### The hard rule

> **A reviewer FLAGS. It never rewrites.**

No model — and no script — emits replacement prose into the Archive. Every text
here is public domain **with its basis recorded per EDITION**, and a silently
"corrected" text is no longer the edition it claims to be. That is the same
failure as Hamlet, arrived at from the opposite direction: a book presented
under a name that no longer describes it.

Permitted dispositions are therefore a closed set:

- **`keep`** — a false positive; record it so the detector can be narrowed.
- **`trim`** — delete a bounded span that is demonstrably not the work. Deletion
  only. Recorded with its offsets in the work's dossier.
- **`withhold`** — the defect is structural; the work leaves the shelf and the
  shelf says why (the Shakespeare precedent).
- **`re-source`** — a better edition exists; withhold and queue the acquisition.

**The prompt itself is written:** `CORPUS-REVIEWER-PROMPT.md`, with the system
prompt to send verbatim, the job envelope, six worked examples drawn from the
actual shelf, and the batch discipline. Two things there refine this section:
the reviewer's vocabulary deliberately **excludes `withhold` and `re-source`**
(those need a human, per §7.3), and it reports whether the proposed **span**
is exact — an inexact span forces `keep`, so a bad boundary is reported rather
than acted on.

### Why a cheaper model is the right instrument here

The judgement is genuinely easy — *"is this line part of the book?"* — and the
volume is genuinely large. That is exactly the shape of task to delegate. The
expensive part is the *contract*, and it is written down above precisely so the
reviewer's job stays narrow enough that a small model does it reliably.

**Sampling discipline:** a stratified sample of every reviewer batch is re-read
independently before its verdicts are applied. A reviewer that drifts is a
reviewer that quietly deletes prose, and by construction nobody would notice.

---

## 5. Disposition, and the record

Every applied verdict lands in the work's dossier alongside its rights basis:
what was removed, from where, on whose judgement, and when. A trim with no
record is indistinguishable from corruption a year from now.

Withheld works follow the existing precedent: absent from the shelf, with the
reason stated where a reader would look — reverent degradation applied to the
catalogue rather than to imagery.

---

## 6. Phases

0. **Running heads** (§2b) — decided, specified, and independent of everything
   below it. It has its own detector, its own verification, and 293 instances
   that need no reviewer. Worth doing first precisely because it does not wait
   on the ladder, the handoff, or any open decision.
1. **Fixtures.** Harvest known-bad passages from Hamlet, the three Shakespeares,
   Vitruvius and the Storm of Steel into a test corpus. Nothing is built before
   there is something to fail against.
2. **Rung 1** detectors + unit tests. Report only; no mutation.
3. **Run the report over all 107** and read the shape of it. The distribution
   decides how much of rung 2 is worth building.
4. **Rung 2** outlier pass, if the report says it is needed.
5. **The handoff harness** — job generation, batching, verdict ingestion,
   sampling audit.
6. **Apply**, dossier-recorded, work by work, most-defective first.
7. **A standing test**: the fixtures never come back. This is the guard that
   keeps the shelf clean after the pass ends.

---

## 7. Open decisions

0. **Stranded running heads — a trim with its own evidence.** The case above
   is unusually safe to act on, and worth deciding separately from the rest.
   The proposed detector: *a division's content ends with a heading run whose
   normalised text is repeated as the opening heading of the NEXT division.*
   Only the duplicate is dropped; nothing unique to the text is touched, and
   the text itself supplies the proof by saying it twice. The precedent is
   already in `divisions.js`, which refuses to serve a contents page as a
   reading — this is the same act, smaller.

   **It is still a deletion, so it is your call, not the splitter's.** It was
   deliberately NOT bundled with the boundary fix: that fix only moves
   material, and this one removes it.

1. **The Shakespeare edition** — still blocking `re-source`. Moby remains the
   recommendation.
2. **Trim threshold** — does a single orphaned bracket justify touching a text
   at all, or is the bar "a reader would notice"? I would set it at *a reader
   would notice*, and let rung 1 report the rest without acting.
3. **Who ratifies a `withhold`** — a model's verdict alone should not empty a
   shelf. Suggest: `withhold` and `re-source` always require a human.
