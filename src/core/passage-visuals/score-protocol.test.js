import { describe, expect, it } from 'vitest';
import {
  VISUAL_SCORE_LIMITS,
  VISUAL_SCORE_SCHEMA_VERSION,
  validateScoreRequest,
  validateScoreResponse,
  verifyScoreRequestDigest
} from './score-protocol.js';
import { canonicalSectionDigest } from './segmentation.js';
import { TREATMENT_CATALOG_VERSION } from './treatments.js';

const hex = char => char.repeat(64);

async function request(overrides = {}) {
  const blocks = overrides.blocks || [
    { id: 'b0123456789abcdef0123', text: 'The quiet garden rests.' },
    { id: 'b1123456789abcdef0123', text: 'The storm breaks the city.' }
  ];
  return {
    schemaVersion: VISUAL_SCORE_SCHEMA_VERSION,
    sourceDigest: hex('a'),
    sectionDigest: await canonicalSectionDigest(blocks),
    treatmentCatalogVersion: TREATMENT_CATALOG_VERSION,
    blocks,
    ...overrides
  };
}

describe('visual score request', () => {
  it('accepts an exact version-1 request', async () => {
    const value = await request();
    expect(validateScoreRequest(value)).toEqual({ ok: true, request: value });
    expect(await verifyScoreRequestDigest(value)).toBe(true);
  });

  it('accepts a known previous treatment', async () => {
    expect(validateScoreRequest(await request({ previousTreatmentId: 'glacial-silk' })).ok).toBe(true);
  });

  it.each([
    ['an unknown field', { extra: true }],
    ['another schema version', { schemaVersion: 2 }],
    ['another catalog version', { treatmentCatalogVersion: 99 }],
    ['an uppercase digest', { sourceDigest: 'A'.repeat(64) }],
    ['a short digest', { sectionDigest: 'ab' }],
    ['no blocks', { blocks: [] }],
    ['nine blocks', { blocks: Array.from({ length: 9 }, (_, i) => ({ id: `b${i}`, text: 'x' })) }],
    ['duplicate ids', { blocks: [{ id: 'b1', text: 'x' }, { id: 'b1', text: 'y' }] }],
    ['an empty id', { blocks: [{ id: '', text: 'x' }] }],
    ['an unsafe id', { blocks: [{ id: 'b 1', text: 'x' }] }],
    ['an empty text', { blocks: [{ id: 'b1', text: '' }] }],
    ['an oversized block', { blocks: [{ id: 'b1', text: 'x'.repeat(2001) }] }],
    ['an oversized section', { blocks: Array.from({ length: 7 }, (_, i) => ({ id: `b${i}`, text: 'x'.repeat(1900) })) }],
    ['an extra block field', { blocks: [{ id: 'b1', text: 'x', from: 0 }] }],
    ['an unknown previous treatment', { previousTreatmentId: 'shader' }],
    ['a null previous treatment', { previousTreatmentId: null }]
  ])('refuses %s', async (_label, overrides) => {
    const result = validateScoreRequest(await request(overrides));
    expect(result.ok).toBe(false);
  });

  it('refuses non-objects', () => {
    expect(validateScoreRequest(null).ok).toBe(false);
    expect(validateScoreRequest([]).ok).toBe(false);
    expect(validateScoreRequest('x').ok).toBe(false);
  });

  it('detects a section digest that does not match the blocks', async () => {
    const value = await request({ sectionDigest: hex('b') });
    expect(validateScoreRequest(value).ok).toBe(true);
    expect(await verifyScoreRequestDigest(value)).toBe(false);
  });

  it('declares its limits', () => {
    expect(VISUAL_SCORE_LIMITS).toMatchObject({ maxBlocks: 8, maxSectionChars: 12000, maxBlockChars: 2000, maxBodyBytes: 96 * 1024 });
  });
});

describe('visual score response', () => {
  async function response(req, overrides = {}) {
    return {
      schemaVersion: 1,
      sourceDigest: req.sourceDigest,
      sectionDigest: req.sectionDigest,
      treatmentCatalogVersion: TREATMENT_CATALOG_VERSION,
      model: 'typesafe/jev-1.13',
      choices: req.blocks.map(block => ({ blockId: block.id, treatmentId: 'solar-bloom', intensityBand: 'balanced' })),
      ...overrides
    };
  }

  it('accepts exactly one valid choice per requested block', async () => {
    const req = await request();
    const result = validateScoreResponse(await response(req), req);
    expect(result.ok).toBe(true);
    expect(result.response.choices).toHaveLength(2);
  });

  it.each([
    ['a missing choice', req => ({ choices: [{ blockId: req.blocks[0].id, treatmentId: 'solar-bloom', intensityBand: 'quiet' }] })],
    ['a duplicate choice', req => ({ choices: [req.blocks[0], req.blocks[0]].map(block => ({ blockId: block.id, treatmentId: 'solar-bloom', intensityBand: 'quiet' })) })],
    ['an unknown block', req => ({ choices: [req.blocks[0], { id: 'b-other' }].map(block => ({ blockId: block.id, treatmentId: 'solar-bloom', intensityBand: 'quiet' })) })],
    ['an extra choice', req => ({ choices: [...req.blocks, { id: 'b-extra' }].map(block => ({ blockId: block.id, treatmentId: 'solar-bloom', intensityBand: 'quiet' })) })],
    ['an unknown treatment', req => ({ choices: req.blocks.map(block => ({ blockId: block.id, treatmentId: 'shader', intensityBand: 'quiet' })) })],
    ['another engine, outside Follow text', req => ({ choices: req.blocks.map(block => ({ blockId: block.id, treatmentId: 'klee-harmonic', intensityBand: 'quiet' })) })],
    ['the spectrum, which no theme colours', req => ({ choices: req.blocks.map(block => ({ blockId: block.id, treatmentId: 'prismatic-knot', intensityBand: 'quiet' })) })],
    ['an unknown band', req => ({ choices: req.blocks.map(block => ({ blockId: block.id, treatmentId: 'solar-bloom', intensityBand: 'max' })) })],
    ['executable data', req => ({ choices: req.blocks.map(block => ({ blockId: block.id, treatmentId: 'solar-bloom', intensityBand: 'quiet', code: 'x' })) })],
    ['a mismatched source digest', () => ({ sourceDigest: hex('c') })],
    ['a mismatched section digest', () => ({ sectionDigest: hex('d') })],
    ['returned reading text', () => ({ text: 'The quiet garden rests.' })],
    ['an unexpected model', () => ({ model: 'another/model' })]
  ])('refuses %s', async (_label, make) => {
    const req = await request();
    expect(validateScoreResponse(await response(req, make(req)), req).ok).toBe(false);
  });

  it('returns choices in request order', async () => {
    const req = await request();
    const reversed = await response(req);
    reversed.choices.reverse();
    const result = validateScoreResponse(reversed, req);
    expect(result.response.choices.map(choice => choice.blockId)).toEqual(req.blocks.map(block => block.id));
  });
});
