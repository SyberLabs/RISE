/**
 * Atrium-scoped categories are corpus content: they must be
 * well-formed, namespaced away from provider ids, and invisible to
 * the general Collections browser.
 */
import { describe, expect, it } from 'vitest';
import {
  ATRIUM_CATEGORIES,
  atriumCategoryDefinition,
  isAtriumCategoryId
} from './atrium-categories.js';
import { WIKIMEDIA_CATEGORIES } from '../../sources/visual/wikimedia.js';
import { MUSEUM_CATEGORIES } from '../../sources/visual/museum.js';

describe('Atrium-scoped categories', () => {
  it('every entry is namespaced, named, and points at a Commons category', () => {
    for (const [id, entry] of Object.entries(ATRIUM_CATEGORIES)) {
      expect(isAtriumCategoryId(id), `${id} is not atr-namespaced`).toBe(true);
      expect(entry.name, `${id} has no display name`).toBeTruthy();
      expect(entry.category.startsWith('Category:'), `${id} malformed`).toBe(true);
      // Files RETURNED at probe time — deliberately not a quality claim.
      // The 2026-07-21 audit found this metric cannot express suitability
      // (see ATRIUM-IMAGERY-SPEC.md); the pinned-works service replaces it.
      expect(entry.probedFiles, `${id} unprobed`).toBeGreaterThanOrEqual(8);
    }
  });

  it('never collides with a provider id', () => {
    for (const id of Object.keys(ATRIUM_CATEGORIES)) {
      expect(WIKIMEDIA_CATEGORIES[id]).toBeUndefined();
      expect(MUSEUM_CATEGORIES[id.replace(/^atr-/, '')]).toBeUndefined();
    }
  });

  it('stays out of the browsable registry — curation reaches readers only via launches', () => {
    // The panel builds its Collections list from the provider registries.
    // A subject category like "Toussaint Louverture" must never appear
    // there as a generic option.
    const browsable = new Set(Object.keys(WIKIMEDIA_CATEGORIES));
    for (const id of Object.keys(ATRIUM_CATEGORIES)) {
      expect(browsable.has(id)).toBe(false);
    }
  });

  it('resolves to a provider-shaped definition, or null for unknown ids', () => {
    const plato = atriumCategoryDefinition('atr-plato-art');
    expect(plato).toMatchObject({
      name: 'Plato in Art',
      category: 'Category:Plato in art'
    });
    expect(Array.isArray(plato.tags)).toBe(true);
    expect(atriumCategoryDefinition('atr-not-real')).toBeNull();
    expect(atriumCategoryDefinition('geometry')).toBeNull();
  });
});
