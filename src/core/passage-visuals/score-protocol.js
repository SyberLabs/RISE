/**
 * The version-1 contract for POST /api/jev-visual-score, shared verbatim by
 * the browser and the Worker so both sides refuse exactly the same shapes.
 *
 * Request: { schemaVersion, sourceDigest, sectionDigest,
 *            treatmentCatalogVersion, blocks: [{ id, text }],
 *            previousTreatmentId? }
 * Response: { schemaVersion, sourceDigest, sectionDigest,
 *             treatmentCatalogVersion, model,
 *             choices: [{ blockId, treatmentId, intensityBand }] }
 *
 * The response never carries reading text. Every choice is a member of a
 * finite vocabulary; nothing in it is executed or used as a parameter.
 */

import { canonicalSectionDigest } from './segmentation.js';
import { INTENSITY_BANDS, TREATMENT_CATALOG_VERSION, TREATMENT_IDS } from './treatments.js';

export const VISUAL_SCORE_SCHEMA_VERSION = 1;
export const VISUAL_SCORE_PROMPT_VERSION = 1;
export const VISUAL_SCORE_MODEL = 'typesafe/jev-1.13';
export const VISUAL_SCORE_LIMITS = Object.freeze({
  maxBlocks: 8,
  maxBlockChars: 2000,
  maxSectionChars: 12000,
  maxBodyBytes: 96 * 1024,
  maxBlockIdLength: 64
});

const DIGEST = /^[0-9a-f]{64}$/u;
const BLOCK_ID = /^[A-Za-z0-9_-]{1,64}$/u;
const MODEL = /^typesafe\/jev-1\.13(?:-\d{8})?$/u;
const REQUEST_KEYS = new Set(['schemaVersion', 'sourceDigest', 'sectionDigest',
  'treatmentCatalogVersion', 'blocks', 'previousTreatmentId']);
const RESPONSE_KEYS = new Set(['schemaVersion', 'sourceDigest', 'sectionDigest',
  'treatmentCatalogVersion', 'model', 'choices']);
const TREATMENTS = new Set(TREATMENT_IDS);

const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const refuse = code => ({ ok: false, code });

/** Structural validation of a request (synchronous; no digest work). */
export function validateScoreRequest(value) {
  if (!plain(value)) return refuse('SHAPE');
  for (const key of Object.keys(value)) if (!REQUEST_KEYS.has(key)) return refuse('UNKNOWN_FIELD');
  if (value.schemaVersion !== VISUAL_SCORE_SCHEMA_VERSION) return refuse('SCHEMA_VERSION');
  if (value.treatmentCatalogVersion !== TREATMENT_CATALOG_VERSION) return refuse('CATALOG_VERSION');
  if (typeof value.sourceDigest !== 'string' || !DIGEST.test(value.sourceDigest)
    || typeof value.sectionDigest !== 'string' || !DIGEST.test(value.sectionDigest)) return refuse('DIGEST');
  if (Object.hasOwn(value, 'previousTreatmentId') && !TREATMENTS.has(value.previousTreatmentId)) {
    return refuse('PREVIOUS_TREATMENT');
  }
  const blocks = value.blocks;
  if (!Array.isArray(blocks) || blocks.length < 1 || blocks.length > VISUAL_SCORE_LIMITS.maxBlocks) {
    return refuse('BLOCK_COUNT');
  }
  const ids = new Set();
  let total = 0;
  for (const block of blocks) {
    if (!plain(block) || Object.keys(block).length !== 2
      || typeof block.id !== 'string' || !BLOCK_ID.test(block.id) || ids.has(block.id)
      || typeof block.text !== 'string' || !block.text.length
      || block.text.length > VISUAL_SCORE_LIMITS.maxBlockChars) return refuse('BLOCK');
    ids.add(block.id);
    total += block.text.length;
  }
  if (total > VISUAL_SCORE_LIMITS.maxSectionChars) return refuse('SECTION_SIZE');
  return { ok: true, request: value };
}

/** The Worker recomputes the section digest from the submitted blocks. */
export async function verifyScoreRequestDigest(request) {
  return (await canonicalSectionDigest(request.blocks)) === request.sectionDigest;
}

/**
 * Validate a response against the exact request it answers. Requires one
 * valid choice per requested block and returns them in request order.
 */
export function validateScoreResponse(value, request) {
  if (!plain(value)) return refuse('SHAPE');
  for (const key of Object.keys(value)) if (!RESPONSE_KEYS.has(key)) return refuse('UNKNOWN_FIELD');
  if (value.schemaVersion !== VISUAL_SCORE_SCHEMA_VERSION
    || value.treatmentCatalogVersion !== TREATMENT_CATALOG_VERSION) return refuse('VERSION');
  if (value.sourceDigest !== request.sourceDigest || value.sectionDigest !== request.sectionDigest) {
    return refuse('IDENTITY');
  }
  if (typeof value.model !== 'string' || !MODEL.test(value.model)) return refuse('MODEL');
  const choices = value.choices;
  if (!Array.isArray(choices) || choices.length !== request.blocks.length) return refuse('CHOICE_COUNT');
  const byBlock = new Map();
  for (const choice of choices) {
    if (!plain(choice) || Object.keys(choice).length !== 3
      || typeof choice.blockId !== 'string' || byBlock.has(choice.blockId)
      || !TREATMENTS.has(choice.treatmentId)
      || !Object.hasOwn(INTENSITY_BANDS, choice.intensityBand)) return refuse('CHOICE');
    byBlock.set(choice.blockId, choice);
  }
  const ordered = [];
  for (const block of request.blocks) {
    const choice = byBlock.get(block.id);
    if (!choice) return refuse('CHOICE_BLOCK');
    ordered.push(Object.freeze({
      blockId: block.id, treatmentId: choice.treatmentId, intensityBand: choice.intensityBand
    }));
  }
  return {
    ok: true,
    response: Object.freeze({
      schemaVersion: VISUAL_SCORE_SCHEMA_VERSION,
      sourceDigest: value.sourceDigest,
      sectionDigest: value.sectionDigest,
      treatmentCatalogVersion: TREATMENT_CATALOG_VERSION,
      model: value.model,
      choices: Object.freeze(ordered)
    })
  };
}
