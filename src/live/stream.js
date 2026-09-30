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
 */

import {
    RISE_CURRENT_LIMITS,
    RISE_CURRENT_SCHEMA,
    hasLiteralForbidden,
    hasReservedMarker,
    validateDiveAnchor,
    validateRiseCurrent
} from '../core/rise-current.js';
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
    totalText: RISE_CURRENT_LIMITS.totalText
});

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

    const terminal = () => phase === 'complete' || phase === 'cancelled' || phase === 'failed';

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
                if (segments.length >= STREAM_LIMITS.segments) {
                    refuse('TOO_MANY_SEGMENTS', `A Current has at most ${STREAM_LIMITS.segments} segments`);
                }
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
                if (joined.length > STREAM_LIMITS.segmentText || totalText() + event.text.length > STREAM_LIMITS.totalText) {
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
                if (!segment.text.trim()) refuse('EMPTY_SEGMENT', 'A segment cannot end with nothing said');
                segment.ended = true;
                if (openSegment === segment) openSegment = null;
                break;
            }

            case 'state.set':
                Object.assign(segmentFor(event.segmentId).state, event.state);
                break;

            case 'evidence.add': {
                const segment = segmentFor(event.segmentId);
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

        /** A frozen copy of everything the stream holds. */
        snapshot() {
            return deepFreeze({
                schema: RISE_CURRENT_SCHEMA,
                currentId,
                phase,
                title,
                origin: origin ? { ...origin } : null,
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
            return validateRiseCurrent({
                schema: RISE_CURRENT_SCHEMA,
                id: currentId,
                title,
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
