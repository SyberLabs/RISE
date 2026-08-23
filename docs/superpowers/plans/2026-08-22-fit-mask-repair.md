# Fit Mask Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Fit an atomic, stable Gallery-in-the-word mode on desktop and mobile, with honest adaptive grounds and visibly denser Fractal word fill.

**Architecture:** A pure Fit authority joins the existing size, chunk, and presentation vocabulary; the prep panel canonicalizes Fit before session compilation. Chamber sizes words against a viewport-owned stage instead of content-grown elements. The existing Fractal word-fill adapter gains alpha-correct voids and a fixed one-pixel occupancy expansion while the room generator remains untouched.

**Tech Stack:** Vanilla JavaScript, Vite, Vitest/jsdom, Playwright Chromium, CSS/SVG masks, Canvas 2D ImageData.

**Spec:** `docs/superpowers/specs/2026-08-22-fit-mask-repair-design.md`

## Global Constraints

- Node is pinned to `20.19.0`; `>=22.12.0` is also supported. The current host is `20.18.0`, so engine warnings must be reported with final evidence.
- Fit means Word chunking + Gallery presentation + glyph masking; it must not depend on the hidden `chamberMask` preference.
- Room and Word source identities, Gallery cadence, playback timing, and the classic room Fractal generator must remain unchanged.
- No second Fractal queue, viewport-scaled iteration budget, new presentation chip, or new dependency.
- Every production behavior change begins with a failing test that fails for the intended missing behavior.
- The checkout's known CRLF-sensitive baseline failures are unrelated; focused and final commands must report them separately rather than editing catalogue measurements.

---

### Task 1: Canonical Fit authority and prep interaction

**Files:**
- Modify: `src/core/chamber-type-size.js`
- Modify: `src/core/chamber-type-size.test.js`
- Modify: `src/components/VisualInterlocutionPanel.js`
- Modify: `src/components/VisualInterlocutionPanel.test.js`
- Modify: `src/components/ChamberOrbital.js`
- Test: `src/components/ChamberOrbital.stances.test.js`

**Interfaces:**
- Produces: `resolveFitMaskMode({ fontSize, chunkMode, visualMode, presentation, legacyMask }): boolean`.
- Produces: `VisualInterlocutionPanel` option `onFitRequested(): void`, called only after an allowlisted Fit click.
- Consumes: existing `persistFontSize`, `normalizePresentation`, and orbital `config.chunkMode`.

- [ ] **Step 1: Write the pure authority failure**

Add cases to `src/core/chamber-type-size.test.js` asserting that `resolveFitMaskMode` is true for `{ fontSize:'fit', chunkMode:'word', visualMode:'interlocution', presentation:'continuous' }`, true for the legacy `continuous-word` alias, and false for phrase chunking, non-Fit size, disabled visuals, or a flash presentation.

- [ ] **Step 2: Run the authority test and verify RED**

Run: `npx vitest run src/core/chamber-type-size.test.js`

Expected: FAIL because `resolveFitMaskMode` is not exported.

- [ ] **Step 3: Implement the minimal pure resolver**

Add the resolver beside `isChamberWordFit`. It must use allowlisted size and explicit scalar comparisons only; it must not inspect DOM or mutate configuration. `legacyMask` only grants a word mask when true and does not bypass Word chunking.

- [ ] **Step 4: Run the authority test and verify GREEN**

Run: `npx vitest run src/core/chamber-type-size.test.js`

Expected: PASS.

- [ ] **Step 5: Write the prep interaction failure**

Extend `src/components/VisualInterlocutionPanel.test.js` so clicking `[data-font-size="fit"]` from a non-continuous interlocution configuration asserts:

```js
expect(settings.fontSize).toBe('fit');
expect(onFitRequested).toHaveBeenCalledOnce();
expect(panel.getConfig().visualMode).toBe('interlocution');
expect(panel.getConfig().interlocution.presentation).toBe('continuous');
expect(panel.getConfig().interlocution.streamGlass).toBe(originalStreamGlass);
```

Also assert that S/M/L do not call `onFitRequested` and do not erase Room or Word source selections.

Add an orbital component assertion that the callback changes `config.chunkMode` to `word`, disables incompatible Recitation, refreshes Temporal controls, and persists the preference.

- [ ] **Step 6: Run the prep tests and verify RED**

Run: `npx vitest run src/components/VisualInterlocutionPanel.test.js src/components/ChamberOrbital.stances.test.js`

Expected: FAIL because the callback and canonicalization do not exist.

- [ ] **Step 7: Implement canonical prep behavior**

Store `options.onFitRequested || (() => {})` in the panel. On an allowlisted Fit click, set `visualMode='interlocution'`, set `interlocution.presentation='continuous'`, leave `streamGlass` and all source identities unchanged, persist `fontSize`, call `onFitRequested`, and emit the visual config once. Wire the orbital callback to set Word chunking, turn Recitation off if necessary, synchronize Temporal controls, and persist.

- [ ] **Step 8: Run prep tests and verify GREEN**

Run: `npx vitest run src/core/chamber-type-size.test.js src/components/VisualInterlocutionPanel.test.js src/components/ChamberOrbital.stances.test.js`

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add src/core/chamber-type-size.js src/core/chamber-type-size.test.js src/components/VisualInterlocutionPanel.js src/components/VisualInterlocutionPanel.test.js src/components/ChamberOrbital.js src/components/ChamberOrbital.stances.test.js
git commit -m "fix: make Fit an atomic prep mode"
```

---

### Task 2: Stable Chamber geometry and mask authority

**Files:**
- Modify: `src/core/chamber-type-size.js`
- Modify: `src/core/chamber-type-size.test.js`
- Modify: `src/components/Chamber.js`
- Modify: `src/components/Chamber.type-size.test.js`
- Modify: `src/components/Chamber.mask.test.js`
- Modify: `src/components/Chamber.css`

**Interfaces:**
- Consumes: `resolveFitMaskMode(...)` from Task 1.
- Extends: `fitWordAtomPx({ fieldWidth, fieldHeight, padX, padY, measuredWidth, measuredHeight, measuredAt, lineHeightRatio })`.
- Produces: `Chamber._wordFitBox()` returning `{ width, height, source:'chamber-stage' }` from a viewport/display stage that cannot be enlarged by atom content.

- [ ] **Step 1: Write sizing failures**

Add a pure test where a narrow glyph and `lineHeightRatio:1.4` would previously return a font whose line box exceeds the stage. Assert `px * 1.4 + padY <= fieldHeight * 0.88`.

Add component tests asserting `_wordFitBox()` ignores a huge `#chamber-field`/zero-box `#atom-band`, uses the bounded Chamber display/viewport dimensions, and returns the same box before and after an oversized atom rect is supplied.

- [ ] **Step 2: Run sizing tests and verify RED**

Run: `npx vitest run src/core/chamber-type-size.test.js src/components/Chamber.type-size.test.js`

Expected: FAIL because line-height and stable-stage authority are absent.

- [ ] **Step 3: Implement line-box-aware stable fitting**

Include `measuredAt * lineHeightRatio` in the vertical reference height. In Chamber, derive the fit box from the smaller positive dimensions of `#chamber-display`, `window.visualViewport`, and `document.documentElement`, never `#atom-band` or `#chamber-field`. Read the computed font-size/line-height ratio once per atom and pass it to the pure fitter. Remove stale `--atom-fit-px` whenever measurement fails.

- [ ] **Step 4: Run sizing tests and verify GREEN**

Run: `npx vitest run src/core/chamber-type-size.test.js src/components/Chamber.type-size.test.js`

Expected: PASS.

- [ ] **Step 5: Write mask-authority failures**

Extend `src/components/Chamber.mask.test.js` to assert that canonical Fit activates `.is-mask` without `rise.settings.chamberMask`, that phrase Fit does not, that legacy `continuous-word` remains compatible, and that Medium removes the mask while leaving the continuous Gallery mounted.

- [ ] **Step 6: Run mask tests and verify RED**

Run: `npx vitest run src/components/Chamber.mask.test.js`

Expected: FAIL because `chamberMaskApplies()` does not consult Fit authority.

- [ ] **Step 7: Implement mask authority and fixed stage CSS**

Route `chamberMaskApplies()` through `resolveFitMaskMode`, while retaining explicit `chamberMask===true` compatibility for Word sessions. Give `.chamber-display` a fixed viewport block size with clipped overflow, give `.chamber-field` `min-height:0; min-width:0; overflow:hidden`, and constrain `.atom-display.is-word-fit` so its box cannot enlarge the stage. Do not change mobile's visual grammar.

- [ ] **Step 8: Run Chamber regressions and verify GREEN**

Run: `npx vitest run src/core/chamber-type-size.test.js src/components/Chamber.type-size.test.js src/components/Chamber.mask.test.js src/components/Chamber.settings-door.test.js`

Expected: PASS.

- [ ] **Step 9: Commit Task 2**

```bash
git add src/core/chamber-type-size.js src/core/chamber-type-size.test.js src/components/Chamber.js src/components/Chamber.type-size.test.js src/components/Chamber.mask.test.js src/components/Chamber.css
git commit -m "fix: bound fitted words to the Chamber stage"
```

---

### Task 3: Honest adaptive grounds and Fractal density

**Files:**
- Modify: `src/visuals/flame-fill-adapter.js`
- Modify: `src/visuals/flame-fill-adapter.test.js`
- Verify: `src/visuals/fractal.js`
- Verify: `src/visuals/lib/fractal-engine.plan.test.js`
- Verify: `src/core/mask-ground.test.js`

**Interfaces:**
- Keeps: `applyFlameFillLut(imageData, options): ImageDataLike` and `applyFlameFillToCanvas(canvas, options): boolean`.
- Produces internally: a frozen original occupancy mask (`Uint8Array`, one byte per pixel) and fixed radius `1` expansion.
- Contract: source void → output alpha `0`; original occupied → transformed non-zero alpha; expanded neighbor → copied transformed colour/alpha; distance greater than one pixel → alpha `0`.

- [ ] **Step 1: Write alpha and spatial-density failures**

Replace the false RGB-only "plate holes" assertion with alpha assertions. Add a 5×5 source containing one occupied centre pixel and assert that the centre and its eight immediate neighbours are non-transparent, while corners remain transparent. Add a test that an already occupied alpha value is preserved and that applying the same input twice is deterministic.

- [ ] **Step 2: Run adapter tests and verify RED**

Run: `npx vitest run src/visuals/flame-fill-adapter.test.js`

Expected: FAIL because void alpha remains opaque and no spatial support is added.

- [ ] **Step 3: Implement the bounded compositor**

In `writeFlameFill`, first record original occupancy and transform original occupied pixels. Write verified void pixels with `alpha=0`. In a second pass, inspect only the frozen original occupancy mask; for each original void, choose the strongest occupied pixel in its 3×3 neighbourhood and copy its transformed RGBA. Never read newly expanded occupancy, so dilation cannot cascade. Reuse the same algorithm for copied ImageData and in-place canvas adaptation.

- [ ] **Step 4: Run adapter tests and verify GREEN**

Run: `npx vitest run src/visuals/flame-fill-adapter.test.js`

Expected: PASS.

- [ ] **Step 5: Verify room-generator isolation**

Run: `npx vitest run src/visuals/flame-fill-adapter.test.js src/visuals/lib/fractal-engine.plan.test.js src/core/mask-ground.test.js src/visuals/visual-cortex.test.js`

Expected: PASS, including assertions that Fractal iterations/zoom/scale and room tone remain unchanged.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/visuals/flame-fill-adapter.js src/visuals/flame-fill-adapter.test.js
git commit -m "fix: reveal mask grounds through denser flames"
```

---

### Task 4: Real desktop and mobile regression corridor

**Files:**
- Create: `e2e/fit-mask.spec.js`
- Modify only if required for an honest selector: `src/components/VisualInterlocutionPanel.js`

**Interfaces:**
- Browser contract uses public UI controls plus rendered Chamber DOM. It may read computed layout, canvas alpha, and persisted public configuration; it may not call private Chamber methods to manufacture success.

- [ ] **Step 1: Write the desktop browser failure**

Seed an ordinary text and a continuous Fractal visual selection with `chunkMode:'phrase'`. Open the Visual panel, click Fit, begin, sample at least four word changes, and assert:

```js
expect(state.chunkMode).toBe('word');
expect(state.mask).toBe(true);
expect(state.stageHeightDrift).toBeLessThanOrEqual(1);
expect(state.maxAtomOverflow).toBeLessThanOrEqual(1);
expect(state.maxCentreDrift).toBeLessThanOrEqual(2);
```

Also assert the ground plate is `light` for Fractal and at least one adapted canvas pixel has alpha zero.

- [ ] **Step 2: Run desktop test and verify RED**

Run: `npx playwright test e2e/fit-mask.spec.js --project=chromium`

Expected: FAIL on current desktop stage growth/mask authority.

- [ ] **Step 3: Add the mobile and leave-Fit cases**

Run the same user path at `390×844`, asserting fixed stage geometry and mask presence. In a separate prep assertion, select Medium after Fit and verify the persisted font size is Medium while source identities remain unchanged; after Begin, `.is-word-fit` and `.is-mask` are absent and Gallery remains mounted.

- [ ] **Step 4: Run browser corridor and verify GREEN**

Run: `npx playwright test e2e/fit-mask.spec.js --project=chromium`

Expected: all desktop/mobile Fit cases PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add e2e/fit-mask.spec.js src/components/VisualInterlocutionPanel.js
git commit -m "test: guard fitted Gallery words in Chromium"
```

---

### Task 5: Release verification and documentation consistency

**Files:**
- Modify only if behavior wording changed: `docs/superpowers/specs/2026-08-22-fit-mask-repair-design.md`
- Modify only if architecture imports change: `scripts/build-architecture-diagram.mjs`

**Interfaces:**
- Consumes all prior task contracts.
- Produces fresh verification evidence and a clean feature-branch diff.

- [ ] **Step 1: Run focused feature suite**

Run:

```bash
npx vitest run src/core/chamber-type-size.test.js src/components/VisualInterlocutionPanel.test.js src/components/ChamberOrbital.stances.test.js src/components/Chamber.type-size.test.js src/components/Chamber.mask.test.js src/components/Chamber.settings-door.test.js src/core/mask-ground.test.js src/visuals/flame-fill-adapter.test.js src/visuals/lib/fractal-engine.plan.test.js src/visuals/visual-cortex.test.js
```

Expected: PASS with zero failures.

- [ ] **Step 2: Run production gates**

Run:

```bash
node scripts/ci-hygiene.mjs
npm run build
npm run measure:first-load
npx vitest run src/core/system-design.test.js
npm run docs:diagram
```

Expected: every command exits `0`, and `git diff --exit-code -- docs/specs/ARCHITECTURE.md` exits `0`.

- [ ] **Step 3: Run browser gates**

Run:

```bash
npx playwright test e2e/fit-mask.spec.js --project=chromium
npm run test:e2e:gate
```

Expected: PASS. If Node 20.18 prevents Vite 7 from starting, report the engine blocker and rerun under the repository runtime before claiming browser/build success.

- [ ] **Step 4: Audit diff and requirements**

Run: `git diff --check origin/main...HEAD && git status --short && git diff --stat origin/main...HEAD`

Confirm every changed production line traces to atomic Fit authority, stable geometry, mask-ground alpha, Fractal word-fill density, or its regression coverage. Confirm no room Fractal generation settings changed.

- [ ] **Step 5: Commit final consistency edits if any**

```bash
git add docs/superpowers/specs/2026-08-22-fit-mask-repair-design.md scripts/build-architecture-diagram.mjs docs/specs/ARCHITECTURE.md
git commit -m "docs: align Fit mask architecture"
```

Skip this commit when those files are unchanged.
