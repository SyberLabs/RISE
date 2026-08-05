# The Typesetting Canon

**Status:** living · rules 1–3 implemented
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

## 2. Rules worth encoding next

Ordered by how visible the defect is when the rule is missing.

### R4 — Widow and orphan control *(book practice; the oldest rule there is)*

No single line of a paragraph alone at the top of a page (a widow), and no
single line alone at the foot (an orphan). The paginator already knows a
paragraph's estimated line count, so it can refuse a break that leaves one line
stranded and push the whole paragraph instead. This is the most conspicuous
thing a paginated column can get wrong, and right now nothing prevents it.

### R5 — A plate takes the head or the foot, not the middle *(book practice)*

Traditional composition puts a full-measure plate at the top or bottom of a
page, never floating in the middle of running text where it cuts the column in
half. The paginator knows where a figure lands within a page and could move it
to the nearer edge.

### R6 — Facing rhythm across a turn *(book practice)*

A wrapped figure alternates sides so a chapter reads as a spread — the
compositor already does this. Paginated, the alternation should reset per page
rather than run continuously, or the "spread" is imaginary.

### R7 — The measure is 45–75 characters *(canon; Bringhurst)*

The Page targets 62–70 and the mobile step lands near 40, which is short. Worth
measuring against real readings rather than assuming: a short measure with
ragged-right is calmer than the number alone suggests.

### R8 — Optical rather than mechanical centring *(book practice)*

The article's own comment already records this for the hanging verse marks. The
same correction applies to centred headings when marginal numbers are present —
untested, and possibly invisible.

### R9 — No two plates without prose between them *(my judgement, not canon)*

The compositor has a bleed-run limit; the paginator has none. Two plates that
land on one page with nothing between them read as a contact sheet.

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
