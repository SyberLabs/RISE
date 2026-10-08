import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import worker from './index.mjs';
import retiredNetlify, { config as netlifyConfig } from '../netlify/functions/retired-inference.mjs';
import { RETIRED_INFERENCE_ROUTES } from './retired-inference.mjs';

const SITE = 'https://rise.example';
// Every credential the old routes could spend, present on purpose: a retired
// route must not touch any of them.
const LEGACY = {
  DECISION_PROVIDER: 'jev', OPENROUTER_API_KEY: 'server-openrouter-secret',
  KEV_BASE_URL: 'https://kev.example', KEV_API_KEY: 'server-kev-secret',
  KEV_REVISION: '139fdd94f1b6a6ad80cc15e08fcb99cac885a101',
  PERSONAL_PIECE_ENABLED: 'true', PERSONAL_PIECE_IP_SECRET: 'x'.repeat(40)
};
function environment() {
  return { ...LEGACY };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Cloudflare API Worker', () => {
  it.each(RETIRED_INFERENCE_ROUTES)('retires %s with a clear 410 and spends nothing', async (path) => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const env = environment();
    for (const method of ['POST', 'GET']) {
      const response = await worker.fetch(new Request(`${SITE}${path}`, {
        method,
        headers: { Origin: SITE, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' },
        ...(method === 'POST' ? { body: JSON.stringify({ intent: 'A thoughtful classic.', schemaVersion: 3 }) } : {})
      }), env);
      expect(response.status).toBe(410);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body = await response.json();
      expect(body.error.code).toBe('SHARED_INFERENCE_RETIRED');
      expect(body.error.message).toMatch(/OpenRouter account or run RISE locally/u);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('answers the same retired routes on Netlify previews', async () => {
    expect([...netlifyConfig.path].sort()).toEqual([...RETIRED_INFERENCE_ROUTES].sort());
    expect((await retiredNetlify(new Request(`${SITE}/api/jev/route`, { method: 'POST' }))).status).toBe(410);
  });

  it('no longer serves the catalog: it is a static file, so the route is an unknown API route', async () => {
    const response = await worker.fetch(new Request(`${SITE}/api/decision-catalog`), environment());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'API route not found.' } });
  });

  it.each([
    new Request(`${SITE}/api/unknown`, { headers: { Accept: 'application/json' } }),
    new Request(`${SITE}/api/unknown`, { headers: { Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' } })
  ])('returns JSON 404 for every unknown API request, including navigation', async (request) => {
    const response = await worker.fetch(request, environment());

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'API route not found.' } });
  });
});

describe('no shared inference credential in server code', () => {
  const serverFiles = ['worker', 'netlify/functions'].flatMap(dir => readdirSync(dir)
    .filter(name => /\.m?js$/.test(name) && !name.includes('.test.'))
    .map(name => `${dir}/${name}`));

  it('never reads a model provider credential or calls a model host', () => {
    const offenders = serverFiles.filter(file => /OPENROUTER_API_KEY|KEV_API_KEY|KEV_BASE_URL|openrouter\.ai|\/v1\/systemone/u
      .test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('never asks fetch for redirect "error", which the Workers runtime rejects', () => {
    // workerd throws TypeError for redirect: 'error'; mocked fetch in unit tests hides it.
    const offenders = serverFiles.filter(file => /redirect:\s*['"]error['"]/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  describe('frozen arena files', () => {
    const shell = () => new Response('<!DOCTYPE html>', { headers: { 'Content-Type': 'text/html' } });
    const json = () => new Response('{}', { headers: { 'Content-Type': 'application/octet-stream' } });

    it('answers a missing file with 404, never the app shell', async () => {
      const env = { ASSETS: { fetch: vi.fn(async () => shell()) } };
      const response = await worker.fetch(new Request(`${SITE}/content/arena/replay-0123456789ab.json`), env);
      expect(response.status).toBe(404);
      expect(response.headers.get('cache-control')).toBe('no-store');
    });

    it('serves a run file as immutable JSON and the index as must-revalidate', async () => {
      const env = { ASSETS: { fetch: vi.fn(async () => json()) } };
      const run = await worker.fetch(new Request(`${SITE}/content/arena/run-0123456789ab.json`), env);
      expect(run.status).toBe(200);
      expect(run.headers.get('content-type')).toBe('application/json');
      expect(run.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
      const index = await worker.fetch(new Request(`${SITE}/content/arena/index.json`), env);
      expect(index.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    });
  });
});
