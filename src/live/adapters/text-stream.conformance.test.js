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
