import { describe, expect, it } from 'vitest';
import source from '../../content/decision-catalog.json';
import { publicCatalog } from './catalog.js';

const validCatalogFixture = publicCatalog(source);

describe('browser catalog loader', () => {
  it('reads the catalog from the static content plane, not an API', async () => {
    const { CATALOG_PATH, loadPublicCatalog, resetCatalogForTests } = await import('./browser.js');
    resetCatalogForTests();
    expect(CATALOG_PATH).toBe('/content/catalog.json');
    const calls = [];
    const fetcher = async (url) => { calls.push(url); return { ok: true, json: async () => validCatalogFixture }; };
    await loadPublicCatalog(undefined, { fetcher });
    expect(calls).toEqual(['/content/catalog.json']);
  });
});
