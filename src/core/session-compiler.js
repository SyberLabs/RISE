/**
 * Canonical session compiler.
 *
 * Every launch surface uses this module so estimates and playback share the
 * same validation, source boundaries, chunking, and pacing semantics.
 */

import { Atom, Session } from './models.js';
import { chunkText } from './chunker.js';
import { prepareChunkText } from './chunk-profiles.js';
import { PacingEngine, StateCurve } from './pacing.js';
import { normalizeGlobalPoolSelection, normalizeVisualSelection } from './visual-selection.js';
import { normalizeVisualPresence } from './visual-presence.js';

export const SESSION_LIMITS = Object.freeze({
    minWpm: 50,
    maxWpm: 1000,
    maxTextCharacters: 2_000_000,
    maxTotalChars: 2_000_000,
    maxAtoms: 120_000,
    maxSources: 64,
    maxProvenanceString: 2_000,
    maxProvenanceKeys: 40,
    maxProvenanceArray: 64,
    maxProvenanceDepth: 4
});

const CHUNK_MODES = new Set(['word', 'phrase', 'sentence', 'paragraph']);
const CURVES = Object.freeze({
    flat: () => StateCurve.flat(),
    induction: () => StateCurve.induction(),
    ascent: () => StateCurve.ascent(),
    wave: () => StateCurve.wave(),
    climax: () => StateCurve.climax()
});
const VISUAL_MODES = new Set(['off', 'focals', 'attractor', 'genesis', 'interlocution']);
const KLEE_PRESETS = new Set(['random', 'architectural', 'chaotic', 'harmonic', 'gravitational', 'twittering']);

function finiteNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

const FORBIDDEN_METADATA_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Preserve provenance as bounded JSON data. This prevents a content manifest
 * from smuggling executable objects, huge nested structures, or prototype
 * keys into durable session state.
 */
export function normalizeProvenance(value, depth = 0) {
    if (value == null) return null;
    if (typeof value === 'string') return value.slice(0, SESSION_LIMITS.maxProvenanceString);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (depth >= SESSION_LIMITS.maxProvenanceDepth) return null;
    if (Array.isArray(value)) {
        return value
            .slice(0, SESSION_LIMITS.maxProvenanceArray)
            .map(item => normalizeProvenance(item, depth + 1))
            .filter(item => item !== null);
    }
    if (typeof value !== 'object') return null;

    const normalized = {};
    Object.entries(value)
        .filter(([key]) => !FORBIDDEN_METADATA_KEYS.has(key))
        .slice(0, SESSION_LIMITS.maxProvenanceKeys)
        .forEach(([key, item]) => {
            const safeKey = String(key).slice(0, 120);
            const safeValue = normalizeProvenance(item, depth + 1);
            if (safeKey && safeValue !== null) normalized[safeKey] = safeValue;
        });
    return normalized;
}

export function normalizeSessionConfig(input = {}) {
    const wpm = Math.max(
        SESSION_LIMITS.minWpm,
        Math.min(SESSION_LIMITS.maxWpm, finiteNumber(input.wpm, 320))
    );
    const chunkMode = CHUNK_MODES.has(input.chunkMode) ? input.chunkMode : 'word';
    const curve = Object.hasOwn(CURVES, input.curve) ? input.curve : 'flat';

    return { ...input, wpm, chunkMode, curve };
}

export function normalizeVisualConfig(value = {}) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const visualMode = VISUAL_MODES.has(input.visualMode) ? input.visualMode : 'off';
    const raw = input.interlocution && typeof input.interlocution === 'object'
        ? input.interlocution
        : {};
    const uniqueIds = ids => Array.isArray(ids)
        ? [...new Set(ids.filter(id => typeof id === 'string').map(id => id.slice(0, 120)))].slice(0, 32)
        : [];
    const selection = normalizeVisualSelection({
        ...raw,
        procedural: uniqueIds(raw.procedural),
        sourced: uniqueIds(raw.sourced)
    });
    return {
        ...input,
        consentScope: typeof input.consentScope === 'string'
            ? input.consentScope.slice(0, 160)
            : undefined,
        visualMode,
        interlocution: {
            ...raw,
            ...selection,
            globalPool: normalizeGlobalPoolSelection(raw.globalPool),
            frequency: Math.max(0, Math.min(1, finiteNumber(raw.frequency, 0.2))),
            duration: normalizeVisualPresence(raw.duration),
            renderLanguage: raw.renderLanguage === 'ascii' ? 'ascii' : 'native',
            presentation: raw.presentation === 'behind-stream' ? 'behind-stream' : 'full-frame',
            streamGlass: raw.streamGlass !== false,
            kleePreset: KLEE_PRESETS.has(raw.kleePreset) ? raw.kleePreset : 'random',
            // Atrium-curated collections travel as an informational string
            // list; malformed saved/imported values must not reach UI code
            atriumCollections: Array.isArray(raw.atriumCollections)
                ? raw.atriumCollections
                    .filter(id => typeof id === 'string' && id.length > 0)
                    .slice(0, 12)
                : undefined,
            responsive: raw.responsive === true,
            responsiveMood: raw.responsiveMood !== false,
            responsiveRhythm: raw.responsiveRhythm !== false
        }
    };
}

function sourceText(source) {
    const value = source?.data ?? source?.raw ?? '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
        return value.map(item => typeof item === 'string' ? item : JSON.stringify(item)).join('\n\n');
    }
    return value == null ? '' : String(value);
}

function normalizeSources(config) {
    const supplied = Array.isArray(config.sources)
        ? config.sources.slice(0, SESSION_LIMITS.maxSources)
        : [];
    const candidates = supplied.length > 0
        ? supplied
        : [{
            id: config.sourceId || 'primary',
            name: config.source || config.textSource || config.title || 'Session',
            type: 'text',
            data: config.text ?? config.content ?? ''
        }];

    let totalChars = 0;
    return candidates.map((source, index) => {
        const raw = sourceText(source);
        if (raw.length > SESSION_LIMITS.maxTextCharacters) {
            throw new RangeError(`Source ${index + 1} exceeds the ${SESSION_LIMITS.maxTextCharacters.toLocaleString()} character limit`);
        }
        totalChars += raw.length;
        if (totalChars > SESSION_LIMITS.maxTotalChars) {
            throw new TypeError(
                `Session text exceeds the ${SESSION_LIMITS.maxTotalChars.toLocaleString()} combined character limit. Use fewer or shorter sources.`
            );
        }
        return {
            id: String(source.id || `source-${index + 1}`),
            name: String(source.name || source.title || `Source ${index + 1}`),
            type: String(source.type || 'text'),
            providerId: source.providerId ? String(source.providerId) : '',
            provenance: normalizeProvenance(source.provenance),
            ...((source.chunkProfile ?? config.chunkProfile ?? null) == null
                ? {}
                : { chunkProfile: String(source.chunkProfile ?? config.chunkProfile) }),
            raw
        };
    }).filter(source => source.raw.trim().length > 0);
}

function createSourceBreak(wpm, position) {
    return new Atom({
        content: '',
        modality: 'text',
        duration: Math.round((60_000 / wpm) * 3),
        weight: 0,
        complexity: 0,
        tags: ['source-break'],
        timingLocked: true,
        position
    });
}

export function compileSession(input = {}) {
    const config = normalizeSessionConfig(input);
    const sources = normalizeSources(config);
    if (sources.length === 0) throw new TypeError('A session requires at least one non-empty text source');

    const atoms = [];
    for (const source of sources) {
        const prepared = prepareChunkText(source.raw, source.chunkProfile ?? null);
        const sourceAtoms = chunkText(prepared.text, {
            mode: config.chunkMode,
            wpm: config.wpm,
            source: source.name,
            sourceId: source.id,
            hints: prepared.hints || null
        });
        if (sourceAtoms.length === 0) continue;
        const projectedAtomCount = atoms.length + sourceAtoms.length + (atoms.length > 0 ? 1 : 0);
        if (projectedAtomCount > SESSION_LIMITS.maxAtoms) {
            throw new TypeError(
                `Session produces more than ${SESSION_LIMITS.maxAtoms.toLocaleString()} reading atoms. Use shorter text or choose Phrase or Sentence chunking.`
            );
        }
        if (atoms.length > 0) atoms.push(createSourceBreak(config.wpm, atoms.length));
        for (const atom of sourceAtoms) {
            atom.position = atoms.length;
            atoms.push(atom);
        }
    }
    if (atoms.length === 0) throw new TypeError('The supplied sources produced no playable content');

    const pacing = new PacingEngine({ baseWpm: config.wpm });
    pacing.setStateCurve(CURVES[config.curve]());
    const pacedAtoms = pacing.paceAtoms(atoms);

    return new Session({
        ...config,
        name: config.name,
        title: config.title || sources[0].name,
        sources: sources.map(({ raw, ...source }) => source),
        atoms: pacedAtoms,
        visualConfig: normalizeVisualConfig(config.visualConfig),
        origin: normalizeProvenance(config.origin),
        provenance: normalizeProvenance(config.provenance),
        customVisuals: Array.isArray(config.customVisuals)
            ? config.customVisuals.filter(uri => typeof uri === 'string' && uri.startsWith('data:image/')).slice(0, 24)
            : []
    });
}

export function estimateCompiledDuration(input = {}) {
    return compileSession(input).totalDuration;
}
