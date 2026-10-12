/**
 * A text-stream adapter (text-stream.js) for a provider asked directly from this
 * browser with the reader's typed key: one streaming POST, read as server-sent
 * events (gemini-sse.js). Anthropic (anthropic.js) and OpenAI's chat completions
 * (openai-chat.js) are each this, with their own address, headers, body,
 * refusals and wire.
 *
 * THE KEY. It is the reader's own, given by `getKey` at the moment of the
 * request (the venue holds it in the page's memory only), and the provider's
 * `headers(key)` puts it in one header. It goes from this browser to that
 * provider and nowhere else: never into an address, never logged, and never
 * into an error. Anything a provider says about a failure has the key, and
 * anything shaped like one, replaced before it is shown.
 *
 * It carries text only: RISE speaks it with its own voice, which keeps the
 * clock RISE's (the Live design, §2). What the model writes is read only
 * through the line format (segment-parser.js), and never executed.
 */

import { AdapterError } from '../adapter.js';
import { createSseParser } from './gemini-sse.js';
import { createTextStreamAdapter } from './text-stream.js';

export const KEYED_LIMITS = Object.freeze({ error: 4_096, message: 300, said: 200, stream: 4 * 1024 * 1024, maxTokens: 4096 });

const NAME = /^[a-z][a-z0-9_]{0,39}$/u;

const clip = (text, length) => (text.length <= length ? text : `${text.slice(0, length - 1)}…`);
const object = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : null);
const stopped = () => new AdapterError('ABORTED', 'The live answer was stopped before it began.');

/** A provider's own word for a failure (`overloaded_error`), as a code the page can show, or the plain one. */
export const codeOf = (name, fallback = 'PROVIDER_ERROR') => (typeof name === 'string' && NAME.test(name) ? name.toUpperCase() : fallback);

/** At most `limit` bytes of a body, as text; a stop ends the reading at once. */
async function readSome(response, limit, signal) {
    const reader = response.body?.getReader();
    if (!reader) return '';
    const decoder = new TextDecoder();
    let text = '';
    let bytes = 0;
    const stop = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
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

/**
 * @param {object} provider
 * @param {string} provider.id the adapter's name
 * @param {string} provider.name who runs the model, as a reader knows them ('Anthropic')
 * @param {string} provider.url where the request goes
 * @param {string} provider.defaultModel
 * @param {(model: string) => boolean} provider.isModel what a model name may be
 * @param {string} provider.modelHint the sentence a name that is not one is refused with
 * @param {RegExp} provider.keyShape anything that looks like this provider's key, global
 * @param {(key: string) => object} provider.headers the request's headers, the key in one of them
 * @param {(request: object, model: string, origin: object) => object} provider.body
 * @param {(status: number, error: object|null, said: string, model: string) => [string, string]} provider.refusal
 *   a refusal before the stream, as one code the page knows and one sentence a reader can act on
 * @param {(on: {text, finish, done, fail, usage}) => (data: string) => void} provider.wire reads one event's data
 * @param {object} options
 * @param {() => string} options.getKey the reader's typed key, asked for at each request
 * @param {() => string | undefined} [options.getModel] the model the reader named, if they did
 * @param {(usage: {model: string, promptTokens?: number, completionTokens?: number, totalTokens?: number}) => void} [options.onUsage]
 * @param {typeof fetch} [options.fetch]
 * @param {number} [options.capacity]
 * @param {number} [options.maxBytes] the most a stream may send before it is cut off
 */
export function createKeyedStreamAdapter(provider, {
    getKey,
    getModel = () => undefined,
    onUsage,
    fetch: fetchImpl = (...args) => globalThis.fetch(...args),
    capacity,
    maxBytes = KEYED_LIMITS.stream
} = {}) {
    const modelOf = () => {
        const asked = getModel();
        return asked === undefined || asked === null || asked === '' ? provider.defaultModel : asked;
    };
    const originOf = model => ({ name: provider.isModel(model) ? model : `a ${provider.name} model`, provider: provider.name });
    const fallback = `${provider.name} reported an error`;

    return createTextStreamAdapter({
        id: provider.id,
        origin: () => originOf(modelOf()),
        capacity,
        async connect(request, sink, { signal } = {}) {
            if (signal?.aborted) throw stopped();
            const supplied = typeof getKey === 'function' ? getKey() : '';
            const key = typeof supplied === 'string' ? supplied.trim() : '';
            if (!key) throw new AdapterError('KEY_REQUIRED', `Your ${provider.name} API key is needed to start a live answer.`);
            const model = modelOf();
            if (!provider.isModel(model)) throw new AdapterError('MODEL_INVALID', provider.modelHint);

            /** A provider's words, cleaned of this key and anything shaped like a key; the plain sentence if they cannot be. */
            const cleaned = text => {
                try {
                    const out = String(text).split(key).join('[key]').replace(provider.keyShape, '[key]').trim();
                    return out ? clip(out, KEYED_LIMITS.said) : fallback;
                } catch {
                    return fallback;
                }
            };

            const controller = new AbortController();
            const onAbort = () => controller.abort();
            signal?.addEventListener('abort', onAbort, { once: true });
            const release = () => signal?.removeEventListener('abort', onAbort);

            let response;
            try {
                response = await fetchImpl(provider.url, {
                    method: 'POST',
                    headers: provider.headers(key),
                    body: JSON.stringify(provider.body(request, model, originOf(model))),
                    signal: controller.signal,
                    credentials: 'omit',
                    cache: 'no-store',
                    mode: 'cors',
                    // No page address with the request, and no redirect the key's header could follow elsewhere.
                    referrerPolicy: 'no-referrer',
                    redirect: 'error'
                });
            } catch (error) {
                release();
                if (controller.signal.aborted || error?.name === 'AbortError') throw stopped();
                throw new AdapterError('CONNECT_FAILED', clip(`Could not reach ${provider.name}: ${cleaned(error?.message ?? error)}`, KEYED_LIMITS.message));
            }
            if (!response.ok) {
                let text = '';
                try {
                    text = await readSome(response, KEYED_LIMITS.error, controller.signal);
                } finally {
                    release();
                }
                if (controller.signal.aborted) throw stopped();
                let error = null;
                try { error = object(object(JSON.parse(text))?.error); } catch { /* not the provider's error shape: the status says enough */ }
                const said = typeof error?.message === 'string' && error.message.trim() ? cleaned(error.message) : `no reason given (HTTP ${response.status})`;
                const [code, message] = provider.refusal(response.status, error, said, model);
                throw new AdapterError(code, clip(message, KEYED_LIMITS.message));
            }
            if (!response.body) {
                release();
                throw new AdapterError('CONNECT_FAILED', `${provider.name} answered with nothing to read.`);
            }

            let over = false;
            let finish = null;
            let usage = null;
            let reader = null;

            const settle = () => {
                if (!usage || typeof onUsage !== 'function') return;
                const said = { model, ...usage };
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
                sink.error({ code, message: clip(message, KEYED_LIMITS.message), recoverable: false });
            };
            /** The answer is over by the provider's account: finished, or finished with the reason it stopped. */
            const end = () => {
                if (over) return;
                if (finish && finish !== 'stop') {
                    const name = codeOf(finish, 'UNKNOWN');
                    if (finish === 'length') fail('RESPONSE_LENGTH', 'The answer reached its length limit and was cut off.');
                    else if (finish === 'refusal') fail('RESPONSE_REFUSAL', 'The model declined to answer this.');
                    else fail(`RESPONSE_${name}`, `The provider stopped the answer (${finish === 'content_filter' ? 'content filter' : name.toLowerCase()}).`);
                    return;
                }
                over = true;
                settle();
                sink.done();
            };

            const receive = provider.wire({
                // Only the answer's words, and nothing once its finish is known.
                text: words => { if (!over && !finish && typeof words === 'string' && words) sink.delta(words); },
                finish: reason => { if (typeof reason === 'string' && reason) finish ??= reason; },
                done: end,
                fail: (code, said) => fail(code, typeof said === 'string' && said ? cleaned(said) : fallback),
                usage: report => { if (report) usage = report; }
            });
            const parser = createSseParser({ onData: data => { if (!over) receive(data); } });

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
                // The stream ended without its last word. After a finish reason that is the end; before one, the connection was lost.
                if (finish) { end(); return; }
                over = true;
                settle();
                sink.error({ code: 'TRANSPORT_LOST', message: `The connection to ${provider.name} dropped`, recoverable: true });
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

/** Only non-negative whole numbers of tokens, under the names the page reads; null when there are none. */
export function tokens({ promptTokens, completionTokens, totalTokens }) {
    const out = {};
    for (const [name, value] of Object.entries({ promptTokens, completionTokens, totalTokens })) {
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) out[name] = value;
    }
    return Object.keys(out).length ? out : null;
}
