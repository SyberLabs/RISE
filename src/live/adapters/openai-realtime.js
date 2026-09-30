/**
 * The OpenAI Realtime adapter.
 *
 * A text-stream adapter (text-stream.js) whose provider is OpenAI Realtime over
 * a transport it is handed. The transport is anything with
 *
 *     open() -> Promise<{ send(text), onMessage(fn), onClose(fn), close() }>
 *
 * so the adapter is tested with a fake one and shipped with the browser's
 * WebRTC data channel (openai-webrtc.js). It carries text only: RISE speaks it
 * with its own voice, which is what lets a Dive hold the voice. It does not
 * carry provider audio, evidence or Dives.
 */

import { AdapterError } from '../adapter.js';
import { createOpenAIWire } from './openai-wire.js';
import { createTextStreamAdapter } from './text-stream.js';

export function createOpenAIRealtimeAdapter({ transport, capacity } = {}) {
    if (!transport || typeof transport.open !== 'function') throw new TypeError('The OpenAI adapter is given a transport that can open');
    return createTextStreamAdapter({
        id: 'openai-realtime',
        provider: 'OpenAI Realtime',
        capacity,
        async connect(request, sink, { signal } = {}) {
            let connection;
            try {
                connection = await transport.open({ signal });
            } catch (error) {
                throw error instanceof AdapterError ? error : new AdapterError('CONNECT_FAILED', String(error?.message ?? error).slice(0, 300));
            }
            if (signal?.aborted) {
                try { connection.close(); } catch { /* it was never used */ }
                throw new AdapterError('ABORTED', 'The live answer was stopped before it began.');
            }
            const wire = createOpenAIWire({ send: event => connection.send(JSON.stringify(event)), sink });
            connection.onMessage(raw => wire.receive(raw));
            connection.onClose(() => wire.closed());
            wire.start(request);
            return {
                cancel: () => wire.cancel(),
                close: () => connection.close()
            };
        }
    });
}
