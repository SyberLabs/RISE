/**
 * OpenAI Realtime's data channel, as far as this adapter uses it, on a clock the
 * test owns.
 *
 * The server events are in the documented form (see openai-wire.js for what is
 * and is not verified): session and response bookkeeping the adapter must
 * ignore, text deltas for the response, then `response.done`. Faults are staged
 * here: a response that fails, an `error` event, a dropped connection.
 */
import { scriptFor } from '../live/fixtures/black-holes.js';
import { scriptToLines } from './fake-text-transport.js';

const SIZES = [7, 19, 3, 31, 11, 23];

/** What the reader asked, read back from the message the adapter sent. */
export function requestFrom(text) {
    if (text.startsWith('The reader stopped an answer')) {
        const question = /^Their question: (.*)$/mu.exec(text)?.[1] ?? '';
        return { intent: 'dive', prompt: question, parent: { currentId: 'x', segmentId: 's', atCharacter: 0, context: [] } };
    }
    return { intent: 'answer', prompt: text };
}

/**
 * @param {object} options
 * @param {{now: Function, sleep: Function}} options.clock
 * @param {number} [options.everyMs]
 * @param {number} [options.failAfter] the response ends `failed` after this many deltas
 * @param {number} [options.errorAfter] an `error` event after this many deltas
 * @param {number} [options.lossAfter] the connection drops after this many deltas
 * @param {number} [options.cutAfter] the response ends `incomplete`, at its token limit, after this many deltas
 * @param {(text: string) => string} [options.textFor] the line-format answer for the reader's message
 */
export function createFakeOpenAITransport({ clock, everyMs = 30, failAfter, errorAfter, lossAfter, cutAfter, textFor }) {
    return {
        async open() {
            const listeners = { message: [], close: [] };
            const controller = new AbortController();
            const sent = [];
            const emit = event => { for (const fn of listeners.message) fn(JSON.stringify(event)); };
            let asked = null;
            let started = false;

            async function answer() {
                emit({ type: 'response.created', response: { id: 'resp_1', status: 'in_progress' } });
                emit({ type: 'response.output_item.added', output_index: 0, item: { id: 'item_1', type: 'message', role: 'assistant' } });
                emit({ type: 'response.content_part.added', item_id: 'item_1', output_index: 0, content_index: 0, part: { type: 'text', text: '' } });
                const text = textFor ? textFor(asked) : scriptToLines(scriptFor(requestFrom(asked)));
                let at = 0;
                let count = 0;
                try {
                    while (at < text.length) {
                        await clock.sleep(everyMs, { signal: controller.signal });
                        emit({ type: 'response.output_text.delta', response_id: 'resp_1', item_id: 'item_1', output_index: 0, content_index: 0, delta: text.slice(at, at + SIZES[count % SIZES.length]) });
                        at += SIZES[count % SIZES.length];
                        count += 1;
                        if (failAfter === count) {
                            emit({ type: 'response.done', response: { id: 'resp_1', status: 'failed', status_details: { type: 'failed', error: { type: 'server_error', code: 'server_error', message: 'The model failed to respond.' } } } });
                            return;
                        }
                        if (cutAfter === count) {
                            emit({ type: 'response.done', response: { id: 'resp_1', status: 'incomplete', status_details: { type: 'incomplete', reason: 'max_output_tokens' } } });
                            return;
                        }
                        if (errorAfter === count) {
                            emit({ type: 'error', error: { type: 'server_error', code: 'internal_error', message: 'Something went wrong.' } });
                            return;
                        }
                        if (lossAfter === count) {
                            for (const fn of listeners.close) fn();
                            return;
                        }
                    }
                    await clock.sleep(everyMs, { signal: controller.signal });
                    emit({ type: 'response.output_text.done', response_id: 'resp_1', item_id: 'item_1', output_index: 0, content_index: 0, text });
                    emit({ type: 'response.done', response: { id: 'resp_1', status: 'completed', usage: { total_tokens: 100 } } });
                } catch (error) {
                    if (error?.name !== 'AbortError') throw error;
                }
            }

            queueMicrotask(() => emit({ type: 'session.created', session: { id: 'sess_1', type: 'realtime' } }));

            return {
                sent,
                send(raw) {
                    const event = JSON.parse(raw);
                    sent.push(event);
                    if (event.type === 'conversation.item.create') asked = event.item.content[0].text;
                    if (event.type === 'response.create' && !started) { started = true; void answer(); }
                    if (event.type === 'response.cancel') {
                        controller.abort();
                        emit({ type: 'response.done', response: { id: 'resp_1', status: 'cancelled' } });
                    }
                },
                onMessage(fn) { listeners.message.push(fn); },
                onClose(fn) { listeners.close.push(fn); },
                close() {
                    controller.abort();
                    for (const fn of listeners.close) fn();
                }
            };
        }
    };
}
