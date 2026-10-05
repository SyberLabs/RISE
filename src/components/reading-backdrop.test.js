import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const made = vi.hoisted(() => ({ attractor: [], plates: [], flames: [], gate: null, plateGate: null }));
vi.mock('../visuals/attractor.js', () => ({
  AttractorField: class {
    constructor(host, options) {
      Object.assign(this, { host, options, running: true, destroyed: false });
      this.pause = vi.fn(() => { this.running = false; });
      this.resume = vi.fn(() => { this.running = !this.destroyed; });
      this.destroy = vi.fn(() => { this.running = false; this.destroyed = true; });
      made.attractor.push(this);
    }
  }
}));
vi.mock('../visuals/plate-field.js', () => ({
  PlateField: class {
    constructor(host, options) {
      Object.assign(this, { host, options });
      for (const method of ['pause', 'resume', 'destroy']) this[method] = vi.fn();
      this.start = vi.fn(() => made.plateGate ?? Promise.resolve(true));
      made.plates.push(this);
    }
  }
}));
vi.mock('../visuals/fractal.js', () => ({
  FractalFlame: class {
    constructor(canvas) {
      this.canvas = canvas;
      this.setColorTheme = vi.fn();
      this.preload = vi.fn(() => made.gate ?? Promise.resolve());
      this.fillQueue = vi.fn(async () => {});
      this.generate = vi.fn(() => true);
      this.destroy = vi.fn();
      made.flames.push(this);
    }
  }
}));

import { mountReadingBackdrop, ReadingStage } from './reading-backdrop.js';

const decision = visualConfig => ({ config: { visualConfig, colors: { background: '#08090F', text: '#F4EEE4', accent: '#C8AE83' } } });
const reduce = matches => vi.stubGlobal('matchMedia', vi.fn(() => ({ matches })));

describe('the reading backdrop', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    for (const list of [made.attractor, made.plates, made.flames]) list.length = 0;
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
    expect(plates.options).toMatchObject({ families: ['ostensoria'], reducedMotion: true, sliceFirstPlate: true });
    expect(plates.start).toHaveBeenCalledOnce();
    backdrop.destroy();
    expect(plates.destroy).toHaveBeenCalledOnce();
  });

  it('resolves a plate mount only once its first plate, baked in slices, is drawn', async () => {
    let release;
    made.plateGate = new Promise(resolve => { release = resolve; });
    let mounted = null;
    const mounting = mountReadingBackdrop(host, decision({
      visualMode: 'interlocution', interlocution: { procedural: ['apparitio'] }
    })).then(backdrop => { mounted = backdrop; });
    await vi.waitFor(() => expect(made.plates).toHaveLength(1));
    const [plates] = made.plates;
    expect(plates.options).toMatchObject({ families: ['apparitio'], sliceFirstPlate: true });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mounted).toBeNull();
    release(true);
    made.plateGate = null;
    await mounting;
    mounted.destroy();
    expect(plates.destroy).toHaveBeenCalledOnce();
  });

  it('paints the day\'s fractal in the reading\'s colours, and turns to the next flame while running', async () => {
    vi.useFakeTimers();
    const backdrop = await mountReadingBackdrop(host, decision({
      visualMode: 'interlocution', interlocution: { procedural: ['fractal'] }
    }));
    const [flame] = made.flames;
    expect(host.contains(flame.canvas)).toBe(true);
    expect(flame.canvas.className).toBe('reading-backdrop-flame');
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

  it('keeps one fractal loop when paused and resumed, or destroyed, while the next flame loads', async () => {
    vi.useFakeTimers();
    const backdrop = await mountReadingBackdrop(host, decision({
      visualMode: 'interlocution', interlocution: { procedural: ['fractal'] }
    }));
    const [flame] = made.flames;
    let release;
    flame.fillQueue.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    await vi.advanceTimersByTimeAsync(18_000);   // the next flame starts loading
    backdrop.pause();
    backdrop.resume();
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(flame.generate).toHaveBeenCalledTimes(1);   // the overtaken load does not draw
    await vi.advanceTimersByTimeAsync(18_000);
    expect(flame.generate).toHaveBeenCalledTimes(2);   // exactly one loop goes on
    flame.fillQueue.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    await vi.advanceTimersByTimeAsync(18_000);
    backdrop.destroy();
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(flame.generate).toHaveBeenCalledTimes(2);   // nothing draws on a destroyed flame
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

describe('the reading stage', () => {
  let host;
  let stage;
  let hidden;
  const attractor = system => decision({ visualMode: 'attractor', attractor: { system } });
  const fractal = () => decision({ visualMode: 'interlocution', interlocution: { procedural: ['fractal'] } });
  const running = () => made.attractor.filter(engine => engine.running);
  const layers = () => host.querySelectorAll('.reading-stage-layer');
  const setHidden = value => {
    hidden = value;
    document.dispatchEvent(new Event('visibilitychange'));
  };
  /**
   * Hold every flame's mount open until released. Each show starts once the
   * last has reached its flame, because vitest hands concurrent first imports
   * of a mocked module the real module.
   */
  async function pending(count) {
    let release;
    made.gate = new Promise(resolve => { release = resolve; });
    const shows = [];
    for (let i = 0; i < count; i++) {
      shows.push(stage.show(fractal()));
      await vi.waitFor(() => expect(made.flames).toHaveLength(i + 1));
    }
    return () => {
      release();
      made.gate = null;
      return Promise.all(shows);
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    for (const list of [made.attractor, made.plates, made.flames]) list.length = 0;
    reduce(false);
    hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    host = document.createElement('div');
    stage = new ReadingStage(host);
  });
  afterEach(() => {
    stage.destroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete document.hidden;
  });

  it('fades the new engine in over the old, held at full strength beneath, then destroys the old', async () => {
    await stage.show(attractor('aizawa'));
    expect([...layers()].map(layer => layer.classList.contains('is-shown'))).toEqual([true]);
    await stage.show(attractor('lorenz'));
    const [old, next] = made.attractor;
    // Both layers stay shown through the fade: the old one at full opacity
    // beneath the new one, so brightness never dips.
    expect([...layers()].map(layer => layer.classList.contains('is-shown'))).toEqual([true, true]);
    expect([...layers()].map(layer => layer.contains(old.host) ? 'old' : 'next')).toEqual(['old', 'next']);
    expect(old.destroy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(899);
    expect(layers()).toHaveLength(2);
    expect(old.destroy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(old.destroy).toHaveBeenCalledOnce();
    expect(layers()).toHaveLength(1);
    expect(layers()[0].contains(next.host)).toBe(true);
    expect(running()).toEqual([next]);
  });

  it('writes the fade once: the stage hands its length to the stylesheet', () => {
    expect(host.style.getPropertyValue('--reading-stage-fade')).toBe('900ms');
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'reading-backdrop.css'), 'utf8');
    expect(css).toMatch(/\.reading-stage-layer \{[^}]*transition: opacity var\(--reading-stage-fade\)/u);
    expect(css).not.toMatch(/\d+ms/u);
    // Under reduced motion the engine swaps without a fade.
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[^@]*\.reading-stage-layer \{ transition: none/u);
  });

  it('shows the decision already showing without mounting it again', async () => {
    const shown = attractor('aizawa');
    await stage.show(shown);
    await stage.show(shown);
    expect(made.attractor).toHaveLength(1);
  });

  it('destroys a mount a newer one overtook: rapid shows end with exactly one engine', async () => {
    const settle = await pending(3);
    await settle();
    await vi.advanceTimersByTimeAsync(900);
    const [first, second, last] = made.flames;
    expect(first.destroy).toHaveBeenCalledOnce();
    expect(second.destroy).toHaveBeenCalledOnce();
    expect(last.destroy).not.toHaveBeenCalled();
    expect(layers()).toHaveLength(1);
    expect(layers()[0].contains(last.canvas)).toBe(true);
  });

  it('holds still an engine whose mount finishes after the stage was paused', async () => {
    const settle = await pending(1);
    stage.pause();
    await settle();
    const [flame] = made.flames;
    expect(flame.destroy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(flame.generate).toHaveBeenCalledOnce();
    stage.resume();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(flame.generate).toHaveBeenCalledTimes(2);
  });

  it('destroys an engine whose mount finishes after the stage was destroyed', async () => {
    const settle = await pending(1);
    stage.destroy();
    await settle();
    expect(made.flames[0].destroy).toHaveBeenCalledOnce();
    expect(host.children).toHaveLength(0);
  });

  it('runs nothing once paused mid-fade, and resumes only the engine shown', async () => {
    await stage.show(attractor('aizawa'));
    await stage.show(attractor('lorenz'));
    const [old, next] = made.attractor;
    stage.pause();
    expect(old.destroy).toHaveBeenCalledOnce();
    expect(layers()).toHaveLength(1);
    expect(running()).toEqual([]);
    stage.resume();
    expect(running()).toEqual([next]);
  });

  it('runs nothing once destroyed mid-fade', async () => {
    await stage.show(attractor('aizawa'));
    await stage.show(attractor('lorenz'));
    stage.destroy();
    expect(running()).toEqual([]);
    expect(made.attractor.every(engine => engine.destroyed)).toBe(true);
    expect(layers()).toHaveLength(0);
  });

  it('pauses in a hidden tab and resumes when it shows again, unless the page paused it', async () => {
    await stage.show(attractor('aizawa'));
    const [engine] = made.attractor;
    setHidden(true);
    expect(engine.running).toBe(false);
    setHidden(false);
    expect(engine.running).toBe(true);
    stage.pause();
    setHidden(true);
    setHidden(false);
    expect(engine.running).toBe(false);
  });

  it('swaps without a fade under reduced motion', async () => {
    reduce(true);
    await stage.show(attractor('aizawa'));
    await stage.show(attractor('lorenz'));
    expect(made.attractor[0].destroyed).toBe(true);
    expect(layers()).toHaveLength(1);
  });

  it('fades to ink for a reading with no engine, and away from it again', async () => {
    await stage.show(attractor('aizawa'));
    await stage.show(decision({ visualMode: 'off' }));
    await vi.advanceTimersByTimeAsync(900);
    expect(running()).toEqual([]);
    expect(layers()).toHaveLength(1);
    await stage.show(attractor('lorenz'));
    expect(running()).toHaveLength(1);
  });
});

describe('the reading backdrop\'s own stylesheet', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const css = name => readFileSync(join(here, name), 'utf8');

  it('drifts the fractal slowly, and holds it still under reduced motion', () => {
    const own = css('reading-backdrop.css');
    expect(own).toMatch(/\.reading-backdrop-flame\s*\{[^}]*animation:\s*reading-backdrop-drift 90s ease-in-out infinite alternate/u);
    expect(own).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.reading-backdrop-flame\s*\{\s*animation:\s*none/u);
    expect(readFileSync(join(here, 'reading-backdrop.js'), 'utf8')).toContain("import './reading-backdrop.css';");
  });
});
