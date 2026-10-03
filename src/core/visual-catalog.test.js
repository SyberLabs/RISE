import { describe, expect, it } from 'vitest';
import { ATTRACTOR_VISUAL_MANIFEST } from './visual-control-contract.js';
import { renderSupportFor } from './render/support.js';
import { LISTED_PROCEDURAL_PATTERNS } from './visual-registry.js';
import {
  VISUAL_CATALOG,
  admitCatalogVisual,
  getCatalogVisual,
  queryVisualCatalog
} from './visual-catalog.js';

describe('visual catalog metadata', () => {
  it('mirrors all nine registered identities and descriptions as specimens', () => {
    expect(VISUAL_CATALOG).toHaveLength(9);
    expect(VISUAL_CATALOG.map(({ id, name, description }) => ({ id, name, description })))
      .toEqual(LISTED_PROCEDURAL_PATTERNS.map(({ id, name, description }) => ({ id, name, description })));
    expect(VISUAL_CATALOG.every(({ specimen }) => specimen === true)).toBe(true);
  });

  it('keeps specimen support, live openings, and mutable controls separate', () => {
    expect(VISUAL_CATALOG.filter(({ liveVisual }) => liveVisual !== null).map(({ id, liveVisual }) => [id, liveVisual]))
      .toEqual([['klee', 'genesis'], ['attractor', 'attractor']]);
    expect(VISUAL_CATALOG.filter(({ mutableControls }) => mutableControls.length > 0)
      .map(({ id, mutableControls }) => [id, mutableControls]))
      .toEqual([['attractor', ['intensity']]]);
    for (const item of VISUAL_CATALOG) {
      expect(item.requires).toEqual({ canvas: true });
      expect(item.cost).toBeNull();
      if (item.id !== 'attractor') {
        expect(item.parameters).toEqual({});
        expect(item.parameterDescription).toBe('Uses fixed renderer defaults.');
        expect(renderSupportFor(`visual:procedural:${item.id}`).render).toBe('native');
      }
    }
    expect(VISUAL_CATALOG.find(({ id }) => id === 'attractor').parameters)
      .toBe(ATTRACTOR_VISUAL_MANIFEST.parameters);
    expect(VISUAL_CATALOG.find(({ id }) => id === 'attractor').parameters.intensity)
      .toEqual({ type: 'number', minimum: 0.4, maximum: 0.75, default: 0.65 });
    expect(renderSupportFor('visual:field:attractor').render).toBe('native');
    expect(renderSupportFor('visual:field:genesis').render).toBe('native');
  });

  it('freezes the catalog and all nested metadata returned by lookup', () => {
    const item = getCatalogVisual('attractor');
    expect(Object.isFrozen(VISUAL_CATALOG)).toBe(true);
    expect(Object.isFrozen(item)).toBe(true);
    expect(Object.isFrozen(item.tags)).toBe(true);
    expect(Object.isFrozen(item.requires)).toBe(true);
    expect(Object.isFrozen(item.parameters)).toBe(true);
    expect(Object.isFrozen(item.parameters.intensity)).toBe(true);
    expect(Object.isFrozen(item.mutableControls)).toBe(true);
    expect(getCatalogVisual('unknown')).toBeNull();
  });
});

describe('queryVisualCatalog', () => {
  it('matches every whitespace-separated term across normalized metadata', () => {
    expect(queryVisualCatalog({ query: 'nodes regular', capabilities: { canvas: true } })
      .map(({ id }) => id)).toEqual(['neural']);
    expect(queryVisualCatalog({ query: 'KLEE GRAPHIC', capabilities: { canvas: true } })
      .map(({ id }) => id)).toEqual(['klee']);
  });

  it('returns no results for non-string or over-200-character queries', () => {
    expect(queryVisualCatalog({ query: 12, capabilities: { canvas: true } })).toEqual([]);
    expect(queryVisualCatalog({ query: 'a'.repeat(201), capabilities: { canvas: true } })).toEqual([]);
    expect(queryVisualCatalog({ query: `Klee${' '.repeat(196)}`, capabilities: { canvas: true } })
      .map(({ id }) => id)).toEqual(['klee']);
  });

  it('fails closed for unavailable canvas unless unavailable specimens are requested', () => {
    expect(queryVisualCatalog({}).map(({ id }) => id)).toEqual([]);
    expect(queryVisualCatalog({ capabilities: { canvas: false } })).toEqual([]);
    expect(queryVisualCatalog({ capabilities: { canvas: 'yes' } })).toEqual([]);
    expect(queryVisualCatalog({ capabilities: [] })).toEqual([]);
    expect(queryVisualCatalog({ includeUnavailable: true }).map(({ id }) => id)).toHaveLength(9);
  });

  it('filters to admitted live openings when liveOnly is true', () => {
    expect(queryVisualCatalog({ capabilities: { canvas: true }, liveOnly: true })
      .map(({ id }) => id)).toEqual(['klee', 'attractor']);
    expect(queryVisualCatalog({ liveOnly: true, includeUnavailable: true })
      .map(({ id }) => id)).toEqual(['klee', 'attractor']);
  });

  it('returns immutable arrays and immutable entry metadata', () => {
    const result = queryVisualCatalog({ capabilities: { canvas: true } });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[0])).toBe(true);
  });
});

describe('admitCatalogVisual', () => {
  it('maps only the verified live aliases to existing Current names', () => {
    expect(admitCatalogVisual('klee', { canvas: true }))
      .toEqual({ status: 'accepted', id: 'klee', visual: 'genesis' });
    expect(admitCatalogVisual('attractor', { canvas: true }))
      .toEqual({ status: 'accepted', id: 'attractor', visual: 'attractor' });
  });

  it('refuses unknown and specimen-only surfaces before checking capabilities', () => {
    expect(admitCatalogVisual('unknown', {})).toEqual({ status: 'refused', code: 'UNKNOWN_VISUAL' });
    expect(admitCatalogVisual('turrell', {})).toEqual({ status: 'refused', code: 'NOT_LIVE_SURFACE' });
  });

  it.each([undefined, null, [], { canvas: false }, { canvas: 'true' }])(
    'refuses a live surface when its canvas capability record is invalid: %s',
    capabilities => {
      expect(admitCatalogVisual('attractor', capabilities))
        .toEqual({ status: 'refused', code: 'CAPABILITY_UNAVAILABLE' });
    }
  );

  it('returns immutable admission receipts', () => {
    const accepted = admitCatalogVisual('klee', { canvas: true });
    const refused = admitCatalogVisual('turrell', { canvas: true });
    expect(Object.isFrozen(accepted)).toBe(true);
    expect(Object.isFrozen(refused)).toBe(true);
  });
});
