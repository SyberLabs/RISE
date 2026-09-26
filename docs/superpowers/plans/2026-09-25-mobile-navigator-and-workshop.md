# Mobile Navigator and Scene Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give phones a stage-and-rail Visual Navigator (look first, commit once) and a Scene Stack Workshop (one scene per source, one whole-scene visual and sound), without a new data format.

**Architecture:** Two new pure core modules (`world-rail.js`, `workshop-scenes.js`) carry every new rule. New phone views (`visual-navigator/world-stage.js`, `workshop/SceneStack.js`) render over the existing models and call existing commands. Desktop presentations are untouched. The current phone studio stays as *Full studio*.

**Tech Stack:** Vanilla ES modules, string-rendered views, Vite, Vitest (jsdom), Playwright (Chromium, touch).

**Spec:** `docs/superpowers/specs/2026-09-25-mobile-navigator-and-workshop-design.md`

## Global Constraints

- Phone presentation: `(max-width: 767px), (max-height: 500px) and (pointer: coarse)`.
- Touch targets ≥ 44 × 44 px. Thumb-bar buttons are 56 px high.
- Use `100svh`, `env(safe-area-inset-*)`.
- At most one live engine instance is mounted by the navigator at any time. None under `prefers-reduced-motion: reduce`.
- Still rendering through `visualCortex.renderLeafStill` is serialized: one in flight.
- No new persisted fields. A scene is `sessionData.sources[n]`. Scene visual and sound are clips spanning `[0, text.length)`.
- Written scenes: `providerId: 'local'`, `metadata: { source: 'written' }`, `id: 'written-<uuid>'`.
- Copy uses "Visual" and "Sound" (never "world", which is a design term only). No internal terms reach readers.
- Comments carry invariants and constraints only.
- No lint script exists. Gates are `node scripts/ci-hygiene.mjs`, the unit suite, and the e2e suite.

---

### Task 1: The world rail and the serialized still queue

**Files:**
- Create: `src/core/world-rail.js`, `src/core/world-rail.test.js`
- Modify: `src/components/visual-navigator/preview.js` (module-scope cache and queue)
- Test: `src/components/visual-navigator/preview.test.js` (new)

**Interfaces:**
- Produces: `RAIL_FAMILIES` (frozen `[{ id, label }]`); `worldRail(leaves = taxonomyLeaves())` → frozen `[{ id, label, family, category, engineId, pool }]` in rail order; `railNeighbour(rail, id, step)` → id; `chooseField(enabled, id)` → new `Set`, where an exclusive leaf or a Gallery leaf *replaces* everything (Off empties).
- Produces (preview.js): `stillQueue.request(key, loader)` → `Promise<url|null>`, one loader in flight at a time, cached across instances; `stillQueue.cached(key)`; `stillQueue.prioritize(key)`.

- [ ] Write `world-rail.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { taxonomyLeaves } from './visual-taxonomy.js';
import { RAIL_FAMILIES, chooseField, railNeighbour, worldRail } from './world-rail.js';

describe('the world rail', () => {
  it('holds every taxonomy leaf exactly once, grouped by family in rail order', () => {
    const rail = worldRail();
    expect(rail.map(w => w.id).sort()).toEqual(taxonomyLeaves().map(l => l.id).sort());
    const order = RAIL_FAMILIES.map(f => f.id);
    const seen = rail.map(w => order.indexOf(w.family));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });
  it('names families in the reader\'s words', () => {
    const family = id => worldRail().find(w => w.id === id).family;
    expect(family('off')).toBe('stillness');
    expect(family('attractor')).toBe('drawn');
    expect(family('fractal')).toBe('fields');
    expect(family('by-manner')).toBe('art');
    expect(family('personal')).toBe('yours');
  });
  it('steps and clamps', () => {
    const rail = worldRail();
    expect(railNeighbour(rail, rail[0].id, -1)).toBe(rail[0].id);
    expect(railNeighbour(rail, rail[0].id, 1)).toBe(rail[1].id);
    expect(railNeighbour(rail, rail.at(-1).id, 1)).toBe(rail.at(-1).id);
  });
  it('choosing replaces, even a gallery world', () => {
    expect([...chooseField(new Set(['fractal']), 'turrell')]).toEqual(['turrell']);
    expect([...chooseField(new Set(['attractor']), 'focal')]).toEqual(['focal']);
    expect([...chooseField(new Set(['fractal']), 'off')]).toEqual([]);
  });
});
```

- [ ] Run `npx vitest run src/core/world-rail.test.js`. Expect FAIL: module not found.
- [ ] Implement `world-rail.js`:

```js
import { FIELD, categoryOf, taxonomyLeaves } from './visual-taxonomy.js';

export const RAIL_FAMILIES = Object.freeze([
  Object.freeze({ id: 'stillness', label: 'Stillness' }),
  Object.freeze({ id: 'drawn', label: 'Drawn' }),
  Object.freeze({ id: 'fields', label: 'Fields' }),
  Object.freeze({ id: 'art', label: 'Art' }),
  Object.freeze({ id: 'yours', label: 'Yours' })
]);

function familyOf(leaf) {
  if (leaf.category === FIELD.OFF || leaf.category === FIELD.FOCAL) return 'stillness';
  if (leaf.category === FIELD.DYNAMIC) return 'drawn';
  if (leaf.pool === 'personal') return 'yours';
  if (leaf.pool) return 'art';
  return 'fields';
}

export function worldRail(leaves = taxonomyLeaves()) {
  const order = RAIL_FAMILIES.map(f => f.id);
  return Object.freeze(leaves
    .map((leaf, index) => ({ leaf, index, family: familyOf(leaf) }))
    .sort((a, b) => order.indexOf(a.family) - order.indexOf(b.family) || a.index - b.index)
    .map(({ leaf, family }) => Object.freeze({
      id: leaf.id, label: leaf.label, family, category: leaf.category,
      engineId: leaf.engineId || null, pool: leaf.pool || null
    })));
}

export function railNeighbour(rail, id, step) {
  const at = rail.findIndex(w => w.id === id);
  if (at < 0) return rail[0]?.id ?? null;
  return rail[Math.max(0, Math.min(rail.length - 1, at + step))].id;
}

/** Choose is replace: the rail commits one visual; blending is a separate act. */
export function chooseField(enabled, id) {
  const category = categoryOf(id);
  if (!category) return new Set(enabled);
  return category === FIELD.OFF ? new Set() : new Set([id]);
}
```

- [ ] Run the test and expect PASS.
- [ ] Write `preview.test.js`. It covers: two requests for different keys run sequentially (the second loader is not called until the first resolves); a repeated key returns the cached url without calling the loader; a loader that throws resolves `null` and does not block the queue; `prioritize` moves a queued key to the front.
- [ ] Implement `stillQueue` in `preview.js` (module-scope `Map` cache, array queue, `running` flag). Route `_fetchStill` through `stillQueue.request`, keeping its current signature. Replace `this._previewCache` reads with `stillQueue.cached(key)`.
- [ ] Run `npx vitest run src/components/visual-navigator src/components/VisualNavigator` and expect PASS (existing navigator tests stay green).
- [ ] Commit: `The rail knows every visual, and a still waits its turn`.

### Task 2: The phone navigator: stage, rail, Vary, Aa

**Files:**
- Create: `src/components/visual-navigator/world-stage.js`, `src/components/visual-navigator/world-stage.css`, `src/components/VisualNavigator.stage.test.js`, `e2e/navigator-stage.spec.js`
- Modify: `src/components/VisualNavigator.js` (presentation switch, `mode`, `onClose`, `onPick`), `src/components/ChamberOrbital.js` (`onClose` → `closeModal('visual')`; full-bleed modal class), `src/components/ChamberOrbital.css` (full-bleed `#modal-visual.is-stage`), `e2e/mobile.spec.js` (the navigator test asserts the directory at 1280 only; phone assertions move to the new spec)

**Interfaces:**
- Consumes: `worldRail`, `railNeighbour`, `chooseField`, `stillQueue`.
- Produces: `new VisualNavigator(el, { presentation?: 'stage'|'directory', mode?: 'configure'|'pick', onClose?, onPick?({ leafId, style, pool }) , initialLeafId? })`. `presentation` defaults to `matchMedia(PHONE_QUERY).matches ? 'stage' : 'directory'`. `stageMethods` on the prototype: `stageFocus(id)`, `stageChoose()`, `stageBlend()`, `stageOpenSheet('vary'|'text'|null)`, `stageClose()`. State: `this.stage = { focusId, sheet, staged: { style, pool, cadence } }`.

Behaviour to implement and test (jsdom, `presentation: 'stage'`):
- [ ] The test file mounts with `{ visualConfig: { visualMode: 'attractor' } }`. The stage opens focused on `attractor`. `.vstage-rail [role=option]` count equals `worldRail().length`, and the focused option has `aria-selected="true"`.
- [ ] Tapping another tile changes `.vstage-name` and **does not call `onChange`**.
- [ ] `[data-stage="choose"]` calls `onChange` once with `configPatch` of `chooseField(...)` plus staged style, then calls `onClose` after `STAGE_HOLD_MS` (fake timers). Under reduced motion (stub `matchMedia`), `onClose` is called immediately.
- [ ] When the committed field is Gallery and the focus is a Gallery leaf, both `choose` and `blend` render. `blend` emits `toggleField` semantics.
- [ ] Vary: for `klee`, the sheet lists `KLEE_PRESETS` chips. Picking one updates `stage.staged.style` with no `onChange`, and Choose writes it. For `attractor`, the Vary handle is absent.
- [ ] Aa sheet: it renders the existing text sections (face, size, ink via `textMethods`). Picking a face calls `onSettingChange` immediately, as today.
- [ ] Keyboard: ArrowRight on the rail moves focus to `railNeighbour(+1)`, and Enter chooses.
- [ ] `locked: true` renders the existing gate. `programInfo` renders the program banner, and Choose is disabled with the ownership reason.
- [ ] `mode: 'pick'`: Choose calls `onPick({ leafId, style, pool })` and never `onChange`. Leaves listed in `options.pickable` (a Set) are the only rail entries.
- [ ] Swipe: a pointerdown/pointermove of more than 24 px horizontally, starting more than 20 px from either edge, on `.vstage-stage` focuses the neighbour. A vertical swipe up opens Vary; a swipe down closes (sheet first, else the navigator).
- [ ] States: a tile with no still yet shows its glyph (`glyphFor`). A stage whose still resolves `null` shows the glyph plus "The picture didn't arrive. The visual itself still works.", and Choose stays enabled. The directory view's "Live preview mounts here" placeholder is removed, and its existing test is updated to assert the glyph alone.
- [ ] Implement `world-stage.js` as `stageMethods` (render via string templates like `directory.js`) and `world-stage.css` (scrim, rail snap, sheets, landscape right-column rail via `@media (orientation: landscape) and (max-height: 500px)`).
- [ ] In `VisualNavigator.render()`: `if (this.presentation === 'stage') return this.renderStage();`. Existing directory tests are unchanged (jsdom defaults to directory, because `matchMedia` is absent there, so the default resolves to `directory`).
- [ ] ChamberOrbital: pass `onClose: () => this.closeModal('visual')`, and add `is-stage` to `#modal-visual` when the navigator presentation is `stage`.
- [ ] E2E `navigator-stage.spec.js` at 390 × 844, 360 × 800, and 844 × 390: open the Visual orbit; stage and rail are visible; nothing overflows sideways; tap tile `turrell` and `.vstage-name` reads "Turrell"; Choose; the modal closes; the Visual orbit status names the choice.
- [ ] Run the unit tests for the navigator and orbital, plus `npx playwright test e2e/navigator-stage.spec.js e2e/mobile.spec.js e2e/navigator-phone.spec.js e2e/leaf-preview.spec.js`, and expect PASS. Update phone-only assertions in older specs that describe the retired phone columns.
- [ ] Screenshot at all three sizes and check legibility and spacing by eye (aesthetic authority).
- [ ] Commit: `On a phone, a visual fills the room before it is chosen`.

### Task 3: One live engine on the stage

**Files:**
- Create: `src/components/visual-navigator/live-stage.js`, `src/components/visual-navigator/live-stage.test.js`
- Modify: `world-stage.js` (arm after dwell), `VisualNavigator.js` `destroy()`

**Interfaces:**
- Produces: `createLiveStage({ host, factories = { attractor: h => new AttractorField(h, { adaptive: true }), klee: h => new KleeField(h, {}) }, dwellMs = 600, reducedMotion })` → `{ focus(engineId|null), suspend(), resume(), destroy(), get mounted() }`.

- [ ] Tests (fake timers, factories stubbed to count constructions and destroys): `focus('attractor')` mounts after 600 ms, not before; focusing `klee` before 600 ms mounts nothing for attractor; focusing a different engine destroys the previous one first (never two live at once); `focus('fractal')` mounts nothing (no factory); `reducedMotion: true` never mounts; `suspend()` destroys and `resume()` re-arms; `destroy()` is idempotent; a `visibilitychange` to hidden suspends.
- [ ] Implement it. The host is an absolutely positioned layer inside `.vstage-stage`, at opacity 0 → 1 over 400 ms once mounted. DPR is capped by setting `host.style.setProperty('--live-dpr-cap', 1.5)`, and the engines read `devicePixelRatio`, so the cap is applied by sizing the host rather than patching the engines.
- [ ] Wire it: `stageFocus` calls `live.focus(world.engineId)`; opening a sheet calls `suspend()`; closing a sheet calls `resume()`; `destroy()` calls `live.destroy()`.
- [ ] Run the tests and expect PASS. Commit: `Attractor and Genesis move on the stage, one at a time`.

### Task 4: Scene core

**Files:**
- Create: `src/core/workshop-scenes.js`, `src/core/workshop-scenes.test.js`

**Interfaces:**
- Consumes: `assignVisualSpan`, `assignAudioSpan` (with `overlap: 'replace'`).
- Produces:
  - `scenesFromSession(data, { visualName(assetId) → string|null, audioName(assetId) → string|null })` → `[{ id, index, name, excerpt, words, written, editable, visual: { assetId, name, whole: bool, passages: n } | null, sound: { assetId, name, whole: bool, passages: n } | null }]`
  - `sceneVisualAssignments(data, sourceId, { assetId, cue = null, id })` → new visual assignments (the whole-span clip replaces every visual clip in that source)
  - `sceneSoundAssignments(data, sourceId, { assetId, assets, id } | null)` → new audio assignments (`null` removes the scene's bed clips); gets the `syncGroup` of the whole-scene visual clip when present
  - `writtenSource(text, { id, name })` → source object
  - `rewriteWrittenScene(data, sourceId, text)` → `{ sources, visualScoreAssignments, audioScoreAssignments }`, re-spanning whole clips; throws `SCENE_HAS_PASSAGES` when passage clips exist or `SCENE_NOT_WRITTEN` for others
  - `moveScene(sources, from, to)` → new array
  - `sessionForScene(data, sourceId)` → a clone with one source and only its clips
  - `leafToEditorAssetId(leafId, pool)` → `'surface:focal'|'surface:attractor'|'surface:genesis'|'surface:off'|'procedural:<id>'|'collection:<pool>'|null`

- [ ] Write the tests first, using real `assignVisualSpan` data (a source `{ id:'s1', data:'Waste no more time arguing.' }`):
  - Whole span: after `sceneVisualAssignments`, one clip with `fromCharacter 0`, `toCharacter` = text length, and `scenesFromSession(...)[0].visual.whole === true`.
  - Replacing: two passage clips, then a scene visual, leaves exactly one clip.
  - `passages` counts non-whole clips, and `whole` is false when any exist.
  - Sound sync: a scene sound after a scene visual carries `syncGroup === 'sync-' + visualClip.id`.
  - `null` sound removes only the bed clips of that source.
  - `rewriteWrittenScene` re-spans to the new length, rejects a Library source, and rejects a source with passages.
  - `moveScene(['a','b','c'], 0, 2)` gives `['b','c','a']`, and out-of-range is identity.
  - `sessionForScene` keeps one source and its clips, and drops other sources' clips.
  - `leafToEditorAssetId`: `klee → surface:genesis`, `fractal → procedural:fractal`, `by-manner` + `aic-impressionism` → `collection:aic-impressionism`, `personal` + `global-pool` → `collection:global-pool`, `science` → `null`.
  - A compiled round trip: `compileWorkshopScoreProgram` accepts the output of the above (import it the way `Workshop.prepareSessionPayload` does).
- [ ] Run them and expect FAIL. Implement. Run them and expect PASS.
- [ ] Commit: `A scene is a source, and its visual is one clip`.

### Task 5: The Scene Stack

**Files:**
- Create: `src/components/workshop/SceneStack.js`, `src/components/workshop/scene-stack.css`, `src/components/workshop/SceneStack.test.js`, `e2e/workshop-scenes.spec.js`
- Modify: `src/components/Workshop.js`: `phoneMode` (`'scenes'` default on phone), mount/refresh/destroy `SceneStack`, scene commands, and `previewSession(data)` extracted from the `preview` action; `src/components/workshop/WorkshopStudioShell.js` (`data-phone-mode`); `src/components/Workshop.css` (hide the studio when `data-phone-mode="scenes"`)

**Interfaces:**
- Consumes: Task 4 core; Task 2 `VisualNavigator` in `mode: 'pick'`; existing `addSource`, `removeSource`, `openSourceBrowser`, `openAdmit`, `saveSequenceToVault`, `exportExperienceProgramFile`, `showProgramImportChooser`, `openSavedBlueprint`, `audioScoreAssets`, `visualAssetEntries`, `personalSwells`.
- Produces: `new SceneStack(host, api)`, where `api` = `{ scenes(), title(), dirty(), pace(), sequences(), stillFor(assetId), soundOptions(), pickableLeaves(), addWritten(text), divideAndAdd(text), openLibrary(), importFile(), editScene(id, text), removeScene(id), moveScene(from, to), setSceneVisual(id, leafPick), setSceneSound(id, assetId|null), setPace({ wpm, chunkMode }), rename(title), openSequence(id), save(), share(), exportJson(), importJson(), playScene(id), playAll(), reset(), openStudio() }` plus `refresh()`, `openScene(id)`, and `destroy()`. The Workshop owns `this.sceneStack` and `this.openSceneId`.

- [ ] Component tests (jsdom, a fake `api` with `vi.fn()`s):
  - The empty stack shows *Write the first scene* plus *From the Library* and *From a file*, and nothing else.
  - Write → the textarea → Done calls `api.addWritten(text)`; an empty text is refused inline. More than 400 words shows *Divide into scenes* → `api.divideAndAdd`.
  - A card renders the excerpt, the visual name, and the sound. Its ▶ calls `playScene(id)`.
  - Tapping a card opens the scene view. Visual opens the picker (the `VisualNavigator` stub records `mode: 'pick'`), and `onPick` calls `setSceneVisual`. A scene with `visual.passages > 0` asks for confirmation first.
  - The Sound sheet lists *Same as the sequence* first, then options. A pick calls `setSceneSound`.
  - Pace sheet: the slider snaps (a value of 205 becomes 200), and Word/Phrase call `setPace`.
  - ⋯ sheet: every command calls its api function. *Full studio* calls `openStudio`.
  - The card ⋯ offers Move up / Move down / Remove, calling `moveScene` / `removeScene` (Remove asks for confirmation).
  - Reorder by pointer: a long-press on ≡ for 250 ms, a move past half the next card, and a release call `moveScene(0, 1)` once.
  - Focus returns to the opening control when any sheet closes, and Escape closes the top sheet.
- [ ] Workshop integration tests (`Workshop.scenes.test.js`, `viewportWidth: 390`): `addWritten` creates a `written-` local source; `setSceneVisual('klee', ...)` produces one whole clip with `assetId 'surface:genesis'` and activates Scored; `setSceneSound` syncs; `moveScene` reorders and marks dirty; `playScene` calls `onCreateSession` with one source and `isPreview: true`; after `update()` (return from preview) the same scene reopens; `openStudio` flips `data-phone-mode` to `studio`, and the studio's *Scenes* button flips it back; a desktop width never mounts the stack.
- [ ] Implement it. New scenes inherit the previous scene's whole visual and sound (when whole). Write copy exactly as in spec §4.
- [ ] E2E `workshop-scenes.spec.js` at 390 × 844 and 360 × 800 (touch): Workshop → Write the first scene → type → Done → the card is visible; Visual → the stage → choose Turrell → the card backdrop gets a still; + Scene → From the Library → Middlemarch chapter → two cards; open ⋯ on card 2 → Move up → order swapped; ▶ Play → Chamber visible → exit → the stack is back with two cards; no horizontal overflow at any step.
- [ ] Run the unit tests for the workshop folder and the Workshop tests, plus the e2e tests `workshop-scenes`, `workshop-selection`, and `workshop-media-persistence`, and expect PASS. `workshop-selection` runs on the phone, so it now begins with ⋯ → Full studio.
- [ ] Screenshot and check by eye. Commit: `On a phone the Workshop is a stack of scenes`.

### Task 6: Full studio header, spec amendment, diagram

**Files:**
- Modify: `src/components/workshop/StudioTransport.js`, `src/components/Workshop.css` (phone header ≤ 56 px; commands in one `details` sheet; *Scenes* return button), `docs/vision/WORKSHOP-COMPOSITION-STUDIO-SPEC.md` (§3.7 amended, §5.3 points at the new spec), `docs/specs/ARCHITECTURE.md` via `npm run docs:diagram`

- [ ] A test in `Workshop.test.js`: at `viewportWidth: 390` with `phoneMode = 'studio'`, the transport renders `[data-action="show-scenes"]`, and the command cluster is inside `.studio-phone-commands`.
- [ ] Implement, then measure in the browser: at 390 × 844 in Full studio, `.studio-header` height is ≤ 56 px.
- [ ] Amend spec §3.7: "Phone authoring is a distinct instrument (see 2026-09-25 spec); the full studio remains reachable on phones as an explicit escape."
- [ ] Run `npm run docs:diagram`, `npx vitest run src/core/system-design.test.js`, `node scripts/ci-hygiene.mjs`, the full `npm run test:run`, and `npm run test:e2e:gate`.
- [ ] Commit: `The full studio keeps its score on a phone`.
