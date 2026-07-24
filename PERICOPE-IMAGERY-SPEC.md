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

## 6. Runtime: the visual schedule

The chapel handoff already computes one `sourced` collection for a
reading (`collectionsForReading`). Pericope switching makes that
*dynamic within a chapter*:

✦ **The pool follows the reader's verse.** The cortex learns the
current atom's (chapter, verse) — it already receives the atom on
each `atom` event — resolves the pericope, and when the pericope
CHANGES from the last one, swaps the active pin pool.

- **The switch is at pericope boundaries only**, not per atom — a
  pericope holds for its whole verse range, so most atoms cause no
  switch. Crossing 26:46→26:47 (Gethsemane→arrest) is a switch;
  26:39→26:40 is not.
- **A pericope with no works (GAP, or `null`) suspends the pool** —
  the field goes still (the rhythmic layer draws nothing, the focal
  if any persists). Stillness outranks substitution: an unmapped
  stretch of narrative shows no borrowed image.
- **Pool warmth**: entering a pericope resolves its (small — a
  handful of) works through the existing streaming resolution. Pin
  pools this small warm in one batch; the reader is typically inside
  a pericope for many seconds (verses at reading pace), far longer
  than a cold resolve.

⁇ **Look-ahead warming.** Should the cortex pre-warm the *next*
pericope's pool while the reader is still in the current one (the
verse schedule is known — the whole chapter's pericopes are
enumerable at launch)? Deferred; the default is resolve-on-entry
(pools are tiny and reads are slow). Look-ahead is a clean future
optimization if a boundary flash ever arrives cold.

### 6.1 Selection order within a pericope (concordance §Recommended)

A pericope's pool is composed in this priority, and the pool is
simply the highest tier that is non-empty:

1. DIRECT works already reviewed in RISE
2. DIRECT works newly reviewed via contact sheet
3. COMPOSITE works (episode shares the frame) — only when no DIRECT
4. RELATED works — only as consciously authored accompaniment
5. Otherwise **stillness**

The derived module (§3.1) pre-resolves this: each pericope's `works`
already holds only its admitted tier. The runtime does not re-rank;
it plays the pool it is given, or stills.

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
4. **Cortex verse-aware switching** (§6) — swap pool on pericope
   change; stillness on GAP/null.
5. **Land works**: the 39 existing pins immediately; contact-sheet
   the 60 newly discovered via the Curia workflow; land survivors.

---

*The frame is the creator's concordance: pericope-precise, evidence-
classed, stillness over substitution. This spec is its runtime — a
chapter read as the schedule of episodes it actually is.*
