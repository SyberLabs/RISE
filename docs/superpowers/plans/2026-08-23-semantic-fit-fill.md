# Semantic Fit Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Fit text cleanly reveal curated procedural imagery, use a predictable cream/dark ground policy, and let Living Text semantically modulate eligible procedural fills without changing ordinary text or collection artwork.

**Architecture:** The visual registry owns authoring eligibility; the mask-ground module owns fill identity and contrast; the conductor owns the pure semantic appearance calculation; Chamber publishes stable semantic CSS state and CSS composites it inside the existing SVG mask. Legacy saved configurations remain renderable even when an engine is no longer selectable for new word fills.

**Tech Stack:** Vanilla JS, CSS, Vitest/jsdom, Playwright Chromium

**Spec:** `docs/superpowers/specs/2026-08-23-semantic-fit-fill-design.md`

## Task 1: Remove the Fit-only transparent outline

**Files:**
- Modify: `src/components/Chamber.css`
- Modify: `e2e/fit-mask.spec.js`

- [ ] Add a browser assertion that an active Fit mask has a computed `-webkit-text-stroke-width` of `0px`.
- [ ] Run `npx.cmd playwright test e2e/fit-mask.spec.js` and confirm the new assertion fails against the current `0.6px` rule.
- [ ] Add the narrow `.atom-display.is-mask.is-mask-ink.is-word-fit` override that sets the stroke to zero while leaving the existing non-Fit mask rule unchanged.
- [ ] Rerun the focused browser test and confirm it passes.
- [ ] Commit only this behavior and test as `fix:remove-fit-mask-outline`.

## Task 2: Curate procedural word-fill eligibility and contrast profiles

**Files:**
- Modify: `src/core/visual-registry.js`
- Modify: `src/components/VisualInterlocutionPanel.js`
- Modify: `src/components/VisualInterlocutionPanel.test.js`
- Modify: `src/core/mask-ground.js`
- Modify: `src/core/mask-ground.test.js`

- [ ] Update panel tests to prove the full procedural gallery still lists every engine, while the word-fill selector excludes exactly Neural Network (`neural`), Rock Garden (`rockgarden`), and Spectral Plates (`apparitio`). Prove Klee, Turrell, Fractal Flames, Harmonograph, Iris Plates (`ostensoria`), and Attractor remain selectable.
- [ ] Update mask-ground tests to lock the approved policy: Attractor, Turrell, Klee, and Harmonograph use dark ground; Fractal, Iris, and legacy Neural/Rock Garden/Spectral use light cream ground.
- [ ] Run the two focused unit files and confirm the new expectations fail.
- [ ] Add registry metadata for authoring eligibility and export a frozen derived `WORD_FILL_PROCEDURAL_PATTERNS` list. Use it only in the word-fill `<select>`; retain `LISTED_PROCEDURAL_PATTERNS` for the full engine grid and runtime normalization.
- [ ] Simplify `SOURCE_PROFILES` to a light procedural default with only the four explicit dark exceptions. Preserve legacy ID resolution.
- [ ] Rerun `npx.cmd vitest run src/components/VisualInterlocutionPanel.test.js src/core/mask-ground.test.js` and confirm it passes.
- [ ] Commit this registry/profile tranche as `feat:curate-procedural-word-fills`.

## Task 3: Conduct procedural Fit fills with Living Text

**Files:**
- Modify: `src/core/conductor.js`
- Modify: `src/core/conductor.test.js`
- Modify: `src/core/mask-ground.js`
- Modify: `src/core/mask-ground.test.js`
- Modify: `src/components/Chamber.js`
- Modify: `src/components/Chamber.css`
- Modify: `src/components/Chamber.livingtext.test.js`
- Modify: `src/components/Chamber.mask.test.js`
- Modify: `e2e/fit-mask.spec.js`

- [ ] Add conductor tests for a pure `livingTextAppearance(signal, intensity)` helper: preserve the current neutral/warm/cool text color and glow outputs, clamp inputs, and return bounded Fit tint, saturation, and brightness values. Intensity zero must produce no Fit modulation.
- [ ] Add mask-ground tests for a public fill descriptor helper that identifies the resolved engine/collection selected by the current room and word-fill pair without changing combine precedence.
- [ ] Add Chamber tests proving semantic state activates only for Fit + procedural fill + active Living Text signal, publishes bounded CSS custom properties on `.chamber-field`, and clears on collection fill, non-Fit sizing, disabled/no signal, Page transition, fill teardown, and mask fallback. Ordinary Living Text color/glow behavior must remain unchanged.
- [ ] Extend the Fit browser corridor to enable Living Text and prove the stable field class/custom properties appear while the procedural fill remains visible and clipped inside the letters.
- [ ] Run the focused unit/browser tests and confirm the new contracts fail before implementation.
- [ ] Implement and export `livingTextAppearance` in `src/core/conductor.js`, using the existing palette and formulas for ordinary text plus bounded Fit modulation values.
- [ ] Export the resolved fill descriptor from `src/core/mask-ground.js` and reuse it from `maskGroundFromConfig` so Chamber has one authoritative source classification path.
- [ ] In Chamber, clear semantic Fit state before ordinary rendering decisions; activate it only when the current atom is Fit, mask-capable, procedural, and has a semantic signal; keep the atom transparent and shadow-free. Clear it from every exit/teardown path covered by tests.
- [ ] In CSS, composite the semantic color through `.chamber-field.is-living-fit .chamber-fill-field::after`, with `mix-blend-mode: color`, bounded opacity, saturation, and brightness. Keep the overlay inside the existing SVG mask and add no outline, shadow, transition, or collection tint.
- [ ] Rerun focused tests until green.
- [ ] Commit the semantic compositor as `feat:conduct-fit-fills-with-living-text`.

## Task 4: Release-level verification

- [ ] Run `npx.cmd vitest run src/core/conductor.test.js src/core/mask-ground.test.js src/components/VisualInterlocutionPanel.test.js src/components/Chamber.livingtext.test.js src/components/Chamber.mask.test.js`.
- [ ] Run `npx.cmd playwright test e2e/fit-mask.spec.js`.
- [ ] Run `npm.cmd run test:run -- --reporter=dot`.
- [ ] Run `node scripts/ci-hygiene.mjs`.
- [ ] Run `npm.cmd run measure:first-load` if production source changes affect the first-load bundle.
- [ ] Inspect `git diff --check`, `git status --short`, and the final commit sequence. Report any unavailable system dependency or pre-existing failure plainly.
