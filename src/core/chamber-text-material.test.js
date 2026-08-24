import { describe, expect, it } from 'vitest';
import {
  isVisualMaskMaterial,
  resolveFitMaskMode,
  resolveTextMaterialCapability
} from './chamber-text-material.js';

describe('text material capability', () => {
  const maskSurface = {
    chunkMode: 'word', visualMode: 'interlocution', presentation: 'continuous'
  };

  it('activates a mask only for Thick Fit visual-mask material', () => {
    expect(resolveTextMaterialCapability({
      ...maskSurface, face: 'thick', fontSize: 'fit', wordFill: { mode: 'same' }
    })).toMatchObject({
      available: true, reason: null, canMask: true, maskRequested: true, maskActive: true
    });
    expect(resolveFitMaskMode({
      ...maskSurface, face: 'thick', fontSize: 'fit', wordFill: { mode: 'same' }
    })).toBe(true);
  });

  it('explains which Thick Fit requirement blocks a requested material mask', () => {
    expect(resolveTextMaterialCapability({
      ...maskSurface, face: 'display', fontSize: 'fit', wordFill: { mode: 'same' }
    })).toMatchObject({
      available: false, canMask: false, maskRequested: true, maskActive: false,
      reason: 'requires-thick', correctiveAction: 'use-thick-fit'
    });
    expect(resolveTextMaterialCapability({
      ...maskSurface, face: 'thick', fontSize: 'medium', wordFill: { mode: 'same' }
    })).toMatchObject({
      available: false, canMask: false, maskRequested: true, maskActive: false,
      reason: 'requires-fit', correctiveAction: 'use-thick-fit'
    });
  });

  it('keeps Plain and Accent as valid non-mask materials', () => {
    expect(resolveTextMaterialCapability({
      ...maskSurface, face: 'literary', fontSize: 'medium', wordFill: { mode: 'accent' }
    })).toMatchObject({
      available: true, canMask: false, maskRequested: false, maskActive: false, reason: null
    });
    expect(isVisualMaskMaterial({ mode: 'plain' })).toBe(false);
    expect(isVisualMaskMaterial({ mode: 'accent' })).toBe(false);
  });

  it('does not infer a mask from an absent material declaration', () => {
    expect(resolveTextMaterialCapability({
      ...maskSurface, face: 'thick', fontSize: 'fit'
    })).toMatchObject({ maskRequested: false, maskActive: false });
  });

  it('rejects a mask outside the Gallery surface', () => {
    expect(resolveTextMaterialCapability({
      ...maskSurface, face: 'thick', fontSize: 'fit', presentation: 'behind-stream',
      wordFill: { mode: 'same' }
    })).toMatchObject({
      available: false, maskRequested: false, maskActive: false, reason: 'requires-gallery'
    });
  });

  it('keeps authored masks active when program ownership makes the capability unavailable', () => {
    expect(resolveTextMaterialCapability({
      ...maskSurface, face: 'thick', fontSize: 'fit', wordFill: { mode: 'same' }, programOwned: true
    })).toMatchObject({
      available: false, maskActive: true, reason: 'program-owned', correctiveAction: null
    });
  });
});
