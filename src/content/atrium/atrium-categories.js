import { freezeManifest } from './constants.js';
import { registerWikimediaCategoryResolver } from '../../sources/visual/wikimedia.js';

/**
 * Atrium-scoped Wikimedia categories.
 *
 * The shared provider registry offers GENRES ("Old Masters",
 * "Botanical Flora"). An Atrium reading wants its SUBJECT: Plato in
 * art while reading the Divided Line, the Bastille while reading the
 * Declaration of the Rights of Man.
 *
 * These categories are Atrium content, not general app settings. They
 * are namespaced `atr-` so they can never collide with a provider id,
 * and they are deliberately NOT offered in the Visual panel's
 * Collections list — a reader browsing categories should not find
 * "Toussaint Louverture" as a generic option. They arrive only with
 * the launch that curated them.
 *
 * ⚠ DEPRECATED — being replaced by the pinned-works imagery service.
 * See ATRIUM-IMAGERY-SPEC.md and src/content/atrium/imagery/.
 *
 * A live audit (2026-07-21) established that this approach is
 * structurally unsound, not merely miscounted. Commons categories are
 * FILING, not curation: "Category:Thomas Paine" correctly includes his
 * death mask, a modern pub sign bearing his name, and a NASA Apollo 13
 * staff photo tagged for a Rights of Man quotation. Measured
 * on-subject rates ran as low as 6 usable images of 11 (Stoicism,
 * whose pool includes a Balinese toddler and children's picture
 * books) and 18 of 44 (US Declaration, including archive-sleepover
 * event photos).
 *
 * Worse, the failure is not reliably measurable: `atr-james-watt`
 * scores clean on every automated metric available and is still poor
 * on sight. Filename plausibility is not image quality.
 *
 * The `probedFiles` counts below recorded files RETURNED, never
 * files SUITABLE, and Commons is mutable so they drift regardless.
 * They are retained only as a historical record of the probe and must
 * not be read as a quality claim.
 *
 * Note the Commons convention this exploits: depicted historical
 * figures live under "<Name> in art", while events and objects use
 * their own name. Container categories (Socrates, Plato) hold only
 * subcategories and would yield nothing — hence "Plato in art".
 */
/**
 * Atrium-scoped Wikimedia categories — RETIRED.
 *
 * The registry is empty by design. These twenty categories were live
 * keyword searches against Commons category trees, and the audit of
 * 2026-07-21 recorded in this file's history established that the
 * approach is structurally unsound rather than merely miscounted:
 * Commons categories are FILING, not curation. "Category:Thomas Paine"
 * correctly includes his death mask, a modern pub sign bearing his
 * name, and a NASA Apollo 13 staff photo tagged for a Rights of Man
 * quotation.
 *
 * A second audit (2026-07-28) confirmed it and found the failure hides
 * from measurement. By file type these pools look strong — Plato in art
 * scores 91% raster, Marcus Aurelius 93% — but the rasters are coins,
 * genealogical charts, a Brussels building facade, an Esperanto book
 * cover, and a Wellcome engraving of a woman with a bird on her head.
 * The earlier audit put it exactly: FILENAME PLAUSIBILITY IS NOT IMAGE
 * QUALITY, and atr-james-watt scores clean on every automated metric
 * available while remaining poor on sight.
 *
 * CURATION-ONLY (SOURCE-CURATION-SPEC): every image the system can show
 * is a work someone chose. The successor already exists and is the only
 * survivor — src/content/atrium/imagery/collections.js holds eleven
 * PINNED collections naming museum accessions with artist, title, and
 * date (David's Death of Socrates, Testa's Plato's Symposium). The
 * cortex checks pinned collections BEFORE this resolver, so the six ids
 * that existed in both registries were already resolving to real works;
 * emptying this one removes the shadow, not the imagery.
 *
 * The module and its registration seam remain so the extension point —
 * content registering categories with a provider, the dependency arrow
 * pointing content → source and never the reverse — survives for
 * whatever is pinned next.
 */
export const ATRIUM_CATEGORIES = freezeManifest({});

/**
 * Atrium ids are namespaced so they never collide with providers. This
 * outlived the searched registry: the PINNED collections share the same
 * `atr-` namespace, so the predicate still answers for real imagery.
 */
export function isAtriumCategoryId(id) {
  return typeof id === 'string' && id.startsWith('atr-');
}

export function findAtriumCategory(id) {
  return ATRIUM_CATEGORIES[id] || null;
}

/**
 * Provider-shaped view of an Atrium category, for the Wikimedia
 * provider's category lookup (same shape as WIKIMEDIA_CATEGORIES).
 */
export function atriumCategoryDefinition(id) {
  const entry = ATRIUM_CATEGORIES[id];
  if (!entry) return null;
  return { name: entry.name, category: entry.category, tags: entry.tags };
}

// Content registers itself with the provider — the dependency arrow
// points content → source, never source → content. Any code path that
// can launch an atr- category (handoff, panel labels) imports this
// module first, so registration precedes resolution.
registerWikimediaCategoryResolver(atriumCategoryDefinition);
