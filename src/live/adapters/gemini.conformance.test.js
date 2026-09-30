import { createVirtualClock } from '../clock.js';
import { describeAdapterConformance } from '../../test/live-conformance.js';
import { createFakeGeminiTransport } from '../../test/fake-gemini-transport.js';
import { createGeminiAdapter } from './gemini.js';

const ASK = { intent: 'answer', prompt: 'Explain black holes with RISE.' };

/**
 * The same suite the mock, the generic text-stream adapter and the OpenAI adapter
 * pass, run against the Gemini adapter with a fake stream that speaks the
 * documented wire. Passing it, unchanged, is what "the runtime is
 * provider-independent" means: a second provider is a second `connect`.
 */
const FAULTS = {
    'black-holes': {},
    interrupt: {},
    'transport-loss': { lossAfter: 30 },
    'provider-failure': { failAfter: 10 }
};

describeAdapterConformance('gemini (fake stream, documented wire)', (name) => {
    const clock = createVirtualClock();
    return {
        clock,
        request: ASK,
        interruptAfterMs: 300,
        adapter: createGeminiAdapter({ transport: createFakeGeminiTransport({ clock, ...FAULTS[name] }) })
    };
}, { carries: { evidence: false, dives: false, ids: false }, resume: 'replay' });
