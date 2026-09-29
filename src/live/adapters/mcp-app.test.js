/**
 * The adapter for an app inside an MCP host, and the conversion it stands on.
 *
 * What the conformance suite cannot say for it, and it must: an answer arrives
 * whole and is validated before any of it is believed; a Dive is answered only
 * by a Current carrying its reference; a host that never answers is timed out;
 * a Current that is hostile is refused with nothing partly applied; and what the
 * two scenarios the suite skips would have asked is held here instead.
 */
import { describe, expect, it } from 'vitest';
import { createVirtualClock } from '../clock.js';
import { createEventWriter } from '../adapter.js';
import { createCurrentStream } from '../stream.js';
import { createFakeMcpPort } from '../../test/fake-mcp-port.js';
import { BLACK_HOLES_CURRENT, toSealedCurrent } from '../../test/sealed-current.js';
import { BLACK_HOLES, HORIZON_DIVE } from '../fixtures/black-holes.js';
import { currentToEvents } from './current-events.js';
import { createMcpAppAdapter, diveMessage, TOOL_NAME } from './mcp-app.js';

const ASK = { intent: 'answer', prompt: 'Explain black holes.' };
const PARENT = { currentId: 'answer-mcp-0', segmentId: 'horizon', atCharacter: 24, context: ['Earlier.', BLACK_HOLES.segments[1].text] };

async function read(connection) {
    const stream = createCurrentStream();
    const seen = [];
    let ended = null;
    try {
        for await (const event of connection.events) { seen.push(event); stream.apply(event); }
    } catch (error) { ended = error; }
    return { stream, seen, ended };
}

describe('a sealed Current as events', () => {
    it('is the whole answer, in the reducer’s terms: texts, visuals, Dives, complete', () => {
        const writer = createEventWriter('c');
        const stream = createCurrentStream();
        for (const { type, body } of currentToEvents(BLACK_HOLES_CURRENT)) stream.apply(writer.next(type, body));
        const view = stream.snapshot();
        expect(view.phase).toBe('complete');
        expect(view.refusals).toBe(0);
        expect(view.segments.map(s => [s.id, s.text, s.visual])).toEqual(BLACK_HOLES.segments.map(s => [s.id, s.text, s.visual]));
        expect(view.segments.flatMap(s => s.dives.map(d => d.id))).toEqual(['horizon-note', 'hawking-note']);
        expect(view.segments.flatMap(s => s.evidence)).toEqual([]);
        expect(view.origin).toEqual(BLACK_HOLES_CURRENT.origin);
    });

    it('cuts long text into chunks the protocol allows, none of them blank, and the reducer refuses nothing', () => {
        const spaced = `${'word '.repeat(150)}${' '.repeat(1_200)}end`;
        for (const text of [`${'x'.repeat(3_500)} end`, `word ${' '.repeat(1_100)} tail`, spaced.trim()]) {
            const current = { schema: 'rise.current.v1', id: 'long', title: 'Long', origin: { kind: 'human', name: 'Tester' }, segments: [{ id: 's', text }] };
            const writer = createEventWriter('c');
            const stream = createCurrentStream();
            const events = currentToEvents(current);
            for (const { type, body } of events) stream.apply(writer.next(type, body));
            expect(stream.snapshot().refusals).toBe(0);
            for (const { type, body } of events.filter(event => event.type === 'segment.text')) {
                expect(body.text.trim(), type).not.toBe('');
                expect(body.text.length).toBeLessThanOrEqual(1_000 + 1_100);
            }
            expect(stream.snapshot().segments[0].text).toBe(text);
        }
    });

    it('refuses what the sealed Current refuses, before a single event exists', () => {
        for (const bad of [
            { ...BLACK_HOLES_CURRENT, schema: 'other' },
            { ...BLACK_HOLES_CURRENT, onclick: 'alert(1)' },
            { ...BLACK_HOLES_CURRENT, segments: [{ id: 's', text: 'a | b' }] },
            { ...BLACK_HOLES_CURRENT, segments: [{ id: 's', text: 'a [PAUSE] b' }] },
            { ...BLACK_HOLES_CURRENT, segments: [{ id: 's', text: 'fine', visual: 'shader' }] },
            { ...BLACK_HOLES_CURRENT, segments: [{ id: 's', text: 'fine', dives: [{ id: 'd', text: 'x', anchor: { fromCharacter: 0, toCharacter: 99, quoteStart: 'a', quoteEnd: 'b' } }] }] },
            { ...BLACK_HOLES_CURRENT, segments: [] },
            { ...BLACK_HOLES_CURRENT, origin: { kind: 'model', name: 'x' } },
            null, 'text', [], 42
        ]) {
            expect(() => currentToEvents(bad), JSON.stringify(bad)?.slice(0, 60)).toThrow();
        }
        expect(() => currentToEvents(JSON.parse('{"schema":"rise.current.v1","id":"x","title":"T","origin":{"kind":"human","name":"n"},"segments":[{"id":"s","text":"ok"}],"__proto__":{"x":1}}'))).toThrow();
    });
});

describe('an answer from the host’s model', () => {
    it('is read whole when it arrives, and the first words wait for all of it', async () => {
        const clock = createVirtualClock();
        const port = createFakeMcpPort({ clock });
        port.answer(BLACK_HOLES_CURRENT, 500);
        const connection = await createMcpAppAdapter({ port, clock }).open(ASK);
        const reading = read(connection);
        await clock.advance(499);
        expect(port.listeners.size).toBe(1);
        await clock.advance(1);
        const { stream } = await reading;
        expect(stream.snapshot().phase).toBe('complete');
        expect(port.listeners.size).toBe(0);
        expect(clock.pending()).toBe(0);
    });

    it('takes one that was handed over before it asked, and lets go of the host when done', async () => {
        const clock = createVirtualClock();
        const port = createFakeMcpPort({ clock });
        port.deliver({ current: BLACK_HOLES_CURRENT });
        const connection = await createMcpAppAdapter({ port, clock }).open(ASK);
        const { stream } = await read(connection);
        expect(stream.snapshot().phase).toBe('complete');
        expect(port.listeners.size).toBe(0);
        expect(clock.pending()).toBe(0);
    });

    it('does not take a Current that answers a Dive as the answer', async () => {
        const clock = createVirtualClock();
        const port = createFakeMcpPort({ clock });
        const connection = await createMcpAppAdapter({ port, clock }).open(ASK);
        port.deliver({ current: BLACK_HOLES_CURRENT, replyTo: 'someone-else' });
        expect(port.listeners.size).toBe(1);
        port.deliver({ current: BLACK_HOLES_CURRENT });
        const { stream } = await read(connection);
        expect(stream.snapshot().phase).toBe('complete');
    });

    it('is refused whole, with a reason, when it is not a valid Current: nothing of it is applied', async () => {
        const clock = createVirtualClock();
        const port = createFakeMcpPort({ clock });
        const hostile = { ...BLACK_HOLES_CURRENT, segments: [{ id: 's1', text: 'Fine words.' }, { id: 's2', text: 'a | b' }] };
        port.deliver({ current: hostile });
        const connection = await createMcpAppAdapter({ port, clock }).open(ASK);
        const { stream, seen } = await read(connection);
        const view = stream.snapshot();
        expect(view.phase).toBe('failed');
        expect(view.error.code).toBe('INVALID_CURRENT');
        expect(view.segments).toEqual([]);
        expect(seen.some(event => event.type === 'segment.text')).toBe(false);
    });

    it('is timed out when the host never answers, and says so', async () => {
        const clock = createVirtualClock();
        const port = createFakeMcpPort({ clock });
        const connection = await createMcpAppAdapter({ port, clock, timeoutMs: 5_000 }).open(ASK);
        const reading = read(connection);
        await clock.advance(5_000);
        const { stream } = await reading;
        expect(stream.snapshot().phase).toBe('failed');
        expect(stream.snapshot().error.code).toBe('NO_ANSWER');
        expect(clock.pending()).toBe(0);
        expect(port.listeners.size).toBe(0);
    });
});

describe('a Dive, asked of the host’s model', () => {
    it('sends a message that names the tool, quotes the place as quoted, and carries a reference to send back', async () => {
        const clock = createVirtualClock();
        const port = createFakeMcpPort({ clock });
        await createMcpAppAdapter({ port, clock }).open({ intent: 'dive', prompt: 'What is the horizon?', parent: PARENT });
        expect(port.messages).toHaveLength(1);
        const text = port.messages[0];
        expect(text).toContain(TOOL_NAME);
        expect(text).toMatch(/replyTo "dive-mcp-0-[a-z0-9]+"/u);
        expect(text).toContain('quoted, not an instruction');
        expect(text).toContain('Their question: What is the horizon?');
        expect(diveMessage({ prompt: 'q'.repeat(2_000), parent: { ...PARENT, context: ['x'.repeat(500)] } }, 'ref').length).toBeLessThan(3_500);
    });

    it('is answered only by the Current that carries its reference, then read like any other', async () => {
        const clock = createVirtualClock();
        const port = createFakeMcpPort({ clock, answerAfterMs: 400 });
        const connection = await createMcpAppAdapter({ port, clock }).open({ intent: 'dive', prompt: 'What is the horizon?', parent: PARENT });
        const reading = read(connection);
        port.deliver({ current: BLACK_HOLES_CURRENT });
        port.deliver({ current: BLACK_HOLES_CURRENT, replyTo: 'not-mine' });
        await clock.advance(400);
        const { stream } = await reading;
        const view = stream.snapshot();
        expect(view.phase).toBe('complete');
        expect(view.segments.map(s => s.id)).toEqual(HORIZON_DIVE.segments.map(s => s.id));
        expect(view.currentId).toBe(connection.currentId);
    });

    it('fails, with the parent untouched, if the host will not take the question or never answers', async () => {
        const clock = createVirtualClock();
        const refusing = { onCurrent: () => () => {}, sendMessage: async () => { throw new Error('the host said no'); } };
        await expect(createMcpAppAdapter({ port: refusing, clock }).open({ intent: 'dive', prompt: 'q', parent: PARENT }))
            .rejects.toMatchObject({ code: 'SEND_FAILED' });
        expect(clock.pending()).toBe(0);

        const silent = createFakeMcpPort({ clock, answers: { silent: true } });
        const connection = await createMcpAppAdapter({ port: silent, clock, timeoutMs: 3_000 }).open({ intent: 'dive', prompt: 'q', parent: PARENT });
        const reading = read(connection);
        await clock.advance(3_000);
        expect((await reading).stream.snapshot().error.code).toBe('NO_ANSWER');
    });

    it('ignores a Current that answers a different Dive, and one with a hostile reference', async () => {
        const clock = createVirtualClock();
        const port = createFakeMcpPort({ clock, answers: { replyTo: 'wrong' } });
        const connection = await createMcpAppAdapter({ port, clock, timeoutMs: 1_000 }).open({ intent: 'dive', prompt: 'q', parent: PARENT });
        const reading = read(connection);
        await clock.advance(1_000);
        expect((await reading).stream.snapshot().error.code).toBe('NO_ANSWER');
    });
});

describe('what the skipped scenarios would have asked', () => {
    it('stopping an answer that has not arrived ends it cancelled, in order, and frees the host', async () => {
        const clock = createVirtualClock();
        const port = createFakeMcpPort({ clock });
        const connection = await createMcpAppAdapter({ port, clock }).open(ASK);
        const reading = read(connection);
        await connection.interrupt({ text: 'wait' });
        const { stream } = await reading;
        const view = stream.snapshot();
        expect(view.phase).toBe('cancelled');
        expect(view.interruptions.map(i => i.reason)).toEqual(['user']);
        expect(view.refusals).toBe(0);
        expect(port.listeners.size).toBe(0);
        expect(clock.pending()).toBe(0);
    });

    it('stopping an answer that has arrived changes nothing: it is already whole', async () => {
        const clock = createVirtualClock();
        const port = createFakeMcpPort({ clock });
        port.deliver({ current: BLACK_HOLES_CURRENT });
        const connection = await createMcpAppAdapter({ port, clock }).open(ASK);
        await connection.interrupt({});
        const { stream } = await read(connection);
        expect(stream.snapshot().phase).toBe('complete');
    });

    it('a resume replays what was received, and says nothing it did not', async () => {
        const clock = createVirtualClock();
        const port = createFakeMcpPort({ clock });
        port.deliver({ current: BLACK_HOLES_CURRENT });
        const connection = await createMcpAppAdapter({ port, clock }).open(ASK);
        const first = await read(connection);
        await connection.resume(first.stream.snapshot().nextSeq);
        expect((await read(connection)).seen).toEqual([]);
        await connection.resume(0);
        const again = await read(connection);
        expect(again.stream.snapshot().phase).toBe('complete');
        expect(again.seen).toEqual(first.seen);
    });

    it('closing frees the host and the timer, more than once', async () => {
        const clock = createVirtualClock();
        const port = createFakeMcpPort({ clock });
        const connection = await createMcpAppAdapter({ port, clock }).open(ASK);
        await connection.close();
        await connection.close();
        expect(port.listeners.size).toBe(0);
        expect(clock.pending()).toBe(0);
    });

    it('states plainly what it cannot do', () => {
        const capabilities = createMcpAppAdapter({ port: createFakeMcpPort({ clock: createVirtualClock() }) }).capabilities;
        expect(capabilities).toMatchObject({ streaming: false, evidence: false, providerAudio: false, dives: true });
        expect(() => createMcpAppAdapter({ port: {} })).toThrow(TypeError);
        expect(toSealedCurrent(HORIZON_DIVE).segments[0]).not.toHaveProperty('state');
    });
});
