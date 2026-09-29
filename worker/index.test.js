import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index.mjs';

const SITE = 'https://rise.example';
const input = {
  intent: 'Help me stay with this passage.',
  feedback: 'I am losing focus.',
  excerpt: 'The reader’s attention turns toward the sea.',
  requestId: 'request-123',
  mode: 'reading',
  pace: 220
};

function decisionRequest(options = {}) {
  return new Request(`${SITE}/api/jev-decision`, {
    method: 'POST',
    headers: {
      Origin: SITE,
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '192.0.2.1',
      ...options.headers
    },
    body: options.body ?? JSON.stringify(input)
  });
}

function environment(success = true) {
  return {
    DECISION_PROVIDER: 'jev',
    OPENROUTER_API_KEY: 'server-secret',
    DECISION_LIMITER: { limit: vi.fn(async () => ({ success })) }
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Cloudflare API Worker', () => {
  it('returns the validated same-origin Jev action with the Worker secret', async () => {
    const provider = vi.fn(async () => Response.json({
      model: 'typesafe/jev-1.13-20260917',
      provider: 'TypeSafe',
      answers: { reading_action: { type: 'choice', choice: 'slower' } }
    }));
    vi.stubGlobal('fetch', provider);
    const env = environment();

    const response = await worker.fetch(decisionRequest(), env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      requestId: 'request-123', action: 'slower', model: 'typesafe/jev-1.13-20260917'
    });
    expect(env.DECISION_LIMITER.limit).toHaveBeenCalledWith({ key: '192.0.2.1' });
    expect(provider).toHaveBeenCalledOnce();
    expect(provider.mock.calls[0][1].headers.Authorization).toBe('Bearer server-secret');
  });

  it('rejects a denied rate limit before contacting the provider', async () => {
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);

    const response = await worker.fetch(decisionRequest(), environment(false));

    expect(response.status).toBe(429);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([
    ['limiter', (env) => { delete env.DECISION_LIMITER; }, {}],
    ['IP', () => {}, { headers: { 'CF-Connecting-IP': '' } }],
    ['key', (env) => { delete env.OPENROUTER_API_KEY; }, {}],
    ['limiter failure', (env) => { env.DECISION_LIMITER.limit.mockRejectedValue(new Error('unavailable')); }, {}]
  ])('fails closed when %s is unavailable', async (_name, changeEnv, requestOptions) => {
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);
    const env = environment();
    changeEnv(env);

    const response = await worker.fetch(decisionRequest(requestOptions), env);

    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(provider).not.toHaveBeenCalled();
  });

  it('leaves method, origin, and body validation with the shared decision handler', async () => {
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);
    const env = environment();

    const wrongMethod = await worker.fetch(new Request(`${SITE}/api/jev-decision`, {
      method: 'GET', headers: { Origin: SITE, 'CF-Connecting-IP': '192.0.2.1' }
    }), env);
    const wrongOrigin = await worker.fetch(decisionRequest({ headers: { Origin: 'https://other.example' } }), env);
    const invalidBody = await worker.fetch(decisionRequest({ body: '{' }), env);

    expect([wrongMethod.status, wrongOrigin.status, invalidBody.status]).toEqual([405, 403, 400]);
    expect(provider).not.toHaveBeenCalled();
  });

  it('uses server-owned credentials for the explicit Jev routing rollback', async () => {
    const provider = vi.fn(async () => Response.json({
      model: 'typesafe/jev-1.13', provider: 'TypeSafe',
      answers: { route: { type: 'choice', choice: 'experience_program', confidence: 0.9 } }
    }));
    vi.stubGlobal('fetch', provider);
    const env = environment();

    const response = await worker.fetch(new Request(`${SITE}/api/jev/route`, {
      method: 'POST',
      headers: { Origin: SITE, 'CF-Connecting-IP': '192.0.2.1', Authorization: 'Bearer personal-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'Create a reading', targetWords: 800 })
    }), env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'experience_program', confidence: 0.9, model: 'typesafe/jev-1.13'
    });
    expect(provider.mock.calls[0][0]).toBe('https://openrouter.ai/api/alpha/decisions');
    expect(provider.mock.calls[0][1].headers.Authorization).toBe('Bearer server-secret');
    expect(env.DECISION_LIMITER.limit).toHaveBeenCalledOnce();
  });

  it('routes the enterprise decision through the decision provider and limiter', async () => {
    const context = {
      schema: 'rise.enterprise-context.v1',
      requestId: 'room1:1',
      evidence: { window: 'Atlas renewal price', speaker: 'presenter', mode: 'prepared' },
      structure: {
        candidates: [{ id: 'a', title: 'Atlas renewal', score: 0.9, layouts: ['quote'], layout: 'quote' }],
        rail: []
      },
      authority: { actions: ['show', 'hold', 'dismiss'] }
    };
    const enterpriseRequest = () => new Request(`${SITE}/api/enterprise-decision`, {
      method: 'POST',
      headers: { Origin: SITE, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' },
      body: JSON.stringify(context)
    });
    const fetcher = vi.fn(async () => Response.json({
      provider: 'TypeSafe', model: 'typesafe/jev-1.13',
      answers: { rail_pick: { type: 'choice', choice: 'source_1', confidence: 0.9 } }
    }));
    vi.stubGlobal('fetch', fetcher);

    expect((await worker.fetch(enterpriseRequest(), {})).status).toBe(503);
    expect((await worker.fetch(enterpriseRequest(), environment(false))).status).toBe(429);
    expect(fetcher).not.toHaveBeenCalled();

    const response = await worker.fetch(enterpriseRequest(), environment());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ requestId: 'room1:1', action: 'show', cardId: 'a', layout: 'quote' });
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

describe('Workers runtime compatibility', () => {
  it('never asks fetch for redirect "error", which the Workers runtime rejects', () => {
    // workerd throws TypeError for redirect: 'error'; mocked fetch in unit tests hides it.
    const files = ['worker', 'netlify/functions', 'server'].flatMap(dir => readdirSync(dir)
      .filter(name => /\.m?js$/.test(name) && !name.includes('.test.'))
      .map(name => `${dir}/${name}`));
    const offenders = files.filter(file => /redirect:\s*['"]error['"]/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
