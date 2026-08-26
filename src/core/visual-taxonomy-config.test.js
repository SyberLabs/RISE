/**
 * The bridge, driven both ways.
 *
 * The panel is only safe to rebuild once this mapping round-trips: a saved
 * reading must reopen as itself, and a reader's choice must reach the Chamber
 * as exactly what they chose. So the tests press config → selection → config
 * and back, on the real modes a session is saved in.
 */
import { describe, expect, it } from 'vitest';
import { normalizeVisualSelection } from './visual-selection.js';
import { classifySourced, configPatch, poolOptions, selectionFromConfig } from './visual-taxonomy-config.js';

const inter = patch => normalizeVisualSelection(patch.interlocution || {});

describe('the exclusive fields map to their modes', () => {
  it('off', () => {
    expect(configPatch(selectionFromConfig({ visualMode: 'off' }))).toMatchObject({ visualMode: 'off' });
  });

  it('focal keeps its glyph across the round trip', () => {
    const sel = selectionFromConfig({ visualMode: 'focals', focals: { standardGlyph: 'lotus' } });
    expect([...sel.enabled]).toEqual(['focal']);
    const back = configPatch(sel);
    expect(back.visualMode).toBe('focals');
    expect(back.focals.standardGlyph).toBe('lotus');
  });

  // A config stored under the retired sixth visualMode still finds its field,
  // and arrives holding every dial. Attractor is a LISTED procedural again —
  // PR #33's design, and the only shape in which it can carry a Fit mask,
  // because the fill hangs off the continuous field host that a dedicated
  // mode does not mount.
  it('migrates a stored attractor mode to a listed procedural, bench and all', () => {
    const cfg = { visualMode: 'attractor', attractor: { system: 'thomas', palette: 'gold', form: 'kaleido' } };
    const back = configPatch(selectionFromConfig(cfg));
    expect(back.visualMode).toBe('interlocution');
    expect(back.interlocution.procedural).toEqual(['attractor']);
    expect(back.interlocution.presentation).toBe('continuous');
    expect(back.interlocution.attractor).toMatchObject({ system: 'thomas', palette: 'gold', form: 'kaleido' });
  });

  it('genesis keeps preset and glass', () => {
    const cfg = { visualMode: 'genesis', genesis: { preset: 'gravitational', glass: false } };
    const back = configPatch(selectionFromConfig(cfg));
    expect(back.visualMode).toBe('genesis');
    expect(back.genesis).toMatchObject({ preset: 'gravitational', glass: false });
  });
});

describe('drawn-in-time engines take the procedural path, exclusively', () => {
  it('harmonograph is one procedural, continuous, carrying its climate', () => {
    const sel = selectionFromConfig({
      visualMode: 'interlocution',
      interlocution: { procedural: ['harmonograph'], sourced: [], harmonographClimate: 'stormViolet' }
    });
    expect([...sel.enabled]).toEqual(['harmonograph']);
    const back = configPatch(sel);
    expect(inter(back).procedural).toEqual(['harmonograph']);
    expect(inter(back).sourced).toEqual([]);
    expect(back.interlocution.presentation).toBe('continuous');
    expect(back.interlocution.harmonographClimate).toBe('stormViolet');
  });

  it('Iris (ostensoria) and Spectral (apparitio) are each a lone field', () => {
    for (const id of ['ostensoria', 'apparitio']) {
      const sel = selectionFromConfig({ visualMode: 'interlocution', interlocution: { procedural: [id] } });
      expect([...sel.enabled]).toEqual([id]);
      expect(inter(configPatch(sel)).procedural).toEqual([id]);
    }
  });
});

describe('the Gallery blends, one pool per sourced leaf', () => {
  it('classifies museum categories by manner vs subject', () => {
    expect(classifySourced('aic-impressionism')).toEqual({ leaf: 'by-manner', pool: 'aic-impressionism' });
    expect(classifySourced('aic-ships')).toEqual({ leaf: 'by-subject', pool: 'aic-ships' });
    expect(classifySourced('sci-astronomy')).toEqual({ leaf: 'science', pool: 'sci-astronomy' });
    expect(classifySourced('global-pool')).toEqual({ leaf: 'personal', pool: 'global-pool' });
    expect(classifySourced('wik-something')).toBeNull();
  });

  it('a mixed pool writes sourceFamily blend, so nothing is pruned', () => {
    const sel = selectionFromConfig({
      visualMode: 'interlocution',
      interlocution: { sourceFamily: 'blend', procedural: ['fractal'], sourced: ['aic-impressionism', 'global-pool'] }
    });
    expect([...sel.enabled].sort()).toEqual(['by-manner', 'fractal', 'personal']);
    const back = configPatch(sel);
    expect(back.interlocution.sourceFamily).toBe('blend');
    // The normalizer keeps every shelf a blend declares.
    expect(inter(back).procedural).toEqual(['fractal']);
    expect(inter(back).sourced.sort()).toEqual(['aic-impressionism', 'global-pool']);
  });

  it('a single procedural gallery source is not a blend', () => {
    const sel = selectionFromConfig({
      visualMode: 'interlocution',
      interlocution: { sourceFamily: 'procedural', procedural: ['turrell'] }
    });
    expect([...sel.enabled]).toEqual(['turrell']);
    expect(configPatch(sel).interlocution.sourceFamily).toBe('procedural');
  });

  it('reduces a legacy multi-category leaf to one pool (decision A)', () => {
    // Two manner categories saved by an older build collapse to the first;
    // the second is dropped on this edit, as the ruling allows.
    const sel = selectionFromConfig({
      visualMode: 'interlocution',
      interlocution: { sourceFamily: 'collections', sourced: ['aic-impressionism', 'aic-ukiyoe'] }
    });
    expect([...sel.enabled]).toEqual(['by-manner']);
    expect(sel.pool['by-manner']).toBe('aic-impressionism');
    expect(inter(configPatch(sel)).sourced).toEqual(['aic-impressionism']);
  });

  it('preserves reading-curated collections that are not Navigator pool choices', () => {
    const cfg = {
      visualMode: 'interlocution',
      interlocution: {
        sourceFamily: 'collections',
        sourced: ['dore:numbers'],
        atriumCollections: ['dore:numbers'],
        presentation: 'continuous'
      }
    };

    const selection = selectionFromConfig(cfg);
    expect([...selection.enabled]).toEqual([]);
    expect(selection.preserveBaseSelection).toBe(true);
    expect(configPatch(selection).interlocution).toMatchObject({
      sourced: ['dore:numbers'],
      atriumCollections: ['dore:numbers']
    });
  });

  it('preserves reading-curated collections beside a Navigator pool choice', () => {
    const cfg = {
      visualMode: 'interlocution',
      interlocution: {
        sourceFamily: 'collections',
        sourced: ['aic-impressionism', 'dore:numbers'],
        atriumCollections: ['dore:numbers'],
        presentation: 'continuous'
      }
    };

    const selection = selectionFromConfig(cfg);
    expect([...selection.enabled]).toEqual(['by-manner']);
    expect(configPatch(selection).interlocution).toMatchObject({
      sourced: ['aic-impressionism', 'dore:numbers'],
      atriumCollections: ['dore:numbers']
    });
  });
});

describe('the adapter emits the complete visual configuration', () => {
  it('round-trips Living Text, cadence, word ink, and unedited runtime settings', () => {
    const cfg = {
      visualMode: 'interlocution',
      livingText: { enabled: true, intensity: 0.25 },
      interlocution: {
        sourceFamily: 'blend',
        procedural: ['fractal'],
        sourced: ['aic-impressionism'],
        presentation: 'continuous',
        galleryCadence: 0.82,
        wordFill: { mode: 'pick', sourceFamily: 'procedural', procedural: ['attractor'], sourced: [], border: 'accent' },
        responsive: true,
        frequency: 0.37
      }
    };
    const patch = configPatch(selectionFromConfig(cfg));
    expect(patch.livingText).toEqual({ enabled: true, intensity: 0.25 });
    expect(patch.interlocution).toMatchObject({
      presentation: 'continuous',
      galleryCadence: 0.82,
      wordFill: { mode: 'pick', procedural: ['attractor'], sourced: [], border: 'accent' },
      responsive: true,
      frequency: 0.37
    });
  });

  it('preserves Plain word ink without adding a visual-mask border', () => {
    const patch = configPatch(selectionFromConfig({
      visualMode: 'interlocution',
      interlocution: { wordFill: { mode: 'plain' } }
    }));
    expect(patch.interlocution.wordFill).toEqual({ mode: 'plain' });
  });

  it('keeps the rich styles available while another field occupies the room', () => {
    const patch = configPatch(selectionFromConfig({
      visualMode: 'interlocution',
      attractor: { system: 'thomas', palette: 'gold', form: 'kaleido' },
      genesis: { preset: 'gravitational', glass: false },
      interlocution: { procedural: ['fractal'], presentation: 'continuous' }
    }));
    expect(patch.attractor).toEqual({ system: 'thomas', palette: 'gold', form: 'kaleido' });
    expect(patch.genesis).toEqual({ preset: 'gravitational', glass: false });
  });

  it('preserves a launch-held focal until the reader explicitly changes it', () => {
    const patch = configPatch(selectionFromConfig({
      visualMode: 'focals',
      focals: { type: 'rose', roseMode: 'verbum', standardGlyph: 'breath' }
    }));
    expect(patch.focals).toMatchObject({ type: 'rose', roseMode: 'verbum' });
  });

  it('round-trips a user-owned personal focal without converting it to a glyph', () => {
    const patch = configPatch(selectionFromConfig({
      visualMode: 'focals',
      focals: { type: 'personal', personalImage: 'data:image/png;base64,AAAA' }
    }));
    expect(patch).toMatchObject({
      visualMode: 'focals',
      focals: { type: 'personal', personalImage: 'data:image/png;base64,AAAA' }
    });
  });
});

describe('pool options for the sourced leaves', () => {
  it('splits museum categories by manner and subject, and names the personal shelves', () => {
    expect(poolOptions('by-manner').map(o => o.id)).toContain('aic-impressionism');
    expect(poolOptions('by-manner').some(o => o.id === 'aic-ships')).toBe(false);
    expect(poolOptions('by-subject').map(o => o.id)).toContain('aic-ships');
    expect(poolOptions('science')[0].id).toBe('sci-astronomy');
    expect(poolOptions('personal').map(o => o.id)).toEqual(['global-pool', 'custom']);
    expect(poolOptions('fractal')).toEqual([]);
  });
});
