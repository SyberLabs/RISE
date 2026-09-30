/**
 * Browser entry for reader-owned decisions: the public catalog from this
 * origin, the reader's connection, and one recommender for this tab.
 */
import { getConnection } from '../ai-connection.js';
import { readPublicCatalog } from './catalog.js';
import { DecisionError } from './call.js';
import { createRecommender } from './recommend.js';

export const CATALOG_PATH = '/api/decision-catalog';
const CATALOG_TTL_MS = 60_000;
let catalogCache = null;

export async function loadPublicCatalog(signal, { fetcher = fetch, now = Date.now } = {}) {
  if (catalogCache && now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.catalog;
  let response;
  try {
    response = await fetcher(CATALOG_PATH, { credentials: 'same-origin', signal, headers: { Accept: 'application/json' } });
  } catch {
    if (signal?.aborted) throw new DecisionError('CANCELED');
    throw new DecisionError('CATALOG_UNAVAILABLE', 'The reading catalog could not be loaded.');
  }
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  const catalog = response.ok ? readPublicCatalog(body) : null;
  if (!catalog) throw new DecisionError('CATALOG_UNAVAILABLE', body?.error?.message || 'The reading catalog is unavailable.');
  catalogCache = { catalog, at: now() };
  return catalog;
}

export const recommendReading = createRecommender({ loadCatalog: loadPublicCatalog, getConnection });

export function resetCatalogForTests() {
  catalogCache = null;
}
