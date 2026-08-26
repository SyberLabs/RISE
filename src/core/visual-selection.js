/**
 * Canonical contract for Rhythmic visual sources.
 *
 * Source families are exclusive unless the user deliberately chooses Blend.
 * Keeping this rule outside the panel means saved presets, imported sessions,
 * and launch-time config all resolve to the same effective selection.
 */

import { LISTED_PROCEDURAL_PATTERNS } from './visual-registry.js';

const SOURCE_FAMILY_SET = new Set(['procedural', 'collections', 'personal', 'blend']);
const GLOBAL_POOL_MODE_SET = new Set(['all', 'selected']);
const PROCEDURAL_PREFIX = 'procedural:';
// LISTED_PROCEDURAL_PATTERNS is PROCEDURAL_PATTERNS plus Attractor, so its ids
// already contain PROCEDURAL_PATTERN_IDS.
const PROCEDURAL_ENGINE_IDS = new Set(
    LISTED_PROCEDURAL_PATTERNS.map(pattern => pattern.id)
);

export function normalizeFitBorder(value, fallback = 'cream') {
    return value === 'off' || value === 'cream' || value === 'accent' ? value : fallback;
}

function uniqueStringIds(value) {
    return Array.isArray(value)
        ? [...new Set(value.filter(id => typeof id === 'string' && id.length > 0))]
        : [];
}

/**
 * Word-fill controls and editor assets name engines as `procedural:fractal`.
 * The cortex's activeTypes and Gallery allowlist speak `fractal`. A leaked
 * prefix is an empty Wikimedia shelf, which is how Fractal Flames became glass.
 */
export function canonicalizeProceduralEngineId(id) {
    if (typeof id !== 'string' || !id) return '';
    return id.startsWith(PROCEDURAL_PREFIX) ? id.slice(PROCEDURAL_PREFIX.length) : id;
}

function collectProceduralIds(ids) {
    return [...new Set(uniqueStringIds(ids)
        .map(canonicalizeProceduralEngineId)
        .filter(Boolean))];
}

function liftEngineIdsFromSourced(sourcedIds) {
    const lifted = [];
    const sourced = [];
    for (const id of uniqueStringIds(sourcedIds)) {
        if (id.startsWith(PROCEDURAL_PREFIX)) {
            const canonical = id.slice(PROCEDURAL_PREFIX.length);
            if (canonical) lifted.push(canonical);
            continue;
        }
        if (PROCEDURAL_ENGINE_IDS.has(id)) {
            lifted.push(id);
            continue;
        }
        sourced.push(id);
    }
    return { lifted, sourced };
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
    const { lifted, sourced: sourcedWithoutEngines } = liftEngineIdsFromSourced(input.sourced);
    let procedural = [...new Set([...collectProceduralIds(input.procedural), ...lifted])];
    let sourced = sourcedWithoutEngines;
    // Empty+empty is stillness, not an instruction to snap back to Procedural:
    // an explicit family survives both shelves being left empty on purpose.
    const sourceFamily = SOURCE_FAMILY_SET.has(input.sourceFamily)
        ? input.sourceFamily
        : inferVisualSourceFamily(procedural, sourced);
    // PR #30 lifted leaked `procedural:` ids out of sourced so Flames
    // would not become an empty Wikimedia shelf. That lift must not
    // rewrite an explicit Collections / Personal / Blend pick back to
    // Procedural — leftover engines are exclusive-family residue and
    // are cleared below.

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

/**
 * A global-pool source is either dynamic (`all`) or pinned to stable asset
 * IDs (`selected`). An empty pinned set is intentional stillness, never an
 * instruction to fall back to every image in the shared pool.
 */
export function normalizeGlobalPoolSelection(value = {}) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const mode = GLOBAL_POOL_MODE_SET.has(input.mode) ? input.mode : 'all';
    const assetIds = uniqueStringIds(input.assetIds)
        .map(id => id.slice(0, 120))
        .slice(0, 20);
    return { mode, assetIds };
}

export function hasVisualSelectionFields(value) {
    return Boolean(value && typeof value === 'object' && (
        Object.hasOwn(value, 'sourceFamily') ||
        Object.hasOwn(value, 'procedural') ||
        Object.hasOwn(value, 'sourced')
    ));
}

/**
 * Word-fill is a secondary playlist inside Gallery, not a presentation.
 * `{ mode: 'same' }` writes the room URL onto both mounts. `{ mode: 'pick' }`
 * carries the same sourced/procedural shape as the room selection.
 */
export function normalizeWordFill(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { mode: 'same' };
    }
    // THE BORDER IS THE FIT WORD'S EDGE, NOT A PROPERTY OF THE INK. It was
    // carried only by the two mask modes and dropped here, so choosing Accent
    // silently discarded a border the reader had set and Fit + Accent could
    // never have one. What fills the letters and what edges them are separate
    // questions; every mode keeps its answer to the second.
    if (value.mode === 'plain') return { mode: 'plain', border: normalizeFitBorder(value.border) };
    if (value.mode === 'accent') return { mode: 'accent', border: normalizeFitBorder(value.border) };
    if (value.mode === 'same') return { mode: 'same', border: normalizeFitBorder(value.border) };
    if (value.mode !== 'pick') return { mode: 'same' };
    const selection = normalizeVisualSelection(value);
    if (selection.procedural.length === 0 && selection.sourced.length === 0) {
        return { mode: 'same' };
    }
    return { mode: 'pick', ...selection, border: normalizeFitBorder(value.border) };
}

export function wordFillIsDistinct(value) {
    return normalizeWordFill(value).mode === 'pick';
}

/**
 * Cold-start pair: a session that named a still room AND a procedural
 * engine is Astronomy × Fractal (or Old Masters × Fractal, Astronomy ×
 * Attractor) even when wordFill was never declared. Session wordFill
 * still wins. Cortex leftover is not consulted here.
 */
export function resolveSessionWordFill(interlocution = {}) {
    const input = interlocution && typeof interlocution === 'object' && !Array.isArray(interlocution)
        ? interlocution
        : {};
    if (input.wordFill != null) return normalizeWordFill(input.wordFill);
    const selection = normalizeVisualSelection(input);
    if (selection.procedural.length > 0 && selection.sourced.length > 0) {
        return normalizeWordFill({
            mode: 'pick',
            procedural: selection.procedural,
            sourced: []
        });
    }
    return { mode: 'same' };
}
