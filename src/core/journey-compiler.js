/**
 * The Journey compiler — an authored argument, lowered into cues.
 *
 * A Journey manifest is editorial: it states a thesis, orders movements,
 * and says what each movement does to the reader that no other movement
 * can. None of that is executable. This module authors one canonical
 * `rise.experience-program.v1` score, then lowers it through the sole
 * compatibility adapter into the schedules the current runtime follows.
 *
 * THE THREE-LAYER LAW (JOURNEYS-SPEC §5)
 * ──────────────────────────────────────
 * Pure function: manifest → data. No DOM, AudioContext, cortex, or
 * Player. Chamber gets labels and generic cues; cortex never learns
 * movements; audio never learns Journeys. Runtime validates an argument
 * it cannot author.
 *
 * Boundaries are sources: each authored transition is
 * `journey-boundary:<id>` with its own cues. Paragraph breaks keep the
 * movement's sourceId; authored boundaries change it. Player alone owns
 * the clock (§4.3).
 */

import { readJourneyMovements } from '../content/journeys/journey-segments.js';
import {
    createExperienceProgram,
    lowerExperienceProgram,
    EXPERIENCE_PROGRAM_LIMITS,
    EXPERIENCE_PROGRAM_SCHEMA
} from './experience-program.js';

const SCHEMA = 'rise.journey.v1';
const MAX_MOVEMENTS = EXPERIENCE_PROGRAM_LIMITS.maxMovements;
const MAX_SEGMENTS_PER_MOVEMENT = 32;
const MAX_ID = EXPERIENCE_PROGRAM_LIMITS.maxIdLength;
const MIN_DURATION_MS = EXPERIENCE_PROGRAM_LIMITS.minTransitionDurationMs;
const MAX_DURATION_MS = EXPERIENCE_PROGRAM_LIMITS.maxTransitionDurationMs;
const MAX_FADE_MS = EXPERIENCE_PROGRAM_LIMITS.maxFadeMs;
const MAX_BOUNDARIES = EXPERIENCE_PROGRAM_LIMITS.maxTransitions;

/** The prefix that marks a source as an authored transition, not a text. */
export const BOUNDARY_SOURCE_PREFIX = 'journey-boundary:';

/** V1 audio cue kinds (§7.3). Anything else is refused, not guessed. */
const AUDIO_KINDS = new Set(['hold', 'silence', 'soundscape', 'swell']);

/** V1 visual cue kinds, matching the Chapel's existing vocabulary. */
const VISUAL_KINDS = new Set(['sourced', 'still', 'focal', 'procedural']);

const boundedId = (value) =>
    (typeof value === 'string' ? value.trim().slice(0, MAX_ID) : '');

export class JourneyCompileError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.name = 'JourneyCompileError';
        this.code = code;
        this.details = details;
    }
}

function authoredId(value, path) {
    if (typeof value !== 'string' || !value || value !== value.trim()) {
        throw new JourneyCompileError('JOURNEY_INVALID_ID',
            `${path} must be a non-empty, trimmed string.`, { path });
    }
    if (value.length > MAX_ID) {
        throw new JourneyCompileError('JOURNEY_ID_TOO_LONG',
            `${path} exceeds ${MAX_ID} characters.`, { path, length: value.length });
    }
    return value;
}

function authoredMs(value, min, max, fallback, path) {
    if (value === undefined || value === null) return fallback;
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new JourneyCompileError('JOURNEY_DURATION_RANGE',
            `${path} must be an integer between ${min} and ${max}.`, { path, value });
    }
    return value;
}

function authoredTitle(value, path) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || value.length > 200) {
        throw new JourneyCompileError('JOURNEY_INVALID_TITLE',
            `${path} must be text no longer than 200 characters.`, { path });
    }
    return value;
}

function authoredGain(value, path) {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        throw new JourneyCompileError('JOURNEY_GAIN_RANGE',
            `${path} must be between 0 and 1.`, { path, value });
    }
    return value;
}

function assertCueFields(value, allowed, path) {
    for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
            throw new JourneyCompileError('JOURNEY_UNKNOWN_CUE_FIELD',
                `Unknown cue field ${key} at ${path}.`, { path: `${path}.${key}` });
        }
    }
}

/** The synthetic source id an authored transition reads under. */
export function boundarySourceId(transitionId) {
    return `${BOUNDARY_SOURCE_PREFIX}${boundedId(transitionId)}`;
}

/** Is this source id an authored transition rather than a text? */
export function isBoundarySource(sourceId) {
    return typeof sourceId === 'string' && sourceId.startsWith(BOUNDARY_SOURCE_PREFIX);
}

function normalizeVisualCue(value, path) {
    if (value === undefined || value === null) return { kind: 'still' };
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new JourneyCompileError('JOURNEY_VISUAL_CUE',
            `${path} must be a visual cue object.`, { path });
    }
    if (!VISUAL_KINDS.has(value.kind)) {
        throw new JourneyCompileError('JOURNEY_VISUAL_KIND',
            `Unknown visual cue kind ${String(value.kind)} at ${path}.`, { path, kind: value.kind });
    }
    const kind = value.kind;
    const fields = new Set(['kind']);
    if (kind === 'focal') fields.add('focal');
    if (kind === 'sourced' || kind === 'procedural') fields.add('collections');
    assertCueFields(value, fields, path);
    // `still` and `focal` name nothing to draw from; the other two do.
    // Procedural needs its collections as much as sourced does — they
    // name WHICH engine family renders, and dropping them left a
    // movement asking for "some procedural" and getting whatever the
    // cortex last had.
    if (kind === 'still') return { kind };
    if (kind === 'focal') {
        return value.focal && typeof value.focal === 'object' && !Array.isArray(value.focal)
            ? { kind, focal: { ...value.focal } }
            : { kind, focal: {} };
    }

    if (!Array.isArray(value.collections) || value.collections.length === 0) {
        throw new JourneyCompileError('JOURNEY_VISUAL_COLLECTIONS',
            `${path} must name at least one collection.`, { path, kind });
    }
    if (value.collections.length > EXPERIENCE_PROGRAM_LIMITS.maxCollections) {
        throw new JourneyCompileError('JOURNEY_VISUAL_COLLECTIONS',
            `${path} names too many collections.`, { path, count: value.collections.length });
    }
    const collections = value.collections.map((id, index) =>
        authoredId(id, `${path}.collections[${index}]`));
    if (new Set(collections).size !== collections.length) {
        throw new JourneyCompileError('JOURNEY_DUPLICATE_COLLECTION',
            `${path} names the same collection more than once.`, { path });
    }
    return { kind, collections };
}

function normalizeAudioCue(value, path) {
    if (value === undefined || value === null) return { kind: 'hold' };
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new JourneyCompileError('JOURNEY_AUDIO_CUE',
            `${path} must be an audio cue object.`, { path });
    }
    if (!AUDIO_KINDS.has(value.kind)) {
        throw new JourneyCompileError('JOURNEY_AUDIO_KIND',
            `Unknown audio cue kind ${String(value.kind)} at ${path}.`, { path, kind: value.kind });
    }
    const kind = value.kind;
    const fields = new Set(['kind', 'fadeMs']);
    if (kind === 'soundscape') {
        fields.add('soundscapeId');
        fields.add('gain');
    }
    if (kind === 'swell') fields.add('swellId');
    assertCueFields(value, fields, path);
    const cue = { kind };
    const fadeMs = authoredMs(value.fadeMs, 0, MAX_FADE_MS, null, `${path}.fadeMs`);
    if (fadeMs !== null) cue.fadeMs = fadeMs;
    if (kind === 'soundscape') {
        cue.soundscapeId = authoredId(value.soundscapeId, `${path}.soundscapeId`);
        const gain = authoredGain(value.gain, `${path}.gain`);
        if (gain !== null) cue.gain = gain;
    }
    if (kind === 'swell') {
        cue.swellId = authoredId(value.swellId, `${path}.swellId`);
    }
    return cue;
}

/** How many figures one passage may carry. */
const MAX_FIGURES = 32;

/**
 * Lower one passage's authored figures into ranged visual segments.
 *
 * Each figure runs from its own line to the next figure's line, so an
 * author states where a figure BEGINS and never has to keep two ends in
 * sync. The last runs to the end of the passage.
 *
 * A figure that names no engine emits nothing. That is deliberate and is
 * how a gap is expressed: Milton's opening — heaven in order, before the
 * war — has no engine written for it yet, and rather than assign a wrong
 * one it declares itself with `wanted` and falls through to the
 * movement's own cue. What a reader sees there is the family in
 * rotation, which is what they saw everywhere before figures existed.
 *
 * Without metrics (the compiler is pure; only the handoff has the text)
 * no figure can be placed, and the movement keeps its single cue.
 */
function figureSegments(segment, passageId, movementCue, metrics, path) {
    const rawFigures = segment?.figures;
    if (rawFigures === undefined || rawFigures === null) return [];
    if (!Array.isArray(rawFigures)) {
        throw new JourneyCompileError('JOURNEY_FIGURES',
            `${path}.figures must be an array.`, { path: `${path}.figures` });
    }
    if (rawFigures.length > MAX_FIGURES) {
        throw new JourneyCompileError('JOURNEY_TOO_MANY_FIGURES',
            `${path} exceeds ${MAX_FIGURES} figures.`, { path, count: rawFigures.length });
    }
    const figures = rawFigures.map((figure, index) => {
        const figurePath = `${path}.figures[${index}]`;
        if (!figure || typeof figure !== 'object' || Array.isArray(figure)) {
            throw new JourneyCompileError('JOURNEY_FIGURE',
                `${figurePath} must be an object.`, { path: figurePath });
        }
        if (!Number.isInteger(figure.fromLine) || figure.fromLine < 0) {
            throw new JourneyCompileError('JOURNEY_FIGURE_LINE',
                `${figurePath}.fromLine must be a non-negative integer.`, { path: figurePath });
        }
        if (figure.engines !== undefined && !Array.isArray(figure.engines)) {
            throw new JourneyCompileError('JOURNEY_FIGURE_ENGINES',
                `${figurePath}.engines must be an array.`, { path: figurePath });
        }
        const rawEngines = figure.engines || [];
        if (rawEngines.length > EXPERIENCE_PROGRAM_LIMITS.maxEngines) {
            throw new JourneyCompileError('JOURNEY_FIGURE_ENGINES',
                `${figurePath} names too many engines.`, { path: figurePath, count: rawEngines.length });
        }
        const engines = rawEngines.map((id, engineIndex) =>
            authoredId(id, `${figurePath}.engines[${engineIndex}]`));
        if (new Set(engines).size !== engines.length) {
            throw new JourneyCompileError('JOURNEY_DUPLICATE_ENGINE',
                `${figurePath} names the same engine more than once.`, { path: figurePath });
        }
        return {
            id: authoredId(figure.id, `${figurePath}.id`),
            fromLine: figure.fromLine,
            engines
        };
    }).sort((a, b) => a.fromLine - b.fromLine);

    if (new Set(figures.map(figure => figure.id)).size !== figures.length) {
        throw new JourneyCompileError('JOURNEY_DUPLICATE_FIGURE',
            `${path} contains duplicate figure ids.`, { path });
    }
    if (new Set(figures.map(figure => figure.fromLine)).size !== figures.length) {
        throw new JourneyCompileError('JOURNEY_DUPLICATE_FIGURE_LINE',
            `${path} starts two figures on the same line.`, { path });
    }

    if (!figures.length || movementCue.kind !== 'procedural') return [];
    const totalWords = Number(metrics?.totalWords);
    const offsets = Array.isArray(metrics?.wordsBeforeLine) ? metrics.wordsBeforeLine : null;
    if (!offsets || !Number.isFinite(totalWords) || totalWords <= 0) return [];

    const at = line => Math.max(0, Math.min(1,
        (offsets[Math.min(line, offsets.length - 1)] ?? 0) / totalWords));

    const out = [];
    figures.forEach((figure, i) => {
        if (figure.fromLine >= offsets.length - 1) {
            throw new JourneyCompileError('JOURNEY_FIGURE_OUT_OF_RANGE',
                `${path} places figure ${figure.id} beyond the passage.`,
                { path, figureId: figure.id, fromLine: figure.fromLine });
        }
        if (!figure.engines.length) return;   // a declared gap
        const from = at(figure.fromLine);
        const to = i + 1 < figures.length ? at(figures[i + 1].fromLine) : 1;
        if (to <= from) return;
        out.push({
            id: `${passageId}-figure-${figure.id}`,
            match: { sourceIds: [passageId], fromProgress: from, toProgress: to },
            // Family is inherited from the movement; figures name engines only.
            cue: { ...movementCue, engines: figure.engines }
        });
    });
    return out;
}

/**
 * Lower an authored Journey into runtime programs.
 *
 * Refuses rather than approximates (§1.5, and the Chapel's rule): a
 * manifest that cannot be compiled is an error a caller renders as a
 * quiet message, never a Journey with a movement quietly dropped.
 *
 * @param {object} journey an authored manifest
 * @param {object} [options]
 * @param {object} [options.passageMetrics] passageId -> {wordsBeforeLine,
 *   totalWords}. Only the handoff has the resolved text, so only the
 *   handoff can place a figure at a line; without this the compiler is
 *   pure and each movement keeps its single cue.
 * @returns {{experienceProgram: object, movementProgram: object,
 *            visualProgram: object, audioProgram: object,
 *            boundaries: object[], sourceBoundaries: object[]}}
 */
export function compileJourney(journey, options = {}) {
    if (!journey || typeof journey !== 'object') {
        throw new JourneyCompileError('JOURNEY_MISSING', 'No Journey manifest was given.');
    }
    if (typeof journey.id !== 'string' || !journey.id.trim()) {
        throw new JourneyCompileError('JOURNEY_NO_ID', 'A Journey needs an id.');
    }
    const journeyId = authoredId(journey.id, 'journey.id');

    const authored = readJourneyMovements(journey);
    if (!authored.length) {
        throw new JourneyCompileError('JOURNEY_NO_MOVEMENTS',
            'A Journey needs at least one movement.', { journeyId });
    }
    // Flat segment records predate authored Journeys and remain an explicit
    // legacy input adapter. A manifest that declares movements is the new
    // authored shape and must identify its schema; omission is not v1.
    const declaresMovements = Array.isArray(journey.movements) && journey.movements.length > 0;
    if ((declaresMovements && journey.schemaVersion !== SCHEMA)
        || (!declaresMovements && journey.schemaVersion && journey.schemaVersion !== SCHEMA)) {
        throw new JourneyCompileError('JOURNEY_SCHEMA',
            `Unknown Journey schema: ${journey.schemaVersion || '(missing)'}.`, { journeyId });
    }
    if (authored.length > MAX_MOVEMENTS) {
        throw new JourneyCompileError('JOURNEY_TOO_MANY_MOVEMENTS',
            `A Journey may not exceed ${MAX_MOVEMENTS} movements.`,
            { journeyId, count: authored.length });
    }

    const movements = [];
    const visualSegments = [];
    const audioSegments = [];
    const boundaries = [];
    const seenMovementIds = new Set();
    const seenSourceIds = new Set();
    const seenBoundaryIds = new Set();

    authored.forEach((movement, index) => {
        if (!movement || typeof movement !== 'object' || Array.isArray(movement)) {
            throw new JourneyCompileError('MOVEMENT_INVALID',
                `Movement ${index} must be an object.`, { journeyId, index });
        }
        if (typeof movement.id !== 'string' || !movement.id.trim()) {
            throw new JourneyCompileError('MOVEMENT_NO_ID',
                `Movement ${index} has no id.`, { journeyId, index });
        }
        const id = authoredId(movement.id, `movements[${index}].id`);
        if (seenMovementIds.has(id)) {
            // Two movements under one id would make the movement
            // program ambiguous and restart non-deterministic.
            throw new JourneyCompileError('MOVEMENT_DUPLICATE_ID',
                `Two movements share the id ${id}.`, { journeyId, id });
        }
        seenMovementIds.add(id);

        if (!Array.isArray(movement.segments) || !movement.segments.length) {
            throw new JourneyCompileError('MOVEMENT_NO_SEGMENTS',
                `Movement ${id} names no passages.`, { journeyId, id });
        }
        if (movement.segments.length > MAX_SEGMENTS_PER_MOVEMENT) {
            throw new JourneyCompileError('MOVEMENT_TOO_MANY_SEGMENTS',
                `Movement ${id} may not exceed ${MAX_SEGMENTS_PER_MOVEMENT} passages.`,
                { journeyId, id, count: movement.segments.length });
        }
        const segments = movement.segments;
        const sourceIds = segments.map((segment, segmentIndex) => {
            if (!segment || typeof segment !== 'object' || Array.isArray(segment)) {
                throw new JourneyCompileError('SEGMENT_INVALID',
                    `Movement ${id} segment ${segmentIndex} must be an object.`,
                    { journeyId, id, segmentIndex });
            }
            const sourceId = authoredId(
                segment.passageId,
                `movements[${index}].segments[${segmentIndex}].passageId`
            );
            if (seenSourceIds.has(sourceId)) {
                throw new JourneyCompileError('JOURNEY_DUPLICATE_PASSAGE',
                    `Passage ${sourceId} appears more than once in the Journey.`,
                    { journeyId, sourceId });
            }
            seenSourceIds.add(sourceId);
            return sourceId;
        });

        movements.push({
            id,
            index,
            title: authoredTitle(movement.title, `movements[${index}].title`),
            sourceIds
        });

        const presentation = movement.presentation || {};
        const movementCue = normalizeVisualCue(
            presentation.visual,
            `movements[${index}].presentation.visual`
        );
        visualSegments.push({
            id: `${id}-visual`,
            match: { sourceIds },
            cue: movementCue
        });
        // FIGURES: the movement's cue, narrowed to places in the text.
        //
        // A movement-wide procedural cue says "something of Milton's"
        // for six thousand words. Book VI is not one image — it is the
        // sword at 250, the sulphurous invention at 512, the chariot at
        // 750, the fall at 864 — and an engine that appears at random
        // against any of them is decoration. A figure names a line and
        // the engine that reads it.
        //
        // Figures are declared on the SEGMENT rather than the movement
        // because a line number is a coordinate inside one passage, and
        // a movement may hold several.
        segments.forEach((segment, segmentIndex) => {
            const passageId = sourceIds[segmentIndex];
            for (const ranged of figureSegments(segment, passageId, movementCue,
                options.passageMetrics?.[passageId],
                `movements[${index}].segments[${segmentIndex}]`)) {
                visualSegments.push(ranged);
            }
        });
        audioSegments.push({
            id: `${id}-audio`,
            match: { sourceIds },
            cue: normalizeAudioCue(
                presentation.audio,
                `movements[${index}].presentation.audio`
            )
        });

        // A boundary between ADJACENT PASSAGES inside this movement
        // (§3.1: "an authored boundary between every adjacent passage").
        // Hector at the Scaean gate and Hector dead are one movement and
        // sixteen books apart; three beats of the reading's own pace is
        // not what sits between them. Declared per segment, because only
        // an author knows how long that gap is.
        segments.forEach((segment, s) => {
            const out = segment?.transitionOut;
            const nextSource = sourceIds[s + 1];
            if (!out || !nextSource) return;
            if (typeof out !== 'object' || Array.isArray(out)) {
                throw new JourneyCompileError('JOURNEY_TRANSITION',
                    `Movement ${id} segment ${s} transition must be an object.`,
                    { journeyId, id, segmentIndex: s });
            }
            const transitionPath = `movements[${index}].segments[${s}].transitionOut`;
            const tid = out.id === undefined
                ? authoredId(`${id}-seg-${s}`, `${transitionPath}.id`)
                : authoredId(out.id, `${transitionPath}.id`);
            if (seenBoundaryIds.has(tid)) {
                throw new JourneyCompileError('JOURNEY_DUPLICATE_TRANSITION',
                    `Two transitions share the id ${tid}.`, { journeyId, id: tid });
            }
            seenBoundaryIds.add(tid);
            boundaries.push({
                id: tid,
                sourceId: boundarySourceId(tid),
                fromMovementId: id,
                toMovementId: id,
                afterSourceId: sourceIds[s],
                beforeSourceId: nextSource,
                durationMs: authoredMs(
                    out.durationMs, MIN_DURATION_MS, MAX_DURATION_MS, 1200,
                    `${transitionPath}.durationMs`)
            });
            visualSegments.push({
                id: `${tid}-visual`,
                match: { sourceIds: [boundarySourceId(tid)] },
                cue: normalizeVisualCue(out.visual, `${transitionPath}.visual`)
            });
            audioSegments.push({
                id: `${tid}-audio`,
                match: { sourceIds: [boundarySourceId(tid)] },
                cue: normalizeAudioCue(out.audio, `${transitionPath}.audio`)
            });
        });

        // A transition belongs BETWEEN movements. One authored after the
        // last movement is a coda — a scored ending — and it is kept, but
        // it names no destination and joins nothing.
        const out = movement.transitionOut;
        if (!out) return;
        if (typeof out !== 'object' || Array.isArray(out)) {
            throw new JourneyCompileError('JOURNEY_TRANSITION',
                `Movement ${id} transition must be an object.`, { journeyId, id });
        }
        const transitionPath = `movements[${index}].transitionOut`;
        const transitionId = out.id === undefined
            ? authoredId(`${id}-out`, `${transitionPath}.id`)
            : authoredId(out.id, `${transitionPath}.id`);
        if (seenBoundaryIds.has(transitionId)) {
            throw new JourneyCompileError('JOURNEY_DUPLICATE_TRANSITION',
                `Two transitions share the id ${transitionId}.`, { journeyId, id: transitionId });
        }
        seenBoundaryIds.add(transitionId);
        const sourceId = boundarySourceId(transitionId);
        const next = authored[index + 1];
        // The compiler knows the reading order, so it knows which two
        // passages actually meet: the last of this movement and the
        // first of the next. Leaving that to a later stage meant two
        // places had to agree about the same join.
        const nextSegments = Array.isArray(next?.segments) ? next.segments : [];
        const nextFirst = nextSegments
            .map(seg => typeof seg?.passageId === 'string' ? seg.passageId : '').filter(Boolean)[0] || null;

        boundaries.push({
            id: transitionId,
            sourceId,
            fromMovementId: id,
            toMovementId: next ? authoredId(next.id, `movements[${index + 1}].id`) : null,
            afterSourceId: sourceIds[sourceIds.length - 1],
            beforeSourceId: nextFirst,
            durationMs: authoredMs(
                out.durationMs, MIN_DURATION_MS, MAX_DURATION_MS, 1200,
                `${transitionPath}.durationMs`)
        });
        visualSegments.push({
            id: `${transitionId}-visual`,
            match: { sourceIds: [sourceId] },
            cue: normalizeVisualCue(out.visual, `${transitionPath}.visual`)
        });
        audioSegments.push({
            id: `${transitionId}-audio`,
            match: { sourceIds: [sourceId] },
            cue: normalizeAudioCue(out.audio, `${transitionPath}.audio`)
        });
    });

    if (boundaries.length > MAX_BOUNDARIES) {
        throw new JourneyCompileError('JOURNEY_TOO_MANY_BOUNDARIES',
            `A Journey may not exceed ${MAX_BOUNDARIES} authored transitions.`,
            { journeyId, count: boundaries.length });
    }

    // The Journey compiler now authors ONE score. The three runtime
    // schedules returned beside it are compatibility projections made by
    // one adapter, never independently maintained results.
    const audioBed = audioSegments.filter(segment => segment.cue.kind !== 'swell');
    const audioEvents = audioSegments.filter(segment => segment.cue.kind === 'swell');
    const experienceProgram = createExperienceProgram({
        schema: EXPERIENCE_PROGRAM_SCHEMA,
        id: journeyId,
        authority: 'published',
        editable: false,
        tracks: [
            {
                id: 'movements',
                kind: 'movement',
                clips: movements.map(movement => ({
                    id: movement.id,
                    anchor: { sourceIds: movement.sourceIds },
                    data: { index: movement.index, title: movement.title }
                }))
            },
            {
                id: 'transitions',
                kind: 'transition',
                clips: boundaries.map(boundary => ({
                    id: boundary.id,
                    anchor: {
                        sourceIds: [boundary.sourceId],
                        afterSourceId: boundary.afterSourceId,
                        beforeSourceId: boundary.beforeSourceId
                    },
                    data: {
                        fromMovementId: boundary.fromMovementId,
                        toMovementId: boundary.toMovementId
                    },
                    durationMs: boundary.durationMs
                }))
            },
            {
                id: 'visual-main',
                kind: 'visual',
                clips: visualSegments.map(segment => ({
                    id: segment.id,
                    anchor: segment.match,
                    cue: segment.cue
                })),
                fallback: { kind: 'still' }
            },
            {
                id: 'audio-bed',
                kind: 'audio',
                clips: audioBed.map(segment => ({
                    id: segment.id,
                    anchor: segment.match,
                    cue: segment.cue
                })),
                // Silence rather than hold: a reading outside every
                // authored clip must not inherit the previous session.
                fallback: { kind: 'silence', fadeMs: 500 }
            },
            {
                id: 'audio-events',
                kind: 'swell',
                clips: audioEvents.map(segment => ({
                    id: segment.id,
                    anchor: segment.match,
                    cue: segment.cue
                }))
            }
        ],
        metadata: {
            kind: 'journey',
            journeySchema: declaresMovements ? SCHEMA : 'legacy-flat'
        }
    });
    return lowerExperienceProgram(experienceProgram);
}

/**
 * The cue a source reads under, for a compiled program.
 *
 * The coordinate adapter §7.2 describes: `scripture` reads (chapter,
 * verse); `source` reads a sourceId. Kept here rather than in the
 * scheduler so the scheduler stays domain-blind.
 */
export function cueForSource(program, sourceId) {
    if (program?.coordinateSpace !== 'source') return null;
    const id = boundedId(sourceId);
    for (const segment of program.segments || []) {
        if (segment?.match?.sourceIds?.includes(id)) return segment.cue;
    }
    return program.fallback || null;
}

/** Which movement a source belongs to, or null for a boundary or stranger. */
export function movementForSource(movementProgram, sourceId) {
    const id = boundedId(sourceId);
    for (const movement of movementProgram?.movements || []) {
        if (movement.sourceIds.includes(id)) return movement;
    }
    return null;
}
