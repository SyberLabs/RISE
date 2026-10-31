// @vitest-environment node
/**
 * The reader's anonymous event counts in the browser (src/core/telemetry.js), and the mark Home's Begin leaves for
 * the first word to be measured from (src/core/begin-steps.js).
 *
 * What is held: a count is one beacon to /api/count, sent only from rise.syberlabs.io and never from a frame; no
 * storage and no cookie is touched, nothing is kept for later, and nothing throws. The Begin mark is taken once.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { count } from './telemetry.js';
import { markBegin, takeBegin } from './begin-steps.js';

/** A page at `hostname`, framed or not, whose browser takes every beacon it is handed. */
function page({ hostname = 'rise.syberlabs.io', framed = false } = {}) {
  const sendBeacon = vi.fn(() => true);
  vi.stubGlobal('location', { hostname });
  vi.stubGlobal('top', framed ? {} : globalThis);
  vi.stubGlobal('navigator', { sendBeacon });
  return sendBeacon;
}

afterEach(() => {
  vi.unstubAllGlobals();
  takeBegin();
});

describe('a count', () => {
  it('is one beacon to /api/count: the version, the event and its fields, as JSON', async () => {
    const send = page();
    count('rise.reading.begun', { source: 'library', mode: 'stream' });
    expect(send).toHaveBeenCalledTimes(1);
    const [address, blob] = send.mock.calls[0];
    expect(address).toBe('/api/count');
    expect(blob.type).toBe('application/json');
    expect(JSON.parse(await blob.text())).toEqual({ v: 1, e: 'rise.reading.begun', f: { source: 'library', mode: 'stream' } });
  });

  it('is sent from rise.syberlabs.io alone: never a preview, the other site, a local run or a look-alike', () => {
    for (const hostname of ['rise.syberlabs.space', 'localhost', '127.0.0.1', 'rise-production.example.workers.dev', 'preview.rise.syberlabs.io', 'rise.syberlabs.io.evil.example', '']) {
      const send = page({ hostname });
      count('rise.app.failed', { class: 'unhandled' });
      expect(send, hostname).not.toHaveBeenCalled();
    }
  });

  it('is never sent from a frame: not from inside ChatGPT or Claude, nor any page that embeds RISE', () => {
    const send = page({ framed: true });
    count('rise.reading.begun', { source: 'public', mode: 'stream' });
    expect(send).not.toHaveBeenCalled();
  });

  it('touches no storage and no cookie, and keeps nothing: a beacon the browser refuses is gone', () => {
    const touched = [];
    const trap = name => new Proxy({}, { get: (_, key) => { touched.push(`${name}.${String(key)}`); return () => null; } });
    for (const name of ['localStorage', 'sessionStorage', 'indexedDB', 'caches']) vi.stubGlobal(name, trap(name));
    vi.stubGlobal('document', { get cookie() { touched.push('document.cookie'); return ''; }, set cookie(_) { touched.push('document.cookie='); } });
    const send = page();
    send.mockReturnValueOnce(false);
    count('rise.reading.ended', { end: 'no', minutes: 1.5 });
    count('rise.reading.ended', { end: 'yes', minutes: 3 });
    expect(touched).toEqual([]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.map(([, blob]) => blob.size)).toEqual([
      JSON.stringify({ v: 1, e: 'rise.reading.ended', f: { end: 'no', minutes: 1.5 } }).length,
      JSON.stringify({ v: 1, e: 'rise.reading.ended', f: { end: 'yes', minutes: 3 } }).length
    ]);
  });

  it('never throws: not for a browser without beacons, a beacon that throws, no page at all, or fields that are not JSON', () => {
    page();
    vi.stubGlobal('navigator', {});
    expect(() => count('rise.app.failed', { class: 'unhandled' })).not.toThrow();
    vi.stubGlobal('navigator', { sendBeacon: () => { throw new TypeError('Beacon refused'); } });
    expect(() => count('rise.app.failed', { class: 'unhandled' })).not.toThrow();
    const send = page();
    expect(() => count('rise.reading.first_word', { ms: 10n })).not.toThrow();
    expect(send).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    expect(() => count('rise.app.failed', { class: 'unhandled' })).not.toThrow();
  });
});

describe('the interval from Home’s Begin', () => {
  it('is taken once, from the latest press, and is nothing without one', () => {
    expect(takeBegin()).toBeNull();
    markBegin();
    markBegin();
    const latest = performance.getEntriesByName('rise:begin', 'mark').at(-1).startTime;
    const before = performance.now();
    const ms = takeBegin();
    expect(ms).toBeGreaterThanOrEqual(before - latest);
    expect(ms).toBeLessThanOrEqual(performance.now() - latest);
    expect(takeBegin()).toBeNull();
    expect(performance.getEntriesByName('rise:begin', 'mark')).toEqual([]);
  });

  it('measures nothing, and never throws, where the page has no timeline', () => {
    vi.stubGlobal('performance', {});
    expect(() => markBegin()).not.toThrow();
    expect(takeBegin()).toBeNull();
  });
});
