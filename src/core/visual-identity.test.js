import { describe, expect, it } from 'vitest';
import {
  clearLaunchVisualSelection,
  isLaunchHeldFocal,
  releaseLaunchHeldFocal
} from './visual-identity.js';

describe('launch-scoped visual identity', () => {
  it('releases Chapel-held Icon/Rose focals but preserves user-owned focals', () => {
    expect(isLaunchHeldFocal({ type: 'icon' })).toBe(true);
    expect(releaseLaunchHeldFocal({
      type: 'icon',
      iconId: 'icon-transfiguration',
      standardGlyph: 'spiral'
    })).toMatchObject({
      type: 'standard',
      standardGlyph: 'spiral',
      iconId: null
    });
    expect(releaseLaunchHeldFocal({ type: 'rose', seed: 17 })).toMatchObject({
      type: 'standard',
      standardGlyph: 'breath',
      seed: 17
    });
    expect(releaseLaunchHeldFocal({ type: 'personal', personalImage: 'data:image/png,x' }))
      .toBeNull();
  });

  it('clears sourced and source-exclusive engines while preserving ordinary procedural choices', () => {
    const cleared = clearLaunchVisualSelection({
      sourceFamily: 'blend',
      procedural: ['blueprint', 'klee', 'freedom'],
      sourced: ['dore:numbers', 'aic-oldmasters'],
      atriumCollections: ['dore:numbers'],
      blueprintMechanism: 'beam-engine',
      freedomRelation: 'haiti-france'
    });

    expect(cleared).toMatchObject({
      sourceFamily: 'procedural',
      procedural: ['klee'],
      sourced: [],
      atriumCollections: [],
      blueprintMechanism: null,
      freedomRelation: null
    });
  });
});
