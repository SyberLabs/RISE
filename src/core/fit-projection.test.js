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
      fieldRect: field, glyphRect: { left: 900, top: -40, width: 300, height: 200 }
    });
    expect(r.mask).toEqual({ left: 900, top: 0, width: 100, height: 160 });
    expect(inside(r.mask, field)).toBe(true);
  });
});

describe('glyph viewport and procedural density', () => {
  it('the projection is the glyph, and density derives from its share of the stage', () => {
    const glyph = { left: 400, top: 250, width: 200, height: 100 };
    const r = resolveFitProjection({
      fieldRect: field, glyphRect: glyph, devicePixelRatio: 2
    });
    expect(r.mask).toMatchObject(glyph);
    expect(r.projection).toMatchObject(glyph);
    expect(r.projection.scale).toBe(2);              // renders at the glyph size × dpr
    expect(r.visibleAreaRatio).toBeCloseTo(area(glyph) / area(field), 5);
  });

  it('density is the glyph share of the stage regardless of a declared source', () => {
    const glyph = { left: 0, top: 0, width: 300, height: 120 };
    const r = resolveFitProjection({ fieldRect: field, glyphRect: glyph });
    expect(r.projection).toMatchObject(glyph);
    expect(r.projection.scale).toBe(1);
    expect(r.visibleAreaRatio).toBeCloseTo(area(glyph) / area(field), 5);
  });

  it('a smaller procedural word carries a lower visible ratio than a larger one', () => {
    const small = resolveFitProjection({
      fieldRect: field, glyphRect: { left: 0, top: 0, width: 120, height: 60 }
    });
    const large = resolveFitProjection({
      fieldRect: field, glyphRect: { left: 0, top: 0, width: 800, height: 300 }
    });
    expect(small.visibleAreaRatio).toBeLessThan(large.visibleAreaRatio);
  });
});
