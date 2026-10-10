/**
 * The OpenRouter adapter: RISE Live's first provider, on the reader's own account.
 *
 * A text-stream adapter (text-stream.js) whose provider is OpenRouter's
 * streaming chat completions, `POST https://openrouter.ai/api/v1/chat/completions`
 * with `stream: true`. Names and shapes are those of OpenRouter's documentation,
 * read on 2026-10-09:
 *   https://openrouter.ai/docs/api_reference/streaming            (data: lines, `: OPENROUTER PROCESSING`
 *                                                                  comments, [DONE], the usage chunk that
 *                                                                  repeats the finish reason, mid-stream errors)
 *   https://openrouter.ai/docs/api_reference/errors-and-debugging (`{ error: { code, message } }`, 401/402/429)
 *   https://openrouter.ai/docs/api_reference/overview             (finish reasons, `usage`)
 *   https://openrouter.ai/docs/app-attribution                    (HTTP-Referer, X-OpenRouter-Title)
 * The browser preflight was checked against the endpoint without a key on
 * 2026-10-09 (it allows Authorization, Content-Type, HTTP-Referer and
 * X-OpenRouter-Title from any origin). A real session has not been run here.
 *
 * THE KEY. It is the reader's, minted by "Connect OpenRouter" and held in
 * memory by src/core/ai-connection.js, which alone puts it in a header. This
 * module never holds it: it asks for the connection at each request, and what
 * OpenRouter says about a failure is cleaned by that connection, and of anything
 * shaped like a key, before it is shown. Nothing here logs.
 *
 * It carries text only: RISE speaks it with its own voice, which keeps the
 * clock RISE's (the Live design, §2). Each question, a Dive included, is a
 * request of its own. What the model writes is read only through the line
 * format (segment-parser.js), and never executed.
 */

import { getOpenRouterChat } from '../../core/ai-connection.js';
import { AdapterError } from '../adapter.js';
import { createSseParser } from './gemini-sse.js';
import { promptFor, REALTIME_INSTRUCTIONS } from './openai-instructions.js';
import { isOpenRouterModel, OPENROUTER_DEFAULT_MODEL } from './openrouter-model.js';
import { createTextStreamAdapter } from './text-stream.js';

export const OPENROUTER_LIMITS = Object.freeze({ error: 4_096, message: 300, said: 200, stream: 4 * 1024 * 1024, maxTokens: 4096 });

const KEY_SHAPE = /sk-or-[A-Za-z0-9_-]{4,}/gu;
const BEARER = /Bearer\s+[^\s"',]+/giu;
const NAME = /^[a-z][a-z0-9_]{0,39}$/u;
const PROVIDER_ERROR = 'OpenRouter reported an error';

const clip = (text, length) => (text.length <= length ? text : `${text.slice(0, length - 1)}…`);
const object = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : null);
const stopped = () => new AdapterError('ABORTED', 'The live answer was stopped before it began.');

/** The one request that asks a question: RISE's instructions, the reader's words, a cap on what can be spent. */
export function buildBody(request, model) {
    return {
        model,
        messages: [
            { role: 'system', content: REALTIME_INSTRUCTIONS },
            { role: 'user', content: promptFor(request) }
        ],
        stream: true,
        max_tokens: OPENROUTER_LIMITS.maxTokens
    };
}

/** Each way OpenRouter refuses before it streams, as one code the page knows and one sentence a reader can act on. */
function refusal(status, said, model) {
    const lead = {
        401: ['KEY_REFUSED', 'OpenRouter did not accept your key. Connect OpenRouter again'],
        402: ['CREDIT_REQUIRED', 'Your OpenRouter account has no credit left for this. Add credit at openrouter.ai, then ask again'],
        403: ['REFUSED', 'OpenRouter refused the request'],
        429: ['RATE_LIMITED', 'OpenRouter is holding back requests from your account just now (a rate limit). Wait a moment, then ask again']
    }[status];
    if (lead) return new AdapterError(lead[0], clip(`${lead[1]}: ${said}`, OPENROUTER_LIMITS.message));
    if (status === 404 || (status === 400 && /model/iu.test(said))) {
        return new AdapterError('MODEL_NOT_FOUND', clip(`OpenRouter has no model called “${model}” for your account: ${said}`, OPENROUTER_LIMITS.message));
    }
    if (status === 408 || status >= 500) return new AdapterError('PROVIDER_UNAVAILABLE', clip(`OpenRouter could not answer just now: ${said}`, OPENROUTER_LIMITS.message));
    return new AdapterError('BAD_REQUEST', clip(`OpenRouter would not take the request: ${said}`, OPENROUTER_LIMITS.message));
}

/** At most `limit` bytes of a body, as text. */
async function readSome(response, limit) {
    const reader = response.body?.getReader();
    if (!reader) return '';
    const decoder = new TextDecoder();
    let text = '';
    let bytes = 0;
    try {
        while (bytes < limit) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            text += decoder.decode(value, { stream: true });
        }
    } catch { /* what was read is what there is */ } finally {
        void reader.cancel().catch(() => {});
    }
    return text;
}

/** Only non-negative numbers, under the names the page reads. */
function usageOf(raw, model) {
    const usage = object(raw);
    if (!usage) return null;
    const out = { model };
    for (const [from, to] of [['prompt_tokens', 'promptTokens'], ['completion_tokens', 'completionTokens'], ['total_tokens', 'totalTokens'], ['cost', 'cost']]) {
        const value = usage[from];
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) out[to] = value;
    }
    return Object.keys(out).length > 1 ? out : null;
}

/**
 * @param {object} [options]
 * @param {() => ({request: (init: object) => Promise<Response>, scrub?: (text: string) => string} | null)} [options.getChat]
 *   the reader's connection, asked for at each request (ai-connection.js)
 * @param {() => string | undefined} [options.getModel] the model the reader named, if they did
 * @param {(usage: {model: string, promptTokens?: number, completionTokens?: number, totalTokens?: number, cost?: number}) => void} [options.onUsage]
 *   what OpenRouter reported an answer cost, for the reader's own accounting
 * @param {string} [options.referer] this site's address, for OpenRouter's app attribution
 * @param {number} [options.capacity]
 * @param {number} [options.maxBytes] the most a stream may send before it is cut off
 */
export function createOpenRouterAdapter({
    getChat = getOpenRouterChat,
    getModel = () => undefined,
    onUsage,
    referer = globalThis.location?.origin,
    capacity,
    maxBytes = OPENROUTER_LIMITS.stream
} = {}) {
    return createTextStreamAdapter({
        id: 'openrouter-stream',
        provider: 'OpenRouter',
        capacity,
        async connect(request, sink, { signal } = {}) {
            if (signal?.aborted) throw stopped();
            const asked = getModel();
            const model = asked === undefined || asked === null || asked === '' ? OPENROUTER_DEFAULT_MODEL : asked;
            if (!isOpenRouterModel(model)) throw new AdapterError('MODEL_INVALID', 'That is not an OpenRouter model name: it looks like maker/model, for example anthropic/claude-haiku-5.5.');
            const chat = getChat();
            if (!chat || typeof chat.request !== 'function') {
                throw new AdapterError('KEY_REQUIRED', 'Connect OpenRouter first, on Home: a live answer is asked with your own OpenRouter account.');
            }

            /** OpenRouter's words about a failure, cleaned; the plain sentence if they cannot be vouched for. */
            const cleaned = text => {
                try {
                    const out = (typeof chat.scrub === 'function' ? chat.scrub(String(text)) : String(text)).replace(KEY_SHAPE, '[key]').replace(BEARER, 'Bearer [key]').trim();
                    return out ? clip(out, OPENROUTER_LIMITS.said) : PROVIDER_ERROR;
                } catch {
                    return PROVIDER_ERROR;
                }
            };

            const controller = new AbortController();
            const onAbort = () => controller.abort();
            signal?.addEventListener('abort', onAbort, { once: true });
            const release = () => signal?.removeEventListener('abort', onAbort);

            // Attribution only: this site's origin and name, never the reader's page or words.
            const headers = { 'Content-Type': 'application/json', 'X-OpenRouter-Title': 'RISE' };
            if (typeof referer === 'string' && /^https?:\/\/[^\s/]+$/u.test(referer)) headers['HTTP-Referer'] = referer;

            let response;
            try {
                response = await chat.request({ method: 'POST', headers, body: JSON.stringify(buildBody(request, model)), signal: controller.signal });
            } catch (error) {
                release();
                if (controller.signal.aborted || error?.name === 'AbortError') throw stopped();
                throw new AdapterError('CONNECT_FAILED', clip(`Could not reach OpenRouter: ${cleaned(error?.message ?? error)}`, OPENROUTER_LIMITS.message));
            }
            if (!response.ok) {
                const text = await readSome(response, OPENROUTER_LIMITS.error);
                release();
                if (controller.signal.aborted) throw stopped();
                let said = `no reason given (HTTP ${response.status})`;
                try {
                    const message = object(object(JSON.parse(text))?.error)?.message;
                    if (typeof message === 'string' && message.trim()) said = cleaned(message);
                } catch { /* not OpenRouter's error shape: the status says enough */ }
                throw refusal(response.status, said, model);
            }
            if (!response.body) {
                release();
                throw new AdapterError('CONNECT_FAILED', 'OpenRouter answered with nothing to read.');
            }
            if (controller.signal.aborted) {
                release();
                void response.body.cancel().catch(() => {});
                throw stopped();
            }

            let over = false;
            let finish = null;
            let usage = null;
            let reader = null;

            const settle = () => {
                if (!usage || typeof onUsage !== 'function') return;
                const said = usage;
                usage = null;
                try { onUsage(said); } catch { /* the page's accounting may not break the answer */ }
            };
            const stop = () => {
                controller.abort();
                if (reader) void reader.cancel().catch(() => {});
                else void response.body.cancel().catch(() => {});
            };
            const fail = (code, message) => {
                if (over) return;
                over = true;
                settle();
                sink.error({ code, message: clip(message, OPENROUTER_LIMITS.message), recoverable: false });
            };
            /** The answer is over by OpenRouter's account: finished, or finished with the reason it stopped. */
            const end = () => {
                if (over) return;
                if (finish && finish !== 'stop') {
                    const name = NAME.test(finish) ? finish.toUpperCase() : 'UNKNOWN';
                    if (finish === 'length') fail(`RESPONSE_${name}`, 'The answer reached its length limit and was cut off.');
                    else fail(`RESPONSE_${name}`, `The provider stopped the answer (${finish === 'content_filter' ? 'content filter' : name.toLowerCase()}).`);
                    return;
                }
                over = true;
                settle();
                sink.done();
            };

            const receive = raw => {
                if (over) return;
                if (raw === '[DONE]') { end(); return; }
                let event;
                try { event = object(JSON.parse(raw)); } catch { return; }
                if (!event) return;
                if (event.error !== undefined && event.error !== null) {
                    const error = object(event.error);
                    const code = typeof error?.code === 'string' && NAME.test(error.code) ? error.code.toUpperCase() : 'PROVIDER_ERROR';
                    const said = typeof error?.message === 'string' && error.message ? cleaned(error.message) : PROVIDER_ERROR;
                    usage = usageOf(event.usage, model) ?? usage;
                    fail(code, said);
                    return;
                }
                usage = usageOf(event.usage, model) ?? usage;
                const choice = Array.isArray(event.choices) ? object(event.choices[0]) : null;
                if (!choice) return;
                // Only the answer's words; never the model's reasoning, and nothing once its finish is known.
                const content = object(choice.delta)?.content;
                if (!finish && typeof content === 'string' && content) sink.delta(content);
                if (typeof choice.finish_reason === 'string' && choice.finish_reason) finish ??= choice.finish_reason;
            };

            const parser = createSseParser({ onData: receive });

            async function pump() {
                reader = response.body.getReader();
                const decoder = new TextDecoder();
                let bytes = 0;
                try {
                    for (;;) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        bytes += value.byteLength;
                        if (bytes > maxBytes) {
                            stop();
                            fail('RESPONSE_TOO_LONG', 'The answer was longer than RISE reads, and was cut off.');
                            return;
                        }
                        parser.feed(decoder.decode(value, { stream: true }));
                        if (over) return;
                    }
                    parser.feed(decoder.decode());
                    parser.end();
                } catch { /* the network dropped, or the reader stopped it */ } finally {
                    release();
                }
                if (over || controller.signal.aborted) return;
                // The stream ended without [DONE]. After a finish reason that is the end; before one, the connection was lost.
                if (finish) { end(); return; }
                over = true;
                settle();
                sink.error({ code: 'TRANSPORT_LOST', message: 'The connection to OpenRouter dropped', recoverable: true });
            }
            void pump();

            return {
                cancel() {
                    if (over) return;
                    over = true;
                    stop();
                },
                close() {
                    over = true;
                    stop();
                }
            };
        }
    });
}
