/**
 * The Journey compiler — an authored argument, lowered into cues.
 *
 * A Journey manifest is editorial: it states a thesis, orders movements,
 * and says what each movement does to the reader that no other movement
 * can. None of that is executable. This module turns it into the three
 * bounded programs the runtime already knows how to follow, and it is
 * the only place that understands both vocabularies.
 *
 * THE THREE-LAYER LAW (JOURNEYS-SPEC §5)
 * ──────────────────────────────────────
 * This compiler touches no DOM, no AudioContext, no cortex, and no
 * Player. It is a pure function from a manifest to data. The Chamber
 * receives movement labels and generic cues and never learns what
 * "metaphysical" or "industrial" means; the cortex never learns what a
 * movement is; the audio engine never learns what a Journey is.
 *
 * That separation is what keeps a Journey authored rather than
 * programmed. The runtime validates and follows an argument it cannot
 * make.
 *
 * WHY BOUNDARIES ARE SOURCES
 * ──────────────────────────
 * A movement change is not a gap between readings; it is a scored
 * event that owns time. So each authored transition becomes a synthetic
 * source — `journey-boundary:<id>` — that carries its own visual and
 * audio cue. Atoms already carry `sourceId`, so a boundary needs no new
 * coordinate model, and the Player keeps sole authority over the clock
 * (§4.3): nothing here schedules against wall time.
 *
 * The distinction that buys is exact. A paragraph break inside a
 * movement carries that movement's own sourceId and therefore holds its
 * cue — incidental whitespace changes nothing. An authored boundary
 * carries a different sourceId and therefore changes the cue
 * deliberately. Structural silence and scored transition stop being the
 * same event.
 */

import { readJourneyMovements } from '../content/atrium/journey-segments.js';

const SCHEMA = 'rise.journey.v1';
const MAX_MOVEMENTS = 16;
const MAX_SEGMENTS_PER_MOVEMENT = 32;
const MAX_ID = 160;
const MAX_DURATION_MS = 60_000;
const MAX_FADE_MS = 10_000;

/** The prefix that marks a source as an authored transition, not a text. */
export const BOUNDARY_SOURCE_PREFIX = 'journey-boundary:';

/** V1 audio cue kinds (§7.3). Anything else is refused, not guessed. */
const AUDIO_KINDS = new Set(['hold', 'silence', 'soundscape', 'swell']);

/** V1 visual cue kinds, matching the Chapel's existing vocabulary. */
const VISUAL_KINDS = new Set(['sourced', 'still', 'focal', 'procedural']);

const boundedId = (value) =>
    (typeof value === 'string' ? value.trim().slice(0, MAX_ID) : '');

const boundedMs = (value, max, fallback = null) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.min(Math.round(n), max);
};

const boundedGain = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.min(Math.max(n, 0), 1);
};

export class JourneyCompileError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.name = 'JourneyCompileError';
        this.code = code;
        this.details = details;
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

function normalizeVisualCue(value) {
    if (!value || typeof value !== 'object') return { kind: 'still' };
    const kind = VISUAL_KINDS.has(value.kind) ? value.kind : 'still';
    // `still` and `focal` name nothing to draw from; the other two do.
    // Procedural needs its collections as much as sourced does — they
    // name WHICH engine family renders, and dropping them left a
    // movement asking for "some procedural" and getting whatever the
    // cortex last had.
    if (kind !== 'sourced' && kind !== 'procedural') return { kind };

    const collections = (Array.isArray(value.collections) ? value.collections : [])
        .map(boundedId).filter(Boolean).slice(0, 32);
    // A cue with no pool would show whatever happened to be loaded.
    // Stillness is the honest reading of "no imagery named".
    return collections.length ? { kind, collections } : { kind: 'still' };
}

function normalizeAudioCue(value) {
    if (!value || typeof value !== 'object') return { kind: 'hold' };
    const kind = AUDIO_KINDS.has(value.kind) ? value.kind : 'hold';
    const cue = { kind };
    const fadeMs = boundedMs(value.fadeMs, MAX_FADE_MS);
    if (fadeMs !== null) cue.fadeMs = fadeMs;
    if (kind === 'soundscape') {
        const id = boundedId(value.soundscapeId);
        // Named nothing to play: hold what is already sounding rather
        // than silently substituting a different soundscape.
        if (!id) return { kind: 'hold' };
        cue.soundscapeId = id;
        const gain = boundedGain(value.gain);
        if (gain !== null) cue.gain = gain;
    }
    if (kind === 'swell') {
        const id = boundedId(value.swellId);
        if (!id) return { kind: 'hold' };
        cue.swellId = id;
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
function figureSegments(segment, passageId, movementCue, metrics) {
    const figures = (Array.isArray(segment?.figures) ? segment.figures : [])
        .slice(0, MAX_FIGURES)
        .map(figure => ({
            id: boundedId(figure?.id),
            fromLine: Number(figure?.fromLine),
            engines: (Array.isArray(figure?.engines) ? figure.engines : [])
                .map(boundedId).filter(Boolean)
        }))
        .filter(figure => figure.id && Number.isInteger(figure.fromLine) && figure.fromLine >= 0)
        .sort((a, b) => a.fromLine - b.fromLine);

    if (!figures.length || movementCue.kind !== 'procedural') return [];
    const totalWords = Number(metrics?.totalWords);
    const offsets = Array.isArray(metrics?.wordsBeforeLine) ? metrics.wordsBeforeLine : null;
    if (!offsets || !Number.isFinite(totalWords) || totalWords <= 0) return [];

    const at = line => Math.max(0, Math.min(1,
        (offsets[Math.min(line, offsets.length - 1)] ?? 0) / totalWords));

    const out = [];
    figures.forEach((figure, i) => {
        if (!figure.engines.length) return;   // a declared gap
        const from = at(figure.fromLine);
        const to = i + 1 < figures.length ? at(figures[i + 1].fromLine) : 1;
        if (to <= from) return;
        out.push({
            id: `${passageId}-figure-${figure.id}`,
            match: { sourceIds: [passageId], fromProgress: from, toProgress: to },
            // The family lives on the movement and is inherited. A figure
            // names engines only — otherwise 'paradise-lost' would be
            // written nine more times, and this codebase has already paid
            // four times for a vocabulary kept in two places.
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
 * @returns {{movementProgram: object, visualProgram: object,
 *            audioProgram: object, boundaries: object[]}}
 */
export function compileJourney(journey, options = {}) {
    if (!journey || typeof journey !== 'object') {
        throw new JourneyCompileError('JOURNEY_MISSING', 'No Journey manifest was given.');
    }
    const journeyId = boundedId(journey.id);
    if (!journeyId) {
        throw new JourneyCompileError('JOURNEY_NO_ID', 'A Journey needs an id.');
    }
    if (journey.schemaVersion && journey.schemaVersion !== SCHEMA) {
        throw new JourneyCompileError('JOURNEY_SCHEMA',
            `Unknown Journey schema: ${journey.schemaVersion}.`, { journeyId });
    }

    const authored = readJourneyMovements(journey).slice(0, MAX_MOVEMENTS);
    if (!authored.length) {
        throw new JourneyCompileError('JOURNEY_NO_MOVEMENTS',
            'A Journey needs at least one movement.', { journeyId });
    }

    const movements = [];
    const visualSegments = [];
    const audioSegments = [];
    const boundaries = [];
    const seenMovementIds = new Set();

    authored.forEach((movement, index) => {
        const id = boundedId(movement?.id);
        if (!id) {
            throw new JourneyCompileError('MOVEMENT_NO_ID',
                `Movement ${index} has no id.`, { journeyId, index });
        }
        if (seenMovementIds.has(id)) {
            // Two movements under one id would make the movement
            // program ambiguous and restart non-deterministic.
            throw new JourneyCompileError('MOVEMENT_DUPLICATE_ID',
                `Two movements share the id ${id}.`, { journeyId, id });
        }
        seenMovementIds.add(id);

        const segments = (Array.isArray(movement.segments) ? movement.segments : [])
            .slice(0, MAX_SEGMENTS_PER_MOVEMENT);
        const sourceIds = segments.map(s => boundedId(s?.passageId)).filter(Boolean);
        if (!sourceIds.length) {
            throw new JourneyCompileError('MOVEMENT_NO_SEGMENTS',
                `Movement ${id} names no passages.`, { journeyId, id });
        }

        movements.push({
            id,
            index,
            title: boundedId(movement.title) || null,
            sourceIds
        });

        const presentation = movement.presentation || {};
        const movementCue = normalizeVisualCue(presentation.visual);
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
        segments.forEach(segment => {
            const passageId = boundedId(segment?.passageId);
            if (!passageId) return;
            for (const ranged of figureSegments(segment, passageId, movementCue,
                options.passageMetrics?.[passageId])) {
                visualSegments.push(ranged);
            }
        });
        audioSegments.push({
            id: `${id}-audio`,
            match: { sourceIds },
            cue: normalizeAudioCue(presentation.audio)
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
            const tid = boundedId(out.id) || `${id}-seg-${s}`;
            boundaries.push({
                id: tid,
                sourceId: boundarySourceId(tid),
                fromMovementId: id,
                toMovementId: id,
                afterSourceId: sourceIds[s],
                beforeSourceId: nextSource,
                durationMs: boundedMs(out.durationMs, MAX_DURATION_MS, 1200)
            });
            visualSegments.push({
                id: `${tid}-visual`,
                match: { sourceIds: [boundarySourceId(tid)] },
                cue: normalizeVisualCue(out.visual)
            });
            audioSegments.push({
                id: `${tid}-audio`,
                match: { sourceIds: [boundarySourceId(tid)] },
                cue: normalizeAudioCue(out.audio)
            });
        });

        // A transition belongs BETWEEN movements. One authored after the
        // last movement is a coda — a scored ending — and it is kept, but
        // it names no destination and joins nothing.
        const out = movement.transitionOut;
        if (!out) return;
        const transitionId = boundedId(out.id) || `${id}-out`;
        const sourceId = boundarySourceId(transitionId);
        const next = authored[index + 1];
        // The compiler knows the reading order, so it knows which two
        // passages actually meet: the last of this movement and the
        // first of the next. Leaving that to a later stage meant two
        // places had to agree about the same join.
        const nextSegments = Array.isArray(next?.segments) ? next.segments : [];
        const nextFirst = nextSegments
            .map(seg => boundedId(seg?.passageId)).filter(Boolean)[0] || null;

        boundaries.push({
            id: transitionId,
            sourceId,
            fromMovementId: id,
            toMovementId: next ? boundedId(next.id) || null : null,
            afterSourceId: sourceIds[sourceIds.length - 1],
            beforeSourceId: nextFirst,
            durationMs: boundedMs(out.durationMs, MAX_DURATION_MS, 1200)
        });
        visualSegments.push({
            id: `${transitionId}-visual`,
            match: { sourceIds: [sourceId] },
            cue: normalizeVisualCue(out.visual)
        });
        audioSegments.push({
            id: `${transitionId}-audio`,
            match: { sourceIds: [sourceId] },
            cue: normalizeAudioCue(out.audio)
        });
    });

    return {
        movementProgram: {
            schema: 'rise.movement-program.v1',
            journeyId,
            movements,
            boundaries
        },
        visualProgram: {
            coordinateSpace: 'source',
            segments: visualSegments,
            fallback: { kind: 'still' }
        },
        audioProgram: {
            coordinateSpace: 'source',
            segments: audioSegments,
            // Silence rather than hold: a reading that falls outside
            // every authored cue should not inherit whatever the last
            // movement happened to be playing.
            fallback: { kind: 'silence', fadeMs: 500 }
        },
        boundaries
    };
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
