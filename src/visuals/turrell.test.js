import { describe, expect, it } from 'vitest';
import { Turrell } from './turrell.js';
import { compileFieldPlanToAscii } from './ascii-engine.js';

const makeTurrell = () => {
  const el = { style: {} };
  return { el, turrell: new Turrell(el) };
};

const layersOf = bg => bg.split(/,\s*(?=(?:radial|linear)-gradient)/);

describe('Turrell aperture composition', () => {
  it('always composes figure and ground, never a single wash', () => {
    // The Turrell gesture is a bounded shape of light inside a darker
    // field. One gradient filling the frame is a colored background.
    const { el, turrell } = makeTurrell();
    for (let i = 0; i < 60; i++) {
      turrell.generate();
      expect(layersOf(el.style.background).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('keeps the aperture bounded so the ground survives around it', () => {
    // A radius approaching the frame floods the field and the figure is
    // lost — this is the regression that made v3 read as a wash.
    const { turrell } = makeTurrell();
    for (let i = 0; i < 120; i++) {
      const plan = turrell.generate();
      const [rx, ry] = plan.radius;
      expect(rx, plan.aperture).toBeLessThanOrEqual(0.42);
      expect(ry, plan.aperture).toBeLessThanOrEqual(0.42);
      expect(rx).toBeGreaterThan(0.05);
      expect(ry).toBeGreaterThan(0.05);
    }
  });

  it('gives each geometry a genuinely different silhouette', () => {
    // Names that all render the same soft oval are lying to the curator
    const { turrell } = makeTurrell();
    const seen = new Map();
    for (let i = 0; i < 400; i++) {
      const plan = turrell.generate();
      const [rx, ry] = plan.radius;
      if (!seen.has(plan.aperture)) seen.set(plan.aperture, []);
      seen.get(plan.aperture).push(rx / ry);
    }
    const mean = k => {
      const v = seen.get(k);
      return v.reduce((a, b) => a + b, 0) / v.length;
    };
    // portal is decisively taller than wide; arch decisively wider
    expect(mean('portal')).toBeLessThan(0.75);
    expect(mean('arch')).toBeGreaterThan(2);
    expect(mean('slab')).toBeLessThan(1);
  });

  it('pushes the corner aperture off-frame so the eye completes it', () => {
    const { turrell } = makeTurrell();
    let corners = 0;
    for (let i = 0; i < 400; i++) {
      const plan = turrell.generate();
      if (plan.aperture !== 'corner') continue;
      corners++;
      const [cx, cy] = plan.center;
      const nearEdge = cx < 0.2 || cx > 0.8 || cy < 0.25 || cy > 0.75;
      expect(nearEdge, `corner center ${cx},${cy}`).toBe(true);
    }
    expect(corners).toBeGreaterThan(10);
  });

  it('holds the light before it falls, so the edge reads as an opening', () => {
    // Every stop must advance monotonically, and the body must still be
    // near full strength when the falloff begins.
    const { turrell } = makeTurrell();
    for (let i = 0; i < 80; i++) {
      const plan = turrell.generate();
      const offsets = plan.stops.map(s => s.offset);
      for (let j = 1; j < offsets.length; j++) {
        expect(offsets[j], plan.aperture).toBeGreaterThan(offsets[j - 1]);
      }
      expect(offsets[0]).toBe(0);
      expect(offsets[offsets.length - 1]).toBe(1);
    }
  });

  it('carries a core/body/spill hue triad for depth of color', () => {
    // A single hue ramped in lightness is flat; light through air
    // shifts temperature across its own radius.
    const { turrell } = makeTurrell();
    for (let i = 0; i < 40; i++) {
      const plan = turrell.generate();
      const hues = plan.stops.map(s => s.color.h);
      expect(new Set(hues).size).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('Turrell plan contract', () => {
  it('emits a field plan the ASCII compiler can transcribe', () => {
    const { turrell } = makeTurrell();
    for (let i = 0; i < 40; i++) {
      const plan = turrell.generate();
      expect(plan.kind).toBe('radial');
      expect(plan.center).toHaveLength(2);
      expect(plan.radius).toHaveLength(2);
      expect(plan.stops.length).toBeGreaterThanOrEqual(3);
      for (const stop of plan.stops) {
        expect(stop.offset).toBeGreaterThanOrEqual(0);
        expect(stop.offset).toBeLessThanOrEqual(1);
        expect(typeof stop.color.h).toBe('number');
        expect(typeof stop.color.s).toBe('number');
        expect(typeof stop.color.l).toBe('number');
      }
      const frame = compileFieldPlanToAscii(plan, { columns: 48, rows: 20 });
      expect(frame).toBeTruthy();
      expect(frame.metadata.fieldKind).toBe('radial');
    }
  });

  it('never emits NaN, undefined, or unparseable CSS', () => {
    // One invalid layer voids the entire background shorthand and the
    // field renders pure black — the failure mode is silent and total.
    const { el, turrell } = makeTurrell();
    for (let i = 0; i < 200; i++) {
      turrell.generate();
      const bg = el.style.background;
      expect(bg).not.toMatch(/NaN|undefined|Infinity/);
      // `circle <percentage>` is invalid; percentages need ellipse form
      expect(bg).not.toMatch(/circle\s+[\d.]+%/);
      for (const layer of layersOf(bg)) {
        expect(layer).toMatch(/^(radial|linear)-gradient\(/);
        expect(layer.trim().endsWith(')')).toBe(true);
      }
    }
  });

  it('reports the palette and aperture it chose, and varies both', () => {
    const { turrell } = makeTurrell();
    const palettes = new Set();
    const apertures = new Set();
    for (let i = 0; i < 300; i++) {
      const plan = turrell.generate();
      palettes.add(plan.palette);
      apertures.add(plan.aperture);
    }
    expect(palettes.size).toBeGreaterThanOrEqual(6);
    expect(apertures.size).toBe(5);
  });
});
