/**
 * Versioned experience state.
 *
 * A missing dimension is not a neutral score. Zero would be a claim.
 * Callers omit what they did not estimate.
 */

import {
    DIMENSION_BY_ID,
    EMOTION_LABELS,
    EXPERIENCE_STATE_VERSION,
    MODALITIES,
    SOURCES
} from './dimensions.js';

const SOURCE_SET = new Set(SOURCES);
const EMOTION_SET = new Set(EMOTION_LABELS);
const MODALITY_SET = new Set(MODALITIES);
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function clamp(value, lo, hi) {
    return Math.min(hi, Math.max(lo, value));
}

export function slot(value, confidence, source) {
    return { value, confidence, source };
}

function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const nested of Object.values(value)) freezeDeep(nested);
    return Object.freeze(value);
}

function plainScalar(value) {
    if (typeof value === 'string') return value.slice(0, 500);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    return undefined;
}

function plainRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
        if (FORBIDDEN_KEYS.has(key)) continue;
        const scalar = plainScalar(nested);
        if (scalar !== undefined) out[key] = scalar;
    }
    return out;
}

function copySlot(id, raw) {
    const dimension = DIMENSION_BY_ID[id];
    if (!dimension) throw new TypeError(`Unknown experience dimension: ${id}`);
    if (!raw || typeof raw !== 'object') throw new TypeError(`Dimension ${id} needs a slot`);
    if (!SOURCE_SET.has(raw.source)) throw new TypeError(`Dimension ${id} has an unknown source`);
    if (raw.value == null) {
        return { value: null, confidence: 0, source: raw.source };
    }
    if (typeof raw.value !== 'number' || !Number.isFinite(raw.value)) {
        throw new TypeError(`Dimension ${id} value is not a finite number`);
    }
    if (typeof raw.confidence !== 'number' || !Number.isFinite(raw.confidence)) {
        throw new TypeError(`Dimension ${id} confidence is not a finite number`);
    }
    return {
        value: clamp(raw.value, dimension.range[0], dimension.range[1]),
        confidence: clamp(raw.confidence, 0, 1),
        source: raw.source
    };
}

function copyEmotions(raw) {
    if (raw == null) return null;
    if (typeof raw !== 'object' || raw.role !== 'auxiliary') {
        throw new TypeError('Emotion probabilities are auxiliary and must say so');
    }
    if (!SOURCE_SET.has(raw.source)) throw new TypeError('Emotion source is unknown');
    const labels = {};
    const incoming = raw.labels && typeof raw.labels === 'object' ? raw.labels : {};
    for (const [label, probability] of Object.entries(incoming)) {
        if (!EMOTION_SET.has(label)) throw new TypeError(`Unknown emotion label: ${label}`);
        if (typeof probability !== 'number' || !Number.isFinite(probability)) {
            throw new TypeError(`Emotion ${label} is not a finite probability`);
        }
        labels[label] = clamp(probability, 0, 1);
    }
    return {
        role: 'auxiliary',
        source: raw.source,
        confidence: clamp(Number(raw.confidence) || 0, 0, 1),
        labels
    };
}

/**
 * @param {object} spec
 * @returns {Readonly<object>}
 */
export function experienceState(spec = {}) {
    if (!MODALITY_SET.has(spec.modality)) throw new TypeError('Experience state needs a known modality');
    const method = spec.provenance?.method;
    if (typeof method !== 'string' || method.length === 0) {
        throw new TypeError('Experience state needs a provenance method');
    }
    const dimensions = {};
    for (const [id, raw] of Object.entries(spec.dimensions || {})) {
        dimensions[id] = copySlot(id, raw);
    }
    const caveats = Array.isArray(spec.caveats)
        ? spec.caveats.filter(item => typeof item === 'string').slice(0, 12)
        : [];
    return freezeDeep({
        version: EXPERIENCE_STATE_VERSION,
        modality: spec.modality,
        dimensions,
        emotions: copyEmotions(spec.emotions),
        measurements: plainRecord(spec.measurements),
        caveats,
        provenance: plainRecord({
            ...spec.provenance,
            method
        })
    });
}

export function validateExperienceState(state) {
    const errors = [];
    if (!state || typeof state !== 'object') {
        return { ok: false, errors: ['state is not an object'] };
    }
    if (state.version !== EXPERIENCE_STATE_VERSION) errors.push('version');
    if (!MODALITY_SET.has(state.modality)) errors.push('modality');
    if (typeof state.provenance?.method !== 'string') errors.push('provenance.method');
    for (const [id, raw] of Object.entries(state.dimensions || {})) {
        try {
            copySlot(id, raw);
        } catch (error) {
            errors.push(`${id}: ${error.message}`);
        }
    }
    if (state.emotions != null) {
        try {
            copyEmotions(state.emotions);
        } catch (error) {
            errors.push(error.message);
        }
    }
    return { ok: errors.length === 0, errors };
}

export function unavailableState(modality, reason) {
    return experienceState({
        modality,
        dimensions: {},
        caveats: [reason],
        provenance: { method: 'unavailable', status: 'unavailable', reason }
    });
}
