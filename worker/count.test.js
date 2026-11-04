// @vitest-environment node
/**
 * POST /api/count, the reader's anonymous event counts (worker/count.mjs).
 *
 * What is held: every request is answered 204 with no body, whatever it was; a beacon is written only from a page of
 * this site, within its address's limit, as at most 512 bytes of JSON whose event is a reader's and whose fields are
 * exactly that event's own; the browser and the device are read from the User-Agent and nothing else of it is written;
 * numbers are fitted to their fields; nothing outside telemetry/events.json is written; and a binding that throws
 * changes nothing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import allowlist from '../telemetry/events.json' with { type: 'json' };
import worker from './index.mjs';
import { COUNT_PATH, MAX_COUNT_BYTES, admitted, browserOf, deviceOf, handleCount } from './count.mjs';
import { RELEASE } from './telemetry.mjs';

const SITE = 'https://rise.example';
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const BEGUN = { v: 1, e: 'rise.reading.begun', f: { source: 'library', mode: 'stream' } };

/** Production's two bindings: a dataset that keeps what it is given, and a limiter that admits until told not to. */
function production({ success = true } = {}) {
  const points = [];
  const limit = vi.fn(async () => ({ success }));
  return { points, limit, env: { EVENTS: { writeDataPoint: point => points.push(point) }, COUNT_LIMITER: { limit } } };
}

const beacon = (body, { headers = {}, method = 'POST', raw } = {}) => new Request(`${SITE}${COUNT_PATH}`, {
  method,
  headers: { Origin: SITE, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', 'User-Agent': CHROME, ...headers },
  ...(['GET', 'HEAD'].includes(method) ? {} : { body: raw ?? JSON.stringify(body) })
});
const bytes = async response => ({ status: response.status, headers: [...response.headers], body: await response.text() });

afterEach(() => vi.restoreAllMocks());

describe('a beacon from a page of this site', () => {
  it('is written as the event, the release, the browser and the device read from its User-Agent, then its own fields', async () => {
    const { points, env } = production();
    const response = await handleCount(beacon(BEGUN), env);
    expect(await bytes(response)).toEqual({ status: 204, headers: [], body: '' });
    expect(points).toEqual([{ indexes: ['rise.reading.begun'], blobs: ['rise.reading.begun', RELEASE, 'chrome', 'desktop', 'library', 'stream'], doubles: [1] }]);
  });

  it('is written for each of the reader’s events, and for no event of the connector’s', async () => {
    const { points, env } = production();
    for (const body of [
      BEGUN,
      { v: 1, e: 'rise.reading.ended', f: { end: 'yes', minutes: 7.5 } },
      { v: 1, e: 'rise.app.failed', f: { class: 'audio_failed' } },
      { v: 1, e: 'rise.reading.first_word', f: { ms: 1234.5 } },
      { v: 1, e: 'rise.current.admitted', f: { beats: 3, scenes: 1 } },
      { v: 1, e: 'rise.current.refused', f: { code: 'CURRENT_THEME' } }
    ]) await handleCount(beacon(body), env);
    expect(points.map(point => [point.blobs.slice(2), point.doubles])).toEqual([
      [['chrome', 'desktop', 'library', 'stream'], [1]],
      [['chrome', 'desktop', 'yes'], [1, 10]],
      [['chrome', 'desktop', 'audio_failed'], [1]],
      [['chrome', 'desktop'], [1, 1250]]
    ]);
  });

  it('reads only the browser’s family and whether it is a phone from the User-Agent', () => {
    for (const [agent, browser, device] of [
      [CHROME, 'chrome', 'desktop'],
      ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', 'chrome', 'mobile'],
      ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1', 'chrome', 'mobile'],
      ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'safari', 'mobile'],
      ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', 'safari', 'desktop'],
      ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0', 'firefox', 'desktop'],
      ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/131.0 Mobile/15E148 Safari/605.1.15', 'firefox', 'mobile'],
      ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0', 'edge', 'desktop'],
      ['Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36', 'other', 'mobile'],
      ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0', 'other', 'desktop'],
      ['Mozilla/5.0 (Linux; U; Android 4.0.3; en-us) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30', 'other', 'mobile'],
      ['curl/8.5.0', 'other', 'desktop'],
      ['', 'other', 'desktop'],
      [null, 'other', 'desktop']
    ]) {
      expect([browserOf(agent), deviceOf(agent)], String(agent)).toEqual([browser, device]);
    }
  });

  it('fits each number to its field: minutes to their buckets, the first word’s milliseconds to 50 within a minute', () => {
    const minutes = value => admitted({ v: 1, e: 'rise.reading.ended', f: { end: 'no', minutes: value } }, CHROME)?.minutes;
    const ms = value => admitted({ v: 1, e: 'rise.reading.first_word', f: { ms: value } }, CHROME)?.ms;
    expect([-3, 0, 0.5, 1, 1.01, 4, 7, 15, 25, 45, 61, 500].map(minutes)).toEqual([1, 1, 1, 1, 2, 5, 10, 20, 30, 60, 120, 120]);
    expect([-40, 0, 24, 25, 1234, 59_990, 75_000].map(ms)).toEqual([0, 0, 0, 50, 1250, 60_000, 60_000]);
    for (const value of ['5', null, true, [], {}]) {
      expect(minutes(value), JSON.stringify(value)).toBeUndefined();
      expect(ms(value), JSON.stringify(value)).toBeUndefined();
    }
  });
});

describe('anything else', () => {
  it('is dropped when it is not exactly an event of the allowlist’s with exactly its fields', async () => {
    const { points, env } = production();
    for (const body of [
      null, [], 'rise.reading.begun', { ...BEGUN, v: 2 }, { ...BEGUN, v: '1' }, { e: BEGUN.e, f: BEGUN.f }, { ...BEGUN, at: 1 },
      { ...BEGUN, e: 'rise.reading.viewed' }, { ...BEGUN, e: 'constructor' }, { ...BEGUN, e: '__proto__' }, { ...BEGUN, e: ['rise.reading.begun'] },
      { ...BEGUN, f: null }, { ...BEGUN, f: [] }, { ...BEGUN, f: { source: 'library' } }, { ...BEGUN, f: { ...BEGUN.f, title: 'Meditations' } },
      { ...BEGUN, f: { ...BEGUN.f, browser: 'chrome' } }, { ...BEGUN, f: { source: 'Library', mode: 'stream' } }, { ...BEGUN, f: { source: 'library', mode: 'scroll' } },
      { v: 1, e: 'rise.app.failed', f: { class: 'TypeError: x is undefined' } }, { v: 1, e: 'rise.reading.ended', f: { end: 'maybe', minutes: 3 } },
      { v: 1, e: 'rise.reading.ended', f: { end: 'yes', minutes: '3' } }, { v: 1, e: 'rise.reading.first_word', f: { ms: null } }
    ]) {
      expect(await bytes(await handleCount(beacon(body), env)), JSON.stringify(body)).toEqual({ status: 204, headers: [], body: '' });
    }
    expect(points).toEqual([]);
  });

  it('is dropped from any other page: no Origin, another site’s, or a near one', async () => {
    const { points, limit, env } = production();
    for (const origin of [null, 'https://evil.example', 'http://rise.example', 'https://rise.example.evil.example', 'https://rise.example:8443', 'null', '']) {
      const request = beacon(BEGUN, { headers: origin === null ? {} : { Origin: origin } });
      if (origin === null) request.headers.delete('Origin');
      expect((await handleCount(request, env)).status, String(origin)).toBe(204);
    }
    expect(points).toEqual([]);
    expect(limit).not.toHaveBeenCalled();
  });

  it('is dropped unless it is a POST', async () => {
    const { points, limit, env } = production();
    for (const method of ['GET', 'HEAD', 'PUT', 'DELETE']) expect((await handleCount(beacon(BEGUN, { method }), env)).status, method).toBe(204);
    expect(points).toEqual([]);
    expect(limit).not.toHaveBeenCalled();
  });

  it('is dropped past 512 bytes, and when it is not JSON or not UTF-8', async () => {
    expect(MAX_COUNT_BYTES).toBe(512);
    const { points, env } = production();
    const exact = JSON.stringify(BEGUN).padEnd(512, ' ');
    await handleCount(beacon(null, { raw: exact }), env);
    expect(points).toHaveLength(1);
    for (const raw of [`${exact} `, '{not json', new Uint8Array([0x7b, 0x22, 0xff, 0x22, 0x7d]), '']) await handleCount(beacon(null, { raw }), env);
    expect(points).toHaveLength(1);
  });

  it('is dropped over its address’s limit, which is charged before the body is read; and with no limiter or no address', async () => {
    const over = production({ success: false });
    for (const raw of [JSON.stringify(BEGUN), '{not json']) await handleCount(beacon(null, { raw }), over.env);
    expect(over.limit).toHaveBeenCalledTimes(2);
    expect(over.limit).toHaveBeenCalledWith({ key: 'count:192.0.2.1' });
    expect(over.points).toEqual([]);
    const { points, limit, env } = production();
    const request = beacon(BEGUN);
    request.headers.delete('CF-Connecting-IP');
    await handleCount(request, env);
    await handleCount(beacon(BEGUN), { EVENTS: env.EVENTS });
    await handleCount(beacon(BEGUN), { ...env, COUNT_LIMITER: { limit: async () => { throw new Error('the limiter is down'); } } });
    expect(limit).not.toHaveBeenCalled();
    expect(points).toEqual([]);
  });
});

describe('the answer', () => {
  it('is the same 204 with no body whether the dataset is bound, absent or throwing, and nothing is logged', async () => {
    const logs = ['log', 'info', 'warn', 'error', 'debug'].map(level => vi.spyOn(console, level).mockImplementation(() => {}));
    const { env } = production();
    const bindings = [env, { COUNT_LIMITER: env.COUNT_LIMITER }, { ...env, EVENTS: { writeDataPoint: () => { throw new Error('the dataset is down'); } } }, { ...env, EVENTS: {} }, {}, undefined];
    for (const raw of [JSON.stringify(BEGUN), '{not json', JSON.stringify({ ...BEGUN, e: 'rise.reading.viewed' })]) {
      for (const binding of bindings) expect(await bytes(await handleCount(beacon(null, { raw }), binding))).toEqual({ status: 204, headers: [], body: '' });
    }
    for (const log of logs) expect(log).not.toHaveBeenCalled();
  });

  it('is reached at /api/count on the worker, and writes only what the allowlist names', async () => {
    const { points, env } = production();
    const response = await worker.fetch(beacon({ v: 1, e: 'rise.app.failed', f: { class: 'unhandled' } }, { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' } }), env);
    expect(response.status).toBe(204);
    expect(points).toEqual([{ indexes: ['rise.app.failed'], blobs: ['rise.app.failed', RELEASE, 'safari', 'mobile', 'unhandled'], doubles: [1] }]);
    const [event, , ...values] = points[0].blobs;
    allowlist.events[event].blobs.forEach((blob, index) => expect(blob.values).toContain(values[index]));
    expect(JSON.stringify(points)).not.toMatch(/Mozilla|iPhone|192\.0\.2/u);
  });
});
