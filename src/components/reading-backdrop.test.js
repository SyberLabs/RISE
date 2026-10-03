import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const made = vi.hoisted(() => ({ attractor: [], plates: [], flames: [] }));
vi.mock('../visuals/attractor.js', () => ({
  AttractorField: class {
    constructor(host, options) {
      Object.assign(this, { host, options });
      for (const method of ['pause', 'resume', 'destroy']) this[method] = vi.fn();
      made.attractor.push(this);
    }
  }
}));
vi.mock('../visuals/plate-field.js', () => ({
  PlateField: class {
    constructor(host, options) {
      Object.assign(this, { host, options });
      for (const method of ['start', 'pause', 'resume', 'destroy']) this[method] = vi.fn();
      made.plates.push(this);
    }
  }
}));
vi.mock('../visuals/fractal.js', () => ({
  FractalFlame: class {
    constructor(canvas) {
      this.canvas = canvas;
      this.setColorTheme = vi.fn();
      this.preload = vi.fn(async () => {});
      this.fillQueue = vi.fn(async () => {});
      this.generate = vi.fn(() => true);
      this.destroy = vi.fn();
      made.flames.push(this);
    }
  }
}));

import { mountReadingBackdrop } from './reading-backdrop.js';

const decision = visualConfig => ({ config: { visualConfig, colors: { background: '#08090F', text: '#F4EEE4', accent: '#C8AE83' } } });
const reduce = matches => vi.stubGlobal('matchMedia', vi.fn(() => ({ matches })));

describe('the reading backdrop', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    for (const list of Object.values(made)) list.length = 0;
    reduce(false);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('runs the day\'s attractor, and pauses, resumes and ends with it', async () => {
    const backdrop = await mountReadingBackdrop(host, decision({
      visualMode: 'attractor', attractor: { system: 'aizawa', palette: 'blue', form: 'kaleido' }
    }));
    const [field] = made.attractor;
    expect(field.host).toBe(host);
    expect(field.options).toEqual({ system: 'aizawa', palette: 'blue', form: 'kaleido' });
    backdrop.pause();
    backdrop.resume();
    backdrop.destroy();
    expect(field.pause).toHaveBeenCalledOnce();
    expect(field.resume).toHaveBeenCalledOnce();
    expect(field.destroy).toHaveBeenCalledOnce();
  });

  it('runs the day\'s plate engine, still under reduced motion', async () => {
    reduce(true);
    const backdrop = await mountReadingBackdrop(host, decision({
      visualMode: 'interlocution', interlocution: { procedural: ['ostensoria'] }
    }));
    const [plates] = made.plates;
    expect(plates.options).toMatchObject({ families: ['ostensoria'], reducedMotion: true });
    expect(plates.start).toHaveBeenCalledOnce();
    backdrop.destroy();
    expect(plates.destroy).toHaveBeenCalledOnce();
  });

  it('paints the day\'s fractal in the reading\'s colours, and turns to the next flame while running', async () => {
    vi.useFakeTimers();
    const backdrop = await mountReadingBackdrop(host, decision({
      visualMode: 'interlocution', interlocution: { procedural: ['fractal'] }
    }));
    const [flame] = made.flames;
    expect(host.contains(flame.canvas)).toBe(true);
    expect(flame.setColorTheme).toHaveBeenCalledWith({ background: '#08090F', text: '#F4EEE4', accent: '#C8AE83' });
    expect(flame.generate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(flame.generate).toHaveBeenCalledTimes(2);
    backdrop.pause();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(flame.generate).toHaveBeenCalledTimes(2);
    backdrop.destroy();
    expect(flame.destroy).toHaveBeenCalledOnce();
    expect(host.contains(flame.canvas)).toBe(false);
    vi.useRealTimers();
  });

  it('holds one fractal still under reduced motion', async () => {
    vi.useFakeTimers();
    reduce(true);
    await mountReadingBackdrop(host, decision({ visualMode: 'interlocution', interlocution: { procedural: ['fractal'] } }));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(made.flames[0].generate).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('draws nothing for a reading with no engine it knows', async () => {
    expect(await mountReadingBackdrop(host, decision({ visualMode: 'off' }))).toBeNull();
    expect(host.children).toHaveLength(0);
  });
});
