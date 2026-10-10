import { createVirtualClock } from '../clock.js';
import { describeAdapterConformance } from '../../test/live-conformance.js';
import { createFakeOpenRouterFetch } from '../../test/fake-openrouter-fetch.js';
import { createOpenRouterAdapter } from './openrouter.js';

const ASK = { intent: 'answer', prompt: 'Explain black holes with RISE.' };

/**
 * The same suite the mock, the generic text-stream adapter, Gemini and OpenAI
 * pass, run against the OpenRouter adapter with a fake fetch that replays the
 * documented server-sent events, cut into uneven pieces.
 */
const FAULTS = {
    'black-holes': {},
    interrupt: {},
    'transport-loss': { lossAfter: 30 },
    // A mid-stream error chunk: `error` at the top level and finish_reason "error".
    'provider-failure': { failAfter: 10 },
    // finish_reason "length", part way through a passage.
    'cut-short': { cutAfter: 30 }
};

describeAdapterConformance('openrouter (fake fetch, documented wire)', (name) => {
    const clock = createVirtualClock();
    const fake = createFakeOpenRouterFetch({ clock, ...FAULTS[name] });
    return {
        clock,
        request: ASK,
        interruptAfterMs: 300,
        adapter: createOpenRouterAdapter({ getChat: () => ({ request: fake.request, scrub: text => text }), referer: 'https://rise.example' })
    };
}, { carries: { evidence: false, dives: false, ids: false }, resume: 'replay' });
