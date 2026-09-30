import { afterEach, describe, expect, it, vi } from 'vitest';
import decisionCatalog, { config } from '../netlify/functions/decision-catalog.mjs';

afterEach(() => vi.unstubAllGlobals());

describe('Netlify decision catalog proxy', () => {
  it('exposes the same-origin catalog route and proxies public JSON from the Worker', async () => {
    expect(config.path).toBe('/api/decision-catalog');
    const upstream = vi.fn(async () => Response.json({ books: [], sounds: [], options: null }, {
      headers: { 'Cache-Control': 'public, max-age=60' }
    }));
    vi.stubGlobal('fetch', upstream);

    const response = await decisionCatalog(new Request('https://rise.example/api/decision-catalog'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('public, max-age=60');
    expect(await response.json()).toEqual({ books: [], sounds: [], options: null });
    expect(upstream).toHaveBeenCalledWith('https://rise.syberlabs.io/api/decision-catalog', expect.objectContaining({
      method: 'GET', headers: { Accept: 'application/json' }, redirect: 'manual', signal: expect.any(AbortSignal)
    }));
  });

  it('refuses methods other than GET and HEAD without contacting the Worker', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);

    const response = await decisionCatalog(new Request('https://rise.example/api/decision-catalog', { method: 'POST' }));

    expect(response.status).toBe(405);
    expect(await response.json()).toMatchObject({ error: { code: 'METHOD_NOT_ALLOWED' } });
    expect(upstream).not.toHaveBeenCalled();
  });

  it('fails closed on redirects and upstream network errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 302, headers: { Location: 'https://other.example' } })));
    expect((await decisionCatalog(new Request('https://rise.example/api/decision-catalog'))).status).toBe(502);

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network failure'); }));
    const failed = await decisionCatalog(new Request('https://rise.example/api/decision-catalog'));
    expect(failed.status).toBe(503);
    expect(await failed.json()).toMatchObject({ error: { code: 'CATALOG_UNAVAILABLE' } });
  });
});
