/**
 * What every provider adapter must do, asserted the same way for each.
 *
 * An adapter is trusted with one thing: turning what a provider says into
 * `rise.current-events.v1` events. This suite checks that it does, against a
 * fixed answer, for the situations a provider will actually put it in. It
 * cannot tell how an adapter gets there, so each adapter's test supplies a
 * `scenario(name)` that stages the named situation its own way: the mock by
 * script, a network adapter by replaying a recorded wire conversation through a
 * fake transport. The assertions never change, which is what keeps provider
 * peculiarities from leaking past the boundary.
 *
 * Scenarios an adapter must be able to stage:
 *   'black-holes'   the fixed answer, start to finish
 *   'interrupt'     the reader interrupts part way through
 *   'transport-loss' the connection drops once, then is resumed
 *   'provider-failure' the provider fails outright
 *
 * `scenario(name)` returns `{ adapter, clock, request, interruptAfterMs?, resumeFrom? }`.
 * `clock` is a virtual clock the suite advances.
 *
 * Things an adapter may honestly not do, stated when it is described:
 *   carries.evidence, carries.dives  a text-only provider carries neither
 *   carries.ids   false when the provider does not name segments (it is numbered)
 *   carries.state false when the provider has no way to say what a segment is meant to be like
 *   skip          scenarios that cannot happen to this adapter, by name: 'interrupt' for a provider
 *                 whose answer arrives whole, 'transport-loss' for one with no transport to lose.
 *                 Each skip is stated where the adapter is described, and held by its own test.
 *   resume        'full' or 'replay'. 'replay' is a provider whose dropped stream
 *                 cannot be continued: resume replays what was received, then the
 *                 Current ends failed with everything already committed intact.
 */
import { describe, expect, it } from 'vitest';
import { assertAdapter, assertConnection } from '../live/adapter.js';
import { BLACK_HOLES } from '../live/fixtures/black-holes.js';
import { validateEvent } from '../live/protocol.js';
import { createCurrentStream } from '../live/stream.js';

export const CONFORMANCE_SCENARIOS = Object.freeze(['black-holes', 'interrupt', 'transport-loss', 'provider-failure']);

/** Read a connection into a reducer, recording every raw event and how it ended. */
async function consume(connection, stream, seen) {
    try {
        for await (const event of connection.events) {
            seen.push(event);
            stream.apply(event);
        }
        return null;
    } catch (error) {
        return error;
    }
}

/** The fixed answer, as the reducer should hold it once an adapter has delivered it. */
export function expectBlackHoles(snapshot, { evidence = true, dives = true, ids = true, state = true } = {}) {
    expect(snapshot.phase).toBe('complete');
    expect(snapshot.refusals).toBe(0);
    expect(snapshot.segments.map(s => [ids ? s.id : null, s.text, s.ended]))
        .toEqual(BLACK_HOLES.segments.map(s => [ids ? s.id : null, s.text, true]));
    expect(snapshot.segments.map(s => s.visual)).toEqual(BLACK_HOLES.segments.map(s => s.visual));
    if (state) expect(snapshot.segments.map(s => s.state)).toEqual(BLACK_HOLES.segments.map(s => s.state));
    else expect(snapshot.segments.every(s => Object.keys(s.state).length === 0)).toBe(true);
    if (evidence) {
        expect(snapshot.segments.flatMap(s => s.evidence.map(e => [e.id, e.kind, e.uri])))
            .toEqual(BLACK_HOLES.segments.flatMap(s => (s.evidence ?? []).map(e => [e.id, e.kind, e.uri])));
    } else {
        // Never invented: an adapter that does not carry evidence carries none.
        expect(snapshot.segments.flatMap(s => s.evidence)).toEqual([]);
    }
    if (dives) {
        expect(snapshot.segments.flatMap(s => s.dives.map(d => d.id)))
            .toEqual(BLACK_HOLES.segments.flatMap(s => (s.dives ?? []).map(d => d.id)));
    } else {
        expect(snapshot.segments.flatMap(s => s.dives)).toEqual([]);
    }
    expect(snapshot.origin.kind).toBe('model');
}

export function describeAdapterConformance(name, scenario, { carries = {}, resume = 'full', skip = [] } = {}) {
    describe(`adapter conformance: ${name}`, () => {
        it('meets the adapter and connection contracts', async () => {
            const { adapter, request, clock } = scenario('black-holes');
            expect(() => assertAdapter(adapter)).not.toThrow();
            const connection = await adapter.open(request);
            expect(() => assertConnection(connection)).not.toThrow();
            await connection.close();
            expect(clock.pending()).toBe(0);
        });

        it('delivers the fixed answer, with everything attached, as a complete Current', async () => {
            const { adapter, clock, request } = scenario('black-holes');
            const connection = await adapter.open(request);
            const stream = createCurrentStream();
            const reading = consume(connection, stream, []);
            await clock.runAll();
            expect(await reading).toBeNull();
            expectBlackHoles(stream.snapshot(), carries);
        });

        it('emits only valid events, numbered without a gap from zero', async () => {
            const { adapter, clock, request } = scenario('black-holes');
            const connection = await adapter.open(request);
            const seen = [];
            const reading = consume(connection, createCurrentStream(), seen);
            await clock.runAll();
            await reading;
            seen.forEach((event, index) => {
                expect(() => validateEvent(event), `event ${index}`).not.toThrow();
                expect(event.seq, `event ${index}`).toBe(index);
            });
            expect(new Set(seen.map(e => e.currentId)).size).toBe(1);
        });

        it('never lets a provider peculiarity through: every event is a RISE event, and only those', async () => {
            const { adapter, clock, request } = scenario('black-holes');
            const connection = await adapter.open(request);
            const seen = [];
            const reading = consume(connection, createCurrentStream(), seen);
            await clock.runAll();
            await reading;
            for (const event of seen) {
                expect(Object.keys(event)).not.toContain('raw');
                expect(event.schema).toBe('rise.current-events.v1');
                expect(JSON.stringify(event)).not.toMatch(/response\.|conversation\.item|input_audio_buffer/u);
            }
        });

        it('lowers the committed words to a sealed Current that says what the answer says', async () => {
            const { adapter, clock, request } = scenario('black-holes');
            const connection = await adapter.open(request);
            const stream = createCurrentStream();
            const reading = consume(connection, stream, []);
            await clock.runAll();
            await reading;
            expect(stream.toCurrent().segments.map(s => s.text)).toEqual(BLACK_HOLES.segments.map(s => s.text));
        });

        (skip.includes('interrupt') ? it.skip : it)('stops when the reader interrupts, tells the stream in order, and frees what it held', async () => {
            const { adapter, clock, request, interruptAfterMs } = scenario('interrupt');
            const connection = await adapter.open(request);
            const stream = createCurrentStream();
            const reading = consume(connection, stream, []);
            await clock.advance(interruptAfterMs);
            await connection.interrupt({ text: 'wait' });
            await clock.runAll();
            expect(await reading).toBeNull();
            const snap = stream.snapshot();
            expect(snap.phase).toBe('cancelled');
            expect(snap.interruptions.map(i => i.reason)).toEqual(['user']);
            expect(clock.pending()).toBe(0);
        });

        if (skip.includes('transport-loss')) {
            // Nothing to lose: held by the adapter's own test.
        } else if (resume === 'full') {
            it('says so when the connection is lost, and continues after a resume without repeating itself', async () => {
                const { adapter, clock, request } = scenario('transport-loss');
                const connection = await adapter.open(request);
                const stream = createCurrentStream();
                const first = consume(connection, stream, []);
                await clock.runAll();
                const lost = await first;
                expect(lost).toMatchObject({ recoverable: true });
                await connection.resume(stream.snapshot().nextSeq);
                const second = consume(connection, stream, []);
                await clock.runAll();
                expect(await second).toBeNull();
                expectBlackHoles(stream.snapshot(), carries);
            });

            it('lets a resume start earlier than needed, and the repeats change nothing', async () => {
                const { adapter, clock, request } = scenario('transport-loss');
                const connection = await adapter.open(request);
                const stream = createCurrentStream();
                const first = consume(connection, stream, []);
                await clock.runAll();
                await first;
                await connection.resume(1);
                const second = consume(connection, stream, []);
                await clock.runAll();
                await second;
                expectBlackHoles(stream.snapshot(), carries);
            });
        } else {
            // A provider whose dropped stream cannot be continued says so, keeps what it had, and ends failed.
            it('says so when the connection is lost, and after a resume ends failed with everything committed intact', async () => {
                const { adapter, clock, request } = scenario('transport-loss');
                const connection = await adapter.open(request);
                const stream = createCurrentStream();
                const first = consume(connection, stream, []);
                await clock.runAll();
                expect(await first).toMatchObject({ recoverable: true });
                const committed = stream.snapshot().segments.filter(s => s.ended).length;
                await connection.resume(stream.snapshot().nextSeq);
                const second = consume(connection, stream, []);
                await clock.runAll();
                expect(await second).toBeNull();
                const snap = stream.snapshot();
                expect(snap.phase).toBe('failed');
                expect(snap.error).toMatchObject({ code: 'CONNECTION_LOST', recoverable: false });
                expect(snap.refusals).toBe(0);
                const ended = snap.segments.filter(s => s.ended);
                expect(ended.length).toBeGreaterThanOrEqual(committed);
                expect(ended.length).toBeGreaterThan(0);
                ended.forEach((segment, i) => expect(segment.text).toBe(BLACK_HOLES.segments[i].text));
            });

            it('lets a resume start earlier than needed, and the repeats change nothing', async () => {
                const { adapter, clock, request } = scenario('transport-loss');
                const connection = await adapter.open(request);
                const stream = createCurrentStream();
                const first = consume(connection, stream, []);
                await clock.runAll();
                await first;
                await connection.resume(1);
                const second = consume(connection, stream, []);
                await clock.runAll();
                await second;
                const snap = stream.snapshot();
                expect(snap.phase).toBe('failed');
                expect(snap.refusals).toBe(0);
            });
        }

        it('ends the Current failed, with a reason, when the provider fails outright', async () => {
            const { adapter, clock, request } = scenario('provider-failure');
            const connection = await adapter.open(request);
            const stream = createCurrentStream();
            const reading = consume(connection, stream, []);
            await clock.runAll();
            await reading;
            const snap = stream.snapshot();
            expect(snap.phase).toBe('failed');
            expect(snap.error).toMatchObject({ recoverable: false });
            expect(snap.error.code).toEqual(expect.any(String));
        });

        it('closes cleanly, and more than once, releasing every timer and ending the stream', async () => {
            const { adapter, clock, request } = scenario('black-holes');
            const connection = await adapter.open(request);
            const reading = consume(connection, createCurrentStream(), []);
            await clock.advance(200);
            await connection.close();
            await connection.close();
            expect(await reading).toBeNull();
            expect(clock.pending()).toBe(0);
        });

        it('takes a Dive from a place in a parent, and answers as a Current of its own', async () => {
            const { adapter, clock, request } = scenario('black-holes');
            const parent = {
                currentId: 'answer-0', segmentId: 'horizon', atCharacter: 24, context: [BLACK_HOLES.segments[1].text]
            };
            const connection = await adapter.open({ intent: 'dive', prompt: 'dive on event horizon', parent });
            expect(request.intent).toBe('answer');
            const stream = createCurrentStream();
            const reading = consume(connection, stream, []);
            await clock.runAll();
            await reading;
            const snap = stream.snapshot();
            expect(snap.phase).toBe('complete');
            expect(snap.currentId).not.toBe('answer-0');
            expect(snap.segments.length).toBeGreaterThan(0);
        });
    });
}
