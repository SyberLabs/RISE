/**
 * A text-streaming provider that runs on a clock the test owns.
 *
 * It says the fixed answers as passages in the line format, in deltas of
 * uneven size, at a fixed rate, so a text-stream adapter can be driven with no
 * network. It can fail outright or drop its connection part way, which is how
 * the adapter's failure paths are staged.
 */
import { scriptFor } from '../live/fixtures/black-holes.js';

/** A script, written as the passages a model would be asked for. */
export function scriptToLines(script) {
    return script.segments.map(segment => {
        const dims = Object.entries(segment.state ?? {}).map(([name, level]) => `${name}=${level}`).join(' ');
        return `@passage visual=${segment.visual ?? 'still'}${dims ? ` ${dims}` : ''}\n${segment.text}\n@end\n`;
    }).join('');
}

const SIZES = [7, 19, 3, 31, 11, 23];

/**
 * @param {object} options
 * @param {{now: Function, sleep: Function}} options.clock
 * @param {number} [options.everyMs]
 * @param {number} [options.failAfter] non-recoverable error after this many deltas
 * @param {number} [options.lossAfter] recoverable error (connection dropped) after this many deltas
 * @param {(request: object) => string} [options.textFor]
 */
export function createFakeTextTransport({ clock, everyMs = 30, failAfter, lossAfter, textFor = request => scriptToLines(scriptFor(request)) }) {
    return async function connect(request, sink) {
        const text = textFor(request);
        const controller = new AbortController();
        const run = (async () => {
            let at = 0;
            let sent = 0;
            try {
                while (at < text.length) {
                    await clock.sleep(everyMs, { signal: controller.signal });
                    const size = SIZES[sent % SIZES.length];
                    sink.delta(text.slice(at, at + size));
                    at += size;
                    sent += 1;
                    if (failAfter === sent) { sink.error({ code: 'PROVIDER_FAILED', message: 'The provider failed.', recoverable: false }); return; }
                    if (lossAfter === sent) { sink.error({ code: 'TRANSPORT_LOST', message: 'The connection dropped.', recoverable: true }); return; }
                }
                await clock.sleep(everyMs, { signal: controller.signal });
                sink.done();
            } catch (error) {
                if (error?.name !== 'AbortError') throw error;
            }
        })();
        return {
            cancel() { controller.abort(); },
            close() { controller.abort(); },
            done: run
        };
    };
}
