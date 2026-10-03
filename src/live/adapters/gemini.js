/**
 * The Gemini adapter.
 *
 * A text-stream adapter (text-stream.js) whose provider is Google's streaming
 * text generation over a transport it is handed. The transport is anything with
 *
 *     open({ body, signal }) -> Promise<{ scrub(text), onMessage(fn), onClose(fn), start(), close() }>
 *
 * where `onMessage` hears the data of each server-sent event, `onClose` hears
 * the stream end, and nothing is read until `start()` (so a handler is always
 * in place before the first word). `scrub` cleans the provider's own words about
 * a failure of anything the transport must keep from the reader (their key); a
 * transport with none is trusted with none of them (gemini-wire.js). The adapter is tested with a fake one and
 * shipped with the browser's `fetch` (gemini-fetch.js). Unlike OpenAI's data
 * channel, the request is made by `open` itself: a refused key or a missing model
 * is refused there, before there is any answer to mistake it for.
 *
 * It carries text only: RISE speaks it with its own voice, which is what lets a
 * Dive hold the voice. Each question, a Dive included, is a request of its own.
 */

import { AdapterError } from '../adapter.js';
import { buildBody, createGeminiWire } from './gemini-wire.js';
import { createTextStreamAdapter } from './text-stream.js';

export function createGeminiAdapter({ transport, capacity } = {}) {
    if (!transport || typeof transport.open !== 'function') throw new TypeError('The Gemini adapter is given a transport that can open');
    return createTextStreamAdapter({
        id: 'gemini-stream',
        provider: 'Google Gemini',
        capacity,
        async connect(request, sink, { signal } = {}) {
            // Stopped before it began: nothing is asked.
            if (signal?.aborted) throw new AdapterError('ABORTED', 'The live answer was stopped before it began.');
            let connection;
            try {
                connection = await transport.open({ body: buildBody(request), signal });
            } catch (error) {
                throw error instanceof AdapterError ? error : new AdapterError('CONNECT_FAILED', String(error?.message ?? error).slice(0, 300));
            }
            if (signal?.aborted) {
                try { connection.close(); } catch { /* it was never used */ }
                throw new AdapterError('ABORTED', 'The live answer was stopped before it began.');
            }
            const wire = createGeminiWire({ sink, abort: () => connection.close(), scrub: connection.scrub });
            connection.onMessage(raw => wire.receive(raw));
            connection.onClose(() => wire.closed());
            connection.start();
            return {
                cancel: () => wire.cancel(),
                close: () => connection.close()
            };
        }
    });
}
