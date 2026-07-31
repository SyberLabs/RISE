/**
 * The Journey → Chamber boundary.
 *
 * The last seam. Everything above it is authored or compiled; below it
 * a reader is inside a reading. This resolves the passages, lowers the
 * manifest, and produces the one payload the app already knows how to
 * launch — text, a source label, and a config.
 *
 * FAIL CLOSED, like the Atrium and the Chapel before it. A Journey that
 * cannot be assembled throws a typed error the caller renders as a
 * quiet message; nothing here substitutes a passage, drops a movement,
 * or launches a partial argument. A Journey missing a step is not a
 * shorter Journey, it is a different one.
 *
 * The compiler locates every boundary, because it knows the reading
 * order; this only drops the ones that join nothing. An earlier version
 * worked the joins out here as well, which meant two places had to
 * agree — and they did, right up until Hector's movement took a second
 * passage.
 */

import { compileJourney } from '../../core/journey-compiler.js';
import { resolveJourneyPassages, verifyPassageChecksums } from './passages.js';
import { readJourneyMovements } from '../atrium/journey-segments.js';

export class JourneyHandoffError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.name = 'JourneyHandoffError';
        this.code = code;
        this.details = details;
    }
}

/**
 * The boundaries that actually join two passages.
 *
 * The compiler knows the reading order and records which sources meet
 * at each transition, so this only filters. A coda after the final
 * movement joins nothing: it stays in the movement program for
 * reporting and has no atom, because there is no break to replace.
 *
 * An earlier version located the passages here instead, which meant two
 * places had to agree about the same join. They did, until Hector's
 * movement got a second passage.
 */
function joinableBoundaries(boundaries) {
    return boundaries
        .filter(b => b.afterSourceId && b.beforeSourceId)
        .map(b => ({
            id: b.id,
            sourceId: b.sourceId,
            afterSourceId: b.afterSourceId,
            beforeSourceId: b.beforeSourceId,
            kind: b.fromMovementId === b.toMovementId ? 'passage' : 'movement',
            durationMs: b.durationMs
        }));
}

/**
 * Where every line of a passage falls, measured in words.
 *
 * Words rather than characters because the reading is chunked and paced
 * by words, so a word offset converts to the same coordinate an atom
 * carries. Blank lines are kept in the index — an author counting lines
 * in the text counts what is printed, and Milton's line 750 has to mean
 * the line the edition prints as 750.
 *
 * @param {string} text
 * @returns {{wordsBeforeLine: number[], totalWords: number}}
 */
export function passageLineMetrics(text) {
    const lines = String(text ?? '').split(/\r?\n/);
    const wordsBeforeLine = new Array(lines.length + 1);
    let running = 0;
    for (let i = 0; i < lines.length; i += 1) {
        wordsBeforeLine[i] = running;
        const words = lines[i].split(/\s+/).filter(Boolean).length;
        running += words;
    }
    wordsBeforeLine[lines.length] = running;
    return { wordsBeforeLine, totalWords: running };
}

/**
 * Assemble a Journey for launch.
 *
 * @param {object} journey an authored manifest
 * @param {object[]} passages the passage records it names
 * @param {{checksums?: object, texts?: object[]}} [options]
 * @returns {Promise<{text: string, source: string, config: object}>}
 */
export async function createJourneyHandoff(journey, passages, options = {}) {
    if (!journey || typeof journey !== 'object') {
        throw new JourneyHandoffError('JOURNEY_MISSING', 'No Journey was given.');
    }
    if (journey.status && journey.status !== 'publishable') {
        // A blocked Journey has said in its own record that it is not
        // ready. Launching it anyway would make `status` decorative.
        throw new JourneyHandoffError(
            'JOURNEY_NOT_PUBLISHABLE',
            `${journey.title || journey.id} is not publishable.`,
            { journeyId: journey.id, status: journey.status, open: journey.openRequirements || [] }
        );
    }

    // Compile first: a manifest that cannot be lowered must not send
    // anyone to the network for text it will not use.
    let programs;
    try {
        programs = compileJourney(journey);
    } catch (error) {
        throw new JourneyHandoffError('JOURNEY_COMPILE_FAILED', error.message,
            { journeyId: journey.id, cause: error.code });
    }

    const ordered = readJourneyMovements(journey).flatMap(m => m.segments);
    const byId = new Map((passages || []).map(p => [p.id, p]));
    const wanted = ordered.map(segment => {
        const passage = byId.get(segment.passageId);
        if (!passage) {
            throw new JourneyHandoffError('JOURNEY_PASSAGE_UNKNOWN',
                `No passage record for ${segment.passageId}.`,
                { journeyId: journey.id, passageId: segment.passageId });
        }
        return { ...passage, role: segment.role || passage.role || null };
    });

    const { resolved, failures, ready } = await resolveJourneyPassages(wanted, options.texts);
    if (!ready) {
        throw new JourneyHandoffError('JOURNEY_PASSAGE_UNRESOLVED',
            'A passage could not be resolved against the Archive.',
            { journeyId: journey.id, failures });
    }

    // A recorded checksum that no longer matches means the text moved
    // under an argument written about it (§1.3). That is a refusal.
    const { drifted, intact } = verifyPassageChecksums(resolved, options.checksums || {});
    if (!intact) {
        throw new JourneyHandoffError('JOURNEY_PASSAGE_DRIFT',
            'A passage no longer matches the text this Journey was written about.',
            { journeyId: journey.id, drifted });
    }

    // RECOMPILE, NOW THAT THE TEXT IS HERE AND VERIFIED.
    //
    // A figure is authored at a line — the sword at Milton's 250, the
    // chariot at 750 — and a line is only a place once you hold the
    // passage. The first compile above is the gate: it refuses a broken
    // manifest before anyone is sent to the network. This one places the
    // figures.
    //
    // Deliberately after the checksum check. Line numbers are an
    // assertion about a specific text, so measuring them against one
    // that has drifted would put the chariot wherever the drift left it.
    const passageMetrics = {};
    for (const passage of resolved) {
        passageMetrics[passage.id] = passageLineMetrics(passage.text);
    }
    try {
        programs = compileJourney(journey, { passageMetrics });
    } catch (error) {
        throw new JourneyHandoffError('JOURNEY_COMPILE_FAILED', error.message,
            { journeyId: journey.id, cause: error.code });
    }

    const sources = resolved.map(passage => ({
        id: passage.id,
        name: `${passage.title} · ${passage.label}`,
        type: 'text',
        providerId: 'journey',
        data: passage.text,
        // §1.3: every difference that makes the relation meaningful
        // travels with the passage. The Journey creates a relation; it
        // may not erase what the works are.
        provenance: {
            kind: 'journey-passage',
            journeyId: journey.id,
            journeyTitle: journey.title,
            passageId: passage.id,
            workId: passage.workId,
            workTitle: passage.title,
            author: passage.author,
            division: passage.division,
            label: passage.label,
            edition: passage.edition,
            language: passage.language,
            segmentRole: passage.role,
            checksum: passage.checksum,
            words: passage.words,
            ...(passage.provenance || {})
        }
    }));

    const boundaries = joinableBoundaries(programs.movementProgram.boundaries);

    // THE FIRST MOVEMENT'S CUE BECOMES THE OPENING FIELD (§7.2).
    //
    // Without this the Chamber began with visuals OFF and every cue
    // the controller sent landed on a disabled cortex: the movement
    // changed, the pool changed, and the reader saw nothing at all.
    // A cue can swap a field; it cannot turn one on.
    //
    // GALLERY, not rhythmic. `continuous` is the persistent crossfading
    // field behind the reading rather than a flash between phrases — a
    // place the words happen in. A Journey's imagery accompanies its
    // whole movement; interrupting the text with it would make the
    // accompaniment an event.
    const opening = programs.visualProgram.segments.find(segment =>
        segment.match.sourceIds.includes(sources[0]?.id))?.cue || { kind: 'still' };
    const visualConfig = {
        visualMode: 'interlocution',
        interlocution: {
            presentation: 'continuous',
            procedural: opening.kind === 'procedural' ? [...opening.collections] : [],
            sourced: opening.kind === 'sourced' ? [...opening.collections] : []
        }
    };

    return {
        text: sources.map(source => source.data).join('\n\n'),
        source: `Journey · ${journey.title}`,
        config: {
            sources,
            sourceBoundaries: boundaries,
            // Launch identity (§7.5). These travel with the Session and
            // survive the Chamber's destroy/recreate cycle.
            movementProgram: programs.movementProgram,
            visualProgram: programs.visualProgram,
            audioProgram: programs.audioProgram,
            visualConfig,
            // An authored Journey is not a playlist a reader reshuffles
            // (§3.3). Pace, chunking and recitation are the author's.
            wpm: journey.wpm || 200,
            chunkMode: journey.chunkMode || 'sentence',
            curve: 'flat',
            recitation: { enabled: journey.recitation?.enabled === true },
            ...(journey.recitation?.voiceId ? { voiceId: journey.recitation.voiceId } : {}),
            origin: {
                view: 'journeys',
                icon: '◈',
                name: 'Journeys',
                data: { journeyId: journey.id }
            },
            provenance: {
                kind: 'journey',
                journeyId: journey.id,
                journeyTitle: journey.title,
                thesis: journey.thesis,
                transformation: journey.transformation,
                terminalCondition: journey.terminalCondition,
                movementIds: programs.movementProgram.movements.map(m => m.id),
                passageIds: sources.map(s => s.id)
            }
        }
    };
}

/**
 * What a reader is told before deciding to begin (§3.1).
 *
 * Derived rather than authored twice: an introduction that could
 * disagree with the manifest is a second thing to keep true.
 */
export function journeyIntroduction(journey, resolvedPassages = []) {
    const movements = readJourneyMovements(journey);
    const byId = new Map(resolvedPassages.map(p => [p.id, p]));
    const words = resolvedPassages.reduce((n, p) => n + (p.words || 0), 0);

    return {
        id: journey.id,
        title: journey.title,
        subtitle: journey.subtitle || null,
        thesis: journey.thesis,
        transformation: journey.transformation,
        terminalCondition: journey.terminalCondition,
        status: journey.status,
        estimatedMinutes: words
            ? Math.round(words / (journey.wpm || 200))
            : journey.estimatedMinutes || null,
        movements: movements.map((movement, index) => ({
            index,
            id: movement.id,
            title: movement.title,
            counterpressure: movement.counterpressure || null,
            passages: movement.segments.map(segment => {
                const passage = byId.get(segment.passageId);
                return {
                    id: segment.passageId,
                    role: segment.role,
                    label: passage?.label || null,
                    work: passage?.title || null,
                    author: passage?.author || null,
                    edition: passage?.edition || null
                };
            })
        })),
        // Credits are the editions, because that is what a reader is
        // actually being shown and who did the work of making it
        // readable.
        credits: [...new Set(resolvedPassages
            .map(p => (p.edition ? `${p.title} — ${p.edition}` : p.title))
            .filter(Boolean))]
    };
}
