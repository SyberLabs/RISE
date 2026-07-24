# Page Mode — the Illuminated Reader

**A second projection of a reading: not words flowing through time (the RSVP
Stream), but text and image composed in space — an automated typesetter that
lays out beautiful, re-readable pages from the same session the Stream plays.**

Status: SPEC — no implementation yet. A sibling to `CONTINUOUS-FIELD-SPEC`.
Direction chosen: an **automated typesetter** (the engine composes; the reader
reads — never a manual frame-dragging canvas), whose first incarnation is the
**illuminated single-column reader**. Rulings by the creator are marked ✦;
open questions ⁇.

---

## 1. The insight

R.I.S.E. today is a **temporal** medium: RSVP streams words through time. The
first outside eyes wanted a **spatial** one — text and image arranged in a
page. These are not two products; they are **two projections of one session**.
The Stream flows the reading's atoms through *time*; the Page flows the same
atoms through *space*. Same corpus, same pericope bindings, same reverence —
one renderer plays it, the other typesets it.

This is the fourth stance in `NORTH-STAR.md` ("Study") given a body.

### Why R.I.S.E. is unusually ready for this
A layout engine is only as good as the structured content it lays out, and we
already produce it:

- **Atoms carry structure** (`models.js`): `content`, `modality`
  (text/image/symbol), `weight` (semantic importance 0–1), `complexity`,
  `tags`, `phase`, and — for scripture — `chapter`/`verse` coordinates.
- **The pericope engine already binds image to passage.** The visual program's
  disjoint, ordered segments (`pericope-program.js`) say *which collection
  belongs to which verse range*. The Page does not have to guess where a
  painting goes — the domain already authored it.
- **We have an aesthetic.** The reverent, dim, glass-tile look (Genesis,
  behind-stream, the Gallery) is the Page's visual language already.

So the Page is a **new renderer over data we already produce** — exactly as the
Gallery was a new presenter over pools the cortex already resolves. It invents
no new content and no new source machinery.

## 2. What it is (and is NOT)

✦ **An automated typesetter, not an authoring canvas** (creator's ruling). The
engine composes each page from the flow; the reader reads. There is no
drag-and-drop, no manual frames, no guides. This is not a scope compromise —
it is the philosophy: *content authors, the runtime follows, the cortex
renders.* Putting composition in the user's hands would contradict the law the
whole system is built on.

✦ **First incarnation: the illuminated single-column reader.** A vertically
scrolling column of well-typeset text down which, at each pericope boundary,
the passage's bound image appears in a composed placement — full-bleed, inset,
or margin. No multi-column grid, no text wrap, no spread pagination in v1.
~80% of the emotional payoff (the right image beside the right word, in space,
re-readable, shareable) for a fraction of the effort, and it reuses the
pericope engine directly. The full grid engine grows *underneath* this later
(§9), never blocking it.

The Page:
- **Typesets, never streams.** The whole reading is present at once; the reader
  moves at their own pace, re-reads, lingers. (Contrast the Stream, which the
  reader cannot outpace.)
- **Places the bound image at its passage.** The Christ-before-Pilate plate
  lands with the verses it illustrates, because the program already said so.
- **Honors reverent degradation.** A work that will not load is simply absent —
  the text composes without it, never a broken frame, never a placeholder.
  Sacred imagery stays pinned and never searched; the face of Christ is never
  procedurally generated. A works-less episode is sanctioned stillness: text
  alone, beautifully set.
- **Is theme-aware and legible.** The dim, glass aesthetic; text always
  readable over imagery (a scrim, exactly as the Gallery uses).

## 3. Architecture: flow → composition → render

Three stages, mirroring InDesign's own separation of *story*, *layout*, and
*page* — and mapping cleanly onto our three-layer law.

```
   atoms + visualProgram                    (content, already authored)
            │
            ▼   the FLOW COMPILER  (Layer 1 — domain-shaped)
   an ordered Flow of BLOCKS
            │
            ▼   the COMPOSITOR    (Layer 2 — generic, aesthetic rules)
   a Composition (blocks + placements + breaks)
            │
            ▼   the PAGE RENDERER (Layer 3 — DOM, theme, scroll)
   the illuminated reading on screen
```

### 3.1 The Flow (the "story")
The flow compiler turns a session's atoms + visual program into an **ordered
list of blocks**:

- **TextBlock** — a run of text grouped by paragraph (and, for scripture, by
  verse), carrying its coordinate, `weight`, and `tags`. Verse numbers become
  optional marginal marks.
- **ImagePlacement** — a passage-bound image: `{ collectionId, atRange,
  emphasis }`. Emphasis derives from the segment (a whole-episode plate is
  full-bleed; a single-verse image is inset). The image URL is resolved lazily
  by the *same* provider path the cortex uses — the Page is a pool consumer,
  not a new fetcher.
- **StructuralMark** — chapter opening, episode boundary (a pericope segment
  edge → a natural section break/rule), pause.

This is Layer 1: domain-shaped, the only stage that knows what a pericope or a
verse *means*. Non-scripture readings still compile a flow (text blocks +
whatever sourced/curated imagery the reading carries), just without verse
coordinates — the Page is not Chapel-only.

### 3.2 The Composition (the "layout")
The compositor is **generic and domain-agnostic** — it knows blocks, emphasis,
and aesthetic rules, not pericopes. It decides, for the single-column v1:

- **Placement** of each ImagePlacement relative to its bound text: full-bleed
  band, inset figure (with caption), or margin plate. Driven by `emphasis` and
  a small rule set, not per-work authoring.
- **Rhythm**: spacing before/after images, section breaks at episode
  boundaries, the opening drop for a chapter.
- **Widow/orphan restraint** even in one column (don't strand a lone verse
  under an image).
- **Reverent gaps**: a works-less episode gets deliberate breathing room, not a
  scramble to fill it.

The compositor emits a **Composition**: an ordered list of positioned blocks
the renderer can lay out top-to-bottom. It is pure data — unit-testable with a
fake flow, no DOM (the lesson from the Gallery presenter and the scheduler).

### 3.3 The Page renderer (Layer 3)
DOM + CSS. Takes the Composition and renders the scrolling column: typeset text
on the reading's ground, images in their composed placements with the legibility
scrim, verse marks in the margin, section breaks at episodes. Theme-aware
(light/dark), responsive (the column re-flows to width; images `max-width:100%`;
full-bleed bands honor the viewport). Lazy-loads images as they approach the
viewport, decode-before-reveal (SacredImage's contract).

## 4. Relationship to the Stream (and the stances)

Page and Stream are **two renderers of one compiled session** — the reader
chooses the projection, and can switch. Neither is primary.

- Selected as the **"Study" stance** (`NORTH-STAR.md`) or a Stream⇄Page toggle
  in the reading surface.
- Both consume the same atoms and the same `visualProgram`. The Page reads the
  program as *spatial* placement; the Stream reads it as *temporal* cues. The
  program-loss discipline (persist `visualProgram` with the reading —
  [[mt27-program-loss]]) protects both equally; the Page is if anything a
  forcing function to get that right.
- ✦ The Page has **no flash economy and no advance clock** — it is static space,
  not timed presence. Therefore no VisualFlashGate, and photosensitivity is
  moot for motion (there is none). Reduced-motion is trivially satisfied.

## 5. Safety & reverence

- **Reverent degradation** as everywhere: a missing work is absent, never
  broken; the text composes around its absence.
- **Sacred invariants hold**: pinned imagery never searched; no generated face
  of Christ; fixed liturgical forms unchanged; a works-less pericope is
  stillness (text alone), never substituted.
- **No new provider surface.** The Page resolves images through the existing
  pool/provider path; it introduces no new fetch, no new category, no new
  registry. `aic-*` ids untouched.
- **Legibility is a safety property here**: text over imagery always passes the
  scrim; a full-bleed image never swallows its own caption or the verses it
  serves.

## 6. What v1 deliberately excludes (grows later, §9)

- **Multi-column grids, baseline grid, text wrap around figures.** v1 is one
  column; wrap and columns are the grid engine's job.
- **Spread pagination** (book-like left/right pages). v1 scrolls; pagination is
  an alternate renderer over the same Composition later.
- **Manual overrides** (pin bigger, force break, choose template). The
  automated composition ships first; a thin override layer is the
  "automated + light overrides" middle path, added once we see what readers
  actually reach for.
- **Export (PDF/image/MP4).** Distribution, not experience — deferred with the
  MP4 note in `NORTH-STAR.md`. A well-built Page is, however, natively
  screen-recordable and print-CSS-friendly, which gets 80% of sharing for free.

## 7. Build order

1. **The Flow compiler** (`src/page/flow.js` or sibling): atoms + visualProgram
   → ordered blocks. Pure, unit-testable with fake atoms + a fake program.
   Reuses the scheduler's coordinate logic (`cueForAtom`) so image↔passage
   binding is *the same truth* the Stream uses — not a parallel implementation.
2. **The Compositor** (`src/page/compositor.js`): flow → Composition, the
   placement/rhythm/restraint rules. Pure, unit-testable with a fake flow and a
   fake image-resolver. This is where the "InDesign intelligence" lives, and
   where the aesthetic is encoded.
3. **The Page renderer** (`src/page/PageReader.js` + CSS): Composition → the
   scrolling illuminated column. Theme-aware, responsive, lazy + decode-before-
   reveal. Reuses the glass/scrim language from Chamber.css.
4. **Reading-surface wiring**: the Stream⇄Page toggle (or the "Study" stance),
   sharing the compiled session. No new session machinery.
5. **Safety & reverence pass**: missing-work absence, works-less stillness,
   legibility scrim, sacred-invariant tests.
6. **Live verify + a shareable moment**: a Gospel chapter reads as an
   illuminated column, images at their passages; confirm print-CSS and
   screen-record both look composed.

## 8. Why this order

The flow and compositor are **pure data transforms** — the hard, valuable,
testable core, provable without a browser (the discipline that made the Gallery
and the scheduler solid). The renderer is the last, thinnest layer. And because
the flow reuses the scheduler's coordinate logic, the Page and the Stream can
never disagree about which image belongs to which verse — one binding, two
projections.

## 9. The path to the full grid engine (later, not now)

The single-column reader is the floor, not the ceiling. The Composition is a
deliberately renderer-agnostic data structure so the grid engine can grow
*underneath* it without a rewrite:

- v2: a **grid/baseline** system — columns, a baseline grid so text and images
  align, real **text wrap** around inset figures.
- v3: **master pages / templates** — a small library expressing the aesthetic
  (a chapter-opening spread, an episode plate, a psalm setting), chosen by the
  compositor per section.
- v4: **spread pagination** — the same Composition rendered as book-like
  spreads, and the light **override** layer (pin/break/template) for the reader
  who wants a nudge.

Each is an enrichment of the compositor or an alternate renderer over the same
Composition — never a fork of the flow. The illuminated single-column reader
earns its keep first; the InDesign-grade engine follows the demand it reveals.

---

*The frame is the creator's: an InDesign-like framework meaning an automated
typesetter — the engine composes beautiful pages from structured content, the
reader reads them — beginning with a single illuminated column where the right
painting lands beside the right word, in space this time, re-readable and
shareable. Built as pure flow + composition transforms with a thin renderer,
reusing the pericope binding the Stream already trusts, honoring every sacred
and reverent invariant, with the full grid engine mapped to grow underneath.*
