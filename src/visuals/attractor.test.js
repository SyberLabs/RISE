import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  AttractorField,
  ATTRACTOR_PALETTES,
  ATTRACTOR_PALETTE_IDS,
  ATTRACTOR_FORMS,
  ATTRACTOR_SYSTEMS
} from './attractor.js';

// Brightness buckets in the renderer; quality steps consume these from
// the dim end, so the ceiling must leave real strands to draw.
const NB_BUCKETS = 7;

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
  createRadialGradient: () => ({ addColorStop: vi.fn() }),
  globalCompositeOperation: '', strokeStyle: '', fillStyle: '',
  lineWidth: 0, lineCap: '', lineJoin: ''
});

beforeEach(() => {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  window.matchMedia = window.matchMedia || (() => ({ matches: false }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(ctxStub);
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1);
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('Attractor palettes', () => {
  it('offers exactly the five selectable filament colors', () => {
    expect(ATTRACTOR_PALETTE_IDS).toEqual(['white', 'red', 'blue', 'gold', 'purple']);
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
});

describe('Attractor forms', () => {
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
    // readers classify their own computer, the field measures its own
    // cost and steps down only when it is actually missing frames.
    const field = new AttractorField(makeHost(), { form: 'kaleido' });
    expect(field.quality).toBe(0);

    // One slow frame must never degrade anything — averaged over a window
    field.measureQuality(30);
    expect(field.quality).toBe(0);

    // Sustained slowness steps down, once per window
    for (let i = 0; i < 45; i++) field.measureQuality(14);
    expect(field.quality).toBe(1);

    // And recovery restores detail when the machine frees up
    for (let i = 0; i < 45; i++) field.measureQuality(2);
    expect(field.quality).toBe(0);

    field.destroy();
  });

  it('never degrades below a legible figure, and can be opted out', () => {
    const field = new AttractorField(makeHost(), { form: 'kaleido' });
    for (let i = 0; i < 45 * 12; i++) field.measureQuality(30);
    // Bounded: the shape must always survive
    expect(field.quality).toBe(field.maxQuality);
    expect(field.maxQuality).toBeLessThan(NB_BUCKETS - 1);
    field.destroy();

    const fixed = new AttractorField(makeHost(), { form: 'kaleido', adaptive: false });
    for (let i = 0; i < 45 * 4; i++) fixed.measureQuality(40);
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
