# Pericope Imagery Specification

**Verse-precise sacred accompaniment: a chapter becomes a
deterministic visual schedule, not one undifferentiated pool.**

Status: SPEC — no implementation yet. Rulings by the creator are
marked ✦; open questions are marked ⁇. This spec operationalizes
`image_map/RISE_GOSPEL_ART_CONCORDANCE.md` (the research draft), the
first campaign of the Scholastic program.

---

## 1. The governing rule (inherited from the concordance)

> Map artworks to Gospel **pericopes**, not to whole Gospels or broad
> devotional buckets. A direct institutional identification outranks
> thematic resemblance; **stillness outranks substitution**.

The SOL review moved Passion imagery from whole Gospels to Passion
*chapters* (Mt 26–27…). This spec moves it to *pericopes*: within
Matthew 26, Gethsemane (26:36–46), the arrest (26:47–56), and Peter's
denial (26:69–75) are three different episodes, each carrying its own
verified works or, where none is retained, stillness. A chapter is
read as a **schedule of pericopes**, and the visual field follows the
reader's position through it.

## 2. What already exists (the seams this spec builds on)

- **Verse anchors are already parsed.** `chunk-profiles.js`
  (`prepareScripture`) reads the ingest's `[v C:V]` sentinels into
  `hints.scripture.verseAnchors = [{paragraph, chapter, verse}]` and
  strips them from display. Nothing displays or speaks the sentinel.
- **The chunker consumes hints.** It already threads
  `hints.dialogue` onto its paragraph loop
  (`speakerOrdinalByParagraph`). `hints.scripture` is prepared but
  **not yet consumed** — that is the one genuine build point (§4).
- **The pin pipeline is whole.** Pools, the streaming resolution,
  the sliding-window cortex, the Curia, the four museum adapters —
  all built. Pericope pools are ordinary pin pools keyed differently.

## 3. Data model

### 3.1 The concordance module

`image_map/rise-gospel-art-concordance.json` is the research artifact;
the runtime consumes a derived, frozen module
`src/content/chapel/imagery/pericopes.js`:

```js
export const GOSPEL_PERICOPES = Object.freeze([
  {
    id: 'gethsemane',
    book: 'matthew',            // resolved from the "Matthew 26:36-46" ref
    chapter: 26,
    verseStart: 36,
    verseEnd: 46,
    coverage: 'DIRECT',         // DIRECT | COMPOSITE | RELATED | GAP
    works: [ { source, id }, … ] // only pin-ready, contact-sheet-cleared
  },
  …
]);
```

- Derived by a build script from the JSON, NOT hand-maintained twice.
  The JSON stays the human/research surface; the module is machine
  output (the Curia/Atlas precedent: one machine-writable canon).
- **Only pin-ready, reviewed works enter the module.** `hold`,
  `needs_contact_sheet`, `needs_athena_id`, `needs_persistent_id`
  works are excluded until they clear — a GAP pericope with no
  cleared works resolves to stillness, never a guess.
- Multi-chapter or cross-book pericopes (rare) carry an array of
  {book, chapter, verseStart, verseEnd} ranges; §4's lookup tests
  each range.

### 3.2 Atom verse tagging

Every scripture atom gains two optional integer fields, set only
when a scripture profile ran:

```
atom.chapter   // e.g. 26
atom.verse     // e.g. 39  (the verse whose paragraph this atom came from)
```

Non-scripture atoms never carry them; the fields are absent, not null.

## 4. The build point: threading anchors onto atoms

`hints.scripture.verseAnchors` maps *paragraph ordinal* → (chapter,
verse). The chunker walks paragraphs in order; a paragraph without
its own sentinel inherits the last one seen (verse text can wrap
across the chunker's paragraph split). So:

1. Before the paragraph loop, build `verseByParagraph`: for each
   paragraph ordinal, the (chapter, verse) in force — the most
   recent anchor at or before it. (Exactly the shape of
   `speakerOrdinalByParagraph`.)
2. Inside the loop, every atom minted from paragraph *p* is stamped
   with `verseByParagraph.get(p)`.

This is additive: absent `hints.scripture`, no atom is stamped and
every existing behavior is byte-identical.

✦ **Ruling — paragraph ordinals are the ingest's, not the slice's.**
`prepareScripture` numbers paragraphs from the text it receives. A
chapter launch slices before chunking, so ordinal 0 is the chapter's
first verse — consistent within a reading. (Whole-book launches
number from the book's first verse; same consistency.) The lookup
never needs a global position, only (chapter, verse), so this is
sound either way.

## 5. Pericope resolution

A pure function, unit-testable in isolation:

```js
pericopeForVerse(book, chapter, verse) → pericope | null
```

- Returns the pericope whose range **contains** (chapter, verse) for
  this book.
- ✦ **Overlaps are real — narrowest wins.** The Gospels nest and
  adjoin episodes: the flagellation sits *within* the Pilate scene
  (Mt 27:26), Noli me tangere *within* the resurrection
  (Jn 20:11–18). When a verse falls in more than one pericope's
  range, the lookup returns the **narrowest** — the most specific
  episode the reader is in. (The spec's first draft assumed
  non-overlap; the concordance data proved richer. The build script
  reports overlaps as a sanity trace, never a failure.)
- A verse in no pericope's range → `null` → stillness. Most of a
  Gospel is *not* a mapped episode; null is the common, correct case.

## 6. Runtime: three layers, one law

✦ **The law (the architecture's governing rule):**

> **Content domains author schedules. The session runtime follows
> schedules. The cortex renders cues.**

Three layers, each ignorant of the one above it:

```
Chapel concordance (pericopeForVerse, narrowest-wins, evidence classes)
        ↓  compiles
Chapel handoff → a GENERIC visual program (coordinate-tagged segments)
        ↓  followed by
Generic visual scheduler (reads atom coordinates, emits cues)
        ↓  commands
Chapel-AGNOSTIC cortex (activates / suspends pools by cue)
```

The cortex must **never** import the concordance, know a Gospel book,
or resolve a pericope. It knows how to resolve pin pools, warm them,
draw without repetition, switch sources, suspend imagery, and cancel
stale requests. It does not know what Matthew 27:26 *means*. This
boundary is what keeps the cortex from accreting a domain conditional
for every future content type (Scholastic commentary sections, poetry
stanzas, historical periods) — those become new *compilers*, not new
cortex branches.

### 6.1 The generic visual program (the Chamber contract)

The handoff compiles the pericope concordance into a domain-neutral
program on `config.visualProgram`. No Chapel vocabulary leaks into
the Chamber contract — it speaks *coordinates* and *cues*:

```js
config.visualProgram = {
  coordinateSpace: 'scripture',   // atoms carry {chapter, verse}
  enabled: true,                  // false when a chosen icon locks the focal
  segments: [                     // DISJOINT, ordered, non-overlapping
    { id: 'before-pilate', match: { chapter: 27, verseStart: 11, verseEnd: 25 },
      cue: { kind: 'sourced', collections: ['chapel-gospel-before-pilate'] } },
    { id: 'flagellation',  match: { chapter: 27, verseStart: 26, verseEnd: 26 },
      cue: { kind: 'sourced', collections: ['chapel-gospel-flagellation'] } },
    …
  ],
  fallback: { kind: 'still' }     // or { kind: 'focal', focal: {…} } — the rose
};
```

The scheduler's contract is narrow — it understands that atoms may
carry coordinates and that segments match ranges; it does **not**
understand pericopes:

```js
const cue = cueForAtom(program, atom);     // linear scan; segments are few
if (cue.id !== activeCueId) {
  activeCueId = cue.id;
  cortex.applyCue(cue, { generation: ++cueGeneration });
}
```

### 6.2 Overlap is flattened at COMPILE time

✦ The concordance's overlaps are real *content semantics* (§5), but
the executable schedule must be **disjoint** — one cue governs each
displayed verse. The compiler flattens overlaps by narrowest-wins so
the runtime never arbitrates:

```
Research (may overlap):        Executable (disjoint):
  before-pilate 27:11-26   →     before-pilate 27:11-25
  flagellation  27:26-26   →     flagellation  27:26-26

  resurrection  20:1-18    →     resurrection  20:1-10
  noli-me-tangere 20:11-18 →     noli-me-tangere 20:11-18
```

The concordance is NOT mutated — the true conceptual overlap stays in
the research JSON and the runtime module. Only the compiled *session
schedule* is disjoint. Two representations, each correct for its
purpose.

### 6.3 Cue lifecycle

- **One activation per segment.** A segment holds for its whole
  range, so most atoms match the active cue and cause no switch.
  Crossing 26:46→26:47 switches; 26:39→26:40 does not.
- **A segment with no works, a GAP, or an unmapped verse → the
  fallback cue** (stillness, or the rose if the fallback is focal).
  Stillness outranks substitution: an unmapped stretch shows no
  borrowed image, and a null cue never falls back to unrelated Gospel
  imagery.
- **The generation token is mandatory.** Every `applyCue` advances
  `cueGeneration`; every async pool resolution verifies its
  generation is still current before publishing. The reader racing
  Gethsemane→Arrest→Denial while the Gethsemane pool resolves must
  not see the late Gethsemane result land in the Denial pool. This is
  the SOL review's principle again — *a resolved request is not
  authorized to display; the moment that requested it must still
  exist.*
- **Pool warmth**: a segment's works (a handful) resolve through the
  existing streaming resolution; the reader is inside a segment for
  many seconds, far longer than a cold resolve.

⁇ **Look-ahead warming.** Pre-warm the *next* segment's pool while
the reader is still in the current one (the whole schedule is known
at launch)? Deferred; resolve-on-entry is the default (pools tiny,
reads slow).

### 6.4 Selection order within a pericope (concordance §Recommended)

A pericope's pool is composed in this priority; the pool is simply
the highest tier that is non-empty:

1. DIRECT works already reviewed in RISE
2. DIRECT works newly reviewed via contact sheet
3. COMPOSITE works — only when no DIRECT
4. RELATED works — only as consciously authored accompaniment
5. Otherwise **stillness**

The derived module (§3.1) pre-resolves this: each pericope's `works`
already holds only its admitted tier. The compiler and runtime do not
re-rank; they play the pool they are given, or still.

### 6.5 The icon lock (precedence, §8)

A chosen icon focal outranks the whole program. The handoff sets
`visualProgram.enabled = false` when an icon is chosen, so the
scheduler never even attempts a pericope transition — the dynamic
schedule cannot compete with the fixed focal. Full precedence:

> chosen icon > pericope segment > chapter cue > Rosa Mystica > stillness

## 7. Interaction with the Shuttle

The concordance is **verse-keyed, therefore velocity-agnostic** — a
happy property. The pool for a moment is a pure function of the atom
on screen, so:

- **Rewind across a boundary re-switches** correctly: retreating
  26:47→26:46 restores the Gethsemane pool exactly as forward motion
  would. No special case; the cortex reads the current atom's verse
  whichever way the head moves.
- **Fast-forward suspends the rhythmic layer entirely** (Shuttle spec
  §4) — so pericope switching is moot at speed; the field is dark.
  On return to home velocity the current atom's pericope resolves
  and the schedule resumes. No interaction to reconcile beyond what
  the Shuttle already guarantees.

## 8. Interaction with the existing chapter/book model

Pericope switching **supersedes** the chapter-collection default
(`CHAPTER_COLLECTIONS`) for the Gospels *when a pericope is mapped*,
and falls THROUGH to it (or to Rosa Mystica / stillness) when not:

✦ **Precedence:** icon focal (chosen) > per-pericope pool (mapped
verse) > chapter collection (mapped chapter) > Rosa Mystica (rose
books) > stillness. A chosen icon still wins over everything
(focals are a mode). The Gospels being ROSE_BOOKS means an unmapped
Gospel stretch reads under the rose — accompaniment where depiction
would overstate — exactly as the SOL correction established.

This makes the concordance strictly additive: it refines the mapped
episodes and changes nothing elsewhere.

## 9. Atlas amendments this campaign lands (concordance §Provider)

- **Cleveland adapter** accepts dotted accession numbers
  (`1953.143`), not digits only — the API accepts both, and 5
  concordance works are `needs_athena_id`-blocked by the current
  `/^\d+$/` guard.
- **Atlas §3 (Cleveland)** documents the accession vs. numeric-id
  distinction.
- **Atlas §2 (Rijksmuseum)** documents the `description` and
  `aboutActor` search axes and the Dutch-lexicon recall advantage
  the concordance found (*Besnijdenis*, *Bruiloft te Kana*,
  *Ongelovige Tomas*…) — future pericope harvests query in Dutch.

## 10. Scope boundaries

- **Gospels first.** The concordance covers the four Gospels; the
  mechanism is general (any book with mapped pericopes), but this
  campaign lands only Gospel pericopes.
- **Not the Scholastic UI.** This is the imagery layer — verse-keyed
  visual accompaniment. The commentary graph (Augustine, Aquinas,
  the Desert Fathers) is the campaign that follows, on ground this
  hardens.
- **No new UI surface.** Pericope switching is invisible plumbing;
  the reader simply sees the right image at the right verse. The
  Curia gains nothing new (pericope pools are pin pools; if a
  pericope-aware Curia view is ever wanted, it is a later, separate
  decision).

## 11. Build order

1. **Atlas amendments** (Cleveland adapter + docs) — unblocks the 5
   held works; independently valuable; small.
2. **Anchor threading** (§4) — chunker consumes `hints.scripture`;
   atoms carry (chapter, verse). Fully testable without any imagery.
3. **The concordance module + build script** (§3.1) — JSON → frozen
   `pericopes.js`, admitting only cleared works; `pericopeForVerse`
   pure lookup with the no-overlap assertion.
4. **The handoff compiler** (§6.1–6.2) — pericope concordance →
   generic `visualProgram` with disjoint segments (overlaps flattened
   narrowest-wins), coordinateSpace, fallback, and the icon-lock.
5. **The generic scheduler** (§6.3) — `cueForAtom` → `cortex.applyCue`
   with a generation token; one activation per segment; icon-lock
   respected. Chapel-agnostic.
6. **The cortex cue API** (§6) — `activateCollections` /
   `suspendSourced` by cueId + generation. The cortex never sees a
   coordinate.
7. **Land works**: the 39 existing pins as `chapel-gospel-*`
   collections immediately; contact-sheet the 60 newly discovered via
   the Curia workflow; land survivors.

---

*The frame is the creator's concordance: pericope-precise, evidence-
classed, stillness over substitution. This spec is its runtime — a
chapter read as the schedule of episodes it actually is.*
