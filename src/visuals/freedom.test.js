import { describe, expect, it, vi } from 'vitest';
import { Freedom, FREEDOM_RELATIONS, FREEDOM_FLAGS } from './freedom.js';

// Recording context: the engine must draw, and must draw the reveal as
// a subtractive operation rather than by painting the flag on top.
function recordingCanvas(width = 800, height = 500) {
  const calls = [];
  const state = { globalCompositeOperation: '', globalAlpha: 1, fillStyle: '' };
  const rec = name => (...args) => calls.push({ name, args, ...state });
  const ctx = new Proxy({
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    save: rec('save'), restore: rec('restore'), beginPath: rec('beginPath'),
    closePath: rec('closePath'), moveTo: rec('moveTo'), lineTo: rec('lineTo'),
    arc: rec('arc'), ellipse: rec('ellipse'), fill: rec('fill'),
    fillRect: rec('fillRect'), stroke: rec('stroke'), translate: rec('translate'),
    rotate: rec('rotate'), drawImage: rec('drawImage')
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

describe('Freedom plan', () => {
  it('is deterministic for a given seed', () => {
    const a = new Freedom();
    const b = new Freedom();
    a.generate({ arousal: 0.7 }, 'seed-1', { relation: 'haiti-france' });
    b.generate({ arousal: 0.7 }, 'seed-1', { relation: 'haiti-france' });
    expect(a.plan).toEqual(b.plan);
  });

  it('maps every named relation to a real pair of flags', () => {
    const bp = new Freedom();
    for (const relation of FREEDOM_RELATIONS) {
      bp.generate({}, relation, { relation });
      expect(bp.plan.ground.bands.length, relation).toBeGreaterThan(0);
      expect(bp.plan.fire.bands.length, relation).toBeGreaterThan(0);
      // Ground and fire must never be the same flag, or there is no
      // argument left to make
      expect(bp.plan.groundKey).not.toBe(bp.plan.fireKey);
    }
  });

  it('works harder when the freed flag is cut from the imperial one', () => {
    // Haiti's blue and red ARE France's. The reveal needs more strokes
    // to read as removal rather than as a variation in the same cloth.
    const shared = new Freedom();
    shared.generate({ arousal: 0.5 }, 's', { relation: 'haiti-france' });
    const distinct = new Freedom();
    distinct.generate({ arousal: 0.5 }, 's', { relation: 'brazil-portugal' });


    expect(shared.plan.shared).toBe(true);
    expect(distinct.plan.shared).toBe(false);
    expect(shared.plan.plumes).toBeGreaterThan(distinct.plan.plumes);
  });

  it('distinguishes empires by flag STRUCTURE, not only by hue', () => {
    // Britain and France are both blue/white/red within a few points.
    // As soft gradients they read as the same empire — a real problem
    // when abolition-britain and abolition-france sit side by side.
    const britain = FREEDOM_FLAGS.find(f => f.id === 'britain');
    const france = FREEDOM_FLAGS.find(f => f.id === 'france');
    expect(britain.structure).not.toBe(france.structure);
    expect(britain.structure).toBe('saltire');
    expect(france.structure).toBe('vertical');
  });

  it('scales the gesture with the passage, inside bounds', () => {
    const f = new Freedom();
    for (let i = 0; i <= 10; i++) {
      f.generate({ arousal: i / 10 }, `a-${i}`, { relation: 'peru-spain' });
      expect(f.plan.plumes).toBeGreaterThanOrEqual(3);
      expect(f.plan.plumes).toBeLessThanOrEqual(9);
      expect(f.plan.originX).toBeGreaterThan(0);
      expect(f.plan.originX).toBeLessThan(1);
    }
  });

  it('tolerates a missing signal, unknown relation, and bad flags', () => {
    const f = new Freedom();
    expect(f.generate()).toBe(true);
    expect(f.generate(null, 'n', { relation: 'atlantis-mu' })).toBe(true);
    expect(f.generate({ arousal: NaN }, 'm', { ground: 'nope', fire: 'nope' })).toBe(true);
    expect(f.plan.ground.bands.length).toBeGreaterThan(0);
  });
});

describe('Freedom rendering', () => {
  it('draws every relation without throwing', () => {
    const f = new Freedom();
    for (const relation of FREEDOM_RELATIONS) {
      const { canvas, calls } = recordingCanvas();
      f.generate({ arousal: 0.6 }, relation, { relation });
      expect(f.render(canvas), relation).toBe(true);
      expect(calls.length).toBeGreaterThan(10);
    }
  });

  it('reveals the freed flag by REMOVING the wash, never by painting it', () => {
    // The whole argument is subtractive: liberation is what shows when
    // the imposed surface is stripped, not a color added on top. If the
    // strokes ever became additive, the engine would be saying the
    // opposite of what it means.
    //
    // The strokes run on the offscreen veil, so the veil is what must be
    // inspected. jsdom has no OffscreenCanvas; document.createElement is
    // the path the engine falls back to.
    const veil = recordingCanvas();
    const spy = vi.spyOn(document, 'createElement').mockImplementation(tag => {
      if (tag === 'canvas') return veil.canvas;
      return document.createElementNS('http://www.w3.org/1999/xhtml', tag);
    });

    const f = new Freedom();
    const { canvas } = recordingCanvas();
    f.generate({ arousal: 0.7 }, 'sub', { relation: 'venezuela-spain' });
    f.render(canvas);
    spy.mockRestore();

    expect(veil.calls.some(c => c.globalCompositeOperation === 'destination-out'))
      .toBe(true);
  });

  it('leaves the context in a clean composite state', () => {
    const f = new Freedom();
    const { canvas, ctx } = recordingCanvas();
    f.generate({}, 'clean', { relation: 'brazil-portugal' });
    f.render(canvas);
    expect(ctx.globalCompositeOperation).toBe('source-over');
    expect(ctx.globalAlpha).toBe(1);
  });

  it('refuses to render without a plan, and survives a headless canvas', () => {
    expect(new Freedom().render(recordingCanvas().canvas)).toBe(false);
    const f = new Freedom();
    f.generate({}, 'h');
    expect(f.render(null)).toBe(false);
    expect(f.render({ width: 10, height: 10 })).toBe(false);
    expect(f.render({ width: 10, height: 10, getContext: () => null })).toBe(false);
  });

  it('never uses shadowBlur', () => {
    const f = new Freedom();
    const { canvas, ctx } = recordingCanvas();
    f.generate({}, 'glow', { relation: 'usa-britain' });
    f.render(canvas);
    expect(ctx.shadowBlur).toBeUndefined();
  });
});

describe('Freedom ASCII geometry', () => {
  it('exports finite polylines for every relation', () => {
    const f = new Freedom();
    for (const relation of FREEDOM_RELATIONS) {
      f.generate({}, relation, { relation });
      const lines = f.asciiPolylines(320, 200);
      expect(lines.length, relation).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line.points.length).toBeGreaterThan(1);
        for (const [x, y] of line.points) {
          expect(Number.isFinite(x)).toBe(true);
          expect(Number.isFinite(y)).toBe(true);
        }
      }
    }
  });

  it('yields nothing before a plan exists', () => {
    expect(new Freedom().asciiPolylines(100, 100)).toEqual([]);
  });
});
