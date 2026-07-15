/**
 * Canonical contract for Rhythmic visual sources.
 *
 * Source families are exclusive unless the user deliberately chooses Blend.
 * Keeping this rule outside the panel means saved presets, imported sessions,
 * and launch-time config all resolve to the same effective selection.
 */

export const VISUAL_SOURCE_FAMILIES = Object.freeze([
    'procedural',
    'collections',
    'personal',
    'blend'
]);

const SOURCE_FAMILY_SET = new Set(VISUAL_SOURCE_FAMILIES);

function uniqueStringIds(value) {
    return Array.isArray(value)
        ? [...new Set(value.filter(id => typeof id === 'string' && id.length > 0))]
        : [];
}

export function isPersonalVisualSource(id) {
    return id === 'global-pool' || id === 'custom' || id.startsWith('personal:');
}

export function inferVisualSourceFamily(proceduralValue, sourcedValue) {
    const procedural = uniqueStringIds(proceduralValue);
    const sourced = uniqueStringIds(sourcedValue);
    const hasProcedural = procedural.length > 0;
    const hasPersonal = sourced.some(isPersonalVisualSource);
    const hasCollections = sourced.some(id => !isPersonalVisualSource(id));

    if ((hasProcedural && sourced.length > 0) || (hasPersonal && hasCollections)) {
        return 'blend';
    }
    if (hasCollections) return 'collections';
    if (hasPersonal) return 'personal';
    return 'procedural';
}

export function normalizeVisualSelection(value = {}) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    let procedural = uniqueStringIds(input.procedural);
    let sourced = uniqueStringIds(input.sourced);
    const sourceFamily = SOURCE_FAMILY_SET.has(input.sourceFamily)
        ? input.sourceFamily
        : inferVisualSourceFamily(procedural, sourced);

    if (sourceFamily === 'procedural') {
        sourced = [];
    } else if (sourceFamily === 'collections') {
        procedural = [];
        sourced = sourced.filter(id => !isPersonalVisualSource(id));
    } else if (sourceFamily === 'personal') {
        procedural = [];
        sourced = sourced.filter(isPersonalVisualSource);
    }

    return { sourceFamily, procedural, sourced };
}

export function hasVisualSelectionFields(value) {
    return Boolean(value && typeof value === 'object' && (
        Object.hasOwn(value, 'sourceFamily') ||
        Object.hasOwn(value, 'procedural') ||
        Object.hasOwn(value, 'sourced')
    ));
}
