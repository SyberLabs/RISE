import { describe, expect, it } from 'vitest';
import { createVirtualClock } from '../clock.js';
import { describeAdapterConformance } from '../../test/live-conformance.js';
import { BLACK_HOLES_BEATS_TEXT } from '../fixtures/black-holes-beats.js';
import { createFakeTextTransport } from '../../test/fake-text-transport.js';
import { createTextStreamAdapter } from './text-stream.js';

const ASK = { intent: 'answer', prompt: 'Explain black holes with RISE.' };

/** Each situation is staged in the fake provider. The adapter is the one that ships. */
const FAULTS = {
    'black-holes': {},
    interrupt: {},
    'transport-loss': { lossAfter: 30 },
    'provider-failure': { failAfter: 10 },
    // A generic provider's only way to say it stopped is an error, part way through a passage.
    'cut-short': { failAfter: 30 },
    // The answer written in beats, through the same wire.
    beats: { textFor: () => BLACK_HOLES_BEATS_TEXT }
};

describeAdapterConformance('text-stream (fake provider)', (name) => {
    const clock = createVirtualClock();
    return {
        clock,
        request: ASK,
        interruptAfterMs: 300,
        adapter: createTextStreamAdapter({
            id: 'fake-text',
            provider: 'fake',
            connect: createFakeTextTransport({ clock, ...FAULTS[name] })
        })
    };
}, { carries: { evidence: false, dives: false, ids: false }, resume: 'replay', beats: true });

describe('text-stream provider transport lifecycle', () => {
    async function openWithTransport() {
        let sink;
        let closed = false;
        const adapter = createTextStreamAdapter({
            id: 'lifecycle',
            provider: 'test',
            connect: async (_request, providerSink) => {
                sink = providerSink;
                return { cancel() {}, close() { closed = true; } };
            }
        });
        const connection = await adapter.open(ASK);
        return { connection, sink, isClosed: () => closed };
    }

    it('closes the provider transport after a completed Current', async () => {
        const { sink, isClosed } = await openWithTransport();
        sink.delta('@passage visual=still\nA complete answer.\n@end\n');
        sink.done();
        expect(isClosed()).toBe(true);
    });

    it('closes the provider transport after a terminal provider failure', async () => {
        const { sink, isClosed } = await openWithTransport();
        sink.error({ code: 'PROVIDER_FAILED', message: 'Failed.', recoverable: false });
        expect(isClosed()).toBe(true);
    });

    it('closes the transport when the answer ended before connect returned it', async () => {
        let closed = false;
        const adapter = createTextStreamAdapter({
            id: 'early',
            provider: 'test',
            connect: async (_request, sink) => {
                sink.delta('@say The horizon is not a surface.\n@then end\n');
                return { cancel() {}, close() { closed = true; } };
            }
        });
        await adapter.open(ASK);
        expect(closed).toBe(true);
    });
});

describe('an answer to an interjection (stage 4.5)', () => {
    async function answered(text, request = { intent: 'interject', prompt: 'What is the horizon?', reading: { passages: ['A black hole is dark.'], at: 0 } }) {
        let sink;
        const adapter = createTextStreamAdapter({
            id: 'interjected',
            provider: 'test',
            connect: async (_request, providerSink) => { sink = providerSink; return { cancel() {}, close() {} }; }
        });
        const connection = await adapter.open(request);
        sink.delta(text);
        sink.done();
        const events = [];
        for await (const event of connection.events) events.push(event);
        return events;
    }

    it('completes with the ending the model named', async () => {
        const events = await answered('@say The horizon is not a surface.\n@then replace\n');
        expect(events.at(-1)).toMatchObject({ type: 'current.complete', ending: 'replace' });
    });

    it('says nothing a model writes after its ending, and completes with it', async () => {
        const events = await answered('@say The horizon is not a surface.\n@then end\n@say Thanks for asking!\n');
        expect(events.filter(event => event.type === 'segment.text').map(event => event.text)).toEqual(['The horizon is not a surface.']);
        expect(events.at(-1)).toMatchObject({ type: 'current.complete', ending: 'end' });
    });

    it('completes with no ending when the model named none: the runtime reads that as resume', async () => {
        const events = await answered('@say The horizon is not a surface.\n');
        expect(events.at(-1).type).toBe('current.complete');
        expect(events.at(-1)).not.toHaveProperty('ending');
    });
});

describe('a picture asked of the illustrator (stage 5.5)', () => {
    const FIGURE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>';
    const REQUEST = { intent: 'illustrate', prompt: 'a circle', illustration: { medium: 'figure', attempt: 1, said: [] } };

    async function drawn(text) {
        let sink;
        const adapter = createTextStreamAdapter({
            id: 'illustrator', provider: 'test',
            connect: async (_request, providerSink) => { sink = providerSink; return { cancel() {}, close() {} }; }
        });
        const connection = await adapter.open(REQUEST);
        sink.delta(text);
        sink.done();
        const events = [];
        for await (const event of connection.events) events.push(event);
        return { events, adapter };
    }

    it('completes with the scene it drew and no beat at all, on a Current of its own', async () => {
        const { events } = await drawn(`@scene picture svg\n\`\`\`svg\n${FIGURE}\n\`\`\`\n`);
        expect(events.map(event => event.type)).toEqual(['current.open', 'scene.declare', 'scene.text', 'current.complete']);
        expect(events[0].currentId).toMatch(/^illustration-illustrator-/u);
        expect(events[1]).toMatchObject({ sceneId: 'picture', form: 'svg' });
    });

    it('completes with a cue it gave instead, and fails as an empty answer when it drew nothing', async () => {
        expect((await drawn('@cue field bright\n')).events.map(event => event.type)).toEqual(['current.open', 'room.change', 'current.complete']);
        const { events } = await drawn('');
        expect(events.at(-1)).toMatchObject({ type: 'error', code: 'EMPTY_ANSWER', recoverable: false });
    });

    it('gives each of the admission’s diagnostics for a picture, by the functions the reducer and the Worker run', async () => {
        const { adapter } = await drawn('');
        expect(adapter.diagnoseScene({ id: 'picture', svg: FIGURE })).toEqual([]);
        const refused = adapter.diagnoseScene({ id: 'picture', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>' });
        expect(refused[0]).toMatchObject({ line: 1, rule: expect.any(String), message: expect.stringContaining('script') });
        expect(adapter.admitScene({ id: 'picture', svg: FIGURE })).toBeNull();
        const code = adapter.diagnoseScene({ id: 'picture', code: 'export default function scene(rise) { fetch("x"); return { frame() {} }; }' });
        expect(code.map(item => item.rule)).toContain('banned-name');
    });
});
