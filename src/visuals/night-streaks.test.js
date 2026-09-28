import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NightStreaks } from './night-streaks.js';

function host() {
  const h = document.createElement('div');
  Object.defineProperty(h, 'clientWidth', { value: 640, configurable: true });
  Object.defineProperty(h, 'clientHeight', { value: 360, configurable: true });
  document.body.appendChild(h);
  return h;
}

let strokes;
beforeEach(() => {
  strokes = [];
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
    setTransform() {}, clearRect() {}, beginPath() {}, stroke() {},
    moveTo(x, y) { strokes.push([x, y]); }, lineTo(x, y) { strokes.push([x, y]); },
    createLinearGradient: () => ({ addColorStop() {} }),
    globalCompositeOperation: '', lineCap: '', lineWidth: 0, strokeStyle: ''
  }));
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:');
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1);
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('NightStreaks', () => {
  it('samples the same frame for the same moment (no hidden state)', () => {
    const f = new NightStreaks(host(), { speed: 2 });
    f.sampleAt(4.2); const a = strokes.slice(); strokes.length = 0;
    f.sampleAt(9); strokes.length = 0;
    f.sampleAt(4.2);
    expect(strokes).toEqual(a);
    expect(a.length).toBeGreaterThan(100);
  });

  it('keeps the loop running after a sample and stops on pause', () => {
    const f = new NightStreaks(host());
    f.sampleAt(1);
    expect(f.rafId).toBe(1);
    expect(f.pause()).toBe(true);
    expect(f.rafId).toBe(null);
  });
});
