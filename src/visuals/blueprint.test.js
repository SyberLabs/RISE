import { describe, expect, it, vi } from 'vitest';
import { Blueprint, BLUEPRINT_CLIMATES, BLUEPRINT_MECHANISMS } from './blueprint.js';

// A recording 2D context: the engine must draw, and must draw only with
// primitives the house rules allow.
function recordingCanvas(width = 800, height = 500) {
  const calls = [];
  const state = { lineWidth: 0, strokeStyle: '', fillStyle: '', font: '' };
  const rec = name => (...args) => calls.push({ name, args, ...state });
  const ctx = new Proxy({
    canvas: null,
    createRadialGradient: () => ({ addColorStop: () => {} }),
    measureText: () => ({ width: 10 }),
    save: rec('save'), restore: rec('restore'), beginPath: rec('beginPath'),
    closePath: rec('closePath'), moveTo: rec('moveTo'), lineTo: rec('lineTo'),
    arc: rec('arc'), rect: rec('rect'), stroke: rec('stroke'), fill: rec('fill'),
    fillRect: rec('fillRect'), strokeRect: rec('strokeRect'), fillText: rec('fillText'),
    translate: rec('translate'), clip: rec('clip'), setLineDash: rec('setLineDash')
  }, {
    set(target, key, value) {
      if (key in state) state[key] = value;
      target[key] = value;
      return true;
    },
    get(target, key) { return target[key]; }
  });
  return { canvas: { width, height, getContext: () => ctx }, calls, ctx };
}

describe('Blueprint plan', () => {
  it('is deterministic for a given seed', () => {
    const a = new Blueprint();
    const b = new Blueprint();
    a.generate({ valence: 0.2, arousal: 0.6 }, 'seed-1');
    b.generate({ valence: 0.2, arousal: 0.6 }, 'seed-1');
    expect(a.plan).toEqual(b.plan);
  });

  it('varies mechanism and climate across seeds', () => {
    const bp = new Blueprint();
    const mechanisms = new Set();
    const climates = new Set();
    for (let i = 0; i < 60; i++) {
      bp.generate({ valence: (i % 5) / 2 - 1, arousal: (i % 7) / 6 }, `s-${i}`);
      mechanisms.add(bp.plan.mechanism);
      climates.add(bp.plan.climate);
    }
    expect(mechanisms.size).toBe(BLUEPRINT_MECHANISMS.length);
    expect(climates.size).toBeGreaterThanOrEqual(3);
  });

  it('honors an explicit climate and mechanism as a veto', () => {
    const bp = new Blueprint();
    for (let i = 0; i < 12; i++) {
      bp.generate({ valence: 0.9, arousal: 0.9 }, `v-${i}`,
        { climate: 'verdigris', mechanism: 'governor' });
      expect(bp.plan.climate).toBe('verdigris');
      expect(bp.plan.mechanism).toBe('governor');
    }
    // Unknown values fall back to auto rather than breaking
    bp.generate({}, 'x', { climate: 'chartreuse', mechanism: 'perpetual-motion' });
    expect(BLUEPRINT_CLIMATES.map(c => c.id)).toContain(bp.plan.climate);
    expect(BLUEPRINT_MECHANISMS).toContain(bp.plan.mechanism);
  });

  it('keeps complexity inside a readable band', () => {
    // A plate the eye cannot take in at a glance fails as a reading
    // surface, however accurate the mechanism.
    const bp = new Blueprint();
    for (let i = 0; i < 40; i++) {
      bp.generate({ arousal: i / 39 }, `c-${i}`);
      expect(bp.plan.teeth).toBeGreaterThanOrEqual(12);
      expect(bp.plan.teeth).toBeLessThanOrEqual(26);
    }
  });

  it('tolerates a missing or malformed signal', () => {
    const bp = new Blueprint();
    expect(bp.generate()).toBe(true);
    expect(bp.generate(null, 'n')).toBe(true);
    expect(bp.generate({ valence: NaN, arousal: 99 }, 'm')).toBe(true);
    expect(bp.plan.teeth).toBeLessThanOrEqual(26);
  });
});

describe('Blueprint rendering', () => {
  it('draws every mechanism without throwing', () => {
    const bp = new Blueprint();
    for (const mechanism of BLUEPRINT_MECHANISMS) {
      for (const { id: climate } of BLUEPRINT_CLIMATES) {
        const { canvas, calls } = recordingCanvas();
        bp.generate({ valence: 0.1, arousal: 0.5 }, `${mechanism}-${climate}`,
          { mechanism, climate });
        expect(bp.render(canvas), `${mechanism}/${climate}`).toBe(true);
        expect(calls.filter(c => c.name === 'stroke').length).toBeGreaterThan(4);
      }
    }
  });

  it('refuses to render without a plan, and survives a headless canvas', () => {
    const fresh = new Blueprint();
    expect(fresh.render(recordingCanvas().canvas)).toBe(false);

    const bp = new Blueprint();
    bp.generate({}, 'h');
    expect(bp.render(null)).toBe(false);
    expect(bp.render({ width: 10, height: 10 })).toBe(false);
    expect(bp.render({ width: 10, height: 10, getContext: () => null })).toBe(false);
  });

  it('uses the wide-understroke glow, never shadowBlur', () => {
    // House rule across every engine: glow is a faint wide stroke.
    const bp = new Blueprint();
    const { canvas, ctx } = recordingCanvas();
    bp.generate({}, 'glow', { mechanism: 'beam-engine' });
    bp.render(canvas);
    expect(ctx.shadowBlur).toBeUndefined();
    expect(ctx.shadowColor).toBeUndefined();
  });

  it('draws the sheet furniture: border, title block, dimensions', () => {
    const bp = new Blueprint();
    const { canvas, calls } = recordingCanvas();
    bp.generate({}, 'sheet', { mechanism: 'gear-train' });
    bp.render(canvas);
    // Border + title block are strokeRects; the title block writes text
    expect(calls.filter(c => c.name === 'strokeRect').length).toBeGreaterThanOrEqual(2);
    const texts = calls.filter(c => c.name === 'fillText').map(c => c.args[0]);
    expect(texts.some(t => /SHEET/.test(t))).toBe(true);
    expect(texts.some(t => /REV/.test(t))).toBe(true);
    expect(texts.some(t => /GEAR TRAIN/.test(t))).toBe(true);
  });

  it('varies line weight — the drafter\'s grammar', () => {
    // Object, hidden, centre, and construction lines must not all land
    // on one width, or the plate reads as a wireframe rather than a
    // drawing.
    const bp = new Blueprint();
    const { canvas, calls } = recordingCanvas();
    bp.generate({}, 'weights', { mechanism: 'beam-engine' });
    bp.render(canvas);
    const widths = new Set(
      calls.filter(c => c.name === 'stroke').map(c => Number(c.lineWidth).toFixed(2))
    );
    expect(widths.size).toBeGreaterThanOrEqual(4);
  });

  it('uses dashed patterns for hidden and centre lines', () => {
    const bp = new Blueprint();
    const { canvas, calls } = recordingCanvas();
    bp.generate({}, 'dash', { mechanism: 'beam-engine' });
    bp.render(canvas);
    const dashes = calls.filter(c => c.name === 'setLineDash').map(c => c.args[0]);
    expect(dashes.some(d => Array.isArray(d) && d.length === 2)).toBe(true); // hidden
    expect(dashes.some(d => Array.isArray(d) && d.length === 4)).toBe(true); // centre
  });
});

describe('Blueprint ASCII geometry', () => {
  it('exports polylines the ASCII compiler can trace', () => {
    const bp = new Blueprint();
    for (const mechanism of BLUEPRINT_MECHANISMS) {
      bp.generate({}, `a-${mechanism}`, { mechanism });
      const lines = bp.asciiPolylines(320, 200);
      expect(lines.length, mechanism).toBeGreaterThan(1);
      for (const line of lines) {
        expect(Array.isArray(line.points)).toBe(true);
        expect(line.points.length).toBeGreaterThan(1);
        for (const [x, y] of line.points) {
          expect(Number.isFinite(x), `${mechanism} x`).toBe(true);
          expect(Number.isFinite(y), `${mechanism} y`).toBe(true);
        }
      }
    }
  });

  it('yields nothing before a plan exists', () => {
    expect(new Blueprint().asciiPolylines(100, 100)).toEqual([]);
  });
});

describe('Blueprint settings surface', () => {
  it('exposes climates with swatches for the panel', () => {
    expect(BLUEPRINT_CLIMATES.length).toBe(4);
    for (const climate of BLUEPRINT_CLIMATES) {
      expect(climate.id).toBeTruthy();
      expect(climate.name).toBeTruthy();
      expect(climate.swatch).toMatch(/^rgb\(/);
    }
    expect(BLUEPRINT_CLIMATES.map(c => c.id)).toContain('cyanotype');
  });
});
