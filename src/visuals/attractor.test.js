import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  AttractorField,
  PALETTES,
  ATTRACTOR_PALETTES,
  ATTRACTOR_PALETTE_IDS,
  ATTRACTOR_FORMS,
  ATTRACTOR_SYSTEMS
} from './attractor.js';
import { SWARM_PARTICLES, swarmRamp } from './attractor-swarm.js';

// Brightness buckets in the renderer; quality steps consume these from
// the dim end, so the ceiling must leave real strands to draw.
const NB_BUCKETS = 7;
const FRAME_60 = 1000 / 60;

// The field drives a canvas on a RAF loop; stub just enough that the
// constructor and one tick can run in jsdom.
function makeHost() {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { value: 800, configurable: true });
  Object.defineProperty(host, 'clientHeight', { value: 600, configurable: true });
  document.body.appendChild(host);
  return host;
}

const ctxStub = () => ({
  setTransform: vi.fn(), clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
  translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), beginPath: vi.fn(),
  moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fill: vi.fn(), arc: vi.fn(),
  drawImage: vi.fn(), fillRect: vi.fn(), globalAlpha: 1,
  createRadialGradient: () => ({ addColorStop: vi.fn() }),
  globalCompositeOperation: '', strokeStyle: '', fillStyle: '',
  lineWidth: 0, lineCap: '', lineJoin: ''
});

beforeEach(() => {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  window.matchMedia = () => ({ matches: false });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(ctxStub);
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1);
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('Attractor canvas size', () => {
  it('leaves an unchanged canvas alone, because setting its size clears it', () => {
    const field = new AttractorField(makeHost(), { system: 'aizawa' });
    const { width, height } = field.canvas;
    let sets = 0;
    for (const name of ['width', 'height']) {
      let value = field.canvas[name];
      Object.defineProperty(field.canvas, name, {
        configurable: true,
        get: () => value,
        set: next => { sets += 1; value = next; }
      });
    }
    field.resize();
    field.resize();
    expect(sets).toBe(0);
    expect([field.canvas.width, field.canvas.height]).toEqual([width, height]);

    Object.defineProperty(field.host, 'clientWidth', { value: 640, configurable: true });
    field.resize();
    expect(sets).toBe(2);
    field.destroy();
  });

  it('repaints a held frame after a resize, so a paused reading is never left blank', () => {
    const field = new AttractorField(makeHost(), { intensity: 0.65, adaptive: false });
    field.tick(performance.now());
    const heldX = field.sx.slice();
    field.pause();
    const paintsBefore = field.ctx.clearRect.mock.calls.length;
    Object.defineProperty(field.host, 'clientWidth', { value: 640, configurable: true });
    field.resize();
    expect(field.ctx.clearRect).toHaveBeenCalledTimes(paintsBefore + 1);
    expect(Array.from(field.sx)).toEqual(Array.from(heldX));
    expect(field.rafId).toBeNull();
    field.destroy();
  });
});

describe('Attractor palettes', () => {
  it('offers exactly the ten selectable filament colors', () => {
    expect(ATTRACTOR_PALETTE_IDS).toEqual(['white', 'red', 'blue', 'gold', 'purple', 'neon', 'jade', 'rose', 'citrine', 'silver']);
    for (const p of ATTRACTOR_PALETTES) {
      expect(p.name).toBeTruthy();
      expect(p.swatch).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('recolors in place without re-integrating the system', () => {
    const field = new AttractorField(makeHost(), { system: 'aizawa' });
    const points = field.px;

    expect(field.palette).toBe('white');
    expect(field.setPalette('gold')).toBe(true);
    expect(field.palette).toBe('gold');
    // Geometry is untouched — only stroke colors change
    expect(field.px).toBe(points);

    // Unknown ids and no-ops report no change
    expect(field.setPalette('chartreuse')).toBe(false);
    expect(field.setPalette('gold')).toBe(false);
    expect(field.palette).toBe('gold');

    field.destroy();
  });

  it('falls back to white for an unknown palette at construction', () => {
    const field = new AttractorField(makeHost(), { palette: 'octarine' });
    expect(field.palette).toBe('white');
    field.destroy();
  });

  it('takes no inherited name for a palette or a system', () => {
    const field = new AttractorField(makeHost(), { palette: 'constructor', system: 'toString' });
    expect(field.palette).toBe('white');
    expect(field.system).toBe('aizawa');
    expect(field.setPalette('constructor')).toBe(false);
    expect(field.palette).toBe('white');
    field.setSystem('toString');
    expect(field.system).toBe('aizawa');
    expect(() => field.tick(performance.now())).not.toThrow();
    field.destroy();
  });

  it('keeps every palette luminous: a wide dim halo under a bright core', () => {
    // A single-pass filament reads as a thin line, not as light. The
    // halo/core pairing is what makes it glow.
    const field = new AttractorField(makeHost(), {});
    for (const id of ATTRACTOR_PALETTE_IDS) {
      field.setPalette(id);
      field.tick(performance.now());
    }
    field.destroy();
  });

  it('draws every offered palette, and offers every palette it draws', () => {
    for (const id of ATTRACTOR_PALETTE_IDS) {
      expect(Object.hasOwn(PALETTES, id), id).toBe(true);
      const field = new AttractorField(makeHost(), { palette: id });
      expect(field.palette).toBe(id);
      field.destroy();
    }
    for (const id of Object.keys(PALETTES)) expect(ATTRACTOR_PALETTE_IDS).toContain(id);
  });

  it('keeps every palette legible: none draws more light than the default white', () => {
    // WCAG relative luminance of an 'r,g,b' stroke colour.
    const relLum = col => {
      const [r, g, b] = col.split(',').map(Number).map(value => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const light = passes => passes.reduce((sum, pass) => sum + pass.w * pass.mul * relLum(pass.col), 0);
    const white = PALETTES.white;
    expect(light(white.core)).toBeCloseTo(1.633, 3);
    expect(light(white.core) + 0.6 * light(white.twin)).toBeCloseTo(2.123, 3);
    for (const [id, palette] of Object.entries(PALETTES)) {
      const [halo, core] = palette.core;
      expect(halo.w, id).toBeLessThanOrEqual(3.0);
      expect(core.w, id).toBeLessThanOrEqual(0.8);
      expect(halo.mul, id).toBeLessThanOrEqual(0.55);
      expect(relLum(core.col), id).toBeGreaterThan(relLum(halo.col));
      expect(light(palette.core), id).toBeLessThanOrEqual(light(white.core));
      expect(light(palette.core) + 0.6 * light(palette.twin), id)
        .toBeLessThanOrEqual(light(white.core) + 0.6 * light(white.twin));
    }
  });
});

describe('Attractor forms', () => {
  it('reports only the first completed projection frame for the current host', () => {
    const host = makeHost();
    const projection = document.createElement('div');
    document.body.appendChild(projection);
    const onProjectionPaint = vi.fn();
    const field = new AttractorField(host, { onProjectionPaint });

    field.setProjectionHost(projection);
    expect(onProjectionPaint).not.toHaveBeenCalled();
    field.tick(performance.now());

    expect(onProjectionPaint).toHaveBeenCalledTimes(1);
    expect(onProjectionPaint.mock.calls[0][0]).toBe(projection);
    expect(onProjectionPaint.mock.calls[0][0]).not.toBe(host);
    expect(projection.querySelector('.attractor-canvas')).toBeTruthy();
    field.tick(performance.now() + 16);
    field.setProjectionHost(projection);
    expect(onProjectionPaint).toHaveBeenCalledTimes(1);
    field.setProjectionHost(null);
    field.tick(performance.now() + 32);
    expect(onProjectionPaint).toHaveBeenCalledTimes(1);
    field.destroy();
    expect(onProjectionPaint).toHaveBeenCalledTimes(1);
  });

  it('reports replacement B, not A, when replacement happens before the first frame', () => {
    const host = makeHost();
    const first = document.createElement('div');
    const second = document.createElement('div');
    document.body.append(first, second);
    const onProjectionPaint = vi.fn();
    const field = new AttractorField(host, { onProjectionPaint });

    field.setProjectionHost(first);
    field.setProjectionHost(second);
    field.tick(performance.now());

    expect(onProjectionPaint).toHaveBeenCalledTimes(1);
    expect(onProjectionPaint.mock.calls[0][0]).toBe(second);
    expect(onProjectionPaint).not.toHaveBeenCalledWith(first);
    field.destroy();
  });

  it('does not report when destroyed before its first frame', () => {
    const host = makeHost();
    const projection = document.createElement('div');
    document.body.appendChild(projection);
    const onProjectionPaint = vi.fn();
    const field = new AttractorField(host, { onProjectionPaint });

    field.setProjectionHost(projection);
    field.destroy();

    expect(onProjectionPaint).not.toHaveBeenCalled();
    expect(projection.querySelector('.attractor-canvas')).toBeNull();
  });

  it('changes symmetry in place — the mid-session control', () => {
    const field = new AttractorField(makeHost(), {});
    const points = field.px;

    expect(field.form).toBe('mirror');
    expect(field.setForm('kaleido')).toBe(true);
    expect(field.form).toBe('kaleido');
    // No re-integration: the same filament, drawn through new symmetry
    expect(field.px).toBe(points);

    expect(field.setForm('nonsense')).toBe(false);
    expect(field.form).toBe('kaleido');
    field.destroy();
  });

  it('restores the form the reader was in, not a hardcoded default', () => {
    const field = new AttractorField(makeHost(), { form: 'bilateral' });

    expect(field.toggleKaleidoscope()).toBe(true);
    expect(field.form).toBe('kaleido');

    expect(field.toggleKaleidoscope()).toBe(false);
    expect(field.form).toBe('bilateral');

    field.destroy();
  });

  it('starts folded when the session authored kaleido', () => {
    const field = new AttractorField(makeHost(), { form: 'kaleido' });
    expect(field.form).toBe('kaleido');
    // Unfolding from an authored kaleido still lands somewhere valid
    field.toggleKaleidoscope();
    expect(ATTRACTOR_FORMS).toContain(field.form);
    field.destroy();
  });

  it('renders every form and system without throwing', () => {
    const field = new AttractorField(makeHost(), {});
    for (const sys of ATTRACTOR_SYSTEMS) {
      field.setSystem(sys.id);
      for (const form of ATTRACTOR_FORMS) {
        field.setForm(form);
        expect(() => field.tick(performance.now())).not.toThrow();
      }
    }
    field.destroy();
  });

  it('adapts quality to the hardware instead of asking the reader', () => {
    // The rosette draws the filament 12x per frame. Rather than make
    // readers classify their own computer, the field measures how far
    // apart its frames arrive and steps down only when it is missing them.
    const field = new AttractorField(makeHost(), { form: 'kaleido' });
    expect(field.quality).toBe(0);

    // A single late frame cannot outweigh a healthy display-paced window.
    field.measureQuality(300);
    for (let i = 0; i < 45; i++) field.measureQuality(1000 / 60);
    expect(field.quality).toBe(0);

    // A 30fps display is still healthy; a median slower than 30fps (or a
    // slow tail past 50ms) is what makes quality step down.
    for (let i = 0; i < 90; i++) field.measureQuality(1000 / 30);
    expect(field.quality).toBe(0);
    for (let i = 0; i < 45; i++) field.measureQuality(70);
    expect(field.quality).toBeGreaterThan(0);

    // Good frame windows restore detail, with longer recovery backoff
    // covered separately below.
    for (let i = 0; i < 45 * 28; i++) field.measureQuality(FRAME_60);
    expect(field.quality).toBe(0);

    field.destroy();
  });

  it('never degrades below a legible figure, and can be opted out', () => {
    const field = new AttractorField(makeHost(), { form: 'kaleido' });
    for (let i = 0; i < 45 * 12; i++) field.measureQuality(70);
    // Bounded: the shape must always survive
    expect(field.quality).toBe(field.maxQuality);
    expect(field.maxQuality).toBeLessThan(NB_BUCKETS - 1);
    field.destroy();

    const fixed = new AttractorField(makeHost(), { form: 'kaleido', adaptive: false });
    for (let i = 0; i < 45 * 4; i++) fixed.measureQuality(70);
    expect(fixed.quality).toBe(0);
    fixed.destroy();
  });

  it('skips the mirror-twin projection for forms that do not use it', () => {
    // Kaleido and bilateral are symmetry operations on the base points,
    // so computing the twin would be wasted work every frame.
    const field = new AttractorField(makeHost(), { form: 'kaleido' });
    field.sx2.fill(0);
    field.tick(performance.now());
    expect(field.sx2.every(v => v === 0)).toBe(true);

    field.setForm('mirror');
    field.tick(performance.now());
    expect(field.sx2.some(v => v !== 0)).toBe(true);

    field.destroy();
  });
});

describe('Attractor frame-rate policy', () => {
  // Owner decision 2026-10-05: a window steps down when its median frame is
  // slower than 30fps or its slow tail passes 50ms.
  const windowOf = (field, intervals) => intervals.forEach(ms => field.measureQuality(ms));

  it('holds full detail on a steady, jittery 30 Hz host', () => {
    const field = new AttractorField(makeHost(), { form: 'kaleido' });
    for (let w = 0; w < 6; w++) {
      windowOf(field, Array.from({ length: 45 }, (_, i) => 1000 / 30 + [-1, 0, 1][i % 3]));
    }
    expect(field.quality).toBe(0);
    field.destroy();
  });

  it('steps down at a 38 ms median with a 49 ms tail, which averages under 40 ms', () => {
    const field = new AttractorField(makeHost(), { form: 'kaleido' });
    windowOf(field, [...Array(40).fill(38), ...Array(5).fill(49)]);
    expect(field.quality).toBe(1);
    field.destroy();
  });

  it('steps down for hitches past 50 ms even when the median keeps pace', () => {
    const field = new AttractorField(makeHost(), { form: 'kaleido' });
    windowOf(field, [...Array(40).fill(20), ...Array(5).fill(60)]);
    expect(field.quality).toBe(1);
    field.destroy();
  });

  it('keeps the reader control visible at the lowest detail', () => {
    // The ChatGPT presentation's only visual control drives intensity.
    const alphas = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      const ctx = ctxStub();
      Object.defineProperty(ctx, 'strokeStyle', { set: value => alphas.push(String(value)), get: () => '' });
      return ctx;
    });
    const field = new AttractorField(makeHost(), { form: 'kaleido' });
    field.quality = field.maxQuality;
    const drawAt = intensity => {
      field.setIntensity(intensity);
      alphas.length = 0;
      field.tick(performance.now());
      return alphas.join('|');
    };
    expect(drawAt(0.4)).not.toBe(drawAt(0.75));
    field.destroy();
  });
});

describe('Attractor adaptive quality', () => {
  // A fake clock under which the field's own drawing costs nothing. The
  // only sign of a struggling machine is the gap between animation
  // frames, which is how a canvas that rasterizes after the callback looks.
  function liveField(options) {
    let clock = 1000;
    let next = null;
    // Plain no-ops: a mock recording every lineTo over hundreds of frames runs out of memory.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      const ctx = ctxStub();
      for (const key of Object.keys(ctx)) if (typeof ctx[key] === 'function') ctx[key] = () => {};
      ctx.createRadialGradient = () => ({ addColorStop() {} });
      return ctx;
    });
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { next = callback; return 1; });
    const field = new AttractorField(makeHost(), options);
    return {
      field,
      wait: ms => { clock += ms; },
      frames(count, intervalMs) {
        for (let i = 0; i < count; i++) {
          clock += intervalMs;
          const callback = next;
          next = null;
          callback(clock);
        }
      }
    };
  }

  it('steps down when frames arrive slowly, though its own drawing is cheap', () => {
    const { field, frames } = liveField({ form: 'kaleido' });
    frames(46, 70);
    expect(field.quality).toBe(field.maxQuality);
    frames(45 * 4, 70);
    expect(field.quality).toBe(field.maxQuality);
    field.destroy();
  });

  it('keeps full detail on fast frames, and restores it when frames speed up', () => {
    const { field, frames } = liveField({ form: 'kaleido' });
    frames(1 + 45 * 3, 1000 / 120);
    expect(field.quality).toBe(0);
    frames(45 * 3, 1000 / 30);
    expect(field.quality).toBe(0);
    frames(45 * 2, 70);
    expect(field.quality).toBeGreaterThan(0);
    frames(45 * 28, FRAME_60);
    expect(field.quality).toBe(0);
    field.destroy();
  // Deterministic under the fake clock, but ~1,700 simulated frames exceed
  // the 5 s default on a loaded CI shard.
  }, 20_000);

  it('responds within a few actual frames when raster latency is severe', () => {
    const { field, frames } = liveField({ form: 'kaleido' });
    frames(4, 600);
    expect(field.quality).toBe(1);
    frames(6, 600);
    expect(field.quality).toBe(field.maxQuality);
    field.destroy();
  });

  it('waits longer each time before retrying detail that proved too slow', () => {
    const { field } = liveField({ form: 'kaleido' });
    const slowWindow = () => { for (let i = 0; i < 20; i++) field.measureQuality(50); };
    const fastWindow = () => { for (let i = 0; i < 45; i++) field.measureQuality(FRAME_60); };

    slowWindow();
    expect(field.quality).toBe(1);
    fastWindow();
    fastWindow();
    expect(field.quality).toBe(0);

    slowWindow();
    expect(field.quality).toBe(1);
    fastWindow();
    fastWindow();
    fastWindow();
    expect(field.quality).toBe(1);
    fastWindow();
    expect(field.quality).toBe(0);
    field.destroy();
  });

  it('does not count a tab switch or a pause as a slow frame', () => {
    const { field, frames, wait } = liveField({ form: 'kaleido' });
    frames(30, 1000 / 60);
    document.dispatchEvent(new Event('visibilitychange'));
    frames(1, 10_000);
    frames(15, 1000 / 60);
    expect(field.quality).toBe(0);
    for (let i = 0; i < 6; i++) {
      frames(8, 1000 / 60);
      field.pause();
      wait(450);
      field.resume();
    }
    expect(field.quality).toBe(0);
    field.destroy();
  });

  it('caps its backing store at 1.5x on dense displays', () => {
    const dpr = vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(3);
    const field = new AttractorField(makeHost(), { form: 'kaleido' });
    expect(field.canvas.width).toBe(800 * 1.5);
    expect(field.canvas.height).toBe(600 * 1.5);
    field.destroy();
    dpr.mockReturnValue(1);
    const plain = new AttractorField(makeHost());
    expect(plain.canvas.width).toBe(800);
    plain.destroy();
  });

  it('counts only the live loop, not a Page plate sampled between frames', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,');
    const { field, frames } = liveField({ form: 'kaleido' });
    for (let i = 0; i < 46; i++) {
      frames(1, 70);
      field.sampleAt(i);
    }
    expect(field.quality).toBe(field.maxQuality);
    field.destroy();
  });

  it('does not cycle when one step down speeds frames past where it stepped', () => {
    const { field, frames } = liveField({ form: 'kaleido' });
    const fps = quality => 24.5 * 1.85 ** quality;
    // Frames run at the speed of the detail being drawn, from the step on.
    for (let i = 0; i < 100 && field.quality === 0; i++) frames(1, 1000 / fps(0));
    expect(field.quality).toBe(1);
    const seen = new Set();
    for (let i = 0; i < 45 * 10; i++) {
      frames(1, 1000 / fps(field.quality));
      seen.add(field.quality);
    }
    expect([...seen]).toEqual([1]);
    field.destroy();
  });
});

describe('Attractor visual control', () => {
  it('interpolates and retargets brightness inside its frame loop', () => {
    let frame;
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
      frame = callback;
      return 2;
    });
    const field = new AttractorField(makeHost(), { intensity: 0.65, adaptive: false });
    const start = performance.now();
    expect(field.controlVisual({ surface: 'attractor', parameter: 'intensity', value: 0.75 }))
      .toMatchObject({ status: 'accepted', requested: 0.75, effective: 0.75 });
    field.tick(start);
    expect(field.intensity).toBe(0.65);
    field.tick(start + 160);
    expect(field.intensity).toBeCloseTo(0.7, 2);
    field.controlVisual({ surface: 'attractor', parameter: 'intensity', value: 0.4 });
    const retargetStart = performance.now();
    field.tick(retargetStart);
    expect(field.intensity).toBeCloseTo(0.7, 2);
    field.tick(retargetStart + 160);
    expect(field.intensity).toBeCloseTo(0.55, 2);
    field.tick(retargetStart + 320);
    expect(field.intensity).toBe(0.4);
    field.destroy();
  });

  it('cancels a pending transition when the owning record is retired', () => {
    const field = new AttractorField(makeHost(), { intensity: 0.65, adaptive: false });
    field.controlVisual({ surface: 'attractor', parameter: 'intensity', value: 0.75 });
    field.destroy();
    expect(field.controlVisual({ surface: 'attractor', parameter: 'intensity', value: 0.7 }))
      .toEqual({ status: 'refused', code: 'NO_ACTIVE_VISUAL' });
  });

  it('refuses discovery and control when the connected canvas has no 2D context', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const field = new AttractorField(makeHost(), { intensity: 0.65, adaptive: false });

    expect(field.canvas.isConnected).toBe(true);
    expect(field.discoverVisual()).toBeNull();
    expect(field.controlVisual({ surface: 'attractor', parameter: 'intensity', value: 0.75 }))
      .toEqual({ status: 'refused', code: 'NO_ACTIVE_VISUAL' });
    field.destroy();
  });

  it('repaints a paused field once without restarting its frame loop', () => {
    const field = new AttractorField(makeHost(), { intensity: 0.65, adaptive: false });
    const paintedAt = performance.now();
    field.tick(paintedAt);
    const heldX = field.sx.slice();
    const heldY = field.sy.slice();
    field.pause();
    const paintsBefore = field.ctx.clearRect.mock.calls.length;
    field.controlVisual({ surface: 'attractor', parameter: 'intensity', value: 0.75 });

    expect(field.intensity).toBe(0.75);
    expect(field.ctx.clearRect).toHaveBeenCalledTimes(paintsBefore + 1);
    expect(Array.from(field.sx)).toEqual(Array.from(heldX));
    expect(Array.from(field.sy)).toEqual(Array.from(heldY));
    expect(field.rafId).toBeNull();
    field.resume();
    const resumedAt = field.t0;
    field.tick(resumedAt);
    expect(Array.from(field.sx)).toEqual(Array.from(heldX));
    field.tick(resumedAt + 1000);
    expect(Array.from(field.sx)).not.toEqual(Array.from(heldX));
    field.destroy();
  });

  it('uses one still repaint for a reduced-motion adjustment', () => {
    window.matchMedia = () => ({ matches: true });
    const field = new AttractorField(makeHost(), { intensity: 0.65, adaptive: false });
    const paintsBefore = field.ctx.clearRect.mock.calls.length;
    field.controlVisual({ surface: 'attractor', parameter: 'intensity', value: 0.75 });

    expect(field.intensity).toBe(0.75);
    expect(field._intensityTransition).toBeNull();
    expect(field.ctx.clearRect).toHaveBeenCalledTimes(paintsBefore + 1);
    expect(field.rafId).toBe(1);
    field.destroy();
  });

  it('resets a local target to its authored value when its cue is canceled', () => {
    const field = new AttractorField(makeHost(), { intensity: 0.6, adaptive: false });
    field.controlVisual({ surface: 'attractor', parameter: 'intensity', value: 0.75 });
    field.cancelVisualControl();

    expect(field.intensity).toBe(0.6);
    expect(field.targetIntensity).toBe(0.6);
    expect(field._intensityTransition).toBeNull();
    field.destroy();
  });

  it('repaints reduced-motion output when a cue cancels its local target', () => {
    window.matchMedia = () => ({ matches: true });
    const field = new AttractorField(makeHost(), { intensity: 0.6, adaptive: false });
    const styles = [];
    vi.spyOn(field.ctx, 'stroke').mockImplementation(function () {
      styles.push(this.strokeStyle);
    });
    field.tick(performance.now());
    const authoredStyles = styles.slice();

    field.controlVisual({ surface: 'attractor', parameter: 'intensity', value: 0.75 });
    expect(styles.slice(-authoredStyles.length)).not.toEqual(authoredStyles);
    const beforeCancel = styles.length;
    field.cancelVisualControl();

    expect(styles.length).toBeGreaterThan(beforeCancel);
    expect(styles.slice(-authoredStyles.length)).toEqual(authoredStyles);
    field.destroy();
  });
});

describe('Attractor reduced motion', () => {
  const paints = field => field.ctx.clearRect.mock.calls.length;

  it('reads the system setting live, so turning it on mid-reading stills the field', () => {
    const media = { matches: false };
    window.matchMedia = () => media;
    const field = new AttractorField(makeHost(), { adaptive: false });
    field.tick(1000);
    field.tick(1016);
    const moving = paints(field);

    media.matches = true;
    field.tick(1032);
    field.tick(1048);
    field.tick(1064);
    expect(paints(field)).toBe(moving + 1);
    field.destroy();
  });

  it('reads the app’s root class live, so turning the setting off mid-reading sets the field moving again', () => {
    const root = document.documentElement.classList;
    const field = new AttractorField(makeHost(), { adaptive: false });
    try {
      field.tick(1000);
      field.tick(1016);
      root.add('reduced-motion');
      field.tick(1032);
      field.tick(1048);
      const still = paints(field);
      field.tick(1064);
      expect(paints(field)).toBe(still);

      root.remove('reduced-motion');
      field.tick(1080);
      field.tick(1096);
      field.tick(1112);
      expect(paints(field)).toBe(still + 3);
      expect(field.rafId).not.toBeNull();
    } finally {
      root.remove('reduced-motion');
      field.destroy();
    }
  });

  it('repaints the still once when what it shows changes', () => {
    window.matchMedia = () => ({ matches: true });
    const field = new AttractorField(makeHost(), { adaptive: false });
    field.tick(1000);
    field.tick(1016);
    const still = paints(field);

    for (const change of [
      () => field.toggleKaleidoscope(),
      () => field.setPalette('gold'),
      () => field.setSystem('thomas'),
      () => field.setIntensity(0.4),
      () => field.setSpeed(2)
    ]) {
      const before = paints(field);
      change();
      field.tick(2000);
      field.tick(2016);
      expect(paints(field)).toBe(before + 1);
    }
    expect(paints(field)).toBe(still + 5);
    field.destroy();
  });
});

describe('Attractor speed', () => {
  it('defaults to the original pace and clamps the option', () => {
    expect(new AttractorField(makeHost(), {}).speed).toBe(1);
    expect(new AttractorField(makeHost(), { speed: 9 }).speed).toBe(4);
    expect(new AttractorField(makeHost(), { speed: 0 }).speed).toBe(0.25);
  });

  it('changes pace without jumping the figure', () => {
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(0);
    const field = new AttractorField(makeHost(), { speed: 2 });
    now.mockReturnValue(3000);
    const before = field.motionTime(3000);
    expect(field.setSpeed(0.5)).toBe(true);
    expect(field.motionTime(3000)).toBeCloseTo(before, 6);
    expect(field.motionTime(5000)).toBeCloseTo(before + 1, 6);
  });
});

describe('Attractor swarm', () => {
  const TICK = 1000 / 60;
  const swarmField = (options = {}) => new AttractorField(makeHost(), { trace: 'swarm', adaptive: false, ...options });
  const dots = ctx => ctx.fillRect.mock.calls.filter(([, , w]) => w < 10);

  it('is a filament unless the swarm is chosen', () => {
    expect(new AttractorField(makeHost(), {}).trace).toBe('filament');
    expect(new AttractorField(makeHost(), { trace: 'ribbon' }).trace).toBe('filament');
    expect(new AttractorField(makeHost(), {}).swarm).toBeUndefined();
    const field = swarmField();
    expect(field.trace).toBe('swarm');
    expect(field.swarm.count).toBe(SWARM_PARTICLES);
    field.destroy();
  });

  it('keeps every particle inside the circle inscribed in the frame, for every system, as it turns', () => {
    for (const { id } of ATTRACTOR_SYSTEMS) {
      const field = swarmField({ system: id });
      const { swarm } = field;
      for (const [w, h] of [[800, 600], [390, 844]]) {
        const radius = Math.min(w, h) / 2;
        let widest = 0;
        for (let tick = 0; tick < 900; tick++) {
          swarm.advance();
          if (tick % 15) continue;
          const { x, y } = swarm.project(w, h, tick * 0.05);
          for (let i = 0; i < swarm.count; i++) {
            widest = Math.max(widest, Math.hypot(x[i] - w / 2, y[i] - h / 2));
          }
        }
        expect(widest, `${id} ${w}x${h}`).toBeLessThan(radius * 0.95);
        expect(widest, `${id} ${w}x${h}`).toBeGreaterThan(radius * 0.5);
      }
      field.destroy();
    }
  });

  it('is deterministic: two swarms of one system move the same way', () => {
    const a = swarmField({ system: 'thomas' }).swarm;
    const b = swarmField({ system: 'thomas' }).swarm;
    for (let i = 0; i < 120; i++) { a.advance(); b.advance(); }
    expect(Array.from(a.z)).toEqual(Array.from(b.z));
  });

  it('colours by height along six steps from the palette\'s darker hue to its light core', () => {
    const field = swarmField({ palette: 'gold' });
    const { swarm } = field;
    const used = new Set();
    for (let tick = 0; tick < 600; tick++) {
      swarm.advance();
      for (const step of swarm.project(800, 600, 0).bucket) used.add(step);
    }
    expect(Math.min(...used)).toBe(0);
    expect(Math.max(...used)).toBe(5);
    const ramp = swarmRamp(PALETTES.gold);
    expect(ramp).toHaveLength(6);
    expect(ramp[0]).toBe('rgba(196,132,26,0.5)');
    expect(ramp[5]).toBe('rgba(255,232,176,0.5)');
    field.destroy();
  });

  it('plots each particle mirrored left and right, additively, in small squares that scale with the frame', () => {
    const field = swarmField({ form: 'mirror' });
    field.paintOnce(performance.now());
    const plotted = dots(field.dotCtx);
    expect(plotted.length).toBeGreaterThanOrEqual(2 * SWARM_PARTICLES);
    const size = plotted[0][2];
    expect(size).toBeCloseTo(Math.max(1.2, 600 / 500), 6);
    const centres = new Set(plotted.map(([x, y, w]) => `${(x + w / 2).toFixed(2)},${(y + w / 2).toFixed(2)}`));
    for (const [x, y, w] of plotted.slice(0, 200)) {
      expect(centres.has(`${(800 - (x + w / 2)).toFixed(2)},${(y + w / 2).toFixed(2)}`)).toBe(true);
    }
    field.destroy();
  });

  it('adds each tick to the trail in one draw: its squares go to an 8-bit scratch square, cleared each tick', () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const field = swarmField();
    const added = [];
    field.trailCtx.drawImage = vi.fn((source, x, y) => added.push({ source, x, y, op: field.trailCtx.globalCompositeOperation }));
    field.tick(0);
    field.tick(TICK + 0.01);
    field.tick(2 * TICK + 0.01);
    // Two ticks: two draws onto the float16 trail, each the scratch square added as light, on whole pixels.
    expect(added).toHaveLength(2);
    for (const draw of added) {
      expect(draw.source).toBe(field.dotCanvas);
      expect(draw.op).toBe('lighter');
      expect(Number.isInteger(draw.x) && Number.isInteger(draw.y)).toBe(true);
    }
    expect(dots(field.trailCtx)).toHaveLength(0);
    expect(dots(field.dotCtx)).toHaveLength(2 * 2 * SWARM_PARTICLES);
    // Cleared whole before each tick's squares, so a tick adds only itself.
    const side = field.dotCanvas.width;
    expect(field.dotCtx.clearRect.mock.calls.filter(([x, y, w, h]) => x === 0 && y === 0 && w === side && h === side)).toHaveLength(2);
    // An 8-bit square: only the trail is float16. It covers the circle inscribed in the frame, where every particle is.
    const { calls, contexts } = HTMLCanvasElement.prototype.getContext.mock;
    const optionsOf = canvas => calls[contexts.lastIndexOf(canvas)][1];
    expect(optionsOf(field.trailCanvas)).toEqual({ colorType: 'float16' });
    expect(optionsOf(field.dotCanvas)?.colorType).toBeUndefined();
    expect(side).toBeGreaterThanOrEqual(Math.min(800, 600) * field.DPR);
    field.destroy();
  });

  it('folds into the engine\'s kaleidoscope: a sixth of the swarm in twelve reflected sectors, the mirror\'s weight', () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const kaleido = swarmField({ form: 'kaleido' });
    const mirror = swarmField({ form: 'mirror' });
    for (const field of [kaleido, mirror]) {
      field.tick(0);
      field.tick(TICK + 0.01);
    }
    const plotted = dots(kaleido.dotCtx);
    expect(plotted).toHaveLength(12 * Math.ceil(SWARM_PARTICLES / 6));
    expect(plotted.length).toBeCloseTo(dots(mirror.dotCtx).length, -1);
    // Each particle's twelve images lie on one circle about the centre, sixty degrees apart in pairs.
    const radii = plotted.slice(0, 12).map(([x, y, w]) => Math.hypot(x + w / 2 - 400, y + w / 2 - 300));
    for (const r of radii) expect(r).toBeCloseTo(radii[0], 6);
    kaleido.destroy();
    mirror.destroy();
  });

  it('runs sixty ticks a second of motion, turning 0.18 rad a second, and speed scales both', () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    for (const speed of [1, 2]) {
      const field = swarmField({ speed });
      field.tick(0);
      const advance = vi.spyOn(field.swarm, 'advance');
      for (let i = 1; i <= 60; i++) field.tick(i * TICK + 0.01);
      expect(advance).toHaveBeenCalledTimes(60 * speed);
      expect(field.swarmTheta).toBeCloseTo(0.6 + 0.18 * speed, 2);
      field.destroy();
    }
  });

  it('moves nothing while paused, and repaints a held frame without advancing it', () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const field = swarmField();
    for (let i = 0; i <= 30; i++) field.tick(i * TICK + 0.01);
    field.pause();
    const held = Array.from(field.swarm.x);
    const plots = dots(field.dotCtx).length;
    const advance = vi.spyOn(field.swarm, 'advance');
    for (let i = 31; i <= 90; i++) field.tick(i * TICK);
    field.controlVisual({ surface: 'attractor', parameter: 'intensity', value: 0.75 });
    expect(advance).not.toHaveBeenCalled();
    expect(dots(field.dotCtx)).toHaveLength(plots);
    expect(Array.from(field.swarm.x)).toEqual(held);
    expect(field.rafId).toBeNull();
    field.destroy();
  });

  it('blooms from an empty trail when it starts live, one tick of squares at a time', () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const field = swarmField();
    field.tick(0);
    expect(dots(field.dotCtx)).toHaveLength(0);
    field.tick(TICK + 0.01);
    expect(dots(field.dotCtx)).toHaveLength(2 * SWARM_PARTICLES);
    field.destroy();
  });

  it('fills an emptied trail on a paused resize, so a paused reading is never left blank', () => {
    const field = swarmField();
    field.tick(performance.now());
    field.pause();
    const plots = dots(field.dotCtx).length;
    Object.defineProperty(field.host, 'clientWidth', { value: 640, configurable: true });
    field.resize();
    expect(dots(field.dotCtx).length).toBeGreaterThan(plots);
    field.destroy();
  });

  it('holds one accumulated still under reduced motion: nothing moves or fades afterwards', () => {
    window.matchMedia = () => ({ matches: true });
    const field = swarmField();
    field.tick(1000);
    const fades = () => field.trailCtx.fillRect.mock.calls.filter(([, , w]) => w >= 10).length;
    const plots = dots(field.dotCtx).length;
    expect(plots).toBe(90 * 2 * SWARM_PARTICLES);
    const advance = vi.spyOn(field.swarm, 'advance');
    const faded = fades();
    for (let i = 1; i < 30; i++) field.tick(1000 + i * TICK);
    expect(advance).not.toHaveBeenCalled();
    expect(dots(field.dotCtx)).toHaveLength(plots);
    expect(fades()).toBe(faded);
    field.destroy();
  });

  it('presents the trail at its intensity: the study\'s look at 0.65, brighter by a second additive pass', () => {
    const field = swarmField({ intensity: 0.65 });
    const alphas = [];
    field.ctx.drawImage = vi.fn(() => alphas.push([field.ctx.globalAlpha, field.ctx.globalCompositeOperation]));
    field.paintOnce(performance.now());
    expect(alphas).toEqual([[1, 'source-over']]);
    alphas.length = 0;
    field.setIntensity(0.4);
    field.paintOnce(performance.now());
    expect(alphas).toHaveLength(1);
    expect(alphas[0][0]).toBeCloseTo(0.4 / 0.65, 6);
    alphas.length = 0;
    field.setIntensity(0.75);
    field.paintOnce(performance.now());
    expect(alphas[0]).toEqual([1, 'source-over']);
    expect(alphas[1][0]).toBeCloseTo(0.75 / 0.65 - 1, 6);
    expect(alphas[1][1]).toBe('lighter');
    field.destroy();
  });

  it('never flickers: its light is held steady frame to frame, so photosensitivity mode has nothing to calm', () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const field = swarmField({ intensity: 0.5 });
    const alphas = [];
    field.ctx.drawImage = vi.fn(() => alphas.push(field.ctx.globalAlpha));
    for (let i = 0; i < 120; i++) field.tick(i * TICK + 0.01);
    expect(new Set(alphas)).toEqual(new Set([0.5 / 0.65]));
    field.destroy();
  });

  it('presents its trail only when a tick has moved it: a frame between ticks shows what is already there', () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const field = swarmField();
    const presented = () => field.ctx.drawImage.mock.calls.length;
    field.tick(0);
    field.tick(TICK + 0.01);
    const first = presented();
    expect(first).toBeGreaterThan(0);
    field.tick(TICK + 5);
    field.tick(TICK + 9);
    expect(presented()).toBe(first);
    field.tick(2 * TICK + 0.01);
    expect(presented()).toBeGreaterThan(first);
    field.destroy();
  });

  it('is drawn at the scale its layer declares (Live’s circle frames): resized once when it arrives, never again while it holds', () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const layer = document.createElement('div');
    document.body.appendChild(layer);
    const host = makeHost();
    layer.appendChild(host);
    const field = new AttractorField(host, { trace: 'swarm', adaptive: false });
    expect(field.canvas.width).toBe(800);
    layer.dataset.liveScale = '0.5';
    field.tick(TICK + 0.01);
    expect([field.canvas.width, field.canvas.height]).toEqual([400, 300]);
    expect([field.trailCanvas.width, field.trailCanvas.height]).toEqual([400, 300]);
    let sets = 0;
    const width = field.canvas.width;
    Object.defineProperty(field.canvas, 'width', { configurable: true, get: () => width, set: () => { sets += 1; } });
    for (let i = 2; i < 60; i++) field.tick(i * TICK + 0.01);
    expect(sets).toBe(0);
    delete field.canvas.width;
    // The field's own coordinates are the layer's: only the backing is smaller.
    expect([field.W, field.H]).toEqual([800, 600]);
    // The next visual's scale, declared while this one fades out, leaves it as it is.
    layer.dataset.liveScale = '0.8';
    field.tick(60 * TICK + 0.01);
    expect(field.canvas.width).toBe(400);
    delete layer.dataset.liveScale;
    field.tick(61 * TICK + 0.01);
    expect(field.canvas.width).toBe(800);
    field.destroy();
  });

  it('is drawn at its own size where nothing declares a scale, as in the Reader and the card', () => {
    const field = swarmField();
    for (let i = 0; i < 5; i++) field.tick(i * TICK + 0.01);
    expect([field.canvas.width, field.canvas.height]).toEqual([800, 600]);
    field.destroy();
  });

  it('starts a fresh swarm when the system changes', () => {
    const field = swarmField();
    const first = field.swarm;
    field.setSystem('halvorsen');
    expect(field.swarm).not.toBe(first);
    expect(field.swarm.count).toBe(SWARM_PARTICLES);
    field.destroy();
  });
});
