/**
 * Canonical session compiler.
 *
 * Every launch surface uses this module so estimates and playback share the
 * same validation, source boundaries, chunking, and pacing semantics.
 */

import { Atom, Session } from './models.js';
import { chunkText, countWords } from './chunker.js';
import { prepareChunkText } from './chunk-profiles.js';
import { PacingEngine, StateCurve } from './pacing.js';
import { normalizeGlobalPoolSelection, normalizeVisualSelection } from './visual-selection.js';
import {
    validateExperienceProgram,
    lowerExperienceProgram,
    EXPERIENCE_PROGRAM_LIMITS
} from './experience-program.js';
import { compileSourceSpans } from './source-span.js';
import {
    createSequenceVisualAsset,
    validateSequenceAssetReferences
} from './visual-score-lane.js';
import {
    normalizeGalleryCadence,
    normalizeVisualPresence,
    normalizePresentation,
    VISUAL_PRESENCE_BEHIND_STREAM_DEFAULT_MS
} from './visual-presence.js';

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
const ATTRACTOR_SYSTEM_IDS = new Set(['aizawa', 'thomas', 'halvorsen']);
const ATTRACTOR_PALETTE_SET = new Set(['white', 'red', 'blue', 'gold', 'purple']);
const ATTRACTOR_FORM_SET = new Set(['mirror', 'kaleido', 'bilateral']);
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

/**
 * Authored source boundaries, bounded before they reach runtime state.
 *
 * A Journey compiler produces these, but nothing stops a persisted
 * session or a hand-written config from carrying something else, and a
 * boundary is an atom with a duration — the one field that can stall a
 * reading if it arrives wrong.
 */
const MAX_SOURCE_BOUNDARIES = EXPERIENCE_PROGRAM_LIMITS.maxTransitions;

function normalizeSourceBoundaries(value) {
    if (!Array.isArray(value)) return [];
    const out = [];
    for (const raw of value.slice(0, MAX_SOURCE_BOUNDARIES)) {
        if (!raw || typeof raw !== 'object') continue;
        const id = typeof raw.id === 'string' ? raw.id.slice(0, 160) : '';
        const sourceId = typeof raw.sourceId === 'string' ? raw.sourceId.slice(0, 160) : '';
        const afterSourceId = typeof raw.afterSourceId === 'string' ? raw.afterSourceId.slice(0, 160) : '';
        const beforeSourceId = typeof raw.beforeSourceId === 'string' ? raw.beforeSourceId.slice(0, 160) : '';
        // A boundary that does not name both sides cannot replace a
        // break, and one with no source id of its own would carry no cue.
        if (!id || !sourceId || !afterSourceId || !beforeSourceId) continue;
        const durationMs = Number(raw.durationMs);
        out.push({
            id, sourceId, afterSourceId, beforeSourceId,
            kind: typeof raw.kind === 'string' ? raw.kind.slice(0, 40) : 'movement',
            durationMs: Number.isFinite(durationMs) ? durationMs : 1200
        });
    }
    return out;
}

export function normalizeSessionConfig(input = {}) {
    const wpm = Math.max(
        SESSION_LIMITS.minWpm,
        Math.min(SESSION_LIMITS.maxWpm, finiteNumber(input.wpm, 320))
    );
    const chunkMode = CHUNK_MODES.has(input.chunkMode) ? input.chunkMode : 'word';
    const curve = Object.hasOwn(CURVES, input.curve) ? input.curve : 'flat';

    // Recitation (RECITATION-SPEC) is a TEXT presentation and belongs
    // in the temporal orbit, beside wpm and chunkMode, because that is
    // what it modifies — not beside the imagery surfaces, which are a
    // different axis entirely.
    //
    // Normalised here for the same reason everything else is: a
    // restored or imported session may carry anything, and there is
    // exactly one validated path to the runtime.
    const recitation = Object.freeze({
        enabled: input.recitation?.enabled === true
    });

    const experienceProgram = input.experienceProgram == null
        ? null
        : validateExperienceProgram(input.experienceProgram);
    const rawSequenceAssets = Array.isArray(input.sequenceVisualAssets)
        ? input.sequenceVisualAssets
        : [];
    if (rawSequenceAssets.length > 24) {
        throw new RangeError('A sequence may contain at most 24 visual assets.');
    }
    const sequenceVisualAssets = rawSequenceAssets.map(createSequenceVisualAsset);
    if (new Set(sequenceVisualAssets.map(asset => asset.id)).size !== sequenceVisualAssets.length) {
        throw new TypeError('Sequence visual asset ids must be unique.');
    }
    if (experienceProgram) validateSequenceAssetReferences(experienceProgram, sequenceVisualAssets);
    const lowered = experienceProgram ? lowerExperienceProgram(experienceProgram) : null;

    return {
        ...input,
        wpm,
        chunkMode,
        curve,
        recitation,
        sequenceVisualAssets,
        ...(experienceProgram ? {
            experienceProgram,
            movementProgram: lowered.movementProgram,
            visualProgram: lowered.visualProgram,
            audioProgram: lowered.audioProgram
        } : {}),
        sourceBoundaries: normalizeSourceBoundaries(
            lowered?.sourceBoundaries ?? input.sourceBoundaries
        )
    };
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
    // Attractor is a persistent field, not a rhythmic interrupt: its
    // settings travel in their own block. Saved or imported values must
    // be validated here or an unknown id silently degrades the field.
    const rawAttractor = input.attractor && typeof input.attractor === 'object'
        ? input.attractor
        : {};

    return {
        ...input,
        consentScope: typeof input.consentScope === 'string'
            ? input.consentScope.slice(0, 160)
            : undefined,
        visualMode,
        attractor: {
            ...rawAttractor,
            system: ATTRACTOR_SYSTEM_IDS.has(rawAttractor.system) ? rawAttractor.system : 'aizawa',
            palette: ATTRACTOR_PALETTE_SET.has(rawAttractor.palette) ? rawAttractor.palette : 'white',
            form: ATTRACTOR_FORM_SET.has(rawAttractor.form) ? rawAttractor.form : 'mirror'
        },
        interlocution: {
            ...raw,
            ...selection,
            globalPool: normalizeGlobalPoolSelection(raw.globalPool),
            frequency: Math.max(0, Math.min(1, finiteNumber(raw.frequency, 0.2))),
            // Behind-stream presences default to a full beat: imagery
            // beneath the text needs dwell time a full-frame cut does not
            duration: normalizeVisualPresence(
                raw.duration,
                raw.presentation === 'behind-stream'
                    ? VISUAL_PRESENCE_BEHIND_STREAM_DEFAULT_MS
                    : undefined
            ),
            // ASCII IS RETIRED (2026-08-06) — a cool experiment that did
            // not earn its place. It is retired everywhere it could be
            // CHOSEN, so the compiler normalises rather than preserves:
            // a stored program that still names it compiles to native
            // instead of asking for a surface no control can reach.
            // (The engine itself is still in the tree; deleting it is a
            // separate decision from retiring the setting.)
            renderLanguage: 'native',
            presentation: normalizePresentation(raw.presentation),
            galleryCadence: normalizeGalleryCadence(raw.galleryCadence),
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
            // PER SOURCE, because a reading may hold several kinds of
            // text at once. War's first movement is Milton's blank
            // verse; its second and third are prose translations. One
            // session-wide flag would have to be wrong about two of them.
            verseLines: source.verseLines === true,
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

/** A boundary shorter than this is not a transition; longer is a stall. */
const BOUNDARY_MIN_MS = 200;
const BOUNDARY_MAX_MS = 30_000;

/**
 * An AUTHORED boundary between two sources (JOURNEYS-SPEC §7.4).
 *
 * The generic break above is three beats of the reading's own pace,
 * which is right for two texts that merely follow one another. A
 * Journey's movement change is scored: it has a duration someone chose
 * and cues of its own, and it replaces the generic break rather than
 * sitting beside it.
 *
 * THIS IS WHY THE PLAYER REMAINS THE ONLY CLOCK. The transition is not
 * something that happens between atoms while text waits — the
 * transition IS the current atom. So it pauses when the reading pauses,
 * rewinds when the reading rewinds, and cannot drift from it, because
 * there is no second timer to drift.
 *
 * Its synthetic sourceId is what makes the visual and audio programs
 * change cue at exactly this point and nowhere else.
 */
function createAuthoredBoundary(boundary, position) {
    const duration = Math.min(
        Math.max(Math.round(Number(boundary.durationMs) || 0), BOUNDARY_MIN_MS),
        BOUNDARY_MAX_MS
    );
    return new Atom({
        content: '',
        modality: 'text',
        duration,
        weight: 0,
        complexity: 0,
        // `source-break` is kept so everything that already understands
        // a break keeps working; the other two say what KIND of break.
        tags: ['source-break', 'authored-boundary', `boundary:${boundary.id}`],
        timingLocked: true,
        sourceId: boundary.sourceId,
        position
    });
}

export function compileSession(input = {}) {
    const config = normalizeSessionConfig(input);
    const sources = normalizeSources(config);
    if (sources.length === 0) throw new TypeError('A session requires at least one non-empty text source');

    const atoms = [];
    let previousSourceId = null;
    for (const source of sources) {
        const prepared = prepareChunkText(source.raw, source.chunkProfile ?? null);
        const sourceAtoms = chunkText(prepared.text, {
            mode: config.chunkMode,
            wpm: config.wpm,
            source: source.name,
            sourceId: source.id,
            hints: prepared.hints || null,
            // Phrase mode's floor, ON by default from 2026-08-06 — see
            // PHRASE-CHUNKING-STUDY §7b for the measurement that reversed
            // §7's opt-in ruling.
            //
            // THREE VOICES, MOST SPECIFIC WINS. A SOURCE speaks about one
            // text and is heard first: the `verse` profile is a statement
            // that this work's short phrases are the author's. A SESSION
            // speaks for a whole reading. The default speaks for a shelf
            // of 91 works measured across 24.
            //
            // `??` and not `||`, deliberately: the point of the inversion
            // is that FALSE must be sayable, and `||` cannot hear it.
            phraseFloor: prepared.phraseFloor
                ?? (typeof config.phraseFloor === 'boolean' ? config.phraseFloor : true),
            verseLines: source.verseLines === true
        });
        if (sourceAtoms.length === 0) continue;
        const projectedAtomCount = atoms.length + sourceAtoms.length + (atoms.length > 0 ? 1 : 0);
        if (projectedAtomCount > SESSION_LIMITS.maxAtoms) {
            throw new TypeError(
                `Session produces more than ${SESSION_LIMITS.maxAtoms.toLocaleString()} reading atoms. Use shorter text or choose Phrase or Sentence chunking.`
            );
        }
        if (atoms.length > 0) {
            // An authored boundary REPLACES the generic break between
            // exactly the pair it names. Unmatched adjacent sources keep
            // the current behaviour, so a Journey's transitions are the
            // only thing that changes.
            const authored = (config.sourceBoundaries || []).find(
                b => b.afterSourceId === previousSourceId && b.beforeSourceId === source.id);
            atoms.push(authored
                ? createAuthoredBoundary(authored, atoms.length)
                : createSourceBreak(config.wpm, atoms.length));
        }
        // Where each atom falls INSIDE its own source, measured in words
        // consumed. A visual program that changes figure at Milton's line
        // 750 needs a coordinate the whole session cannot give it:
        // `position` is an index into every atom of every work.
        //
        // Words rather than atoms, because chunking is uneven — one long
        // sentence and twelve short ones are twelve atoms apart and a
        // paragraph apart, and only the word count tracks the page.
        const sourceWords = sourceAtoms.map(atom =>
            countWords(typeof atom.content === 'string' ? atom.content : ''));
        const totalWords = sourceWords.reduce((sum, n) => sum + n, 0);
        let consumed = 0;
        for (let i = 0; i < sourceAtoms.length; i += 1) {
            const atom = sourceAtoms[i];
            atom.position = atoms.length;
            atom.sourceProgress = totalWords > 0 ? consumed / totalWords : 0;
            consumed += sourceWords[i];
            atoms.push(atom);
        }
        previousSourceId = source.id;
    }
    if (atoms.length === 0) throw new TypeError('The supplied sources produced no playable content');

    // Durable source spans are verified only after the exact edition text is
    // present and atomization is complete. This stamps source coordinates on
    // atoms without changing the canonical score or binding it to atom ids.
    compileSourceSpans(config.experienceProgram, sources, atoms);

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
        customVisuals: [...new Set([
            ...(Array.isArray(config.customVisuals) ? config.customVisuals : []),
            ...(config.sequenceVisualAssets || []).map(asset => asset.uri)
        ].filter(uri => typeof uri === 'string' && uri.startsWith('data:image/')))].slice(0, 24)
    });
}

export function estimateCompiledDuration(input = {}) {
    return compileSession(input).totalDuration;
}
