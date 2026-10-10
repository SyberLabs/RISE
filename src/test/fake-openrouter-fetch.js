/**
 * OpenRouter's streaming chat completions, as far as the OpenRouter adapter uses
 * them, on a clock the test owns.
 *
 * The bytes are in the documented form (https://openrouter.ai/docs/api_reference/streaming,
 * read 2026-10-09): `data:` lines of `chat.completion.chunk` JSON with the words in
 * `choices[0].delta.content`, a `: OPENROUTER PROCESSING` comment, a finish
 * reason on the last word-bearing chunk, then a usage chunk that repeats it,
 * then `data: [DONE]`. A mid-stream error is a chunk with a top-level `error`
 * and `finish_reason: "error"`; a refusal before the stream is plain JSON
 * `{ error: { code, message } }` with that HTTP status
 * (https://openrouter.ai/docs/api_reference/errors-and-debugging). Every event
 * is sent as bytes cut at an uneven place, so a line arrives in pieces.
 *
 * It stands where `getOpenRouterChat().request` stands: given the request's
 * `init`, it answers with a `Response`. Every request is kept in `requests`.
 */
import { scriptFor } from '../live/fixtures/black-holes.js';
import { requestFrom } from './fake-openai-transport.js';
import { scriptToLines } from './fake-text-transport.js';

const SIZES = [7, 19, 3, 31, 11, 23];
const encoder = new TextEncoder();

const abortError = () => Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });

export const chunk = (delta, extra = {}) => JSON.stringify({
    id: 'gen-fake-1',
    provider: 'Anthropic',
    model: 'anthropic/claude-haiku-5.5',
    object: 'chat.completion.chunk',
    created: 1791600000,
    choices: [{ index: 0, delta: { role: 'assistant', content: delta }, finish_reason: null, native_finish_reason: null, logprobs: null }],
    ...extra
});

export const finishing = (reason, extra = {}) => chunk('', {
    choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: reason, native_finish_reason: reason, logprobs: null }],
    ...extra
});

export const USAGE = Object.freeze({ prompt_tokens: 512, completion_tokens: 240, total_tokens: 752, cost: 0.0001712 });

/**
 * @param {object} options
 * @param {{sleep: Function}} options.clock
 * @param {number} [options.everyMs]
 * @param {number} [options.failAfter] a mid-stream error chunk after this many word chunks
 * @param {number} [options.lossAfter] the stream just stops after this many word chunks
 * @param {number} [options.cutAfter] the answer stops at its length limit after this many word chunks
 * @param {number} [options.status] the request is refused with this HTTP status before any stream
 * @param {string} [options.errorBody] what a refusal says, as its body
 * @param {Error} [options.networkError] the request never reaches OpenRouter
 * @param {boolean} [options.done] whether `data: [DONE]` ends the stream (it does unless a test says not)
 * @param {(text: string) => string} [options.textFor] the line-format answer for the reader's message
 */
export function createFakeOpenRouterFetch({ clock, everyMs = 30, failAfter, lossAfter, cutAfter, status, errorBody, networkError, done = true, textFor }) {
    const requests = [];
    const streams = [];

    async function request(init = {}) {
        requests.push(init);
        if (init.signal?.aborted) throw abortError();
        if (networkError) throw networkError;
        if (status) {
            const body = errorBody ?? JSON.stringify({ error: { code: status, message: `Refused with ${status}` } });
            return new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
        }
        const asked = JSON.parse(init.body).messages.find(message => message.role === 'user').content;
        const text = textFor ? textFor(asked) : scriptToLines(scriptFor(requestFrom(asked)));
        const stop = new AbortController();
        const state = { cancelled: false };
        streams.push(state);
        init.signal?.addEventListener('abort', () => stop.abort(), { once: true });

        const body = new ReadableStream({
            async start(controller) {
                let count = 0;
                const send = (event, cut = count) => {
                    const bytes = encoder.encode(event);
                    const at = Math.min(bytes.length - 1, 1 + ((cut * 13) % Math.max(1, bytes.length - 1)));
                    controller.enqueue(bytes.slice(0, at));
                    controller.enqueue(bytes.slice(at));
                };
                const data = json => send(`data: ${json}\n\n`);
                try {
                    send(': OPENROUTER PROCESSING\n\n');
                    let at = 0;
                    while (at < text.length) {
                        await clock.sleep(everyMs, { signal: stop.signal });
                        const size = SIZES[count % SIZES.length];
                        data(chunk(text.slice(at, at + size)));
                        at += size;
                        count += 1;
                        if (failAfter === count) {
                            data(chunk('', { error: { code: 'server_error', message: 'Provider disconnected unexpectedly' }, choices: [{ index: 0, delta: { content: '' }, finish_reason: 'error' }] }));
                            controller.close();
                            return;
                        }
                        if (cutAfter === count) {
                            data(finishing('length'));
                            data(finishing('length', { usage: USAGE }));
                            data('[DONE]');
                            controller.close();
                            return;
                        }
                        if (lossAfter === count) { controller.close(); return; }
                    }
                    await clock.sleep(everyMs, { signal: stop.signal });
                    data(finishing('stop'));
                    data(finishing('stop', { usage: USAGE }));
                    if (done) data('[DONE]');
                    controller.close();
                } catch (error) {
                    if (error?.name !== 'AbortError') throw error;
                    try { controller.error(abortError()); } catch { /* already cancelled by the reader */ }
                }
            },
            cancel() {
                state.cancelled = true;
                stop.abort();
            }
        });
        return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    }

    return { request, requests, streams };
}
