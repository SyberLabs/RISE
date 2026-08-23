# Semantic Fit Fill Design

**Date:** 2026-08-23  
**Status:** Approved for implementation planning  
**Owner:** RISE Chamber

## Objective

Make Fit words read as complete, responsive visual forms:

- remove the semi-transparent outline from Fit mask ink;
- use cream as the normal ground beneath procedural word fills;
- stop offering procedural engines that do not produce good word fills;
- let Living Text warm, cool, and modestly modulate procedural imagery inside the current Fit word.

The implementation must preserve whole-reading procedural visuals, legacy saved configurations, ordinary Living Text, collection artwork fidelity, and the existing mask geometry.

## Existing boundary

Fit uses two sibling surfaces in the Chamber:

1. `#atom-display` supplies the word geometry, then becomes transparent mask ink.
2. `.chamber-fill-field` renders the selected word source and is clipped by an SVG text mask.

`applyLivingText()` currently stops when it sees mask ink because color and text shadow cannot affect transparent glyphs. The visual compositor already renders every still and living procedural source inside `.chamber-fill-field`, so semantic response belongs at that shared compositor boundary—not inside each engine.

The existing `mask-ground.js` profile resolver and `visual-registry.js` procedural registry are the correct policy boundaries. No new visual mode, engine wrapper, or per-engine semantic interface is required.

## Scope

### Fit outline

The existing `0.6px` semi-transparent WebKit text stroke remains available to ordinary mask text but is disabled when the atom is both mask ink and `is-word-fit`.

Fit Living Text must not reintroduce an outline, text shadow, or drop shadow around the glyph.

### Word-source eligibility

The procedural registry will declare whether each engine is suitable for word fill. The Word-source selector derives its procedural options from this capability; the whole-reading procedural grid continues to derive from the complete registry.

Newly selectable procedural word fills:

- Klee Lines
- Turrell Fields
- Fractal Flames
- Harmonograph
- Iris Plates
- Attractor

Not newly selectable as word fills:

- Neural Networks
- Rock Garden
- Spectral Plates

Removing an option from the selector is not a runtime deletion. Existing projects and imported programs that name Neural Networks, Rock Garden, or Spectral Plates continue to normalize, compile, and render. They simply cannot be chosen for a new word fill through the panel.

### Ground profiles

Cream becomes the default procedural mask ground. Dark is an explicit exception for engines whose light-on-dark composition depends on it:

- Attractor
- Turrell Fields
- Klee Lines
- Harmonograph

Fractal Flames and Iris Plates resolve to cream. Legacy Neural Networks, Rock Garden, and Spectral Plates word fills also resolve to cream if an existing configuration invokes them.

Collection and personal-media rules remain unchanged. A sourced still stays transparent when the room is already opaque, and the existing no-page-punch fallback remains dark when it is not.

## Living Text semantic compositor

### Data flow

For every displayed atom:

1. The Chamber reads the current signal from the existing `semanticTrack`.
2. The existing Living Text intensity scales the signal.
3. A shared appearance resolver maps the signal onto the existing neutral, warm, and cool palette.
4. Ordinary text receives the existing color and glow behavior unchanged.
5. A Fit atom with a procedural word fill publishes bounded semantic variables on the stable `.chamber-field` container.
6. CSS applies those inherited variables only to `.chamber-fill-field`, which remains clipped to the Fit word.

Publishing state on the stable Chamber field avoids a race with the asynchronously mounted fill host. When that host arrives, it inherits the already-current semantic variables.

### Visual treatment

The complete procedural fill composite—engine imagery plus its cream or dark ground—is treated as one semantic word surface:

- valence chooses the same warm, neutral, or cool color used by ordinary Living Text;
- tint strength is bounded to `0–45%` and scales with Living Text intensity;
- arousal raises saturation by at most `22%`;
- arousal changes brightness only within `98–104%`;
- no pulse, flicker, animation loop, shadow, or external glow is introduced.

A pseudo-element inside the masked fill compositor supplies the color wash. The compositor uses an isolated blend context so the wash affects its procedural surface without bleeding into the unmasked room. A bounded saturation/brightness filter supplies modulation. Both are clipped by the existing word mask.

The semantic values change atom by atom without an added CSS transition. The conductor track is already smoothed; avoiding another animation clock keeps playback deterministic and avoids photosensitivity regressions.

### Activation and clearing

Semantic Fit modulation is active only when all of the following are true:

- Living Text is enabled and the current semantic signal exists;
- the atom is a Word using Fit;
- Gallery-in-the-word masking applies;
- the resolved word source is procedural.

Otherwise the Chamber removes the semantic class and variables. This includes Living Text off, a missing or failed semantic track, Medium/Small/Large text, Page mode, sourced collection fills, mask fallback, and Chamber destruction.

Collection artwork is never semantically recolored. Existing ordinary Living Text remains the owner of non-Fit text color and glow. Existing Responsive Presence remains independent and continues to seed or select procedural work as it does today.

## Failure and compatibility behavior

- Semantic scoring failure produces the raw procedural fill; playback continues.
- A browser that ignores blend-mode enhancement still shows the procedural fill and bounded opacity wash.
- Mask construction failure continues to restore an opaque word; semantic fill state is cleared.
- Legacy word-fill ids remain runtime-compatible.
- No configuration schema migration is required.
- Fit-to-MP4 parity is outside this tranche. The MP4 renderer does not currently implement the live Chamber Fit-mask compositor, so this work must not claim export parity.

## Verification

Test-first implementation will cover:

1. Fit mask ink has zero computed stroke while non-Fit mask ink retains the existing stroke.
2. The complete procedural grid still lists every engine, while the Word-source selector excludes exactly Neural Networks, Rock Garden, and Spectral Plates.
3. Unsupported-for-selection legacy ids still normalize and render.
4. The procedural ground default is cream and the four named dark exceptions stay dark.
5. Positive and negative semantic signals produce warm and cool Fit variables with bounded saturation, brightness, and tint strength.
6. Living Text off, sourced fills, non-Fit text, missing signals, mask fallback, and destruction clear semantic Fit state.
7. Ordinary Living Text color/glow and Responsive Presence behavior remain green.
8. Desktop and mobile Chromium exercise real Fit masking, verify no outline, verify semantic compositor activation, and retain the stable-stage/cache-miss assertions.

## Commit sequence

Implementation will remain reviewable in three atomic commits:

1. `fix: remove Fit mask ink outline`
2. `feat: curate procedural word-fill capabilities`
3. `feat: conduct Fit fills with Living Text`

Each commit receives its own failing regression before production changes. The full unit suite and focused Fit browser corridor run on the final tree.

