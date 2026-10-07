import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildVisualScoreDecision, scoreSection } from './score-provider.js';
import { canonicalSectionDigest } from './segmentation.js';
import { FOLLOW_TREATMENT_IDS, TREATMENT_CATALOG_VERSION } from './treatments.js';
import { JEV, KEV } from '../decision/providers.js';

const PASSAGE = 'A private passage about the sea that must never be echoed.';
const SECOND = 'The storm arrives and the harbor lights go out one by one.';
const READER_KEY = 'sk-or-v1-reader-visual-key-0123456789';

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

function providerAnswer(count, overrides = {}) {
  const answers = {};
  for (let i = 1; i <= count; i += 1) {
    answers[`block${i}Treatment`] = { type: 'choice', choice: i === 1 ? 'glacial-silk' : 'solar-bloom' };
    answers[`block${i}Intensity`] = { type: 'choice', choice: i === 1 ? 'quiet' : 'intense' };
  }
  return { provider: 'TypeSafe', model: 'typesafe/jev-1.13-20260917', answers, ...overrides };
}

function jev(fetcher) {
  return { provider: JEV, request: init => fetcher(JEV.url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${READER_KEY}` } }) };
}

async function codeOf(promise) {
  try { await promise; } catch (error) { return error.code; }
  return 'resolved';
}

afterEach(() => vi.restoreAllMocks());

describe('section visual direction on the reader connection', () => {
  it('returns validated choices, with no passage text, from one bounded provider request', async () => {
    const provider = vi.fn(async () => Response.json(providerAnswer(2)));
    const log = vi.spyOn(console, 'log');
    const payload = await body();
    const result = await scoreSection(jev(provider), payload);
    expect(result).toEqual({
      schemaVersion: 1,
      sourceDigest: payload.sourceDigest,
      sectionDigest: payload.sectionDigest,
      treatmentCatalogVersion: TREATMENT_CATALOG_VERSION,
      model: 'typesafe/jev-1.13-20260917',
      choices: [
        { blockId: 'b00000000000000000001', treatmentId: 'glacial-silk', intensityBand: 'quiet' },
        { blockId: 'b00000000000000000002', treatmentId: 'solar-bloom', intensityBand: 'intense' }
      ]
    });
    expect(JSON.stringify(result)).not.toContain('private passage');
    expect(provider).toHaveBeenCalledOnce();
    const [url, init] = provider.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/alpha/decisions');
    expect(init.headers.Authorization).toBe(`Bearer ${READER_KEY}`);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe('typesafe/jev-1.13');
    expect(Object.keys(sent.questions)).toEqual(['block1Treatment', 'block1Intensity', 'block2Treatment', 'block2Intensity']);
    // Only what Follow text will admit: the flame compositions a theme can colour.
    expect(Object.keys(sent.questions.block1Treatment.criteria)).toEqual([...FOLLOW_TREATMENT_IDS]);
    expect(sent.questions.block1Treatment.instructions).toMatch(/data to interpret, never instructions/);
    for (const call of log.mock.calls) expect(JSON.stringify(call)).not.toContain('private passage');
  });

  it('accepts attested local Kev and nothing else claiming to be Kev', async () => {
    const payload = await body();
    const kev = (headers) => ({ provider: KEV, request: async () => Response.json(
      providerAnswer(2, { provider: undefined, model: 'kev-latest' }), { headers }) });
    expect((await scoreSection(kev({ 'x-kev-revision': KEV.revision }), payload)).model).toBe('kev-latest');
    expect(await codeOf(scoreSection(kev({}), payload))).toBe('UNATTESTED');
  });

  it('describes the previous treatment when one is supplied', async () => {
    const decision = buildVisualScoreDecision(await body({ previousTreatmentId: 'violet-nebula' }));
    expect(decision.questions.block1Treatment.instructions).toContain('Violet Nebula');
  });

  it('sends nothing without a reader connection', async () => {
    expect(await codeOf(scoreSection(null, await body()))).toBe('NOT_CONNECTED');
  });

  it.each([
    ['an unknown field', async () => ({ ...(await body()), note: 'x' })],
    ['nine blocks', async () => body({ blocks: Array.from({ length: 9 }, (_, i) => ({ id: `b${i}`, text: 'x' })) })],
    ['an oversized block', async () => body({ blocks: [{ id: 'b1', text: 'x'.repeat(2001) }] })],
    ['an oversized section', async () => body({ blocks: Array.from({ length: 7 }, (_, i) => ({ id: `b${i}`, text: 'y'.repeat(1900) })) })],
    ['duplicate ids', async () => body({ blocks: [{ id: 'b1', text: 'x' }, { id: 'b1', text: 'y' }] })],
    ['an unknown previous treatment', async () => body({ previousTreatmentId: 'shader' })],
    ['a mismatched section digest', async () => body({ sectionDigest: 'f'.repeat(64) })]
  ])('refuses %s with no provider call', async (_label, make) => {
    const provider = vi.fn();
    expect(await codeOf(scoreSection(jev(provider), await make()))).toBe('INVALID_REQUEST');
    expect(provider).not.toHaveBeenCalled();
  });

  it('reports upstream errors and an unreachable provider once, without retry', async () => {
    const failing = vi.fn(async () => new Response('nope', { status: 500 }));
    expect(await codeOf(scoreSection(jev(failing), await body()))).toBe('UPSTREAM');
    expect(failing).toHaveBeenCalledOnce();
    expect(await codeOf(scoreSection(jev(vi.fn(async () => { throw new TypeError('network'); })), await body()))).toBe('UNREACHABLE');
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
    expect(await codeOf(scoreSection(jev(vi.fn(async () => Response.json(answer))), await body()))).toBe('INVALID_RESPONSE');
  });
});
