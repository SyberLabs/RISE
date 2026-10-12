import { createVirtualClock } from '../clock.js';
import { describeAdapterConformance } from '../../test/live-conformance.js';
import { BLACK_HOLES_BEATS_TEXT } from '../fixtures/black-holes-beats.js';
import { createFakeOpenAIChatFetch } from '../../test/fake-direct-fetch.js';
import { createOpenAIChatAdapter } from './openai-chat.js';

const ASK = { intent: 'answer', prompt: 'Explain black holes with RISE.' };

/**
 * The same suite every adapter passes, run against the direct OpenAI chat adapter with a fake fetch that replays the
 * documented chat completions stream (data: chunks, the usage chunk, [DONE]), cut into uneven pieces.
 */
const FAULTS = {
    'black-holes': {},
    interrupt: {},
    'transport-loss': { lossAfter: 30 },
    // An error object sent as a chunk.
    'provider-failure': { failAfter: 10 },
    // finish_reason "length", part way through a passage.
    'cut-short': { cutAfter: 30 },
    beats: { textFor: () => BLACK_HOLES_BEATS_TEXT }
};

describeAdapterConformance('openai-chat (fake fetch, documented wire)', (name) => {
    const clock = createVirtualClock();
    const fake = createFakeOpenAIChatFetch({ clock, ...FAULTS[name] });
    return { clock, request: ASK, interruptAfterMs: 300, adapter: createOpenAIChatAdapter({ getKey: () => 'sk-proj-fake', fetch: fake.fetch }) };
}, { carries: { evidence: false, dives: false, ids: false }, resume: 'replay', beats: true });
