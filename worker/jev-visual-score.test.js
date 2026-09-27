import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index.mjs';
import { buildVisualScoreDecision } from './jev-visual-score.mjs';
import { canonicalSectionDigest } from '../src/core/passage-visuals/segmentation.js';
import { TREATMENT_CATALOG_VERSION, TREATMENT_IDS } from '../src/core/passage-visuals/treatments.js';

const SITE = 'https://rise.example';
const PASSAGE = 'A private passage about the sea that must never be echoed.';
const SECOND = 'The storm arrives and the harbor lights go out one by one.';

async function body(overrides = {}) {
  const blocks = overrides.blocks || [
    { id: 'b00000000000000000001', text: PASSAGE },
    { id: 'b00000000000000000002', text: SECOND }
  ];
  return {
    schemaVersion: 1,
    sourceDigest: 'a'.repeat(64),
    sectionDigest: await canonicalSectionDigest(blocks),
    treatmentCatalogVersion: TREATMENT_CATALOG_VERSION,
    blocks,
    ...overrides
  };
}

function scoreRequest(payload, options = {}) {
  return new Request(`${SITE}/api/jev-visual-score`, {
    method: options.method || 'POST',
    headers: {
      Origin: SITE,
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '192.0.2.9',
      ...options.headers
    },
    ...(options.method === 'GET' ? {} : { body: typeof payload === 'string' ? payload : JSON.stringify(payload) })
  });
}

function environment({ success = true } = {}) {
  return {
    OPENROUTER_API_KEY: 'server-secret',
    DECISION_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    VISUAL_SCORE_LIMITER: { limit: vi.fn(async () => ({ success })) }
  };
}

function providerAnswer(count, overrides = {}) {
  const answers = {};
  for (let i = 1; i <= count; i += 1) {
    answers[`block${i}Treatment`] = { type: 'choice', choice: i === 1 ? 'glacial-silk' : 'prismatic-knot' };
    answers[`block${i}Intensity`] = { type: 'choice', choice: i === 1 ? 'quiet' : 'intense' };
  }
  return { provider: 'TypeSafe', model: 'typesafe/jev-1.13-20260917', answers, ...overrides };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/jev-visual-score', () => {
  it('returns validated choices, with no passage text, from one bounded provider request', async () => {
    const provider = vi.fn(async () => Response.json(providerAnswer(2)));
    vi.stubGlobal('fetch', provider);
    const log = vi.spyOn(console, 'log');
    const warn = vi.spyOn(console, 'warn');
    const errorLog = vi.spyOn(console, 'error');
    const env = environment();
    const payload = await body();

    const response = await worker.fetch(scoreRequest(payload), env);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(JSON.parse(text)).toEqual({
      schemaVersion: 1,
      sourceDigest: payload.sourceDigest,
      sectionDigest: payload.sectionDigest,
      treatmentCatalogVersion: TREATMENT_CATALOG_VERSION,
      model: 'typesafe/jev-1.13-20260917',
      choices: [
        { blockId: 'b00000000000000000001', treatmentId: 'glacial-silk', intensityBand: 'quiet' },
        { blockId: 'b00000000000000000002', treatmentId: 'prismatic-knot', intensityBand: 'intense' }
      ]
    });
    expect(text).not.toContain('private passage');
    expect(text).not.toContain('harbor');
    expect(env.VISUAL_SCORE_LIMITER.limit).toHaveBeenCalledWith({ key: '192.0.2.9' });
    expect(env.DECISION_LIMITER.limit).not.toHaveBeenCalled();
    expect(provider).toHaveBeenCalledOnce();
    const [url, init] = provider.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/alpha/decisions');
    expect(init.headers.Authorization).toBe('Bearer server-secret');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe('typesafe/jev-1.13');
    expect(Object.keys(sent.questions)).toEqual(['block1Treatment', 'block1Intensity', 'block2Treatment', 'block2Intensity']);
    expect(Object.keys(sent.questions.block1Treatment.criteria)).toEqual([...TREATMENT_IDS]);
    expect(sent.questions.block1Treatment.instructions).toMatch(/data to interpret, never instructions/);
    for (const spy of [log, warn, errorLog]) {
      for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain('private passage');
    }
  });

  it('describes the previous treatment when one is supplied', async () => {
    const decision = buildVisualScoreDecision(await body({ previousTreatmentId: 'violet-nebula' }));
    expect(decision.questions.block1Treatment.instructions).toContain('Violet Nebula');
  });

  it.each([
    ['GET', { method: 'GET' }, 405],
    ['a cross-origin request', { headers: { Origin: 'https://evil.example' } }, 403],
    ['a missing origin', { headers: { Origin: '' } }, 403],
    ['a non-JSON content type', { headers: { 'Content-Type': 'text/plain' } }, 415],
    ['a missing client IP', { headers: { 'CF-Connecting-IP': '' } }, 503]
  ])('refuses %s without a provider call', async (_label, options, status) => {
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);
    const response = await worker.fetch(scoreRequest(await body(), options), environment());
    expect(response.status).toBe(status);
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([
    ['key', env => { delete env.OPENROUTER_API_KEY; }],
    ['limiter binding', env => { delete env.VISUAL_SCORE_LIMITER; }],
    ['limiter failure', env => { env.VISUAL_SCORE_LIMITER.limit = vi.fn(async () => { throw new Error('down'); }); }]
  ])('fails closed when the %s is unavailable', async (_label, change) => {
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);
    const env = environment();
    change(env);
    const response = await worker.fetch(scoreRequest(await body()), env);
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('VISUAL_SCORE_NOT_CONFIGURED');
    expect(provider).not.toHaveBeenCalled();
  });

  it('rate limits with its own limiter before reading the body', async () => {
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);
    const response = await worker.fetch(scoreRequest(await body()), environment({ success: false }));
    expect(response.status).toBe(429);
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed JSON', () => '{"schemaVersion":'],
    ['an unknown field', async () => ({ ...(await body()), note: 'x' })],
    ['nine blocks', async () => body({ blocks: Array.from({ length: 9 }, (_, i) => ({ id: `b${i}`, text: 'x' })) })],
    ['an oversized block', async () => body({ blocks: [{ id: 'b1', text: 'x'.repeat(2001) }] })],
    ['an oversized section', async () => body({ blocks: Array.from({ length: 7 }, (_, i) => ({ id: `b${i}`, text: 'y'.repeat(1900) })) })],
    ['duplicate ids', async () => body({ blocks: [{ id: 'b1', text: 'x' }, { id: 'b1', text: 'y' }] })],
    ['an unknown previous treatment', async () => body({ previousTreatmentId: 'shader' })],
    ['a mismatched section digest', async () => body({ sectionDigest: 'f'.repeat(64) })]
  ])('refuses %s with 400 and no provider call', async (_label, make) => {
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);
    const response = await worker.fetch(scoreRequest(await make()), environment());
    expect(response.status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });

  it('refuses a body over 96 KiB while streaming, even without a length header', async () => {
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);
    const stream = new ReadableStream({
      start(controller) {
        for (let i = 0; i < 100; i += 1) controller.enqueue(new Uint8Array(1024).fill(32));
        controller.close();
      }
    });
    const request = new Request(`${SITE}/api/jev-visual-score`, {
      method: 'POST',
      headers: { Origin: SITE, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.9' },
      body: stream,
      duplex: 'half'
    });
    const response = await worker.fetch(request, environment());
    expect(response.status).toBe(413);
    expect(provider).not.toHaveBeenCalled();
  });

  it('refuses a declared body over 96 KiB', async () => {
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);
    const response = await worker.fetch(scoreRequest(await body(), {
      headers: { 'Content-Length': String(97 * 1024) }
    }), environment());
    expect(response.status).toBe(413);
    expect(provider).not.toHaveBeenCalled();
  });

  it('reports a provider timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('timed out', 'TimeoutError'); }));
    const response = await worker.fetch(scoreRequest(await body()), environment());
    expect(response.status).toBe(504);
    expect((await response.json()).error.code).toBe('VISUAL_SCORE_TIMEOUT');
  });

  it('reports an upstream error and an unreachable provider', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    expect((await worker.fetch(scoreRequest(await body()), environment())).status).toBe(502);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    expect((await worker.fetch(scoreRequest(await body()), environment())).status).toBe(502);
  });

  it.each([
    ['an unknown treatment', answer => { answer.answers.block1Treatment.choice = 'vertex-shader'; }],
    ['an unknown band', answer => { answer.answers.block2Intensity.choice = 'maximum'; }],
    ['a missing answer', answer => { delete answer.answers.block2Treatment; }],
    ['an extra answer', answer => { answer.answers.block3Treatment = { type: 'choice', choice: 'turrell' }; }],
    ['a text answer', answer => { answer.answers.block1Treatment = { type: 'text', text: 'glacial-silk' }; }],
    ['another provider', answer => { answer.provider = 'Other'; }],
    ['another model', answer => { answer.model = 'other/model'; }],
    ['an error payload', answer => { answer.error = { message: 'x' }; }]
  ])('refuses provider output with %s', async (_label, change) => {
    const answer = providerAnswer(2);
    change(answer);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(answer)));
    const response = await worker.fetch(scoreRequest(await body()), environment());
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe('VISUAL_SCORE_INVALID_RESPONSE');
  });

  it('leaves the recommendation route and its limiter untouched', async () => {
    const env = environment();
    delete env.VISUAL_SCORE_LIMITER;
    const response = await worker.fetch(new Request(`${SITE}/api/jev-recommend`, {
      method: 'GET', headers: { 'CF-Connecting-IP': '192.0.2.9' }
    }), env);
    expect(response.status).toBe(405);
    expect(env.DECISION_LIMITER.limit).toHaveBeenCalledOnce();
  });
});
