import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLiveStage } from './live-stage.js';

let live = null;
let built = [];
let host = null;

const engine = id => {
  const record = { id, destroyed: false, paused: false };
  record.destroy = vi.fn(() => { record.destroyed = true; });
  built.push(record);
  return record;
};
const factories = {
  attractor: async () => engine('attractor'),
  klee: async () => engine('klee')
};
const living = () => built.filter(record => !record.destroyed);
const settle = async (ms = 0) => {
  await vi.advanceTimersByTimeAsync(ms);
  await Promise.resolve();
};

beforeEach(() => {
  vi.useFakeTimers();
  built = [];
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  live?.destroy();
  live = null;
  host.remove();
  vi.useRealTimers();
});

describe('the live stage', () => {
  it('mounts only after the reader has dwelt on a drawn visual', async () => {
    live = createLiveStage({ host, factories, dwellMs: 600, reducedMotion: () => false });
    live.focus('attractor');
    await settle(599);
    expect(built).toHaveLength(0);
    await settle(1);
    expect(living().map(r => r.id)).toEqual(['attractor']);
    expect(host.classList.contains('is-live')).toBe(true);
  });

  it('a reader passing through mounts nothing', async () => {
    live = createLiveStage({ host, factories, dwellMs: 600, reducedMotion: () => false });
    live.focus('attractor');
    await settle(300);
    live.focus('turrell');
    await settle(1000);
    expect(built).toHaveLength(0);
  });

  it('never keeps two alive at once', async () => {
    live = createLiveStage({ host, factories, dwellMs: 600, reducedMotion: () => false });
    live.focus('attractor');
    await settle(600);
    live.focus('klee');
    expect(living()).toHaveLength(0);
    expect(host.classList.contains('is-live')).toBe(false);
    await settle(600);
    expect(living().map(r => r.id)).toEqual(['klee']);
  });

  it('has nothing to draw for a visual without a live engine', async () => {
    live = createLiveStage({ host, factories, dwellMs: 600, reducedMotion: () => false });
    live.focus('fractal');
    await settle(1000);
    expect(built).toHaveLength(0);
  });

  it('draws nothing at all under reduced motion', async () => {
    live = createLiveStage({ host, factories, dwellMs: 600, reducedMotion: () => true });
    live.focus('attractor');
    await settle(1000);
    expect(built).toHaveLength(0);
  });

  it('suspend releases the engine, resume brings the focused one back', async () => {
    live = createLiveStage({ host, factories, dwellMs: 600, reducedMotion: () => false });
    live.focus('klee');
    await settle(600);
    live.suspend('sheet');
    expect(living()).toHaveLength(0);
    live.focus('attractor');
    await settle(1000);
    expect(living()).toHaveLength(0);
    live.resume('sheet');
    await settle(600);
    expect(living().map(r => r.id)).toEqual(['attractor']);
  });

  it('a hidden page releases it too', async () => {
    live = createLiveStage({ host, factories, dwellMs: 600, reducedMotion: () => false });
    live.focus('attractor');
    await settle(600);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(living()).toHaveLength(0);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await settle(600);
    expect(living()).toHaveLength(1);
  });

  it('an engine that arrives after the reader moved on is destroyed, not shown', async () => {
    let release;
    const slow = { attractor: () => new Promise(resolve => { release = () => resolve(engine('attractor')); }) };
    live = createLiveStage({ host, factories: slow, dwellMs: 600, reducedMotion: () => false });
    live.focus('attractor');
    await settle(600);
    live.focus('turrell');
    release();
    await settle(0);
    expect(built).toHaveLength(1);
    expect(living()).toHaveLength(0);
  });

  it('destroy is final and can be called twice', async () => {
    live = createLiveStage({ host, factories, dwellMs: 600, reducedMotion: () => false });
    live.focus('attractor');
    await settle(600);
    live.destroy();
    live.destroy();
    live.focus('klee');
    await settle(1000);
    expect(living()).toHaveLength(0);
  });
});
