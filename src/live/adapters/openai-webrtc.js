/**
 * The browser's half of a live OpenAI session: a WebRTC data channel.
 *
 * The page makes an offer; the same-origin route (worker/live-realtime.mjs)
 * relays it to OpenAI with the reader's own key and returns OpenAI's answer;
 * then the page talks to OpenAI directly, over the data channel, and what is
 * said never touches this site. The key is read when a session is opened, from
 * where the page keeps it in memory, sent in one request header to this site
 * only, and never put in a URL, a body, the peer connection, or an error.
 *
 * Text only. The offer carries an audio section because the call needs one, but
 * it is receive-only: the microphone is never asked for.
 *
 * NOT VERIFIED AGAINST THE LIVE SERVICE (see openai-wire.js).
 */

import { AdapterError } from '../adapter.js';
import { createRealClock } from '../clock.js';

const REFUSALS = Object.freeze({
    401: ['KEY_REFUSED', 'OpenAI refused the key.'],
    429: ['RATE_LIMITED', 'Too many live answers were started, or OpenAI is limiting this key. Try again shortly.'],
    503: ['LIVE_UNAVAILABLE', 'Live answers are not switched on for this site.']
});

/** Wait for candidates, but never for long: what has been gathered is enough to offer. */
function gathered(connection, { timeoutMs, clock }) {
    if (connection.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise(resolve => {
        let cancel = null;
        const done = () => {
            cancel?.();
            connection.removeEventListener?.('icegatheringstatechange', check);
            resolve();
        };
        const check = () => { if (connection.iceGatheringState === 'complete') done(); };
        connection.addEventListener?.('icegatheringstatechange', check);
        cancel = clock.setTimer(done, timeoutMs);
    });
}

const stopped = () => new AdapterError('ABORTED', 'The live answer was stopped before it began.');

function opened(channel, { timeoutMs, clock, signal }) {
    if (channel.readyState === 'open') return Promise.resolve();
    return new Promise((resolve, reject) => {
        let cancel = null;
        const settle = fn => (value) => {
            cancel?.();
            channel.removeEventListener('open', onOpen);
            channel.removeEventListener('close', onClose);
            signal?.removeEventListener('abort', onAbort);
            fn(value);
        };
        const onOpen = settle(resolve);
        const onClose = settle(() => reject(new AdapterError('CONNECT_FAILED', 'The connection closed before it opened')));
        const onAbort = settle(() => reject(stopped()));
        channel.addEventListener('open', onOpen);
        channel.addEventListener('close', onClose);
        signal?.addEventListener('abort', onAbort);
        cancel = clock.setTimer(settle(() => reject(new AdapterError('CONNECT_TIMEOUT', 'The connection did not open in time'))), timeoutMs);
    });
}

/**
 * @param {object} options
 * @param {() => string} options.getKey where the page keeps the reader's key, in memory
 * @param {typeof fetch} [options.fetchImpl]
 * @param {typeof RTCPeerConnection} [options.PeerConnection]
 * @param {string} [options.endpoint] the same-origin relay
 * @param {string} [options.model] one of the models the relay offers
 */
export function createOpenAIWebRtcTransport({
    getKey,
    fetchImpl = globalThis.fetch?.bind(globalThis),
    PeerConnection = globalThis.RTCPeerConnection,
    endpoint = '/api/live/realtime',
    model,
    clock = createRealClock(),
    iceTimeoutMs = 4_000,
    openTimeoutMs = 12_000
} = {}) {
    if (typeof getKey !== 'function') throw new TypeError('The transport is told where the key is kept');
    return {
        /** `signal` is the reader stopping: nothing is asked of the site or OpenAI after it. */
        async open({ signal } = {}) {
            if (signal?.aborted) throw stopped();
            const key = getKey();
            if (typeof key !== 'string' || !key.trim()) throw new AdapterError('KEY_REQUIRED', 'Your OpenAI key is needed to start a live answer.');
            if (typeof PeerConnection !== 'function') throw new AdapterError('NO_WEBRTC', 'This browser cannot make the connection a live answer needs.');
            if (typeof fetchImpl !== 'function') throw new AdapterError('NO_FETCH', 'This browser cannot reach the site.');

            const connection = new PeerConnection();
            const closeAll = channel => {
                try { channel?.close(); } catch { /* already closed */ }
                try { connection.close(); } catch { /* already closed */ }
            };
            let channel = null;
            try {
                channel = connection.createDataChannel('oai-events');
                connection.addTransceiver('audio', { direction: 'recvonly' });
                await connection.setLocalDescription(await connection.createOffer());
                await gathered(connection, { timeoutMs: iceTimeoutMs, clock });
                if (signal?.aborted) throw stopped();

                let response;
                try {
                    response = await fetchImpl(`${endpoint}${model ? `?model=${encodeURIComponent(model)}` : ''}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/sdp', Authorization: `Bearer ${key.trim()}` },
                        body: connection.localDescription.sdp,
                        credentials: 'omit',
                        cache: 'no-store'
                    });
                } catch {
                    throw new AdapterError('NETWORK', 'This site could not be reached.');
                }
                if (!response.ok) {
                    const [code, message] = REFUSALS[response.status] ?? ['PROVIDER_FAILED', 'The live answer could not be started.'];
                    throw new AdapterError(code, message);
                }
                const answer = await response.text();
                if (signal?.aborted) throw stopped();
                await connection.setRemoteDescription({ type: 'answer', sdp: answer });
                await opened(channel, { timeoutMs: openTimeoutMs, clock, signal });
            } catch (error) {
                closeAll(channel);
                throw error instanceof AdapterError ? error : new AdapterError('CONNECT_FAILED', 'The connection could not be made.');
            }

            const dropped = [];
            const watch = () => {
                if (['failed', 'closed', 'disconnected'].includes(connection.connectionState)) for (const fn of dropped) fn();
            };
            connection.addEventListener('connectionstatechange', watch);
            channel.addEventListener('close', () => { for (const fn of dropped) fn(); });

            return {
                send: text => channel.send(text),
                onMessage: fn => channel.addEventListener('message', event => fn(typeof event.data === 'string' ? event.data : '')),
                onClose: fn => { dropped.push(fn); },
                close: () => closeAll(channel)
            };
        }
    };
}
