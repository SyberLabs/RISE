# Chamber Text Materials and Fit Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace implicit Fit-mask coupling with one canonical text-material contract, make the Visual Navigator explain and transact valid combinations, and make cold-start masks appear atomically only after both glyph geometry and the first visual projection are ready.

**Architecture:** A dependency-free `chamber-text-material` core module owns material normalization and the Thick + Fit capability rule. Visual Navigator requests complete transactions; Chamber Orbital owns persistence and temporal coupling. Chamber renders an opaque fallback until its targeted font, glyph mask, and first projection paint share one generation, then activates the mask in one animation frame. Existing visual fields gain a one-shot first-paint readiness contract instead of timers or polling.

**Tech Stack:** Vanilla JavaScript, Vite, Vitest/jsdom, Playwright, CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-08-24-chamber-text-materials-fit-readiness-design.md`

---

## Global Constraints

- This plan owns text-material state, Visual Navigator affordances, Fit projection readiness, Living Text color modulation, stable contours, and glyph-local projection geometry.
- It does not own Chamber Orbital viewport geometry or Portal styling; those are separate plans.
- The only visual-mask-capable type combination is Face `thick` plus Size `fit`.
- Plain and Accent are always valid. Accent toggles back to Plain.
- Explicit mask materials default to a cream contour. Border choices are `off`, `cream`, and `accent`.
- Leaving Thick or Fit while a visual mask is active requires confirmation; acceptance switches the material to Accent atomically.
- The Begin action never waits for visual readiness. Chamber shows readable opaque fallback text until ready.
- No timeout, sleep, polling loop, duplicated visual director, global `zoom`, or `transform: scale()` is permitted.

## File Structure

- `src/core/chamber-text-material.js` — dependency-light normalization and the sole authoring/runtime capability decision.
- `src/core/visual-selection.js` and `src/core/visual-taxonomy-config.js` — canonical material serialization and legacy-compatible round trips.
- `src/components/VisualNavigator.js` — explanatory controls and transaction requests; it does not own persistence.
- `src/components/ChamberOrbital.js` — singular owner of cross-domain setting, temporal, and visual persistence.
- `src/core/conductor.js` — pure semantic color interpretation, including optional accent-family input.
- `src/visuals/*field.js` and `src/visuals/visual-cortex.js` — existing presenters plus one-shot first-projection-paint readiness.
- `src/core/fit-projection.js` — pure glyph-local projection geometry; no DOM or renderer ownership.
- `src/components/Chamber.js` — generation-owned fallback, readiness coordination, and atomic mask activation.
- `e2e/fit-mask.spec.js` — human-visible cold-start, affordance, persistence, and geometry regressions.

### Task 1: Establish canonical text-material state and one capability authority

**Files:**

- Create: `src/core/chamber-text-material.js`
- Create: `src/core/chamber-text-material.test.js`
- Modify: `src/core/visual-selection.js`
- Modify: `src/core/visual-selection.test.js`
- Modify: `src/core/visual-taxonomy-config.js`
- Modify: `src/core/visual-taxonomy-config.test.js`
- Modify: `src/core/chamber-type-size.js`
- Modify: `src/core/chamber-type-size.test.js`
- Modify: `src/components/Chamber.js`

**Interfaces:**

- Consumes: `resolveChamberStreamFace(value: string): string`, `normalizeWordFill(value?: object): WordFill`.
- Produces: `normalizeFitBorder(value: string, fallback?: string): 'off'|'cream'|'accent'`, `isVisualMaskMaterial(value?: object): boolean`, `resolveTextMaterialCapability(input: TextMaterialInput): TextMaterialCapability`, and `resolveFitMaskMode(input: TextMaterialInput): boolean`.

- [ ] **Step 1: Write failing normalization and capability tests**

Add tests proving these exact contracts:

```js
expect(normalizeWordFill({ mode: 'plain' })).toEqual({ mode: 'plain' });
expect(normalizeWordFill({ mode: 'same' })).toEqual({ mode: 'same', border: 'cream' });
expect(normalizeWordFill({ mode: 'same', border: 'accent' }))
  .toEqual({ mode: 'same', border: 'accent' });
expect(normalizeWordFill({ mode: 'pick', procedural: ['procedural:fractal'], border: 'off' }))
  .toMatchObject({ mode: 'pick', procedural: ['procedural:fractal'], border: 'off' });
expect(normalizeWordFill()).toEqual({ mode: 'same' }); // retain legacy inference shape
```

In `chamber-text-material.test.js`, cover the full truth table:

```js
const maskSurface = {
  chunkMode: 'word', visualMode: 'interlocution', presentation: 'continuous'
};
expect(resolveTextMaterialCapability({ ...maskSurface, face: 'thick', fontSize: 'fit', wordFill: { mode: 'same' } }))
  .toMatchObject({ available: true, reason: null, canMask: true, maskRequested: true, maskActive: true });
expect(resolveTextMaterialCapability({ ...maskSurface, face: 'display', fontSize: 'fit', wordFill: { mode: 'same' } }))
  .toMatchObject({ available: false, canMask: false, maskRequested: true, maskActive: false, reason: 'requires-thick', correctiveAction: 'use-thick-fit' });
expect(resolveTextMaterialCapability({ ...maskSurface, face: 'thick', fontSize: 'medium', wordFill: { mode: 'same' } }))
  .toMatchObject({ available: false, canMask: false, maskRequested: true, maskActive: false, reason: 'requires-fit', correctiveAction: 'use-thick-fit' });
expect(resolveTextMaterialCapability({ ...maskSurface, face: 'literary', fontSize: 'medium', wordFill: { mode: 'accent' } }))
  .toMatchObject({ available: true, canMask: false, maskRequested: false, maskActive: false, reason: null });
expect(resolveTextMaterialCapability({ ...maskSurface, face: 'thick', fontSize: 'fit' }))
  .toMatchObject({ maskRequested: false, maskActive: false });
expect(resolveTextMaterialCapability({
  ...maskSurface, face: 'thick', fontSize: 'fit', presentation: 'behind-stream', wordFill: { mode: 'same' }
})).toMatchObject({ available: false, maskRequested: false, maskActive: false, reason: 'requires-gallery' });
expect(resolveTextMaterialCapability({
  ...maskSurface, face: 'thick', fontSize: 'fit', wordFill: { mode: 'same' }, programOwned: true
})).toMatchObject({ available: false, maskActive: true, reason: 'program-owned', correctiveAction: null });
```

- [ ] **Step 2: Run the focused tests and record the expected failure**

Run:

```bash
npx vitest run src/core/chamber-text-material.test.js src/core/visual-selection.test.js src/core/visual-taxonomy-config.test.js src/core/chamber-type-size.test.js
```

Expected: FAIL because `plain`, `border`, and `resolveTextMaterialCapability` do not exist.

- [ ] **Step 3: Implement normalization without a circular dependency**

Create `src/core/chamber-text-material.js` with no import from UI or visual fields:

```js
import { resolveChamberStreamFace } from './chamber-stream-face.js';
import { normalizeWordFill } from './visual-selection.js';
export { normalizeFitBorder } from './visual-selection.js';

const FIT_SIZE_ALIASES = new Set(['fit', 'continuous-word']);
const MASK_MODES = new Set(['same', 'pick']);

export function isVisualMaskMaterial(value) {
  return MASK_MODES.has(normalizeWordFill(value).mode);
}

export function resolveTextMaterialCapability({
  face, fontSize, chunkMode, visualMode, presentation, wordFill,
  legacyMask = false, programOwned = false
} = {}) {
  const thick = resolveChamberStreamFace(face) === 'thick';
  const fit = FIT_SIZE_ALIASES.has(String(fontSize || '').trim().toLowerCase());
  const wordTiming = chunkMode === 'word';
  const gallery = visualMode === 'interlocution'
    && (presentation === 'continuous' || presentation === 'continuous-word');
  const declared = wordFill != null && typeof wordFill === 'object' && !Array.isArray(wordFill);
  const materialRequestsMask = declared ? isVisualMaskMaterial(wordFill) : legacyMask === true;
  const maskRequested = materialRequestsMask && wordTiming && gallery;
  const canMask = thick && fit && wordTiming && gallery;
  const capabilityReason = !materialRequestsMask ? null
    : !wordTiming ? 'requires-word'
    : !gallery ? 'requires-gallery'
    : !thick ? 'requires-thick'
    : !fit ? 'requires-fit'
    : null;
  return {
    available: !programOwned && capabilityReason == null,
    reason: programOwned ? 'program-owned' : capabilityReason,
    correctiveAction: programOwned || capabilityReason == null ? null : 'use-thick-fit',
    canMask,
    maskRequested,
    maskActive: canMask && maskRequested,
  };
}

export function resolveFitMaskMode(input = {}) {
  return resolveTextMaterialCapability(input).maskActive;
}
```

Export `normalizeFitBorder` from `visual-selection.js`, then extend `normalizeWordFill` with the four canonical modes. Preserve the border only for explicit visual-mask values; keep absent legacy input as `{ mode: 'same' }` so old inferred pair behavior does not silently opt into a new border.

```js
export function normalizeFitBorder(value, fallback = 'cream') {
  return value === 'off' || value === 'cream' || value === 'accent' ? value : fallback;
}

if (value.mode === 'plain') return { mode: 'plain' };
if (value.mode === 'accent') return { mode: 'accent' };
if (value.mode === 'same') return { mode: 'same', border: normalizeFitBorder(value.border) };
// After validating a non-empty pick:
return { mode: 'pick', ...selection, border: normalizeFitBorder(value.border) };
```

`chamber-text-material.js` re-exports this helper. `visual-selection` never imports the capability module, so the dependency remains acyclic and the border values have one owner.

Change `cloneWordFill` to preserve `border` and `plain`:

```js
function cloneWordFill(value) {
  const fill = normalizeWordFill(value);
  if (fill.mode === 'plain' || fill.mode === 'accent') return { mode: fill.mode };
  if (fill.mode === 'same') return { mode: 'same', ...(fill.border ? { border: fill.border } : {}) };
  return { ...fill, procedural: [...fill.procedural], sourced: [...fill.sourced] };
}
```

Move `resolveFitMaskMode` out of `chamber-type-size.js`; update Chamber and tests to import it from `chamber-text-material.js`. Do not leave a re-export facade, because that would reintroduce the type-size/material dependency cycle.

Update `Chamber.chamberMaskApplies()` to pass the complete existing runtime surface plus Face:

```js
return resolveFitMaskMode({
  face: settings.chamberFace,
  fontSize: settings.fontSize,
  chunkMode: this.session?.chunkMode,
  visualMode: visualConfig?.visualMode,
  presentation,
  wordFill: visualConfig?.interlocution?.wordFill,
  legacyMask: settings.chamberMask === true
});
```

- [ ] **Step 4: Run focused tests to green**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/chamber-text-material.js src/core/chamber-text-material.test.js src/core/visual-selection.js src/core/visual-selection.test.js src/core/visual-taxonomy-config.js src/core/visual-taxonomy-config.test.js src/core/chamber-type-size.js src/core/chamber-type-size.test.js src/components/Chamber.js
git commit -m "refactor: centralize chamber text materials"
```

### Task 2: Make Visual Navigator truthful and transactional

**Files:**

- Modify: `src/components/VisualNavigator.js`
- Modify: `src/components/VisualNavigator.css`
- Modify: `src/components/VisualNavigator.test.js`
- Modify: `e2e/fit-mask.spec.js`

**Interfaces:**

- Consumes: `normalizeWordFill`, `resolveTextMaterialCapability`, and existing `configPatch(selection): VisualConfig`.
- Produces: constructor option `onTextMaterialTransaction(transaction: { settings: { chamberFace: string, fontSize: string }, temporal: { chunkMode: 'word', recitation: false }|null, visualConfig: VisualConfig }): void`.

- [ ] **Step 1: Write failing interaction tests**

Add tests for:

1. Accent appears for every Face and Size; Plain is its off state rather than a second button.
2. Clicking active Accent requests `{ wordFill: { mode: 'plain' } }`.
3. Thick carries a visible `★` and `aria-describedby` explanation.
4. A mask choice outside Thick + Fit opens an explainer with the exact action `Use Thick + Fit`.
5. The action emits one transaction containing `chamberFace: 'thick'`, `fontSize: 'fit'`, word atom pacing, recitation off, canonical Gallery presentation, and the requested material.
6. Changing Face or Size away from a valid active mask opens confirmation; cancel changes nothing, accept emits one transaction whose material is Accent.
7. Border buttons are hidden for Plain/Accent and expose Off/Cream/Accent for a valid mask; Cream is initially selected.
8. Neural, Rock Garden, and Spectral are absent from mask choices.
9. Program-owned text material controls remain read-only and expose the program-ownership reason on pointer, focus, and touch activation.
10. Face renders as an even 2×2 grid and the Thick explanation appears through hover, keyboard focus, and `pointerup` from a touch pointer.
11. Replacing a mask source preserves its existing border value.

Add browser assertions for the locked Visual Mask explanation, the `Use Thick + Fit` transaction, Accent toggling, confirmation when leaving Fit, border persistence, and omission of Neural, Rock Garden, and Spectral. Use the existing `openPrep`, `chooseFit`, and seeded configuration helpers in `e2e/fit-mask.spec.js`.

Use one callback assertion, not a sequence of incidental setting writes:

```js
const onTextMaterialTransaction = vi.fn();
mount({}, { onTextMaterialTransaction });
click(node('ink'));
click(nav.container.querySelector('[data-word-fill="same"]'));
click(nav.container.querySelector('[data-action="use-thick-fit"]'));
expect(onTextMaterialTransaction).toHaveBeenCalledWith({
  settings: { chamberFace: 'thick', fontSize: 'fit' },
  temporal: { chunkMode: 'word', recitation: false },
  visualConfig: expect.objectContaining({
    visualMode: 'interlocution',
    interlocution: expect.objectContaining({
      presentation: 'continuous',
      wordFill: { mode: 'same', border: 'cream' }
    })
  })
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run src/components/VisualNavigator.test.js
npx playwright test e2e/fit-mask.spec.js --grep "material controls"
```

Expected: FAIL because the Navigator has no transaction callback, explainer, confirmation, Plain material, or border controls.

- [ ] **Step 3: Implement the text-material interaction model**

Add constructor option:

```js
this.onTextMaterialTransaction = options.onTextMaterialTransaction || (() => {});
```

Replace direct cross-domain mutation with:

```js
requestTextMaterialTransaction({ face, fontSize, wordFill, temporal = null }) {
  const next = normalizeWordFill(wordFill);
  this.selection.wordFill = next;
  const visualConfig = configPatch(this.selection);
  this.onTextMaterialTransaction({
    settings: { chamberFace: face, fontSize },
    temporal,
    visualConfig
  });
}
```

Keep ordinary non-invalidating Face/Size changes on their existing focused path. Use the transaction callback only when multiple domains must change together: mask enablement, mask invalidation, and Accent toggle.

Render text controls in this order:

- Face: Literary, Display, `Thick ★`, Japanese in an even 2×2 grid.
- Size: existing sizes including Fit.
- Ink: Accent is an always-available toggle whose off state is Plain; Visual Mask remains visible with `aria-disabled` semantics when capability-gated.
- Border: Off, Cream, Accent only when a visual mask is selected and capability is valid.

Add one lightweight dialog inside the Navigator root. It must use `role="dialog"`, an accessible title, focus the primary action, restore focus on close, and support Escape. Use these exact messages:

- Blocked mask title: `Visual masks require Thick + Fit.`
- Blocked mask body: `Bold, chamber-filling words provide enough surface for imagery.`
- Invalidating change: `This change cannot keep the current visual mask. Continue with Accent ink?`

Use `.is-blocked`, `.is-special`, `.is-selected`, and `:focus-visible` states. The Thick affordance text is `Thick is the mask-ready face.` Locked mask controls use `aria-disabled="true"`, not native `disabled`, so pointer, keyboard, and touch can open the explanation. Do not silently coerce Face or Size.

- [ ] **Step 4: Run focused tests to green**

Run both Step 2 commands.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/VisualNavigator.js src/components/VisualNavigator.css src/components/VisualNavigator.test.js e2e/fit-mask.spec.js
git commit -m "feat: clarify chamber text material controls"
```

### Task 3: Give Chamber Orbital singular transaction ownership

**Files:**

- Modify: `src/components/ChamberOrbital.js`
- Modify: `src/components/ChamberOrbital.stances.test.js`

**Interfaces:**

- Consumes: the `onTextMaterialTransaction` transaction shape produced by Task 2.
- Produces: `ChamberOrbital.applyTextMaterialTransaction(transaction): void`, which synchronizes and persists exactly once.

- [ ] **Step 1: Write failing integration tests**

Extend the current Fit-coupling test to prove a transaction creates one coherent persisted state and one synchronization pass:

```js
expect(globalThis.rise.settings).toMatchObject({ chamberFace: 'thick', fontSize: 'fit' });
expect(orbital.config).toMatchObject({ chunkMode: 'word', recitation: { enabled: false } });
expect(orbital.config.visualInterlocution.interlocution.wordFill)
  .toEqual({ mode: 'same', border: 'cream' });
expect(syncSpy).toHaveBeenCalledTimes(1);
expect(persistSpy).toHaveBeenCalledTimes(1);
```

Add cancel/confirm tests for leaving Thick or Fit. Confirm must set Accent before render; cancel must preserve every domain.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run src/components/ChamberOrbital.stances.test.js
```

Expected: FAIL because the existing `onFitRequested` path performs separate mutations and cannot represent confirmation.

- [ ] **Step 3: Implement one owner method**

Add:

```js
applyTextMaterialTransaction({ settings = {}, temporal = null, visualConfig }) {
  Object.assign(globalThis.rise.settings, settings);
  if (temporal?.chunkMode) this.config.chunkMode = temporal.chunkMode;
  if (temporal?.recitation === false) this.config.recitation = { enabled: false };
  this.config.visualInterlocution = visualConfig;
  this.syncUIWithConfig();
  this.updateOrbitStatus('temporal');
  this.updateOrbitStatus('visual');
  this._syncStanceRow();
  this._persistPrefs();
}
```

Pass it into Visual Navigator:

```js
onTextMaterialTransaction: transaction => this.applyTextMaterialTransaction(transaction)
```

Remove `onFitRequested` only after its remaining call sites and tests are migrated. Keep existing program-lock and held-focal authority unchanged.

- [ ] **Step 4: Run focused tests to green**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChamberOrbital.js src/components/ChamberOrbital.stances.test.js
git commit -m "refactor: transact chamber text material changes"
```

### Task 4: Preserve Accent identity under Living Text and add stable contours

**Files:**

- Modify: `src/core/conductor.js`
- Modify: `src/core/conductor.test.js`
- Modify: `src/components/Chamber.js`
- Modify: `src/components/Chamber.css`
- Modify: `src/components/Chamber.livingtext.test.js`
- Modify: `src/components/Chamber.mask.test.js`

**Interfaces:**

- Consumes: canonical `WordFill` values from Task 1 and existing `--color-accent-rgb` profile state.
- Produces: `livingTextAppearance(signal, intensity, options?: { baseRgb?: [number, number, number] }): LivingTextAppearance` and CSS variable `--fit-border-color` on the active atom.

- [ ] **Step 1: Write failing color and contour tests**

Add a pure conductor test that starts from an explicit accent RGB and checks bounded semantic movement:

```js
const base = [60, 97, 170];
const result = livingTextAppearance({ valence: 1, arousal: 1 }, 1, { baseRgb: base });
expect(result.rgb).not.toEqual(base);
expect(result.rgb[2]).toBeGreaterThan(result.rgb[1]);
expect(result.rgb[1]).toBeGreaterThan(result.rgb[0]);
expect(result.rgb.every((channel, index) => Math.abs(channel - base[index]) <= 48)).toBe(true);
```

Add Chamber tests proving:

- Plain retains the existing cream Living Text behavior.
- Accent reads the current `--color-accent-rgb`, then Living Text modulates it without losing its dominant hue.
- Visual-mask ink remains transparent while Living Text changes projection parameters.
- Border `off` clears `--fit-border-color`; cream sets `var(--color-light)`; accent sets `var(--color-accent)`.
- Fit has no text shadow.

Assert the inline custom property rather than jsdom's incomplete WebKit computed style:

```js
expect(atomDisplay.style.getPropertyValue('--fit-border-color')).toBe('var(--color-accent)');
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run src/core/conductor.test.js src/components/Chamber.livingtext.test.js src/components/Chamber.mask.test.js
```

Expected: FAIL because `livingTextAppearance` cannot accept a base hue and borders are not material state.

- [ ] **Step 3: Implement bounded base-color modulation**

Extend `livingTextAppearance(signal, intensity, options = {})`. Retain the existing path byte-for-byte when `baseRgb` is absent. When it is present, replace only the neutral-to-pole interpolation with a bounded accent-to-pole interpolation:

```js
const base = Array.isArray(options.baseRgb) && options.baseRgb.length === 3
  ? options.baseRgb.map(channel => clamp(Math.round(Number(channel) || 0), 0, 255))
  : neutral;
const accentBound = options.baseRgb ? 0.22 : 1;
const t = mood * strength * accentBound;
const rgb = base.map((channel, index) => (
  Math.round(channel + (pole[index] - channel) * t)
));
```

This reuses the current semantic pole, mood curve, glow, and Fit modulation while guaranteeing that Accent remains recognizable.

In `Chamber.applyLivingText`, select the base from `--color-accent-rgb` only for Accent. For a visual mask, continue calling `_applyLivingFit`; never apply opaque semantic text color.

Map border state to one CSS custom property and a stable contour:

```css
.atom-display.is-word-fit.is-mask-ink {
  color: transparent;
  -webkit-text-fill-color: transparent;
  -webkit-text-stroke: clamp(0.75px, 0.1em, 2px) var(--fit-border-color, transparent);
  paint-order: stroke fill;
  text-shadow: none;
}

@supports not (-webkit-text-stroke: 1px currentColor) {
  .atom-display.is-word-fit.is-mask-ink {
    -webkit-text-stroke: 0;
  }
}
```

Do not use blur, glow, or shadow as a substitute for a contour.

- [ ] **Step 4: Run focused tests to green**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/conductor.js src/core/conductor.test.js src/components/Chamber.js src/components/Chamber.css src/components/Chamber.livingtext.test.js src/components/Chamber.mask.test.js
git commit -m "feat: preserve semantic text material color"
```

### Task 5: Add first-projection-paint readiness to existing visual fields

**Files:**

- Modify: `src/visuals/continuous-field.js`
- Modify: `src/visuals/continuous-field.test.js`
- Modify: `src/visuals/work-engine-field.js`
- Modify: `src/visuals/work-engine-field.test.js`
- Modify: `src/visuals/harmonograph-field.js`
- Modify: `src/visuals/harmonograph-field.test.js`
- Modify: `src/visuals/plate-field.js`
- Modify: `src/visuals/plate-field.test.js`
- Modify: `src/visuals/attractor.js`
- Modify: `src/visuals/attractor.test.js`
- Modify: `src/visuals/visual-cortex.js`
- Modify: `src/visuals/visual-cortex.test.js`

**Interfaces:**

- Consumes: existing `setProjectionHost(host: HTMLElement|null): void` field contract.
- Produces: field option `onProjectionPaint(host: HTMLElement): void` and `VisualCortex.whenContinuousFieldProjectionReady(host: HTMLElement): Promise<void>`.

- [ ] **Step 1: Write failing readiness tests**

For each field, prove the callback fires once only after the projection host has painted visible content, never for the backdrop host, stale generation, failed decode, or teardown:

```js
const onProjectionPaint = vi.fn();
const field = mountField({ onProjectionPaint });
field.setProjectionHost(projection);
field.start();
await flushDecodedWork();
expect(onProjectionPaint).toHaveBeenCalledTimes(1);
field.render();
expect(onProjectionPaint).toHaveBeenCalledTimes(1);
```

Visual Cortex tests must cover:

```js
const pending = cortex.whenContinuousFieldProjectionReady(host);
cortex.setContinuousFieldProjectionHost(host);
await expect(pending).resolves.toBeUndefined();
```

and rejection with an `AbortError` when the host is replaced or cleared before first paint.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run src/visuals/continuous-field.test.js src/visuals/work-engine-field.test.js src/visuals/harmonograph-field.test.js src/visuals/plate-field.test.js src/visuals/attractor.test.js src/visuals/visual-cortex.test.js
```

Expected: FAIL because no first-paint callback or host-scoped readiness promise exists.

- [ ] **Step 3: Implement a one-shot field contract**

Each field accepts `onProjectionPaint = () => {}` and resets a `_projectionPainted` flag in `setProjectionHost`. Call a private method only after decoded imagery is made visible or a procedural projection canvas has completed its first draw:

```js
_reportProjectionPaint() {
  if (this._projectionPainted || !this.projectionHost) return;
  this._projectionPainted = true;
  this.onProjectionPaint(this.projectionHost);
}
```

Do not create a new director or animation loop.

In Visual Cortex, maintain one deferred promise per current projection host:

```js
whenContinuousFieldProjectionReady(host) {
  if (!host) return Promise.reject(new DOMException('Projection host required', 'AbortError'));
  if (this._projectionReadyHost === host && this._projectionPainted) return Promise.resolve();
  if (this._projectionReadyHost !== host) this._beginProjectionReadiness(host);
  return this._projectionReadyPromise;
}
```

Resolve from the field callback only when the callback host equals the current host. Reject and replace the previous deferred when the host changes. Attach an internal no-op rejection handler to prevent an unobserved cancellation from becoming an unhandled rejection, while still returning the original rejecting promise to callers.

- [ ] **Step 4: Run focused tests to green**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/visuals/continuous-field.js src/visuals/continuous-field.test.js src/visuals/work-engine-field.js src/visuals/work-engine-field.test.js src/visuals/harmonograph-field.js src/visuals/harmonograph-field.test.js src/visuals/plate-field.js src/visuals/plate-field.test.js src/visuals/attractor.js src/visuals/attractor.test.js src/visuals/visual-cortex.js src/visuals/visual-cortex.test.js
git commit -m "feat: expose fit projection readiness"
```

### Task 6: Make Chamber fallback-to-mask activation atomic

**Files:**

- Modify: `src/components/Chamber.js`
- Modify: `src/components/Chamber.css`
- Modify: `src/components/Chamber.mask.test.js`
- Modify: `src/components/Chamber.type-size.test.js`
- Modify: `e2e/fit-mask.spec.js`

**Interfaces:**

- Consumes: `resolveTextMaterialCapability` from Task 1 and `whenContinuousFieldProjectionReady(host)` from Task 5.
- Produces: generation-owned `Chamber.syncFillGlyphMask(): Promise<void>` states `inactive|fallback|preparing|ready` in `#atom-display[data-mask-state]`.

- [ ] **Step 1: Write the failing state-machine tests**

Prove these transitions:

```text
plain -> preparing (still opaque) -> ready -> one RAF -> mask ink
```

Tests must hold the font promise and projection promise independently. The atom stays readable until both resolve. Resolving an old generation after changing the atom, material, or projection host must not activate mask ink. A rejected projection returns to readable fallback and does not retry by timer.

Add browser cases named with `atomic readiness`: hard reload Fractal Flames on desktop and 390×844 mobile with first decode delayed, and hard reload Old Masters with the first sourced response delayed. Throughout the delay assert `data-mask-state` is `fallback` or `preparing`, the atom has non-transparent text fill, and dimensions remain centered. Then release readiness and assert `data-mask-state="ready"` without a fixed readiness sleep.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run src/components/Chamber.mask.test.js src/components/Chamber.type-size.test.js
npx playwright test e2e/fit-mask.spec.js --grep "atomic readiness"
```

Expected: FAIL because `syncFillGlyphMask` makes ink transparent before font/projection readiness.

- [ ] **Step 3: Implement generation-owned readiness**

Replace broad `_waitFontsReady()` with a targeted helper:

```js
async _waitThickFontReady(text) {
  if (!document.fonts?.load) return true;
  const loaded = await document.fonts.load('700 1em "Space Grotesk"', text);
  return loaded.length > 0;
}
```

Refactor `syncFillGlyphMask` so it:

1. increments `_fillMaskGeneration`;
2. resolves capability through `resolveTextMaterialCapability`;
3. immediately applies readable fallback state and removes `is-mask-ink`;
4. awaits `_waitThickFontReady(currentText)` and `visualCortex.whenContinuousFieldProjectionReady(this.fillFieldHost)` with `Promise.all`;
5. rebuilds the glyph clip path;
6. confirms the generation, current atom, material, and host still match;
7. schedules one `requestAnimationFrame` and rechecks generation;
8. adds `is-mask-ink` and `is-mask-ready` together.

At the existing continuous-field session initialization seam, call `ensureFillField()` for a mask-capable session before the first atom and allow it to prime asynchronously. Do not await it from Begin or the Player clock.

Use data state for diagnostics:

```js
atomDisplay.dataset.maskState = 'fallback'; // then 'preparing', 'ready', or 'inactive'
```

On rejection, keep fallback readable and set `maskState = 'fallback'`. Do not block playback or Begin.

- [ ] **Step 4: Run focused tests to green**

Run both Step 2 commands.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Chamber.js src/components/Chamber.css src/components/Chamber.mask.test.js src/components/Chamber.type-size.test.js e2e/fit-mask.spec.js
git commit -m "fix: activate fit masks after first paint"
```

### Task 7: Fit the visual projection to glyph-local bounds

**Files:**

- Create: `src/core/fit-projection.js`
- Create: `src/core/fit-projection.test.js`
- Modify: `src/components/Chamber.js`
- Modify: `src/components/Chamber.css`
- Modify: `src/components/Chamber.mask.test.js`
- Modify: `src/visuals/continuous-field.js`
- Modify: `src/visuals/continuous-field.test.js`
- Modify: `src/visuals/flame-fill-adapter.js`
- Modify: `src/visuals/flame-fill-adapter.test.js`
- Modify: `e2e/fit-mask.spec.js`

**Interfaces:**

- Consumes: the projection host readiness contract from Task 5 and current `applyFlameFillToCanvas` density limits.
- Produces: `resolveFitProjection(input: FitProjectionInput): { mask: Rect, projection: Rect & { scale: number }, visibleAreaRatio: number }|null` and `.chamber-fill-viewport` as the projection host.

- [ ] **Step 1: Write failing geometry tests**

Define a pure function:

```js
resolveFitProjection({
  fieldRect, glyphRect, sourceKind, intrinsicWidth, intrinsicHeight, devicePixelRatio
})
```

Test landscape, portrait, and square work. The returned viewport must cover glyph bounds, remain inside the stage, preserve aspect ratio, and cap enlargement so a narrow word cannot trigger unbounded zoom. Include a whitespace-heavy glyph fixture and assert its visible-area ratio increases the existing Fractal fill density within the adapter's current safety limits.

Add a browser case named `glyph local projection` that displays short and long Fit words against Fractal Flames, asserts `.chamber-fill-viewport` remains inside `.chamber-fill-field`, has finite non-zero bounds, never exceeds the adapter's scale cap, and leaves the atom center within two CSS pixels of the Chamber field center.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run src/core/fit-projection.test.js src/components/Chamber.mask.test.js src/visuals/continuous-field.test.js src/visuals/flame-fill-adapter.test.js
npx playwright test e2e/fit-mask.spec.js --grep "glyph local projection"
```

Expected: FAIL because the projection is stage-aligned only and has no pure glyph-local geometry.

- [ ] **Step 3: Implement a nested projection viewport**

Return `null` for empty or non-finite input. Otherwise return this stable shape:

```js
{
  mask: { left, top, width, height },
  projection: { left, top, width, height, scale },
  visibleAreaRatio
}
```

Keep `.chamber-fill-field` as the stage-aligned clipping host. Add one child `.chamber-fill-viewport` positioned from the pure result and pass that child to Visual Cortex. This preserves the existing outer mask coordinate space while letting the dual Continuous Field layers remain `cover` for backdrop and `contain` for artwork inside the glyph-local viewport.

Pass `visibleAreaRatio` into `applyFlameFillToCanvas` and clamp it to the adapter's existing density range. Do not add a Fractal-only renderer or another canvas loop.

- [ ] **Step 4: Run focused tests to green**

Run both Step 2 commands.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/fit-projection.js src/core/fit-projection.test.js src/components/Chamber.js src/components/Chamber.css src/components/Chamber.mask.test.js src/visuals/continuous-field.js src/visuals/continuous-field.test.js src/visuals/flame-fill-adapter.js src/visuals/flame-fill-adapter.test.js e2e/fit-mask.spec.js
git commit -m "feat: adapt fit projections to glyph bounds"
```

## Final release verification

- [ ] **Run the complete focused browser file and repository gates**

```bash
npx playwright test e2e/fit-mask.spec.js
npx vitest run src/core/chamber-text-material.test.js src/core/visual-selection.test.js src/core/visual-taxonomy-config.test.js src/core/chamber-type-size.test.js src/core/conductor.test.js src/components/VisualNavigator.test.js src/components/ChamberOrbital.stances.test.js src/components/Chamber.mask.test.js src/components/Chamber.type-size.test.js src/components/Chamber.livingtext.test.js src/visuals/continuous-field.test.js src/visuals/work-engine-field.test.js src/visuals/harmonograph-field.test.js src/visuals/plate-field.test.js src/visuals/attractor.test.js src/visuals/visual-cortex.test.js src/visuals/flame-fill-adapter.test.js src/core/fit-projection.test.js
npm run test:run
npm run test:e2e:gate
npm run build
node scripts/ci-hygiene.mjs
npm audit --omit=dev --audit-level=high
npm run measure:first-load
npx vitest run src/core/system-design.test.js
npm run docs:diagram
git diff --exit-code -- docs/specs/ARCHITECTURE.md
git diff --check
```

Expected: every command exits 0 and the generated architecture document remains unchanged.

## Completion criteria

- One core resolver decides mask capability everywhere.
- No type-size/material circular import exists.
- Every control explains availability; no silent coercion remains.
- Cross-domain material changes persist in one transaction.
- Cold reload always shows readable text until the mask can render correctly.
- First-paint readiness is event-driven and generation-safe.
- Fit projection uses glyph-local bounds without duplicating visual engines.
- Living Text preserves Plain, Accent, and mask semantics.
- Focused, full unit, browser gate, build, hygiene, audit, budget, and architecture checks pass.
