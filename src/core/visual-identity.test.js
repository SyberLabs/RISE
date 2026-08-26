import { describe, expect, it } from 'vitest';
import {
  clearLaunchVisualSelection,
  createReadingVisualIdentity,
  isLaunchHeldFocal,
  normalizeReadingVisualIdentity,
  reconcileReadingVisualIdentity,
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

  // Blueprint and Freedom were named here by hand. They left with the Atrium,
  // and normalizeVisualSelection now drops any engine the registry does not
  // know — so they are still cleared, and the next engine to be retired will
  // be too without a word said about it.
  it('clears sourced pools and retired engines while preserving ordinary procedural choices', () => {
    const cleared = clearLaunchVisualSelection({
      sourceFamily: 'blend',
      procedural: ['blueprint', 'klee', 'freedom'],
      sourced: ['dore:numbers', 'aic-oldmasters'],
      atriumCollections: ['dore:numbers']
    });

    expect(cleared).toMatchObject({
      sourceFamily: 'procedural',
      procedural: ['klee'],
      sourced: [],
      atriumCollections: []
    });
  });

  it('creates ordinary reading identity but yields to a pericope program', () => {
    expect(createReadingVisualIdentity({
      provenance: { kind: 'chapel-book', bookId: 'numbers', chapter: 2 },
      collections: ['dore:numbers'],
      hasAuthoredCollections: true
    })).toEqual({
      version: 1,
      domain: 'chapel',
      collections: ['dore:numbers']
    });

    expect(createReadingVisualIdentity({
      visualProgram: { coordinateSpace: 'scripture', segments: [{}] },
      provenance: { kind: 'chapel-book', bookId: 'matthew', chapter: 27 },
      collections: ['chapel-passion'],
      hasAuthoredCollections: true
    })).toBeNull();
    expect(createReadingVisualIdentity({
      provenance: { kind: 'chapel-book', bookId: 'numbers', chapter: 2 },
      collections: [],
      hasAuthoredCollections: false
    })).toBeNull();
  });

  it('validates persisted identity and reconciles only reading-owned Chapel sources', () => {
    expect(normalizeReadingVisualIdentity({
      version: 1,
      domain: 'chapel',
      collections: [' dore:numbers ', 'dore:numbers', '', 42]
    })).toEqual({
      version: 1,
      domain: 'chapel',
      collections: ['dore:numbers']
    });
    expect(normalizeReadingVisualIdentity({
      version: 99,
      domain: 'chapel',
      collections: ['dore:numbers']
    })).toBeNull();

    expect(reconcileReadingVisualIdentity({
      sourceFamily: 'collections',
      procedural: [],
      sourced: ['chapel-passion', 'aic-oldmasters']
    }, {
      version: 1,
      domain: 'chapel',
      collections: ['dore:numbers']
    })).toMatchObject({
      sourceFamily: 'collections',
      procedural: [],
      sourced: ['aic-oldmasters', 'dore:numbers'],
      atriumCollections: ['dore:numbers']
    });
  });
});
