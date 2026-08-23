# Archive Cleansing — a scope

**Status:** CAMPAIGN ENDED. Cleansing 107 inherited works was abandoned for
acquiring fifteen correct ones — see `ARCHIVE-CANON-SPEC`, which supersedes
this as policy. What survives here is the defect vocabulary, which is still the
regression suite: a detector named below must keep reporting zero.
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

- **Anna Karenina, Chapter 1 begins with the book's navigation apparatus.**
  Found 2026-08-11 while testing adjacent Workshop visual spans. The served
  chapter begins with title/author/translator matter, a literal `Contents`, and
  links for `PART ONE` through `PART EIGHT` before the genuine `PART ONE /
  Chapter 1` opening. See §2g. This is a cleansing defect even though the
  runtime boundary failure it exposed was corrected independently.

The rule this scope serves: **no such text in any book.**

---

## 1b. The Mahabharata — wrong work, in part

**Status: TRIMMED 2026-08-05 (`e976c03`) — option 1, the interim.** The 403,208
words are withdrawn: volumes 5–9 are gone, and the payload now holds volumes
1–4 with zero war vocabulary and its own intact (2,948 Arjuna, 2,913 Pandava,
2,067 Krishna). A reader can no longer be handed a 1915 war periodical labelled
as Vyasa.

**The acquisition is still open.** Option 2 — re-sourcing the true remaining
volumes — remains the right end state and needs a human; until then the dossier
must say the edition is volumes 1–4. Everything below is the evidence the trim
was made on, kept so the decision is not rediscovered.

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

> **BUILT 2026-08-12.** `scripts/audit-division-identity.mjs` derives it and
> `src/content/archive/division-identity.test.js` holds it. See §3b.

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
| **Non-letter symbols** | emoji, box rules, replacement chars in the payload | `2v📄`, `Dr�ckende` — **swept, see §2e** |
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

**CORRECTED 2026-08-05, and the correction matters more than the finding.**

The line above used to read: *"The orphaned-bracket detector is wrong, and 7,223
counts prove it… The real orphans are rare."* **That was wrong, and `ATHENS]` —
the case named in §1 from the very beginning, and pointed at twice — was sitting
inside that dismissed bucket the whole time.**

Two mistakes produced it, and both are about the instrument rather than the
corpus:

1. **The samples were not samples.** `readdirSync` returns alphabetical order
   and the bucket kept the *first* N examples it saw, so **every illustration in
   that survey came from `a-doll-s-house`** — a stage play, the worst possible
   representative for a question about brackets. I read four lines from one work
   and wrote off 7,223 findings across 39. A sample that cannot show you a second
   work cannot tell you what a bucket holds.
2. **The caps detector excluded the shape the question was about.** It returned
   early on any line with no lower-case letter, reasoning that the compositor
   already judges headings (canon R11). But R11 decides how to *set* a line, not
   whether it belongs in the book. `ATHENS]` is a standalone all-capital line.

Both are fixed: samples now spread one-per-work before any work gets a second,
the bracket test carries **open-bracket state across lines** so a stage
direction's closing line is no longer an orphan, and standalone capitals are
counted rather than skipped.

**The corrected measurement.** Standalone orphaned-`]` lines, nothing open,
≤60 characters:

| | count |
|---|---|
| total | 2,178 in 16 works |
| …in works already **withheld** (the three Cambridge Shakespeares) | **1,901** |
| **on the shelf** | **277 in 13 works** |

The class is not one class, which is why no corpus-wide rule fits it:

- **Vitruvius, 33** — plate captions and credits: `ATHENS]`, `ROME]`,
  `EXAMPLE OF OPUS INCERTUM. THE CIRCULAR TEMPLE AT TIVOLI]`,
  `(From his edition of Vitruvius, Venice, 1511)]`. **Trim** — see §2e.
- **Crane 86, Dresser 1** — figure caption tails, same shape.
- **The Little Clay Cart 80** — `P. 4.7]`, footnote anchors, not captions.
- **Pride and Prejudice 34** — `Chapter I.]` and a repeated copyright line.
- **And the trap:** `metamorphoses` has `in a]l` and `And al] the ground` — the
  `]` is a **misread letter**. Those are excluded by the standalone rule, and
  they must be: removing that bracket would be a *repair*, which §4 forbids
  outright. Flag, never touch.

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

### Re-run with the corrected instrument, 2026-08-05

The survey above was made with the broken sampler, so it was re-run once the
sampling and bracket-state faults were fixed (§2c). **With samples spanning
many works instead of one play, the large buckets hold up:** `caps-standalone`
is `ACT I.`, `BEOWULF`, `ANNA KARENINA` — the works' own titles; `shout-short`
is `IOU` and stage directions; `bracket-number` is footnote markers and their
notes. No second Vitruvius was hiding in them.

**What remains genuinely open is bounded and named:** 244 standalone orphaned-`]`
lines across 12 shelved works whose lines have not been read — Crane 86, the
Little Clay Cart 80, Pride and Prejudice 34, the Shahnama 21, and eight works
with fewer than ten each. The machinery to close them exists and is verified;
closing them is a reading task, not an engineering one. A work joins
`ORPHAN_CAPTION_WORKS` after someone reads its lines, never before.

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

---

## 2e. Symbols that are not letters — swept 2026-08-11

**Found by a reader, from one character.** A hermetic text served
`2v📄` mid-page: a page image in the source scan had been transcribed as
U+1F4C4 PAGE FACING UP. The question "how many more of these are there"
turned out to have a bounded, useful answer.

**The sweep:** every codepoint above U+2100 in Unicode category `So`, `Sk`,
`Cn` or `Co`, across all 91 work payloads. **22 distinct codepoints.** They
sort into three dispositions and the sorting is the whole finding — a single
"strip non-letters" pass would destroy scholarship.

### A · Genuine content — do not touch

| codepoint | count | works | what it is |
|---|---|---|---|
| U+2720 MALTESE CROSS | 1 | `ulysses` | *"Letter from His Grace. William ✠."* — the archiepiscopal cross, Joyce's own text |
| U+23D1 / U+23D2 / U+23D3 metrical marks | 368 | `the-book-of-the-thousand-nights-and-a-night` | Burton's prosody: *"iambic dipodia (⏑ – ⏑ –)"* — scansion, not decoration |
| U+2341 / U+2342 APL quad slash | 17 | `ross-pure-design` | *"the Sequences of the Left Mode (Sign ⍂)"* — Ross NAMES the sign; the glyph is the referent |

The Ross case is the Dresser case from ROADMAP Phase 9 in miniature: the mark
is **deictic**, and deleting it turns a definition into a sentence pointing at
nothing.

### B · Typography and apparatus — a disposition question, not damage

| codepoint | count | works | what it is |
|---|---|---|---|
| U+2502 and five other box-drawing marks | 26,119 | `the-book-of-the-thousand-nights-and-a-night` | An edition-concordance TABLE (Galland / Perceval / Gauttier / MS) rendered in rules |
| U+273F BLACK FLORETTE | 4,985 | same | Ornamental separators: *"PRAISE BE TO ALLAH ✿ THE BENEFICENT KING ✿"* |

**26,119 rule characters are a table, and a table read aloud one atom at a
time is noise.** This is the §2 apparatus class, not a symbol problem — it
belongs with the Phase 10 pass that withdrew 49 divisions, and it was missed
there because that detector reasoned about WORDS. Worth measuring which
divisions carry it before deciding: if it is confined to front matter the
disposition is obvious, and if it is threaded through the reading it is not.

### C · Scan damage — the class the reader actually found

| codepoint | count | works | what it is |
|---|---|---|---|
| **U+FFFD REPLACEMENT CHARACTER** | **14** | `literary-letters-young-poet` | **Every one is a destroyed German umlaut or ß** |
| U+25A0 BLACK SQUARE | 451 | 7 works | OCR noise beside scan furniture: `Digitized by Google … ■3 ■` |
| U+2122 TRADE MARK SIGN | 12 | 5 works | `Google™ books` — scan header that survived the Phase 10 imprint trim |
| U+1F4C4 PAGE FACING UP | 1 | `sacred-emerald-tablet` | A page image transcribed as an emoji |
| U+2666, U+25A1, U+25BA, U+25BC, U+274C | 12 | 5 works | Scattered OCR noise |

**The Rilke letters are the serious one, and they are not cosmetic.** All 14
sit inside German words a reader is currently served broken:

```
Dr?ckende      persönliche → pers?nliche      lebensf?hig
da?            öffentlich  → ?ffentlich       ?bereinkommen
gel?st         k?nnen      → bed?rfen         versch?tteten
```

`Drückende`, `persönliche`, `lebensfähig`, `daß`, `öffentlich`,
`Übereinkommen`, `gelöst`, `können`, `bedürfen`, `verschütteten`. **Every one
is recoverable by hand from context** — this is an editorial repair, not a
loss.

**It is the third payload-damage site recorded.** Sextus carries stripped
Greek (`imperturbability, . We`), the Emerald Tablet carries this emoji, and
the Rilke letters carry these. The standing note that correcting a
checksummed payload *"is an editorial act needing a ruling, not a fix"*
applies to all three, and they should be ruled on together rather than one at
a time.

It is also the same family as ROADMAP 12.2, where the Chain tokenizer shreds
accented Latin — **non-ASCII Latin failing to survive a pipeline**, once on
the way in and once on the way out.

### Why nothing caught it

`source-hygiene.test.js` sweeps every source file for **control** characters,
and was written after a literal U+0008 hid inside a regex for two sessions.
It does exactly what it says, and a printable symbol is invisible to it.

**The guard that would catch the next one is an inventory, not a rule.** An
allowlist of "permitted symbols" would need a judgement per codepoint and
would drift toward permitting everything — the failure already named in
ROADMAP 12.4, where *a test that recovers almost everything by looking almost
everywhere has stopped asking a question.* Instead commit the measured
inventory above and assert the corpus still matches it, the same shape as
`division-index.json`: a new symbol in a future ingest fails loudly, and no
judgement about beauty is encoded anywhere.

---

## 2f. Chapters that are contents pages — 2026-08-11

**Reported from reading:** *"Chapter II of A Hundred and Seventy Chinese Poems
is no more than a table of contents, which starts with the text 'Chapter II'
but contains no text."* Exactly right, and it is three divisions, not one.

### The work, measured

`a-hundred-and-seventy-chinese-poems` serves 17 divisions. The first four are
front matter, and three of those are contents blocks wearing chapter names:

| row | name | words | what it is |
|---|---|---|---|
| 0 | Front matter | 212 | front matter |
| 1 | **Chapter I** | **106** | contents — 26 of 27 lines are `title … page` |
| 2 | **Chapter II** | **81** | contents — 17 of 19 lines |
| 3 | **Chapter IV** | **95** | contents — 21 of 24 lines |
| 9 | Chapter II | 2,636 | the real one |

```
CHAPTER II:

      Satire on Paying Calls in August         57
      On the Death of his Father               58
      The Campaign against Wu                  59
```

**Two defects, and the second is the one that hides the first.**

1. **282 words of contents served as three readings.** Small, and wholly
   removable — nothing is lost, because none of it was a reading.
2. **Every one of those names is served twice.** `Chapter I`, `Chapter II` and
   `Chapter IV` each appear again later carrying the actual poems. This is the
   Shahnama keying shape — 462 sections resolving to 249 distinct names — where
   a duplicate name is the visible symptom of a division that should not exist.
   Note also that no contents block is named `Chapter III`: the numbering comes
   from the page being *listed*, not from what the division holds.

### The detector, and its precision

*A division at least five lines long, where half or more of its non-empty lines
end in a page number after run-out spacing:*

```
/\S\s{2,}\d{1,4}(\s*[-–]\s*\d{1,4})?\s*$/
```

Swept across all 91 works: **5 divisions, 5,732 words. It is right twice and
wrong once, and the wrong one is the largest.**

| work | division | words | verdict |
|---|---|---|---|
| `a-hundred-and-seventy-chinese-poems` | ×3 | 282 | **contents. Confirmed.** |
| `pride-and-prejudice` | ×1 | 1,450 | **A List of Illustrations** — `Dedication … vii`, `"He came down to see the place" … 2`. Genuine apparatus, correctly found. |
| `strange-stories-from-a-chinese-studio` | ×1 | 4,000 | **FALSE POSITIVE — do not act.** It opens `[729] I know of few more pathetic passages throughout all the exquisite imagery of the Divine Comedy…`: Giles's endnotes, which are scholarship. |

**Stated plainly because the ratio matters more than the hits:** 4,000 of the
5,732 words this detector proposes are a translator's commentary. Run at this
threshold and applied without review it would delete the most valuable text it
found. It is a *reporting* instrument, not a trimming one — the same conclusion
§2b reached about running heads, and the same one the imprint detector reached
after being wrong three times.

**Disposition.** The three Chinese-poems divisions are the Phase 10 class A
case and are safe to withdraw on the evidence above. The other two are flagged
for a human and nothing else. Removing text remains a decision, not a pass.

---

## 2g. Embedded contents preamble in Anna Karenina — 2026-08-11

**Status: observed and specified; not yet applied.** This finding came from a
real Workshop composition rather than a corpus detector. That origin matters:
the media score was correct enough to expose both a runtime boundary defect and
an archive defect in the same thirty lines.

### The served payload

The first division is named `Chapter 1`, but its `startAnchor` is `Front
matter`. Its content begins:

```text
ANNA KARENINA
by Leo Tolstoy
Translated by Constance Garnett

Contents

PART ONE
PART TWO
PART THREE
PART FOUR
PART FIVE
PART SIX
PART SEVEN
PART EIGHT

PART ONE
Chapter 1

Happy families are all alike …
```

The first `PART ONE` through `PART EIGHT` run is navigation apparatus. The
second `PART ONE` and `Chapter 1` are genuine structural headings and must be
preserved. The clean reading therefore begins at the **last `PART ONE` before
`Chapter 1`**, not at the first occurrence of either string.

This is not the §2f shape. It is not a contents page mistakenly served as a
whole division; it is a contents preamble fused into the first genuine prose
division. A division-level contents detector can therefore pass while the
reader still receives apparatus.

### What the Workshop revealed, and what it did not

Adjacent visual clips were assigned across this material. Before the runtime
correction, phrase mode could build one atom across several media endpoints:
the first field remained active through `PART EIGHT`, the intervening visual
was never authoritative, and the Chapter 1 visual began only at the next prose
phrase. That defect is now guarded in `source-span.test.js`: score endpoints
become hard atomization cuts, the phrase floor cannot merge across them, and a
single atom cannot compile to two clips on the same track.

That runtime fix does **not** cleanse Anna Karenina. Conversely, removing the
preamble must never be treated as the runtime fix. The standing rule is:

> Archive cleansing improves what the reader receives; Session compilation
> remains correct even when a dirty source reaches it.

### Report-only detector

Report the first served division when all of the following are true:

1. it is named as a prose division but begins from a front-matter anchor;
2. a literal contents marker occurs before its first genuine prose;
3. a run of top-level division labels occurs before a repeated first label;
4. the repeated label is immediately followed by the division's own heading;
5. prose follows that second structural opening.

The candidate removal is the bounded prefix before the repeated structural
opening. The report must include both occurrences and the proposed retained
boundary. It must not mutate automatically: an epigraph, dedication, dramatis
personae, translator's preface, or a legitimate Part heading can have similar
position without being disposable.

### Required verification before apply

1. Compare the proposed boundary with the pinned Constance Garnett artifact.
2. Prove that `PART ONE / Chapter 1` survives byte-for-byte after the trim.
3. Add this exact preamble to the known-bad fixture corpus.
4. Sweep the same report across every first division; read every hit.
5. Record the applied span, checksum change, basis, and date in the work's
   cleanse log and acquisition dossier.

The likely disposition is a bounded front-matter trim, but removal remains a
cleansing decision until this verification is complete.

---

## 3b. Per-division identity — BUILT 2026-08-12

The guard §1b asked for, and the successor `identity.test.js` names inside its
own exemption list. That list had grown to **eighteen works** — legitimate
books whose opening pages do not name themselves — which is the shape ROADMAP
12.4 warns about: *a test that recovers almost everything by looking almost
everywhere has stopped asking a question.* This one carries **no exemptions**.

**The invariant:** *no division may be devoid of the vocabulary its own work is
dense in.*

### The measure, and why it is not word frequency

Every division of every English book is dense in `said` and `great`, and so
were the war volumes. What separates a work is vocabulary common **inside** it
and rare **across** the rest of the shelf — Pandava, Yudhishthira, Parva. So a
work's characteristic terms are its most frequent tokens that appear in no more
than 15% of the other ninety works, capped at 120 terms. A division's score is
how many of those it uses.

### The floor was swept, not chosen

| floor | divisions scoring zero |
|---|---|
| 400 words | 107 |
| 1,000 | 66 |
| 2,000 | 52 |
| **5,000** | **0** |
| 10,000 | 0 |

Below 5,000 the instrument refuses Epictetus, Boethius, Kwaidan and Leaves of
Grass for being aphoristic — chapters that genuinely do not use their book's
distinctive nouns. **At 5,000 the corpus is clean with no exemptions**, and the
defect the guard exists to catch was 115,312 words with zero hits: a
twenty-three-fold margin.

Contents pages and printer's apparatus are a different class at a smaller
scale, with their own detectors (§2e, §2f). This one is for a whole division
that is a different book.

### An artifact, not a live sweep

Measuring needs all 16.3M words tokenised. `identity.test.js` already pays 22
seconds to load the payloads once, and a second full pass would put the unit
suite past four minutes for a corpus that changes on acquisition days only. So
it is derived offline, committed, and asserted — the `division-index.json`
shape, for the `division-index.json` reason. The test costs 1.2 seconds.

### What it refuses to claim

**Eight of ninety-one works cannot be checked by this measure** and are named
in the artifact rather than passed quietly: `kandinsky-spiritual-in-art`,
`literary-essays-emerson`, `literary-poems-blake`, `literary-poems-dickinson`,
`paradise-lost`, `sacred-emerald-tablet`, `sacred-rumi`,
`sacred-tao-te-ching`. Their vocabulary is not distinctive against the shelf,
so there is nothing for the measure to hold. A guard that quietly passed them
would be claiming a coverage it does not have.

### The half that matters most

The coverage assertion. **A work added to the shelf without re-running the
audit fails here**, and the failure names the command. That is the
*acquisitions cannot bypass the gate* requirement, and it is why the artifact
lists every work rather than only the offending ones.

---

## 3c. Runts — a division far below its own work's norm *(2026-08-12)*

**Mateo's tactic, and it works on the text he had in mind.** *A division with a
very low word count compared to its siblings.* Measured as: under a fifth of
its own work's median division, and under 400 words absolute.

It found the Chinese poems contents-as-chapters independently of §2f, which is
the useful part — two instruments built from different signals agreeing on the
same four divisions:

```
a-hundred-and-seventy-chinese-poems [0]  212w vs median 2248  (0.09)
a-hundred-and-seventy-chinese-poems [1]  106w vs median 2248  (0.05)
a-hundred-and-seventy-chinese-poems [2]   81w vs median 2248  (0.04)
a-hundred-and-seventy-chinese-poems [3]   95w vs median 2248  (0.04)
```

**Report-only, and it must stay that way.** 123 runts across 88 works, and the
list plainly mixes defects with genuine short chapters — Moby-Dick's *The
Lamp.* (242w) and *Midnight Aloft.—Thunder and Lightning.* (50w) are Melville
writing short chapters on purpose. This is rung 2 doing exactly what §3 says
rung 2 does: **producing suspicions, not verdicts.**

New suspicions worth a human, beyond those already recorded:

- `don-quixote` [1–5] — 85w, 250w, 49w, 43w, 106w against a 2,512 median, with
  names that read as truncated headings: `OF THE INTERVIEW THE CURATE AND`,
  `OF WHAT BEFELL DON`.
- `faust` [0–2], `madame-bovary` [0], `metamorphoses` [0], `a-doll-s-house` [0]
  — front matter at the head of the work.

### It does NOT find the Karenina defect, and the reason is worth keeping

Checked directly. Anna Karenina's first division is **982 words against a
1,428-word median — a ratio of 0.69, entirely unremarkable**, and divisions
2, 3 and 4 open cleanly at `Chapter 2`, `Chapter 3`, `Chapter 4`. Only the
first carries apparatus, and only about forty words of it, fused ahead of
genuine Tolstoy.

That is what §2g already says: a contents preamble welded onto the front of a
real prose division. **No division-level size or content measure can see it**,
because the division is the right size and is mostly the right book. It needs a
head-of-division trim, which is the §2b shape and Phase 10's class B — trim the
opening, never withdraw the division.

Two defects, two instruments, and the distinction is worth holding: **§3b asks
whether a division is the wrong book; §3c asks whether it is too small to be a
reading; §2g is neither, and needs the opening trimmed.**

### The instrument audits the live shelf only

Withheld works keep their payload files, so an early run reported King Lear's
Cambridge variorum apparatus as a finding — a text withdrawn for precisely
that, in 2026-07. The audit now reads the `WITHHELD` map out of `index.js`
rather than restating it, and skips those three.

---

## 3d. The defect registry — cleansing becomes recursive *(2026-08-12)*

**Mateo's ruling: every defect we find must be logged as something that can be
looked for again.** Don Quixote served `bookcover.jpg`, `spine.jpg (152K)` and
`Full Size` as if they were Cervantes — and the moment that is written down as
a *pattern* rather than repaired as an *instance*, it becomes a question the
whole shelf can be asked, today and at every future acquisition.

`src/content/archive/defect-signatures.js` holds them;
`scripts/audit-defect-signatures.mjs` asks all 88 works all of them.

**Provenance is required.** Each entry records the work that taught it and the
date. A signature without provenance is a guess; with it, a later reader can
open the thing itself and judge whether the pattern still describes it.

**Disposition is not severity.** `withdraw` — the division was never a reading.
`trim` — a genuine reading carries something in a line. `review` — evidence for
a human, and nothing may be cut on it alone. **Nothing in the module applies
itself.**

### What the first sweep found

| signature | lines | works | from |
|---|---|---|---|
| `contents-run-out` | 20,454 | 11 | chinese poems |
| **`transcriber-image-file`** | **366 → 0** | 1 | don-quixote — **trimmed 2026-08-12** |
| **`file-size-annotation`** | **365 → 0** | 1 | don-quixote — **trimmed 2026-08-12** |
| **`full-size-link`** | **260 → 0** | 1 | don-quixote — **trimmed 2026-08-12** |
| **`scan-provider-header`** | **137** | 1 | a-hundred-verses |
| **`html-entity`** | **89** | 1 | rilke letters |
| `transcriber-note` | 21 | 11 | don-quixote |
| `replacement-character` | 1 | 1 | rilke letters |
| `page-image-emoji` | 1 | 1 | emerald tablet |
| `variorum-sigla` | **0** | 0 | hamlet |
| `gutenberg-boilerplate` | 0 | 0 | don-quixote |

**Don Quixote is far worse than the five head divisions suggested.** Roughly
**990 lines of image furniture run through the whole work**, not a preamble:
`p003.jpg (307K)` and `Full Size` recur for hundreds of plates. The §3c runt
measure saw only the short divisions at the front; this saw the shape of it.

**The loop closed on its own first output.** The sweep printed a Rilke line as
evidence for `replacement-character` — and that line also read
`Zwar f&uuml;hlen viele junge Menschen`. Undecoded HTML entities became the
eleventh signature within the minute, and found **89 lines**. So those letters
carry two encoding failures, not one: fourteen characters destroyed outright
and eighty-nine lines never decoded.

**A signature at zero is not a signature to delete.** `variorum-sigla` finds
nothing, because the three works it describes were withdrawn in July. It is
kept, and asserted at zero, precisely so the next acquisition cannot repeat
Hamlet unseen. A guard retained only while it fires is not a guard.

### The instruments, and which question each answers

| | asks | misses |
|---|---|---|
| §3b identity | is this division the wrong book? | anything under 5,000 words |
| §3c runts | is it too small to be a reading? | full-length divisions |
| §3d signatures | does it contain a thing we have seen before? | anything nobody has met yet |
| §2g / §2b | is the right book carrying apparatus at its head? | — |

Rung 3 — a model reading — belongs on the neighbourhoods these produce, not on
whole books. **The registry is the targeting system**, and it is what makes the
cleansing recursive rather than repetitive.

---

## 3e. The second trim pass — 2026-08-12

**Don Quixote: 626 lines of image furniture, cut line by line.** Not a
preamble — it ran through the whole work, `p003.jpg (307K)` and `Full Size`
recurring for hundreds of plates across 145 sections. Every one of the 23
distinct line shapes was listed and read before the cut, and not one was
prose. No division was withdrawn: apart from these lines the work is Cervantes
throughout. 425,995 words remain and all three signatures now report **zero**.

**Le Morte d'Arthur: three heading lists withdrawn, 6,140 words.** Sections
that run chapter heading to chapter heading with no prose between them.

The discriminator was checked against its own neighbour rather than trusted:

| | opens | density | verdict |
|---|---|---|---|
| section 1 | `CHAPTER XII. How King Pellinore rode…` then `CHAPTER XIII…` | 1.78/100w | contents |
| section 245 | `CHAPTER I. How Sir Tristram jousted…` then *"And if so be ye can descrive what ye bear"* | below threshold | **the book** |

A contents list runs heading to heading; a real chapter has a heading and then
Malory. One measure separates them, and the neighbour proves it.

**Both Front matter sections were left alone, deliberately.** They carry
contents too, but they open with `Le Morte D'Arthur / King Arthur and of his
Noble Knights…` — the title block, and the only place the work names itself in
its opening pages. Karenina taught that on the same day: cutting to the first
real heading removed exactly that and `identity.test.js` failed at once. They
want the Karenina treatment — cut the navigation run, keep the title — and
they get their own pass rather than a hurried one here.

---

## The scheme became reader-facing — 2026-08-18

Everything above cleanses the TEXT. The four findings below are about the
SCHEME: what a work's divisions are called, where they start, and whether they
are divisions at all. That used to be internal bookkeeping. It is not any more.

The Scriptorium can now compose a reading shorter than the shortest whole work
by naming a division, or a division's opening (`src/core/library-extent.js`).
A curator names one by number; the reader is told which one by name. So a
division named from a bibliography, or a division that is a scanner's header,
is no longer a blemish inside a payload — it is what a reader is handed and
what the interface calls it.

---

## 2h. Verse read as prose — 2026-08-18

**Five works have lost their line breaks.** A poem's lines were joined with
spaces and only the stanza breaks survived, so the verse arrives as run-on
prose. Blake's quatrains reach the reader as one 117-character line.

The separation is total. Verse either kept its lineation or lost all of it:

| work | avg line | lines over 120 chars |
|---|---|---|
| `sacred-rumi` | 2,079 chars | **97%** |
| `kabir-songs` | 184 | 38% |
| `literary-leaves-of-grass` | 177 | 45% |
| `literary-poems-blake` | 112 | 49% |
| `literary-poems-dickinson` | 99 | 22% |
| | | |
| `the-kalevala` | 33 | **0%** |
| `the-oedipus-trilogy` | 33 | 0% |
| `a-hundred-verses-from-old-japan` | 36 | 0% |
| `the-ramayan-of-valmiki` | 36 | 0% |
| `a-doll-s-house` | 36 | 0% |

Nothing sits between 37 and 99. This is not a spectrum of typesetting quality;
it is two groups, and five works are in the wrong one.

### It cost them their divisions

The damage does not stop at the line. Headings are found by their shape on a
line of their own, so a work whose lines were joined has no headings left to
find:

- **`sacred-rumi`** — 14,110 words in **35 lines**. No scheme was detectable,
  so RISE cut it itself: `reason: "measured"`, four divisions called `Reading`.
  The one work in the library where the divider had to invent, and the reason
  is upstream of the divider.
- **`literary-poems-blake`** — 5,539 words, `divided: false`, **one division**.
  Fifty heading lines stand inside it — its poems, and the book's own two
  section titles — and not one of them can be named. Its table of contents
  went the same way: nineteen Innocence titles run together on one line.
- **`kabir-songs`** — 11,515 words, `divided: false`, one division.

So a curator cannot ask for *The Tyger*. It can ask for Blake whole, or for the
opening of the single division that is the entire book — which begins, as the
example below shows, with a picture caption and a title page.

And Blake is the work that defines the library's short-length cliff: at 5,539
words it is the second-shortest thing on the shelf, the first being the Emerald
Tablet at 237. The one book most needed for a short reading is the one whose
poems are locked inside an undivided section.

### The worked example: Blake's Tyger

Our payload is the Astolat Press edition of 1901 (London: R. Brimley Johnson)
by way of Gutenberg. What it serves:

```
THE TIGER

Tiger, tiger, burning bright In the forests of the night, What immortal hand
or eye Could frame thy fearful symmetry?

In what distant deeps or skies Burnt the fire of thine eyes? On what wings
dare he aspire? What the hand dare seize the fire?
```

Blake engraved it in 1794 in *Songs of Experience*. The same eight lines:

```
Tyger Tyger, burning bright,
In the forests of the night;
What immortal hand or eye,
Could frame thy fearful symmetry?

In what distant deeps or skies.
Burnt the fire of thine eyes?
On what wings dare he aspire?
What the hand, dare sieze the fire?
```

Ten separate corruptions, of two different kinds:

| # | corruption | kind |
|---|---|---|
| 1 | 24 lines joined into 6 | **ingest** |
| 2 | `[Picture: Image of Blake's original page of The Tyger]` is the first text in the work | **ingest** |
| 3 | the whole book is one undivided section | **ingest** |
| 4 | title `The Tyger` becomes `THE TIGER`, in the poem and in the contents | edition |
| 5 | `Tyger Tyger` becomes `Tiger, tiger` — respelt, comma added, second word lowercased | edition |
| 6 | `water'd` becomes `watered` | edition |
| 7 | `sieze` becomes `seize` — Blake's own misspelling, corrected away | edition |
| 8 | `Did he smile his work to see?` becomes `Did He smile His work to see?` | edition |
| 9 | `the Lamb` becomes `the lamb`, losing the pointer to the companion poem | edition |
| 10 | `Dare its deadly terrors clasp!` becomes `clasp?` | edition |

**The two kinds do not have the same remedy, and that difference is the point
of this section.**

1–3 are OURS. The 1901 book had line breaks, a picture rather than a caption of
one, and a table of contents. The ingest lost them. These are repairable from
the source we already used and nobody has to decide anything.

4–10 are the EDITION'S. R. Brimley Johnson modernised Blake, as Victorian
editors did. Repairing those means acquiring a different edition, not fixing
this one — and until that is done the shelf serves a modernised Blake under
Blake's name with nothing saying so.

`&` for `and`, `sieze`, `water'd` and the terminal `!` are Blake's engraved
readings and are not errors to be tidied. The reference text above is set down
as the TARGET, from the received transcription of the plates. **It is not an
acquisition.** A poem typed from memory is exactly the substitution this
document exists to prevent. Ingesting it means sourcing an edition that prints
Blake's own text — an Erdman, or a Blake Archive transcription — with a
provenance record like every other work, never a hand-keyed file.

### Disposition

- **Lineation (1) — repairable, not yet specified.** The five works want a
  re-ingest from source with line breaks preserved. Whitman, Blake, Dickinson,
  Rumi and Kabir are the list. Rumi and Blake regain a division scheme by it,
  which is the larger prize.
- **Picture captions (2) — trim.** `[Picture: …]` is the
  `transcriber-image-file` class in a different costume: the caption of a plate
  the payload does not carry. No signature holds this shape yet.
- **Modernised edition (4–10) — review, and declare.** Nothing may be edited
  into a payload to make it look older. Either acquire an edition of Blake's
  text, or say on the card which edition this is.

---

## 2i. A division scheme made of citations — 2026-08-18

**`sacred-corpus-hermeticum` has 244 divisions named from a works-cited list.**

```
Volume 1 — D.  J,  L.  =  Mead  (G.  E.  S.),  Did  Jesus  Live  100  B.C.?
F. F. F. = Mead (G. K. S.), Fragments of a Faith Forgotten.  Some Short
Sketches among the Gnostics, mainly of the first two centuries
```

The scheme is counting bibliography entries rather than tractates. Found while
sending division labels to a curator, where a name is the thing being chosen by
— a division named for a citation cannot be chosen, and the work has 244 of
them.

Recorded as `bibliography-as-division-title` in `defect-signatures.js`. The
sweep confirms it: **10 lines, one work**, and nothing else in 88 works.

**Disposition: review.** The scheme is wrong, not the text, and re-dividing a
Hermetic corpus is an editorial act. Nothing is cut on a signature alone. It is
excluded from the curator's labels meanwhile — not because it is long, but
because its names are not names.

---

## 3f. Where the work begins — 2026-08-18

**Thirty-three of eighty-eight works open on something that is not the work.**
A Gutenberg header, a title page, a contents list — sitting at division one,
which is where anything naming a division blindly will land.

```
extended-bhagavad-gita-full   division 1 = "Front matter"          body from 2
the-kalevala                  division 1 = "Front matter (1/3)"    body from 4
le-morte-darthur              division 1 = "Front matter (1/2)"    body from 3
beowulf, faust, metamorphoses, phaedra, a-doll-s-house, …          body from 2
```

The divider already labels this matter `Front matter` — it has always known.
Nothing read the label.

`division-index.json` now carries **`bodyFrom`**: the first division that is the
work itself, present only when something precedes it. It reaches the curator
through `divisions.bodyFrom`, and the prompt forbids naming a division below it.

The predicate (`isFrontMatterLabel`, in `divisions.js` beside where the labels
are written) reads **only the label this codebase generates**. An author's own
`Preface & Introduction` — Ross, *A Theory of Pure Design* — is a division of
the book and a reader may well want it. Detecting front matter by meaning
rather than by our own mark would take that decision away from them.

---

## 3g. What the line registry cannot hold — 2026-08-18

§3d made cleansing recursive by writing each defect down as a pattern the whole
shelf can be asked about. **A shape defect does not fit in it.**

`DEFECT_SIGNATURES` tests one line at a time, which suits an image filename or
a boilerplate line. Lost lineation (§2h) is not a substring — it is a property
of a work's line-length distribution. The obvious regex was tried: a long line
with four or more mid-line capitalised starts. Measured against the corpus it
fires on **35 works**, and its worst offenders are prose:

```
 97%  sacred-rumi                  ← the real thing
 69%  extended-bhagavad-gita-full
 57%  okakura-book-of-tea
 32%  literary-walden              ← Thoreau, correctly typeset
 20%  romance-of-the-three-kingdoms
```

It was not added. A signature that cries wolf on Walden makes the registry
worth less than no registry, because the next person reads a report full of
noise and stops reading reports.

**The measurement that does separate them is in §2h** and takes two numbers per
work — mean line length, and the share of lines over 120 characters. It wants a
work-level audit script beside the line-level one, taking a declared list of
works whose form is verse. Until that exists this section IS the record: the
recipe and the five names, so the question can be asked again.

**The registry's shape is a finding in itself.** Everything in it is a defect
you can point at on one line. Everything absent from it is a defect you can only
see by standing back, and this is the first of those we have written down.

---

---

## 2j. Text eaten by the heading detector — 2026-08-18

**The worst defect found in the whole campaign, and no detector could ever
have found it.** It is not garbage in the text. It is text that is gone.

An ingest finds a heading by its shape on a line of its own, and the heading
line is then REMOVED from the content — correctly, since a division's title is
not its first sentence. Three works were given a pattern with no literal anchor
and a case-insensitive flag:

```js
literary-walden           /^[A-Z][A-Z ,'-]{4,55}$/i
literary-poems-blake      /^[A-Z][A-Z ’,'-]{2,55}$/i
literary-leaves-of-grass  /^(?:BOOK [IVXLCDM]+|[A-Z][A-Z ,’'-]{5,65})$/i
```

`i` makes `[A-Z]` match lowercase. So `^[A-Z][A-Z ,'-]{4,55}$` matches any line
of five to fifty-six letters, spaces, commas, apostrophes or hyphens — which is
to say, most lines of ordinary prose and nearly every line of verse. Each one
matched became a division boundary, and was deleted from the body.

### Measured against the sources still on disk

| work | source | ours | **lost** | sections |
|---|---|---|---|---|
| `literary-walden` | 115,813 | 115,510 | **303** | 48 |
| `literary-leaves-of-grass` | 121,712 | 110,353 | **11,359** | 908 |
| `literary-poems-blake` | 5,539 | 5,539 | 0 | 1 |

Whitman has lost **9.3% of Leaves of Grass** — some nine hundred lines. Blake
escaped only because its pattern matched so much that no scheme survived
validation, so nothing was consumed and the work arrived undivided instead.

Of Walden's 48 division names, seventeen are real chapters. **Thirty-one are
Thoreau's own prose**, and each one is a line no longer in the book:

```
  "Inde genus durum sumus, experiensque laborum,"
  "The wind that blows"
  "Two second-hand windows"
  "expeditions, using new passages and all improvements in"
```

### The line that proves it

Walden quotes a poem about Baker Farm. Project Gutenberg #205, our own cached
artifact, line 5798:

```
     “Thy entry is a pleasant field,
     Which some mossy fruit trees yield
     Partly to a ruddy brook,
     By gliding musquash undertook,
     And mercurial trout,
     Darting about.”
```

What RISE serves:

```
     “Thy entry is a pleasant field, Which some mossy fruit trees yield
     Partly to a ruddy brook, By gliding musquash undertook,

     Darting about.”
```

`And mercurial trout,` matched the pattern. The word *mercurial* does not
appear anywhere in our Walden.

### Why this ends the detector strategy

Every other defect in this document is something PRESENT that should not be:
a filename, a running head, a citation, a replacement character. A signature
can be written for each because there is something to match.

**A missing line has no shape.** There is nothing to detect. The text reads
perfectly — grammatical, in Thoreau's voice, continuous — and it is not what he
wrote. No sweep over our own payloads could ever find it, however clever, and
that is not a gap to be closed by a better sweep. It is the boundary of what
sweeping can do.

It was found by comparing our text against another edition, one word at a time,
and it was found in the first three thousand characters compared.

**This is the whole argument for ARCHIVE-CANON-SPEC**, and it was found the day
after that document was adopted, in a work already in the canon.

### Disposition

- **`literary-walden` — re-source before certification.** It is canonical and
  it is missing 303 words. Certification exists for exactly this.
- **`literary-leaves-of-grass` — withheld, and now with a measured reason.**
  11,359 words.
- **The patterns themselves — fix at the ingest, not the payload.** An
  unanchored capital class with `i` is the bug; the three works are the
  symptom. A heading pattern must be anchored on a literal the work actually
  uses (`CHAPTER`, `BOOK`, `CANTO`), or on a titled scheme read from section
  names.
- **A word-count reconciliation belongs in the ingest.** Source words in,
  payload words out, and a difference beyond the known front-matter trim is a
  failed ingest rather than a finished one. That check costs nothing and would
  have caught all three on the day they were made.

## 2k. A name is not the heading's text — 2026-08-19

**Class:** a structured heading flattened to a string, and a hierarchy dropped
at a file boundary. Both are the ingest reading less than the edition wrote.
Neither is visible to word reconciliation, because both lose STRUCTURE while
every word still arrives.

Found by a reader looking at the shelf, which is the third time that has been
how a defect of this class surfaced.

### The heading

A Standard Ebooks heading marks its own parts:

```xml
<hgroup>
  <h4 epub:type="z3998:ordinal z3998:roman">I</h4>
  <p  epub:type="title">Fyodor Pavlovitch Karamazov</p>
</hgroup>
```

`textContent` returns `I Fyodor Pavlovitch Karamazov`, which is three declared
facts pressed into one string with the label — printed by the stylesheet from
the section's own `epub:type` — silently absent. On the shelf that read as a
numeral that restarted twelve times and explained nothing.

The parts are read separately now: `se:label` or the section's unit word, then
`z3998:ordinal`, then `epub:type="title"`, composed as `Chapter I: Fyodor
Pavlovitch Karamazov`. Reconciliation still weighs the heading AS WRITTEN, so a
word a stylesheet prints is never counted as one we imported.

### The container

Dostoevsky's Books, Eliot's Books and Joyce's Parts are each filed as their own
spine document, so a chapter has NO ancestor to read within its own file. The
importer only composed ancestry it could see in one document, and so dropped
the level entirely — ninety-six chapters, and nothing to say which Book.

The spine is the edition's own statement of what contains what. A container
file now opens a scope that governs every reading after it, and closes every
scope at its own depth or deeper: Part I holds Books I–III, and Part II must
close Book III before it closes Part I.

**Composition happens after numbering, not before.** Joyce titles none of his
episodes; prefixing first left three readings called "Part I" where eighteen
belonged.

### Signature

Not a line-level defect, so the registry cannot hold it (§3g). It is an
ingest-time invariant instead, and the ingest now asserts all three:

| invariant | what it catches |
|---|---|
| no two readings of a work share a name | a hierarchy silently dropped |
| no name is a bare numeral, a slug, or `Untitled` | an id or a position leaking into a reading |
| words in equal words out | anything textual, as before |

All fifteen canon works were re-ingested against these. Zero duplicates, zero
bare names, zero words lost.

---

## Open, as of 2026-08-18

| | |
|---|---|
| ~~re-source Walden~~ | **done 2026-08-18** — Standard Ebooks, 18 chapters, 0 lost |
| ~~fix the three unanchored heading patterns~~ | **done 2026-08-18** — Whitman 908 sections → 23, 11,359 words recovered |
| ~~word-count reconciliation in the ingest~~ | **done 2026-08-18** — both ingests refuse an undeclared loss |
| Blake's ingest loses 39 words | **refused by the new check** — payload unchanged, work withheld |
| re-ingest five verse works with lineation | not started — §2h |
| a work-level audit for shape defects | not started — §3g |
| `[Picture: …]` caption signature | not started — §2h |
| Corpus Hermeticum's division scheme | review — §2i |
| Blake's edition: acquire, or declare on the card | review — §2h |
| Rilke: 14 U+FFFD, 89 undecoded HTML entities | open, needs a ruling |
| Le Morte's two Front matter sections | want the Karenina treatment — §3e |
