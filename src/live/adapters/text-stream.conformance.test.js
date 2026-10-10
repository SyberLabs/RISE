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

    it('completes with no ending when the model named none: the runtime reads that as resume', async () => {
        const events = await answered('@say The horizon is not a surface.\n');
        expect(events.at(-1).type).toBe('current.complete');
        expect(events.at(-1)).not.toHaveProperty('ending');
    });
});
