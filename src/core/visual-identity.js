import {
  inferVisualSourceFamily,
  normalizeVisualSelection
} from './visual-selection.js';

const READING_VISUAL_IDENTITY_VERSION = 1;
const READING_VISUAL_DOMAINS = new Set(['atrium', 'chapel']);
const MAX_READING_COLLECTIONS = 64;

function normalizeCollectionIds(collections) {
  if (!Array.isArray(collections)) return [];
  return [...new Set(collections
    .filter(id => typeof id === 'string')
    .map(id => id.trim())
    .filter(id => id.length > 0 && id.length <= 160))]
    .slice(0, MAX_READING_COLLECTIONS);
}

/**
 * Validate the small piece of visual identity that belongs to a persisted
 * reading rather than to reusable visual preferences.
 *
 * A visualProgram is deliberately not represented here: it is its own
 * stronger authority and is persisted/validated through visual-program.js.
 */
export function normalizeReadingVisualIdentity(identity) {
  if (!identity || typeof identity !== 'object') return null;
  if (identity.version !== READING_VISUAL_IDENTITY_VERSION) return null;
  if (!READING_VISUAL_DOMAINS.has(identity.domain)) return null;
  return {
    version: READING_VISUAL_IDENTITY_VERSION,
    domain: identity.domain,
    collections: normalizeCollectionIds(identity.collections)
  };
}

/**
 * Create an ordinary-reading collection identity. Callers must pass
 * `hasAuthoredCollections` so a plain reading whose in-memory reset happens
 * to contain an empty array cannot accidentally acquire launch ownership.
 */
export function createReadingVisualIdentity({
  visualProgram = null,
  provenance = null,
  origin = null,
  collections = null,
  hasAuthoredCollections = false
} = {}) {
  if (visualProgram || !hasAuthoredCollections || !Array.isArray(collections)) {
    return null;
  }
  const domain = provenance?.kind === 'chapel-book' || origin?.view === 'chapel'
    ? 'chapel'
    : origin?.view === 'atrium'
      ? 'atrium'
      : null;
  if (!domain) return null;
  return normalizeReadingVisualIdentity({
    version: READING_VISUAL_IDENTITY_VERSION,
    domain,
    collections
  });
}

/**
 * Keep Chapel-owned sources aligned with the restored Chapel reading while
 * preserving generic collections the reader may also have selected.
 */
export function reconcileReadingVisualIdentity(interlocution = {}, identity = null) {
  const normalizedIdentity = normalizeReadingVisualIdentity(identity);
  if (!normalizedIdentity) return { ...interlocution };
  if (normalizedIdentity.domain !== 'chapel') {
    return {
      ...interlocution,
      atriumCollections: [...normalizedIdentity.collections]
    };
  }
  const genericSourced = Array.isArray(interlocution.sourced)
    ? interlocution.sourced.filter(id =>
      typeof id === 'string'
      && !id.startsWith('chapel-')
      && !id.startsWith('dore:'))
    : [];
  const chapelSourced = normalizedIdentity.collections.filter(id =>
    id.startsWith('chapel-') || id.startsWith('dore:'));
  return {
    ...interlocution,
    ...normalizeVisualSelection({
      sourceFamily: interlocution.sourceFamily,
      procedural: interlocution.procedural,
      sourced: [...genericSourced, ...chapelSourced]
    }),
    atriumCollections: [...normalizedIdentity.collections]
  };
}

/** True only for a focal authored by a Chapel launch, never a user choice. */
export function isLaunchHeldFocal(focals) {
  return focals?.type === 'icon' || focals?.type === 'rose';
}

/**
 * Return a released standard-glyph focal, or null when the focal is already
 * user-owned. Standard and personal focals intentionally survive.
 */
export function releaseLaunchHeldFocal(focals) {
  if (!isLaunchHeldFocal(focals)) return null;
  return {
    ...focals,
    type: 'standard',
    standardGlyph: focals.standardGlyph || 'breath',
    iconId: null
  };
}

/**
 * Remove selection/context authored by the reading being left.
 *
 * Sourced pools are launch-scoped; ordinary user-selected procedural engines
 * remain available for the next draft. This used to also strip Blueprint and
 * Freedom by name — normalizeVisualSelection drops any engine the registry
 * does not know, so a retired one needs no mention here.
 */
export function clearLaunchVisualSelection(interlocution = {}) {
  const procedural = Array.isArray(interlocution.procedural) ? interlocution.procedural : [];
  const sourceFamily = inferVisualSourceFamily(procedural, []);
  return {
    ...interlocution,
    ...normalizeVisualSelection({ sourceFamily, procedural, sourced: [] }),
    atriumCollections: []
  };
}
