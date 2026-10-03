import { createVirtualClock } from '../clock.js';
import { describeAdapterConformance } from '../../test/live-conformance.js';
import { createFakeMcpPort } from '../../test/fake-mcp-port.js';
import { BLACK_HOLES_CURRENT } from '../../test/sealed-current.js';
import { createMcpAppAdapter } from './mcp-app.js';

const ASK = { intent: 'answer', prompt: 'Explain black holes with RISE.' };

/**
 * The same suite as every other adapter, with two scenarios that cannot happen
 * to this one, each held by its own test in mcp-app.test.js: an answer arrives
 * whole, so it cannot be interrupted part way; there is no transport to lose; and it is never
 * cut off part way through a passage, for the same reason.
 */
describeAdapterConformance('mcp-app (fake host model)', (name) => {
    const clock = createVirtualClock();
    const port = createFakeMcpPort({ clock });
    // The host's model has already handed over its Current. A Current that is not valid stands in
    // for a provider that fails outright.
    port.deliver({ current: name === 'provider-failure' ? { ...BLACK_HOLES_CURRENT, schema: 'nope' } : BLACK_HOLES_CURRENT });
    return { clock, request: ASK, interruptAfterMs: 300, adapter: createMcpAppAdapter({ port, clock }) };
}, { carries: { evidence: false, state: false }, resume: 'replay', skip: ['interrupt', 'transport-loss', 'cut-short'] });
