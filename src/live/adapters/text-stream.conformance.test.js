import { describe, expect, it } from 'vitest';
import { createVirtualClock } from '../clock.js';
import { describeAdapterConformance } from '../../test/live-conformance.js';
import { createFakeTextTransport } from '../../test/fake-text-transport.js';
import { createTextStreamAdapter } from './text-stream.js';

const ASK = { intent: 'answer', prompt: 'Explain black holes with RISE.' };

/** Each situation is staged in the fake provider. The adapter is the one that ships. */
const FAULTS = {
    'black-holes': {},
    interrupt: {},
    'transport-loss': { lossAfter: 30 },
    'provider-failure': { failAfter: 10 }
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
}, { carries: { evidence: false, dives: false, ids: false }, resume: 'replay' });

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
