import { freezeManifest } from '../manifest.js';
import { registerWikimediaCategoryResolver } from '../../sources/visual/wikimedia.js';

/**
 * Searched Wikimedia categories — RETIRED.
 *
 * The registry is empty by design. These twenty categories were live
 * keyword searches against Commons category trees, and two audits
 * (2026-07-21, 2026-07-28) established that the approach is
 * structurally unsound rather than merely miscounted: Commons
 * categories are FILING, not curation. "Category:Thomas Paine"
 * correctly includes his death mask, a modern pub sign, and a NASA
 * Apollo 13 staff photo tagged for a Rights of Man quotation. File-type
 * metrics still score 90%+ because the rasters are coins, genealogical
 * charts, and book covers. Filename plausibility is not image quality.
 *
 * CURATION-ONLY (SOURCE-CURATION-SPEC): every image the system can show
 * is a work someone chose. The successor is
 * src/content/imagery/collections.js — pinned museum accessions with
 * artist, title, and date. The cortex checks pinned collections BEFORE
 * this resolver; emptying this registry removed a shadow, not imagery.
 *
 * The module and its registration seam remain so the extension point —
 * content registering categories with a provider, the dependency arrow
 * pointing content → source and never the reverse — survives for
 * whatever is pinned next.
 */
export const ATRIUM_CATEGORIES = freezeManifest({});

/**
 * `atr-` ids are namespaced so they never collide with providers. The
 * PINNED collections share this namespace, so the predicate still
 * answers for real imagery.
 */
export function isAtriumCategoryId(id) {
  return typeof id === 'string' && id.startsWith('atr-');
}

/**
 * Provider-shaped view of a registered category, for the Wikimedia
 * provider's category lookup (same shape as WIKIMEDIA_CATEGORIES).
 * Always null while the registry stays empty.
 */
export function atriumCategoryDefinition(id) {
  const entry = ATRIUM_CATEGORIES[id];
  if (!entry) return null;
  return { name: entry.name, category: entry.category, tags: entry.tags };
}

// Content registers itself with the provider — the dependency arrow
// points content → source, never source → content. Any path that
// resolves an atr- id imports this module first, so registration
// precedes resolution.
registerWikimediaCategoryResolver(atriumCategoryDefinition);
