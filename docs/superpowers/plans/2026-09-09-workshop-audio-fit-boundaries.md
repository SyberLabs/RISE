# Workshop Audio and FIT Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bound highlighted Workshop audio to its source range and make Chamber FIT hydration, alignment, and desktop collection sizing deterministic.

**Architecture:** Keep the atom scheduler authoritative for audio boundaries. Make the actual projection element own readiness, render mask and outline from one SVG glyph, and expose one read-only contained-artwork aperture from Continuous Field to Chamber.

**Tech Stack:** Vanilla JavaScript, DOM/SVG/CSS, Vitest/jsdom, Playwright Chromium.

**Spec:** `docs/superpowers/specs/2026-09-09-workshop-audio-fit-boundaries-design.md`

## Global Constraints

- RISE remains a client-only browser application with no new dependency or service.
- Structural atoms preserve audio; sourced atoms enforce authored half-open ranges.
- Playback never waits for FIT media, and a failed FIT material remains readable.
- Mobile and procedural FIT composition retain the full-stage layout.
- Every production behavior change begins with a focused failing test.

---

### Task 1: Bound highlighted audio

**Files:**
- Modify: `src/core/audio-restart.test.js`
- Modify: `src/core/experience-program.test.js`
- Modify: `src/core/experience-program.js`
- Modify: `src/core/journey-schedulers.js`

**Interfaces:**
- Consumes: `cueForAtom(program, atom)` returning a segment or fallback result.
- Produces: swell lane fallback `{ kind: 'silence', fadeMs }`; `AudioScheduleController.observe(atom)` stops an active swell when a sourced atom resolves that fallback.

- [x] **Step 1: Write the failing scheduler boundary test**

Replace the layer-hold expectation with assertions that entering and remaining inside `[0.6, 0.8)` plays once, a structural atom does nothing, and the first sourced atom at `0.8` calls `stopSwell` once without stopping the bed.

- [x] **Step 2: Run the focused test and verify RED**

Run `npx vitest run src/core/audio-restart.test.js`; expect the new boundary assertion to fail because `_heldSwellId()` retains the active ID for `hold`.

- [x] **Step 3: Write the failing lowering test**

Assert that the lowered Workshop swell lane resolves an explicit silence fallback rather than hold.

- [x] **Step 4: Run the lowering test and verify RED**

Run `npx vitest run src/core/experience-program.test.js`; expect the fallback assertion to receive `{ kind: 'hold' }`.

- [x] **Step 5: Implement the minimal scheduler and lowering change**

Lower the swell fallback as `{ kind: 'silence', fadeMs: 250 }`, make the legacy constructor use the same fallback, and remove `_heldSwellId()` so resolved segment identity changes stop the layer. Retain the existing structural-atom early return.

- [x] **Step 6: Verify GREEN**

Run `npx vitest run src/core/audio-restart.test.js src/core/experience-program.test.js src/core/audio-schedule.test.js` and expect all tests to pass.

### Task 2: Make projection readiness truthful

**Files:**
- Modify: `src/visuals/continuous-field.js`
- Modify: `src/visuals/continuous-field.test.js`
- Modify: `src/components/Chamber.mask.test.js`
- Modify: `src/components/Chamber.js`
- Modify: `src/core/fit-mask-runtime.js`

**Interfaces:**
- Consumes: `ContinuousField.whenProjectionReady()` and the active projection DOM image.
- Produces: readiness only after the active projection image is decoded and drawable; `FitMaskRuntime.sync()` keeps its HTML fallback until then; Chamber begins playback without awaiting that readiness.

- [x] **Step 1: Write a failing real-node readiness test**

Arrange for temporary decode to resolve while the projection node remains incomplete. Assert that `whenProjectionReady()` remains pending, then dispatch the node load with nonzero natural dimensions and assert one readiness transition.

- [x] **Step 2: Verify RED**

Run `npx vitest run src/visuals/continuous-field.test.js`; expect readiness to resolve immediately after `src` assignment.

- [x] **Step 3: Implement projection-owned readiness**

Attach generation-guarded load/error handling to the active projection image, await its `decode()` when available, require `naturalWidth` and `naturalHeight`, and report paint after `requestAnimationFrame`. Invalidate stale handlers whenever the projection URL or generation changes.

- [x] **Step 4: Write and verify a failing Chamber admission test**

Assert that `beginSession()` calls player playback while projection readiness is pending and that the word remains opaque. Run `npx vitest run src/components/Chamber.mask.test.js`; expect the playback assertion to fail while Chamber awaits `_awaitFitHydration()`.

- [x] **Step 5: Remove FIT from playback admission**

Start FIT synchronization in the background, display the stage, and start the player without waiting for media. Keep generation guards and readable fallback behavior in `FitMaskRuntime`.

- [x] **Step 6: Verify GREEN**

Run `npx vitest run src/visuals/continuous-field.test.js src/components/Chamber.mask.test.js` and expect all tests to pass.

### Task 3: Share FIT mask and outline geometry

**Files:**
- Modify: `src/core/fit-mask-runtime.js`
- Modify: `src/components/Chamber.css`
- Modify: `src/core/fit-mask-runtime.test.js` or the closest existing mask-runtime test file
- Modify: `e2e/fit-mask-registration.spec.js`

**Interfaces:**
- Consumes: the current HTML atom text and computed font properties.
- Produces: one SVG text definition used by both the CSS mask and an SVG contour mounted in the mask host.

- [x] **Step 1: Write the failing shared-glyph test**

Assert that a ready FIT mask contains a visible SVG contour referencing the same text geometry as the mask, while the HTML atom supplies no CSS stroke in mask-ready state.

- [x] **Step 2: Verify RED**

Run the focused mask runtime/component test and expect the contour assertion to fail because the outline is currently painted by CSS.

- [x] **Step 3: Implement the shared SVG glyph**

Create a single `<text>` glyph definition, reference it from mask and contour nodes, apply the same viewBox and translation, and publish border color/stroke width as SVG presentation properties. Keep CSS stroke for non-mask FIT words.

- [x] **Step 4: Delete dual-renderer correction**

Remove mask-mode `registerGlyph()` translation reconciliation after the shared geometry is active. Preserve generation and cleanup behavior.

- [x] **Step 5: Verify GREEN and browser geometry**

Run the focused Vitest files, then `npx playwright test e2e/fit-mask-registration.spec.js`; expect the fill and contour to share the same SVG transform at desktop and mobile viewports.

### Task 4: Size desktop collection FIT to artwork

**Files:**
- Modify: `src/visuals/continuous-field.js`
- Modify: `src/visuals/continuous-field.test.js`
- Modify: `src/components/Chamber.js`
- Modify: `src/components/Chamber.type-size.test.js`

**Interfaces:**
- Produces: `ContinuousField.getCommittedArtworkAperture()` returning `{ width, height, left, top } | null` for a committed contained collection image.
- Consumes: Chamber `_wordFitBox()` uses that aperture only for desktop collection presentation.

- [x] **Step 1: Write failing aperture tests**

Assert literal contained bounds for portrait and landscape sources, and assert null for procedural/full-bleed presentation.

- [x] **Step 2: Verify RED**

Run `npx vitest run src/visuals/continuous-field.test.js`; expect the new public query to be missing.

- [x] **Step 3: Implement the read-only committed aperture**

Reuse `containedArtworkBounds()` and the committed room image dimensions. Return a copied rectangle and clear it when the room becomes procedural or full bleed.

- [x] **Step 4: Write failing Chamber sizing tests**

Assert that a desktop collection uses the aperture dimensions while a mobile viewport and a procedural room retain `{ source: 'chamber-stage' }`.

- [x] **Step 5: Verify RED**

Run `npx vitest run src/components/Chamber.type-size.test.js`; expect `_wordFitBox()` to return the stage for every case.

- [x] **Step 6: Implement desktop aperture selection**

Read the committed aperture when the desktop media query matches and the visual source reports a collection aperture. Snapshot that rectangle during `displayAtom()` so late loads apply only to the next atom.

- [x] **Step 7: Verify GREEN**

Run `npx vitest run src/visuals/continuous-field.test.js src/components/Chamber.type-size.test.js` and expect all tests to pass.

### Task 5: Integrated verification

**Files:**
- Modify only files required by failures caused by Tasks 1–4.

**Interfaces:**
- Consumes: all behavior produced by Tasks 1–4.
- Produces: a reviewable branch with focused and repository gate evidence.

- [x] **Step 1: Run focused unit tests**

Run `npx vitest run src/core/audio-restart.test.js src/core/experience-program.test.js src/core/audio-schedule.test.js src/visuals/continuous-field.test.js src/components/Chamber.mask.test.js src/components/Chamber.type-size.test.js` and expect zero failures.

- [x] **Step 2: Run the Chamber browser corridor**

Run `npm run test:e2e:gate` and expect the gate project to pass.

- [x] **Step 3: Run repository checks**

Run `node scripts/ci-hygiene.mjs`, `npm run security:audit`, `npm run security:compat`, `npm run build`, and `npx vitest run src/core/system-design.test.js`; expect zero failures and no generated architecture diff.

- [x] **Step 4: Review the diff**

Confirm every changed production line implements one approved boundary and that no unrelated garden or architecture changes entered the worktree.
