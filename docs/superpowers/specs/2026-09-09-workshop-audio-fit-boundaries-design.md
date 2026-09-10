# Workshop Audio and FIT Boundaries Design

## Goal

Make highlighted Workshop audio end with its authored text range, and make Chamber FIT words enter as readable, aligned compositions on mobile and at an appropriate scale over desktop collection artwork.

## Audio authority

A highlighted audio clip owns the half-open source interval compiled for it. The first sourced atom outside that interval ends the clip with its authored fade. Structural atoms have no source coordinate and preserve the current lane. A whole-sequence bed is independent and continues while the highlighted layer starts and stops.

The swell lane therefore uses silence outside authored ranges. It does not use `hold` as a mapped fallback. Repeated atoms inside one range retain the same segment identity and do not restart playback. Adjacent ranges replace the active layer once at their shared boundary.

## FIT readiness

The opaque HTML word is the fallback and remains readable until the actual projection `<img>` used by the mask has decoded, has nonzero intrinsic dimensions, and survives one paint handoff frame. Decoding a temporary image or assigning `src` is insufficient. Readiness is guarded by the active projection generation so stale loads cannot reveal a newer mask.

Playback does not wait for remote material. A successful projection atomically replaces the fallback; a failed or indefinitely delayed projection leaves the fallback visible.

## FIT glyph geometry

The image mask and visible outline use one SVG text definition and the same transform. HTML text remains the semantic and pre-hydration fallback, then becomes visually transparent only when the SVG presentation is ready. Mask mode no longer attempts to reconcile independent SVG and CSS glyph renderers with a bounded correction.

## Desktop collection aperture

Mobile and procedural FIT words retain the current stage-sized composition. On desktop, a collection-backed room publishes the contained foreground artwork rectangle. Chamber sizes the next FIT word within that rectangle. The rectangle is a presentation contract, not a reference to a particular canvas node, and remains stable for the lifetime of a displayed atom.

If collection geometry is unavailable, Chamber uses the stage. Late geometry applies to the next atom rather than resizing the current word.

## Verification

- A highlighted swell starts once, remains stable inside its range, stops once outside it, and ignores structural atoms.
- The sequence bed continues across swell boundaries.
- The FIT fallback remains opaque while the real projection node is pending and hands off once after readiness.
- The FIT image and contour share geometry by construction.
- Desktop collection FIT uses contained artwork dimensions; mobile and procedural FIT use stage dimensions.

