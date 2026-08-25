/**
 * Glyph-local projection geometry — the pure core, before any canvas.
 *
 * The Chamber projects a visual material through the Fit word stencil. Doing
 * that at stage scale spends most of the render outside the letters; this core
 * computes, from rects alone, a glyph-local viewport the material mounts into,
 * clipped by the glyph mask, with a visible-area ratio the Fractal adapter uses
 * to lift density for sparse windows. Pure, so the nested viewport is a
 * rendering of a computed rect rather than a second place that computes it.
 */
import { describe, expect, it } from 'vitest';
import { resolveFitProjection } from './fit-projection.js';

const field = { left: 0, top: 0, width: 1000, height: 600 };
const area = r => r.width * r.height;
const inside = (inner, outer) =>
  inner.left >= outer.left - 0.01
  && inner.top >= outer.top - 0.01
  && inner.left + inner.width <= outer.left + outer.width + 0.01
  && inner.top + inner.height <= outer.top + outer.height + 0.01;

describe('refusing activation', () => {
  it('returns null for empty or non-finite geometry', () => {
    expect(resolveFitProjection()).toBeNull();
    expect(resolveFitProjection({ fieldRect: field, glyphRect: null })).toBeNull();
    expect(resolveFitProjection({ fieldRect: field, glyphRect: { left: 0, top: 0, width: 0, height: 20 } })).toBeNull();
    expect(resolveFitProjection({
      fieldRect: field, glyphRect: { left: 0, top: 0, width: NaN, height: 20 }
    })).toBeNull();
    // A glyph entirely off the stage clips to nothing.
    expect(resolveFitProjection({
      fieldRect: field, glyphRect: { left: 2000, top: 0, width: 100, height: 100 }
    })).toBeNull();
  });

  it('clips a glyph that overhangs the stage to the stage', () => {
    const r = resolveFitProjection({
      fieldRect: field, glyphRect: { left: 900, top: -40, width: 300, height: 200 },
      sourceKind: 'procedural'
    });
    expect(r.mask).toEqual({ left: 900, top: 0, width: 100, height: 160 });
    expect(inside(r.mask, field)).toBe(true);
  });
});

describe('sourced imagery: a glyph viewport with a cover-overflow signal', () => {
  const glyph = { left: 300, top: 220, width: 400, height: 160 };

  for (const [name, iw, ih] of [['landscape', 1600, 900], ['portrait', 900, 1600], ['square', 1024, 1024]]) {
    it(`${name} source: viewport is the glyph, inside the stage, with a finite cover scale`, () => {
      const r = resolveFitProjection({
        fieldRect: field, glyphRect: glyph, sourceKind: 'sourced',
        intrinsicWidth: iw, intrinsicHeight: ih, devicePixelRatio: 2
      });
      expect(r).not.toBeNull();
      expect(r.mask).toMatchObject(glyph);
      // the viewport the field mounts into is the glyph, on the stage
      expect(r.projection).toMatchObject(glyph);
      expect(inside(r.projection, field)).toBe(true);
      // cover scale is finite and positive; visible ratio is a real fraction
      expect(r.projection.scale).toBeGreaterThan(0);
      expect(Number.isFinite(r.projection.scale)).toBe(true);
      expect(r.visibleAreaRatio).toBeGreaterThan(0);
      expect(r.visibleAreaRatio).toBeLessThanOrEqual(1);
    });
  }

  it('a source that matches the glyph aspect reveals all of itself (ratio 1)', () => {
    // glyph 400×160 is 2.5:1; a 800×320 source is the same aspect.
    const r = resolveFitProjection({
      fieldRect: field, glyphRect: glyph, sourceKind: 'sourced',
      intrinsicWidth: 800, intrinsicHeight: 320
    });
    expect(r.visibleAreaRatio).toBeCloseTo(1, 5);
  });

  it('a whitespace-heavy glyph reveals less of the source — a lower visible ratio', () => {
    // Same source; a matched-aspect glyph vs an extreme-aspect (sparse) glyph.
    const dense = resolveFitProjection({
      fieldRect: field, glyphRect: { left: 100, top: 150, width: 800, height: 450 },
      sourceKind: 'sourced', intrinsicWidth: 1600, intrinsicHeight: 900
    });
    const sparse = resolveFitProjection({
      fieldRect: field, glyphRect: { left: 100, top: 150, width: 800, height: 90 },
      sourceKind: 'sourced', intrinsicWidth: 1600, intrinsicHeight: 900
    });
    expect(dense.visibleAreaRatio).toBeCloseTo(1, 5);
    expect(sparse.visibleAreaRatio).toBeLessThan(dense.visibleAreaRatio);
    expect(sparse.visibleAreaRatio).toBeGreaterThan(0);
  });

  it('a narrow word keeps its viewport on the stage and its scale finite', () => {
    const narrow = { left: 490, top: 100, width: 20, height: 400 };
    const r = resolveFitProjection({
      fieldRect: field, glyphRect: narrow, sourceKind: 'sourced',
      intrinsicWidth: 1600, intrinsicHeight: 400
    });
    expect(r.projection).toMatchObject(narrow);
    expect(inside(r.projection, field)).toBe(true);
    expect(Number.isFinite(r.projection.scale)).toBe(true);
    expect(r.visibleAreaRatio).toBeGreaterThan(0);
  });
});

describe('procedural imagery renders into the glyph viewport itself', () => {
  it('the projection is the glyph, and density derives from its share of the stage', () => {
    const glyph = { left: 400, top: 250, width: 200, height: 100 };
    const r = resolveFitProjection({
      fieldRect: field, glyphRect: glyph, sourceKind: 'procedural', devicePixelRatio: 2
    });
    expect(r.mask).toMatchObject(glyph);
    expect(r.projection).toMatchObject(glyph);
    expect(r.projection.scale).toBe(2);              // renders at the glyph size × dpr
    expect(r.visibleAreaRatio).toBeCloseTo(area(glyph) / area(field), 5);
  });

  it('treats a source with no intrinsic dimensions as procedural', () => {
    const glyph = { left: 0, top: 0, width: 300, height: 120 };
    const r = resolveFitProjection({ fieldRect: field, glyphRect: glyph, sourceKind: 'sourced' });
    expect(r.projection).toMatchObject(glyph);        // no intrinsic → viewport is the glyph
    expect(r.projection.scale).toBe(1);               // default dpr
  });

  it('a smaller procedural word carries a lower visible ratio than a larger one', () => {
    const small = resolveFitProjection({
      fieldRect: field, glyphRect: { left: 0, top: 0, width: 120, height: 60 }, sourceKind: 'procedural'
    });
    const large = resolveFitProjection({
      fieldRect: field, glyphRect: { left: 0, top: 0, width: 800, height: 300 }, sourceKind: 'procedural'
    });
    expect(small.visibleAreaRatio).toBeLessThan(large.visibleAreaRatio);
  });
});
