# Text-Attuned Imagery — a schedule derived from any text

**Today a curated text gets curated imagery and every other text gets
chance. This is the missing middle: a compiler that reads an arbitrary
text's own structure — its length, its breaks, its markers, its semantic
contour — and derives a visual program from it.**

Status: SPEC — no implementation. A sibling to `PERICOPE-IMAGERY-SPEC`
(which follows a HAND-AUTHORED schedule) and a consumer of the same
runtime. Rulings by the creator ✦; open questions ⁇.

---

## 1. The gap

Two kinds of reading exist today, and nothing between them:

| | imagery | how it is placed |
|---|---|---|
| **Curated** (a Gospel chapter) | pericope collections | a domain **authored** the schedule, verse by verse |
| **Everything else** (a pasted text, a Library book, the Tao) | a pool, or nothing | the flash economy **draws at random**; Page Mode places nothing at all |

The pericope engine proved the architecture: *a program binds passages to
imagery, the runtime follows it, the cortex renders it.* But it only
exists where a human authored the binding. Page Mode makes the gap
plainly visible — Matthew 27 typesets with plates at their passages;
paste in the Tao and you get an unbroken column.

✦ **The proposal: derive the program instead of authoring it**, from the
text's own structure. Same `visualProgram` contract, same scheduler, same
cortex, same Page compositor — a new *compiler*, nothing else.

## 2. What the text already tells us (no new analysis needed)

The signal is largely present; it has simply never been read for this
purpose.

| Signal | Where it lives | What it implies for imagery |
|---|---|---|
| **Explicit markers** `[PAUSE]` `[HOLD]` `[FLASH]` | `chunker.js` MARKERS | An authored beat. A HOLD is a natural plate; a PAUSE is a section edge. |
| **Structural breaks** (blank lines → paragraphs) | the chunker's paragraph sweep | Section boundaries — the closest thing a plain text has to a pericope edge. |
| **Length / atom count** | the compiled session | Density budget: how many images a reading can carry without becoming a reel. |
| **Semantic contour** `{valence, arousal}` | `conductor.js` `scoreAtoms()` | A smoothed track over ANY text. Peaks are where imagery earns its place. |
| **Atom `weight` / `complexity`** | `models.js` | Per-atom emphasis already computed. |
| **Chunk profile** (scripture / dialogue / prose) | `chunk-profiles.js` | Register: dialogue wants fewer plates than narrative. |

✦ **Ruling: this compiler introduces NO new NLP and no model calls.** It
reads what the pipeline already produces. That keeps it fast, offline,
deterministic, and honest.

## 3. Architecture — a third compiler, not a new runtime

```
   text ──► chunker ──► atoms ──► conductor.scoreAtoms()
                          │                │
                          └────────┬───────┘
                                   ▼
                      THE ATTUNEMENT COMPILER      ← the only new thing
                                   │
                                   ▼
                          a visualProgram
                     { coordinateSpace: 'ordinal',
                       segments: [...], fallback }
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
          visual-scheduler (Stream)      page/flow.js (Page)
```

It emits **the existing `visualProgram` shape**, so both projections
consume it unchanged. One addition is required: a coordinate space.

✦ **A new `coordinateSpace: 'ordinal'`** whose coordinate is the atom's
`position` (already on every atom) rather than chapter/verse. The
scheduler's `readCoordinate` gains one branch; `cueForAtom`'s matching
logic is otherwise identical. Scripture readings keep `'scripture'`.

## 4. The compiler's three decisions

### 4a. Segmentation — where the scenes are
Split the atom stream into segments at, in order of authority:
1. explicit markers (`[HOLD]`, `[PAUSE]`),
2. structural breaks (paragraph edges),
3. sustained shifts in the semantic contour (a valence/arousal
   crossing held over a window — not a single spike),
4. failing all of the above, an even division by length.

A segment is never shorter than a floor (⁇ ~40 atoms) so a page does not
become a strip.

### 4b. Density — how much imagery this text can carry
A budget from length and register, not a fixed count:

```
targetImages ≈ clamp(atoms / ATOMS_PER_IMAGE, 1, ceiling)
```

✦ **Restraint is the default.** The reference is a book, not a feed. A
short poem may earn one plate; a long chapter perhaps a handful. The
Page's own bleed-debt rule already resists stacking, and this budget
resists over-scheduling upstream.

### 4c. Selection — which segments get imagery
Rank segments by an **attunement score** (contour amplitude × weight ×
marker authority) and image only the top `targetImages`. Everything else
is stillness — which is a register, not a gap.

✦ **The imagery pool is whatever the reader chose** — a collection, a
procedural family, a blend. The compiler decides *where* and *how much*,
never *what*. This preserves the reader's authority over sources and
keeps `aic-*`/chapel scoping untouched.

## 5. Procedural visuals are first-class here

For a text with no sourced collection, the same schedule can drive the
**procedural** families (Klee, Turrell, fractal, harmonograph). The cue
kind becomes `{ kind: 'procedural', family, signal }`, carrying the
segment's `{valence, arousal}` so the generated form is *attuned to that
passage* rather than random. The conductor already plans procedural
parameters from a signal (`planFlame`, `planHarmonograph`,
`planKleeModulation`) — this simply gives those plans a **position in the
text** instead of a moment in time.

✦ **The Page renders procedural cues as figures too** (creator's ruling).
If the compiler judged that a passage earns a visual, the spatial
projection honors that judgment exactly as the temporal one does — a
generated form attuned to its passage is as legitimate a plate as a
painting. The Stream renders them as it does today.

This has one real architectural consequence. Sourced figures resolve to a
**URL** the Page can put in an `<img>`; procedural forms are **drawn**,
not fetched. So the Page needs a way to obtain a still raster of a
procedural family at a given signal:

- ✦ **A procedural plate is a STILL**, rendered once and held. The Page
  is a spatial medium with no clock (`PAGE-MODE-SPEC` §4) — a plate that
  animated would contradict the whole projection, and would also break
  the reduced-motion guarantee the Page currently satisfies trivially.
- The engines already render to a canvas for the flash economy; the Page
  needs that canvas **once, at a chosen size, for a given signal**, then
  keeps the raster (a data URL or a retained canvas element).
- ⁇ The exact seam — a small `renderStill(family, signal, size)` on the
  cortex beside `resolveCollectionWorks()`, versus each engine exposing
  its own — is a build-time decision. The discipline is the same one that
  governed `resolveCollectionWorks`: **one path, reused**, never a second
  drifting renderer.
- The compositor treats a procedural figure exactly like a sourced one
  (bleed / wrap / inset by the same rules). Its caption names the form
  and its attunement rather than an artist — there is no institution to
  credit, and no `creditRequired` obligation.
- Reverent degradation holds: an engine that cannot render in time leaves
  **no frame**, precisely as an unresolvable collection does.

## 6. What must not change

- **Sacred texts never take a derived schedule.** A Gospel chapter has an
  authored program and always outranks this compiler. Chapel-scoped
  imagery stays pinned, never searched, never inferred.
- **Reverent degradation**: a segment whose pool cannot resolve is
  stillness; the text composes without it.
- **The reader's source choice is sovereign** — the compiler places, it
  does not select.
- **No new provider surface, no new fetch, no model calls.**
- **Additive**: a reading without an attuned program behaves exactly as
  it does today.

## 7. Build order

1. **`coordinateSpace: 'ordinal'`** in the scheduler + Page flow (one
   branch each), with tests.
2. **The compiler** (`src/core/attunement.js`): atoms + contour → a
   `visualProgram`. Pure, unit-testable with fake atoms — no DOM, no
   network, deterministic for a given text.
3. **Wire it opt-in**: a reading with no authored program and a chosen
   pool may request attunement; the payload carries the derived program
   exactly like a Chapel one.
4. **Procedural cues** (§5), once sourced attunement reads well. Two
   parts, in order: the **still-raster seam** (one path, reused by both
   projections), then the Page figure + caption. The Stream needs no
   change — it already renders procedural forms.
5. **Verify** on three registers: a poem, a long prose chapter, a
   dialogue — that density and placement feel composed rather than
   sprinkled.

## 8. Why this is worth building

It generalizes the system's best idea. The pericope engine made *one*
corpus beautiful by hand; this makes *every* text eligible for the same
grammar — and it is the piece that makes Page Mode meaningful beyond the
Chapel. It is also cheap: one new pure module, one coordinate branch, and
no new source machinery at all.

---

*The frame is the creator's: let an arbitrary text be decomposed by its
own length, breaks, and markers, and let a range of visuals be assigned
from that reading of it — the authored schedule's discipline, derived.*
