import { createVirtualClock } from '../clock.js';
import { describeAdapterConformance } from '../../test/live-conformance.js';
import { BLACK_HOLES_BEATS_TEXT } from '../fixtures/black-holes-beats.js';
import { createFakeAnthropicFetch } from '../../test/fake-direct-fetch.js';
import { createAnthropicAdapter } from './anthropic.js';

const ASK = { intent: 'answer', prompt: 'Explain black holes with RISE.' };

/**
 * The same suite every adapter passes, run against the direct Anthropic adapter with a fake fetch that replays the
 * documented Messages stream (named events, a thinking block first, then text deltas), cut into uneven pieces.
 */
const FAULTS = {
    'black-holes': {},
    interrupt: {},
    'transport-loss': { lossAfter: 30 },
    // A mid-stream `error` event (overloaded_error).
    'provider-failure': { failAfter: 10 },
    // stop_reason "max_tokens", part way through a passage.
    'cut-short': { cutAfter: 30 },
    beats: { textFor: () => BLACK_HOLES_BEATS_TEXT }
};

describeAdapterConformance('anthropic (fake fetch, documented wire)', (name) => {
    const clock = createVirtualClock();
    const fake = createFakeAnthropicFetch({ clock, ...FAULTS[name] });
    return { clock, request: ASK, interruptAfterMs: 300, adapter: createAnthropicAdapter({ getKey: () => 'sk-ant-api03-fake', fetch: fake.fetch }) };
}, { carries: { evidence: false, dives: false, ids: false }, resume: 'replay', beats: true });
