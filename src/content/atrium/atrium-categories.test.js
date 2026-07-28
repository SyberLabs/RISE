/**
 * The Atrium's searched categories are RETIRED (SOURCE-CURATION-SPEC).
 * What these tests protect is the retirement itself and the seam that
 * outlived it: content may still register categories with a provider,
 * and the pinned-works service is the only thing that now does.
 */
import { describe, expect, it } from 'vitest';
import {
  ATRIUM_CATEGORIES,
  atriumCategoryDefinition,
  isAtriumCategoryId
} from './atrium-categories.js';
import { ATRIUM_PINNED_COLLECTIONS } from './imagery/collections.js';
import { WIKIMEDIA_CATEGORIES } from '../../sources/visual/wikimedia.js';
import { MUSEUM_CATEGORIES } from '../../sources/visual/museum.js';

describe('Atrium-scoped categories (retired)', () => {
  it('registers no searched category', () => {
    // Commons categories are FILING, not curation. Two audits found the
    // approach unsound: "Category:Thomas Paine" correctly includes a pub
    // sign and an Apollo 13 staff photo, and by file type these pools
    // still score 90%+ because the rasters are coins, genealogical
    // charts, and book covers. Filename plausibility is not image
    // quality — so no image the system shows comes from a search.
    expect(Object.keys(ATRIUM_CATEGORIES)).toEqual([]);
    expect(atriumCategoryDefinition('atr-plato-art')).toBeNull();
    expect(atriumCategoryDefinition('atr-thomas-paine')).toBeNull();
  });

  it('keeps the registration seam intact for whatever is pinned next', () => {
    // The module still exports a provider-shaped resolver and still
    // registers it. The dependency arrow runs content → source and never
    // the reverse, so retiring the DATA must not retire the SEAM.
    expect(typeof atriumCategoryDefinition).toBe('function');
    expect(atriumCategoryDefinition('atr-not-real')).toBeNull();
    expect(atriumCategoryDefinition('geometry')).toBeNull();
    expect(isAtriumCategoryId('atr-plato')).toBe(true);
    expect(isAtriumCategoryId('aic-landscapes')).toBe(false);
  });

  it('leaves the pinned collections as the only atr- imagery', () => {
    // The successor: real museum accessions, chosen with artist, title,
    // and date. These share the atr- namespace and the cortex resolves
    // them BEFORE any registered resolver, so emptying the searched
    // registry removed a shadow rather than any imagery.
    const pinned = Object.keys(ATRIUM_PINNED_COLLECTIONS);
    expect(pinned.length).toBeGreaterThan(0);
    for (const id of pinned) {
      expect(isAtriumCategoryId(id), `${id} is not atr-namespaced`).toBe(true);
      const works = ATRIUM_PINNED_COLLECTIONS[id].works;
      expect(Array.isArray(works) && works.length > 0, `${id} pins nothing`).toBe(true);
      for (const work of works) {
        expect(typeof work.source, `${id} work has no source`).toBe('string');
        expect(work.id, `${id} work has no accession id`).toBeTruthy();
      }
    }
  });

  it('never collides with a provider id', () => {
    for (const id of Object.keys(ATRIUM_PINNED_COLLECTIONS)) {
      expect(WIKIMEDIA_CATEGORIES[id]).toBeUndefined();
      expect(MUSEUM_CATEGORIES[id.replace(/^atr-/, '')]).toBeUndefined();
    }
  });

  it('stays out of the browsable registry — curation reaches readers via launches', () => {
    // A subject collection like "Toussaint Louverture" must never appear
    // in the panel's Collections list as a generic option.
    const browsable = new Set(Object.keys(WIKIMEDIA_CATEGORIES));
    for (const id of Object.keys(ATRIUM_PINNED_COLLECTIONS)) {
      expect(browsable.has(id)).toBe(false);
    }
  });
});
