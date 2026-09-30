import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), get: vi.fn(), set: vi.fn() }));
vi.mock('@neondatabase/serverless', () => ({
  neon: () => (strings, ...values) => mocks.query(strings, ...values)
}));
vi.mock('@upstash/redis/cloudflare', () => ({
  Redis: class {
    get(key) { return mocks.get(key); }
    set(key, value, options) { return mocks.set(key, value, options); }
  }
}));

import worker from './index.mjs';
import retiredNetlify, { config as netlifyConfig } from '../netlify/functions/retired-inference.mjs';
import { RETIRED_INFERENCE_ROUTES } from './retired-inference.mjs';
import releaseInventory from '../src/content/archive/release-inventory.json';
import { readPublicCatalog } from '../src/core/decision/catalog.js';

const SITE = 'https://rise.example';
// Every credential the old routes could spend, present on purpose: a retired
// route must not touch any of them.
const LEGACY = {
  DECISION_PROVIDER: 'jev', OPENROUTER_API_KEY: 'server-openrouter-secret',
  KEV_BASE_URL: 'https://kev.example', KEV_API_KEY: 'server-kev-secret',
  KEV_REVISION: '139fdd94f1b6a6ad80cc15e08fcb99cac885a101',
  PERSONAL_PIECE_ENABLED: 'true', PERSONAL_PIECE_IP_SECRET: 'x'.repeat(40)
};
const CATALOG = {
  NEON_DATABASE_URL: 'postgresql://private.example/rise',
  UPSTASH_REDIS_REST_URL: 'https://redis.example',
  UPSTASH_REDIS_REST_TOKEN: 'redis-server-secret'
};

function environment(success = true) {
  return { ...LEGACY, ...CATALOG, DECISION_LIMITER: { limit: vi.fn(async () => ({ success })) } };
}

const books = Object.values(releaseInventory)
  .filter(item => item.editionId?.startsWith('standard-ebooks:'))
  .map(item => ({
    work_id: item.workId, title: 'A title', author: 'An author', edition_id: item.editionId,
    source_revision: item.sourceRevision, fit_description: 'A reviewed public description.',
    decision_criterion: 'Choose this for a reviewed public reason.', active: true, internal_note: 'never published'
  }));
const sounds = [{ sound_id: 'aurora', decision_criterion: 'Soft, spacious harmonics for calm reading.', active: true }];

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
    expect(mocks.query).not.toHaveBeenCalled();
    expect(env.DECISION_LIMITER.limit).not.toHaveBeenCalled();
  });

  it('answers the same retired routes on Netlify previews', async () => {
    expect([...netlifyConfig.path].sort()).toEqual([...RETIRED_INFERENCE_ROUTES].sort());
    expect((await retiredNetlify(new Request(`${SITE}/api/jev/route`, { method: 'POST' }))).status).toBe(410);
  });

  it('publishes only public catalog columns, rate limited, with no model call', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    mocks.get.mockResolvedValue(null);
    mocks.set.mockResolvedValue('OK');
    mocks.query.mockImplementation(strings => {
      const sql = strings.join('');
      if (sql.includes('rise_jev_options')) return Promise.reject(Object.assign(new Error('missing'), { code: '42P01' }));
      return Promise.resolve(sql.includes('FROM rise_sounds') ? sounds : books);
    });
    const env = environment();
    const response = await worker.fetch(new Request(`${SITE}/api/decision-catalog`, {
      headers: { 'CF-Connecting-IP': '192.0.2.1' }
    }), env);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=60');
    const text = await response.text();
    const catalog = readPublicCatalog(JSON.parse(text));
    expect(catalog.books).toHaveLength(books.length);
    expect(catalog.options).toBeNull();
    for (const secret of [LEGACY.OPENROUTER_API_KEY, LEGACY.KEV_API_KEY, LEGACY.PERSONAL_PIECE_IP_SECRET,
      ...Object.values(CATALOG), 'never published', 'private.example']) {
      expect(text).not.toContain(secret);
    }
    expect(env.DECISION_LIMITER.limit).toHaveBeenCalledWith({ key: '192.0.2.1' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rate limits the catalog before reading the database', async () => {
    const response = await worker.fetch(new Request(`${SITE}/api/decision-catalog`, {
      headers: { 'CF-Connecting-IP': '192.0.2.1' }
    }), environment(false));
    expect(response.status).toBe(429);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('fails closed without a limiter, a client address, or catalog configuration', async () => {
    const request = (ip = '192.0.2.1') => new Request(`${SITE}/api/decision-catalog`, { headers: ip ? { 'CF-Connecting-IP': ip } : {} });
    expect((await worker.fetch(request(''), environment())).status).toBe(503);
    expect((await worker.fetch(request(), { ...environment(), DECISION_LIMITER: undefined })).status).toBe(503);
    expect((await worker.fetch(request(), { ...environment(), NEON_DATABASE_URL: '' })).status).toBe(503);
    expect((await worker.fetch(new Request(`${SITE}/api/decision-catalog`, {
      method: 'POST', headers: { 'CF-Connecting-IP': '192.0.2.1' }
    }), environment())).status).toBe(405);
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
});
