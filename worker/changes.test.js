import { afterEach, describe, expect, it, vi } from 'vitest';

import worker from './index.mjs';
import { CHANGES_MAX_BYTES, CHANGES_UPSTREAM, serveChangesFile } from './changes.mjs';
import { LISTED } from '../src/core/changes/listed.js';

const SITE = 'https://rise.example';
const DIGEST = '{"schema":"syberlabs.changes-digest/v1"}';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A stubbed upstream: every call is recorded, and each answers `respond()`. */
function upstream(respond = () => new Response(DIGEST, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })) {
  const fetcher = vi.fn(async () => respond());
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

const get = (path, init) => worker.fetch(new Request(`${SITE}${path}`, init), {});

describe('RISE Changes files', () => {
  it('proxies the index from the changes-data branch, cached five minutes at the edge and in the browser', async () => {
    const fetcher = upstream();
    const response = await get('/content/changes/index.json');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(DIGEST);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(`${CHANGES_UPSTREAM}index.json`);
    expect(CHANGES_UPSTREAM).toBe('https://raw.githubusercontent.com/SyberLabs/RISE/changes-data/');
    expect(init).toMatchObject({ method: 'GET', redirect: 'manual', cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': 300, '300-599': -1 } } });
  });

  it.each(['2026-10-19.json', '2026-10-19-b.json', '2026-10-19-rerun2.json'])('proxies the dated digest %s, cached a day', async (file) => {
    const fetcher = upstream();
    const response = await get(`/content/changes/${file}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=86400');
    expect(fetcher.mock.calls[0][0]).toBe(`${CHANGES_UPSTREAM}${file}`);
    expect(fetcher.mock.calls[0][1].cf.cacheTtlByStatus['200-299']).toBe(86400);
  });

  it('answers HEAD with the headers and no body', async () => {
    upstream();
    const response = await get('/content/changes/index.json', { method: 'HEAD' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await response.text()).toBe('');
  });

  it.each([
    '/content/changes/',
    '/content/changes/index.JSON',
    '/content/changes/index.json.bak',
    '/content/changes/2026-1-19.json',
    '/content/changes/2026-10-19-TOOLONGSUFFIX.json',
    '/content/changes/2026-10-19-UP.json',
    '/content/changes/2026-10-19_x.json',
    '/content/changes/README.md',
    '/content/changes/sub/index.json',
    '/content/changes/..%2Findex.json',
    '/content/changes/%2E%2E%2Fsecrets.json',
    '/content/changes/index%2Ejson',
    '/content/changes/%69ndex.json',
    '/content/changes/index.json%00',
    '/content/changes/index.json?ref=main',
    '/content/changes/2026-10-19.json?v=2',
    '/content/changes/..\\index.json'
  ])('refuses %s without asking upstream', async (path) => {
    const fetcher = upstream();
    const response = await get(path);
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).error.code).toBe('NOT_FOUND');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('never reaches upstream for a dot segment: the URL is resolved before routing', async () => {
    const fetcher = upstream();
    for (const path of ['/content/changes/../../index.json', '/content/changes/%2e%2e/%2e%2e/wrangler.production.jsonc']) {
      const response = await get(path);
      expect(response.status).toBe(404);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])('refuses %s', async (method) => {
    const fetcher = upstream();
    const response = await get('/content/changes/index.json', { method });
    expect(response.status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([404, 500, 301, 302])('answers an upstream %s with a 404 that is not cached', async (status) => {
    upstream(() => new Response(status >= 300 && status < 400 ? null : 'nope', { status, headers: status < 400 ? { Location: 'https://example.com/' } : {} }));
    const response = await get('/content/changes/2026-10-19.json');
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
  });

  it('answers an upstream that cannot be reached with a 404', async () => {
    upstream(() => { throw new TypeError('network down'); });
    const response = await get('/content/changes/index.json');
    expect(response.status).toBe(404);
  });

  it('answers an upstream whose body fails part way with a 404', async () => {
    upstream(() => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"schema":'));
        controller.error(new TypeError('connection reset'));
      }
    })));
    const response = await get('/content/changes/index.json');
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('refuses a file over the cap, by its declared length or by what it sends', async () => {
    upstream(() => new Response('{}', { headers: { 'Content-Length': String(CHANGES_MAX_BYTES + 1) } }));
    expect((await get('/content/changes/index.json')).status).toBe(404);

    const big = new Uint8Array(CHANGES_MAX_BYTES + 1).fill(0x20);
    upstream(() => new Response(new ReadableStream({
      start(controller) {
        // In pieces, with no declared length: counted as it arrives.
        for (let at = 0; at < big.length; at += 65_536) controller.enqueue(big.subarray(at, at + 65_536));
        controller.close();
      }
    })));
    const response = await get('/content/changes/index.json');
    expect(response.status).toBe(404);
    expect((await response.json()).error.message).toMatch(/256 KB/u);
  });

  it('serves a file exactly at the cap', async () => {
    const exact = new Uint8Array(CHANGES_MAX_BYTES).fill(0x20);
    upstream(() => new Response(exact));
    const response = await get('/content/changes/2026-10-19.json');
    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBe(CHANGES_MAX_BYTES);
  });

  describe('a listed team', () => {
    const TEAMS = { acme: { repo: 'acme-labs/widgets', brand: 'githits' } };
    const team = (path, init) => serveChangesFile(new Request(`${SITE}${path}`, init), TEAMS);

    it.each(['index.json', '2026-10-19.json'])('proxies %s from the team\'s own changes-data branch', async (file) => {
      const fetcher = upstream();
      const response = await team(`/content/changes/acme/${file}`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
      expect(fetcher.mock.calls[0][0]).toBe(`https://raw.githubusercontent.com/acme-labs/widgets/changes-data/${file}`);
      expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'GET', redirect: 'manual' });
    });

    it.each([
      '/content/changes/other/index.json',
      '/content/changes/Acme/index.json',
      '/content/changes/acme/',
      '/content/changes/acme/README.md',
      '/content/changes/acme/x/index.json',
      '/content/changes/acme%2Findex.json',
      '/content/changes/acme/index.json?ref=main',
      '/content/changes/constructor/index.json',
      '/content/changes/__proto__/index.json'
    ])('refuses %s without asking upstream', async (path) => {
      const fetcher = upstream();
      expect((await team(path)).status).toBe(404);
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('is a 404 at the site for a slug the site does not list', async () => {
      expect(Object.hasOwn(LISTED, 'acme')).toBe(false);
      const fetcher = upstream();
      expect((await get('/content/changes/acme/index.json')).status).toBe(404);
      expect(fetcher).not.toHaveBeenCalled();
    });
  });
});
