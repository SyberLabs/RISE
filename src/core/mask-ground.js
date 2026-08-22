/**
 * Mask ground — color profiles + Firstmate combine().
 *
 * Every source declares Transparent | Light | Dark. The runtime pair
 * (room × word-fill) picks a plate that sits inside the glyph wrapper,
 * behind the engine. Never a new visualMode. Never paint the wrapper
 * background. Layer A stays unmasked.
 *
 * Light = Cream plate (not white). Dark = Dark Slate plate (not black).
 * Transparent = no plate.
 */

import {
    canonicalizeProceduralEngineId,
    isPersonalVisualSource,
    normalizeWordFill
} from './visual-selection.js';
import { LISTED_PROCEDURAL_PATTERNS } from './visual-registry.js';

export const GROUNDS = Object.freeze({
    transparent: 'transparent',
    light: 'light',
    dark: 'dark'
});

/** LISTED_PROCEDURAL_PATTERNS is PROCEDURAL_PATTERNS plus Attractor. */
const ENGINE_IDS = new Set(LISTED_PROCEDURAL_PATTERNS.map(pattern => pattern.id));

/**
 * Profile assignments. Law is the profile + combine(), not an exhaustive
 * pair list. Locked natives: Attractor Dark, Fractal Light, living plates Dark.
 */
const SOURCE_PROFILES = Object.freeze({
    attractor: GROUNDS.dark,
    fractal: GROUNDS.light,
    harmonograph: GROUNDS.dark,
    ostensoria: GROUNDS.dark,
    apparitio: GROUNDS.dark,
    neural: GROUNDS.dark,
    klee: GROUNDS.dark,
    turrell: GROUNDS.dark,
    rockgarden: GROUNDS.light,

    procedural: GROUNDS.dark,
    collections: GROUNDS.transparent,
    personal: GROUNDS.transparent,
    blend: GROUNDS.transparent,

    astronomy: GROUNDS.dark,
    oldmasters: GROUNDS.dark,
    renaissance: GROUNDS.dark,
    impressionism: GROUNDS.light,
    postimpressionism: GROUNDS.light,
    ukiyoe: GROUNDS.light,
    landscapes: GROUNDS.light,
    romantic: GROUNDS.light,
    portraits: GROUNDS.dark,
    flowers: GROUNDS.light,
    ships: GROUNDS.dark,
    animals: GROUNDS.light,
    knights: GROUNDS.dark,

    atrium: GROUNDS.dark,
    chapel: GROUNDS.dark,
    'global-pool': GROUNDS.transparent,
    custom: GROUNDS.transparent
});

/**
 * Only ids whose family cannot be derived by stripping the `aic-`/`sci-`
 * prefix. Prefixed aliases resolve through `collectionFamilyOf`.
 */
const FAMILY_BY_ID = Object.freeze({
    astronomy: 'astronomy',
    oldmasters: 'oldmasters',
    renaissance: 'oldmasters',
    landscapes: 'landscapes',
    romantic: 'landscapes'
});

function firstId(value) {
    if (typeof value === 'string' && value) return canonicalizeProceduralEngineId(value);
    if (Array.isArray(value)) {
        for (const item of value) {
            const id = firstId(item);
            if (id) return id;
        }
    }
    return '';
}

export function isProceduralSource(id) {
    const canonical = canonicalizeProceduralEngineId(id);
    return ENGINE_IDS.has(canonical);
}

export function isStillSource(id) {
    const canonical = canonicalizeProceduralEngineId(id);
    if (!canonical) return false;
    if (isProceduralSource(canonical)) return false;
    return true;
}

function collectionFamilyOf(id) {
    const canonical = canonicalizeProceduralEngineId(id);
    if (!canonical) return 'collections';
    if (isProceduralSource(canonical)) return 'procedural';
    if (FAMILY_BY_ID[canonical]) return FAMILY_BY_ID[canonical];
    if (canonical.startsWith('aic-')) return canonical.slice(4) || 'collections';
    if (canonical.startsWith('sci-')) return canonical.slice(4) || 'collections';
    if (canonical.startsWith('atr-')) return 'atrium';
    if (canonical.startsWith('chapel-') || canonical.startsWith('icon-')) return 'chapel';
    if (isPersonalVisualSource(canonical)) return 'personal';
    if (canonical === 'personal' || canonical === 'blend' || canonical === 'collections') {
        return canonical;
    }
    return 'collections';
}

export function profileFor(id) {
    const canonical = canonicalizeProceduralEngineId(id);
    if (!canonical) return GROUNDS.transparent;
    if (SOURCE_PROFILES[canonical]) return SOURCE_PROFILES[canonical];
    const family = collectionFamilyOf(canonical);
    return SOURCE_PROFILES[family] || GROUNDS.transparent;
}

export function describeSource(ref) {
    if (ref && typeof ref === 'object' && !Array.isArray(ref) && (ref.id || ref.family)) {
        const id = firstId(ref.id);
        const family = ref.family || collectionFamilyOf(id || ref.family);
        const procedural = ref.procedural === true || isProceduralSource(id);
        const still = ref.still === true || (!procedural && (isStillSource(id) || family !== 'procedural'));
        return {
            id,
            family,
            procedural,
            still,
            profile: ref.profile || profileFor(id || family)
        };
    }
    const id = firstId(ref);
    const family = collectionFamilyOf(id);
    const procedural = isProceduralSource(id);
    return {
        id,
        family,
        procedural,
        still: !procedural && Boolean(id),
        profile: profileFor(id)
    };
}

/**
 * combine(A, B) — the plate under the word-fill.
 *
 * 1. A procedural fill contributes its own profile; a still fill contributes
 *    no plate.
 * 2. Transparent only survives once the room is already opaque, so the plate
 *    never punches through to the page.
 *
 * The room id `A` is kept as the pair's left-hand term for call-site
 * readability; opacity is the only property of the room that reaches the
 * result, and it arrives via `options.roomOpaque`.
 *
 * Previously this also carried two "locked override" pairs (Astronomy +
 * Attractor → Dark, Old Masters + Fractal → Light) and a both-still rule.
 * All three were unreachable: Attractor's own profile is already Dark and
 * Fractal's is already Light, and a still fill has already left the result
 * Transparent by the time the both-still rule runs.
 */
export function combine(A, B, options = {}) {
    const fill = describeSource(B);
    const result = fill.procedural ? fill.profile : GROUNDS.transparent;

    if (result === GROUNDS.transparent && options.roomOpaque !== true) {
        return GROUNDS.dark;
    }
    return result;
}

function resolveRoomSourceId({
    activeTypes,
    procedural,
    sourced
} = {}) {
    return firstId(activeTypes) || firstId(procedural) || firstId(sourced);
}

function resolveFillSourceId(roomId, wordFill) {
    const fill = normalizeWordFill(wordFill);
    if (fill.mode !== 'pick') return roomId || '';
    return firstId(fill.procedural) || firstId(fill.sourced) || roomId || '';
}

export function maskGroundFromConfig({
    sourced = [],
    procedural = [],
    wordFill,
    activeTypes,
    roomOpaque = false
} = {}) {
    const roomId = resolveRoomSourceId({ activeTypes, procedural, sourced });
    const fillId = resolveFillSourceId(roomId, wordFill);
    return combine(roomId, fillId, { roomOpaque });
}
