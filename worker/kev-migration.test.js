import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleJevDecision } from '../netlify/functions/jev-decision.mjs';
import worker from './index.mjs';

const env = {
  KEV_BASE_URL: 'https://kev.example', KEV_API_KEY: 'server-kev-secret',
  KEV_MODEL: 'kev-latest', KEV_REVISION: '139fdd94f1b6a6ad80cc15e08fcb99cac885a101',
  DECISION_LIMITER: { limit: async () => ({ success: true }) }
};
function request(path = '/api/jev-decision', body = {
  intent: 'Pause', feedback: '', excerpt: '', requestId: 'r1', mode: 'reading', pace: 200
}) {
  return new Request(`https://rise.example${path}`, { method: 'POST',
    headers: { Origin: 'https://rise.example', 'Content-Type': 'application/json',
      'CF-Connecting-IP': '192.0.2.1', Authorization: 'Bearer reader-typesafe-secret' },
    body: JSON.stringify(body) });
}
afterEach(() => vi.unstubAllGlobals());
describe('Kev migration', () => {
  it('uses configured Kev server credentials and records checkpoint identity', async () => {
    const fetcher = vi.fn(async () => Response.json({ model: 'kev-latest',
      answers: { reading_action: { type: 'choice', choice: 'pause' } } }, { headers: { 'x-kev-revision': env.KEV_REVISION } }));
    vi.stubGlobal('fetch', fetcher);
    const response = await worker.fetch(request(), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ action: 'pause', provider: 'Kev', revision: env.KEV_REVISION });
    expect(fetcher.mock.calls[0][0]).toBe('https://kev.example/v1/systemone');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer server-kev-secret');
    expect(fetcher.mock.calls[0][1].body).not.toContain('reader-typesafe-secret');
  });
  it.each(['KEV_BASE_URL', 'KEV_API_KEY', 'KEV_REVISION'])('fails closed without %s even with a legacy key', async (field) => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect((await handleJevDecision(request(), { ...env, [field]: '', OPENROUTER_API_KEY: 'old' })).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    { model: 'jev-latest', answers: { reading_action: { type: 'choice', choice: 'pause' } } },
    { model: 'kev-latest', answers: { reading_action: { type: 'choice', choice: 'delete' } } }
  ])('rejects wrong model identity or invalid action', async (result) => {
    vi.stubGlobal('fetch', async () => Response.json(result, { headers: { 'x-kev-revision': env.KEV_REVISION } }));
    expect((await handleJevDecision(request(), env)).status).toBe(502);
  });
  it('times out without retry or fallback on cold-start failure', async () => {
    const fetcher = vi.fn(async () => { throw new DOMException('cold start', 'TimeoutError'); });
    vi.stubGlobal('fetch', fetcher);
    expect((await handleJevDecision(request(), { ...env, OPENROUTER_API_KEY: 'old' })).status).toBe(504);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each([
    { KEV_BASE_URL: 'http://kev.example' }, { KEV_BASE_URL: 'https://kev.example/redirect' },
    { KEV_REVISION: 'main' }, { KEV_MODEL: 'jev-latest' }, { DECISION_PROVIDER: 'unknown' }
  ])('refuses unsafe or unpinned operator configuration', async (override) => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect((await handleJevDecision(request(), { ...env, ...override })).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([401, 503])('hides upstream failure details for HTTP %s', async (status) => {
    vi.stubGlobal('fetch', async () => new Response('server-kev-secret', { status }));
    const response = await handleJevDecision(request(), env);
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('server-kev-secret');
  });
  it('rejects malformed provider JSON', async () => {
    vi.stubGlobal('fetch', async () => new Response('{', { headers: { 'x-kev-revision': env.KEV_REVISION } }));
    expect((await handleJevDecision(request(), env)).status).toBe(502);
  });
  it.each([null, 'b'.repeat(40)])('rejects an unattested or different checkpoint', async (revision) => {
    vi.stubGlobal('fetch', async () => Response.json({ model: 'kev-latest',
      answers: { reading_action: { type: 'choice', choice: 'pause' } } },
    { headers: revision ? { 'x-kev-revision': revision } : {} }));
    expect((await handleJevDecision(request(), env)).status).toBe(502);
  });
  it('rate limits Scriptorium and never forwards the reader key', async () => {
    const fetcher = vi.fn(async () => Response.json({ model: 'kev-latest',
      answers: { route: { type: 'choice', choice: 'experience_program', confidence: 0.7 } } }, { headers: { 'x-kev-revision': env.KEV_REVISION } }));
    vi.stubGlobal('fetch', fetcher);
    const req = () => request('/api/jev/route', { intent: 'Read', targetWords: 800 });
    expect((await worker.fetch(req(), { ...env, DECISION_LIMITER: { limit: async () => ({ success: false }) } })).status).toBe(429);
    expect(fetcher).not.toHaveBeenCalled();
    expect((await worker.fetch(req(), env)).status).toBe(200);
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer server-kev-secret');
  });
});
