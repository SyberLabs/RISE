import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stillQueue } from './preview.js';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('the still queue', () => {
  beforeEach(() => stillQueue._reset());

  it('draws one still at a time', async () => {
    const first = deferred();
    const loadA = vi.fn(() => first.promise);
    const loadB = vi.fn(async () => 'b.webp');
    const a = stillQueue.request('a', loadA);
    const b = stillQueue.request('b', loadB);
    await flush();
    expect(loadA).toHaveBeenCalledTimes(1);
    expect(loadB).not.toHaveBeenCalled();
    first.resolve('a.webp');
    expect(await a).toBe('a.webp');
    expect(await b).toBe('b.webp');
    expect(loadB).toHaveBeenCalledTimes(1);
  });

  it('answers a repeated subject from the cache', async () => {
    const load = vi.fn(async () => 'x.webp');
    expect(await stillQueue.request('x', load)).toBe('x.webp');
    expect(await stillQueue.request('x', load)).toBe('x.webp');
    expect(stillQueue.cached('x')).toBe('x.webp');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('joins a request already waiting for the same subject', async () => {
    const load = vi.fn(async () => 'y.webp');
    const [one, two] = await Promise.all([
      stillQueue.request('y', load), stillQueue.request('y', load)
    ]);
    expect([one, two]).toEqual(['y.webp', 'y.webp']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('a failed still resolves null and does not stop the line', async () => {
    const broken = stillQueue.request('bad', async () => { throw new Error('offline'); });
    const next = stillQueue.request('good', async () => 'good.webp');
    expect(await broken).toBeNull();
    expect(await next).toBe('good.webp');
    expect(stillQueue.cached('bad')).toBeNull();
  });

  it('a network still does not wait in the line, and cannot block it', async () => {
    const hung = vi.fn(() => new Promise(() => {}));
    void stillQueue.request('remote', hung, { serial: false });
    const engine = vi.fn(async () => 'engine.webp');
    expect(await stillQueue.request('engine', engine)).toBe('engine.webp');
    expect(hung).toHaveBeenCalledTimes(1);
  });

  it('an engine render that never answers gives up and frees the line', async () => {
    vi.useFakeTimers();
    try {
      const stuck = stillQueue.request('stuck', () => new Promise(() => {}));
      const next = stillQueue.request('next', async () => 'next.webp');
      await vi.advanceTimersByTimeAsync(stillQueue.SERIAL_LIMIT_MS + 1);
      expect(await stuck).toBeNull();
      expect(await next).toBe('next.webp');
    } finally {
      vi.useRealTimers();
    }
  });

  it('prioritize moves a waiting subject to the front', async () => {
    const gate = deferred();
    const order = [];
    const running = stillQueue.request('first', () => gate.promise);
    const later = stillQueue.request('later', async () => { order.push('later'); return 'l'; });
    const focused = stillQueue.request('focused', async () => { order.push('focused'); return 'f'; });
    stillQueue.prioritize('focused');
    gate.resolve('1');
    await Promise.all([running, later, focused]);
    expect(order).toEqual(['focused', 'later']);
  });
});

describe('an abandoned still', () => {
  beforeEach(() => stillQueue._reset());

  it('is withdrawn, so asking again fetches again', async () => {
    const controller = new AbortController();
    const hung = vi.fn(() => new Promise(() => {}));
    void stillQueue.request('pool', hung, { serial: false, signal: controller.signal });
    controller.abort();
    const retry = vi.fn(async () => 'pool.webp');
    expect(await stillQueue.request('pool', retry, { serial: false })).toBe('pool.webp');
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('leaves the line without being drawn', async () => {
    const gate = deferred();
    const running = stillQueue.request('busy', () => gate.promise);
    const controller = new AbortController();
    const skipped = vi.fn(async () => 'never.webp');
    const waiting = stillQueue.request('queued', skipped, { signal: controller.signal });
    controller.abort();
    expect(await waiting).toBeNull();
    gate.resolve('busy.webp');
    await running;
    expect(skipped).not.toHaveBeenCalled();
  });
});
