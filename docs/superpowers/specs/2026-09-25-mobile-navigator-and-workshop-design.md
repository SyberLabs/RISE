# Mobile Visual Navigator and Mobile Workshop

**Design, 2026-09-25. Status: APPROVED 2026-09-25 (Scene Stack, all six phases). Implementation in progress.**

Scope: the phone (below 768 px wide, coarse pointer) presentation of the Visual
Navigator and of the Workshop. Desktop and tablet keep their current
presentations. Both phone designs sit on the data models that already exist;
neither introduces a new file format.

Companion documents: `docs/vision/WORKSHOP-COMPOSITION-STUDIO-SPEC.md`,
`docs/vision/VISUAL-NAVIGATOR-MIGRATION.md`,
`docs/specs/Premium_Mobile_Chamber.md`.

---

## 0. Decisions this document asks for

1. **Retire law §3.7 of the Composition Studio spec for the phone.**
   "Responsive means rearranged, not reduced — every essential authoring
   action remains available" is the rule that produced today's phone
   Workshop. It is the opposite of this brief. The phone gets a smaller
   instrument, and the current phone studio survives only as the explicit
   *Full studio* escape (§4.8).
2. **A phone scene is a source.** A scene's visual and sound are one clip each,
   spanning the whole source. No new data (§4.2).
3. **Choosing a visual on a phone separates looking from committing.** Browsing
   never changes the reading; one tap on *Choose* does (§2.3).
4. **Changing the visual *during* a reading is out of scope.** The Chamber
   compiles its visual configuration at session start. Changing it mid-reading
   is a Chamber-runtime change, and it is recorded as the next phase (§2.12).

---

## 1. Current-state audit

Measured on a 390 × 844 viewport in Chromium with touch input. The
screenshots were taken from the dev server, not inferred from the CSS.

### 1.1 Visual Navigator

| Kind | Finding |
|---|---|
| Layout | A bordered navigator inside a bordered modal ("Visual Configuration"), so two frames around one list. The breadcrumb wraps to three lines. The field status `— OFF —` breaks across lines. The preview is a ~290 × 220 thumbnail. When a sourced still fails, the placeholder "LIVE PREVIEW MOUNTS HERE" is shown to readers. |
| Interaction | A Finder-style column tree collapsed to one column. Reaching Attractor takes four taps: Visual → Dynamic → Attractor → the *Bring into the room* toggle. Comparing two visuals means Back, tap, wait, Back, tap. There is no swipe. The commit is a toggle switch, which is a settings-screen metaphor. |
| Information architecture | The tree is the engine's classification (Off · Focal · Gallery {Procedural, Sourced, Personal} · Dynamic). A reader must know that Attractor is "Dynamic" to find it. Text material (Face · Size · Ink) shares the same tree as the visual field, which mixes *which world* with *how the letters look*. |
| Performance | **Already sound, and kept.** It uses stills only, cached, with one request in flight keyed on the subject. The engines too expensive to draw live ship pre-rendered stills (`public/engine-stills/`). Measured render costs are recorded in `visual-cortex.js` `renderLeafStill`: 50 ms (Rock Garden) to 1,139 ms (Fractal). |
| Conceptual | The navigator lives only in the pre-reading Orbital, over a black backdrop. A reader picks a world without ever seeing it hold the room. The choice stays abstract until *Begin*. Every chip tap commits immediately, so browsing *is* configuring. |

### 1.2 Workshop

| Kind | Finding |
|---|---|
| Layout | The header takes 285 px of an 844 px screen (34%) before any content. The sequence `<select>` is truncated mid-word. The "Project" menu floats unaligned. Then four tabs. |
| Interaction | The primary authoring gesture is native text selection over long prose, followed by a popover. On a phone this is the least reliable gesture there is: selection handles, the system magnifier, and the OS copy menu all compete with it. The spec itself records that physical iOS/Android certification is still pending. The asset grid is 21 cards with ~9 px capability labels. Undo and Redo are tiny ghost links. |
| Information architecture | The four phone tabs (Score · Sources · Assets · Inspector) are the desktop's three panes, renamed. They are not user intentions. Sources appear twice: in the *Sources* tab and at the top of the *Assets* library. The Inspector's project view is a form (title, a five-way Category radio list). |
| Conceptual | **There is no way to write or paste text on a phone.** The only ways in are a file picker or the Library, yet the phone's most natural input is typing and pasting. Preview is whole-sequence only; the spec's "Preview from current passage" was never built. The unit of composition is a character span, which is right for a mouse and wrong for a thumb. |
| Performance | Adequate. Lanes are bounded to 160 cards and collection previews are lazy. |
| Architecture | `Workshop.js` is 5,720 lines, with 75 distinct `data-action` handlers. The `workshop/` sub-modules are string renderers only; state, events, and commands all live in the monolith. |

### 1.3 What the code already gives us (reuse, not rebuild)

- **Visual model:** `visual-taxonomy.js` (the tree plus the exclusivity rule),
  `visual-taxonomy-config.js` (`selectionFromConfig` / `configPatch` round
  trip), and the navigator's `text.js` (Face/Size/Ink plus the Fit coupling
  dialogs).
- **Stills:** `visualCortex.renderLeafStill` and `shippedStillUrl`.
- **Standalone live engines:** `AttractorField` and `KleeField` mount into any
  host with `pause`, `resume`, and `destroy`. They draw 2D canvas with adaptive
  quality, and no Three.js is involved.
- **Score primitives:** `assignVisualSpan` / `assignAudioSpan` with
  `overlap: 'replace'` remove conflicting clips atomically. An audio clip whose
  span exactly matches a visual clip gets the same sync group automatically.
- **Source dividing:** `Admit` plus `core/partition.js` show a pasted or
  imported text "as the parts it will become". It was built tap-first for
  phones ("TAPS ARE SUFFICIENT").
- **Preview:** `prepareSessionPayload` → `onCreateSession({ isPreview })`.
  `chamberExitTarget` already returns a preview to the Workshop.
- **Persistence:** `saveSequenceToVault`, experience-program JSON import and
  export, and suspended in-memory drafts.

---

## 2. Visual Navigator — phone redesign

### 2.1 The grammar

> **Open → the world fills the screen → swipe through worlds → Choose → the
> interface leaves.**

It no longer runs "open settings → walk a tree → flip a switch → close".

### 2.2 Anatomy (portrait)

```
┌────────────────────────────┐
│ ✕                      Aa  │  ← 44 px targets, on a top scrim
│                            │
│                            │
│      THE FOCUSED WORLD     │  ← full-bleed still (or one live
│        fills the screen    │     engine, §2.9), object-fit: cover
│                            │
│   "Waste no more time      │  ← one line of the actual reading,
│    arguing what a good…"   │     in the reader's face and ink
│                            │
│ Attractor                  │  ← name (display serif) + family
│ Drawn in time              │
│ ─────────────────────────  │
│ [○][◎][∮][✎][∿][✷][❋][▦]→  │  ← rail: snap-scrolling still tiles
│ Vary ˄            [Choose] │  ← thumb zone: Vary sheet · commit
└────────────────────────────┘
```

- The bottom 40% of the screen carries every control, on a vertical scrim
  (transparent → 72% black). Labels stay legible over bright stills without
  a card behind them.
- The top carries only Close (left) and **Aa** (text material, right).

### 2.3 States

| State | Meaning | The reading config |
|---|---|---|
| `browsing(focusId)` | A world is on the stage | unchanged |
| `varying(focusId)` | The Vary sheet is open for the focused world | unchanged |
| `committed(id)` | *Choose* pressed; chrome fades; name holds for 900 ms | **written once** via `configPatch` |
| `closed` | Back to the Orbital; the Visual orbit shows the chosen still | — |
| `locked` | No reading yet (existing gate) | — |
| `programOwned` | A curated reading owns the visuals (existing banner plus *Release*) | — |

Browsing is non-destructive. Today every chip tap calls `emit()`. On the phone,
focus changes only local state, and *Choose* is the single write. Variation
chips inside *Vary* stay staged until *Choose*. That is what makes rapid
comparison safe.

### 2.4 Level 1 — the world rail

Worlds are ordered by family. Families are labelled in the rail in the
reader's words, not the engine's:

| Rail family | Members (existing leaf ids) |
|---|---|
| **Stillness** | `off`, `focal` |
| **Drawn** | `attractor`, `klee` (Genesis), `harmonograph`, `ostensoria` (Iris Plates), `apparitio` (Spectral Plates) |
| **Fields** | `fractal`, `turrell`, `neural`, `rockgarden` |
| **Art** | `by-manner`, `by-subject`, `science` |
| **Yours** | `personal` |

The rail is a *projection* of `VISUAL_TAXONOMY`: a pure function
`worldRail(taxonomy)` flattens leaves and assigns each a family from its
category. A new engine therefore appears automatically. The existing
`everyEngineIsCategorised` guard still holds.

**Blending:** Gallery is the one blendable category. When the focused world
is a Gallery world and the committed field is already Gallery, *Choose*
becomes two buttons: **Choose** (replace) and **Add to blend**, which calls
the existing `toggleField`. Otherwise *Choose* replaces the field with this
world alone.

### 2.5 Level 2 — Vary

*Vary* is a half-height bottom sheet over the stage, so the world stays
visible above it. It holds only what exists for that world today:

- Genesis: Preset. Harmonograph: Climate. Focal: Glyph, or a personal image.
- Art pools: the pool (Old Masters, Monet & the Impressionists, …).
- Gallery worlds: Cadence (Slow · Measured · Quick).
- Personal: the existing upload/manage route (`onOpenPersonal`).

Chips are 44 px high and scroll horizontally. Each change re-renders the
stage still (the existing cache key is engine + substyles). Worlds with
nothing to vary hide the *Vary* handle. Attractor currently offers nothing,
because that bench was deliberately withdrawn.

### 2.6 Text material — the **Aa** sheet

Face · Size · Ink leave the world tree and move to their own sheet, opened
from **Aa**. Its specimen line is set over the focused world, which is the
only honest place to judge legibility. All existing rules move with them
unchanged: `text.js`, the Fit-release dialogs, `onFitRequested`, the
program-ownership explanations, and Living Text / Glass. Text material
still writes immediately, as today, because it is not a world choice.

### 2.7 Gestures

| Gesture | Where | Effect | Button equivalent |
|---|---|---|---|
| Horizontal swipe | stage | previous / next world | tap a rail tile |
| Tap | rail tile | focus that world | — |
| Tap focused tile again | rail | Choose | *Choose* |
| Swipe up | stage | open *Vary* | *Vary* |
| Swipe down | stage (sheet closed) | close without changing anything | ✕ |
| Swipe down | sheet | close the sheet | sheet handle |

Every gesture has a visible button equivalent. Stage swipes need a 24 px
horizontal travel threshold before they claim the pointer, and are ignored
within 20 px of either screen edge, which is the iOS/Android back gesture.
The rail scrolls natively with `scroll-snap`; the stage owns only
horizontal pan (`touch-action: pan-y` on the stage).

### 2.8 Landscape

The stage fills the screen. The rail becomes a vertical column on the right
edge, and *Choose* and *Vary* sit at its foot, under the right thumb. **Aa**
and ✕ stay top-left and top-right.

### 2.9 Performance strategy

1. **Stills are the currency.** Rail tiles and the stage show stills.
   Tiles fetch lazily through an `IntersectionObserver` (root: the rail,
   margin: one tile).
2. **Still rendering is serialized.** `_renderContinuousProceduralWork`
   draws on shared cortex canvases, and a preview once drained the Fractal
   frame queue the reading uses. So there is a queue with exactly one render
   in flight, focused tile first. The cache moves from the navigator
   instance to module scope, so stills survive a re-open.
3. **At most one live engine, ever.** Only for worlds with a standalone field
   class (Attractor → `AttractorField`, Genesis → `KleeField`), after the
   focus has been still for 600 ms. It crossfades in over the still. It is
   destroyed on focus change, on close, on `visibilitychange: hidden`, and on
   `pagehide`. DPR is capped at 1.5, with the engines' existing adaptive
   quality.
4. **No live engine at all** under `prefers-reduced-motion: reduce`, or while
   a sheet covers more than half the stage.
5. No Three.js context is created by the navigator.

### 2.10 Empty, loading, and error states

- A tile with no still yet shows the existing glyph on a flat tone, never
  a spinner.
- The stage shows the glyph large while the still loads, then crossfades
  (0 ms under reduced motion).
- A still that fails shows the glyph plus "The picture didn't arrive. The
  visual itself still works." *Choose* stays enabled, because failing to
  fetch a preview is not failing to show the visual.
- The "LIVE PREVIEW MOUNTS HERE" placeholder is deleted.

### 2.11 Accessibility

- The rail is a `listbox` with roving `tabindex`; arrow keys move focus, and
  Enter chooses.
- The stage name is an `aria-live="polite"` region announcing "Attractor,
  Drawn in time".
- Sheets are dialogs: they trap focus and return it to the opening control.
- Every control is at least 44 × 44 px.
- Scrim contrast is measured against the brightest shipped still, and
  holds 4.5:1 for labels.

### 2.12 Deferred: changing the visual mid-reading

This is the logical end of the grammar: the same stage opened *over the
running reading*. It needs the Chamber to accept a new visual configuration
without restarting the session. `VisualFieldDirector.applyCue` suggests part
of the path exists. It is a separate Chamber design and is not in this
document.

### 2.13 Desktop

Desktop is unchanged. The column tree works well with a mouse and four
visible columns. The two presentations share `selection`, `configPatch`,
the text-material methods, and the still cache. Only the view differs.

---

## 3. Three Workshop architectures

Each is built on the same authoritative draft (`Workshop.sessionData`).

### A. Scene Stack

The sequence is a vertical stack of scenes. Each scene card *is* a small
rendering of the scene: its visual's still as the backdrop, its first lines in
the reading serif, and its sound named underneath. Tap a card to open the
scene full-screen, where you can edit the words (if written here), change the
Visual, change the Sound, or Play this scene. A drag handle reorders. A
bottom bar holds Pace, **Play**, and **+ Scene**.

- **Strengths:** It matches how people think about a composed piece. There is
  no text-selection gesture. Every target is large. It maps onto the existing
  model with no new format. Preview is one tap from everywhere.
- **Weaknesses:** Granularity is the whole source. A 10,000-word Library
  chapter is one scene, though the Library already offers chapter-level Add.
  Pacing is global only, because the model has no per-source pacing.
- **Sacrifices:** passage-level scoring as the primary gesture, the Combined
  view, presentation fine-tuning, and asset filters and search.

### B. Focus Steps (wizard)

Text → Visual → Sound → Pace → Play → Save, one dimension per screen.

- **Strengths:** It is the clearest possible first run.
- **Weaknesses:** There is no overview of the piece. Editing an existing
  sequence means walking the steps again. It makes a funnel rather than an
  instrument. With several scenes, every step becomes a per-scene list,
  which turns it back into A with extra screens.
- **Sacrifices:** overview, and fast iteration on an existing piece.

### C. Inspect-and-Edit (the reading is the editor)

The author plays the reading and taps to pause. The paused moment offers
"Visual from here", "Sound from here", and "Split here". Each becomes a span
clip from the current atom to the next boundary.

- **Strengths:** It is the most RISE-like option, because editing and
  perceiving are one act. Preview *is* editing.
- **Weaknesses:** It requires the Chamber (3,432 lines, which runs a compiled
  program) to accept live score mutation and recompilation. That capability
  does not exist. Time-based targeting is imprecise, because text streams at
  200 wpm. The structure is invisible, and reordering has no home.
- **Sacrifices:** overview, reordering, precise ranges, and a very large
  runtime risk.

### Comparison

| | A · Scene Stack | B · Focus Steps | C · Inspect-and-Edit |
|---|---|---|---|
| Idea → first preview | 3 taps | 6 screens | needs text first |
| Edit an existing piece | direct | re-walk | play to the spot |
| New runtime work | none | none | Chamber live-edit |
| New data format | none | none | none, but recompilation |
| Fits one hand | yes | yes | mostly |
| Risk | low | low | high |

**Recommendation: A**, with C's spirit carried by making Play-this-scene one
tap from the scene itself. C becomes a later phase if the Chamber ever gains
live-edit.

---

## 4. Recommended: Scene Stack

### 4.1 Information architecture

There are two levels and no tabs.

```
Sequence  (the stack)
 ├─ Scene  (full-screen)
 │    ├─ Words   (edit if written here)
 │    ├─ Visual  → Visual picker (the phone navigator, §2, in pick mode)
 │    └─ Sound   → Sound sheet
 ├─ Pace          → Pace sheet
 ├─ Play          → Chamber preview of the whole sequence
 └─ ⋯             → Save · Rename · Open another · Share · Export ·
                    Import · Full studio · Reset
```

This is smaller than Create / Visual / Sound / Flow / Preview. A visual and a
sound are properties of a scene, not places. Flow is one global control
(Pace) plus order (the stack itself). Preview is a button, not a place.

### 4.2 Data mapping (no new format)

| Phone concept | Existing data |
|---|---|
| Sequence | `sessionData` (a Vault blueprint) |
| Scene *n* | `sessionData.sources[n]` |
| Scene order | `sources` order (`swapSources`) |
| Scene visual | one `visualScoreAssignments` clip on that source, `[0, text.length)`, created by `assignVisualSpan(..., overlap: 'replace')` |
| Scene sound | one `audioScoreAssignments` clip, same span. It gets the sync group automatically. |
| Scene without a visual | the whole-reading default (`visualConfig`), shown as "Same as the sequence" |
| Pace | `wpm`, `chunkMode` (`curve` is Advanced) |
| Written scene | a source with `providerId: 'local'` (the provider imported files already use), `metadata.source: 'written'`, `id: written-<uuid>` |

A scene whose visual lane holds *passage* clips (authored in the full studio)
shows **"3 passage visuals"** on its card. Changing its Visual on the phone
first asks: "Replace 3 passage visuals with one visual for the whole scene?"
Nothing is lost silently.

### 4.3 Screens

**Stack (portrait):**
```
┌────────────────────────────┐
│ ←  Untitled sequence •  ⋯ │  48 px. The dot means unsaved. Tap the title to rename or switch.
├────────────────────────────┤
│┌──────────────────────────┐│
││ ▓▓ attractor still ▓▓▓▓▓ ││  scene card, ~38% of the screen height
││ Waste no more time…      ││  first lines, reading serif
││ ♪ Aurora          ≡   ▶  ││  sound · drag handle · play scene
│└──────────────────────────┘│
│┌──────────────────────────┐│
││ ▓▓ Monet still ▓▓▓▓▓▓▓▓▓ ││
││ Begin the morning by…    ││
│└──────────────────────────┘│
├────────────────────────────┤
│ 200 wpm   [ ▶ Play ]  + Scene │  thumb bar, 64 px + safe area
└────────────────────────────┘
```

**Scene (full-screen, over the stack):** The scene's visual still is the
backdrop behind a 60% scrim. The words sit centred in the reading face and
scroll inside. A written scene gets an editable `<textarea>` styled as the
reading. The bottom bar holds **Visual · Sound · ▶ Play scene**. A back arrow
or a swipe down returns to the stack, at the same scroll position.

**Empty stack:** One centred verb, **Write the first scene**, with two
secondary lines: *From the Library* and *From a file*. Nothing else.

### 4.4 End-to-end flows

| Intention | Steps |
|---|---|
| Start a composition | Portal → Workshop → the empty stack → **Write the first scene** |
| Add text | Type or paste into the full-screen editor. *Done* makes it a scene, and its first lines appear on the card. |
| Paste a long text | If the paste is over ~400 words, offer **Divide into scenes**. That opens `Admit` (tap to place joints). *Make N scenes* adds each part as a written scene. |
| Add from the Library | **+ Scene** → *From the Library* → the existing `SourceBrowser`, including chapter-level Add |
| Create another scene | **+ Scene**. The new scene inherits the previous scene's visual and sound, so the piece stays continuous until changed. |
| Change a visual | Scene → **Visual** → the phone navigator in pick mode → *Choose* → the card's backdrop changes |
| Modify pacing | Thumb bar **200 wpm** → Pace sheet: a slow↔quick slider (120–400, snapping at 160 / 200 / 260 / 320) plus Word · Phrase |
| Attach audio | Scene → **Sound** → sheet: Silence, soundscapes, tones, and *Your recordings* (with upload). *Same as the sequence* is the default. |
| Reorder | Drag the ≡ handle (long-press 250 ms). The card's ⋯ sheet also has Move up / Move down. |
| Preview one part | ▶ on a card, or ▶ Play scene inside a scene |
| Preview the whole work | **▶ Play** in the thumb bar |
| Save | ⋯ → Save (Vault). The title-bar dot clears. |
| Export / share | ⋯ → Share (Web Share with the `.rise.json` file when `navigator.canShare({ files })`, otherwise a download). ⋯ → Export also works. |
| Continue elsewhere | Share or Export JSON, then Import on desktop. Or Save to the Vault on the same device. |
| Advanced | ⋯ → **Full studio** → today's phone studio surfaces (Score / Sources / Assets / Inspector) on the same draft. **Scenes** returns. |

### 4.5 Editing written text

- The words of a written scene are editable while the scene holds only
  whole-scene clips. On save, those clips are re-spanned to the new length,
  because "whole scene" is their meaning.
- If the scene holds passage clips, editing is disabled with the reason: "This
  scene has passage visuals from the full studio. Changing its words would
  move them."
- Library and imported sources are never editable. They carry a verified
  edition.

### 4.6 Play this scene

`sessionForScene(sessionData, sourceId)` returns a draft with that one source
and only its clips. It goes through the same `prepareSessionPayload` →
`onCreateSession({ isPreview: true })` path. That keeps the product law
"There is no editor-only playback engine". On return, the Workshop reopens
the same scene.

### 4.7 The ⋯ sheet

Save · Rename · Open another sequence · Share · Export JSON · Import JSON ·
Full studio · Reset. Export MP4 stays desktop-only: it is dev middleware and
long-running.

### 4.8 Full studio (the Advanced escape)

The existing phone studio stays, entered deliberately. Its header collapses
to the same 48 px title bar, with the command cluster moved into ⋯. That
alone returns about 230 px to the score. Once the stack ships, measure
whether Full studio is used on phones. If it is not, delete it.

---

## 5. Capability matrix

| Capability | Mobile Primary | Mobile Advanced | Desktop Only | Shared Runtime |
|---|:-:|:-:|:-:|:-:|
| Write / paste text as a scene | ● | | | |
| Divide pasted text into scenes (`Admit`) | ● | | | |
| Add from the Library (chapters) | ● | | | |
| Import .txt/.md file | ● | | | |
| Reorder scenes | ● | | | |
| Remove scene | ● | | | |
| Scene visual (whole scene) | ● | | | |
| Scene sound (whole scene) | ● | | | |
| Pace: WPM, Word/Phrase | ● | | | |
| Pace curve | | ● | | |
| Play sequence / Play scene | ● | | | ● (Chamber preview) |
| Save to Vault · rename · open sequence | ● | | | |
| Export / import JSON · Share | ● | | | ● (program IO) |
| Visual variation (preset, pool, glyph, cadence) | ● (Vary) | | | |
| Passage visual / audio clips (text selection) | | ● | | |
| Combined score view, sync groups | | ● | | |
| Scored presentation (Rhythmic / Behind / Gallery), render language, responsive | | ● | | |
| Project media upload (image / MP4) | | ● | | |
| Shared (global) pool management | | ● | | |
| Personal Focal upload | ● (Vary) | | | |
| Personal audio upload | ● (Sound) | | | |
| Undo / redo of score commands | | ● | | |
| Sequence category / details | | ● | | |
| Asset search and filters | | | ● | |
| Export MP4 | | | ● | |
| Curator / agent proposals | | | ● | |
| Duplicate scene | — deleted, not built (no owner; written text can be copied) | | | |
| Compilation, validation, atom alignment | | | | ● |

---

## 6. Component architecture

This codebase is vanilla-JS string renderers with classes, not React. The
shape follows that.

```
core/  (pure, DOM-free, unit-tested)
  visual-taxonomy.js, visual-taxonomy-config.js   — survive unchanged
  world-rail.js            NEW  worldRail(taxonomy) → families + ordered leaves
  workshop-scenes.js       NEW  scenesFromSession · assignSceneVisual ·
                                assignSceneSound · addWrittenScene ·
                                editWrittenScene · sessionForScene · moveScene
components/visual-navigator/
  directory.js, text.js, chapel.js, markup.js     — survive (desktop + shared rules)
  preview.js               REFACTOR  module-scope cache + serialized still queue
  world-stage.js           NEW  phone stage + rail + Vary + Aa sheets, gestures
  live-stage.js            NEW  single-instance AttractorField/KleeField lifecycle
components/VisualNavigator.js
                           SPLIT  model/commands stay; render() picks
                                  directory view (desktop) or world stage (phone);
                                  gains `mode: 'configure' | 'pick'`
components/workshop/
  SceneStack.js            NEW  stack, scene view, thumb bar, ⋯/Pace/Sound sheets
  scene-stack.css          NEW
  StudioTransport.js       REFACTOR  48 px phone title bar; commands into ⋯
  (AssetLibrary, ScoreCanvas, StudioInspector, WorkshopStudioShell) — survive as Full studio
components/Workshop.js     SMALL CHANGE  owns `phoneMode: 'scenes' | 'studio'`;
                                  on phone+scenes renders SceneStack with a
                                  narrow command interface; all persistence,
                                  history, preview, and Vault stay here
```

**Why this does not fork.** There is one draft, one set of score primitives,
one preview path, and one Vault. `SceneStack` never touches `sessionData`
directly. It calls Workshop commands, which call `workshop-scenes.js`,
which calls `assignVisualSpan` / `assignAudioSpan`. Desktop and phone differ
only in the view and the gesture layer.

**Visual picker in the Workshop.** `VisualNavigator` in `pick` mode returns
`{ leafId, style }` instead of emitting a reading config. A pure map in
`workshop-scenes.js` turns that into the Workshop editor-asset id
(`surface:attractor`, `procedural:fractal`, a collection asset, and so on)
and its cue snapshot. The existing `workshop-visual-assets.js` registry
supplies the ids.

---

## 7. Interaction specification

| Element | Spec |
|---|---|
| Touch targets | ≥ 44 × 44 px. Thumb-bar buttons are 56 px high. |
| Safe areas | Top bar `padding-top: env(safe-area-inset-top)`; thumb bar `padding-bottom: max(12px, env(safe-area-inset-bottom))` |
| Viewport | `100svh`, consistent with the existing "small viewport" fix (#161) |
| Sheets | Bottom sheets in three sizes: peek (Pace), half (Vary, Sound), full (Visual picker, editor). They have a drag handle, swipe down to close, trap focus, return focus, and use `Escape` on hardware keyboards. There are no nested modals: opening a sheet from a sheet replaces it, and Back returns to it. |
| Transitions | Card → scene: the card's still expands to full screen (FLIP, 280 ms, `cubic-bezier(.2,.8,.2,1)`). Under reduced motion, a 0 ms swap. |
| Feedback | Commits announce through the existing `#studio-announcer` region. The unsaved dot is in the title bar. Errors appear inline in the sheet that caused them, with no toasts for errors. |
| Drag reorder | Long-press 250 ms on ≡ lifts the card (scale 1.02, shadow). Auto-scroll near edges. Drop commits one `moveScene`. A haptic tick (`navigator.vibrate(8)`) is used where supported. |
| Persistence | The phone mode (`scenes` / `studio`) and the open scene are in-memory on the Workshop instance, so they survive a Play round trip. Drafts stay memory-only until Save, which is the existing rule. |
| Orientation | Stack: one column, cards up to 560 px wide, centred. Scene: the words column takes 60% of the width, and the bottom bar moves to the right edge. |

---

## 8. Implementation order

Each phase is green (unit + the relevant e2e, including a 360 px width) before
the next begins.

1. **Navigator core:** `world-rail.js`, the serialized still queue, the
   module-scope cache. Tests are pure unit tests.
2. **Phone navigator:** `world-stage.js`, focus/commit separation, Vary, the
   Aa sheet, gestures, and landscape. Desktop is untouched. E2E runs at
   390 × 844, 360 × 800, and 844 × 390.
3. **Live stage:** `live-stage.js`, a single instance with its lifecycle.
   Tests cover mount/destroy counts, reduced motion, and visibility.
4. **Scene core:** `workshop-scenes.js`, pure and round-trip tested through
   `compileWorkshopScoreProgram`.
5. **Scene Stack:** stack, scene view, add / write / divide / Library, the
   Visual picker in pick mode, Sound, Pace, Play scene / all, ⋯, and Full
   studio.
6. **Full studio header** collapse, the spec amendment (§0.1), and the
   `ARCHITECTURE.md` diagram regenerated.

---

## 9. Master checklist

- **First principles.** A phone author needs words, a visual, a sound, a
  pace, and Play. Everything else was inherited from the desktop layout.
- **Algorithm.** Questioned: law §3.7, the four phone tabs, and the tree as
  navigation. Deleted: the tabs as the primary phone surface, the
  placeholder preview, Duplicate, the modal frame, and the toggle-as-commit.
  Simplified: a scene is a source, and a visual is one clip. Accelerated: Play
  is one tap from every screen. Automated last: nothing new is automated.
- **Machine.** No new format, no new playback engine, no new runtime. Two
  pure core modules carry the new rules and are tested before any view.
- **Communication.** The bad news: text selection, the core desktop gesture,
  is demoted on phones, and passage scoring becomes an Advanced route.
- **Ownership.** `workshop-scenes.js` owns the scene rules, `world-rail.js`
  owns rail order, and the Workshop still owns the draft.
- **Semantic tree.** The trunk is the model mapping (§4.2). Leaves such as
  gestures and timings come after.
- **Usefulness and delight.** You can go from an idea to seeing it read over a
  moving visual in three taps, on a phone, which is not possible today.
