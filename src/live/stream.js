/**
 * The reducer for rise.current-events.v1.
 *
 * This is where events acquire an order and a meaning. It is pure: no clock, no
 * network, no DOM, no Player. What a live runtime can build on:
 *
 *   ORDER.      Events are applied in sequence order, once. One that arrives
 *               early waits (at most a window of them); a repeat of one already
 *               applied is ignored; a different event under a used number is
 *               refused; one so far ahead that no window can hold it is refused
 *               and reported as a gap for the adapter to resume from.
 *   NO STALLS.  A malformed event still spends its sequence number, so a
 *               provider that sends one bad event cannot hold the stream at a
 *               gap forever. Refusals are counted, and the stream fails, never
 *               hangs, when there are too many.
 *   IMMUTABILITY. Committed words never change. A refused event changes
 *               nothing, and what is lowered to `rise.current.v1` at any moment
 *               is a prefix of what will be lowered later, which is what lets
 *               the one Player be extended rather than replaced.
 *   BOUNDS.     Segments, text, evidence, Dives, events, buffered events,
 *               remembered events and interruptions are all capped.
 *
 * A beat stream (docs/specs/LIVE-CURRENT-EVENTS-V1.md, "Beats streamed") is the
 * same reducer over segments that are each one beat of a `rise.current.v2`,
 * with the scenes those beats start. Every beat is held to v2's own validator
 * over the beats before it as it begins and as it ends, and a generated scene or
 * a figure is admitted here, when a beat first starts it, by the functions the
 * Worker's door runs. It lowers to the `rise.current.v2` of its ended beats.
 */

import {
    RISE_CURRENT_LIMITS,
    RISE_CURRENT_SCHEMA,
    RISE_CURRENT_SCHEMA_V2,
    RiseCurrentError,
    hasLiteralForbidden,
    hasReservedMarker,
    validateDiveAnchor,
    validateRiseCurrent
} from '../core/rise-current.js';
import { BEAT_LIMITS, validateBeats, validateScenes } from '../core/beats.js';
import { sceneCodeBytes } from '../core/experience-program.js';
import { admitSvg } from '../core/svg-admission.js';
import { admitSceneCode, describeDiagnostic } from '../core/scene-admission.js';
import { LiveProtocolError, validateEvent } from './protocol.js';

export const STREAM_LIMITS = Object.freeze({
    /** How far ahead of the next expected event another may arrive and still be held. */
    window: 16,
    /** How many applied events are remembered, to tell a repeat from a conflict. */
    remembered: 32,
    /** Refusals a Current tolerates before it is failed. */
    refusals: 8,
    events: 5_000,
    interruptions: 32,
    evidence: 8,
    dives: RISE_CURRENT_LIMITS.dives,
    segments: RISE_CURRENT_LIMITS.segments,
    segmentText: RISE_CURRENT_LIMITS.segmentText,
    totalText: RISE_CURRENT_LIMITS.totalText,
    /** A beat stream: one segment per beat of a rise.current.v2, and its scenes. */
    beats: BEAT_LIMITS.beats,
    scenes: BEAT_LIMITS.scenes
});

/** A `rise.current.v2` beat for a beat segment: what it says is its words; with a hold, its words are shown. */
function v2Beat(body, words) {
    const { show, hold, ...rest } = body;
    const beat = hold
        ? { ...(words ? { show: words } : {}), hold: { ...hold } }
        : { say: words, ...(show === undefined ? {} : { show }) };
    for (const [key, value] of Object.entries(rest)) {
        beat[key] = Array.isArray(value) ? [...value] : value && typeof value === 'object' ? { ...value } : value;
    }
    return beat;
}

/**
 * The beats as they play: a beat that starts a refused scene starts nothing, and no cue lands while the model
 * meant a refused scene to be running. `items` are { body, words } in order.
 */
function playable(items, refused) {
    let intended = null;
    return items.map(({ body, words }) => {
        const beat = v2Beat(body, words);
        if (body.scene !== undefined) intended = body.scene;
        if (intended !== null && refused(intended)) {
            delete beat.scene;
            delete beat.cue;
        }
        return beat;
    });
}

class Refusal extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

const refuse = (code, message) => { throw new Refusal(code, message); };

function deepFreeze(value) {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(deepFreeze);
        Object.freeze(value);
    }
    return value;
}

/** Conditions of the transport, not of the sender: they do not count against the refusal budget. */
const NOT_HOSTILE = new Set(['SEQUENCE_GAP']);

export function createCurrentStream({ refusals: refusalBudget = STREAM_LIMITS.refusals } = {}) {
    let phase = 'idle';
    let currentId = null;
    let title = null;
    let origin = null;
    let theme = null;
    let look = null;
    let nextSeq = 0;
    let resumeFrom = null;
    let received = 0;
    let refusalCount = 0;
    let error = null;
    let lastError = null;
    let cancelReason = null;
    let openSegment = null;

    const buffer = new Map();
    const recent = new Map();
    const segments = [];
    const byId = new Map();
    const branches = [];
    const interruptions = [];
    /** 'passages' or 'beats', decided by the first segment or scene; null before either. */
    let kind = null;
    /** Declared scenes, in order: { id, clean } for a native one or an admitted one, { id, form, source, sealed } until then. */
    const scenes = [];
    const sceneById = new Map();
    const refusedScenes = [];

    const terminal = () => phase === 'complete' || phase === 'cancelled' || phase === 'failed';

    /** Refuse the other kind of stream; the kind itself is set only once the event is applied. */
    function expectKind(wanted) {
        if (kind !== null && kind !== wanted) {
            refuse('BEAT_MIXED', wanted === 'beats' ? 'This Current streams passages, not beats' : 'This Current streams beats, not passages');
        }
    }

    const isRefused = sceneId => sceneById.get(sceneId)?.refused !== undefined;

    /** The scenes a beat may name: native ones and admitted ones, as v2 writes them. */
    const usableScenes = () => scenes.filter(scene => scene.clean).map(scene => scene.clean);

    /**
     * Hold the beats, `items` ({ body, words }), to rise.current.v2's validator, refusing with its code. `admitted`
     * is a scene being admitted by the beat under test, and `refused` says which scenes play as refused.
     */
    function checkBeats(items, { refused = isRefused, admitted = null } = {}) {
        try {
            validateBeats(playable(items, refused), '$.beats', { scenes: admitted ? [...usableScenes(), admitted] : usableScenes() });
        } catch (caught) {
            if (caught instanceof RiseCurrentError) refuse(caught.code, caught.message);
            throw caught;
        }
    }

    const beatItems = list => list.map(segment => ({ body: segment.beat, words: segment.text }));

    /** The Worker's verdict on a generated scene or a figure: { clean } or { message }, in the Worker's words. */
    function admit(scene) {
        const shaped = scene.form === 'code' ? { id: scene.id, code: scene.source } : { id: scene.id, svg: scene.source };
        try {
            validateScenes([shaped], '$.scenes');
        } catch (caught) {
            if (!(caught instanceof RiseCurrentError)) throw caught;
            return { message: `Scene "${scene.id}" was refused: ${caught.message}` };
        }
        const verdict = scene.form === 'code' ? admitSceneCode(scene.source) : admitSvg(scene.source);
        return verdict.ok ? { clean: shaped } : { message: `Scene "${scene.id}" was refused: ${describeDiagnostic(verdict.diagnostics[0])}` };
    }

    function beginBeat(event) {
        expectKind('beats');
        if (event.segmentId !== `beat-${segments.length}`) {
            refuse('BEAT_ID', `A beat is named by its place: this one is beat-${segments.length}`);
        }
        if (segments.length >= STREAM_LIMITS.beats) refuse('TOO_MANY_SEGMENTS', `A Current has at most ${STREAM_LIMITS.beats} beats`);
        const { beat } = event;
        if (beat.hold && beat.show !== undefined) {
            refuse('BEAT_KIND', 'A beat with a hold shows its own words; show is for a beat that says something else');
        }
        if (beat.show !== undefined && totalText() + shownText() + beat.show.length > STREAM_LIMITS.totalText) {
            refuse('TEXT_TOO_LONG', 'The text is past its limit');
        }
        // A scene's source is sealed and admitted when a beat first starts it; nothing is kept unless the beat is applied.
        const starting = beat.scene === undefined ? null : sceneById.get(beat.scene);
        const verdict = starting && starting.form && !starting.sealed ? admit(starting) : null;
        const refused = sceneId => (sceneId === starting?.id && verdict ? verdict.message !== undefined : isRefused(sceneId));
        // What it says is not yet known: a said beat is checked as saying something, a hold as one.
        const words = beat.hold ? '' : 'x';
        checkBeats([...beatItems(segments), { body: beat, words }], { refused, admitted: verdict?.clean ?? null });
        if (verdict) {
            starting.sealed = true;
            if (verdict.clean) starting.clean = verdict.clean;
            else {
                starting.refused = verdict.message;
                refusedScenes.push({ sceneId: starting.id, message: verdict.message });
            }
        }
    }

    /** What beats show besides what they say. */
    const shownText = () => segments.reduce((sum, segment) => sum + (segment.beat?.show?.length ?? 0), 0);

    function declareScene(event) {
        expectKind('beats');
        if (sceneById.has(event.sceneId)) refuse('DUPLICATE_SCENE', `Scene ${event.sceneId} exists`);
        if (scenes.length >= STREAM_LIMITS.scenes) refuse('TOO_MANY_SCENES', `A Current has at most ${STREAM_LIMITS.scenes} scenes`);
        let scene;
        if (event.form) {
            scene = { id: event.sceneId, form: event.form, source: '', sealed: false };
        } else {
            try {
                const [clean] = validateScenes([{ id: event.sceneId, engine: event.engine, ...(event.params ? { params: event.params } : {}) }], '$.scenes');
                scene = { id: event.sceneId, clean };
            } catch (caught) {
                if (caught instanceof RiseCurrentError) refuse(caught.code, caught.message);
                throw caught;
            }
        }
        scenes.push(scene);
        sceneById.set(scene.id, scene);
        kind = 'beats';
    }

    function sceneText(event) {
        const scene = sceneById.get(event.sceneId);
        if (!scene?.form) refuse('UNKNOWN_SCENE', `No scene ${event.sceneId} whose source follows`);
        if (scene.sealed) refuse('SCENE_CLOSED', `Scene ${scene.id} has started; its source is sealed`);
        if (event.offset !== scene.source.length) refuse('TEXT_OFFSET', `Expected source at offset ${scene.source.length}, not ${event.offset}`);
        const joined = scene.source + event.text;
        const budget = scene.form === 'code' ? BEAT_LIMITS.code : BEAT_LIMITS.svg;
        if (sceneCodeBytes(joined) > budget) refuse('SCENE_TOO_LARGE', `A scene's ${scene.form} is at most ${budget} bytes`);
        scene.source = joined;
    }

    function fail(code, message) {
        phase = 'failed';
        error = { code, message, recoverable: false };
        buffer.clear();
    }

    function noteRefusal(code) {
        if (NOT_HOSTILE.has(code)) return;
        refusalCount += 1;
        if (refusalCount >= refusalBudget && !terminal()) {
            fail('TOO_MANY_REFUSALS', `Too many events were refused (${refusalCount}); the last was ${code}`);
        }
    }

    function segmentFor(segmentId) {
        const found = byId.get(segmentId);
        if (!found) refuse('UNKNOWN_SEGMENT', `No segment ${segmentId}`);
        return found;
    }

    function totalText() {
        return segments.reduce((sum, segment) => sum + segment.text.length, 0);
    }

    /** The meaning of one validated event. Throws a Refusal and changes nothing when it does not hold. */
    function meaning(event) {
        if (phase === 'idle') {
            if (event.type !== 'current.open') refuse('NOT_OPEN', 'The Current has not opened');
            currentId = event.currentId;
            title = event.title;
            origin = event.origin;
            theme = event.theme ?? null;
            look = event.look ?? null;
            phase = 'open';
            return;
        }
        switch (event.type) {
            case 'current.open':
                refuse('DUPLICATE_OPEN', 'The Current is already open');
                break;

            case 'segment.begin': {
                if (openSegment) refuse('SEGMENT_OPEN', `Segment ${openSegment.id} is still open`);
                if (byId.has(event.segmentId)) refuse('DUPLICATE_SEGMENT', `Segment ${event.segmentId} exists`);
                if (event.beat) beginBeat(event);
                else {
                    expectKind('passages');
                    if (segments.length >= STREAM_LIMITS.segments) {
                        refuse('TOO_MANY_SEGMENTS', `A Current has at most ${STREAM_LIMITS.segments} segments`);
                    }
                }
                kind = event.beat ? 'beats' : 'passages';
                const segment = {
                    id: event.segmentId,
                    text: '',
                    ended: false,
                    state: {},
                    evidence: [],
                    dives: [],
                    speech: { started: false, ended: false, marks: [] }
                };
                if (event.visual !== undefined) segment.visual = event.visual;
                if (event.literal === true) segment.literal = true;
                if (event.beat) segment.beat = event.beat;
                segments.push(segment);
                byId.set(segment.id, segment);
                openSegment = segment;
                break;
            }

            case 'segment.text': {
                const segment = segmentFor(event.segmentId);
                if (segment.ended) refuse('SEGMENT_CLOSED', `Segment ${segment.id} has ended`);
                // Whether words are literal is decided once, when the segment begins, and every chunk agrees.
                if ((event.literal === true) !== (segment.literal === true)) {
                    refuse('LITERAL_MISMATCH', 'A chunk must be literal exactly when its segment is');
                }
                if (event.offset !== segment.text.length) {
                    refuse('TEXT_OFFSET', `Expected text at offset ${segment.text.length}, not ${event.offset}`);
                }
                const joined = segment.text + event.text;
                if (joined.length > STREAM_LIMITS.segmentText || totalText() + shownText() + event.text.length > STREAM_LIMITS.totalText) {
                    refuse('TEXT_TOO_LONG', 'The text is past its limit');
                }
                // A marker can be split across two chunks; only the joined text shows it.
                if (segment.literal ? hasLiteralForbidden(joined) : hasReservedMarker(joined)) {
                    refuse('RESERVED_TEXT', 'The text contains a reserved playback marker');
                }
                segment.text = joined;
                break;
            }

            case 'segment.end': {
                const segment = segmentFor(event.segmentId);
                if (segment.ended) refuse('SEGMENT_CLOSED', `Segment ${segment.id} has already ended`);
                // A hold beat says and shows nothing; every other segment says something.
                if (!segment.beat?.hold && !segment.text.trim()) refuse('EMPTY_SEGMENT', 'A segment cannot end with nothing said');
                if (segment.beat) checkBeats(beatItems(segments));
                segment.ended = true;
                if (openSegment === segment) openSegment = null;
                break;
            }

            case 'state.set': {
                const segment = segmentFor(event.segmentId);
                if (segment.ended) refuse('SEGMENT_CLOSED', `Segment ${segment.id} has ended`);
                Object.assign(segment.state, event.state);
                break;
            }

            case 'evidence.add': {
                const segment = segmentFor(event.segmentId);
                if (segment.ended) refuse('SEGMENT_CLOSED', `Segment ${segment.id} has ended`);
                if (segment.evidence.length >= STREAM_LIMITS.evidence) {
                    refuse('TOO_MANY_EVIDENCE', `A segment has at most ${STREAM_LIMITS.evidence} pieces of evidence`);
                }
                if (segment.evidence.some(item => item.id === event.evidence.id)) {
                    refuse('DUPLICATE_EVIDENCE', `Evidence ${event.evidence.id} exists`);
                }
                if (event.evidence.supports && event.evidence.supports.toCharacter > segment.text.length) {
                    refuse('EVIDENCE_SPAN', 'Evidence supports words that have not been committed');
                }
                segment.evidence.push(event.evidence);
                break;
            }

            case 'dive.attach': {
                const segment = segmentFor(event.segmentId);
                if (segment.beat) refuse('BEAT_DIVE', 'A beat carries no Dive: a rise.current.v2 has nowhere to keep one');
                if (segment.ended) refuse('SEGMENT_CLOSED', `Segment ${segment.id} has ended`);
                if (segment.dives.length >= STREAM_LIMITS.dives) {
                    refuse('TOO_MANY_DIVES', `A segment has at most ${STREAM_LIMITS.dives} Dives`);
                }
                if (segment.dives.some(item => item.id === event.dive.id)) {
                    refuse('DUPLICATE_DIVE', `Dive ${event.dive.id} exists`);
                }
                if (event.dive.anchor.toCharacter > segment.text.length) {
                    refuse('DIVE_ANCHOR', 'The Dive points past the words committed so far');
                }
                try {
                    validateDiveAnchor(event.dive.anchor, segment.text, '$.dive.anchor');
                } catch (caught) {
                    if (caught?.name === 'RiseCurrentError') refuse('DIVE_ANCHOR', caught.message);
                    throw caught;
                }
                segment.dives.push(event.dive);
                break;
            }

            case 'speech.start': {
                const segment = segmentFor(event.segmentId);
                if (segment.speech.started) refuse('SPEECH_STATE', 'Speech has already started for this segment');
                segment.speech.started = true;
                break;
            }

            case 'speech.mark': {
                const segment = segmentFor(event.segmentId);
                const { speech } = segment;
                if (!speech.started || speech.ended) refuse('SPEECH_STATE', 'There is no speech in progress');
                const last = speech.marks[speech.marks.length - 1];
                if (event.charIndex > segment.text.length || (last && (event.tMs < last.tMs || event.charIndex < last.charIndex))) {
                    refuse('SPEECH_ORDER', 'A speech mark must fall inside the words and never run backwards');
                }
                speech.marks.push({ charIndex: event.charIndex, tMs: event.tMs });
                break;
            }

            case 'speech.end': {
                const { speech } = segmentFor(event.segmentId);
                if (!speech.started || speech.ended) refuse('SPEECH_STATE', 'There is no speech in progress');
                const last = speech.marks[speech.marks.length - 1];
                if (last && event.durationMs < last.tMs) refuse('SPEECH_ORDER', 'Speech cannot end before its last mark');
                speech.ended = true;
                speech.durationMs = event.durationMs;
                break;
            }

            case 'interrupt':
                interruptions.push({
                    seq: event.seq,
                    reason: event.reason,
                    ...(event.text === undefined ? {} : { text: event.text })
                });
                if (interruptions.length > STREAM_LIMITS.interruptions) interruptions.shift();
                break;

            case 'branch.open': {
                const parent = segmentFor(event.parentSegmentId);
                if (branches.some(branch => !branch.closed)) refuse('BRANCH_OPEN', 'A Dive is already open');
                if (branches.some(branch => branch.id === event.branchId)) refuse('DUPLICATE_BRANCH', 'That Dive exists');
                if (event.atCharacter > parent.text.length) refuse('BRANCH_POSITION', 'A Dive can only begin inside committed words');
                branches.push({
                    id: event.branchId,
                    parentSegmentId: event.parentSegmentId,
                    atCharacter: event.atCharacter,
                    ...(event.question === undefined ? {} : { question: event.question }),
                    closed: false
                });
                break;
            }

            case 'branch.close': {
                const branch = branches.find(item => item.id === event.branchId && !item.closed);
                if (!branch) refuse('UNKNOWN_BRANCH', `No open Dive ${event.branchId}`);
                branch.closed = true;
                break;
            }

            case 'scene.declare':
                declareScene(event);
                break;

            case 'scene.text':
                sceneText(event);
                break;

            case 'current.cancel':
                phase = 'cancelled';
                cancelReason = event.reason ?? null;
                buffer.clear();
                break;

            case 'current.complete':
                if (openSegment) refuse('SEGMENT_OPEN', `Segment ${openSegment.id} is still open`);
                if (!segments.some(segment => segment.ended)) refuse('EMPTY_CURRENT', 'Nothing was said');
                if (branches.some(branch => !branch.closed)) refuse('BRANCH_OPEN', 'A Dive is still open');
                phase = 'complete';
                buffer.clear();
                break;

            case 'error':
                lastError = { code: event.code, message: event.message, recoverable: event.recoverable };
                if (!event.recoverable) {
                    phase = 'failed';
                    error = lastError;
                    buffer.clear();
                }
                break;

            default:
                refuse('UNKNOWN_EVENT', `No meaning for ${event.type}`);
        }
    }

    /** Spend the next sequence number on an event or on a refusal, then release what was waiting behind it. */
    function spend(entry) {
        let applied = 0;
        let outcome = null;
        let current = entry;
        while (current) {
            if (terminal()) break;
            const seq = nextSeq;
            if (current.invalid) {
                if (outcome === null) outcome = { status: 'refused', code: current.invalid.code };
                noteRefusal(current.invalid.code);
                recent.set(seq, `invalid:${current.invalid.code}`);
            } else {
                try {
                    meaning(current.event);
                    applied += 1;
                    if (outcome === null) outcome = { status: 'applied' };
                } catch (caught) {
                    if (!(caught instanceof Refusal)) throw caught;
                    if (outcome === null) outcome = { status: 'refused', code: caught.code };
                    noteRefusal(caught.code);
                }
                recent.set(seq, current.digest);
            }
            recent.delete(seq - STREAM_LIMITS.remembered);
            nextSeq += 1;
            resumeFrom = null;
            current = buffer.get(nextSeq);
            buffer.delete(nextSeq);
            // Only the first entry's own outcome is reported to its caller.
            if (entry !== current) entry = null;
        }
        return { ...outcome, applied };
    }

    function receive(event) {
        if (phase !== 'idle' && event.currentId !== currentId) {
            noteRefusal('WRONG_CURRENT');
            return { status: 'refused', code: 'WRONG_CURRENT', applied: 0 };
        }
        const digest = JSON.stringify(event);
        if (event.seq < nextSeq) {
            const known = recent.get(event.seq);
            if (known === undefined) return { status: 'late', applied: 0 };
            if (known === digest) return { status: 'duplicate', applied: 0 };
            noteRefusal('SEQ_CONFLICT');
            return { status: 'refused', code: 'SEQ_CONFLICT', applied: 0 };
        }
        if (event.seq === nextSeq) return spend({ event, digest });
        if (event.seq - nextSeq > STREAM_LIMITS.window) {
            resumeFrom = nextSeq;
            return { status: 'refused', code: 'SEQUENCE_GAP', applied: 0 };
        }
        const waiting = buffer.get(event.seq);
        if (waiting) {
            if (waiting.digest === digest) return { status: 'duplicate', applied: 0 };
            noteRefusal('SEQ_CONFLICT');
            return { status: 'refused', code: 'SEQ_CONFLICT', applied: 0 };
        }
        buffer.set(event.seq, { event, digest });
        return { status: 'buffered', applied: 0 };
    }

    function receiveInvalid(raw, problem) {
        if (phase !== 'idle') {
            let suppliedCurrentId;
            try { suppliedCurrentId = raw?.currentId; } catch { suppliedCurrentId = null; }
            if (typeof suppliedCurrentId !== 'string' || suppliedCurrentId.length === 0) {
                noteRefusal(problem.code);
                return { status: 'refused', code: problem.code, applied: 0 };
            }
            if (suppliedCurrentId !== currentId) {
                noteRefusal('WRONG_CURRENT');
                return { status: 'refused', code: 'WRONG_CURRENT', applied: 0 };
            }
        }
        let seq = null;
        try { if (Number.isInteger(raw?.seq) && raw.seq >= 0) seq = raw.seq; } catch { seq = null; }
        const refused = { status: 'refused', code: problem.code, applied: 0 };
        if (seq === null || seq < nextSeq || seq - nextSeq > STREAM_LIMITS.window) {
            noteRefusal(problem.code);
            return refused;
        }
        if (seq === nextSeq) return { ...spend({ invalid: problem }), applied: 0, status: 'refused', code: problem.code };
        if (!buffer.has(seq)) buffer.set(seq, { invalid: problem });
        return { status: 'buffered', applied: 0 };
    }

    return {
        /** Offer one event. Never throws for anything a provider can send. */
        apply(raw) {
            if (terminal()) return { status: 'ignored', code: 'AFTER_TERMINAL', applied: 0 };
            received += 1;
            if (received > STREAM_LIMITS.events) {
                fail('TOO_MANY_EVENTS', `A Current carries at most ${STREAM_LIMITS.events} events`);
                return { status: 'ignored', code: 'AFTER_TERMINAL', applied: 0 };
            }
            let event;
            try {
                event = validateEvent(raw);
            } catch (caught) {
                if (!(caught instanceof LiveProtocolError)) throw caught;
                return receiveInvalid(raw, caught);
            }
            return receive(event);
        },

        get phase() { return phase; },
        /** True once the Current has ended, one way or another. */
        get terminal() { return terminal(); },
        /** How many segments have ended: what a lowering would carry. */
        get endedCount() { return segments.reduce((count, segment) => count + (segment.ended ? 1 : 0), 0); },
        get currentId() { return currentId; },
        get openSegmentId() { return openSegment ? openSegment.id : null; },
        /** How many events are waiting on an earlier one. Zero when the stream is keeping up. */
        get pressure() { return buffer.size; },
        /** The run of sequence numbers missing before the earliest waiting event, or null. */
        get gap() {
            if (buffer.size === 0) return null;
            return { from: nextSeq, to: Math.min(...buffer.keys()) - 1 };
        },
        /** Set when an event arrived too far ahead to hold: the number to ask the provider to resume from. */
        get resumeFrom() { return resumeFrom; },
        /** The scenes the admission refused, in order: { sceneId, message } with the Worker's sentence. */
        get refusedScenes() { return refusedScenes.map(item => Object.freeze({ ...item })); },

        /** A frozen copy of everything the stream holds. */
        snapshot() {
            return deepFreeze({
                schema: RISE_CURRENT_SCHEMA,
                currentId,
                phase,
                title,
                origin: origin ? { ...origin } : null,
                theme,
                look,
                nextSeq,
                refusals: refusalCount,
                error: error ? { ...error } : null,
                lastError: lastError ? { ...lastError } : null,
                cancelReason,
                segments: segments.map(segment => ({
                    id: segment.id,
                    text: segment.text,
                    ended: segment.ended,
                    visual: segment.visual,
                    ...(segment.literal ? { literal: true } : {}),
                    ...(segment.beat ? { beat: segment.beat } : {}),
                    state: { ...segment.state },
                    evidence: segment.evidence.map(item => ({ ...item })),
                    dives: segment.dives.map(item => ({ ...item, anchor: { ...item.anchor } })),
                    speech: {
                        started: segment.speech.started,
                        ended: segment.speech.ended,
                        marks: segment.speech.marks.map(mark => ({ ...mark })),
                        durationMs: segment.speech.durationMs
                    }
                })),
                branches: branches.map(branch => ({ ...branch })),
                interruptions: interruptions.map(item => ({ ...item }))
            });
        },

        /**
         * The sealed `rise.current.v1` for the segments that have ended. A segment
         * still being written is left out: only whole, immutable words are ever
         * lowered, so each result is a prefix of every later one.
         */
        toCurrent() {
            const ended = segments.filter(segment => segment.ended);
            if (ended.length === 0) throw new LiveProtocolError('EMPTY_CURRENT', '$.segments', 'No segment has ended');
            if (kind === 'beats') {
                // The `rise.current.v2` of the beats that have ended, with the scenes they start, in the order declared.
                const beats = playable(beatItems(ended), isRefused);
                const started = new Set(beats.map(beat => beat.scene).filter(Boolean));
                const used = usableScenes().filter(scene => started.has(scene.id));
                const current = {
                    schema: RISE_CURRENT_SCHEMA_V2,
                    id: currentId,
                    title,
                    ...(theme === null ? {} : { theme }),
                    ...(look === null ? {} : { look }),
                    origin: { ...origin },
                    ...(used.length ? { scenes: used.map(scene => ({ ...scene, ...(scene.params ? { params: { ...scene.params } } : {}) })) } : {}),
                    beats
                };
                // Returned as a model would write it, so it is the very object a host's rise_present would take.
                validateRiseCurrent(current);
                return deepFreeze(current);
            }
            return validateRiseCurrent({
                schema: RISE_CURRENT_SCHEMA,
                id: currentId,
                title,
                ...(theme === null ? {} : { theme }),
                ...(look === null ? {} : { look }),
                origin,
                segments: ended.map(segment => ({
                    id: segment.id,
                    text: segment.text,
                    ...(segment.visual === undefined ? {} : { visual: segment.visual }),
                    ...(segment.literal ? { literal: true } : {}),
                    dives: segment.dives.map(dive => ({ id: dive.id, text: dive.text, anchor: { ...dive.anchor } }))
                }))
            });
        }
    };
}
