/**
 * The app's side of an MCP host's messaging.
 *
 * An MCP app is a page inside a sandboxed frame. The host and the page speak
 * JSON-RPC to each other with `postMessage`. This is the whole of what the page
 * knows about that: it says hello, receives the Currents the host's model hands
 * it, and can put a message into the conversation. Every method name is in
 * METHODS, so the vocabulary is one table.
 *
 * NOT VERIFIED AGAINST A REAL HOST. The names and shapes are written from the
 * MCP Apps extension as I understand it, without a host to try them on, and the
 * test speaks to a fake one. When a real host can be tried, a difference is a
 * change to METHODS and `currentFrom`, and nothing else.
 *
 * WHAT IT WILL NOT DO. It listens only to the frame's parent, ignores anything
 * that is not well-formed JSON-RPC or is larger than a limit, reads a Current
 * only from the two places one is expected, and never evaluates, follows or
 * fetches anything it is sent. What it reads is then validated as strictly as
 * any Current (current-events.js).
 */

import { createRealClock } from '../clock.js';

export const METHODS = Object.freeze({
    initialize: 'ui/initialize',
    initialized: 'ui/notifications/initialized',
    toolInput: 'ui/notifications/tool-input',
    toolResult: 'ui/notifications/tool-result',
    message: 'ui/message'
});

export const PORT_LIMITS = Object.freeze({ message: 262_144, buffered: 8, pending: 8 });
const REPLY_TO = /^[A-Za-z0-9_.:-]{1,120}$/u;

/** A Current, and what it answers, from the two places a host puts one. Nothing else is read. */
export function currentFrom(method, params) {
    if (!params || typeof params !== 'object' || Array.isArray(params)) return null;
    const holder = method === METHODS.toolInput ? params.arguments : method === METHODS.toolResult ? params.structuredContent : null;
    if (!holder || typeof holder !== 'object' || Array.isArray(holder)) return null;
    if (!holder.current || typeof holder.current !== 'object') return null;
    const replyTo = typeof holder.replyTo === 'string' && REPLY_TO.test(holder.replyTo) ? holder.replyTo : undefined;
    return { current: holder.current, replyTo };
}

/**
 * @param {object} options
 * @param {Window} options.frame this page's window
 * @param {Window} [options.host] where the host is (the parent)
 * @param {string} [options.appName]
 */
export function createMcpGuestPort({ frame, host = frame.parent, appName = 'RISE', clock = createRealClock(), timeoutMs = 10_000 }) {
    const listeners = new Set();
    const buffered = [];
    const pending = new Map();
    let next = 1;
    let closed = false;

    const send = message => host.postMessage({ jsonrpc: '2.0', ...message }, '*');

    function onMessage(event) {
        if (closed || event.source !== host) return;
        const data = event.data;
        if (!data || typeof data !== 'object' || Array.isArray(data) || data.jsonrpc !== '2.0') return;
        let size = 0;
        try { size = JSON.stringify(data).length; } catch { return; }
        if (size > PORT_LIMITS.message) return;

        if (data.id !== undefined && data.method === undefined) {
            const waiting = pending.get(data.id);
            if (!waiting) return;
            pending.delete(data.id);
            waiting.cancel();
            if (data.error) waiting.reject(new Error(String(data.error.message ?? 'The host refused').slice(0, 200)));
            else waiting.resolve(data.result);
            return;
        }
        if (typeof data.method !== 'string') return;
        const found = currentFrom(data.method, data.params);
        if (!found) return;
        if (listeners.size === 0) {
            buffered.push(found);
            if (buffered.length > PORT_LIMITS.buffered) buffered.shift();
            return;
        }
        for (const listener of [...listeners]) if (listener(found) === true) return;
    }

    frame.addEventListener('message', onMessage);

    function request(method, params) {
        if (pending.size >= PORT_LIMITS.pending) return Promise.reject(new Error('Too many requests are waiting on the host'));
        const id = next;
        next += 1;
        return new Promise((resolve, reject) => {
            const cancel = clock.setTimer(() => { pending.delete(id); reject(new Error('The host did not answer in time')); }, timeoutMs);
            pending.set(id, { resolve, reject, cancel });
            send({ id, method, params });
        });
    }

    return {
        /** Say hello. Resolves with what the host says about itself, then the app is ready. */
        async connect() {
            const result = await request(METHODS.initialize, { appInfo: { name: appName, version: '1' }, appCapabilities: {}, protocolVersion: '2025-11-21' });
            send({ method: METHODS.initialized, params: {} });
            return result;
        },

        /** Currents the host hands the app. Those that arrived before anyone was listening are given first. */
        onCurrent(listener) {
            listeners.add(listener);
            for (const item of buffered.splice(0)) if (listener(item) === true) break;
            return () => listeners.delete(listener);
        },

        /** A message in the conversation, as if the reader had said it, for the host's model to answer. */
        sendMessage(text) {
            return request(METHODS.message, { role: 'user', content: [{ type: 'text', text }] });
        },

        close() {
            closed = true;
            frame.removeEventListener('message', onMessage);
            for (const waiting of pending.values()) { waiting.cancel(); waiting.reject(new Error('Closed')); }
            pending.clear();
            listeners.clear();
        }
    };
}
