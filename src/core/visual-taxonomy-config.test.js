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
    expect(configPatch(selectionFromConfig({ visualMode: 'off' }))).toEqual({ visualMode: 'off' });
  });

  it('focal keeps its glyph across the round trip', () => {
    const sel = selectionFromConfig({ visualMode: 'focals', focals: { standardGlyph: 'lotus' } });
    expect([...sel.enabled]).toEqual(['focal']);
    const back = configPatch(sel);
    expect(back.visualMode).toBe('focals');
    expect(back.focals.standardGlyph).toBe('lotus');
  });

  it('attractor keeps its whole bench', () => {
    const cfg = { visualMode: 'attractor', attractor: { system: 'thomas', palette: 'gold', form: 'kaleido' } };
    const back = configPatch(selectionFromConfig(cfg));
    expect(back.visualMode).toBe('attractor');
    expect(back.attractor).toMatchObject({ system: 'thomas', palette: 'gold', form: 'kaleido' });
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
});

describe('a field-choice patch touches only its own fields', () => {
  it('never carries pace, living text, or word settings', () => {
    const patch = configPatch(selectionFromConfig({ visualMode: 'attractor', attractor: {} }));
    expect(patch).not.toHaveProperty('livingText');
    expect(patch).not.toHaveProperty('wordFill');
    expect(Object.keys(patch).sort()).toEqual(['attractor', 'visualMode']);
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
