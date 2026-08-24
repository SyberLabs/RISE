/**
 * Glyph-local projection geometry — pure, so the Chamber's nested viewport is
 * a rendering of a computed rect rather than a second place that computes it.
 *
 * The Fit word is a stencil. A visual material projected through it at stage
 * scale spends most of its render outside the letters and leaves empty black
 * inside them. This computes, from rects alone, where the material paints so it
 * fills the glyph instead:
 *
 *  - `mask`       — the glyph clip, stage-aligned (the outer coordinate space).
 *  - `projection` — the glyph-local viewport the material mounts into. It is
 *                   the glyph rect: the Continuous Field then draws its cover
 *                   backdrop and contained artwork INSIDE it (spec 7.3), and a
 *                   procedural engine renders at the viewport size. `scale` is
 *                   the source's cover scale into the viewport (sourced) or the
 *                   device pixel ratio (procedural).
 *  - `visibleAreaRatio` — how much of the material the glyph actually reveals.
 *                   For a procedural field it is the glyph's share of the stage;
 *                   for a sourced image it is the fraction of the cover-scaled
 *                   source the viewport shows. Low for a whitespace-heavy or
 *                   off-aspect word — the Fractal adapter lifts density when it
 *                   is low so a sparse window still reads.
 *
 * Invalid, empty, or off-stage geometry returns null — the caller keeps the
 * opaque fallback and never activates a mask over nothing.
 */

function finiteRect(rect) {
  return !!rect
    && Number.isFinite(rect.left) && Number.isFinite(rect.top)
    && Number.isFinite(rect.width) && Number.isFinite(rect.height)
    && rect.width > 0 && rect.height > 0;
}

function intersect(inner, outer) {
  const left = Math.max(inner.left, outer.left);
  const top = Math.max(inner.top, outer.top);
  const right = Math.min(inner.left + inner.width, outer.left + outer.width);
  const bottom = Math.min(inner.top + inner.height, outer.top + outer.height);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return null;
  return { left, top, width, height };
}

const area = rect => rect.width * rect.height;

export function resolveFitProjection(input = {}) {
  const {
    fieldRect,
    glyphRect,
    sourceKind,
    intrinsicWidth,
    intrinsicHeight,
    devicePixelRatio = 1
  } = input;

  if (!finiteRect(fieldRect) || !finiteRect(glyphRect)) return null;

  // The mask is the glyph, clipped to the stage. A glyph entirely off the
  // stage clips to nothing and refuses activation.
  const mask = intersect(glyphRect, fieldRect);
  if (!mask) return null;

  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;

  const hasIntrinsic = Number.isFinite(intrinsicWidth) && intrinsicWidth > 0
    && Number.isFinite(intrinsicHeight) && intrinsicHeight > 0;

  // Procedural, or a source that never declared its size: the engine renders
  // into the glyph viewport at its own size. Density comes from the glyph's
  // share of the stage — a small word gets a denser render.
  if (sourceKind === 'procedural' || !hasIntrinsic) {
    return {
      mask,
      projection: { ...mask, scale: dpr },
      visibleAreaRatio: area(mask) / area(fieldRect)
    };
  }

  // Sourced: the viewport is the glyph; the Continuous Field covers and
  // contains the source inside it. `scale` is the cover scale of the source
  // into the viewport, and the visible ratio is how much of that cover-scaled
  // source the viewport reveals — below 1 exactly when the source aspect
  // differs from the glyph, which is the whitespace-heavy case.
  const coverScale = Math.max(mask.width / intrinsicWidth, mask.height / intrinsicHeight);
  const coveredWidth = intrinsicWidth * coverScale;
  const coveredHeight = intrinsicHeight * coverScale;
  const visibleAreaRatio = Math.min(1, area(mask) / (coveredWidth * coveredHeight));

  return {
    mask,
    projection: { ...mask, scale: coverScale },
    visibleAreaRatio
  };
}
