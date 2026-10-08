/**
 * The app's side of an MCP host's messaging.
 *
 * An MCP app is a page inside a sandboxed frame. The host and the page speak
 * JSON-RPC to each other with `postMessage`. This is the whole of what the page
 * knows about that: it says hello, receives the Currents the host's model hands
 * it, hears when the host cancels the call or changes where the app is shown,
 * can ask the host's model a question directly (sampling), and can tell that
 * model, for its next turn, what went wrong in a generated scene
 * (`ui/update-model-context`, where the host offers it). Every method name is
 * in METHODS, so the vocabulary is one table.
 *
 * WHY NOT A MESSAGE. The extension has `ui/message`, which puts text in the
 * conversation, but it answers only whether the host took it: the model's reply
 * goes to the conversation, as a new tool call with a view of its own, and never
 * back to the view that asked. A Dive needs its answer in the view, so it uses
 * sampling (`sampling/createMessage`), which is optional: a host says whether it
 * offers it when the app says hello, and where it does not there is no Dive.
 *
 * CHECKED AGAINST THE REFERENCE, NOT AGAINST A PRODUCT. The method names and
 * shapes were compared with the MCP Apps specification and the types of the
 * reference package (@modelcontextprotocol/ext-apps 2.0.3). What was run
 * against that package's own host class is recorded in docs/plans/LIVE-MCP.md.
 * No product host (ChatGPT, Claude, VS Code) has been tried. A difference found
 * there is a change to METHODS and currentFrom.
 *
 * WHAT IT WILL NOT DO. It listens only to the frame's parent, ignores anything
 * that is not well-formed JSON-RPC or is larger than a limit, admits a Current
 * only from a successful tool result, and never evaluates, follows or fetches
 * anything it is sent. What it reads is then validated as strictly as any
 * Current (current-events.js). Tool input is never an admission signal.
 * The host's own requests (`ping`, `ui/resource-teardown`) are answered, because
 * a host waits for the answer.
 */

import { createRealClock } from '../clock.js';
import { MCP_CURRENT_BYTES, MCP_MESSAGE_BYTES, serializedUtf8Bytes } from './mcp-size.js';

export const METHODS = Object.freeze({
    initialize: 'ui/initialize',
    initialized: 'ui/notifications/initialized',
    toolInput: 'ui/notifications/tool-input',
    toolResult: 'ui/notifications/tool-result',
    sample: 'sampling/createMessage',
    sizeChanged: 'ui/notifications/size-changed',
    hostContextChanged: 'ui/notifications/host-context-changed',
    toolCancelled: 'ui/notifications/tool-cancelled',
    ping: 'ping',
    teardown: 'ui/resource-teardown',
    updateModelContext: 'ui/update-model-context'
});

/** The extension's protocol version this was written against (ext-apps `LATEST_PROTOCOL_VERSION`). */
export const PROTOCOL_VERSION = '2026-01-26';

export const PORT_LIMITS = Object.freeze({
    message: MCP_MESSAGE_BYTES, current: MCP_CURRENT_BYTES, buffered: 8, pending: 8, remembered: 8, answer: 100_000,
    /** What one report to the model's context may hold, and how many one Current may send. */
    report: 2_000, reportLine: 400, reports: 5
});

const REPORT_LEAD = 'RISE could not run part of the reading it is showing; the reader sees its fallback instead:';

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** What a witness session reads of the hello's context (the embed stage decision §10); style variables by their keys, never their values. */
const WITNESSED_CONTEXT = ['containerDimensions', 'displayMode', 'availableDisplayModes', 'safeAreaInsets', 'theme', 'platform', 'deviceCapabilities'];

function witnessed(context, fields = Object.keys(context)) {
    const line = {};
    for (const field of fields) if (field !== 'styles' && context[field] !== undefined) line[field] = context[field];
    if (isPlainObject(context.styles)) line.stylesVariables = Object.keys(isPlainObject(context.styles.variables) ? context.styles.variables : {});
    return line;
}

/** A Current from a successful tool result. Tool input never authorizes Begin. */
export function currentFrom(method, params) {
    if (method === METHODS.toolResult && params?.isError === true) return null;
    if (!params || typeof params !== 'object' || Array.isArray(params)) return null;
    const holder = method === METHODS.toolResult ? params.structuredContent : null;
    if (!holder || typeof holder !== 'object' || Array.isArray(holder)) return null;
    if (!holder.current || typeof holder.current !== 'object') return null;
    return { current: holder.current };
}

/**
 * @param {object} options
 * @param {Window} options.frame this page's window
 * @param {Window} [options.host] where the host is (the parent)
 * @param {string} [options.appName]
 * @param {(line: string) => void} [options.log] a witness's log: one JSON line at hello, per context change and per size report
 */
export function createMcpGuestPort({ frame, host = frame.parent, appName = 'RISE', clock = createRealClock(), timeoutMs = 10_000, log }) {
    const listeners = new Set();
    const errorListeners = new Set();
    const buffered = [];
    const bufferedErrors = [];
    const pending = new Map();
    const teardowns = new Set();
    const contextListeners = new Set();
    const cancelListeners = new Set();
    const remembered = [];
    let next = 1;
    let closed = false;
    let sampling = false;
    let modelContext = false;
    // The lines reported to the model for the Current on screen: each report replaces the last in the host's context.
    let reported = [];
    // What the host said about where the app is shown (theme, size, display mode), as last merged.
    let hostContext = {};

    const send = message => host.postMessage({ jsonrpc: '2.0', ...message }, '*');
    const witness = (event, line) => { if (log) log(JSON.stringify({ 'rise-host': event, ...line })); };

    function currentKey(current) {
        try { return JSON.stringify({ current }); } catch { return null; }
    }

    function forgetCurrent(current) {
        const key = currentKey(current);
        if (key === null) return;
        for (let index = remembered.indexOf(key); index !== -1; index = remembered.indexOf(key)) remembered.splice(index, 1);
        for (let index = buffered.length - 1; index >= 0; index -= 1) {
            if (currentKey(buffered[index].current) === key) buffered.splice(index, 1);
        }
    }

    function reportError(message) {
        const error = new Error(String(message).slice(0, 220));
        if (errorListeners.size === 0) {
            if (bufferedErrors.length === 0) bufferedErrors.push(error);
            return;
        }
        for (const listener of [...errorListeners]) { try { listener(error); } catch { /* one listener cannot block the others */ } }
    }

    function onMessage(event) {
        if (closed || event.source !== host) return;
        const data = event.data;
        if (!data || typeof data !== 'object' || Array.isArray(data) || data.jsonrpc !== '2.0') return;
        let size;
        try { size = serializedUtf8Bytes(data); } catch { return; }
        if (size === null) return;
        if (size > PORT_LIMITS.message) {
            if (data.id === undefined && data.method === METHODS.toolResult) {
                reportError(`The assistant's MCP message is too large for RISE (${PORT_LIMITS.message.toLocaleString('en-US')} bytes). Ask it to shorten the answer and try again.`);
            }
            return;
        }

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
        // A request has an id and is waited on: answer it, whatever it is.
        if (data.id !== undefined) {
            if (data.method === METHODS.ping) send({ id: data.id, result: {} });
            else if (data.method === METHODS.teardown) {
                send({ id: data.id, result: {} });
                for (const listener of [...teardowns]) { try { listener(); } catch { /* the host has its answer */ } }
            } else send({ id: data.id, error: { code: -32601, message: 'Method not found' } });
            return;
        }
        if (data.method === METHODS.hostContextChanged) {
            // A partial update: the fields it carries replace those held, and the rest stay.
            if (!isPlainObject(data.params)) return;
            hostContext = { ...hostContext, ...data.params };
            witness('context-changed', witnessed(data.params));
            for (const listener of [...contextListeners]) { try { listener(hostContext); } catch { /* one listener cannot block the others */ } }
            return;
        }
        if (data.method === METHODS.toolCancelled) {
            const reason = typeof data.params?.reason === 'string' ? data.params.reason.slice(0, 200) : null;
            for (const listener of [...cancelListeners]) { try { listener({ reason }); } catch { /* one listener cannot block the others */ } }
            return;
        }
        if (data.method === METHODS.toolResult && data.params?.isError === true) {
            reportError('The assistant’s Current was refused. Ask it to correct the answer and try again.');
            return;
        }
        if (data.method !== METHODS.toolResult) return;
        const found = currentFrom(data.method, data.params);
        if (!found) return;
        // Deduplicate only successful results; an earlier tool input cannot consume this key.
        const key = currentKey(found.current);
        if (key === null) return;
        if (remembered.includes(key)) return;
        const currentSize = serializedUtf8Bytes(found.current);
        if (currentSize === null) return;
        if (currentSize > PORT_LIMITS.current) {
            remembered.push(key);
            if (remembered.length > PORT_LIMITS.remembered) remembered.shift();
            reportError(`The assistant's Current exceeds the ${PORT_LIMITS.current.toLocaleString('en-US')}-byte MCP limit. Ask it to shorten the answer and try again.`);
            return;
        }
        remembered.push(key);
        if (remembered.length > PORT_LIMITS.remembered) remembered.shift();
        reported = [];
        if (listeners.size === 0) {
            buffered.push(found);
            if (buffered.length > PORT_LIMITS.buffered) buffered.shift();
            return;
        }
        for (const listener of [...listeners]) if (listener(found) === true) return;
    }

    frame.addEventListener('message', onMessage);

    function request(method, params, wait = timeoutMs) {
        if (pending.size >= PORT_LIMITS.pending) return Promise.reject(new Error('Too many requests are waiting on the host'));
        const id = next;
        next += 1;
        return new Promise((resolve, reject) => {
            const cancel = clock.setTimer(() => { pending.delete(id); reject(new Error('The host did not answer in time')); }, wait);
            pending.set(id, { resolve, reject, cancel });
            send({ id, method, params });
        });
    }

    return {
        /** Say hello. Resolves with what the host says about itself, then the app is ready. */
        async connect() {
            const result = await request(METHODS.initialize, { appInfo: { name: appName, version: '1' }, appCapabilities: { availableDisplayModes: ['inline'] }, protocolVersion: PROTOCOL_VERSION });
            sampling = Boolean(result?.hostCapabilities?.sampling);
            // Only text is ever sent, so only a host that names text among the modalities it takes is sent any.
            modelContext = isPlainObject(result?.hostCapabilities?.updateModelContext) && isPlainObject(result.hostCapabilities.updateModelContext.text);
            hostContext = isPlainObject(result?.hostContext) ? { ...result.hostContext } : {};
            witness('initialize', witnessed(hostContext, WITNESSED_CONTEXT));
            send({ method: METHODS.initialized, params: {} });
            return result;
        },

        /** What the host last said about where the app is shown: the hello's context with every change since merged in. */
        hostContext() {
            return hostContext;
        },

        /** Told after each change the host sends is merged in, with the whole context. */
        onHostContext(listener) {
            if (closed) return () => {};
            contextListeners.add(listener);
            return () => contextListeners.delete(listener);
        },

        /** Told when the host cancels the call this app shows, with the host's reason in words, or null. */
        onToolCancelled(listener) {
            if (closed) return () => {};
            cancelListeners.add(listener);
            return () => cancelListeners.delete(listener);
        },

        /** Currents the host hands the app. Those that arrived before anyone was listening are given first. */
        onCurrent(listener) {
            if (closed) return () => {};
            listeners.add(listener);
            for (const item of buffered.splice(0)) if (listener(item) === true) break;
            return () => listeners.delete(listener);
        },

        /** Actionable failures for oversized trusted Currents or host envelopes. */
        onError(listener) {
            if (closed) return () => {};
            errorListeners.add(listener);
            for (const error of bufferedErrors.splice(0)) { try { listener(error); } catch { /* keep delivery bounded */ } }
            return () => errorListeners.delete(listener);
        },

        /** Forget a Current that the reader has not begun, so a refused proposal can be retried. */
        forgetCurrent,

        /** The host is about to remove the app; it has already been answered. */
        onTeardown(listener) {
            teardowns.add(listener);
            return () => teardowns.delete(listener);
        },

        /** Tell the host how much room the app takes. */
        sizeChanged({ width, height }) {
            const size = {};
            if (Number.isFinite(width)) size.width = Math.round(width);
            if (Number.isFinite(height)) size.height = Math.round(height);
            witness('size-changed', size);
            send({ method: METHODS.sizeChanged, params: size });
        },

        /**
         * Tell the host's model, for its next turn, what went wrong in the reading on screen: one line of
         * RISE's own words (the caller quotes anything a scene wrote as data). Sent only to a host that said
         * at hello it takes text for its model's context, at most PORT_LIMITS.reports times per Current.
         * The host keeps only the latest update, so each carries every line so far. True if it was sent.
         */
        report(line) {
            if (closed || !modelContext || reported.length >= PORT_LIMITS.reports) return false;
            const clean = String(line).replace(/[\u0000-\u001F\u007F]/gu, ' ');
            reported.push(clean.length <= PORT_LIMITS.reportLine ? clean : `${clean.slice(0, PORT_LIMITS.reportLine - 1)}…`);
            const text = [REPORT_LEAD, ...reported].join('\n').slice(0, PORT_LIMITS.report);
            // A host that refuses or does not answer costs nothing: the reader already sees the fallback.
            request(METHODS.updateModelContext, { content: [{ type: 'text', text }] }).catch(() => {});
            return true;
        },

        /** Whether the host said, when the app said hello, that it will put a question to its model. */
        canSample() {
            return sampling;
        },

        /**
         * Ask the host's model, and get its words back. The host may show the reader the request
         * first, and may refuse it or change it; a refusal is an error in words, and so is a reply
         * that has no text.
         */
        async complete({ system, text, maxTokens = 2_000, timeoutMs: wait = timeoutMs }) {
            if (!sampling) throw new Error('This host does not put a question to its model');
            const result = await request(METHODS.sample, {
                messages: [{ role: 'user', content: { type: 'text', text } }],
                systemPrompt: system,
                maxTokens
            }, wait);
            const blocks = Array.isArray(result?.content) ? result.content : [result?.content];
            const said = blocks.filter(block => block && block.type === 'text' && typeof block.text === 'string').map(block => block.text).join('');
            if (!said.trim()) throw new Error('The host’s model gave no words');
            if (said.length > PORT_LIMITS.answer) throw new Error('The host’s model gave too much');
            return said;
        },

        close() {
            closed = true;
            frame.removeEventListener('message', onMessage);
            for (const waiting of pending.values()) { waiting.cancel(); waiting.reject(new Error('Closed')); }
            pending.clear();
            listeners.clear();
            errorListeners.clear();
            teardowns.clear();
            contextListeners.clear();
            cancelListeners.clear();
            buffered.length = 0;
            bufferedErrors.length = 0;
            remembered.length = 0;
        }
    };
}
