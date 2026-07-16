/**
 * Canonical session compiler.
 *
 * Every launch surface uses this module so estimates and playback share the
 * same validation, source boundaries, chunking, and pacing semantics.
 */

import { Atom, Session } from './models.js';
import { chunkText } from './chunker.js';
import { PacingEngine, StateCurve } from './pacing.js';
import { normalizeVisualSelection } from './visual-selection.js';

export const SESSION_LIMITS = Object.freeze({
    minWpm: 50,
    maxWpm: 1000,
    maxTextCharacters: 2_000_000
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

export function normalizeSessionConfig(input = {}) {
    const wpm = Math.max(
        SESSION_LIMITS.minWpm,
        Math.min(SESSION_LIMITS.maxWpm, finiteNumber(input.wpm, 220))
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
        visualMode,
        interlocution: {
            ...raw,
            ...selection,
            frequency: Math.max(0, Math.min(1, finiteNumber(raw.frequency, 0.2))),
            duration: Math.max(16, Math.min(200, finiteNumber(raw.duration, 80))),
            renderLanguage: raw.renderLanguage === 'ascii' ? 'ascii' : 'native',
            kleePreset: KLEE_PRESETS.has(raw.kleePreset) ? raw.kleePreset : 'random',
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
    const supplied = Array.isArray(config.sources) ? config.sources : [];
    const candidates = supplied.length > 0
        ? supplied
        : [{
            id: config.sourceId || 'primary',
            name: config.source || config.textSource || config.title || 'Session',
            type: 'text',
            data: config.text ?? config.content ?? ''
        }];

    return candidates.map((source, index) => {
        const raw = sourceText(source);
        if (raw.length > SESSION_LIMITS.maxTextCharacters) {
            throw new RangeError(`Source ${index + 1} exceeds the ${SESSION_LIMITS.maxTextCharacters.toLocaleString()} character limit`);
        }
        return {
            id: String(source.id || `source-${index + 1}`),
            name: String(source.name || source.title || `Source ${index + 1}`),
            type: String(source.type || 'text'),
            providerId: source.providerId ? String(source.providerId) : '',
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
        const sourceAtoms = chunkText(source.raw, {
            mode: config.chunkMode,
            wpm: config.wpm,
            source: source.name,
            sourceId: source.id
        });
        if (sourceAtoms.length === 0) continue;
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
        customVisuals: Array.isArray(config.customVisuals)
            ? config.customVisuals.filter(uri => typeof uri === 'string' && uri.startsWith('data:image/')).slice(0, 24)
            : []
    });
}

export function estimateCompiledDuration(input = {}) {
    return compileSession(input).totalDuration;
}
