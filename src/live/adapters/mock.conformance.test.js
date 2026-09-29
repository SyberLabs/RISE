import { createVirtualClock } from '../clock.js';
import { describeAdapterConformance } from '../../test/live-conformance.js';
import { createMockAdapter } from './mock.js';

const ASK = { intent: 'answer', prompt: 'Explain black holes with RISE.' };

/** The mock stages each situation by script. */
const FAULTS = {
    'black-holes': {},
    interrupt: {},
    'transport-loss': { transportLossAfter: 9 },
    'provider-failure': { failAfter: 6 }
};

describeAdapterConformance('mock', (name) => {
    const clock = createVirtualClock();
    return {
        clock,
        request: ASK,
        interruptAfterMs: 300,
        adapter: createMockAdapter({ clock, faults: FAULTS[name] })
    };
});
