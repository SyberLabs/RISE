/**
 * Anthropic's Messages API and OpenAI's chat completions, streamed, as far as the
 * direct-key adapters use them, on a clock the test owns. Each stands where the
 * browser's `fetch(url, init)` stands and keeps every call in `calls`.
 *
 * Anthropic, as its streaming page documents it
 * (https://platform.claude.com/docs/en/build-with-claude/streaming, read 2026-10-12):
 * named events `message_start` (usage), `content_block_start`, `ping`,
 * `content_block_delta` (`text_delta`, and for a thinking block `signature_delta`),
 * `content_block_stop`, `message_delta` (`stop_reason`, cumulative usage),
 * `message_stop`; a mid-stream `error` event; a refusal before the stream is
 * `{ type: 'error', error: { type, message }, request_id }` with its HTTP status
 * (https://platform.claude.com/docs/en/api/errors).
 *
 * OpenAI, as its reference documents it
 * (https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events,
 * read 2026-10-12): `data:` lines of `chat.completion.chunk` with the words in
 * `choices[0].delta.content`, `usage: null` until the extra chunk that
 * `stream_options.include_usage` asks for (empty `choices`, the whole request's
 * usage), then `data: [DONE]`; a refusal is `{ error: { message, type, code, param } }`.
 * OpenAI documents no mid-stream error event for chat completions: the fake's is
 * its error object sent as a chunk, which the adapter must not take for words.
 *
 * Every event is sent as bytes cut at an uneven place, so a line arrives in pieces.
 */
import { scriptFor } from '../live/fixtures/black-holes.js';
import { requestFrom } from './fake-openai-transport.js';
import { scriptToLines } from './fake-text-transport.js';

const SIZES = [7, 19, 3, 31, 11, 23];
const encoder = new TextEncoder();
const abortError = () => Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });

export const ANTHROPIC_USAGE = Object.freeze({ input_tokens: 512, output_tokens: 240 });
export const OPENAI_USAGE = Object.freeze({ prompt_tokens: 512, completion_tokens: 240, total_tokens: 752 });

const ANTHROPIC_ERROR_TYPE = { 400: 'invalid_request_error', 401: 'authentication_error', 402: 'billing_error', 403: 'permission_error', 404: 'not_found_error', 429: 'rate_limit_error', 500: 'api_error', 529: 'overloaded_error' };

/** One Anthropic server-sent event, as the API writes it: its name, then its data. */
export const anthropicEvent = (type, body = {}) => `event: ${type}\ndata: ${JSON.stringify({ type, ...body })}\n\n`;
export const anthropicText = text => anthropicEvent('content_block_delta', { index: 1, delta: { type: 'text_delta', text } });
export const anthropicOpen = (model = 'claude-haiku-5-5') => [
    anthropicEvent('message_start', { message: { id: 'msg_fake', type: 'message', role: 'assistant', content: [], model, stop_reason: null, stop_sequence: null, usage: { input_tokens: ANTHROPIC_USAGE.input_tokens, output_tokens: 1 } } }),
    // Adaptive thinking is on by default; its text is omitted unless asked for, and only its signature arrives.
    anthropicEvent('content_block_start', { index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } }),
    anthropicEvent('content_block_delta', { index: 0, delta: { type: 'signature_delta', signature: 'EqQBCgIYAhIM' } }),
    anthropicEvent('content_block_stop', { index: 0 }),
    anthropicEvent('content_block_start', { index: 1, content_block: { type: 'text', text: '' } }),
    anthropicEvent('ping')
];
export const anthropicClose = (reason, usage = { output_tokens: ANTHROPIC_USAGE.output_tokens }) => [
    anthropicEvent('content_block_stop', { index: 1 }),
    anthropicEvent('message_delta', { delta: { stop_reason: reason, stop_sequence: null }, usage }),
    anthropicEvent('message_stop')
];

export const openaiChunk = (delta, extra = {}) => `data: ${JSON.stringify({
    id: 'chatcmpl-fake', object: 'chat.completion.chunk', created: 1791800000, model: 'gpt-6-luna',
    choices: [{ index: 0, delta, logprobs: null, finish_reason: null }], usage: null, ...extra
})}\n\n`;
export const openaiText = content => openaiChunk({ content });
export const openaiOpen = () => [openaiChunk({ role: 'assistant', content: '', refusal: null })];
export const openaiClose = (reason, { usage = OPENAI_USAGE, done = true } = {}) => [
    openaiChunk({}, { choices: [{ index: 0, delta: {}, logprobs: null, finish_reason: reason }] }),
    ...(usage ? [openaiChunk({}, { choices: [], usage })] : []),
    ...(done ? ['data: [DONE]\n\n'] : [])
];

/**
 * @param {object} wire how this provider writes: open(), text(t), close(reason, options), failure, refusal(status, body)
 * @param {object} options
 * @param {{sleep: Function}} options.clock
 * @param {number} [options.everyMs]
 * @param {number} [options.failAfter] a mid-stream error after this many word events
 * @param {number} [options.lossAfter] the stream just stops after this many word events
 * @param {number} [options.cutAfter] the answer stops at its length limit after this many word events
 * @param {number} [options.status] the request is refused with this HTTP status before any stream
 * @param {string} [options.errorBody] what a refusal says, as its body
 * @param {Error} [options.networkError] the request never reaches the provider
 * @param {boolean} [options.done] whether the stream ends with its terminal marker
 * @param {(text: string) => string} [options.textFor] the line-format answer for the reader's message
 */
function createFakeFetch(wire, { clock, everyMs = 30, failAfter, lossAfter, cutAfter, status, errorBody, networkError, done = true, textFor }) {
    const calls = [];
    const streams = [];

    async function fetch(url, init = {}) {
        calls.push({ url, init });
        if (init.signal?.aborted) throw abortError();
        if (networkError) throw networkError;
        if (status) return new Response(errorBody ?? wire.refusal(status), { status, headers: { 'Content-Type': 'application/json' } });
        const asked = JSON.parse(init.body).messages.find(message => message.role === 'user').content;
        const text = textFor ? textFor(asked) : scriptToLines(scriptFor(requestFrom(asked)));
        const stop = new AbortController();
        const state = { cancelled: false };
        streams.push(state);
        init.signal?.addEventListener('abort', () => stop.abort(), { once: true });

        const body = new ReadableStream({
            async start(controller) {
                let count = 0;
                const send = event => {
                    const bytes = encoder.encode(event);
                    const at = Math.min(bytes.length - 1, 1 + ((count * 13) % Math.max(1, bytes.length - 1)));
                    controller.enqueue(bytes.slice(0, at));
                    controller.enqueue(bytes.slice(at));
                };
                try {
                    for (const event of wire.open()) send(event);
                    let at = 0;
                    while (at < text.length) {
                        await clock.sleep(everyMs, { signal: stop.signal });
                        const size = SIZES[count % SIZES.length];
                        send(wire.text(text.slice(at, at + size)));
                        at += size;
                        count += 1;
                        if (failAfter === count) { send(wire.failure); controller.close(); return; }
                        if (cutAfter === count) { for (const event of wire.close('length', { done })) send(event); controller.close(); return; }
                        if (lossAfter === count) { controller.close(); return; }
                    }
                    await clock.sleep(everyMs, { signal: stop.signal });
                    for (const event of wire.close('stop', { done })) send(event);
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

    return { fetch, calls, streams };
}

export function createFakeAnthropicFetch(options) {
    return createFakeFetch({
        open: () => anthropicOpen(),
        text: anthropicText,
        // `done: false` leaves out message_stop, as a stream that stops after its last message_delta.
        close: (reason, { done }) => anthropicClose(reason === 'length' ? 'max_tokens' : 'end_turn').slice(0, done ? 3 : 2),
        failure: anthropicEvent('error', { error: { type: 'overloaded_error', message: 'Overloaded' } }),
        refusal: status => JSON.stringify({ type: 'error', error: { type: ANTHROPIC_ERROR_TYPE[status] ?? 'api_error', message: `Refused with ${status}` }, request_id: 'req_fake' })
    }, options);
}

export function createFakeOpenAIChatFetch(options) {
    return createFakeFetch({
        open: openaiOpen,
        text: openaiText,
        close: (reason, { done }) => openaiClose(reason, { done }),
        failure: `data: ${JSON.stringify({ error: { message: 'The server had an error while processing your request.', type: 'server_error', code: null, param: null } })}\n\n`,
        refusal: status => JSON.stringify({ error: { message: `Refused with ${status}`, type: status === 429 ? 'rate_limit_error' : 'invalid_request_error', code: null, param: null }, status })
    }, options);
}
