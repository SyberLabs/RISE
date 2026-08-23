# Scriptorium Strengthening — length ladder and local text

**Date:** 2026-08-21
**Status:** DESIGN, awaiting review. Not yet cited by code.
**Companion to:** [`SCRIPTORIUM-SPEC.md`](./SCRIPTORIUM-SPEC.md) (§10a length, §10c extent grammar). That file remains the one modules cite. When this work lands, a dated heading is added there and `scriptorium-spec.test.js` learns the new citation. This file is the brief that work is built from.

**You set a sitting. You admit your own text as a Library work with parts. The model names those parts the same way it names the Tao.**

Rulings from the 2026-08-21 conversation are marked ✦. They are closed. Do not re-open them in implementation.

---

## 0. Why this document exists

The Scriptorium can already compose from the Archive: intent, a word budget, a capability document, a gate that refuses rather than repairs, an extent grammar (`work#n`, `work#n:200`). Two things still make the room weaker than the grammar it teaches.

1. **The length dial is the wrong shape.** It is a continuous word range whose travel does not match what the shelf can serve.
2. **Reader text is not a work.** Library “Local Files” opens Chamber and forgets the file. Scriptorium will not accept `.txt` / `.md`. Nothing the reader writes can be named as `their-diary#4`.

A third wish — that the model inject never-before-seen prose into the score JSON — was examined and **rejected**. The general capability is: upload `.txt` / `.md` once, so that text becomes a reusable Library work for Chamber, Workshop, and Scriptorium. Model-written text is out of scope forever in this brief.

---

## 1. FIX 1 — the length ladder ✦

### 1.1 What was measured

The defect is **scale and default**, not the unit. Words remain the stored quantity (`constraints.targetWords`). Minutes remain a readout. That law is already in SCRIPTORIUM-SPEC §10a and in `describeLength()` (`src/core/scriptorium-session.js`): *minutes are shown and words are sent.*

What the continuous slider actually does today (`SCRIPTORIUM_LENGTH`):

| Fact | Number |
|---|---|
| Stops on the input | 1,044 (`min` 200, `max` `MAX_SAFE_TARGET_WORDS`, `step` 100) |
| Distinct outcomes that change the sitting | ~104 |
| Travel that repeats a sitting | ~90% |
| Travel sitting above the longest division on the shelf | ~68% |
| First-run default | 20,000 words → **1h 40m** at 200 wpm |

`READING_PACE.default` is **200** (`src/core/reading-limits.js`). The minute column below is that default. The live readout uses `readerWpm()` (settings `defaultWpm`, clamped to `READING_PACE`), never a frozen 200.

### 1.2 The nine rungs

The ladder is **nine word stops**. Adjacent rungs differ by 1.33× to 2.5×. Every rung changes what the shelf can actually serve. No two describe the same sitting.

| Rung | Words | At 200 wpm | Divisions the shelf can offer whole | Works that can offer a whole division |
|---|---:|---|---:|---:|
| 1 | 400 | 2 min | 43% | 5 of 15 |
| 2 | 1,000 | 5 min | 51% | 7 |
| 3 | 2,000 | 10 min | 70% | 9 |
| 4 | 3,000 | 15 min | between neighbors | between neighbors |
| 5 | 4,000 | 20 min | 83% | 11 |
| 6 | 6,000 | 30 min | 93% | 14 |
| 7 | 9,000 | 45 min | between neighbors | between neighbors |
| 8 | 12,000 | 60 min | 99% | 14 |
| 9 | 18,000 | 90 min | 99.3% | 15 |

Rungs 4 and 7 (15 min / 45 min) belong on the dial. They were in the word list that survived the measurement; they were only omitted from a later summary table. Implement all nine.

**Default is 4,000** (rung 5, ~20 min at 200 wpm), not 20,000.

The input is a 9-stop control (index `0…8` or an equivalent discrete range). It is not a 1,044-stop range that happens to snap. The session stores the **word value of the rung**, not the index, so a context.json and a CLI flag stay in words.

### 1.3 Authority

Replace the shape of `SCRIPTORIUM_LENGTH` in `src/core/scriptorium-session.js`:

```
SCRIPTORIUM_LENGTH = {
  rungs: [400, 1000, 2000, 3000, 4000, 6000, 9000, 12000, 18000],
  default: 4000
}
```

- `clampTargetWords(value)` snaps to the nearest rung. Ties go to the lower rung.
- A value that is already a rung is unchanged.
- Non-finite input returns `default`.
- `min` / `max` / `step` on a continuous range are deleted. The ceiling the gate already owns, `MAX_SAFE_TARGET_WORDS` (~104,529), is unchanged. 18,000 sits well under it. The gate does **not** learn the ladder. An imported context that says `targetWords: 20000` is still a legal budget if it is a whole number in `1…MAX_SAFE_TARGET_WORDS`. The ladder is the reader's dial and the session's clamp, not a new refusal family.

`describeLength(words, wpm)` is unchanged in kind: `"{words} words — about {clock} at {wpm} wpm"`. The readout under the slider keeps that sentence.

Refusals that name the budget (`assertProgramWithinBudget`, CLI exit table, rundown) already print `targetWords`. They keep printing the number. When the session produced that number, it is a rung. Do not invent a parallel “rung 5” vocabulary in refusal copy.

### 1.4 Surfaces

| Surface | Behavior |
|---|---|
| Scriptorium room | Discrete slider. Input writes `session.setTargetWords`. Change rebuilds the take (existing contract). |
| CLI `--length` | Snaps through the same `clampTargetWords`. Prints the rung it will use. |
| Prompt | Prices the ask (`targetWords`), not a minute figure, not `MAX_SAFE_TARGET_WORDS`. Already the law; keep it. |
| Tests that assume default 20,000 or `min`/`step`/`max` | Move to a rung. Tests that probe the gate with arbitrary budgets stay on arbitrary budgets. |

### 1.5 What this is not

- Not a pace control. The reader does not set WPM in this room. Chamber and the settings key `defaultWpm` already own pace. A missing settings door for `defaultWpm` is related debt (see §9.3) and does not block this ladder.
- Not a minute ladder stored as minutes. The measurement *proposed* storing 2 / 5 / 10 / 15 / 20 / 30 / 45 / 60 / 90. That proposal is refused. Words are the quantity a model can add up. Minutes are the derivative at current wpm.

---

## 2. FIX 2 — what is true today

There is **no path** where a reader `.txt` / `.md` becomes a catalogue work with addressable divisions.

```
Library "Local Files"
  Library.handleFileUpload()
    → onSelectText(text, "Local: …")
      → app.handleTextSelection()
        → Chamber, raw text
          (optional) ChamberOrbital localStorage ORBITAL_TEXT_KEY

Archive pick
  divideSections at ingest/build (division-index.json)
    → contents sheet → one division → Chamber

Scriptorium
  take() → exportCuratorContext({ sources: [], includeLibrary: true })
        → buildLibraryCatalogue() = releaseArchiveMetadata() only
  examine() → createCuratorSourceReader()   // extent #n → library only
  read() → resolveProgramLibrarySources()
        → ingestedArchiveTexts()            // not reader uploads
```

### 2.1 Capability matrix

| Capability | Status | Notes |
|---|---|---|
| Persist reader `.txt` / `.md` as a Library work | **MISSING** | Ephemeral Chamber read; Orbital localStorage is not a work |
| Compute first-draft divisions on upload | **PARTIAL** | `divideSections` / `splitLongDivision` at archive build only |
| Reader reviews / edits / names parts | **MISSING** | Archive toc is a read-only picker |
| Scriptorium catalogue includes local works | **MISSING** | `buildLibraryCatalogue()` walks release metadata only |
| Scriptorium addresses `#n` on local works | **MISSING** | Grammar exists; local works do not; loader is archive-only |
| In-the-moment Scriptorium text upload | **MISSING** | Materials are images and MP4 (`MATERIAL_ACCEPT`) |

Adjacent, and not to be confused with this work:

- Workshop `.txt` import → a whole-work *project source* with no `#n`.
- Library Local Files → immediate read, no catalogue.
- Workshop composition-map colors → media-assignment spans, not divisions.

### 2.2 Three rules that block the wish today

1. **`take()` ships `sources: []` and only the archive catalogue.** `src/core/scriptorium-session.js`. `buildLibraryCatalogue()` walks `releaseArchiveMetadata()` only.

2. **Extent ids resolve against `library`, then load from `ingestedArchiveTexts()`.** `createCuratorSourceReader` (`src/core/curator-context.js`) looks up `library.get(extent.workId)`. `resolveLibrarySourceIds` (`src/core/scriptorium-resolve.js`) looks up the archive registry. A Chamber paste never enters either map. The gate wording is: *Program names source ${sourceId} absent from curator context*.

3. **A source cannot carry a `divisions` field.** `normalizeSource()` allows only `{ id, title, characterLength, words }`. `add-source` with a `division` field is refused: the extent rides in the source id. Division metadata belongs on a **library catalogue** entry with `divisions.count` and `divisions.words[]`, and the work must load at read time.

### 2.3 What `authored: false` actually does

Declared at `scripts/build-division-index.mjs` as `authored = Boolean(reason) && reason !== 'measured'`. Copied into the catalogue. Read by the prompt, the rundown footnote, and the contents-sheet note. **No runtime path that decides a cut branches on it.** `chunker.js` has a different, unrelated `authored` flag for `|` phrase boundaries.

`splitLongDivision` (`src/content/archive/divisions.js`) packs at paragraph breaks toward `maxWords` (default 4,000), and prefers `paragraphIsHeading()` near 0.7 of target. That heading test fires on `CHAPTER I` and all-caps lines. It misses Markdown `#` headings and ordinary prose. On stripped canon and on typical reader `.txt`, it has been measured at **zero** fires. The divider then degrades to greedy word-target packing.

Ground truth against the shelf: the divider recovers real seams when the work's true units are *smaller* than the target (Spoon River, Tao, Dante: 61–83% clean) and **never** when they are larger (Middlemarch, Meditations, Paradise Lost: 0%). Dated diaries cut through the next entry's date line. A wall of text (no blank lines) yields one part.

Therefore: the chunker may propose. It may not baptize. A review that only *names* the machine's cuts is refused.

### 2.4 Workshop highlight is the wrong object

`renderHighlightedScoreText` / `renderSequenceMap` paint **character-span media assignments** with `VISUAL_SCORE_COLORS`. Those spans may overlap and leave gaps. A local work's parts are a **partition**: contiguous, gapless, one shared edge. Cloning the Workshop screen would paint the wrong physics and the wrong colors. Do not do it.

---

## 3. The object — a local work ✦

The trunk: **reader text becomes a Library work with named, addressable parts before Scriptorium can compose from it.**

### 3.1 Identity

- Id form: `local-<slug>` where `<slug>` is `[a-z0-9]+(?:-[a-z0-9]+)*`, length bounded by the existing work-id ceiling the catalogue already applies.
- The prefix `local-` is reserved. Archive ingest must never mint it. The gate treats `local-*` as a library id, not as a loaded `sources[]` entry.
- Title defaults to the file's basename without extension. The reader may edit it on admit.
- Author is optional.

### 3.2 Record (`rise.local-work.v1`)

One text. An ordered list of cut offsets. Parts are derived, never stored as a second copy of the prose unless a surface cache needs them.

```
{
  schema: "rise.local-work.v1",
  id: "local-april-diary",
  title: "April diary",
  author: null,
  createdAt: "<iso>",
  sourceName: "april-diary.txt",
  text: "<full text>",
  cuts: [0, <offset>, …, <text.length>],   // inclusive start of each part, plus the end
  labels: ["April 2", "April 3"],          // length === parts
  noun: "Entry",                           // reader-chosen or default "Reading"
  authored: true,                          // see §3.4
  reason: "authored"                       // "measured" until save; "authored" after
}
```

Invariants, checked on every write:

- `cuts[0] === 0` and `cuts[n] === text.length`.
- `cuts` is strictly increasing.
- Every part `text.slice(cuts[i], cuts[i+1])` has at least one word (`countWords` from `src/core/chunker.js`).
- `labels.length === cuts.length - 1`.
- Offsets land on a snap joint (§5.4), never mid-word.
- `text.length ≤ READING_LIMITS.maxTextCharacters` (2,000,000).

Catalogue projection (what leaves the building — no payload):

```
{
  id, title, author?,
  words: countWords(text),
  divisions: {
    authored, reason, noun,
    count: labels.length,
    labels,
    words: per-part countWords
  }
}
```

This is exactly what `normalizeLibrary()` already accepts and what `createCuratorSourceReader` needs for `#n` and `#n:200`. `divisions.words[]` length equals `count`. Omit `labels` only if you omit them entirely; do not send a short array.

### 3.3 Runtime shape for resolve

A local work answers the same questions an archive work answers, so `resolveLibrarySourceIds` does not grow a second resolver:

- `id`, `title`, `author`, `wordCount`
- `getSections()` — one section, the full text (whole-work reads)
- `getDivisions()` — `{ divided: true, noun, reason, authored, entries: [{ id, label, title: null, content }] }`

`providerId` on a resolved source is `local-work`, not `archive-ingest`.

### 3.4 `authored` ✦

- First draft after upload, before save: `authored: false`, `reason: "measured"`, labels `Reading 1…N` (or a date line when the snap magnet supplied one).
- **Save is the authoring act.** Persist with `authored: true`, `reason: "authored"`, whatever labels and cuts the reader left. They looked and kept them, even if they did not rename.
- Abort / dismiss: nothing is written. Chamber is not opened on the raw file as a consolation prize. The previous Local Files behavior (skip admit, jump to Chamber) is deleted.

The prompt already tells the model: when `authored` is false, prefer progress and quotations over “Reading N”. After save it is true, so the model may name the labels.

---

## 4. One admit path, two doors ✦

There is one function: **admit local text**. Library and Scriptorium are doors onto it. There is no “must have already done this in Library” gate in Scriptorium, and no parallel Scriptorium parser.

```
.txt / .md
    → read text, refuse if empty / over ceiling / wrong type
    → divideSections(text) as FIRST DRAFT only
    → admit surface (partition wash + seams)     [browser]
       or keep the draft untouched               [CLI / tests]
    → persist rise.local-work.v1
    → overlay on the session / hydrate the catalogue
```

Accepted types stay `.txt` and `.md` (MIME `text/plain`, `text/markdown`, or empty with those extensions). Scriptorium materials stay images and MP4. Text is not a material. It is a work.

### 4.1 Store vs overlay

**The session overlay is the product.** IndexedDB is one hydrator of it.

```
ScriptoriumSession.localWorks = LocalWork[]   // metadata + loader, no bytes in context.json
take() → exportCuratorContext({
            sources: [],
            includeLibrary: true,
            localWorks: this.localWorks.map(catalogueProjection)
         })
```

`buildLibraryCatalogue()` concatenates `releaseArchiveMetadata()` with the local projections, still sliced at `CURATOR_CONTEXT_LIMITS.maxLibraryWorks`. Local works are listed first, because they are why the reader opened the door. If the combined list exceeds the cap, archive works at the tail drop; a local work the session holds never drops. If local works alone exceed the cap, refuse admit of the next one with a countable reason.

**Browser hydrator:** a `LocalWorks` IndexedDB store, sibling to `WorkshopMedia`, not an extension of it. `WorkshopMedia` refuses anything that is not `image/*` or `video/mp4`. Do not widen that MIME list. Text is a different object.

**CLI hydrator:** `--text path.txt` runs headless admit (measured draft, no editor) into the overlay. `--local-work path.json` loads a saved `rise.local-work.v1`. Node has no IndexedDB; it must not pretend to.

**Tests:** fixtures into the overlay. Do not require IndexedDB.

`resolveLibrarySourceIds(ids, { localWorks })` asks the overlay after the archive registry. An id present in both is a bug: `local-` prefix makes it impossible if the reservation is kept.

### 4.2 Focus (optional, after save)

The reader may point at one part: `local-april-diary#4`. That id is written into the prompt as the reader's pointing finger. It is **not** a second catalogue and it does **not** hide the rest of the work. The model may still name `#3` if the intent asks. Exclusivity (“use only this part”) is out of scope; the images already taught that the reader can say so in the intent.

The picker is a contents list of the work just admitted — labels and durations — not a second admit surface.

---

## 5. The partition and the gestures ✦

### 5.1 Physics

The start of one part **is** the end of the other. There are not two ranges. There is one ordered list of joints through a single text. *n* parts means *n − 1* interior joints. Sliding a joint lengthens one part and shortens the other in the same motion, because they share that number.

```
[---- April 2 ----|---- April 3 ----]
                  ^
              one joint
         drag left:  2 shrinks, 3 grows
         drag right: 2 grows,  3 shrinks
```

Workshop spans can overlap and gapping. This wash cannot. A gesture that would create a gap, an overlap, or a zero-word part is refused in the chip, not silently repaired.

### 5.2 Three verbs

| Verb | What changes | Gesture |
|---|---|---|
| **Place** | Insert a joint (how many parts) | Click the **body**. Ghost at the snap. Chip. Confirm or dismiss. |
| **Slide** | Move an existing joint (where) | **Drag the shared edge.** Both washes breathe. Commits on release. No chip. |
| **Join** | Delete a joint | Click an **existing seam**. Same chip, other mood: join with the part above, or dismiss. |

A body click **always places**. It never relocates the nearest joint. Place and slide must not share a click. ✦

Slide is chip-free: the complementary motion is the preview. Undo reverts a bad release.

Undo is one stack for place / join / slide / rename. Without it, the reader will not touch the draft. Escape or an explicit undo control. Capacity: the admit sitting, not forever; clearing on save is fine.

### 5.3 The chip ✦

Not a centered modal. Not Workshop's passage-assignment popover. A small chip **anchored on the joint**, so the sentence they aimed at stays visible.

**Place mood**

- The first words after the snap, so the aim is readable without looking away.
- A name field, focused, defaulting as in §5.5.
- `Cut here` / dismiss.
- Enter confirms. Escape or click elsewhere dismisses. Nothing is committed until confirm.

**Join mood**

- The two labels that would become one.
- `Join with the part above` / dismiss.
- The surviving name is the earlier part's name. The later name dies.

The chip **includes the name** on place. Naming is not a third trip. ✦ (Locked here so implementation does not stall: the small modal was requested as the confirm, and a confirm that cannot name leaves the seam as `Reading N`.)

Clicking a seam **label** while no chip is open opens the join-mood chip with the name focused, so a rename without joining is: edit name, dismiss without joining. Confirming join uses the name as it stands.

### 5.4 Snap

A joint may land only on a snap:

1. A paragraph break (`\n\s*\n`) — first choice.
2. A date-looking line (diary magnet). The chunker cannot see this unit; the snap must. A line that matches a conservative date pattern and is ≤ 90 characters is a magnet. Prefer it over a mid-entry paragraph break within a short window.
3. A sentence start, only when the paragraph is larger than the current length rung (or 4,000 words if admit has no session).
4. Never mid-word. Never inside a token `countWords` would split.

Hovering the body shows a **ghost** at the snap that a click would confirm. The ghost is the lesson on a wall of text with one part: *A cut starts a part. Click a seam to take it back.*

### 5.5 Default names

- If the first line of the new part is a date magnet or `paragraphIsHeading`, that line is the default label (trimmed, bounded).
- Otherwise `Reading {n}` using the work's noun (`Reading` until the reader sets one).
- After a join, later parts renumber only if their labels are still the automatic form. A reader-typed label is never rewritten.

### 5.6 Paint

Chamber already has the object: `.atom-seam` / `.atom-seam-label` (`src/components/Chamber.css`). Piece-depth is a quiet uppercase name. Work-depth adds a rule. Reuse that language.

The wash is **one ink, stepped only in weight** along reading order — enough to see complementary slide. Not `VISUAL_SCORE_COLORS`. Not a rainbow. Not a second Workshop.

A thin left spine of part lengths may jump the scroll. It is a map, not a second editor. No “Chapter 3 of 12” chrome on the chip.

Scroll does not jump on place, join, or slide. After place, the new joint stays in view.

Live duration on each part uses `describeLength(partWords, readerWpm())` — the same sentence as the room's slider.

### 5.7 First draft

`divideSections(text)` / `splitLongDivision` runs on upload and places measured seams. The reader deletes the wrong ones, adds the missing ones, slides the shared edges, names what remains, saves.

A single-part wall of text is valid. Scriptorium may name `local-id` or `local-id#1`.

### 5.8 What does not exist

- Toolbar buttons labeled Merge or Split.
- Multi-select-then-merge.
- Confirm dialogs that cover the page.
- Click-body-relocates-nearest-joint.
- Mid-word cuts.
- A second highlight room.

---

## 6. Catalogue, gate, resolve

The extent grammar does not change. `local-april-diary#4` and `sacred-tao-te-ching#40` are the same sentence.

| Step | Today | After |
|---|---|---|
| Catalogue | `buildLibraryCatalogue()` → archive metadata | Archive + session local projections |
| Membership | `createCuratorSourceReader` → `library.get` | Unchanged, once the catalogue holds the local row |
| Budget | `divisions.words[]`, `extentReadingBound` | Unchanged |
| Load | `ingestedArchiveTexts()` only | Archive, then `localWorks` overlay |
| `add-source` + `division` field | Refused | Still refused. Extent rides in the id |
| `normalizeSource` + `divisions` | Refused | Still refused. Divisions live on the library entry |

`exportCuratorContext` grows an optional `localWorks` argument (catalogue projections only). Payload text never enters context.json. That is SCRIPTORIUM-SPEC §1 / “no bytes out.”

`resolveLibrarySourceIds` grows an optional `localWorks` registry. `read()` on the session passes `this.localWorks`. A local id that is in the catalogue but missing from the overlay is `missing`, not a silent archive misspelling.

Openings (`#n:200`) keep `EXTENT_MIN_WORDS` (40) in `library-extent.js`. A whole part may be shorter than 40 words (an epitaph). The floor applies to `:N`, not to `#n`.

---

## 7. Surfaces

### 7.1 Library — Local Files

`renderPersonal()` / `handleFileUpload()` in `src/components/Library.js` today: pick file → Chamber.

After:

- The section **lists persisted local works** (title, part count, duration at `readerWpm()`).
- Upload enters admit, not Chamber.
- A listed work opens a contents sheet. Entries are choosable for a Chamber read, as archive contents are. The sheet offers **Revise parts**, which re-opens admit on that record.
- Delete is explicit and phrased. It does not cascade into Vault drafts that still name the id; those drafts refuse at examine / read the way a missing archive work already does.

### 7.2 Scriptorium

- A control **Add text** (not a new material). Same accept list as Library. Same admit. On save, the work is on the overlay and `take()` is rebuilt.
- After save, the optional focus picker (§4.2).
- The materials panel is unchanged (images / MP4). Text in that picker is still refused.
- The paste field remains score JSON, not prose.

### 7.3 Chamber

A local work is read the way an archive work is read: resolved text, then the existing compiler. Orbital `ORBITAL_TEXT_KEY` is not a catalogue and is not the persistence for this feature. Do not promote it.

### 7.4 Workshop

Once a local work is on the overlay / store, Library import already in Workshop (`Workshop.import-library.test.js`) can name `local-…#n` **if** that import walks the same catalogue. Wire it to the same overlay. Do not add a third `.txt` path.

### 7.5 CLI

| Flag | Effect |
|---|---|
| `--text file.txt` | Headless admit, measured draft, onto the overlay |
| `--local-work file.json` | Load `rise.local-work.v1` |
| `--length N` | Snap to a rung, print it |
| `--focus local-id#n` | Prompt emphasis only |

Exit statuses do not grow a new family unless admit itself refuses (empty file, over ceiling, bad JSON). Those refusals use a countable `LOCAL_WORK_*` code and a sentence that says what to do, in the style of `describeImportFailure`. Add the rows to the SCRIPTORIUM-SPEC §13 table when the code lands.

---

## 8. Prompt

`buildCuratorPrompt` already walks the catalogue. Local works appear as ordinary library rows. When `authored` is true, the model may name labels. When a focus id is set, one extra sentence: the reader pointed at that extent.

Do not teach withheld works. Do not teach `add-source` with a `division` field. Do not teach a `sources[]` entry as a way to smuggle divisions. The prompt's extent examples may use a `local-` id **only when that id is in the context being shipped** (same law as Spoon River / Oedipus: examples come from the served document).

Composition advice already covers stitching and seams. A local `#n` next to an archive `#m` is the same stitch. Chamber's `paintSeam` already draws it.

---

## 9. What is deleted, refused, or deferred

### 9.1 Deleted

- ~~Library Local Files → immediate Chamber navigation.~~ **Reversed 2026-08-21.**
  The direct read is KEPT, as a second button in the admit room ("Read it
  now", beside "Add to Library"). This was the brief's only user-visible
  regression, and the partition is an addition to what a dropped file could
  already do rather than a toll on it. Held by
  `src/components/Library.local.test.js` and `src/components/Admit.test.js`.
- Continuous `SCRIPTORIUM_LENGTH` `{ min: 200, step: 100, max: MAX_SAFE, default: 20000 }`.
- Any plan for a second Workshop-like highlight room.
- Any plan for the model to write fresh prose into the Experience Program as a first-class source.
- “Must pre-process in Library before Scriptorium will accept text.”

### 9.2 Refused at the door (not repaired)

- `.doc`, `.pdf`, typeless `.mp4` as text, images in the text picker.
- A Workshop text source minted under the reserved `local-` prefix. An id
  that is not a local work has no claim on the namespace reserved so that
  an id cannot mean two things; unshelved imports are `imported-...`
  (settled 2026-08-23, with §5).
- Empty text, text over `maxTextCharacters`.
- A cut that is not a snap.
- A part with zero words.
- A `local-` id that collides with an archive id (cannot happen if ingest honors the reservation; if it does, admit refuses).
- `add-source.division` (already refused).
- Mid-word joints.

### 9.3 Out of scope (named so they are not built “while we are here”)

- **Model-composed text field** in the score. Rejected. Upload is the capability.
- **Imagery exclusivity toggle** (must use uploads / may use / ignore). The reader tells the model in the intent. Do not add a third control beside length and intent.
- **`defaultWpm` settings door.** `readerWpm()` already reads it; Settings does not write it. Separate brief. The ladder's minute readout is correct the day that door exists.
- **Markdown heading parser** upgrades to `paragraphIsHeading`. Snap magnets cover the diary case. A future ingest improvement may teach `#` headings; it is not required to ship admit.
- **Plate-bake / Gallery seam work.** Unrelated.
- **Pace slider in Scriptorium.** The room has one dial: length.

---

## 10. Tests and acceptance

Drive the doors the reader uses, not only the helpers.

### 10.1 Length

- `SCRIPTORIUM_LENGTH.rungs` has the nine words. Default 4,000.
- `clampTargetWords(20000)` → 18,000. `clampTargetWords(5000)` → 4,000 (tie with 6,000 goes lower). `clampTargetWords(4000)` → 4,000.
- Room: slider has nine positions; default position is 4,000; readout matches `describeLength(4000, wpm)`.
- Moving the slider rebuilds the take (existing contract).
- Gate still admits a context with `targetWords: 7777`.
- CLI `--length 4500` snaps and prints the rung.
- `scriptorium-spec.test.js` / session tests that hard-code 20,000 as the *default* move. Budget tests that use 20,000 as a *legal ask* may keep it.

### 10.2 Admit and partition

- Upload `.txt` does not navigate to Chamber.
- `divideSections` draft is visible as seams.
- Body click → ghost → dismiss → cut count unchanged.
- Body click → confirm → cut count + 1, both sides ≥ 1 word.
- Drag edge → complementary word counts, `cuts` strictly increasing.
- Click seam → join → cut count − 1, surviving label is the earlier one.
- Save persists `rise.local-work.v1` with `authored: true`.
- Abort persists nothing.

### 10.3 Catalogue and read

- After save, `take().context.library` contains the local id with `divisions.count` and `divisions.words[]`.
- A score naming `local-april-diary#2` passes `assertProgramWithinContext` and `assertProgramWithinBudget`.
- `read()` resolves that id to the part's exact text (`providerId: 'local-work'`).
- The same score against a session with no overlay refuses *absent from curator context* / missing, and does not load an archive work by accident.
- Quotation anchors against the part still resolve (`assertResolvedProgramQuotations`).
- CLI `--text` then `examine` of a program that names `local-…#1` exits 0 when the draft has that part.

### 10.4 Non-duplication

- A test that Workshop color tokens are **not** imported by the admit surface.
- A test that `MATERIAL_ACCEPT` is unchanged.
- A test that `normalizeSource` still refuses `divisions`.

### 10.5 Sitting test (the one that means it shipped)

A dated diary, thirty seconds of admit, seams on the date lines, each named, Scriptorium `examine` of a program that reads `local-…#4` exits 0, Chamber reads those words. If the reader had to learn a control named Merge, the mechanic failed.

---

## 11. Implementation order

Do not build the wash before the overlay. Do not build a second door before the first door writes a record the catalogue can see.

1. **Length ladder.** `SCRIPTORIUM_LENGTH`, clamp, room, CLI, tests. Ships value alone.
2. **`rise.local-work.v1` + overlay + catalogue + resolve.** Headless admit (`divideSections` draft, no UI). CLI `--text`. Tests through `take` / `examine` / `read`.
3. **Admit surface.** Gestures in §5. Library door first (the list is the proof the store exists).
4. **Scriptorium door + focus sentence in the prompt.** Rebuild take on save.
5. **Workshop import** walks the same overlay. Last, because it is reuse, not a new object.
6. **Cite.** Add a dated heading to `SCRIPTORIUM-SPEC.md` and the citation test.

If a step cannot be demonstrated at its door, do not start the next.

---

## 12. File index (current → touch)

| Concern | Path | What changes |
|---|---|---|
| Length authority | `src/core/scriptorium-session.js` | `SCRIPTORIUM_LENGTH`, `clampTargetWords`, overlay, `take()` |
| Length readout | same, `describeLength` | Unchanged kind |
| Length UI | `src/components/Scriptorium.js` | Discrete slider; Add text door |
| Pace window | `src/core/reading-limits.js` | Unchanged; readout consumes it |
| Catalogue | `src/core/curator-context.js` | `buildLibraryCatalogue` / `exportCuratorContext` accept local projections |
| Extent | `src/core/library-extent.js` | Unchanged grammar |
| Load | `src/core/scriptorium-resolve.js` | Overlay after archive |
| Divider (draft only) | `src/content/archive/divisions.js` | Called at admit, not rewritten unless a snap magnet needs a shared date helper |
| Word count | `src/core/chunker.js` | The one `countWords` |
| Library door | `src/components/Library.js` | Admit, list, contents, revise |
| Materials | `src/core/materials.js` | Unchanged |
| Workshop import | `src/components/Workshop.js` and import tests | Same overlay |
| CLI | `src/core/scriptorium-cli.js` | `--text`, `--local-work`, `--length` snap, `--focus` |
| Store | new `src/core/local-works.js` | IndexedDB hydrator |
| Admit view | new, under `src/components/` | Partition wash; not under `workshop/` |
| Spec citation | `docs/vision/SCRIPTORIUM-SPEC.md` | Dated heading, after the code |
| This brief | `docs/vision/SCRIPTORIUM-STRENGTHENING-SPEC.md` | This file |

---

## 13. Master checklist (why this shape)

- **First principles.** A sitting is a word budget the shelf can serve. A chapter the model can name is a Library part. Those are the only two objects.
- **Algorithm.** The continuous slider and the Chamber-skip upload are deleted, not wrapped. The Workshop highlight is not optimized. Automation (headless CLI admit) comes after the overlay exists.
- **One name.** `rise.local-work.v1` is the record. Admit is the process. Overlay is how every door sees it. Length is `SCRIPTORIUM_LENGTH.rungs`.
- **No silo.** Chamber, Workshop, Scriptorium, CLI — one catalogue row.
- **Delight.** Nine sittings that mean something; a shared edge that breathes; a chip that does not steal the sentence; `#4` that is really the fourth entry.

The answer that survived: **nine word rungs, default 4,000; one admit path; a partition with place / slide / join; local works in the library catalogue, not in `sources[]`.**
