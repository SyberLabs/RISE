/**
 * The deterministic provider.
 *
 * It runs on a clock the test owns, so "two seconds pass" is exact and the
 * whole suite needs no network, no credentials and no real waiting. It is also
 * the reference every other adapter is measured against, so it has to be able
 * to misbehave in every way a real provider might: slow, duplicated,
 * reordered, malformed, dropped, failed, interrupted.
 */
import { describe, expect, it } from 'vitest';
import { AdapterError, assertAdapter, assertConnection } from '../adapter.js';
import { createVirtualClock } from '../clock.js';
import { BLACK_HOLES, HORIZON_DIVE } from '../fixtures/black-holes.js';
import { createCurrentStream } from '../stream.js';
import { createMockAdapter } from './mock.js';
import { createMockBeatsAdapter } from './mock-beats.js';
import { BLACK_HOLES_BEATS_CURRENT } from '../fixtures/black-holes-beats.js';

const ASK = { intent: 'answer', prompt: 'Explain black holes with RISE.' };

/** Read a connection into a reducer as fast as the clock allows, noting when each event arrived. */
async function play({ options = {}, request = ASK, until = 'end' } = {}) {
    const clock = createVirtualClock();
    const adapter = createMockAdapter({ clock, ...options });
    const connection = await adapter.open(request);
    const stream = createCurrentStream();
    const arrivals = [];
    const reader = (async () => {
        try {
            for await (const event of connection.events) {
                arrivals.push({ at: clock.now(), event });
                stream.apply(event);
            }
        } catch (error) {
            return error;
        }
        return null;
    })();
    if (until === 'end') await clock.runAll();
    return { clock, adapter, connection, stream, arrivals, reader };
}

const snapshotOf = async options => {
    const run = await play(options);
    await run.reader;
    return run.stream.snapshot();
};

describe('the mock adapter as an adapter', () => {
    it('meets the contract, and says what it can do', async () => {
        const adapter = createMockAdapter({ clock: createVirtualClock() });
        expect(() => assertAdapter(adapter)).not.toThrow();
        const connection = await adapter.open(ASK);
        expect(() => assertConnection(connection)).not.toThrow();
        expect(adapter.capabilities).toMatchObject({ interruption: true, resume: true, providerAudio: false });
        await connection.close();
    });

    it('refuses a request that is not one', async () => {
        const adapter = createMockAdapter({ clock: createVirtualClock() });
        await expect(adapter.open({ intent: 'render', prompt: 'x' })).rejects.toBeInstanceOf(AdapterError);
        await expect(adapter.open({ intent: 'dive', prompt: 'x' })).rejects.toBeInstanceOf(AdapterError);
    });
});

describe('the answer', () => {
    it('uses a catalog opening only for the first answer segment and leaves Dive scripts intact', async () => {
        const run = await play({ options: { openingVisual: 'genesis' } });
        await run.reader;
        expect(run.arrivals.filter(a => a.event.type === 'segment.begin').map(a => a.event.visual)).toEqual([
            'genesis', 'still', 'still', 'genesis', 'attractor', 'still'
        ]);

        const diveRequest = {
            intent: 'dive', prompt: 'the event horizon',
            parent: { currentId: 'answer-0', segmentId: 'horizon', atCharacter: 24, context: [BLACK_HOLES.segments[1].text] }
        };
        const dive = await play({ options: { openingVisual: 'genesis' }, request: diveRequest });
        const defaultDive = await play({ request: diveRequest });
        await dive.reader;
        await defaultDive.reader;
        expect(dive.arrivals.map(a => a.event)).toEqual(defaultDive.arrivals.map(a => a.event));
        expect(dive.arrivals.filter(a => a.event.type === 'segment.begin').map(a => a.event.visual))
            .toEqual(HORIZON_DIVE.segments.map(segment => segment.visual));
    });

    it('rejects opening visuals outside the closed Current vocabulary', () => {
        expect(() => createMockAdapter({ openingVisual: 'klee' })).toThrow(/opening visual/u);
    });

    it('arrives as a complete, valid Current with everything attached', async () => {
        const snap = await snapshotOf();
        expect(snap.phase).toBe('complete');
        expect(snap.refusals).toBe(0);
        expect(snap.segments.map(s => [s.id, s.text, s.ended])).toEqual(
            BLACK_HOLES.segments.map(s => [s.id, s.text, true])
        );
        expect(snap.segments.map(s => s.visual)).toEqual(BLACK_HOLES.segments.map(s => s.visual));
        expect(snap.segments.map(s => s.state)).toEqual(BLACK_HOLES.segments.map(s => s.state));
        expect(snap.segments.flatMap(s => s.evidence.map(e => e.id)))
            .toEqual(['eht-2019', 'ligo-2016', 'hawking-1974']);
        expect(snap.segments.flatMap(s => s.dives.map(d => d.id))).toEqual(['horizon-note', 'hawking-note']);
        expect(snap.segments.every(s => !s.speech.started)).toBe(true);
        expect(snap.origin).toEqual(BLACK_HOLES.origin);
    });

    it('lowers to the same words the fixture holds', async () => {
        const run = await play();
        await run.reader;
        const said = run.stream.toCurrent().segments.map(s => s.text);
        expect(said).toEqual(BLACK_HOLES.segments.map(s => s.text));
    });

    it('is honest about what it does not know', async () => {
        const snap = await snapshotOf({ request: { intent: 'answer', prompt: 'Explain the French Revolution.' } });
        expect(snap.segments.map(s => s.text)).toEqual(['This demonstration can only explain black holes.']);
        expect(snap.segments[0].evidence).toEqual([]);
    });

    it('is the same every time', async () => {
        const events = async () => (await play().then(async run => { await run.reader; return run.arrivals })).map(a => [a.at, a.event]);
        expect(await events()).toEqual(await events());
    });
});

describe('time', () => {
    it('commits the first words almost at once, and has written the whole answer within two seconds', async () => {
        const run = await play();
        await run.reader;
        const firstText = run.arrivals.find(a => a.event.type === 'segment.text');
        const complete = run.arrivals.find(a => a.event.type === 'current.complete');
        expect(firstText.at).toBeLessThanOrEqual(100);
        expect(complete.at).toBeLessThan(2_000);
    });

    it('says nothing of speech: a voice is the runtime\'s, and reports through record', async () => {
        const run = await play();
        await run.reader;
        expect(run.arrivals.filter(a => a.event.type.startsWith('speech.'))).toEqual([]);
    });

    it('streams a segment in chunks, not all at once', async () => {
        const run = await play({ options: { chunkChars: 24 } });
        await run.reader;
        const chunks = run.arrivals.filter(a => a.event.type === 'segment.text' && a.event.segmentId === 'what');
        expect(chunks.length).toBeGreaterThan(3);
        expect(chunks.every(a => a.event.text.length <= 24)).toBe(true);
        expect(chunks.map(a => a.event.text).join('')).toBe(BLACK_HOLES.segments[0].text);
    });

    it('composes ahead: the last segment is written long before a voice could have said the first', async () => {
        const run = await play();
        await run.reader;
        const lastEnd = run.arrivals.find(a => a.event.type === 'segment.end' && a.event.segmentId === 'hawking');
        // Speaking the first segment alone takes several seconds at any natural pace.
        expect(lastEnd.at).toBeLessThan(2_000);
        expect(BLACK_HOLES.segments[0].text.length * 40).toBeGreaterThan(lastEnd.at);
    });

    it('takes proportionally longer when it is slow, and ends up the same', async () => {
        const fast = await play();
        await fast.reader;
        const slow = await play({ options: { faults: { slow: 3 } } });
        await slow.reader;
        const last = run => run.arrivals.at(-1).at;
        expect(last(slow)).toBeGreaterThan(last(fast) * 2);
        expect(slow.stream.snapshot()).toEqual(fast.stream.snapshot());
    });
});

describe('interruption and cleanup', () => {
    it('stops when the reader interrupts, says so in order, and leaves nothing running', async () => {
        const run = await play({ until: 'later' });
        await run.clock.advance(300);
        await run.connection.interrupt({ text: 'wait, dive on the horizon' });
        await run.clock.runAll();
        const snap = run.stream.snapshot();
        expect(snap.phase).toBe('cancelled');
        expect(snap.cancelReason).toBe('interrupted');
        expect(snap.interruptions).toEqual([{ seq: expect.any(Number), reason: 'user', text: 'wait, dive on the horizon' }]);
        // It stopped writing: only part of the answer was ever committed.
        expect(snap.segments.length).toBeGreaterThan(0);
        expect(snap.segments.length).toBeLessThan(BLACK_HOLES.segments.length);
        expect(run.arrivals.some(a => a.event.type === 'current.complete')).toBe(false);
        expect(run.clock.pending()).toBe(0);
        expect(await run.reader).toBeNull();
    });

    it('closes cleanly, more than once, and frees its timers', async () => {
        const run = await play({ until: 'later' });
        await run.clock.advance(300);
        await run.connection.close();
        await run.connection.close();
        expect(run.clock.pending()).toBe(0);
        expect(await run.reader).toBeNull();
        expect(run.stream.snapshot().phase).toBe('open');
    });

    it('accepts a host event through the ordered stream, numbered where it fell', async () => {
        const run = await play({ until: 'later' });
        await run.clock.advance(400);
        const recorded = run.connection.record('speech.mark', { segmentId: 'what', charIndex: 3, tMs: 90 });
        expect(recorded.seq).toBe(run.arrivals.at(-1).event.seq + 1);
        await run.connection.close();
    });

    it('refuses a host event that is not one, or is not valid, without spending a number', async () => {
        const run = await play({ until: 'later' });
        await run.clock.advance(100);
        const before = run.arrivals.at(-1).event.seq;
        expect(() => run.connection.record('segment.text', { segmentId: 'x', offset: 0, text: 'forged' })).toThrow(AdapterError);
        expect(() => run.connection.record('interrupt', { reason: 'admin' })).toThrow();
        const next = run.connection.record('interrupt', { reason: 'user' });
        expect(next.seq).toBe(before + 1);
        await run.connection.close();
    });
});

describe('a provider that misbehaves', () => {
    it('repeats events: the Current comes out the same', async () => {
        const clean = await snapshotOf();
        const run = await play({ options: { faults: { duplicate: [3, 10, 25] } } });
        await run.reader;
        expect(run.arrivals.length).toBeGreaterThan(new Set(run.arrivals.map(a => a.event.seq)).size);
        expect(run.stream.snapshot()).toEqual(clean);
    });

    it('sends events out of order: the Current comes out the same', async () => {
        const clean = await snapshotOf();
        const run = await play({ options: { faults: { reorder: [2, 7, 12] } } });
        await run.reader;
        const order = run.arrivals.map(a => a.event.seq);
        expect(order).not.toEqual([...order].sort((a, b) => a - b));
        expect(run.stream.snapshot()).toEqual(clean);
    });

    it('sends one malformed event that nothing depends on: it is refused, its slot is spent, and the rest is unharmed', async () => {
        // Sequence 2 is the first segment's state. Nothing else needs it.
        const run = await play({ options: { faults: { malformed: [2] } } });
        await run.reader;
        const snap = run.stream.snapshot();
        expect(snap.refusals).toBe(1);
        expect(snap.phase).toBe('complete');
        expect(snap.segments).toHaveLength(BLACK_HOLES.segments.length);
        expect(snap.segments[0].state).toEqual({});
    });

    it('sends a malformed event that a great deal depends on: the Current fails rather than carrying on without it', async () => {
        // Sequence 1 begins the first segment, so everything said into it is refused in turn.
        const run = await play({ options: { faults: { malformed: [1] } } });
        await run.reader;
        const snap = run.stream.snapshot();
        expect(snap.phase).toBe('failed');
        expect(snap.error.code).toBe('TOO_MANY_REFUSALS');
        expect(snap.segments).toEqual([]);
    });

    it('drops the connection: the reader resumes from what it has and gets the whole Current', async () => {
        const clean = await snapshotOf();
        const clock = createVirtualClock();
        const adapter = createMockAdapter({ clock, faults: { transportLossAfter: 9 } });
        const connection = await adapter.open(ASK);
        const stream = createCurrentStream();
        const consume = async () => {
            try {
                for await (const event of connection.events) stream.apply(event);
                return null;
            } catch (error) {
                return error;
            }
        };
        const first = consume();
        await clock.runAll();
        const error = await first;
        expect(error).toMatchObject({ code: 'TRANSPORT_LOST', recoverable: true });
        expect(stream.snapshot().phase).toBe('open');

        await connection.resume(stream.snapshot().nextSeq);
        const second = consume();
        await clock.runAll();
        expect(await second).toBeNull();
        expect(stream.snapshot()).toEqual(clean);
    });

    it('resumes from earlier than it needs to, and the repeats change nothing', async () => {
        const clean = await snapshotOf();
        const clock = createVirtualClock();
        const adapter = createMockAdapter({ clock, faults: { transportLossAfter: 9 } });
        const connection = await adapter.open(ASK);
        const stream = createCurrentStream();
        const consume = async () => {
            try { for await (const event of connection.events) stream.apply(event); return null; } catch (error) { return error; }
        };
        const first = consume();
        await clock.runAll();
        await first;
        await connection.resume(2);
        const second = consume();
        await clock.runAll();
        await second;
        expect(stream.snapshot()).toEqual(clean);
    });

    it('fails outright: the Current ends failed, and says why', async () => {
        const snap = await snapshotOf({ options: { faults: { failAfter: 6 } } });
        expect(snap.phase).toBe('failed');
        expect(snap.error).toMatchObject({ code: 'PROVIDER_FAILED', recoverable: false });
    });

    it('reports a recoverable error and carries on', async () => {
        const snap = await snapshotOf({ options: { faults: { recoverableErrorAfter: 6 } } });
        expect(snap.phase).toBe('complete');
        expect(snap.lastError).toMatchObject({ code: 'PROVIDER_SLOW', recoverable: true });
    });
});

describe('backpressure', () => {
    it('waits for a slow reader rather than piling events up, and loses none', async () => {
        const clock = createVirtualClock();
        const adapter = createMockAdapter({ clock, capacity: 4 });
        const connection = await adapter.open(ASK);
        await clock.runAll(); // nobody is reading
        const iterator = connection.events[Symbol.asyncIterator]();
        const stream = createCurrentStream();
        const seen = [];
        const drained = (async () => {
            for (let step = await iterator.next(); !step.done; step = await iterator.next()) {
                seen.push(step.value.seq);
                stream.apply(step.value);
            }
        })();
        await clock.runAll();
        await drained;
        expect(seen).toEqual(seen.map((_, i) => i));
        expect(stream.snapshot().phase).toBe('complete');
    });
});

describe('a Dive', () => {
    const parent = { currentId: 'answer-0', segmentId: 'horizon', atCharacter: 24, context: [BLACK_HOLES.segments[1].text] };

    it('is a Current of its own, taken from a place in a parent', async () => {
        const run = await play({ request: { intent: 'dive', prompt: 'dive on event horizon', parent } });
        await run.reader;
        const snap = run.stream.snapshot();
        expect(snap.phase).toBe('complete');
        expect(snap.currentId).not.toBe('answer-0');
        expect(snap.currentId).toMatch(/^dive-/u);
        expect(snap.segments.map(s => s.text)).toEqual(HORIZON_DIVE.segments.map(s => s.text));
    });

    it('says plainly when it has nothing prepared', async () => {
        const run = await play({ request: { intent: 'dive', prompt: 'the weather', parent } });
        await run.reader;
        expect(run.stream.snapshot().segments[0].text).toBe('This demonstration has no prepared answer for that.');
    });

    it('gives each Current its own identity', async () => {
        const clock = createVirtualClock();
        const adapter = createMockAdapter({ clock });
        const a = await adapter.open(ASK);
        const b = await adapter.open(ASK);
        expect(a.currentId).not.toBe(b.currentId);
        await a.close();
        await b.close();
    });
});

describe('the demo that writes in beats (the venue’s)', () => {
    async function stream(request = ASK) {
        const clock = createVirtualClock();
        const adapter = createMockBeatsAdapter({ clock });
        const connection = await adapter.open(request);
        const reducer = createCurrentStream({ admitScene: adapter.admitScene });
        const arrivals = [];
        const reading = (async () => {
            for await (const event of connection.events) {
                arrivals.push({ at: clock.now(), event });
                reducer.apply(event);
            }
        })();
        await clock.runAll();
        await reading;
        return { reducer, arrivals };
    }

    it('streams the black holes answer as the model would write it, and seals to the Current it means', async () => {
        const { reducer } = await stream();
        expect(reducer.snapshot()).toMatchObject({ phase: 'complete', refusals: 0 });
        const { scenes, beats } = reducer.toCurrent();
        expect({ scenes, beats }).toEqual(JSON.parse(JSON.stringify(BLACK_HOLES_BEATS_CURRENT)));
    });

    it('writes as a model writes, so the first beat, a hold and a scene arrive long before the answer is complete', async () => {
        const { arrivals } = await stream();
        const at = predicate => arrivals.find(({ event }) => predicate(event))?.at;
        const firstBeat = at(event => event.type === 'segment.end' && event.segmentId === 'beat-0');
        const hold = at(event => event.type === 'segment.end' && event.segmentId === 'beat-1');
        const figure = at(event => event.type === 'segment.begin' && event.beat?.scene === 'horizon');
        const complete = at(event => event.type === 'current.complete');
        expect(firstBeat).toBeLessThan(1_500);
        expect(hold).toBeLessThan(complete - 5_000);
        expect(figure).toBeLessThan(complete - 5_000);
    });

    it('says in the Current that it is RISE’s own demo, with no model and no key behind it', async () => {
        const { reducer } = await stream();
        expect(reducer.snapshot().origin).toEqual({ kind: 'model', name: 'RISE demo', provider: 'RISE' });
    });

    it('says plainly that it knows only black holes, in one beat', async () => {
        const { reducer } = await stream({ intent: 'answer', prompt: 'What is a quasar?' });
        expect(reducer.toCurrent().beats).toEqual([{ say: 'This demonstration can only explain black holes.' }]);
    });

    it('answers an interjection in two beats and resumes, or, asked to skip, replaces the rest (stage 4.5)', async () => {
        const reading = { passages: ['A black hole is a region of space.'], at: 0 };
        const resumed = await stream({ intent: 'interject', prompt: 'What is the horizon, really?', reading });
        expect(resumed.reducer.toCurrent().beats).toHaveLength(2);
        expect(resumed.reducer.ending).toBe('resume');
        const replaced = await stream({ intent: 'interject', prompt: 'Skip the rest: the short version.', reading });
        expect(replaced.reducer.toCurrent().beats).toHaveLength(2);
        expect(replaced.reducer.ending).toBe('replace');
    });
});
