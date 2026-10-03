import { afterEach, describe, expect, it, vi } from 'vitest';
import { params } from '../../vendor/syber/syber-sigil.js';
import { drawMandala, foldMatrices } from './mandala.js';

const apply = ({ c, s, m }, x, y) => [m * x * c - y * s, m * x * s + y * c];

describe('foldMatrices', () => {
  it('turns by equal steps and mirrors every other fold', () => {
    const folds = foldMatrices(4);
    expect(folds).toHaveLength(4);
    expect(apply(folds[0], 1, 0).map(v => +v.toFixed(6))).toEqual([1, 0]);
    expect(apply(folds[1], 1, 0).map(v => Math.abs(+v.toFixed(6)))).toEqual([0, 1]);
    expect(apply(folds[2], 1, 0).map(v => +v.toFixed(6))).toEqual([-1, 0]);
    expect(folds.map(f => f.m)).toEqual([1, -1, 1, -1]);
  });
});

describe('drawMandala', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('draws once, at once, under reduced motion and names the seed', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const raf = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { value: 64 });
    const result = drawMandala(canvas, '2026-10-03', { folds: 6 });
    expect(canvas.getContext('2d').putImageData).toHaveBeenCalledTimes(1);
    expect(raf).not.toHaveBeenCalled();
    expect(result.caption).toBe(params('2026-10-03').caption);
    expect(canvas.width).toBeGreaterThan(0);
  });

  it('draws in over frames when motion is allowed, and stops when cancelled', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    const raf = vi.fn(() => 7);
    const caf = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', caf);
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { value: 64 });
    const result = drawMandala(canvas, '2026-10-03');
    expect(raf).toHaveBeenCalledTimes(1);
    result.cancel();
    expect(caf).toHaveBeenCalledWith(7);
  });

  it('returns null without a 2D canvas', () => {
    expect(drawMandala({ clientWidth: 10, getContext: () => null }, 'x')).toBeNull();
  });
});
