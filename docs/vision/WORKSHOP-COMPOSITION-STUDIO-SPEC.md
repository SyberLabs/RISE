# Workshop Composition Studio

**Implementation specification, 2026-08-03.**

Status: **IMPLEMENTATION IN PROGRESS — PHASE 7 HARDENING IMPLEMENTED; REAL-DEVICE CERTIFICATION PENDING.** This specification
turns the Workshop from a stack of session-configuration panels into a
responsive, score-first composition studio. It preserves the shipped
Experience Program, stable source-span, visual-score, Session, Vault, and
Chamber contracts.

Companion specification: `EXPERIENCE-PROGRAM-SPEC.md`.

Implementation ledger, 2026-08-03:

- shipped `rise.workshop-project.v1`, validation, legacy migration, formal
  persistence, and deterministic Session/compatibility projections;
- shipped the first production Composition Studio shell with persistent
  transport, Asset Library, source-centred Score Canvas, and Inspector;
- preserved and browser-verified source selection, stable visual scoring,
  Preview, Save, restore, and Run handoff behavior;
- shipped `rise.editor-asset.v1` with strict validation and deterministic
  adapters for project images, external collections, procedural families,
  shared snapshots, and persistent reading surfaces;
- shipped one searchable/filterable visual registry and one contextual visual
  Inspector, including scored presentation controls and photosensitivity
  consent, with the embedded Workshop Visual Settings panel removed;
- shipped sourced-collection and procedural span clips through the existing
  stable score lane, with canonical cue restoration and one scheduler path;
- shipped lazy, rights-vetted collection samples and bounded procedural-family
  previews plus a bounded, command-based visual history for assignment, atomic
  overlap replacement, erase, asset replacement, undo, and redo;
- retained compatibility adapters while Phase 4 consolidates conductor and
  atmosphere defaults into their final contextual homes.
- moved Presentation out of the contextual Inspector and directly beneath the
  visual Asset Registry, keeping sequence defaults adjacent to the assets they
  govern while reserving the Inspector for the selected visual;
- replaced Workshop's legacy text-provider browser with the authoritative
  107-work Library registry, including its two-axis shelves, current holdings,
  edition attribution, rights basis, search metadata, and lazy full-text load.
- shipped Visual, Audio, and Combined score views over one selection model,
  with lane-distinct highlights and a dual-route Combined assignment surface;
- turned the Inspector into the persistent, source-ordered composition map and
  removed the redundant text-side preview rail; text and Inspector selection
  now scroll to and activate one another;
- shipped sequence-local MP4 import, durability, canonical muted cues,
  authority-bound playback, and adaptive cover/contain full-frame sizing;
- promoted Focal, Attractor, and Genesis to configurable passage +
  whole-reading assets backed by canonical field cues and one lifecycle
  director; `Off` remains hidden internal stillness rather than assignable
  media;
- shipped hierarchical visual-style configuration for Focal, Genesis,
  Attractor, Klee, and Harmonograph, including project-media and direct-upload
  personal Focals that retain focal composition;
- made media endpoints hard atomization boundaries, snapped partial-word DOM
  selections to complete tokens, and pinned the Anna Karenina adjacent-cue
  regression so phrase chunking cannot supersede authored media authority.

---

## 0. Decision

The Workshop must be reorganized around the thing the user is making:

> **A reading with authored relationships between source text, visual works,
> sound, pacing, and presentation.**

The current Workshop exposes those concerns as separate form sections:
sources, pacing, sequence images, a visual score, the legacy Visual Settings
panel, soundscapes, pure tones, and shared shelves. Every individual control
can be valid while the total interaction remains difficult to understand.

The target is a **Composition Studio** with four coordinated surfaces:

1. a project and transport bar;
2. a unified asset library;
3. a source-centred score canvas;
4. one contextual inspector.

This is an information-architecture and component overhaul, not a new runtime
or score format. `rise.experience-program.v1` remains the sole canonical media
score. The new Workshop is an authoring projection over it.

---

## 1. Why the current interface has reached its limit

The present Workshop asks users to reconcile several concepts that are really
different views of the same composition:

- uploaded sequence images are selected in one section and assigned in
  another;
- procedural visuals and sourced collections lived in Visual Settings but
  could not be assigned in the visual score;
- Visual Settings also owned persistent surfaces such as Focals, Attractor,
  and Genesis, which were not represented as schedulable span clips;
- pacing is separated from the source and movement it controls;
- soundscapes, pure tones, and entry swells appear together even though they
  have different temporal roles;
- shared shelves are physically distant from the places where assets are
  used;
- defaults and authored overrides are presented with equal visual weight;
- Preview, Save, and Create sit at the end of a long form rather than acting
  as persistent studio controls.

The result is a settings taxonomy the user must learn before they can compose.
The Experience Program reverses that relationship: the text and its score are
primary; settings exist only to describe a selected project, lane, clip, or
surface.

---

## 2. Goals and non-goals

### 2.1 Goals

The Composition Studio must:

- make the source text the stable centre of authoring;
- let a user select any supported visual asset, paint a passage, inspect the
  relationship, preview it, replace it, or erase it;
- expose uploaded images, sourced collections, and procedural visuals through
  one visual-asset library;
- clearly separate session defaults from span-authored clips;
- place pacing where it reads as the conductor of the reading rather than
  another media asset;
- give audio beds and audio events distinct, understandable homes;
- preserve exact asset identity and stable source anchors through save,
  restore, and launch;
- work coherently at desktop, tablet, and phone widths;
- support keyboard and assistive-technology authoring;
- remain legible when a project contains many sources, assets, or clips;
- provide one preview path that compiles the same project the Chamber will
  execute.

### 2.2 Non-goals for the first release

The first Composition Studio release does **not**:

- introduce a second Experience Program or visual-program format;
- add free-position canvas editing, arbitrary layers, or multi-video
  compositing;
- split one lexical token between two media assignments;
- allow overlapping visual clips in one visual lane;
- export an Experience Program as MP4;
- project cue-specific dynamic Genesis/Attractor samples or extracted MP4
  posters into Page before those static projection contracts exist;
- provide collaborative editing, cloud sync, or remote analytics;
- expose internal terms such as `sourceFamily`, `activeTypes`, or
  `sequence-asset:` to users;
- preserve the old long-form Workshop beside the new studio as a permanent
  alternate mode.

---

## 3. Product laws

These are invariants, not visual preferences.

### 3.1 One canonical score

The durable media relationships are `rise.experience-program.v1`. Editor
components may project, index, group, colour, or summarize its clips, but may
not persist a competing schedule.

During migration, the existing `visualScoreAssignments` array may remain as a
compatibility projection. The target project format reconstructs visual lane
state from the canonical program plus the project asset manifest.

### 3.2 Text anchors; atoms execute

The editor authors half-open character or token ranges with quote
fingerprints. It never stores atom ids. Session compilation verifies the exact
edition and stamps runtime atom coordinates, as implemented by
`source-span.js`.

### 3.3 Assets and clips are different things

An asset is something available to use. A clip is a relationship between an
asset-derived cue and a source span. Removing a clip does not remove its
asset. Removing a project-local asset requires explicit confirmation when
clips reference it.

### 3.4 Defaults and clips are different levels of authorship

A default answers, “What happens where I have authored nothing?” A clip
answers, “What happens at this passage?” The interface must never imply that a
session-wide pool and an exact passage assignment are equivalent.

### 3.5 Honest capabilities

Only assets the runtime can execute as clips are span-assignable. Persistent
surfaces remain project-level choices until a formal compositing contract
exists. Disabled capabilities explain why; they never silently degrade into a
different visual.

### 3.6 One preview truth

Inline asset preview may be lightweight, but session audition must compile the
current canonical project and enter the same Chamber path as launch. There is
no editor-only playback engine.

### 3.7 Responsive means rearranged, not reduced

Phone and tablet layouts may use sheets, drawers, and focused modes, but every
essential authoring action remains available.

---

## 4. User mental model and vocabulary

The public vocabulary is deliberately small:

| Term | Meaning |
|---|---|
| **Sequence** | The saved Workshop project. |
| **Source** | Text included in the sequence. |
| **Asset** | An image, collection, generator, soundscape, tone, or swell available for use. |
| **Score** | Authored relationships between passages and media. |
| **Clip** | One scored relationship on one lane. |
| **Reading Surface** | The project-level visual mode: Off, Focal, Attractor, Genesis, or Scored. |
| **Presentation** | How scored visual clips appear: Rhythmic, Behind Stream, or Gallery. |
| **Defaults** | What the sequence does outside explicitly scored spans. |
| **Inspector** | Contextual controls for the current selection. |

The interface does not expose “interlocution,” “source family,” “active
types,” “compatibility projection,” or “lowering.” Those remain internal
architecture.

---

## 5. Target information architecture

### 5.1 Desktop — studio layout

At widths of 1180 px and above:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Portal  Sequence title  Saved/Unsaved   WPM · Phrase   Preview  Save  Run│
├────────────────┬──────────────────────────────────────┬─────────────────┤
│ ASSET LIBRARY  │ SCORE CANVAS                         │ INSPECTOR       │
│                │                                      │                 │
│ Visual Audio   │ Source: Walden                       │ Moon image      │
│                │                                      │ Visual clip     │
│ Project        │ MOVEMENT   I — Economy               │ Range / quote   │
│ Collections    │ VISUAL     [Moon] [Klee────────]     │ Presentation    │
│ Procedural     │ AUDIO      [Aurora─────────────]     │ Replace / Erase │
│ Shared         │ SWELL                  [Bell]         │                 │
│                │                                      │                 │
│ [asset cards]  │ TEXT  The mass of men lead lives... │                 │
├────────────────┴──────────────────────────────────────┴─────────────────┤
│ Source switcher · position · audition state · validation status         │
└─────────────────────────────────────────────────────────────────────────┘
```

The centre canvas owns the primary scroll. The asset library and inspector
may scroll independently and remain available while the user selects text.

### 5.2 Tablet — canvas plus one drawer

At 768–1179 px:

- the score canvas remains visible;
- Asset Library and Inspector become mutually exclusive side drawers;
- a persistent rail contains Library, Inspector, Sources, and Project
  buttons;
- opening a drawer never clears the text selection or active clip;
- the transport bar collapses secondary controls into a Project menu.

### 5.3 Phone — focused authoring modes

Below 768 px:

- the user sees one primary surface at a time: Text, Score, Assets, or
  Inspector;
- selecting text raises a bottom action bar containing the chosen asset and
  Assign;
- Choose Asset opens a full-height sheet without destroying the selection;
- selecting an existing highlight opens its clip inspector as a bottom sheet;
- Preview, Save, and Run remain in a sticky top or bottom action region;
- the source text never becomes horizontally scrollable;
- drawers and sheets restore focus to the originating control when closed.

### 5.4 No conventional pixel timeline in v1

The source is a document, not a fixed-duration media file. V1 uses text
highlights and ordered lane clips rather than pretending that character count
is elapsed time. Clip cards follow document order and scroll the source to
their anchor. A later temporal overview may use compiled duration, but it must
remain a projection of the same anchors.

---

## 6. The four studio surfaces

### 6.1 Project and transport bar

Always available:

- back to Portal;
- sequence selector and title;
- dirty, saving, saved, invalid, or unavailable state;
- global pacing summary: WPM, chunking, curve;
- Preview from current passage;
- Preview full sequence;
- Save to Vault;
- Run in Chamber;
- Reset/New Sequence through a deliberate menu action.

Pacing controls open a compact **Reading Inspector**. WPM and chunking are
project defaults. A future movement selection may expose movement-level pacing
without relocating the global controls.

Preview and Run compile before navigation. Invalid source spans, missing
assets, unsupported overlaps, or unresolved project migrations prevent both
actions and focus the relevant clip or project issue.

### 6.2 Unified asset library

The library has top-level Visual and Audio tabs. Both expose whole-reading
defaults and passage-capable assets; Combined is a score-canvas view and
assignment route rather than a third copy of the registry.

Visual filters:

- **Project Images** — exact uploaded sequence images;
- **Collections** — curated sourced pools;
- **Procedural** — supported generator families and specific work engines;
- **Shared** — Global Pool images and visuals from saved personal sequences;
- **Fields** — Focal, Attractor, and Genesis as configurable passage +
  whole-reading choices.

Each card communicates:

- name and kind;
- thumbnail, sampled work, or live-but-bounded generator preview;
- editor colour when span-assignable;
- Project Default, Span Assignable, or Both capability;
- selected, unavailable, loading, and referenced states;
- provenance or source attribution where applicable.

Selecting an assignable visual arms it for painting. Selecting **Set whole
reading** on a default-capable asset updates the project fallback instead.
Dragging an image file over the library imports it; dragging it over selected
text imports and assigns it after validation. Personal Focal also offers direct
upload from its configuration; that route imports into the same project media
registry before creating the focal config.

#### Shared-image durability

A specific shared/global image cannot be authored as a durable exact clip by
an unstable pool reference. Assigning one creates a project-local snapshot
with a stable sequence asset id, subject to existing size limits. Selecting
“Global Pool” as a project default remains a pool relationship and does not
copy every image.

### 6.3 Score canvas

The score canvas contains:

1. source selector and source management;
2. compact movement/visual/audio/swell lane summaries;
3. selectable, non-editable source text;
4. source highlights and margin markers;
5. ordered clip cards for the active source;
6. validation and overlap actions close to the selection.

The text remains authoritative. Reordering sources changes reading order but
does not alter a clip’s source id or offsets. Editing source text is a separate
future capability because it can invalidate every anchor; imported/source
replacement must run a drift audit before commit.

#### Selection-driven authoring

The primary visual workflow is:

1. choose a span-assignable asset;
2. select visible source text;
3. review the selected excerpt in the action bar;
4. choose Assign;
5. validate the half-open character range and quote fingerprints;
6. create the visual clip;
7. highlight the text and select the new clip;
8. show the exact result in the Inspector.

The reverse order is also valid: selecting text first leaves a durable
ephemeral selection while the user opens the asset library. The selection is
not persisted and clears on source change, project change, successful assign,
or explicit Cancel.

#### Existing clips

Clicking a highlight, margin marker, or lane card selects the same clip. The
canvas scrolls the other representations into view without changing the
project. Selection itself never marks the project dirty.

### 6.4 Contextual inspector

There is exactly one Inspector region. Its contents depend on selection:

| Selection | Inspector contents |
|---|---|
| Nothing | Project summary, unresolved issues, next useful action. |
| Source | Name, provenance, word count, order, replace/remove. |
| Visual asset | Preview, kind, availability, editor colour, Set whole reading, Assign instructions. |
| Visual clip | Exact preview, source excerpt, cue controls, presentation override where supported, Replace Asset, Erase. |
| Reading Surface | Off/Focal/Attractor/Genesis/Scored configuration. |
| Pacing | WPM, chunk mode, curve, duration estimate. |
| Audio default | Soundscape/tone exclusivity and entry swell. |
| Validation issue | Cause, affected object, safe recovery action. |

Inspector changes are transactional: a control either commits a valid project
state or leaves the prior state unchanged. It does not partially mutate the
program and wait for Save to discover the error.

---

## 7. Reading Surface and visual-score relationship

The existing Visual Settings panel combines five mutually exclusive runtime
modes. The studio names and positions that choice explicitly.

| Reading Surface | Existing runtime mode | Span visual score executes? |
|---|---|---|
| Off | `off` | No |
| Focal | `focals` | No |
| Attractor | `attractor` | No |
| Genesis | `genesis` | No |
| Scored | `interlocution` | Yes |

When Scored is active, Presentation is one of:

- **Rhythmic** — bounded visual presences interrupt the stream;
- **Behind Stream** — imagery appears without concealing the text;
- **Gallery** — the currently scored cue becomes the persistent field.

Rhythmic frequency/presence, Gallery cadence, render language, and responsive
behavior are Scored defaults in the Project Visual Inspector. Gallery exposes
cadence only; it has no second frequency control. A clip may override only
fields formally supported by the Experience Program; v1 does not invent
unserialized per-clip controls.

Creating the first visual clip activates Scored and explains the change in an
undoable inline notification. Switching away from Scored preserves the visual
lane but marks it **Not active with this surface**. It never deletes clips or
silently executes them in another mode.

Focal, Attractor, and Genesis appear in the library's Fields section with
`both` capability. **Set whole reading** preserves their legacy surface meaning;
passage assignment captures the validated field configuration in a bounded cue
and activates Scored. The runtime executes one field at a time, so this expands
source-span authorship without promising arbitrary visual compositing.

---

## 8. Unified editor asset contract

### 8.1 Envelope

The editor uses a strict discriminated union. It does not pass component-shaped
objects or raw Visual Settings state between surfaces.

```js
{
  id: "editor-asset-id",
  lane: "visual" | "audio" | "swell",
  kind: "sequence-image" | "sequence-video" | "sourced-collection" | "procedural" |
        "audio-bed" | "audio-swell" | "project-surface",
  name: "Human label",
  capability: "span" | "default" | "both",
  editor: {
    color: "#7fd4a4",
    preview: { kind: "image" | "video" | "sample" | "generator" | "audio" | "surface", ref: "..." }
  },
  provenance: { /* bounded attribution and origin */ },
  cueTemplate: { /* canonical cue template for passage-capable assets */ }
}
```

The union validator allows fields by `kind`; the envelope above is explanatory,
not permission for arbitrary metadata.

### 8.2 Visual mappings

| Editor asset | Canonical visual cue |
|---|---|
| Project image | `{ kind:"sourced", collections:["sequence-asset:<id>"] }` |
| Sourced collection | `{ kind:"sourced", collections:["<collection-id>"] }` |
| Procedural family | `{ kind:"procedural", collections:["<family-id>"] }` |
| Specific work engine | `{ kind:"procedural", collections:["<family-id>"], engines:["<engine-id>"] }` |
| Project MP4 | `{ kind:"video", assetId:"<id>", timeMode:"loop", audioPolicy:"muted", reducedMotion:"poster" }` |
| Configured field | `{ kind:"field", renderer:<field-id>, config:{…} }` |

Editor colour, thumbnail state, search rank, and open/closed library groups do
not enter the cue. Sequence image identity resolves through the project asset
manifest. Collection and engine identifiers resolve through their existing
registries.

### 8.3 Project surfaces

Focal, Attractor, and Genesis use `capability:"both"`. Their default action
changes validated project visual defaults; their clip template carries a
validated `field` cue. The generic scheduler decides authority and one
`VisualFieldDirector` owns mount, crossfade, pause/resume, cancellation, and
destruction. A passage field supersedes the Scored fallback only for its
half-open range.

### 8.4 Availability

Registry adapters return explicit availability:

```js
{ state: "ready" | "loading" | "unavailable", reason: null | "..." }
```

Unavailable assets remain visible when referenced by a project. Their clips
are not retargeted. The Inspector offers Replace or Remove; launch refuses
when an exact project asset is missing and preserves sanctioned stillness for
an unavailable external collection according to current runtime policy.

---

## 9. Target Workshop project boundary

The Vault should eventually store a Workshop project rather than a
session-shaped form snapshot.

```js
{
  schema: "rise.workshop-project.v1",
  id: "project-id",
  title: "Sequence title",
  intent: "reflection",
  sources: [ /* ordered, stable source ids and provenance */ ],
  assets: [ /* validated project-local asset manifest */ ],
  experienceProgram: { schema: "rise.experience-program.v1", /* ... */ },
  defaults: {
    reading: { wpm: 200, chunkMode: "phrase", curve: "flat" },
    visual: { surface: "scored", presentation: "continuous", /* ... */ },
    audio: { bed: "aurora", entrySwellId: null },
    projection: "stream"
  },
  provenance: { /* bounded */ },
  updatedAt: 0
}
```

Ephemeral UI state—selected tab, drawer state, text selection, selected clip,
scroll position—is not part of the project. A bounded last-open-source id may
be stored as a local preference, never as score authority.

### 9.1 Launch compilation

```text
Workshop Project
      │ validate project + asset references + Experience Program
      ▼
Session compiler
      │ verify source fingerprints + compile source spans to atoms
      │ lower canonical tracks to runtime schedules
      ▼
Session
      │
      ├── Stream / Page projection
      ├── Visual schedule → Visual Cortex
      └── Audio schedule → Audio runtime
```

The current Session shape remains the runtime boundary. Vault projects compile
into it; Chamber does not learn about editor panels, colours, drawers, or
asset-library filters.

### 9.2 Migration

Unversioned blueprints stored under the existing `rise_workshop_v1` key migrate
on read:

- `customVisuals[]` becomes stable project sequence-image assets;
- `visualScoreAssignments[]` is checked against the source edition and, where
  required, compiled into a user Experience Program;
- existing Experience Programs remain canonical;
- old Visual Settings fields map to `defaults.visual` without changing runtime
  meaning;
- soundscape, audio preset, and selected swell map to `defaults.audio`;
- invalid or missing referenced material produces a recoverable project issue,
  never silent deletion;
- saving writes `rise.workshop-project.v1` only after validation succeeds.

Migration must be idempotent and covered by fixtures for empty, legacy-image,
visual-score, Journey-derived, and malformed projects.

---

## 10. Interaction contracts

### 10.1 Overlap

Visual ranges are half-open. Adjacent clips are valid; intersecting clips in
the same lane are not.

On overlap, Assign does not mutate the project. The canvas identifies every
conflicting clip and offers:

- Cancel;
- Select conflict;
- Replace overlap.

Replace removes every intersecting clip in the lane and creates the new clip
as one atomic command. It is undoable as one operation.

### 10.2 Undo and redo

The studio requires a bounded command history for project mutations:

- assign, replace, erase, change asset, reorder source, change default;
- at least 50 commands per open project;
- Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z;
- history resets on project switch and successful migration boundary;
- Save does not clear history during the same open project;
- ephemeral selection and navigation are not commands.

Undo is a studio feature, not a persistence log. The Vault stores the current
validated project only.

### 10.3 Remove semantics

- Erase Clip removes the relationship only.
- Remove Asset with zero references removes immediately after confirmation.
- Remove Asset with references lists the affected clips and requires Remove
  Asset and Clips or Cancel.
- Remove Source lists affected clips on every lane before committing.
- Replace Source runs the quote-fingerprint audit and presents valid, drifted,
  and unresolved counts before commit.

### 10.4 Autosave and explicit Save

V1 keeps explicit Save to Vault as the durable commit. In-memory edits update
immediately and dirty state is persistent in the header. Optional crash
recovery may store one local recovery draft, clearly distinguished from a
Vault save. No background save may overwrite a different open revision.

### 10.5 Validation visibility

Validation has three levels:

- field/selection issue near the control;
- clip/asset issue on its card and in the Inspector;
- project issue in the transport bar.

Errors use stable codes internally and actionable language publicly. Toasts
may confirm success but are not the sole presentation of an error.

---

## 11. Audio and pacing placement

### 11.1 Pacing is the conductor

WPM, chunk mode, and pacing curve live in the project/transport context. They
are not assets and do not consume an audio or visual lane. The score canvas
shows a compact Reading row so their influence is visible without expanding a
separate long panel.

Future movement-level pacing is an override on a movement clip, inherited from
the project default. It must be added to the canonical program before the UI
offers it.

### 11.2 Audio has two temporal roles

- **Audio bed**: soundscape, tone bed, or silence over a range/movement.
- **Swell event**: bounded entry or momentary event.

The current soundscape/pure-tone exclusivity remains a project-default rule.
The future audio lane and swell lane expose their independent clips after the
audio runtime can execute overlapping lanes and sync groups. Until then, the
studio places Audio Defaults in the Inspector and does not draw fake editable
audio clips.

This preserves the Experience Program build order: the Composition Studio
shell and unified visual authoring can ship before item 4, while already
providing the correct home for it.

---

## 12. Accessibility and safety

### 12.1 Keyboard

- all library cards use roving tabindex or a conventional listbox pattern;
- source text remains selectable with browser and keyboard selection;
- Assign, Replace, Erase, Preview, undo, and redo have keyboard paths;
- lane cards and highlights refer to one selected clip state;
- Escape cancels a pending selection or closes the topmost drawer/sheet;
- focus never disappears after a re-render;
- shortcuts are discoverable and avoid browser-reserved conflicts.

### 12.2 Assistive technology

- Asset Library, Score Canvas, lanes, Inspector, and transport are named
  regions;
- asset kind and assignability are included in accessible names;
- highlights expose asset name and source excerpt without encoding meaning in
  colour alone;
- assignment and replacement results use bounded live announcements;
- validation associates the issue with the affected control or clip;
- drag and drop always has an equivalent button/keyboard operation.

### 12.3 Visual accessibility

- editor colours meet non-text contrast against both supported themes;
- every colour is paired with name/icon/pattern state;
- 200% zoom does not hide Save, Preview, Run, or the selected passage action;
- reduced motion disables drawer, sheet, and preview flourish without changing
  state timing;
- photosensitivity consent remains an execution gate for Scored visual modes;
- asset previews do not autoplay flashes or fast procedural motion.

---

## 13. Component architecture

The existing `Workshop.js` is a large component that owns state, rendering,
event delegation, persistence, and child-panel synchronization. The overhaul
must reduce that responsibility rather than restyle the monolith.

Recommended surfaces:

| Module | Responsibility |
|---|---|
| `src/core/workshop-project.js` | Strict v1 project schema, migration, commands, validation. |
| `src/core/workshop-assets.js` | Discriminated editor-asset registry and cue mappings. |
| `src/components/workshop/WorkshopStudio.js` | Composition root and project lifecycle. |
| `src/components/workshop/StudioHeader.js` | Project status, conductor summary, Preview/Save/Run. |
| `src/components/workshop/AssetLibrary.js` | Registry browse, filter, import, arm-for-assignment. |
| `src/components/workshop/ScoreCanvas.js` | Source selection, highlights, lanes, pending selection. |
| `src/components/workshop/StudioInspector.js` | Contextual validated editing. |
| `src/components/workshop/SourceManager.js` | Browse/import/order/remove sources. |
| `src/components/workshop/ResponsiveStudioShell.js` | Desktop panes and tablet/mobile drawers/sheets. |
| `src/components/workshop/workshop-studio.css` | Layout tokens and responsive presentation. |

`VisualInterlocutionPanel` remains available to Chamber and other settings
surfaces. The Workshop stops embedding it after its controls reach parity in
the Studio asset library and Inspector.

### 13.1 State ownership

`WorkshopStudio` owns one immutable project snapshot plus ephemeral UI state.
Project changes are commands through pure core functions. Child components
receive data and callbacks; they do not mutate the project or `MemoryCore`
directly.

```js
{
  project,
  history: { undo, redo },
  ui: {
    activeSourceId,
    selectedAssetId,
    selectedClipId,
    pendingSelection,
    activeLibraryTab,
    inspectorContext,
    openDrawer
  }
}
```

The selected asset/clip/source is ephemeral. The project changes only through
validated commands.

### 13.2 Render discipline

- project-domain operations are DOM-free and unit tested;
- registry adapters are deterministic and cache only preview work;
- source text rendering escapes content and uses safe URLs;
- component refresh preserves selection/focus where the interaction requires;
- no full Workshop re-render occurs for asset selection, clip selection, or a
  slider input;
- async previews carry generation/abort ownership so stale results cannot
  publish into another selected asset or project.

---

## 14. Implementation sequence

### Phase 0 — contract fixtures

1. Capture current blueprint fixtures: empty, sources-only, custom images,
   scored images, every visual mode, audio defaults, and personal swell.
2. Add round-trip tests proving current projects compile identically before
   UI migration.
3. Define `rise.workshop-project.v1` and its migration/refusal codes.
4. Define editor asset union and registry fixtures.

**Exit:** existing saved sequences have a tested migration path and no runtime
meaning is inferred from UI layout.

### Phase 1 — project store and studio shell

1. Extract project lifecycle, dirty state, Save, Preview, Run, Reset, and
   source commands from `Workshop.js`.
2. Ship StudioHeader, responsive shell, SourceManager, empty Asset Library,
   Score Canvas host, and Inspector host.
3. Preserve existing source, pacing, audio-default, Vault, and launch behavior
   through adapters.
4. Keep one public Workshop route; do not expose a Legacy/Studio choice.

**Exit:** all existing sequences open, save, preview, and run from the new
shell with no loss of configuration.

### Phase 2 — unified visual asset registry

**Shipped 2026-08-03.** The production Workshop now uses the validated
`rise.editor-asset.v1` union, copies shared exact images into project ownership
with bounded provenance, and keeps persistent surfaces semantically distinct
from span-assignable imagery.

1. Adapt sequence images, external collections, procedural families/engines,
   shared images, and project surfaces into the editor asset union.
2. Move upload, shared-library management, search/filter, preview, and selected
   asset state into AssetLibrary.
3. Move Scored presentation defaults and persistent surface settings into the
   contextual Inspector.
4. Preserve photosensitivity consent and all current normalization.

**Exit:** every visual choice appears in one library with an honest capability
and no Workshop-embedded Visual Settings panel.

### Phase 3 — score-canvas parity and procedural clips

**Shipped 2026-08-03.** Project images, sourced collections, and all supported
procedural families now share one selection-driven span workflow. The editor
stores deterministic asset references, the canonical program stores only the
resolved cue, and restoration derives the editor reference from that cue.
Collection cards lazily resolve an exact rights-vetted sample through their
runtime provider, retain a deterministic fallback during outages, and cancel
pending work when the Workshop is destroyed.

1. Move the implemented stable image lane into ScoreCanvas.
2. Compile sourced-collection and procedural asset assignments to canonical
   visual cues.
3. Add exact preview behavior for image, collection sample, and procedural
   generator cards.
4. Add command-based overlap replacement, erase, asset replacement, undo, and
   redo.
5. Validate Rhythmic, Behind Stream, and Gallery execution.

**Exit:** project images, sourced collections, and procedural generators are
span-assignable through one interaction and execute through one scheduler.

### Phase 4 — conductor and atmosphere integration

**Shipped 2026-08-04.** Reading mechanics now have one project-level home in
the Studio header and Reading Inspector. Atmosphere defaults are selected from
the unified library and committed transactionally in a contextual Inspector;
they remain clearly distinct from authored score lanes. Preview playback has
single-owner replacement, explicit stop, stale-start cancellation, bounded
duration, and project/deactivation cleanup. The production shell no longer
renders the legacy stacked Reading, Visual Settings, Atmosphere, or shared-pool
sections.

1. Move WPM/chunk/curve into StudioHeader + Reading Inspector.
2. Move soundscape/tone/entry-swell defaults into Audio Inspector and library
   presentation without claiming authored lanes.
3. Add reliable audio preview ownership and stop behavior.
4. Remove the remaining long-form config sections.

**Exit:** the Workshop no longer reads as stacked panels; all global controls
have a clear project-level home.

### Phase 5 — responsive and premium-quality pass

**Implemented 2026-08-04.** The Studio now has explicit desktop, tablet-drawer,
and phone focused-surface states. Switching surfaces preserves captured source
spans and the score DOM; phone selection actions remain available while the
asset sheet is open. Asset registries use roving listbox focus, highlights are
keyboard-selectable named controls, partial refreshes restore focus, dialogs
trap and return focus, and bounded live announcements describe authoring
results. Reduced-motion, non-hover, overflow, and sticky-action rules complete
the responsive safety pass. Dense score rendering is bounded to 160 ordered
lane cards plus an out-of-window selected clip while retaining all 512 source
highlights. A 16-source, 24-image, 512-clip regression fixture and teardown
ownership tests are green. The obsolete panel-stack markup and unused shelf
helpers/styles have been removed from source.

Desktop live QA and the automated viewport contracts pass. Physical iOS and
Android selection testing, browser-native 200% zoom certification, and heap
baseline profiling remain release-quality checks that require their target
environments; they are not represented as completed below.

1. Keyboard/focus audit across desktop, tablet, and phone.
2. Real-device selection tests, especially iOS/Android selection plus bottom
   sheets.
3. Large-project performance tests.
4. Visual polish, empty states, loading states, issue recovery, reduced motion,
   and theme verification.
5. Remove compatibility projections no longer required for open projects.

**Exit:** acceptance criteria below pass and the old Workshop layout is gone.

### Phase 5.1 — visual selection repair

**Implemented 2026-08-04.** Visual authoring is now selection-first without
requiring a round trip to the side panels. Scoped `selectionchange`,
`pointerup`, `touchend`, mouse, and keyboard paths capture one stable source
span after the author finishes selecting. A high-contrast native selection and
anchored passage palette expose the selected quotation, every assignable
passage visual, Browse All, Cancel, Assign, and explicit overlap replacement.
The palette is non-modal beside the passage on desktop/tablet and becomes a
bottom sheet on phones. Re-rendering the score reconstructs the browser Range
from the saved source offsets so asset choice cannot lose the passage.

Assign remains unavailable until both a valid passage and a passage-capable
visual exist. A successful command clears the native Range and immediately
renders the persistent named highlight plus an anchored confirmation with
Preview, Replace, Erase, and Done. The first assignment activates Scored and
shows an inline Undo action that restores the previous whole-reading surface
without deleting the authored clip. Adding a source closes the Source Library,
returns responsive layouts to Score, and restores focus to the selectable
text. Capability copy now uses **Passage visual**, **Whole-reading visual**, or
**Passage + whole reading** rather than implementation vocabulary.

The component suite covers pointer, document-selection, touch-end, keyboard,
focus, replacement, erasure, activation undo, and automatic Source Library
closing. A production-browser mobile test uses Chromium touch input rather
than a synthetic `mouseup`; physical iOS and Android certification remains a
release check.

### Phase 5.2 — presentation placement and Archive convergence

**Implemented 2026-08-04.** Presentation is a collapsible sequence-default
panel immediately below the visual Asset Registry. Reading Surface and its
surface-specific controls now remain in the same left-hand authoring context
as whole-reading and passage visuals. The right Inspector describes only the
selected visual and its available actions; it no longer mixes selection state
with project-level presentation state. On tablet and phone, Presentation
travels with the Assets surface rather than requiring a second Inspector
drawer transition.

Workshop's Source Library now consumes `LIBRARY_TEXTS` through a dedicated
`ArchiveTextProvider`. The older provider menu is not exposed in this flow:
Curated Starters, the legacy sacred excerpt bundle, Gutenberg lookup, and the
retired ArXiv surface cannot drift from the Archive that readers see. The
browser opens directly into the complete registry, supports the Archive's
tradition and subject shelves, searches current title/author/editorial
metadata, and labels holdings and verified editions. Opening a divided work
uses the same verified division contract as the main Library: its contents
sheet exposes chapter/section names, reading weight, chapter-level Add, search
for long contents lists, Back, and Add complete work. Catalogue browsing stays
metadata-only; a work's payload is dynamically loaded only when its contents
or complete text is requested, preserving the Archive's lazy-loading boundary.

### Phase 6 — audio lane and sync groups

Implemented 2026-08-04.

- The canonical Experience Program lowers audio beds and swell events into
  separate runtime lanes while retaining the compatibility aggregate.
- One atom-driven controller changes a bed before firing a co-anchored swell;
  sync groups express correspondence without creating shared ownership.
- A bed replaces the previous bed. Silence is an explicit bed cue. Swells are
  bounded events, cancel when their authority ends, and never displace a bed.
- Pause cancels both lanes. Resume restores the bed at the retained reading
  position without replaying the transient swell. Stop and generation changes
  cancel every owned handle and late event.
- Project atmosphere remains a whole-reading default. A passage bed overrides
  it only while the span owns the current atom; the default returns when the
  clip ends. Authored clips never rewrite the default.
- Soundscapes, tones, Silence, and exact personal swells use the integrated
  Audio asset picker. Built-in beds support passage and whole-reading use;
  uploaded swells support exact passage events and the existing entry default.
- Audio mode reuses scoped pointer, touch, keyboard, and selectionchange span
  capture. Audio marks are underlined, visual marks are filled, and Combined
  view renders a two-part treatment when lanes overlap.
- Visual, Audio, and Combined score views preserve one source selection model.
  Each lane has explicit overlap replacement, Assign, Replace, Erase, bounded
  undo/redo, preview, persistence, and canonical compilation.
- An audio clip whose source span exactly matches a visual clip receives the
  same stable sync-group identity automatically.

### Phase 7 — sequence-map, field, video, and authority hardening

Implemented 2026-08-11.

- Combined selection raises coordinated Visual and Audio assignment routes.
- Project health and next-action guidance react immediately to source state.
- The Inspector is the complete source-ordered sequence map; the former narrow
  preview rail is removed, and passage/clip navigation is bidirectional.
- Workshop layouts obey Even Design. Gallery exposes cadence alone, with its
  numeric value/range, and no duplicate frequency control.
- The visual asset surface is hierarchical and shares bounded substyle
  definitions with runtime configuration. Focal, Genesis, Attractor, Klee, and
  Harmonograph retain their meaningful variants.
- Focal, Genesis, and Attractor compile as passage `field` cues. A single field
  director preserves fallback authority, pause/resume, crossfade, replacement,
  cancellation, and teardown.
- Personal Focal supports project-media reuse and direct upload while retaining
  the focal's compact rectangular placement rather than becoming a full-frame
  sequence image.
- Sequence-local MP4 is durable, muted, reduced-motion safe, and owned by
  active score authority. Adaptive layout uses cover only when the crop retains
  enough of the authored frame.
- Source-span endpoints cut atomization. User selections snap to complete
  tokens; one atom cannot silently inherit two clips from one lane.

**Exit:** the Workshop presents one coherent score-first workflow, all
supported visual families are passage-authorable through one canonical score,
and phrase chunking cannot override media authorship. Remaining work is
real-device/accessibility certification and the explicitly separate dynamic
Page projection phase.

---

## 15. Acceptance criteria

### 15.1 Project integrity

- [ ] Every valid existing Workshop blueprint migrates or opens unchanged.
- [ ] Migration is idempotent and never silently deletes a clip or asset.
- [ ] Save persists one canonical Experience Program and validated asset
      manifest.
- [ ] Preview and Run compile the same project through the same Session path.
- [ ] A changed source edition refuses drifted quote fingerprints before
      launch.
- [ ] Missing exact project assets identify every affected clip.

### 15.2 Information architecture

- [x] The production Workshop exposes one Studio, not legacy and new modes.
- [x] Asset Library, Score Canvas, Inspector, and transport are recognizable
      without scrolling through a form.
- [x] The Workshop no longer embeds `VisualInterlocutionPanel` after parity.
- [x] Defaults and span clips are visually and semantically distinct.
- [x] Internal source-family terminology is absent from public copy.
- [x] Presentation sits beneath the Asset Registry and the contextual
      Inspector contains only selected-visual controls.
- [x] Workshop source browsing derives from the authoritative Library registry
      and exposes its current shelves and edition metadata.
- [x] Divided works expose chapter-by-chapter selection and retain an explicit
      complete-work action.

### 15.3 Visual authoring

- [x] Project images, sourced collections, and supported procedural assets can
      be selected from one library.
- [x] Each supported asset can be assigned by selecting text before or after
      choosing the asset.
- [x] Completing a pointer, touch, or keyboard selection opens a contextual
      passage palette without requiring the side library.
- [x] Assign is enabled only when both a valid passage and passage-capable
      visual are selected.
- [x] A successful assignment immediately becomes a persistent highlight and
      exposes Preview, Replace, Erase, and Done beside the passage.
- [x] The first passage visual activates Scored with an undo that preserves
      the authored clip.
- [x] The created clip contains stable offsets and quote fingerprints.
- [x] Highlights, lane cards, and Inspector select the same clip.
- [x] Adjacent clips are allowed and overlaps require explicit replacement.
- [x] Replace is atomic and undo restores every removed conflict.
- [x] Erase removes the clip but retains the asset.
- [ ] Removing a referenced asset/source lists and atomically handles affected
      clips.
- [x] Rhythmic and Gallery resolve the exact active project image.
- [x] Sourced and procedural clips compile to their canonical cue kinds.
- [x] Focal, Attractor, and Genesis compile as bounded configurable field cues.
- [x] Project MP4 imports, persists, previews, compiles, and executes only
      under active passage authority.
- [x] Passage endpoints constrain atomization and partial-word selections snap
      to complete tokens.

### 15.4 Reading surfaces

- [x] Off, Focal, Attractor, Genesis, and Scored preserve existing runtime
      meaning.
- [x] Passage assignment of a configured field activates Scored while retaining
      the previous whole-reading field as fallback.
- [x] Switching away from Scored preserves clips and explains that they are
      inactive.
- [x] Scored exposes Rhythmic, Behind Stream, and Gallery presentation.
- [x] `Off` is not exposed as assignable media; stillness remains an internal
      fallback/erase semantic.
- [x] Page preserves static focal meaning without claiming cue-specific dynamic
      field sampling or MP4 poster extraction.

### 15.5 Audio authoring

- [x] Audio beds and swell events execute as independent runtime lanes.
- [x] Tone, soundscape, Silence, and exact personal swell assets use the
      integrated asset picker.
- [x] Audio passage selection supports pointer, touch, and keyboard paths.
- [x] Visual, Audio, and Combined views keep lane treatments unambiguous.
- [x] Same-lane overlap requires explicit replacement; bed/swell overlap is
      valid and may share a sync group.
- [x] Assign, Replace, Erase, undo/redo, preview, persistence, and compilation
      operate on passage audio.
- [x] Pause/resume, fades, cancellation, and late-event authority are bounded.
- [x] Whole-reading atmosphere remains distinct from authored passage clips.

### 15.6 Responsive behavior

- [x] Desktop supports simultaneous Library, Canvas, and Inspector use.
- [x] Tablet drawers preserve selected text and active clip.
- [x] Phone asset sheets preserve the pending text selection through Assign or
      Cancel.
- [x] No essential action requires hover.
- [ ] At 200% zoom, Preview, Save, Run, and selection actions remain reachable.
- [x] Source text never scrolls horizontally at supported widths.

### 15.7 Accessibility and safety

- [x] Complete visual authoring is keyboard-operable.
- [x] Focus returns correctly after sheets, drawers, imports, and destructive
      confirmations.
- [x] Colour is never the sole indication of asset or clip identity.
- [x] Screen readers receive asset kind, selected passage, assignment result,
      and validation state.
- [x] Reduced motion and photosensitivity gates preserve their current safety
      contracts.
- [x] Asset previews never produce unconsented flashing motion.

### 15.8 Performance

- [x] Selecting an asset or clip does not reconstruct the entire Workshop DOM.
- [x] A project with 16 sources, 24 local images, and 512 visual clips remains
      responsive during selection and scrolling.
- [x] Source highlight rendering is bounded and does not perform quadratic DOM
      work on every pointer event.
- [x] Preview work is abortable and cannot publish after project/asset change.
- [ ] Memory returns to baseline after leaving the Workshop repeatedly.

---

## 16. Verification plan

### Pure/domain tests

1. Unversioned Workshop blueprint → `rise.workshop-project.v1` migrations.
2. Asset discriminated-union validation and cue mappings.
3. Command application, inverse commands, bounded undo/redo.
4. Assign, adjacent, overlap-refuse, replace, erase, and reference cascades.
5. Program reconstruction from persisted clips/assets and stable round trip.
6. Missing asset, drifted source, duplicate identity, and limit refusals.

### Component tests

1. Asset-first and selection-first assignment.
2. Selection persistence across library/inspector drawers.
3. Clip synchronization among highlight, lane card, and Inspector.
4. `Off` never appears as an asset; configured fields distinguish Assign from
   Set whole reading.
5. Dirty state changes only for project mutations.
6. Keyboard and focus behavior for dialogs, sheets, and destructive actions.
7. Responsive DOM states at desktop, tablet, and phone breakpoints.

### Integration tests

1. Open legacy blueprint → edit → save v1 → reopen → preview.
2. Assign exact image, sourced collection, and procedural visual → compile →
   observe scheduled cue in Chamber.
3. Exercise the same scored project in Rhythmic, Behind Stream, and Gallery.
4. Switch away from and back to Scored without losing clips.
5. Remove shared source material and recover through the issue Inspector.
6. Full Vault edit/revision lifecycle without duplicate projects.

### Live quality checks

1. Compose a three-source sequence without consulting documentation.
2. Assign three asset kinds and distinguish defaults from clips.
3. Complete the same task at desktop, tablet, and phone widths.
4. Verify a visually coherent empty project, simple project, and dense project.
5. Validate source selection and bottom-sheet behavior on real touch browsers.

---

## 17. Risks and rulings

| Risk | Ruling |
|---|---|
| A visually impressive shell hides duplicated state. | Project/schema extraction precedes UI replacement. |
| A “unified” library implies every visual can do everything. | Every asset declares `span`, `default`, or `both`; unsupported actions are absent. |
| Global image deletion breaks exact clips. | Exact shared-image assignment snapshots into the project. |
| Re-rendering destroys browser text selection. | Selection is captured before opening responsive sheets; selection-only updates do not rebuild the source DOM. |
| A large rewrite stalls before parity. | One route, phased component replacement, contract fixtures at every exit. |
| Mobile becomes a viewer-only version. | Focused modes preserve the complete authoring command set. |
| Audio UI promises a lane the runtime cannot execute. | Audio defaults move first; lanes wait for Experience Program item 4. |
| Procedural preview becomes expensive or unsafe. | Bounded still/sample previews, abort ownership, no unconsented autoplay. |
| Rich editor metadata leaks into runtime cues. | Asset adapters compile only validated canonical cue fields. |
| A phrase atom is wider than a passage assignment. | Resolve media endpoints before chunking and treat them as hard, non-rendering cut points. |
| A configurable field becomes a stitched child reading. | Keep one Session clock; schedule a bounded field cue and restore the fallback afterward. |
| Full-screen video destroys a portrait frame. | Measure media/stage aspect and choose cover or contain from a retained-frame threshold. |

Rulings fixed by this specification:

1. The public product remains **Workshop**; “Composition Studio” describes its
   architecture and may appear as supporting copy, not a required rename.
2. The production route never presents Legacy versus Studio choices.
3. One visual cue owns a passage at a time; arbitrary compositing remains
   deferred, but persistent fields are valid bounded cues.
4. The score canvas is document-anchored, not a fake character-width timeline.
5. Audio defaults integrate before audio clips.
6. Dynamic Page projection for cue-specific Genesis/Attractor configurations
   and MP4 posters is a separate deferred phase, not Workshop runtime work.

---

## 18. Definition of done

The overhaul is complete when a first-time user can:

1. add or choose source text;
2. choose an image, collection, or procedural visual from one library;
3. select a passage and assign it;
4. understand the highlight, clip, and exact preview as one relationship;
5. choose how scored visuals present;
6. set reading pace and audio atmosphere without leaving the composition
   context;
7. preview, save, reopen, and run the same validated sequence;
8. perform the workflow with keyboard or touch;
9. recover from overlap, missing asset, or changed source without losing the
   rest of the project.

At that point the Workshop is no longer a form that configures a session. It
is the studio promised by the Experience Program: the place where a reading is
composed.
