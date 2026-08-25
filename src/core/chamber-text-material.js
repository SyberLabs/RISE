import { resolveChamberStreamFace } from './chamber-stream-face.js';
import { normalizeWordFill } from './visual-selection.js';

export { normalizeFitBorder } from './visual-selection.js';

const FIT_SIZE_ALIASES = new Set(['fit', 'continuous-word']);
const MASK_MODES = new Set(['same', 'pick']);

export function isVisualMaskMaterial(value) {
  return MASK_MODES.has(normalizeWordFill(value).mode);
}

export function resolveTextMaterialCapability({
  face, fontSize, chunkMode, visualMode, presentation, wordFill,
  wordFillDeclared, legacyMask = false, programOwned = false
} = {}) {
  const thick = resolveChamberStreamFace(face) === 'thick';
  const fit = FIT_SIZE_ALIASES.has(String(fontSize || '').trim().toLowerCase());
  const wordTiming = chunkMode === 'word';
  const gallery = visualMode === 'interlocution'
    && (presentation === 'continuous' || presentation === 'continuous-word');
  const declared = wordFillDeclared === true || (wordFillDeclared == null
    && wordFill != null && typeof wordFill === 'object' && !Array.isArray(wordFill));
  const materialRequestsMask = declared ? isVisualMaskMaterial(wordFill) : legacyMask === true;
  const maskRequested = materialRequestsMask && wordTiming && gallery;
  const canMask = thick && fit && wordTiming && gallery;
  const capabilityReason = !materialRequestsMask ? null
    : !wordTiming ? 'requires-word'
    : !gallery ? 'requires-gallery'
    : !thick ? 'requires-thick'
    : !fit ? 'requires-fit'
    : null;
  return {
    available: !programOwned && capabilityReason == null,
    reason: programOwned ? 'program-owned' : capabilityReason,
    correctiveAction: programOwned || capabilityReason == null ? null : 'use-thick-fit',
    canMask,
    maskRequested,
    maskActive: canMask && maskRequested,
  };
}

export function resolveFitMaskMode(input = {}) {
  return resolveTextMaterialCapability(input).maskActive;
}
