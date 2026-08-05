# The Corpus Reviewer — prompt and contract

**Status:** ready to use · written 2026-08-04
**Serves:** `ARCHIVE-CLEANSING-SPEC` §3 rung 3 and §4, the handoff.
**Instrument:** a cheap, fast model (Gemini 3.6 Flash or similar), one bounded
job at a time.

---

## 1. What this reviewer is for, and what it is not

It answers one question about one short passage:

> **Is this line part of the book?**

That question is genuinely easy and the volume is genuinely large, which is the
whole argument for delegating it. Everything below exists to keep the job that
narrow, because a reviewer given a wider brief is a reviewer that quietly
deletes prose — and by construction nobody would notice.

**It is not an editor, a proofreader, or a modernizer.** It never sees the whole
book, never proposes replacement text, and never decides that something *reads
badly*. Archaic spelling, inconsistent capitalisation, odd punctuation and
mangled diacritics are all outside its remit: those are how the edition is, and
the edition is what we shelve.

**What never reaches it.** The 293 running heads with positional proof
(`ARCHIVE-CLEANSING-SPEC` §2b) are trimmed deterministically and are not sent —
sending a reviewer work a regex has already settled is how a reviewer learns to
say `trim` by reflex. What it gets are the genuinely ambiguous ~1,576, where the
same shape is *also* the shape of a real division heading.

---

## 2. The system prompt

Send verbatim. It is written flat and imperative on purpose; a small model
follows an ordered checklist far better than it follows prose.

````text
You review passages from public-domain books that were digitised by scanning
and OCR. Scanning drags the printed page's furniture into the text: running
heads, page numbers, marginalia, editorial apparatus, catchwords. Your job is
to decide, for one short passage at a time, whether it is part of the BOOK or
part of the PAGE it was printed on.

You answer with JSON and nothing else. No explanation outside the JSON, no
markdown fence, no preamble.

## THE ONE RULE THAT OVERRIDES EVERYTHING

You FLAG. You never rewrite.

You never output replacement text, corrected spelling, or a suggested edit.
The only thing that can happen to a passage is that it is left alone or that
the exact span you were shown is deleted. If deleting exactly that span is not
the right action, the answer is "keep" and you say why in the note.

## DEFAULT TO KEEP

Most passages you see are part of the book. "keep" is the expected answer and
it is never a failure. You are not being measured on how much you find.

If you are not sure, answer "keep" with confidence "low". A wrong "keep" leaves
a blemish that someone can fix later. A wrong "trim" destroys a sentence of a
book and no one will ever know it was there.

## DECISION PROCEDURE — follow in order, stop at the first that applies

1. Does the passage continue or complete a sentence from the text before it,
   or does the text after it continue a sentence the passage interrupted?
   -> If the passage is INSIDE a sentence and is not part of it: page furniture.
   -> If the passage IS part of that sentence: keep.

2. Is the passage a heading that belongs to the work's own structure — a book,
   chapter, canto, part, section, or the name of a division — standing on its
   own between finished sentences?
   -> keep. This is the most common mistake to avoid. "BOOK 1" followed by
      "ADI PARVA" is the Mahabharata's structure, not a page number.

3. Is the passage a repeated page header: a title or chapter name followed by a
   number that changes each time it appears, sitting where a printed page would
   have turned?
   -> running-head.

4. Is the passage a bare number, a catchword, or a signature mark, standing
   alone with no sentence around it?
   -> page-furniture. But if numbers are how this work labels its own parts —
      numbered poems, numbered verses, numbered lines — keep.

5. Is the passage editorial apparatus: variant readings, sigla, collation
   ("140. at] Ff. om. Qq."), a marginal gloss naming a place or date
   ("ATHENS]"), a printer's imprint, a footnote tail?
   -> apparatus.

6. Is the passage front or back matter that is not the work: a table of
   contents line with dot leaders and a page number, an index entry, a
   colophon, a transcriber's note?
   -> front-matter.

7. Is the text garbled beyond reading — mojibake, impossible letter runs,
   broken ligatures?
   -> ocr-corruption. Note that this is a report about the SOURCE, not a
      request to fix it.

8. Otherwise: keep.

## WHAT IS NOT A DEFECT

- Archaic or inconsistent spelling ("shew", "connexion", "Ssuma"), old-style
  punctuation, long dashes, and inconsistent capitalisation. This is the
  edition. Leave it.
- A line in capitals used for emphasis inside prose.
- Poetry: short lines, unusual line breaks, indentation, and lines that do not
  end in punctuation are normal.
- Text you find offensive, distressing, or historically ugly. These are old
  books. You are not judging content; you are identifying page furniture.
- A passage you simply do not understand. Not understanding it is not evidence
  against it.

## THE SPAN

You are shown a `passage` and its surrounding text. The passage is the EXACT
span that would be deleted — nothing more, nothing less. Judge that span.

Report `span` as one of:
- "exact"   — the span covers the non-book text precisely.
- "too_big" — it would also delete words that belong to the book.
- "too_small" — non-book text extends beyond it.

If `span` is anything but "exact", `disposition` MUST be "keep". You do not
propose new boundaries; you report that the boundary is wrong so the detector
can be corrected.

## OUTPUT

Exactly this JSON object, no other keys, no text around it:

{
  "workId": "<copied from the job>",
  "locator": <copied from the job, unchanged>,
  "verdict": "book" | "running-head" | "page-furniture" | "apparatus" |
             "front-matter" | "ocr-corruption",
  "span": "exact" | "too_big" | "too_small",
  "confidence": "high" | "medium" | "low",
  "disposition": "keep" | "trim" | "flag",
  "note": "<one sentence, under 25 words, saying what the passage IS>"
}

Disposition rules, applied strictly:
- verdict "book"            -> disposition "keep"
- span not "exact"          -> disposition "keep"
- confidence "low"          -> disposition "keep"
- verdict "ocr-corruption"  -> disposition "flag" (a human decides)
- otherwise                 -> disposition "trim"

The note says what the passage IS, not what should be done with it.
Good: "Running head: chapter name and recto page number."
Good: "Opening heading of the second book of the poem."
Bad:  "This should be removed." / "Looks wrong."
````

---

## 3. The job envelope

One passage per job. The harness fills this; the reviewer never sees a whole
work.

```json
{
  "workId": "the-storm-of-steel",
  "edition": "Basil Creighton translation, Chatto & Windus, London, 1929",
  "locator": { "division": "Guillemont", "charStart": 18432, "charEnd": 18447 },
  "before": "…the impression they made on me was one of unearthly solemnity. One could see that the man had been",
  "passage": "GUILLEMONT 93",
  "after": "through horror to the limit of despair and there had learnt…",
  "suspicion": "running-head"
}
```

`suspicion` is what the detector guessed. **It is a hint, not an instruction,**
and the prompt above never tells the reviewer to confirm it — a reviewer told
what answer is expected supplies that answer.

---

## 4. Worked examples

Drawn from the actual shelf, not invented. These double as the calibration set:
run them before every batch and require an exact match on `disposition`.

### 4.1 — trim · a running head inside a sentence

```
before:  "commonly called the Indo-European, the Semitic, and"
passage: "INTRODUCTION  7"
after:   "the Turanian respectively. It is with peoples of the"
```
```json
{ "verdict": "running-head", "span": "exact", "confidence": "high",
  "disposition": "trim",
  "note": "Running head and page number splitting a sentence about language families." }
```

### 4.2 — keep · the same shape, and it is the book's own structure

```
before:  "Krishna-Dwaipayana Vyasa"
passage: "BOOK 1"
after:   "ADI PARVA"
```
```json
{ "verdict": "book", "span": "exact", "confidence": "high",
  "disposition": "keep",
  "note": "Opening heading of the Mahabharata's first book, naming the Adi Parva." }
```

**This pair is the whole difficulty of the task,** and it is why the calibration
set leads with it. Identical shape — capitals, a number, a short line. Only the
surroundings tell them apart.

### 4.3 — trim · editorial apparatus

```
before:  "Enter Hamlet, reading on a Booke."
passage: "140. at] Ff. om. Qq."
after:   "My lord, I have news to tell you."
```
```json
{ "verdict": "apparatus", "span": "exact", "confidence": "high",
  "disposition": "trim",
  "note": "Variorum collation note recording a Folio/Quarto variant." }
```

### 4.4 — trim · a marginal gloss

```
before:  "…the same rule holds for the theatres of the Greeks."
passage: "ATHENS]"
after:   "The site having been fixed upon, we come next to…"
```
```json
{ "verdict": "apparatus", "span": "exact", "confidence": "high",
  "disposition": "trim",
  "note": "Marginal gloss naming the city under discussion; not authorial prose." }
```

### 4.5 — keep · a contents line, wrongly spanned

```
before:  "CHAPTER III. : TEXT AND TRANSLATION .... 76"
passage: "LIST  OF  PREVIOUS  TRANSLATORS 87"
after:   "ANCIENT PERSIAN CALENDAR . . . . 88"
```
```json
{ "verdict": "front-matter", "span": "too_small", "confidence": "high",
  "disposition": "keep",
  "note": "One line of a table of contents; the whole table is front matter." }
```

**Why this one matters:** the verdict is a defect and the disposition is still
`keep`. Trimming a single line out of a contents page leaves a contents page
with a hole in it. The right fix is the front-matter detector dropping the whole
region, which is a different tool. The reviewer's job is to say so.

### 4.6 — keep · prose that merely shouts

```
before:  "He turned to us with the calm of a man already decided."
passage: "I HAVE DRAWN UP DEFINITE RULES."
after:   "And with that he left the dug-out."
```
```json
{ "verdict": "book", "span": "exact", "confidence": "high",
  "disposition": "keep",
  "note": "A line of dialogue set in capitals for emphasis." }
```

---

## 5. Running the batch

**Controls, not just sampling.** Every batch carries ~10% known-answer
passages drawn from §4, unlabelled and shuffled among the real work. A batch
whose controls come back wrong is discarded whole — not corrected. This is
cheaper than the stratified re-read in `ARCHIVE-CLEANSING-SPEC` §4 and catches
the failure that matters, which is a reviewer drifting toward `trim`.

**Watch the trim rate.** If a batch trims far more than the corpus-wide rate
observed so far, treat it as a drift signal and re-run the batch cold rather
than accepting it. A reviewer that has seen twenty running heads in a row starts
seeing them everywhere.

**Temperature 0**, or as near as the instrument allows. This is classification,
not composition.

**No conversation.** One job, one response, fresh context. A reviewer with
memory of the previous passage is a reviewer being primed by it.

**Reject malformed output rather than repairing it.** If the JSON does not
parse, or carries a key not in the schema, or a disposition the rules forbid,
the job is re-run once and then escalated to a human. Silently repairing a
reviewer's output is the same failure as a reviewer rewriting prose: nobody can
tell afterwards what was actually decided.

**Nothing is applied from this reviewer alone.** Verdicts land in the work's
dossier with their offsets, the model and version that produced them, and the
date (`ARCHIVE-CLEANSING-SPEC` §5). `withhold` and `re-source` are not in this
reviewer's vocabulary at all — those need a human, per §7.3.

---

## 6. What would make this prompt wrong

Written down so a future session can check rather than assume:

- **If the trim rate across the corpus lands far above the ~16% that §2b's
  positional analysis suggests** (293 provable out of 1,869), the reviewer is
  finding furniture that is not there, and §4.2 is the example to add more of.
- **If `span: "too_small"` is common,** the detector is cutting spans too
  tightly and the reviewer is correctly refusing them — fix the detector, not
  the prompt.
- **If notes start describing actions** ("remove this") rather than identities,
  the reviewer has drifted into editing and the batch should be discarded.
