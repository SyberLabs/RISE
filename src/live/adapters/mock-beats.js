/**
 * The venue's demo: the black holes answer written in beats
 * (fixtures/black-holes-beats.js), in uneven deltas at about the pace a model
 * writes, through the same text-stream adapter and parser as every real
 * provider. So holds and scenes arrive while the answer is still being
 * written, as they would from one.
 *
 * It is a module of its own, loaded by the venue's registry only when the demo
 * is chosen: the text-stream adapter brings the scene admission (and its
 * parser) with it, which the card and the event-scripted mock (mock.js) do not
 * need.
 */

import { createRealClock } from '../clock.js';
import { beatsTextFor } from '../fixtures/black-holes-beats.js';
import { createTextStreamAdapter } from './text-stream.js';

/** Uneven pieces, as a provider's deltas come. */
const DELTA_SIZES = Object.freeze([7, 19, 3, 31, 11, 23]);

/** `everyMs` between deltas: at the default, some 150 characters a second, about the pace a model writes. */
export function createMockBeatsAdapter({ clock = createRealClock(), everyMs = 100 } = {}) {
    return createTextStreamAdapter({
        id: 'mock',
        provider: 'RISE demo',
        connect: async (request, sink) => {
            const text = beatsTextFor(request);
            const controller = new AbortController();
            void (async () => {
                try {
                    for (let at = 0, n = 0; at < text.length; n += 1) {
                        await clock.sleep(everyMs, { signal: controller.signal });
                        const size = DELTA_SIZES[n % DELTA_SIZES.length];
                        sink.delta(text.slice(at, at + size));
                        at += size;
                    }
                    sink.done();
                } catch (error) {
                    if (error?.name !== 'AbortError') sink.error({ code: 'PROVIDER_FAILED', message: String(error?.message ?? error), recoverable: false });
                }
            })();
            return { cancel: () => controller.abort(), close: () => controller.abort() };
        }
    });
}
