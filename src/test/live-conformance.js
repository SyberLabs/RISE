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
export function expectBlackHoles(snapshot) {
    expect(snapshot.phase).toBe('complete');
    expect(snapshot.refusals).toBe(0);
    expect(snapshot.segments.map(s => [s.id, s.text, s.ended])).toEqual(BLACK_HOLES.segments.map(s => [s.id, s.text, true]));
    expect(snapshot.segments.map(s => s.visual)).toEqual(BLACK_HOLES.segments.map(s => s.visual));
    expect(snapshot.segments.map(s => s.state)).toEqual(BLACK_HOLES.segments.map(s => s.state));
    expect(snapshot.segments.flatMap(s => s.evidence.map(e => [e.id, e.kind, e.uri])))
        .toEqual(BLACK_HOLES.segments.flatMap(s => (s.evidence ?? []).map(e => [e.id, e.kind, e.uri])));
    expect(snapshot.segments.flatMap(s => s.dives.map(d => d.id)))
        .toEqual(BLACK_HOLES.segments.flatMap(s => (s.dives ?? []).map(d => d.id)));
    expect(snapshot.segments.every(s => s.speech.started && s.speech.ended)).toBe(true);
    expect(snapshot.origin.kind).toBe('model');
}

export function describeAdapterConformance(name, scenario) {
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
            expectBlackHoles(stream.snapshot());
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

        it('stops when the reader interrupts, tells the stream in order, and frees what it held', async () => {
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
            expectBlackHoles(stream.snapshot());
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
            expectBlackHoles(stream.snapshot());
        });

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
