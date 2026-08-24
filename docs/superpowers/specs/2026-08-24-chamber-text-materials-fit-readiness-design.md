# Chamber Text Materials, Fit Readiness, and Entry-Surface Design

**Date:** 2026-08-24  
**Status:** Approved design; not yet implemented  
**Scope owner:** Chamber reading experience  

## 1. Objective

Make Chamber text materials predictable, legible, and immediately ready without expanding the feature surface unnecessarily. The work has four outcomes:

1. Fit masks never expose transparent text before their visual material is ready.
2. The Visual Navigator explains and enforces the relationship between Face, Size, Accent, and Visual Mask instead of silently overriding choices.
3. Fit masks use their glyph area efficiently and may carry a stable Cream or Accent contour for legibility.
4. The Chamber setup remains reachable on constrained desktop viewports, while the Portal's circular **Try RISE** control gains the material depth expected of a primary entry point.

The design preserves Living Text, existing program authority, and the full-screen playback contract.

## 2. First-Principles Decisions

### 2.1 Requirements retained

- A visual mask needs a large, heavy letterform and a chamber-filling word to provide enough usable image surface.
- A mask must never make the reading disappear while a font, image, or procedural frame is loading.
- Accent is a text material, not a mask source, and must remain useful outside Fit mode.
- Living Text must continue to conduct the visible material without destabilizing mask contours.
- Every unavailable action must explain why it is unavailable and offer the shortest valid corrective action.
- The pre-session Chamber must fit ordinary desktop viewports or scroll safely; playback itself remains fixed and immersive.

### 2.2 Requirements deleted or simplified

- Unsupported procedural engines are removed from the mask picker instead of displayed as inert or failure-prone options.
- No global browser or CSS `zoom` is introduced.
- No global `body` overflow policy is changed.
- No timer, arbitrary delay, or DOM polling is used to guess when a mask is ready.
- No drop-shadow outline is restored. The optional border is a true glyph contour.
- No surrounding Portal redesign is included; only the circular **Try RISE** control changes.
- No mask capability is inferred from a hidden runtime font override. The Navigator and runtime use one explicit capability rule.

## 3. Current Failure Model

### 3.1 Transparent cold-start interval

The Chamber currently makes the atom transparent before all prerequisites are ready. Mask synchronization waits on `document.fonts.ready`, creates the glyph mask, and then depends on the selected visual source to paint. On a cold reload, the selected source may not have produced meaningful pixels yet. The result is a period where both the foreground word and the material behind it are effectively absent.

`document.fonts.ready` also waits for every document font, although Fit needs only the Thick face. This makes readiness broader and slower than the actual dependency.

### 3.2 Silent configuration override

Fit-mask styling forces the Thick font in Chamber CSS while the persisted Face can still say Literary, Display, or Japanese. The interface therefore reports one choice while the renderer uses another. Selecting Fit and a collection can silently replace the effective face instead of explaining the mask contract.

### 3.3 Fragmented capability rules

The Navigator limits portions of the Ink interface, while Chamber independently decides whether a mask may render. The rules are related but not identical. That permits invalid configurations to appear selectable and makes failures look like hydration problems.

### 3.4 Constrained setup viewport

The application shell prevents body scrolling, while the Chamber setup combines minimum-height layout with a fixed-size orbital stage. Since Stances increased the vertical content, the Begin control can fall below the viewport without a local scroll owner.

## 4. Authoritative Text-Material Model

### 4.1 Canonical configuration

New Navigator writes use an explicit text-material mode:

```js
{ mode: 'plain' }
{ mode: 'accent' }
{ mode: 'same', border: 'off' | 'cream' | 'accent' }
{
  mode: 'pick',
  sourceFamily,
  procedural,
  sourced,
  border: 'off' | 'cream' | 'accent',
}
```

- `plain` means normal light Chamber text.
- `accent` means text colored from the active Settings highlight profile.
- `same` means the active whole-field visual also supplies the Fit material.
- `pick` means a separately selected compatible source supplies the Fit material.
- `border` applies only to visual-mask modes. Its first-enable default is `cream`.

Legacy configurations without an explicit mode retain existing import inference. Once edited in the new Navigator, the configuration is normalized to the explicit form. This avoids a broad migration while making new state deterministic.

### 4.2 Single capability authority

A pure core capability function is the authority for both Visual Navigator presentation and Chamber execution. It evaluates Face, Size, chunking, presentation, program authority, and material mode and returns:

```js
{
  available,
  reason,
  correctiveAction,
}
```

The rules are:

- Plain and Accent are available at every Face and Size.
- Visual Mask is authorable only when Face is **Thick** and Size is **Fit**.
- Runtime mask execution additionally requires word chunking, active visual interlocution, a continuous presentation, and a non-plain/non-accent mask material.
- Program-owned values remain read-only and expose the program-ownership reason.

The runtime never repairs an invalid authoring configuration silently. An invalid or not-yet-ready mask renders a readable opaque fallback.

## 5. Visual Navigator Information Architecture

### 5.1 Text root

The Text root retains three sections with persistent summaries:

1. **Face** — Literary, Display, Thick ★, Japanese in an even 2×2 grid.
2. **Size** — the existing size choices, including Fit.
3. **Ink** — Accent and Visual Mask as distinct material choices.

The star on Thick is an affordance, not decoration. Hover, keyboard focus, or touch reveals: **“Thick is the mask-ready face.”**

### 5.2 Accent

Accent behaves as a true toggle:

- Off: normal light text.
- On: text uses the active Settings highlight hue.
- It remains available regardless of Face or Size.
- Living Text modulates it semantically while preserving the recognizable profile hue. Modulation may adjust luminosity, saturation, subtle tint, and restrained glow; it must not replace the selected accent family.

### 5.3 Visual Mask lock and corrective transaction

Visual Mask remains visible when unavailable so the interface can teach the requirement. It uses `aria-disabled` semantics rather than a native disabled control, allowing click, touch, and keyboard activation to explain the lock.

When Face is not Thick or Size is not Fit, activating Visual Mask opens a minimalist modal:

> **Visual masks require Thick + Fit.**  
> Bold, chamber-filling words provide enough surface for imagery.

Actions:

- **Use Thick + Fit** — atomically sets Face to Thick, Size to Fit, chunking to Word, turns Recitation off, and selects Visual Mask.
- **Not now** — closes the modal without changing configuration.

No intermediate invalid state is emitted.

### 5.4 Leaving a valid mask configuration

If a mask is active and the user selects a different Face or Size, the Navigator explains that the requested change cannot carry the mask:

- Confirm: switch the material to Accent, then apply the requested Face or Size.
- Cancel: preserve Thick, Fit, and the current mask.

This prevents hidden overrides and makes loss of the mask an explicit choice.

### 5.5 Material-source curation

Only sources that can produce a reliable Fit material appear in the Visual Mask picker. Neural Network, Rock Garden, Spectral, and any other source without the required projection contract are absent rather than disabled. Existing compatible collections and procedural sources remain available.

### 5.6 Affordance states

- Available: restrained edge and elevation response on hover/focus.
- Selected: persistent filled surface and rim.
- Mask-capable: star or material glyph plus explanatory affordance.
- Locked: subdued crosshatch or material treatment with a visible requirement cue.
- Program-owned: explicit ownership label and reason rather than a silent inert state.

All information available on hover is also available through keyboard focus and touch.

## 6. Atomic Fit Readiness

### 6.1 Lifecycle

Each displayed Fit word has a generation-scoped lifecycle:

1. `fallback` — the Thick/Fit word is visible as opaque text.
2. `preparing` — targeted font, glyph mask, and visual projection are prepared while the fallback remains visible.
3. `active` — all prerequisites have produced meaningful output; the mask replaces the fallback atomically.
4. `failed` — the readable fallback remains for the word's lifetime.

A monotonically increasing generation identifier prevents a late source, font, or frame from activating over a newer word.

### 6.2 Readiness contract

Mask activation requires all three conditions:

- The specific Thick face required by the current word has loaded, or a valid measured fallback has been deliberately accepted.
- The glyph mask has non-zero, finite geometry.
- The selected projection has committed its first meaningful paint:
  - sourced imagery is decoded and committed;
  - procedural imagery has rendered its first frame.

The visual presenter exposes an explicit one-shot readiness signal. Chamber does not inspect pixels through polling and does not use fixed delays.

### 6.3 Atomic handoff

After readiness resolves for the current generation, Chamber performs one `requestAnimationFrame` handoff:

- commit the material projection;
- activate the glyph mask;
- make the opaque fallback transparent.

There must be no observable frame where both layers are absent. A timeout is not used to hide the fallback. If a source never becomes ready, the word remains readable.

### 6.4 Priming without blocking playback

The selected visual source begins initialization at session mount or the earliest existing preparation seam. Begin and atom pacing never wait for mask hydration. Priming improves the common path; the opaque fallback guarantees the slow and failure paths.

## 7. Glyph-Local Fit Adapter

### 7.1 Purpose

The adapter reduces empty or black visual regions inside letters without blindly zooming the source or distorting the word. The glyph remains stage-aligned, while the visual material is projected relative to the glyph's actual usable bounds.

### 7.2 Geometry contract

A pure core projection function receives:

```js
{
  fieldRect,
  glyphRect,
  sourceKind,
  intrinsicWidth,
  intrinsicHeight,
  devicePixelRatio,
}
```

It returns finite stage-aligned mask geometry and glyph-local projection geometry. Invalid, empty, or stale geometry refuses activation and leaves the opaque fallback visible.

The glyph mask and projection use the same measured font metrics. Letter counters remain true transparent holes; the glyph is never stretched to improve coverage.

### 7.3 Sourced imagery

Sourced art uses two coordinated layers inside the glyph viewport:

- a cover backdrop fills every glyph pixel and prevents empty edges;
- a contained complete-art layer preserves the recognizable composition above it.

Both derive from the same source. The adapter chooses the minimum useful crop and scale consistent with full glyph coverage, avoiding needless enlargement.

### 7.4 Procedural imagery

Compatible procedural engines receive the actual glyph viewport size and device pixel ratio instead of assuming the full Chamber stage. Density and sampling are derived from visible glyph area. This makes Fractal Flames and other admitted engines produce meaningful detail within the stencil rather than spending most output outside it.

Living Text continues to tint or modulate the inner procedural material through the existing semantic signal.

## 8. Optional Fit Contour

Visual masks expose an independent **Border** choice:

- Off
- Cream — default when Visual Mask is first enabled
- Accent — active Settings highlight hue

The contour uses the same glyph geometry as the mask, sits above the inner material, and remains stable while Living Text modulates that material. Its width is responsive and clamped so it aids legibility without closing letter counters or becoming an outline effect detached from the type.

The implementation uses a true glyph stroke where supported. It does not fall back to the removed transparent drop shadow. If stroke support is unavailable, the mask remains functional and the contour safely degrades to Off.

Changing the mask source preserves the current border choice. Leaving mask mode retains no visible contour.

## 9. Chamber Orbital Viewport Repair

### 9.1 Scroll ownership

The pre-session `.chamber-orbital` becomes the owner of a `100dvh` vertical scroll container with contained overscroll. It centers the setup safely when the full composition fits and top-aligns it when it does not. Begin and Reset remain reachable with mouse, touch, and keyboard.

The playback `.chamber-display` remains fixed to the viewport and non-scrollable. No global shell overflow rule changes.

### 9.2 Responsive geometry

The orbital layout uses shared size tokens rather than `transform: scale()` or CSS `zoom`. On constrained desktop viewports, the main stage compacts from approximately 600px to 480px, with dependent geometry scaling proportionally:

- orbit radius: approximately 240px to 192px;
- peripheral nodes: approximately 140px to 112px;
- center, connectors, gaps, and stance spacing derive from the same stage token.

Text size and interactive hit targets use independent clamps and do not shrink below accessible bounds. Wider and taller viewports retain the current generous layout.

## 10. Portal Try RISE Material

Only `.portal-nav .nav-secondary .nav-try` is restyled. It becomes a richer circular seal using lightweight CSS:

- layered radial and vertical illumination;
- an outer rim and inner bevel;
- restrained inset depth and cast shadow;
- subtle CSS grain or texture;
- a more deliberate star mark;
- tactile hover, focus, and pressed states;
- profile-aware contrast and reduced-motion behavior.

No image asset, dependency, navigation behavior, or surrounding Portal component changes.

## 11. Persistence and Compatibility

- The explicit `plain` material mode and mask `border` value travel through the existing visual configuration serialization path.
- Older programs and saved settings without these fields continue through current inference and default to no new destructive migration.
- Existing curated program locks remain authoritative.
- Existing personal uploads and compatible sourced collections use the same picker and media lifecycle.
- Living Text remains optional and retains its current semantics outside Accent and Fit material modulation.

## 12. Verification Strategy

### 12.1 Core tests

- Capability matrix for every Face × Size × material combination.
- Runtime constraints for chunking, presentation, interlocution, and program ownership.
- Legacy normalization and round-trip persistence for `plain`, `accent`, `same`, `pick`, and border values.
- Fit projection geometry for portrait, landscape, procedural, empty, non-finite, and stale inputs.

### 12.2 Visual Navigator tests

- Thick star information appears on hover, focus, and touch.
- Accent toggles independently of Face and Size.
- Visual Mask lock explains requirements instead of failing silently.
- **Use Thick + Fit** emits one valid transaction with Word chunking and Recitation off.
- Leaving Thick or Fit while a mask is active requires confirmation and falls back to Accent only on confirm.
- Unsupported sources are absent.
- Program-owned controls expose their ownership reason.
- Border defaults to Cream on first mask enable and persists through source replacement.

### 12.3 Chamber tests

- With targeted font readiness pending, the word remains opaque.
- With projection readiness pending, the word remains opaque.
- Once both are ready, one frame atomically activates the mask.
- A rejected readiness promise leaves the fallback readable.
- A stale generation cannot activate over a newer word.
- Accent uses the active root highlight and remains recognizably in-family under Living Text.
- Cream and Accent contours remain stable while the inner Fit material is modulated.

### 12.4 Browser tests

- Cold-cache hard reload corridors for Old Masters and Fractal Flames on desktop and mobile.
- Assert throughout readiness that either the opaque fallback or a painted mask is visible; never neither.
- Chamber setup at 1280×720, 1366×768, 1440×900, and a short desktop viewport.
- Begin and Reset reachable by keyboard without changing browser zoom.
- Chamber playback remains full-screen and non-scrollable.
- Portal visual regression is confined to the circular Try RISE control.

### 12.5 Release gates

- Targeted unit tests pass after each slice.
- Full `npm run test:run` passes.
- `npm run test:e2e:gate` passes before push.
- Documentation, hygiene, build-size, and generated architecture gates remain clean.

## 13. Implementation Slices

Each slice must be independently green before the next begins:

1. Add the canonical text-material schema and shared capability authority with tests.
2. Implement Navigator hierarchy, explanatory locks, and atomic corrective transactions with tests.
3. Implement Accent/Living Text behavior and optional Fit contours with tests.
4. Add the presenter readiness signal and atomic Fit lifecycle with cold-start tests.
5. Add the glyph-local projection adapter for sourced and procedural materials with geometry tests.
6. Repair Chamber Orbital scroll ownership and responsive geometry with viewport tests.
7. Enrich only the circular Portal Try RISE control with focused styling tests.
8. Run the complete production verification sequence.

## 14. Non-Goals

- Workshop changes.
- A general Portal redesign.
- New mask-compatible procedural engines.
- Page Mode or MP4 compiler expansion beyond carrying the existing visual configuration.
- Blocking session start until visual material is ready.
- Global body scrolling, browser zoom, or blanket CSS scaling.
- Restoring a text-shadow outline.
- Changing the Chamber playback layout or pacing contract.

## 15. Acceptance Criteria

The design is complete when:

- A cold hard reload never presents an invisible Fit word, regardless of source readiness.
- Face, Size, Accent, and Visual Mask choices always match the configuration executed by Chamber.
- Thick + Fit is taught and enforced without silent mutation.
- Accent works at every Face and Size and participates in Living Text.
- Compatible imagery fills the useful glyph area without distortion or excessive crop.
- Off, Cream, and Accent mask contours are stable and legible.
- Begin and Reset remain reachable on constrained desktop viewports at normal browser zoom.
- Playback remains fixed, immersive, and non-scrollable.
- The circular Try RISE entry point has materially richer depth without changing the rest of Portal.
- All targeted, full unit, browser gate, and repository health checks pass.
