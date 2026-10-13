/**
 * The stage paints the attractor at the score's time, not at the moment its
 * field was made: an exported swarm or filament moves as the reading does.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ctxStub = () => new Proxy({ globalAlpha: 1 }, {
  get: (target, name) => (name in target ? target[name] : (target[name] = vi.fn(() => ({ addColorStop() {} })))),
  set: (target, name, value) => { target[name] = value; return true; }
});

let stage;
beforeEach(async () => {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  window.matchMedia = () => ({ matches: false });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(ctxStub);
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 7);
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
  await import('./chamber-stage.js');
  stage = window.__stage;
  stage.host = document.createElement('div');
  Object.defineProperty(stage.host, 'clientWidth', { value: 540 });
  Object.defineProperty(stage.host, 'clientHeight', { value: 960 });
  document.body.appendChild(stage.host);
  stage.canvas = document.createElement('canvas');
});

afterEach(async () => {
  await stage.teardown();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const paint = (config, elapsedMs) => stage.paintAttractor({ cue: { config }, elapsedMs, seed: 'take' });

describe('the stage\'s attractor', () => {
  it('turns a swarm to the score\'s time, frame after frame, with no frame loop of its own', async () => {
    await paint({ system: 'aizawa', palette: 'gold', form: 'mirror', trace: 'swarm' }, 0);
    const field = stage.painter.field;
    let early = null;
    for (let ms = 0; ms <= 2_000; ms += 1000 / 30) {
      await paint({ system: 'aizawa', palette: 'gold', form: 'mirror', trace: 'swarm' }, ms);
      if (!early && ms >= 1_000) early = Array.from(field.swarm.x.slice(0, 20));
    }
    expect(stage.painter.field).toBe(field);
    expect(Array.from(field.swarm.x.slice(0, 20))).not.toEqual(early);
    expect(field.swarmTheta).toBeCloseTo(0.6 + 0.18 * 2, 1);
    expect(field.rafId).toBeNull();
  });

  it('moves a filament with the score too', async () => {
    await paint({ system: 'aizawa', palette: 'gold', form: 'mirror' }, 0);
    const first = Array.from(stage.painter.field.sx.slice(0, 20));
    await paint({ system: 'aizawa', palette: 'gold', form: 'mirror' }, 20_000);
    expect(Array.from(stage.painter.field.sx.slice(0, 20))).not.toEqual(first);
    expect(stage.painter.field.rafId).toBeNull();
  });
});
