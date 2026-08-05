# The Typesetting Canon

**Status:** living · rules 1–4, 9 and 10 implemented · R5 refused, R6 deferred
**Scope:** the compositor (`src/page/compositor.js`) and the Page's CSS.
**Purpose:** encode book-printing practice as rules a program can apply, so the
Page composes rather than merely arranges.

---

## 0. On sources, honestly

The literature this draws on is the standard one — Bringhurst's *The Elements of
Typographic Style*, Hochuli & Kinross's *Designing Books*, Tschichold's *The
Form of the Book*, and the Chicago Manual's composition chapters. I am writing
from knowledge of that tradition, not from a fresh reading of those volumes, and
a web pass returned only the general principle that
[headings are normally centred for a symmetrical, formal document](https://www.oreilly.com/library/view/typography-essentials/9781592535231/xhtml/ch87.html)
alongside the [counter-position that flush-left is the safer default for screens](https://www.k-state.edu/webservices/cms/best-practices/text-flush-left.html).

That disagreement is real and worth recording: **flush-left is the web's
default; centred is the book's.** This Page is a book projection, so it takes
the book's side — but the rule below says so as a choice, not as a fact.

Where a rule is contested, this document says which tradition it comes from.
Where it is my judgement, it says that too.

---

## 1. Rules implemented

### R1 — A heading is centred *(book practice)*

The raised chapter mark has always been centred here. An inline heading — one an
edition carries as an ordinary paragraph, like Vitruvius's `CHAPTER I` — is the
same object arriving through a different door. Setting one flush-left beside the
other reads as two systems on one page.

Centred headings also wrap **balanced** (`text-wrap: balance`) and are bounded to
26em, because a centred line that leaves one word alone on a second line shows
its widow more cruelly than a ragged-right one does.

### R2 — A figure beside a title does not wrap *(book practice)*

A heading is a symmetrical object, and the space beneath it belongs to it. A
figure floated into that space turns an opening into a shop window — the exact
Vitruvius fault, where a wrapped plate sat level with `CHAPTER I` and pushed
`THE EDUCATION OF THE ARCHITECT` onto two lines.

Adjacent to a heading, a figure becomes a **centred plate on the full measure**.
It keeps the symmetry the heading establishes instead of competing with it.
"Adjacent" means the item before it is a heading, or the block after it is.

### R3 — An inline heading earns air, and is never stranded *(book practice)*

Space above a heading exceeds space below it, so the heading binds to the text
it introduces rather than floating between two blocks. Two openings in a row
collapse to one (a chapter mark followed by a section title does not open the
space twice). And the paginator will not end a page on one, exactly as it will
not end on a raised chapter mark.

---

### R4 — No page alone with one paragraph *(book practice, reframed)*

**The classic widow and orphan cannot occur in this design, and that is worth
knowing rather than guarding against.** The paginator moves WHOLE items, so a
paragraph is never split across a boundary and no single line is ever stranded.
The rule every book follows is structurally satisfied before it is written.

Its item-level cousin does occur: a page carrying one short block — usually the
tail of a reading — which reads as a page that ran out rather than one that was
composed. The fix is the compositor's rather than the cram: the thin page
**borrows the block above it** instead of being merged upward, so both pages
have something to say and neither exceeds its budget. That is what a compositor
does when it pushes a line back to balance a spread.

Two things it will not do. It will not borrow a plate down onto a lone
paragraph, which trades this fault for R9's. And it will not borrow prose out of
a **wrap group**: a margin figure and the text flowing beside it are one atom,
so taking a paragraph from the group unmakes the wrap upstairs to fix a thin
page downstairs.

### R10 — Nothing stands inside a title *(book practice)*

"CHAPTER I" and "THE EDUCATION OF THE ARCHITECT" are two blocks and one
heading. R2 stopped a figure cued between them from WRAPPING, and centring it
was not enough: centred or floated, it still separated a chapter number from
the chapter's name, which no book does. The heading group is atomic. A figure
that falls inside one is held and emitted directly beneath the finished title,
centred on the full measure.

**A float must also not WRAP a title.** This is where the Vitruvius page
actually went wrong, and adjacency was the wrong diagnosis twice over. A raised
chapter mark ends a wrap run, but an inline heading is an ordinary text block —
so `proseAfter` counted "CHAPTER I" and "THE EDUCATION OF THE ARCHITECT" as two
more paragraphs to wrap and ran the group straight past the title. The figure
was never adjacent to a heading; its wrap group had swallowed one, which is
exactly why two rounds of fixing adjacency changed nothing on screen. A title
now ends a wrap run as firmly as a chapter mark does.

**Moving a held figure, which R5 was refused for, differs in the
distance.** R5 slid a plate past PROSE, to a passage that did not summon it.
R10 moves it past the remaining half of a heading — the same juncture, the same
passage, on the far side of a title rather than inside one. The binding is
unchanged; only the title is left whole.

### The precedence between rules *(engineering, not typography)*

The rules above are applied by two corrective passes over the cut, and the order
between them is a decision rather than an accident — they were once separate
patches that each assumed they ran last, and they undid one another three ways.
Stated once, and written where the passes are:

1. **Structure outranks balance.** A heading is a promise about what follows and
   a chapter is a beginning. Neither is negotiable for the sake of an evenly
   filled page.
2. **Balance runs last, and may not violate structure.** Every move it makes is
   checked against what the first pass established, rather than assumed to be
   compatible with it.

Nothing re-runs the first pass afterwards, because the second is constrained by
construction. That is the difference between an ordering and a pile.

A corollary worth keeping: **a rule that can only be satisfied by creating the
fault it prevents must yield.** R9 sealed a page whenever a plate followed a
plate, and three consecutive plates cannot satisfy that without stranding one
alone. R9 is a preference; prose on every page is not.

### R11 — A heading does not interrupt a sentence *(book practice)*

The heading heuristic reads SHAPE — short, all capitals, unpunctuated — and
shape is not enough. A Jünger page carried `GUILLEMONT 101` centred as a title
between "…the men were standing, rifle in hand … Now and" and "then by the
light of a rocket". It is not a title: it is the printed page's **running
head**, the chapter name and the recto page number, which that scan carries
eight times over as 93, 95, 97, 99, 101 … OCR left it where the page turned,
which was the middle of a sentence.

What gives it away is POSITION, not shape. A title follows a finished sentence
and is followed by something that begins. Both conditions are required, so a
heading opening a reading survives, and so does a genuine two-part title —
`THE FUNDAMENTAL PRINCIPLES` follows `CHAPTER II`, which ends no sentence, but
what comes after it does not begin in lower case.

This is the third time §4's standing constraint has had to be enforced in this
one function (`ATHENS]`, then bare sigla, now running heads), which is worth
noticing: **a scan's furniture is shaped like structure, and the compositor is
the last place able to tell the difference.** It does not repair the text —
that is `ARCHIVE-CLEANSING-SPEC`'s work — it only declines to promote damage.

### R9 — No two plates without prose between them *(my judgement, not canon)*

The compositor limits consecutive bleeds in the COLUMN; a page is a second frame
it cannot see. Two plates landing on one page with nothing between them read as
a contact sheet. A printed page happily carries two plates; a page this small,
on a phone, does not — which is why this is labelled judgement.

---

## 2. Rules worth encoding next

Ordered by how visible the defect is when the rule is missing.

### R5 — A plate takes the head or the foot, not the middle — **REFUSED as written**

Traditional composition puts a full-measure plate at the top or bottom of a
page, never floating in the middle of running text where it cuts the column in
half. The paginator does know where a figure lands within a page and could move
it to the nearer edge.

**It must not.** Moving a plate within a page reorders the reading, and the
image↔passage binding is the thing this whole architecture exists to protect:
the Page and the Stream share one binding so they "can never disagree about
which image belongs to which verse" (`PAGE-MODE-SPEC` §8). A plate slid to the
head of a page is a plate now sitting beside a passage that did not summon it.
The standing constraint in §4 forbids exactly this, and the rule was queued
without checking it against that constraint.

The book gets away with it because a book's plates are decorative or
positionally indifferent. Ours are bound. If the fault is ever worth addressing,
the honest route is the reverse: let the PAGINATOR choose a break that puts the
plate at an edge, rather than letting it move the plate.

### R6 — Facing rhythm across a turn — **deferred, and here is the obstacle**

The compositor alternates wrap sides so a chapter reads as a spread, and
paginated, that alternation should reset per page or the "spread" is imaginary.
The obstacle is ownership: `side` is assigned by the compositor, which runs
before pagination and knows nothing of pages, and the paginator must not mutate
the Composition it was handed. The clean route is for the RENDERER to derive
`side` per page at build time. Small, but not free, and cosmetic next to R4.

### R7 — The measure is 45–75 characters *(canon; Bringhurst)*

The Page targets 62–70 and the mobile step lands near 40, which is short. Worth
measuring against real readings rather than assuming: a short measure with
ragged-right is calmer than the number alone suggests.

### R8 — Optical rather than mechanical centring *(book practice)*

The article's own comment already records this for the hanging verse marks. The
same correction applies to centred headings when marginal numbers are present —
untested, and possibly invisible.

---

## 3. Rules deliberately not adopted

- **Justified text.** Ragged-right is calmer in a narrow measure and avoids the
  rivers a naive justifier opens. Already recorded in `page.css`.
- **Hyphenation.** Same reason. A book hyphenates because it justifies; this
  does not justify.
- **Drop caps.** A chapter mark already opens the space. A drop cap on top of it
  is ornament competing with structure.
- **Running heads on every page of a scrolling projection.** Furniture belongs
  to a paged reading; the scroll has its masthead.

---

## 4. The standing constraint

Every rule here is a rule about *arrangement*. None of them may alter a word of
the text, reorder a reading, or promote damage into structure — the heading
heuristic already learned that lesson when it turned `ATHENS]` into a section
title. Typography composes what it is given.
