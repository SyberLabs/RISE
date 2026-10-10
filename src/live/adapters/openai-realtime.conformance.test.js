import { createVirtualClock } from '../clock.js';
import { describeAdapterConformance } from '../../test/live-conformance.js';
import { BLACK_HOLES_BEATS_TEXT } from '../fixtures/black-holes-beats.js';
import { createFakeOpenAITransport } from '../../test/fake-openai-transport.js';
import { createOpenAIRealtimeAdapter } from './openai-realtime.js';

const ASK = { intent: 'answer', prompt: 'Explain black holes with RISE.' };

/**
 * The same suite the mock and the generic text-stream adapter pass, run against
 * the OpenAI adapter with a fake data channel that speaks the documented wire.
 * Passing it is what "provider events stay inside the adapter" means.
 */
const FAULTS = {
    'black-holes': {},
    interrupt: {},
    'transport-loss': { lossAfter: 30 },
    'provider-failure': { failAfter: 10 },
    // The response ends `incomplete` at its token limit, part way through a passage.
    'cut-short': { cutAfter: 30 },
    // The answer written in beats, through the same wire.
    beats: { textFor: () => BLACK_HOLES_BEATS_TEXT }
};

describeAdapterConformance('openai-realtime (fake data channel, documented wire)', (name) => {
    const clock = createVirtualClock();
    return {
        clock,
        request: ASK,
        interruptAfterMs: 300,
        adapter: createOpenAIRealtimeAdapter({ transport: createFakeOpenAITransport({ clock, ...FAULTS[name] }) })
    };
}, { carries: { evidence: false, dives: false, ids: false }, resume: 'replay', beats: true });
