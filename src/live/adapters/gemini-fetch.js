/**
 * The browser's `fetch`, as the Gemini transport.
 *
 * `open` makes the request and resolves once Google has answered with its
 * headers, so a key Google does not accept or a model it does not have is
 * refused here, as an error in words, before there is any answer to mistake it
 * for. The answer's body is then read only when the adapter says `start()`, so
 * a handler is always in place first, and is handed on one server-sent event at
 * a time (gemini-sse.js).
 *
 * THE KEY. It is the reader's own, given by `getKey` at the moment of the
 * request, and it travels in one header (`x-goog-api-key`) from this browser to
 * Google. It is never put in an address, never logged, and never in an error:
 * anything said about a failure has it, and anything that looks like one,
 * replaced first. RISE's own server does not see it.
 *
 * NOT VERIFIED AGAINST THE LIVE SERVICE (see gemini-wire.js). What Google's
 * preflight allows from a browser origin, and that it answers errors with the
 * same CORS header, was checked against the endpoint without a key on
 * 2026-09-30; a real session has not been run.
 */

import { AdapterError } from '../adapter.js';
import { createSseParser } from './gemini-sse.js';
import { GEMINI_DEFAULT_MODEL, isModelId } from './gemini-model.js';

export const GEMINI_ORIGIN = 'https://generativelanguage.googleapis.com';
export const FETCH_LIMITS = Object.freeze({ error: 4_096, message: 300, stream: 4 * 1024 * 1024 });

const KEY_SHAPE = /AIza[0-9A-Za-z_-]{20,}/gu;

const clip = (text, length) => (text.length <= length ? text : `${text.slice(0, length - 1)}…`);

/** What Google said about a refusal, in the shape of its own error body, or nothing. */
function googleError(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch { return null; }
    const error = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed.error : null;
    return error && typeof error === 'object' && !Array.isArray(error) ? error : null;
}

/** Each way Google can refuse, as one code the page knows and one sentence a reader can act on. */
function refusal(status, text, { model, scrub }) {
    const error = googleError(text);
    const said = typeof error?.message === 'string' && error.message.trim() ? scrub(error.message).trim() : `no reason given (HTTP ${status})`;
    const reasons = Array.isArray(error?.details) ? error.details.map(detail => detail?.reason) : [];
    let code = 'BAD_REQUEST';
    if (status === 401 || status === 403) code = 'KEY_REFUSED';
    else if (status === 400 && (reasons.includes('API_KEY_INVALID') || /API key/iu.test(said))) code = 'KEY_REFUSED';
    else if (status === 404) code = 'MODEL_NOT_FOUND';
    else if (status === 429) code = 'RATE_LIMITED';
    else if (status >= 500) code = 'PROVIDER_UNAVAILABLE';
    const lead = {
        KEY_REFUSED: 'Google did not accept that key',
        MODEL_NOT_FOUND: `Google has no model called “${model}” for this key`,
        RATE_LIMITED: 'Google says this key has reached a limit',
        PROVIDER_UNAVAILABLE: 'Google could not answer just now',
        BAD_REQUEST: 'Google would not take the request'
    }[code];
    return new AdapterError(code, `${lead}: ${clip(said, 240)}`);
}

/** At most `limit` bytes of a body, as text; the rest is not read, and a stop ends the reading at once. */
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
 * @param {object} options
 * @param {() => string} options.getKey the reader's own key, asked for at each request
 * @param {() => string | undefined} [options.getModel] the model the reader named, if they did
 * @param {typeof fetch} [options.fetch]
 * @param {number} [options.maxBytes] the most a stream may send before it is cut off
 */
export function createGeminiFetchTransport({ getKey, getModel = () => undefined, fetch: fetchImpl = (...args) => globalThis.fetch(...args), maxBytes = FETCH_LIMITS.stream }) {
    return {
        async open({ body, signal } = {}) {
            const supplied = getKey();
            const key = typeof supplied === 'string' ? supplied.trim() : '';
            if (!key) throw new AdapterError('KEY_REQUIRED', 'A Gemini API key is needed to start a live answer.');
            const asked = getModel();
            const model = asked === undefined || asked === null || asked === '' ? GEMINI_DEFAULT_MODEL : asked;
            if (!isModelId(model)) throw new AdapterError('MODEL_INVALID', 'That is not a model name: use letters, digits, dots and dashes.');
            if (signal?.aborted) throw new AdapterError('ABORTED', 'The live answer was stopped before it began.');

            const scrub = text => String(text).split(key).join('[key]').replace(KEY_SHAPE, '[key]');
            const controller = new AbortController();
            let connection = null;
            const onAbort = () => { if (connection) connection.close(); else controller.abort(); };
            signal?.addEventListener('abort', onAbort, { once: true });
            const release = () => signal?.removeEventListener('abort', onAbort);

            let response;
            try {
                response = await fetchImpl(`${GEMINI_ORIGIN}/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
                    body: JSON.stringify(body),
                    signal: controller.signal,
                    credentials: 'omit',
                    cache: 'no-store',
                    mode: 'cors'
                });
            } catch (error) {
                release();
                if (controller.signal.aborted || error?.name === 'AbortError') throw new AdapterError('ABORTED', 'The live answer was stopped before it began.');
                throw new AdapterError('CONNECT_FAILED', clip(`Could not reach Google: ${scrub(error?.message ?? error)}`, FETCH_LIMITS.message));
            }

            if (!response.ok) {
                // Stop stays wired until the refusal has been read: a body that stalls must not hold the request.
                let text = '';
                try {
                    text = await readSome(response, FETCH_LIMITS.error, controller.signal);
                } finally {
                    release();
                }
                if (controller.signal.aborted) throw new AdapterError('ABORTED', 'The live answer was stopped before it began.');
                throw refusal(response.status, text, { model, scrub });
            }
            if (!response.body) {
                release();
                throw new AdapterError('CONNECT_FAILED', 'Google answered with nothing to read.');
            }

            const listeners = { message: [], close: [] };
            let started = false;
            let closed = false;
            let announced = false;
            let reader = null;

            const announceClose = () => {
                if (announced) return;
                announced = true;
                release();
                for (const fn of listeners.close) { try { fn(); } catch { /* a listener may not break the stream */ } }
            };
            const parser = createSseParser({
                onData: data => { if (!closed) for (const fn of listeners.message) { try { fn(data); } catch { /* likewise */ } } }
            });

            async function pump() {
                reader = response.body.getReader();
                const decoder = new TextDecoder();
                let bytes = 0;
                try {
                    for (;;) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        bytes += value.byteLength;
                        if (bytes > maxBytes) { connection.close(); return; }
                        parser.feed(decoder.decode(value, { stream: true }));
                    }
                    parser.feed(decoder.decode());
                    parser.end();
                } catch { /* the network dropped, or the reader stopped it: the stream is over either way */ } finally {
                    announceClose();
                }
            }

            connection = {
                /** Cleans provider words of this request's key, for whatever shows them. */
                scrub,
                onMessage(fn) { listeners.message.push(fn); },
                onClose(fn) { listeners.close.push(fn); },
                start() {
                    if (started || closed) return;
                    started = true;
                    void pump();
                },
                close() {
                    if (closed) return;
                    closed = true;
                    controller.abort();
                    if (reader) void reader.cancel().catch(() => {});
                    else void response.body.cancel().catch(() => {});
                    announceClose();
                }
            };
            return connection;
        }
    };
}
