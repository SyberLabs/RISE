/**
 * Google's streaming answer, as far as the Gemini adapter uses it, on a clock the
 * test owns.
 *
 * The frames are in the documented form (see gemini-wire.js for what is and is
 * not verified): a GenerateContentResponse per event with the words in
 * `candidates[0].content.parts`, then a frame with a finish reason. Faults are
 * staged here: an answer that ends in a refusal, an error frame, a stream that
 * just stops, and a connection that is refused.
 *
 * Every request the adapter makes is recorded in `requests`, and every
 * connection in `connections`, so a test can say that nothing was sent.
 */
import { scriptFor } from '../live/fixtures/black-holes.js';
import { requestFrom } from './fake-openai-transport.js';
import { scriptToLines } from './fake-text-transport.js';

const SIZES = [7, 19, 3, 31, 11, 23];

const frame = (text, extra = {}) => JSON.stringify({
    candidates: [{ content: { role: 'model', parts: [{ text }] }, index: 0, ...extra }],
    usageMetadata: { promptTokenCount: 12 },
    modelVersion: 'fake',
    responseId: 'r1'
});

/**
 * @param {object} options
 * @param {{now: Function, sleep: Function}} options.clock
 * @param {number} [options.everyMs]
 * @param {number} [options.failAfter] the answer ends in a refusal after this many frames
 * @param {number} [options.errorAfter] an error frame after this many frames
 * @param {number} [options.lossAfter] the stream stops with no finish reason after this many frames
 * @param {Error} [options.openError] opening is refused with this
 * @param {() => void} [options.beforeOpen] runs while the connection is being made
 * @param {(text: string) => string} [options.textFor] the line-format answer for the reader's message
 */
export function createFakeGeminiTransport({ clock, everyMs = 30, failAfter, errorAfter, lossAfter, openError, beforeOpen, textFor }) {
    const requests = [];
    const connections = [];
    return {
        requests,
        connections,
        async open({ body, signal } = {}) {
            requests.push({ body, signal });
            beforeOpen?.();
            if (openError) throw openError;
            const listeners = { message: [], close: [] };
            const controller = new AbortController();
            const connection = { started: false, closed: false };
            connections.push(connection);
            const emit = raw => { if (!connection.closed) for (const fn of listeners.message) fn(raw); };
            const end = () => { if (connection.closed) return; connection.closed = true; controller.abort(); for (const fn of listeners.close) fn(); };

            async function answer() {
                const asked = body.contents[0].parts[0].text;
                const text = textFor ? textFor(asked) : scriptToLines(scriptFor(requestFrom(asked)));
                let at = 0;
                let count = 0;
                try {
                    while (at < text.length) {
                        await clock.sleep(everyMs, { signal: controller.signal });
                        emit(frame(text.slice(at, at + SIZES[count % SIZES.length])));
                        at += SIZES[count % SIZES.length];
                        count += 1;
                        if (failAfter === count) { emit(frame('', { finishReason: 'SAFETY' })); end(); return; }
                        if (errorAfter === count) { emit(JSON.stringify({ error: { code: 500, message: 'Something went wrong.', status: 'INTERNAL' } })); end(); return; }
                        if (lossAfter === count) { end(); return; }
                    }
                    await clock.sleep(everyMs, { signal: controller.signal });
                    emit(frame('', { finishReason: 'STOP' }));
                    end();
                } catch (error) {
                    if (error?.name !== 'AbortError') throw error;
                }
            }

            return {
                onMessage(fn) { listeners.message.push(fn); },
                onClose(fn) { listeners.close.push(fn); },
                start() {
                    if (connection.started || connection.closed) return;
                    connection.started = true;
                    void answer();
                },
                close() { end(); }
            };
        }
    };
}
