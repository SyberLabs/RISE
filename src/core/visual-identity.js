import {
  inferVisualSourceFamily,
  normalizeVisualSelection
} from './visual-selection.js';

const LAUNCH_ONLY_PROCEDURAL_TYPES = new Set(['blueprint', 'freedom']);

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
 * Sourced pools are launch-scoped. Blueprint/Freedom are likewise
 * source-exclusive procedural identities; ordinary user-selected procedural
 * engines remain available for the next draft.
 */
export function clearLaunchVisualSelection(interlocution = {}) {
  const procedural = Array.isArray(interlocution.procedural)
    ? interlocution.procedural.filter(id => !LAUNCH_ONLY_PROCEDURAL_TYPES.has(id))
    : [];
  const sourceFamily = inferVisualSourceFamily(procedural, []);
  return {
    ...interlocution,
    ...normalizeVisualSelection({ sourceFamily, procedural, sourced: [] }),
    atriumCollections: [],
    blueprintMechanism: null,
    freedomRelation: null
  };
}
