/**
 * Canonical session compiler.
 *
 * Every launch surface uses this module so estimates and playback share the
 * same validation, source boundaries, chunking, and pacing semantics.
 */

import { Atom, Session } from './models.js';
import { chunkText, countWords, insertSourceScoreCuts } from './chunker.js';
import { prepareChunkText } from './chunk-profiles.js';
import { PacingEngine, StateCurve } from './pacing.js';
import { normalizeGlobalPoolSelection, normalizeVisualSelection } from './visual-selection.js';
import {
    validateExperienceProgram,
    lowerExperienceProgram,
    EXPERIENCE_PROGRAM_LIMITS
} from './experience-program.js';
import { READING_LIMITS, READING_PACE } from './reading-limits.js';
import { parseLibraryExtent } from './library-extent.js';
import { compileSourceSpans, sourceSpanCutPoints } from './source-span.js';
import {
    applyProgressPace,
    assertChunkProfileAllowsRecut,
    buildReadingPlan
} from './reading-score.js';
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
import {
    normalizeSequenceCapabilities,
    sequenceHasCapability,
    SEQUENCE_CAPABILITIES
} from './sequence-capabilities.js';

export const SESSION_LIMITS = Object.freeze({
    minWpm: READING_PACE.min,
    maxWpm: READING_PACE.max,
    maxTextCharacters: READING_LIMITS.maxTextCharacters,
    maxTotalChars: READING_LIMITS.maxTotalChars,
    maxAtoms: READING_LIMITS.maxAtoms,
    maxSources: READING_LIMITS.maxSources,
    maxProvenanceString: 2_000,
    maxProvenanceKeys: 40,
    maxProvenanceArray: 64,
    maxProvenanceDepth: 4
});

function isSessionImageUri(uri) {
    return typeof uri === 'string'
        && (uri.startsWith('data:image/') || uri.startsWith('blob:'));
}

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

    const capabilities = normalizeSequenceCapabilities(input.capabilities);

    // Recitation (RECITATION-SPEC) is a TEXT presentation and belongs
    // in the temporal orbit, beside wpm and chunkMode, because that is
    // what it modifies — not beside the imagery surfaces, which are a
    // different axis entirely.
    //
    // Normalised here for the same reason everything else is: a
    // restored or imported session may carry anything, and there is
    // exactly one validated path to the runtime.
    const recitation = Object.freeze({
        enabled: sequenceHasCapability(
            capabilities,
            SEQUENCE_CAPABILITIES.RECITATION_AUDIO
        ) && input.recitation?.enabled === true
    });
    const revealMode = input.revealMode === 'progressive' ? 'progressive' : 'instant';

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
        capabilities,
        recitation,
        revealMode,
        sequenceVisualAssets,
        ...(experienceProgram ? {
            experienceProgram,
            movementProgram: lowered.movementProgram,
            visualProgram: lowered.visualProgram,
            audioProgram: lowered.audioProgram,
            readingProgram: lowered.readingProgram
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
            data: config.text ?? config.content ?? '',
            // A SESSION COMPILED FROM BARE TEXT IS STILL A SOURCE. Every
            // reading that arrives as `text` rather than `sources` — which is
            // every reading the Library starts — took this branch, and the
            // branch dropped the field on the floor.
            verseLines: config.verseLines === true
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

/**
 * WHAT A READER MEETS WHERE TWO PIECES ARE JOINED.
 * ────────────────────────────────────────────────
 * A reading used to be one work cut into movements. On a shelf of 944
 * divisions whose median is 850 words it is several pieces from several
 * works, and every join between them compiled to the same nine-tenths of a
 * second of nothing: Judge Somers ended, one blank atom passed, and Benjamin
 * Fraser began. Two different dead people with nothing between them, and
 * crossing OUT of Spoon River into the Tao looked identical to crossing
 * between two of its neighbours. That is what makes a stitch read as a list.
 *
 * A seam names the piece the reader is arriving in. It costs no new data —
 * every content atom already carries the resolved name of its own extent,
 * and the boundary is the one atom that blanks it — and it changes nothing
 * about what is SPOKEN. A boundary is empty and the Chamber speaks nothing
 * at one (JOURNEYS-SPEC §8.4), which is right for a spoken reading. What
 * changes is what is seen.
 *
 * TWO DEPTHS, BECAUSE TWO CROSSINGS ARE NOT THE SAME CROSSING. Another
 * epitaph is the next voice in one graveyard; the Tao after Spoon River is
 * another book, and the reading should be able to feel the difference.
 * WHICH work a piece belongs to is settled by the extent grammar rather than
 * by reading the name apart, because `parseLibraryExtent` is where that
 * question is already answered and a second answer here would be a second
 * grammar.
 *
 * A SEAM THAT CANNOT BE NAMED IS ABSENT. No placeholder, no raw id, no empty
 * rule — the boundary stays exactly the silence it was, which is the same
 * reverent degradation the imagery and the swells follow.
 */
const WORD_CHARACTER = /[\p{L}\p{N}]/u;

/**
 * `nextName` with the head it shares with `previousName` removed.
 *
 * Within one work every piece's name opens with the work's own title, so a
 * seam that printed the whole name would show a reader seven words they
 * already have and two they do not, eight times in a row — the list feeling,
 * in typography.
 *
 * THE SHARED HEAD IS MEASURED, NOT PARSED. Reading the separator that
 * `extentSourceName` writes would put a second copy of a format this module
 * does not own next to the original; the common prefix of two names says the
 * same thing while knowing nothing about it, and says nothing at all when
 * the names have nothing in common.
 *
 * IT IS CUT AT A PUNCTUATION MARK, NOT AT ANY SHARED WORD. Cutting at the
 * last word the two names had in common turned "Meditations · Book IV" into
 * "Meditations · Book V" and showed the reader "V" — a fragment, because the
 * shared run had eaten into the piece's own name. A mark is where one part of
 * a name ends and another begins, whatever mark an edition uses, so the cut
 * lands after the last one inside the shared run and nowhere else: "Book V"
 * keeps its noun, and "Judge Somers" into "John M. Church" — which share
 * only a J and no mark — is not cut at all.
 */
const SEPARATOR = /[^\p{L}\p{N}\s]/u;

function elideSharedHead(previousName, nextName) {
    let shared = 0;
    while (shared < previousName.length && shared < nextName.length
        && previousName[shared] === nextName[shared]) shared += 1;
    let cut = 0;
    for (let i = 0; i < shared; i += 1) {
        if (SEPARATOR.test(nextName[i])) cut = i + 1;
    }
    if (!cut) return nextName;
    while (cut < nextName.length && !WORD_CHARACTER.test(nextName[cut])) cut += 1;
    return nextName.slice(cut).trim() || nextName;
}

/**
 * The seam between two adjacent sources, or null where there is nothing
 * honest to show.
 *
 * @param {object|null} previous the source the reader is leaving
 * @param {object} next the source the reader is arriving in
 * @returns {{depth: 'work'|'piece', label: string, name: string}|null}
 */
function describeSeam(previous, next) {
    const name = typeof next?.name === 'string' ? next.name.trim() : '';
    if (!name) return null;
    const previousName = typeof previous?.name === 'string' ? previous.name.trim() : '';
    const sameWork = Boolean(previous)
        && parseLibraryExtent(previous.id).workId === parseLibraryExtent(next.id).workId;
    return {
        depth: sameWork ? 'piece' : 'work',
        label: sameWork && previousName ? elideSharedHead(previousName, name) : name,
        name
    };
}

/**
 * Both kinds of boundary carry the seam, because both are the same crossing
 * to the reader. A score that authored its own transition has said how long
 * the silence lasts and what sounds under it; it has not said, and should
 * not have to say, who speaks next.
 */
function markSeam(atom, seam) {
    if (seam) atom.seam = seam;
    return atom;
}

function createSourceBreak(wpm, position, seam = null) {
    return markSeam(new Atom({
        content: '',
        modality: 'text',
        duration: Math.round((60_000 / wpm) * 3),
        weight: 0,
        complexity: 0,
        tags: ['source-break'],
        timingLocked: true,
        position
    }), seam);
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
function createAuthoredBoundary(boundary, position, seam = null) {
    const duration = Math.min(
        Math.max(Math.round(Number(boundary.durationMs) || 0), BOUNDARY_MIN_MS),
        BOUNDARY_MAX_MS
    );
    return markSeam(new Atom({
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
    }), seam);
}

export function compileSession(input = {}) {
    const config = normalizeSessionConfig(input);
    const sources = normalizeSources(config);
    if (sources.length === 0) throw new TypeError('A session requires at least one non-empty text source');

    const atoms = [];
    let previousSource = null;
    for (const source of sources) {
        // A pace scored over this source, if any. With no reading track this
        // is one piece carrying the session's own mode and wpm, so the call
        // below is byte-for-byte the call that has always been made.
        const plan = buildReadingPlan(config.readingProgram, source, {
            chunkMode: config.chunkMode,
            wpm: config.wpm
        });
        assertChunkProfileAllowsRecut(source, plan);
        const mediaCutPoints = sourceSpanCutPoints(config.experienceProgram, source);
        const sourceAtoms = [];
        for (const piece of plan.pieces) {
            // Only an uncut source may carry a profile, so a piece boundary
            // never splits a preparation (see assertChunkProfileAllowsRecut).
            const rawPieceText = plan.pieces.length === 1
                ? source.raw
                : source.raw.slice(piece.fromCharacter, piece.toCharacter);
            const pieceStart = plan.pieces.length === 1 ? 0 : piece.fromCharacter;
            const pieceText = insertSourceScoreCuts(rawPieceText, mediaCutPoints
                .filter(offset => offset > pieceStart && offset < piece.toCharacter)
                .map(offset => offset - pieceStart));
            const prepared = prepareChunkText(
                pieceText,
                plan.pieces.length === 1 ? (source.chunkProfile ?? null) : null
            );
            sourceAtoms.push(...chunkText(prepared.text, {
                mode: piece.mode,
                wpm: piece.wpm,
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
                // A NUMBER IS A FLOOR, AND IT HAS TO SURVIVE THIS HOP.
                // `chunkText` learned to take one so a study could sweep it,
                // and this guard admitted only booleans — so a caller asking
                // for a floor of 8 was handed the shipped 5 without being
                // told. Widened rather than documented as study-only: the two
                // layers disagreeing is the defect, and one of them silently
                // winning is what makes it hard to see.
                phraseFloor: prepared.phraseFloor
                    ?? (typeof config.phraseFloor === 'boolean'
                        || Number.isInteger(config.phraseFloor)
                        ? config.phraseFloor
                        : true),
                verseLines: source.verseLines === true
            }));
        }
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
                b => b.afterSourceId === previousSource.id && b.beforeSourceId === source.id);
            const seam = describeSeam(previousSource, source);
            atoms.push(authored
                ? createAuthoredBoundary(authored, atoms.length, seam)
                : createSourceBreak(config.wpm, atoms.length, seam));
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
        // Progress cues are written in the coordinate `sourceProgress` just
        // supplied, so they are applied here rather than at cut time. A source
        // carrying them has exactly one piece: the canonical validator refuses
        // ranged clips in two coordinate systems on one lane and source.
        const uniformWpm = plan.pieces.length === 1 ? plan.pieces[0].wpm : config.wpm;
        applyProgressPace(sourceAtoms, plan.progressPace, () => uniformWpm);
        previousSource = source;
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
            ...(config.sequenceVisualAssets || [])
                .filter(asset => asset.kind !== 'video')
                .map(asset => asset.uri)
        ].filter(isSessionImageUri))].slice(0, READING_LIMITS.maxSequenceAssets)
    });
}

export function estimateCompiledDuration(input = {}) {
    return compileSession(input).totalDuration;
}
