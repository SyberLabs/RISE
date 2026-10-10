/**
 * The reducer for rise.current-events.v1.
 *
 * It is the one place events acquire an order and a meaning. It is pure: no
 * clock, no network, no DOM. Its guarantees are the ones a live runtime can
 * build on: an event is applied at most once, in sequence order; nothing a
 * provider sends can stall it, exhaust it, or change what was already
 * committed; and the words it has committed always lower, through the sealed
 * compiler, to the same atoms as before.
 */
import { describe, expect, it } from 'vitest';
import { compileRiseCurrent } from '../core/rise-current.js';
import { RISE_CURRENT_EVENTS_SCHEMA } from './protocol.js';
import { STREAM_LIMITS, createCurrentStream } from './stream.js';
import { sceneRefusal } from '../core/scene-admission.js';

const ID = 'answer-1';

/** Build events with the next sequence number, or an explicit one. */
function feed(stream) {
    let next = 0;
    const send = (type, body = {}, seq = next) => {
        if (seq === next) next += 1;
        return stream.apply({ schema: RISE_CURRENT_EVENTS_SCHEMA, currentId: ID, seq, type, ...body });
    };
    send.at = () => next;
    return send;
}

const open = send => send('current.open', {
    title: 'Black holes', origin: { kind: 'model', name: 'An answer', provider: 'mock' }
});

function opened() {
    const stream = createCurrentStream();
    const send = feed(stream);
    open(send);
    return { stream, send };
}

/** A segment whose words are still being written. */
const writingSegment = (send, segmentId, text, extra = {}) => {
    send('segment.begin', { segmentId, ...extra });
    send('segment.text', { segmentId, offset: 0, text });
};

/** A whole segment: begin, text, end. */
const segment = (send, segmentId, text, extra = {}) => {
    writingSegment(send, segmentId, text, extra);
    return send('segment.end', { segmentId });
};

describe('a Current that arrives in order', () => {
    it('opens, gathers segments, and completes', () => {
        const { stream, send } = opened();
        expect(stream.snapshot().phase).toBe('open');
        segment(send, 's1', 'A black hole is a region of space.');
        segment(send, 's2', 'Nothing that crosses its edge returns.', { visual: 'attractor' });
        expect(send('current.complete').status).toBe('applied');
        const snap = stream.snapshot();
        expect(snap.phase).toBe('complete');
        expect(snap.segments.map(s => [s.id, s.ended])).toEqual([['s1', true], ['s2', true]]);
        expect(snap.segments[1].visual).toBe('attractor');
    });

    it('commits a segment in chunks and reports where it has got to', () => {
        const { stream, send } = opened();
        send('segment.begin', { segmentId: 's1' });
        send('segment.text', { segmentId: 's1', offset: 0, text: 'A black hole ' });
        send('segment.text', { segmentId: 's1', offset: 13, text: 'is a region.' });
        expect(stream.snapshot().segments[0].text).toBe('A black hole is a region.');
        expect(stream.snapshot().segments[0].ended).toBe(false);
        expect(stream.openSegmentId).toBe('s1');
        send('segment.end', { segmentId: 's1' });
        expect(stream.openSegmentId).toBeNull();
    });

    it('holds the experiential state, evidence and speech marks a segment gathers', () => {
        const { stream, send } = opened();
        writingSegment(send, 's1', 'A black hole is a region of space.');
        send('state.set', { segmentId: 's1', state: { tension: 0.3, warmth: 0.1 } });
        send('state.set', { segmentId: 's1', state: { tension: 0.6 } });
        send('evidence.add', {
            segmentId: 's1',
            evidence: { id: 'e1', kind: 'supplied', title: 'A textbook', supports: { fromCharacter: 0, toCharacter: 12 } }
        });
        send('segment.end', { segmentId: 's1' });
        send('speech.start', { segmentId: 's1' });
        send('speech.mark', { segmentId: 's1', charIndex: 2, tMs: 200 });
        send('speech.end', { segmentId: 's1', durationMs: 2100 });
        const s1 = stream.snapshot().segments[0];
        expect(s1.state).toEqual({ tension: 0.6, warmth: 0.1 });
        expect(s1.evidence.map(e => e.id)).toEqual(['e1']);
        expect(s1.speech).toEqual({ started: true, ended: true, marks: [{ charIndex: 2, tMs: 200 }], durationMs: 2100 });
    });

    it('refuses a later speech mark that moves backward in the text', () => {
        const { stream, send } = opened();
        segment(send, 's1', 'A long reading moves forward.');
        send('speech.start', { segmentId: 's1' });
        send('speech.mark', { segmentId: 's1', charIndex: 10, tMs: 100 });
        const result = send('speech.mark', { segmentId: 's1', charIndex: 2, tMs: 200 });
        expect(result).toMatchObject({ status: 'refused', code: 'SPEECH_ORDER' });
        expect(stream.snapshot().segments[0].speech.marks).toEqual([{ charIndex: 10, tMs: 100 }]);
    });
});

describe('lowering to the sealed Current', () => {
    it('yields a rise.current.v1 of the segments that have ended, and nothing of one still open', () => {
        const { stream, send } = opened();
        segment(send, 's1', 'A black hole is a region of space.');
        send('segment.begin', { segmentId: 's2' });
        send('segment.text', { segmentId: 's2', offset: 0, text: 'Half a sen' });
        const doc = stream.toCurrent();
        expect(doc.schema).toBe('rise.current.v1');
        expect(doc.segments.map(s => s.id)).toEqual(['s1']);
        expect(doc.origin).toEqual({ kind: 'model', name: 'An answer', provider: 'mock' });
    });

    it('carries the theme the Current opened with, and none when it named none', () => {
        const themed = createCurrentStream();
        const send = feed(themed);
        send('current.open', {
            title: 'Black holes', origin: { kind: 'model', name: 'An answer', provider: 'mock' }, theme: 'jade'
        });
        segment(send, 's1', 'A black hole is a region of space.');
        expect(themed.snapshot().theme).toBe('jade');
        expect(themed.toCurrent().theme).toBe('jade');

        const { stream, send: sendPlain } = opened();
        segment(sendPlain, 's1', 'A black hole is a region of space.');
        expect(stream.snapshot().theme).toBeNull();
        expect(Object.hasOwn(stream.toCurrent(), 'theme')).toBe(false);
    });

    it('refuses a Dive attached after its segment has been lowered', () => {
        const { stream, send } = opened();
        segment(send, 's1', 'The event horizon marks a boundary.');
        const before = stream.toCurrent();
        const result = send('dive.attach', {
            segmentId: 's1',
            dive: {
                id: 'd1',
                text: 'A boundary.',
                anchor: { fromCharacter: 4, toCharacter: 17, quoteStart: 'event horizon', quoteEnd: 'event horizon' }
            }
        });
        expect(result).toMatchObject({ status: 'refused', code: 'SEGMENT_CLOSED' });
        expect(stream.toCurrent()).toEqual(before);
    });

    it('compiles through the canonical Session, and keeps every word', () => {
        const { stream, send } = opened();
        segment(send, 's1', 'A black hole is a region of space.');
        segment(send, 's2', 'Nothing that crosses its edge returns.');
        const session = compileRiseCurrent(stream.toCurrent());
        const said = session.atoms.map(a => a.content).join(' ').replace(/\s+/g, ' ').trim();
        expect(said).toBe('A black hole is a region of space. Nothing that crosses its edge returns.');
    });

    it('carries anchored Dives into the thread lane', () => {
        const { stream, send } = opened();
        writingSegment(send, 's1', 'The event horizon is the edge.');
        send('dive.attach', {
            segmentId: 's1',
            dive: { id: 'd1', text: 'The point of no return.', anchor: { fromCharacter: 4, toCharacter: 17, quoteStart: 'event horizon', quoteEnd: 'event horizon' } }
        });
        send('segment.end', { segmentId: 's1' });
        const session = compileRiseCurrent(stream.toCurrent());
        const thread = session.experienceProgram.tracks.find(t => t.kind === 'thread');
        expect(thread.clips).toHaveLength(1);
    });

    it('refuses to lower a Current with nothing ended', () => {
        const { stream } = opened();
        expect(() => stream.toCurrent()).toThrowError(expect.objectContaining({ code: 'EMPTY_CURRENT' }));
    });

    it('lowers each time to atoms whose earlier part never changes', () => {
        // The Player can only be extended while what it has already got is
        // exactly what comes back. Committed words are immutable, so it is.
        const { stream, send } = opened();
        const seen = [];
        const shape = session => session.atoms.map(a => [a.content, a.duration, a.sourceId, a.position]);
        for (const text of ['A black hole is a region of space.', 'Nothing that crosses its edge returns.',
            'Light itself cannot get out. It is trapped, and that is why it is dark.', 'Yet we can see its shadow.']) {
            segment(send, `s${seen.length + 1}`, text);
            seen.push(shape(compileRiseCurrent(stream.toCurrent())));
        }
        for (let i = 1; i < seen.length; i += 1) {
            expect(seen[i].slice(0, seen[i - 1].length)).toEqual(seen[i - 1]);
            expect(seen[i].length).toBeGreaterThan(seen[i - 1].length);
        }
    });
});

describe('ordering', () => {
    it('applies events that arrive early in sequence order, once the gap closes', () => {
        const stream = createCurrentStream();
        const send = feed(stream);
        open(send);
        expect(send('segment.text', { segmentId: 's1', offset: 0, text: 'Hello there.' }, 2).status).toBe('buffered');
        expect(stream.gap).toEqual({ from: 1, to: 1 });
        expect(stream.pressure).toBe(1);
        expect(send('segment.begin', { segmentId: 's1' }, 1).status).toBe('applied');
        expect(stream.gap).toBeNull();
        expect(stream.pressure).toBe(0);
        expect(stream.snapshot().segments[0].text).toBe('Hello there.');
    });

    it('drains a run of buffered events in one go', () => {
        const stream = createCurrentStream();
        const send = feed(stream);
        open(send);
        send('segment.end', { segmentId: 's1' }, 3);
        send('segment.text', { segmentId: 's1', offset: 0, text: 'Hi.' }, 2);
        const last = send('segment.begin', { segmentId: 's1' }, 1);
        expect(last.applied).toBe(3);
        expect(stream.snapshot().segments[0]).toMatchObject({ text: 'Hi.', ended: true });
    });

    it('ignores a repeat of an event it has applied, however many times it comes', () => {
        const { stream, send } = opened();
        send('segment.begin', { segmentId: 's1' });
        const before = stream.snapshot();
        for (let i = 0; i < 5; i += 1) {
            expect(send('segment.begin', { segmentId: 's1' }, 1).status).toBe('duplicate');
        }
        expect(stream.snapshot()).toEqual(before);
    });

    it('ignores a repeat of an event that is still waiting in the buffer', () => {
        const { stream, send } = opened();
        send('segment.end', { segmentId: 's1' }, 3);
        expect(send('segment.end', { segmentId: 's1' }, 3).status).toBe('duplicate');
        expect(stream.pressure).toBe(1);
    });

    it('refuses a different event under a sequence number already used', () => {
        const { stream, send } = opened();
        send('segment.begin', { segmentId: 's1' });
        const before = stream.snapshot();
        const conflict = send('segment.begin', { segmentId: 'other' }, 1);
        expect(conflict).toMatchObject({ status: 'refused', code: 'SEQ_CONFLICT' });
        expect(stream.snapshot().segments).toEqual(before.segments);
        const buffered = send('segment.end', { segmentId: 's1' }, 5);
        expect(buffered.status).toBe('buffered');
        expect(send('segment.end', { segmentId: 'zzz' }, 5)).toMatchObject({ status: 'refused', code: 'SEQ_CONFLICT' });
    });

    it('ignores an event far enough behind that its twin is forgotten, without treating it as a conflict', () => {
        const { stream, send } = opened();
        send('segment.begin', { segmentId: 's1' });
        for (let i = 0; i < STREAM_LIMITS.remembered + 5; i += 1) {
            send('state.set', { segmentId: 's1', state: { tension: 0.1 } });
        }
        const before = stream.snapshot();
        const late = send('segment.begin', { segmentId: 'old' }, 1);
        expect(late.status).toBe('late');
        expect(stream.snapshot()).toEqual(before);
        expect(before.refusals).toBe(0);
    });

    it('refuses an event too far ahead, reports the gap, and changes nothing', () => {
        const { stream, send } = opened();
        const before = stream.snapshot();
        const far = send('segment.end', { segmentId: 's1' }, 1 + STREAM_LIMITS.window + 1);
        expect(far).toMatchObject({ status: 'refused', code: 'SEQUENCE_GAP' });
        expect(stream.resumeFrom).toBe(1);
        expect(stream.snapshot()).toEqual(before);
        expect(stream.pressure).toBe(0);
    });

    it('buffers at most a window of events, however many arrive', () => {
        const { stream, send } = opened();
        for (let i = 0; i < 200; i += 1) send('state.set', { segmentId: 's1', state: { tension: 0.5 } }, 5 + i);
        expect(stream.pressure).toBeLessThanOrEqual(STREAM_LIMITS.window);
    });
});

describe('meaning', () => {
    const refusals = {
        'text before any segment begins': [(s) => s('segment.text', { segmentId: 's1', offset: 0, text: 'Hi.' }), 'UNKNOWN_SEGMENT'],
        'a segment begun while another is open': [(s) => { s('segment.begin', { segmentId: 's1' }); return s('segment.begin', { segmentId: 's2' }); }, 'SEGMENT_OPEN'],
        'a segment id used twice': [(s) => { segment(s, 's1', 'One.'); return s('segment.begin', { segmentId: 's1' }); }, 'DUPLICATE_SEGMENT'],
        'text after a segment ended': [(s) => { segment(s, 's1', 'One.'); return s('segment.text', { segmentId: 's1', offset: 4, text: 'More.' }); }, 'SEGMENT_CLOSED'],
        'text at the wrong offset': [(s) => { s('segment.begin', { segmentId: 's1' }); return s('segment.text', { segmentId: 's1', offset: 3, text: 'Hi.' }); }, 'TEXT_OFFSET'],
        'a segment that ends empty': [(s) => { s('segment.begin', { segmentId: 's1' }); return s('segment.end', { segmentId: 's1' }); }, 'EMPTY_SEGMENT'],
        'the end of a segment never begun': [(s) => s('segment.end', { segmentId: 'nope' }), 'UNKNOWN_SEGMENT'],
        'state for a segment never begun': [(s) => s('state.set', { segmentId: 'nope', state: { tension: 0.1 } }), 'UNKNOWN_SEGMENT'],
        'a second open': [(s) => open(s), 'DUPLICATE_OPEN'],
        'completion with a segment still open': [(s) => { s('segment.begin', { segmentId: 's1' }); return s('current.complete'); }, 'SEGMENT_OPEN'],
        'completion with nothing said': [(s) => s('current.complete'), 'EMPTY_CURRENT'],
        'speech marks before speech starts': [(s) => { segment(s, 's1', 'One.'); return s('speech.mark', { segmentId: 's1', charIndex: 1, tMs: 5 }); }, 'SPEECH_STATE'],
        'speech that starts twice': [(s) => { segment(s, 's1', 'One.'); s('speech.start', { segmentId: 's1' }); return s('speech.start', { segmentId: 's1' }); }, 'SPEECH_STATE'],
        'speech marks that run backwards': [(s) => { segment(s, 's1', 'One two.'); s('speech.start', { segmentId: 's1' }); s('speech.mark', { segmentId: 's1', charIndex: 2, tMs: 500 }); return s('speech.mark', { segmentId: 's1', charIndex: 4, tMs: 100 }); }, 'SPEECH_ORDER'],
        'a speech mark beyond the words': [(s) => { segment(s, 's1', 'One.'); s('speech.start', { segmentId: 's1' }); return s('speech.mark', { segmentId: 's1', charIndex: 50, tMs: 5 }); }, 'SPEECH_ORDER'],
        'a branch from nowhere': [(s) => s('branch.open', { branchId: 'b1', parentSegmentId: 'nope', atCharacter: 0 }), 'UNKNOWN_SEGMENT'],
        'a branch at a place with no words': [(s) => { segment(s, 's1', 'One.'); return s('branch.open', { branchId: 'b1', parentSegmentId: 's1', atCharacter: 40 }); }, 'BRANCH_POSITION'],
        'closing a branch never opened': [(s) => s('branch.close', { branchId: 'b1' }), 'UNKNOWN_BRANCH'],
        'a Dive quoting words the segment does not hold': [(s) => { writingSegment(s, 's1', 'The event horizon is the edge.'); return s('dive.attach', { segmentId: 's1', dive: { id: 'd1', text: 'Note.', anchor: { fromCharacter: 4, toCharacter: 17, quoteStart: 'event horizon', quoteEnd: 'something else' } } }); }, 'DIVE_ANCHOR'],
        'a Dive spanning past the words': [(s) => { writingSegment(s, 's1', 'Short.'); return s('dive.attach', { segmentId: 's1', dive: { id: 'd1', text: 'Note.', anchor: { fromCharacter: 0, toCharacter: 40, quoteStart: 'Short.', quoteEnd: 'Short.' } } }); }, 'DIVE_ANCHOR'],
        'evidence supporting words that are not there': [(s) => { writingSegment(s, 's1', 'Short.'); return s('evidence.add', { segmentId: 's1', evidence: { id: 'e1', kind: 'supplied', title: 'T', supports: { fromCharacter: 0, toCharacter: 90 } } }); }, 'EVIDENCE_SPAN']
    };
    for (const [name, [run, code]] of Object.entries(refusals)) {
        it(`refuses ${name}, and changes nothing`, () => {
            const { stream, send } = opened();
            const result = run(send);
            expect(result).toMatchObject({ status: 'refused', code });
            // A refusal is recorded and the slot consumed; nothing else moves.
            expect(stream.snapshot().refusals).toBe(1);
        });
    }

    it('refuses a reserved marker that only appears once two chunks are joined', () => {
        const { stream, send } = opened();
        send('segment.begin', { segmentId: 's1' });
        send('segment.text', { segmentId: 's1', offset: 0, text: 'Before [PAU' });
        const joined = send('segment.text', { segmentId: 's1', offset: 11, text: 'SE] after.' });
        expect(joined).toMatchObject({ status: 'refused', code: 'RESERVED_TEXT' });
        expect(stream.snapshot().segments[0].text).toBe('Before [PAU');
    });

    it('refuses a segment past its length, and a Current past its total', () => {
        const { stream, send } = opened();
        send('segment.begin', { segmentId: 's1' });
        let offset = 0;
        let last;
        for (let i = 0; i < 5; i += 1) {
            last = send('segment.text', { segmentId: 's1', offset, text: 'a'.repeat(900) });
            if (last.status === 'applied') offset += 900;
        }
        expect(last).toMatchObject({ status: 'refused', code: 'TEXT_TOO_LONG' });
        expect(stream.snapshot().segments[0].text).toHaveLength(3600);
    });

    it('refuses more than sixteen segments', () => {
        const { send } = opened();
        for (let i = 0; i < 16; i += 1) segment(send, `s${i}`, 'Words here.');
        expect(send('segment.begin', { segmentId: 's16' })).toMatchObject({ status: 'refused', code: 'TOO_MANY_SEGMENTS' });
    });

    it('refuses more than eight Dives or eight pieces of evidence for one segment', () => {
        const { send } = opened();
        writingSegment(send, 's1', 'The event horizon is the edge of it.');
        let last;
        for (let i = 0; i < 9; i += 1) {
            last = send('dive.attach', { segmentId: 's1', dive: { id: `d${i}`, text: 'Note.', anchor: { fromCharacter: 4, toCharacter: 17, quoteStart: 'event horizon', quoteEnd: 'event horizon' } } });
        }
        expect(last).toMatchObject({ status: 'refused', code: 'TOO_MANY_DIVES' });
        for (let i = 0; i < 9; i += 1) {
            last = send('evidence.add', { segmentId: 's1', evidence: { id: `e${i}`, kind: 'supplied', title: 'T' } });
        }
        expect(last).toMatchObject({ status: 'refused', code: 'TOO_MANY_EVIDENCE' });
    });

    it('refuses a repeated evidence or Dive id within a segment', () => {
        const { send } = opened();
        writingSegment(send, 's1', 'The event horizon is the edge of it.');
        send('evidence.add', { segmentId: 's1', evidence: { id: 'e1', kind: 'supplied', title: 'T' } });
        expect(send('evidence.add', { segmentId: 's1', evidence: { id: 'e1', kind: 'retrieved', title: 'U' } }))
            .toMatchObject({ status: 'refused', code: 'DUPLICATE_EVIDENCE' });
    });

    it('refuses state, evidence and Dives for a segment that has ended, and ignores them after the Current has', () => {
        const { send } = opened();
        segment(send, 's1', 'The event horizon is the edge of it.');
        expect(send('state.set', { segmentId: 's1', state: { solemnity: 0.8 } })).toMatchObject({ status: 'refused', code: 'SEGMENT_CLOSED' });
        expect(send('evidence.add', { segmentId: 's1', evidence: { id: 'e1', kind: 'supplied', title: 'T' } })).toMatchObject({ status: 'refused', code: 'SEGMENT_CLOSED' });
        send('current.complete');
        expect(send('state.set', { segmentId: 's1', state: { solemnity: 0.1 } })).toMatchObject({ status: 'ignored', code: 'AFTER_TERMINAL' });
    });

    it('holds one branch at a time, and records its parent and position', () => {
        const { stream, send } = opened();
        segment(send, 's1', 'The event horizon is the edge of it.');
        send('branch.open', { branchId: 'b1', parentSegmentId: 's1', atCharacter: 4, question: 'What is a horizon?' });
        expect(send('branch.open', { branchId: 'b2', parentSegmentId: 's1', atCharacter: 6 }))
            .toMatchObject({ status: 'refused', code: 'BRANCH_OPEN' });
        expect(stream.snapshot().branches).toEqual([
            { id: 'b1', parentSegmentId: 's1', atCharacter: 4, question: 'What is a horizon?', closed: false }
        ]);
        expect(send('current.complete')).toMatchObject({ status: 'refused', code: 'BRANCH_OPEN' });
        send('branch.close', { branchId: 'b1' });
        expect(stream.snapshot().branches[0].closed).toBe(true);
        expect(send('current.complete').status).toBe('applied');
    });

    it('records interruptions in order, and no more than it can hold', () => {
        const { stream, send } = opened();
        for (let i = 0; i < STREAM_LIMITS.interruptions + 4; i += 1) send('interrupt', { reason: 'user', text: `wait ${i}` });
        const kept = stream.snapshot().interruptions;
        expect(kept).toHaveLength(STREAM_LIMITS.interruptions);
        expect(kept[0].text).toBe('wait 4');
    });
});

describe('whose event it is', () => {
    it('refuses events before the Current has opened', () => {
        const stream = createCurrentStream();
        const send = feed(stream);
        expect(send('segment.begin', { segmentId: 's1' })).toMatchObject({ status: 'refused', code: 'NOT_OPEN' });
    });

    it('refuses an event for a different Current', () => {
        const { stream } = opened();
        const stray = stream.apply({ schema: RISE_CURRENT_EVENTS_SCHEMA, currentId: 'someone-else', seq: 1, type: 'segment.begin', segmentId: 's1' });
        expect(stray).toMatchObject({ status: 'refused', code: 'WRONG_CURRENT' });
        expect(stream.snapshot().segments).toEqual([]);
    });
});

describe('a malformed event', () => {
    it('does not spend this Current sequence for a malformed event from another Current', () => {
        const { stream, send } = opened();
        const stray = stream.apply({
            schema: RISE_CURRENT_EVENTS_SCHEMA,
            currentId: 'someone-else',
            seq: 1,
            type: 'segment.begin'
        });
        expect(stray).toMatchObject({ status: 'refused', code: 'WRONG_CURRENT', applied: 0 });
        expect(stream.snapshot().nextSeq).toBe(1);
        expect(send('segment.begin', { segmentId: 's1' })).toMatchObject({ status: 'applied' });
        expect(stream.snapshot().segments.map(item => item.id)).toEqual(['s1']);
    });

    it('reports the triggering valid event outcome while draining a malformed buffered event', () => {
        const { stream, send } = opened();
        const buffered = stream.apply({
            schema: RISE_CURRENT_EVENTS_SCHEMA,
            currentId: ID,
            seq: 2,
            type: 'segment.begin',
            segmentId: 'bad',
            extra: true
        });
        expect(buffered).toMatchObject({ status: 'buffered', applied: 0 });
        const result = send('segment.begin', { segmentId: 's1' });
        expect(result).toMatchObject({ status: 'applied', applied: 1 });
        expect(stream.snapshot()).toMatchObject({ nextSeq: 3, refusals: 1 });
        expect(stream.snapshot().segments[0]).toMatchObject({ id: 's1', ended: false });
    });

    it('is refused with its protocol code, and its sequence number is spent so the stream does not stall', () => {
        const stream = createCurrentStream();
        const send = feed(stream);
        open(send);
        const bad = send('segment.begin', { segmentId: 's1', visual: 'shader' });
        expect(bad).toMatchObject({ status: 'refused', code: 'EVENT_VISUAL' });
        expect(send('segment.begin', { segmentId: 's1' }).status).toBe('applied');
    });

    it('is refused without spending anything when it has no usable sequence number', () => {
        const { stream } = opened();
        expect(stream.apply({ nonsense: true })).toMatchObject({ status: 'refused', code: 'EVENT_SCHEMA' });
        expect(stream.apply('a string')).toMatchObject({ status: 'refused', code: 'EVENT_OBJECT' });
        expect(stream.snapshot().nextSeq).toBe(1);
    });

    it('fails the Current after too many refusals, then ignores everything', () => {
        const { stream, send } = opened();
        for (let i = 0; i < STREAM_LIMITS.refusals; i += 1) send('segment.text', { segmentId: 'nope', offset: 0, text: 'x' });
        const snap = stream.snapshot();
        expect(snap.phase).toBe('failed');
        expect(snap.error).toMatchObject({ code: 'TOO_MANY_REFUSALS', recoverable: false });
        expect(send('segment.begin', { segmentId: 's1' })).toMatchObject({ status: 'ignored', code: 'AFTER_TERMINAL' });
    });

    it('never poisons state: what was committed before it is exactly what is there after', () => {
        const { stream, send } = opened();
        segment(send, 's1', 'A black hole is a region of space.');
        const before = stream.snapshot();
        send('segment.text', { segmentId: 's1', offset: 0, text: 'overwrite' });
        send('segment.begin', { segmentId: 's1' });
        expect(stream.snapshot().segments).toEqual(before.segments);
    });
});

describe('endings', () => {
    it('cancels, with a reason, from any open state', () => {
        const { stream, send } = opened();
        send('segment.begin', { segmentId: 's1' });
        expect(send('current.cancel', { reason: 'user stopped' }).status).toBe('applied');
        expect(stream.snapshot()).toMatchObject({ phase: 'cancelled', cancelReason: 'user stopped' });
        expect(send('segment.text', { segmentId: 's1', offset: 0, text: 'late' })).toMatchObject({ status: 'ignored', code: 'AFTER_TERMINAL' });
    });

    it('carries on past a recoverable error, and stops at one that is not', () => {
        const { stream, send } = opened();
        send('error', { code: 'PROVIDER_LOST', message: 'Dropped.', recoverable: true });
        expect(stream.snapshot()).toMatchObject({ phase: 'open', lastError: { code: 'PROVIDER_LOST', recoverable: true } });
        send('error', { code: 'PROVIDER_GONE', message: 'Gone.', recoverable: false });
        expect(stream.snapshot()).toMatchObject({ phase: 'failed', error: { code: 'PROVIDER_GONE' } });
    });

    it('stops at the most events a stream may carry', () => {
        const { stream, send } = opened();
        send('segment.begin', { segmentId: 's1' });
        let last;
        for (let i = 0; i < STREAM_LIMITS.events + 10; i += 1) last = send('state.set', { segmentId: 's1', state: { tension: 0.5 } });
        expect(stream.snapshot()).toMatchObject({ phase: 'failed', error: { code: 'TOO_MANY_EVENTS' } });
        expect(last.status).toBe('ignored');
    });
});

describe('invariants under random play', () => {
    const random = seed => () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 2 ** 32;
    };

    it('holds after every event, whatever the order and whatever is asked', () => {
        const next = random(1729);
        const pick = list => list[Math.floor(next() * list.length)];
        for (let run = 0; run < 25; run += 1) {
            // No refusal budget here: most random events are refused on meaning,
            // and the point is that the invariants hold through all of them.
            const stream = createCurrentStream({ refusals: Number.MAX_SAFE_INTEGER });
            let seq = 0;
            let previousNext = 0;
            const ids = ['s1', 's2', 's3', 'nope'];
            const make = () => {
                const segmentId = pick(ids);
                const type = pick(['segment.begin', 'segment.text', 'segment.end', 'state.set', 'evidence.add',
                    'speech.start', 'speech.mark', 'speech.end', 'interrupt', 'branch.open', 'branch.close',
                    'segment.text', 'segment.text']);
                const body = {
                    'segment.begin': { segmentId }, 'segment.end': { segmentId },
                    'segment.text': { segmentId, offset: Math.floor(next() * 40), text: pick(['Words.', 'More words here.', 'x']) },
                    'state.set': { segmentId, state: { tension: next() } },
                    'evidence.add': { segmentId, evidence: { id: pick(['e1', 'e2']), kind: 'supplied', title: 'T' } },
                    'speech.start': { segmentId }, 'speech.end': { segmentId, durationMs: 100 },
                    'speech.mark': { segmentId, charIndex: Math.floor(next() * 20), tMs: Math.floor(next() * 500) },
                    interrupt: { reason: 'user' },
                    'branch.open': { branchId: pick(['b1', 'b2']), parentSegmentId: segmentId, atCharacter: 1 },
                    'branch.close': { branchId: pick(['b1', 'b2']) }
                }[type];
                return { schema: RISE_CURRENT_EVENTS_SCHEMA, currentId: ID, seq: seq++, type, ...body };
            };
            stream.apply({ schema: RISE_CURRENT_EVENTS_SCHEMA, currentId: ID, seq: seq++, type: 'current.open',
                title: 'T', origin: { kind: 'human', name: 'A' } });
            for (let i = 0; i < 120; i += 1) {
                const event = make();
                // Some arrive early, some twice.
                stream.apply(event);
                if (next() < 0.2) stream.apply(event);
                const snap = stream.snapshot();
                expect(snap.nextSeq).toBeGreaterThanOrEqual(previousNext);
                previousNext = snap.nextSeq;
                expect(snap.segments.filter(s => !s.ended).length).toBeLessThanOrEqual(1);
                expect(snap.segments.length).toBeLessThanOrEqual(16);
                for (const s of snap.segments) {
                    expect(s.text.length).toBeLessThanOrEqual(4000);
                    expect(s.evidence.length).toBeLessThanOrEqual(8);
                }
                expect(stream.pressure).toBeLessThanOrEqual(STREAM_LIMITS.window);
                expect(Object.isFrozen(snap)).toBe(true);
            }
        }
    });
});

describe('a beat stream (beats streamed: each segment one beat of a rise.current.v2)', () => {
    const CODE = 'export default function scene(rise) {\n  return { frame() { rise.lib.clear(); }, cue() {} };\n}\n';
    /** A stream that admits scenes as the text-stream adapters' does. */
    const openedBeats = () => {
        const stream = createCurrentStream({ admitScene: sceneRefusal });
        const send = feed(stream);
        open(send);
        return { stream, send };
    };
    const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>';

    /** Beat `n`, whole: its begin, its words (if any) and its end. Returns the end's result. */
    const beat = (send, n, body, words) => {
        const segmentId = `beat-${n}`;
        const began = send('segment.begin', { segmentId, beat: body });
        if (began.status !== 'applied') return began;
        if (words) send('segment.text', { segmentId, offset: 0, text: words });
        return send('segment.end', { segmentId });
    };
    /** A code or SVG scene's source, in pieces of `size`. */
    const source = (send, sceneId, form, text, size = 40) => {
        send('scene.declare', { sceneId, form });
        for (let offset = 0; offset < text.length; offset += size) {
            send('scene.text', { sceneId, offset, text: text.slice(offset, offset + size) });
        }
    };

    it('lowers the beats that have ended to a valid rise.current.v2, a prefix of every later one', () => {
        const { stream, send } = openedBeats();
        expect(beat(send, 0, {}, 'Light carries every colour.').status).toBe('applied');
        expect(stream.toCurrent()).toMatchObject({ schema: 'rise.current.v2', beats: [{ say: 'Light carries every colour.' }] });
        send('scene.declare', { sceneId: 'field', engine: 'attractor', params: { palette: 'jade' } });
        beat(send, 1, { scene: 'field', cue: 'bright', place: 'caption' }, 'The sky scatters blue.');
        beat(send, 2, { hold: { ms: 1500 }, cue: 'calm' });
        beat(send, 3, { hold: { ms: 900 }, size: 'display' }, 'Rayleigh');
        beat(send, 4, { show: 'Blue scatters as $1/\\lambda^4$.' }, 'Blue scatters most.');
        send('segment.begin', { segmentId: 'beat-5', beat: {} });
        send('segment.text', { segmentId: 'beat-5', offset: 0, text: 'Still being written' });
        const current = stream.toCurrent();
        expect(current.scenes).toEqual([{ id: 'field', engine: 'attractor', params: { palette: 'jade' } }]);
        // As a model would write it: the very object a host's rise_present takes.
        expect(current.beats).toEqual([
            { say: 'Light carries every colour.' },
            { say: 'The sky scatters blue.', scene: 'field', cue: 'bright', place: 'caption' },
            { hold: { ms: 1500 }, cue: 'calm' },
            { show: 'Rayleigh', hold: { ms: 900 }, size: 'display' },
            { say: 'Blue scatters most.', show: 'Blue scatters as $1/\\lambda^4$.' }
        ]);
        expect(Object.isFrozen(current.beats[1])).toBe(true);
        // The sealed compiler takes it, and a hold is one silent atom of its own length.
        const session = compileRiseCurrent(current);
        expect(session.atoms.find(atom => atom.sourceId === 'beat-2').hold).toEqual({ ms: 1500, sceneId: 'field' });
    });

    it('carries more beats than a passage stream has passages', () => {
        const { stream, send } = openedBeats();
        for (let n = 0; n < 20; n += 1) expect(beat(send, n, n % 2 ? { hold: { ms: 300 } } : {}, n % 2 ? '' : `Beat ${n}.`).status, `beat ${n}`).toBe('applied');
        expect(stream.toCurrent().beats).toHaveLength(20);
    });

    it('is one kind of stream or the other: passages and beats do not mix', () => {
        const passages = openedBeats();
        segment(passages.send, 's1', 'A passage.');
        expect(passages.send('segment.begin', { segmentId: 'beat-1', beat: {} })).toMatchObject({ status: 'refused', code: 'BEAT_MIXED' });
        expect(passages.send('scene.declare', { sceneId: 'f', engine: 'attractor' })).toMatchObject({ status: 'refused', code: 'BEAT_MIXED' });
        const beats = openedBeats();
        beat(beats.send, 0, {}, 'A beat.');
        expect(beats.send('segment.begin', { segmentId: 's2' })).toMatchObject({ status: 'refused', code: 'BEAT_MIXED' });
    });

    it('names a beat by its place, the id the sealed Current gives it', () => {
        const { send } = openedBeats();
        expect(send('segment.begin', { segmentId: 'beat-1', beat: {} })).toMatchObject({ status: 'refused', code: 'BEAT_ID' });
        expect(send('segment.begin', { segmentId: 'intro', beat: {} })).toMatchObject({ status: 'refused', code: 'BEAT_ID' });
        expect(beat(send, 0, {}, 'First.').status).toBe('applied');
    });

    it('holds each beat to rise.current.v2’s own rules, with its codes', () => {
        const { stream, send } = openedBeats();
        expect(send('segment.begin', { segmentId: 'beat-0', beat: { scene: 'nowhere' } })).toMatchObject({ code: 'BEAT_SCENE' });
        expect(send('segment.begin', { segmentId: 'beat-0', beat: { cue: 'bright' } })).toMatchObject({ code: 'BEAT_CUE' });
        expect(send('segment.begin', { segmentId: 'beat-0', beat: { hold: { ms: 50 } } })).toMatchObject({ code: 'BEAT_HOLD' });
        expect(send('segment.begin', { segmentId: 'beat-0', beat: { hold: { ms: 900 }, show: 'x' } })).toMatchObject({ code: 'BEAT_KIND' });
        expect(send('segment.begin', { segmentId: 'beat-0', beat: { sound: 'kazoo' } })).toMatchObject({ code: 'BEAT_SOUND' });
        send('scene.declare', { sceneId: 'field', engine: 'attractor' });
        expect(send('segment.begin', { segmentId: 'beat-0', beat: { scene: 'field', cue: 'explode' } })).toMatchObject({ code: 'BEAT_CUE' });
        // A said beat says something.
        send('segment.begin', { segmentId: 'beat-0', beat: {} });
        expect(send('segment.end', { segmentId: 'beat-0' })).toMatchObject({ status: 'refused', code: 'EMPTY_SEGMENT' });
        expect(stream.snapshot().phase).toBe('open');
    });

    it('refuses a Dive on a beat: a rise.current.v2 has nowhere to keep one', () => {
        const { send } = openedBeats();
        send('segment.begin', { segmentId: 'beat-0', beat: {} });
        send('segment.text', { segmentId: 'beat-0', offset: 0, text: 'A horizon.' });
        expect(send('dive.attach', { segmentId: 'beat-0', dive: { id: 'd', text: 'More.', anchor: { fromCharacter: 0, toCharacter: 1, quoteStart: 'A', quoteEnd: 'A' } } }))
            .toMatchObject({ status: 'refused', code: 'BEAT_DIVE' });
    });

    it('declares scenes inline, each once, at most eight, natives against their manifest', () => {
        const { send } = openedBeats();
        expect(send('scene.declare', { sceneId: 'f', engine: 'teapot' })).toMatchObject({ code: 'SCENE_ENGINE' });
        expect(send('scene.declare', { sceneId: 'f', engine: 'attractor', params: { palette: 'tartan' } })).toMatchObject({ status: 'refused' });
        expect(send('scene.declare', { sceneId: 'f', engine: 'attractor' }).status).toBe('applied');
        expect(send('scene.declare', { sceneId: 'f', form: 'code' })).toMatchObject({ code: 'DUPLICATE_SCENE' });
        for (let n = 1; n < 8; n += 1) send('scene.declare', { sceneId: `s${n}`, engine: 'genesis' });
        expect(send('scene.declare', { sceneId: 's8', engine: 'genesis' })).toMatchObject({ code: 'TOO_MANY_SCENES' });
    });

    it('takes a scene’s source in order, within its budget, until a beat starts it', () => {
        const { send } = openedBeats();
        expect(send('scene.text', { sceneId: 'disk', offset: 0, text: 'x' })).toMatchObject({ code: 'UNKNOWN_SCENE' });
        send('scene.declare', { sceneId: 'field', engine: 'attractor' });
        expect(send('scene.text', { sceneId: 'field', offset: 0, text: 'x' })).toMatchObject({ code: 'UNKNOWN_SCENE' });
        send('scene.declare', { sceneId: 'disk', form: 'code' });
        expect(send('scene.text', { sceneId: 'disk', offset: 3, text: 'x' })).toMatchObject({ code: 'TEXT_OFFSET' });
        send('scene.declare', { sceneId: 'big', form: 'svg' });
        let refused = null;
        for (let offset = 0; offset <= 34_000 && !refused; offset += 2_000) {
            const result = send('scene.text', { sceneId: 'big', offset, text: 'é'.repeat(2_000) });
            if (result.status === 'refused') refused = result.code;
        }
        expect(refused).toBe('SCENE_TOO_LARGE');
    });

    it('admits a code scene and a figure when a beat starts them, by the Worker’s own admission, and seals their source', () => {
        const { stream, send } = openedBeats();
        source(send, 'disk', 'code', CODE);
        source(send, 'fig', 'svg', SVG);
        expect(beat(send, 0, { scene: 'disk', cue: 'spin' }, 'A disk of light.').status).toBe('applied');
        expect(send('scene.text', { sceneId: 'disk', offset: CODE.length, text: '// more' })).toMatchObject({ code: 'SCENE_CLOSED' });
        beat(send, 1, { scene: 'fig' }, 'Its shadow.');
        expect(stream.refusedScenes).toEqual([]);
        expect(stream.toCurrent().scenes).toEqual([{ id: 'disk', code: CODE }, { id: 'fig', svg: SVG }]);
    });

    it('refuses a scene the admission refuses, in the Worker’s words, and the reading goes on without it', () => {
        const { stream, send } = openedBeats();
        send('scene.declare', { sceneId: 'field', engine: 'attractor' });
        beat(send, 0, { scene: 'field' }, 'A field first.');
        source(send, 'thief', 'code', 'export default function scene(rise) {\n  fetch("/x");\n  return { frame() {} };\n}\n');
        source(send, 'bad', 'svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">\n<foreignObject/></svg>');
        // The beat that starts it keeps its words and typography; it starts nothing, and no cue lands while that scene was meant to run.
        expect(beat(send, 1, { scene: 'thief', cue: 'go', place: 'caption' }, 'Watch it go.').status).toBe('applied');
        expect(beat(send, 2, { hold: { ms: 1200 }, cue: 'steal' }).status).toBe('applied');
        expect(beat(send, 3, { scene: 'bad' }, 'A picture.').status).toBe('applied');
        expect(beat(send, 4, { scene: 'field', cue: 'bright' }, 'Back to the field.').status).toBe('applied');
        expect(stream.refusedScenes).toEqual([
            { sceneId: 'thief', message: expect.stringMatching(/^Scene "thief" was refused: line 2, column 3: `fetch` is not available to a scene/u) },
            { sceneId: 'bad', message: 'Scene "bad" was refused: line 2, column 1: <foreignObject> is not an element a figure may use.' }
        ]);
        const current = stream.toCurrent();
        expect(current.scenes.map(scene => scene.id)).toEqual(['field']);
        expect(current.beats).toEqual([
            { say: 'A field first.', scene: 'field' },
            { say: 'Watch it go.', place: 'caption' },
            { hold: { ms: 1200 } },
            { say: 'A picture.' },
            { say: 'Back to the field.', scene: 'field', cue: 'bright' }
        ]);
        // A refused scene is never tried again.
        expect(beat(send, 5, { scene: 'thief' }, 'Again.').status).toBe('applied');
        expect(stream.refusedScenes).toHaveLength(2);
    });

    it('admits no generated scene and no figure when it is handed no admission: closed, never on trust', () => {
        const stream = createCurrentStream();
        const send = feed(stream);
        open(send);
        source(send, 'disk', 'code', CODE);
        expect(beat(send, 0, { scene: 'disk' }, 'A disk.').status).toBe('applied');
        expect(stream.refusedScenes).toEqual([{ sceneId: 'disk', message: 'Scene "disk" was refused: nothing here can admit a generated scene or a figure.' }]);
        expect(stream.toCurrent()).not.toHaveProperty('scenes');
    });

    it('completes as a Current the Worker’s rise_present accepts', async () => {
        const { stream, send } = openedBeats();
        send('scene.declare', { sceneId: 'field', engine: 'attractor' });
        source(send, 'disk', 'code', CODE);
        source(send, 'fig', 'svg', SVG);
        beat(send, 0, { scene: 'field', cue: 'calm' }, 'A field.');
        beat(send, 1, { hold: { ms: 1000 }, cue: 'bright' });
        beat(send, 2, { scene: 'disk', cue: 'spin' }, 'A disk.');
        beat(send, 3, { scene: 'fig', hold: { ms: 800 } }, 'A figure.');
        expect(send('current.complete').status).toBe('applied');
        const { dispatch } = await import('../../worker/mcp-server.mjs');
        const { TOOL_NAME } = await import('./guide/index.js');
        const response = dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: TOOL_NAME, arguments: { current: stream.toCurrent() } } }, 'https://rise.invalid');
        const { result, error } = await response.json();
        expect(error).toBeUndefined();
        expect(result.isError, result.content?.map(item => item.text).join('\n')).not.toBe(true);
    });
});

describe('the interjection’s ending (stage 4.5)', () => {
    it('is kept as the answer named it when it completes, and is null when it named none', () => {
        const named = opened();
        segment(named.send, 's1', 'In short, nothing escapes.');
        expect(named.stream.ending).toBeNull();
        expect(named.send('current.complete', { ending: 'replace' }).status).toBe('applied');
        expect(named.stream.ending).toBe('replace');

        const plain = opened();
        segment(plain.send, 's1', 'In short, nothing escapes.');
        plain.send('current.complete');
        expect(plain.stream.ending).toBeNull();
    });
});
