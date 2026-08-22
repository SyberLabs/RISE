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
import { LISTED_PROCEDURAL_PATTERNS, PROCEDURAL_PATTERN_IDS } from './visual-registry.js';

export const GROUNDS = Object.freeze({
    transparent: 'transparent',
    light: 'light',
    dark: 'dark'
});

/** Named tokens only. The plate stylesheet binds these; never #000/#fff. */
export const MASK_GROUND_CSS = Object.freeze({
    light: 'var(--color-cream)',
    dark: 'var(--color-dark-slate)'
});

const ENGINE_IDS = new Set([
    ...PROCEDURAL_PATTERN_IDS,
    ...LISTED_PROCEDURAL_PATTERNS.map(pattern => pattern.id)
]);

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
    'sci-astronomy': GROUNDS.dark,
    oldmasters: GROUNDS.dark,
    'aic-oldmasters': GROUNDS.dark,
    renaissance: GROUNDS.dark,
    impressionism: GROUNDS.light,
    'aic-impressionism': GROUNDS.light,
    postimpressionism: GROUNDS.light,
    'aic-postimpressionism': GROUNDS.light,
    ukiyoe: GROUNDS.light,
    'aic-ukiyoe': GROUNDS.light,
    landscapes: GROUNDS.light,
    'aic-landscapes': GROUNDS.light,
    romantic: GROUNDS.light,
    portraits: GROUNDS.dark,
    'aic-portraits': GROUNDS.dark,
    flowers: GROUNDS.light,
    'aic-flowers': GROUNDS.light,
    ships: GROUNDS.dark,
    'aic-ships': GROUNDS.dark,
    animals: GROUNDS.light,
    'aic-animals': GROUNDS.light,
    knights: GROUNDS.dark,
    'aic-knights': GROUNDS.dark,

    atrium: GROUNDS.dark,
    chapel: GROUNDS.dark,
    'global-pool': GROUNDS.transparent,
    custom: GROUNDS.transparent
});

const FAMILY_BY_ID = Object.freeze({
    astronomy: 'astronomy',
    'sci-astronomy': 'astronomy',
    oldmasters: 'oldmasters',
    'aic-oldmasters': 'oldmasters',
    renaissance: 'oldmasters',
    landscapes: 'landscapes',
    'aic-landscapes': 'landscapes',
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

export function collectionFamilyOf(id) {
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
            profile: ref.profile || profileFor(id || family),
            opaque: ref.opaque === true
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
        profile: profileFor(id),
        opaque: false
    };
}

function isAstronomy(source) {
    return source.family === 'astronomy'
        || source.id === 'sci-astronomy'
        || source.id === 'astronomy';
}

function isOldMasters(source) {
    return source.family === 'oldmasters'
        || source.id === 'aic-oldmasters'
        || source.id === 'oldmasters';
}

/**
 * combine(A, B) — Firstmate named this so the ship can leave.
 *
 * 1. If B is a procedural, start from B’s profile.
 * 2. Locked overrides: Astronomy+Attractor → Dark. Old Masters+Fractal → Light.
 * 3. If both A and B are collection/still: Transparent (no plate).
 * 4. If result is Transparent and A is not yet opaque: Dark (never page punch).
 */
export function combine(A, B, options = {}) {
    const room = describeSource(A);
    const fill = describeSource(B);
    const roomOpaque = options.roomOpaque === true || room.opaque === true;

    let result = GROUNDS.transparent;

    if (fill.procedural) {
        result = fill.profile;
    }

    if (isAstronomy(room) && fill.id === 'attractor') {
        result = GROUNDS.dark;
    }
    if (isOldMasters(room) && fill.id === 'fractal') {
        result = GROUNDS.light;
    }

    if (room.still && fill.still) {
        result = GROUNDS.transparent;
    }

    if (result === GROUNDS.transparent && !roomOpaque) {
        result = GROUNDS.dark;
    }

    return result;
}

export function resolveRoomSourceId({
    activeTypes,
    procedural,
    sourced
} = {}) {
    return firstId(activeTypes) || firstId(procedural) || firstId(sourced);
}

export function resolveFillSourceId(roomId, wordFill) {
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
