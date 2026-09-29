/**
 * The seam between a provider and the runtime.
 *
 * An ADAPTER is the only thing that knows a provider. It turns what the
 * provider says into `rise.current-events.v1` events and numbers them, so it is
 * the sole producer of the ordered stream. Anything the host does to a Current
 * (a Dive, an interruption, a speech mark it measured itself) goes through the
 * adapter too, by `record`, so there is one source of order and no two writers
 * can collide on a sequence number. Provider peculiarities stop here.
 *
 *   adapter    { id, capabilities, open(request) -> Promise<connection> }
 *   connection { events: AsyncIterable<raw event>,
 *                record(type, body),      a host event, numbered in order
 *                interrupt(info),         stop generating what remains
 *                resume(fromSeq),         replay from a sequence number
 *                close() }                release everything; safe to repeat
 *
 * A stream is pulled, not pushed: the consumer reads at its own pace, and an
 * adapter that is ahead of it waits. That is the backpressure.
 */

import { RISE_CURRENT_EVENTS_SCHEMA, validateEvent } from './protocol.js';

export class AdapterError extends Error {
    constructor(code, message, { recoverable = false } = {}) {
        super(message);
        this.name = 'AdapterError';
        this.code = code;
        this.recoverable = recoverable;
    }
}

export const OPEN_LIMITS = Object.freeze({
    prompt: 2_000,
    context: 5,
    contextText: 500,
    id: 120
});

/** Numbers events for one Current. Every adapter writes through one. */
export function createEventWriter(currentId, { start = 0 } = {}) {
    let seq = start;
    return {
        next(type, body = {}) {
            const event = { schema: RISE_CURRENT_EVENTS_SCHEMA, currentId, seq, type, ...body };
            seq += 1;
            return event;
        },
        get nextSeq() { return seq; }
    };
}

/**
 * An async queue with a capacity, read by one consumer.
 *
 * `push` waits for room, which is what holds a producer back. `pushNow` is for
 * a host injection that cannot wait: it is accepted up to twice the capacity
 * and refused after, so even that is bounded. A consumer that stops reading
 * closes the channel and frees every producer waiting on it.
 */
export function createChannel({ capacity = 64 } = {}) {
    const queue = [];
    const waitingPushes = [];
    let waitingRead = null;
    let closed = false;
    let failure = null;

    const wake = () => {
        if (waitingRead && (queue.length > 0 || closed)) {
            const resolve = waitingRead;
            waitingRead = null;
            resolve();
        }
    };

    const admit = () => {
        while (waitingPushes.length > 0 && queue.length < capacity) {
            const next = waitingPushes.shift();
            queue.push(next.value);
            next.resolve(true);
        }
    };

    const finish = () => {
        closed = true;
        for (const pending of waitingPushes.splice(0)) pending.resolve(false);
        wake();
    };

    return {
        get depth() { return queue.length; },

        push(value) {
            if (closed) return Promise.resolve(false);
            if (queue.length < capacity && waitingPushes.length === 0) {
                queue.push(value);
                wake();
                return Promise.resolve(true);
            }
            return new Promise(resolve => waitingPushes.push({ value, resolve }));
        },

        pushNow(value) {
            if (closed || queue.length >= capacity * 2) return false;
            queue.push(value);
            wake();
            return true;
        },

        close: finish,

        fail(error) {
            failure = error;
            finish();
        },

        [Symbol.asyncIterator]() {
            return {
                next: async () => {
                    for (;;) {
                        if (queue.length > 0) {
                            const value = queue.shift();
                            admit();
                            return { value, done: false };
                        }
                        if (failure) { const error = failure; failure = null; throw error; }
                        if (closed) return { value: undefined, done: true };
                        await new Promise(resolve => { waitingRead = resolve; });
                    }
                },
                return: async () => {
                    queue.length = 0;
                    finish();
                    return { value: undefined, done: true };
                }
            };
        }
    };
}

function plain(value, path) {
    const proto = value !== null && typeof value === 'object' ? Object.getPrototypeOf(value) : undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value) || (proto !== Object.prototype && proto !== null)) {
        throw new AdapterError('OPEN_REQUEST', `Expected a plain object at ${path}`);
    }
    return value;
}

function only(value, allowed, path) {
    for (const key of Object.keys(value)) {
        if (!allowed.includes(key)) throw new AdapterError('OPEN_REQUEST', `Unknown field ${path}.${key}`);
    }
}

function text(value, max, path) {
    if (typeof value !== 'string' || !value.trim() || value.length > max) {
        throw new AdapterError('OPEN_REQUEST', `Expected nonblank text of at most ${max} characters at ${path}`);
    }
    return value;
}

function parent(value) {
    const source = plain(value, 'parent');
    only(source, ['currentId', 'segmentId', 'atCharacter', 'context'], 'parent');
    if (!Number.isInteger(source.atCharacter) || source.atCharacter < 0) {
        throw new AdapterError('OPEN_REQUEST', 'Expected a whole position at parent.atCharacter');
    }
    if (!Array.isArray(source.context) || source.context.length > OPEN_LIMITS.context) {
        throw new AdapterError('OPEN_REQUEST', `Expected at most ${OPEN_LIMITS.context} lines of context`);
    }
    return {
        currentId: text(source.currentId, OPEN_LIMITS.id, 'parent.currentId'),
        segmentId: text(source.segmentId, OPEN_LIMITS.id, 'parent.segmentId'),
        atCharacter: source.atCharacter,
        context: source.context.map((line, i) => text(line, OPEN_LIMITS.contextText, `parent.context[${i}]`))
    };
}

/**
 * What a host may ask an adapter for: an answer, or a Dive taken from a place
 * in a parent. It is data and nothing else: no model name, no tool, no URL.
 */
/** What a host may write into the ordered stream: its own actions and its voice’s progress. */
export const HOST_EVENT_TYPES = Object.freeze([
    'interrupt', 'branch.open', 'branch.close', 'speech.start', 'speech.mark', 'speech.end'
]);

/**
 * Number and record one host event in a connection’s stream. Refused, as an
 * AdapterError, if the type is not one a host may write or the event would not
 * validate; the sequence number is only spent on an event that will be sent.
 */
export function recordHostEvent({ currentId, writer, type, body = {} }) {
    if (!HOST_EVENT_TYPES.includes(type)) throw new AdapterError('RECORD', `A host may not write ${type}`);
    const candidate = { schema: RISE_CURRENT_EVENTS_SCHEMA, currentId, seq: writer.nextSeq, type, ...body };
    try {
        validateEvent(candidate);
    } catch (error) {
        throw new AdapterError('RECORD', error.message);
    }
    return writer.next(type, body);
}

export function validateOpenRequest(input) {
    const source = plain(input, 'request');
    only(source, ['intent', 'prompt', 'parent'], 'request');
    if (!['answer', 'dive'].includes(source.intent)) throw new AdapterError('OPEN_REQUEST', 'Unknown intent');
    const request = { intent: source.intent, prompt: text(source.prompt, OPEN_LIMITS.prompt, 'request.prompt') };
    if (source.intent === 'dive') {
        if (source.parent === undefined) throw new AdapterError('OPEN_REQUEST', 'A Dive needs the parent it was taken from');
        request.parent = parent(source.parent);
    } else if (source.parent !== undefined) {
        throw new AdapterError('OPEN_REQUEST', 'Only a Dive has a parent');
    }
    return request;
}

export function assertAdapter(adapter) {
    if (!adapter || typeof adapter !== 'object') throw new AdapterError('ADAPTER', 'An adapter is an object');
    if (typeof adapter.id !== 'string' || !adapter.id) throw new AdapterError('ADAPTER', 'An adapter has an id');
    if (!adapter.capabilities || typeof adapter.capabilities !== 'object') {
        throw new AdapterError('ADAPTER', 'An adapter states its capabilities');
    }
    if (typeof adapter.open !== 'function') throw new AdapterError('ADAPTER', 'An adapter can open');
    return adapter;
}

export function assertConnection(connection) {
    if (!connection || typeof connection !== 'object') throw new AdapterError('CONNECTION', 'A connection is an object');
    if (typeof connection.events?.[Symbol.asyncIterator] !== 'function') {
        throw new AdapterError('CONNECTION', 'A connection yields events as an async iterable');
    }
    for (const method of ['record', 'interrupt', 'resume', 'close']) {
        if (typeof connection[method] !== 'function') throw new AdapterError('CONNECTION', `A connection can ${method}`);
    }
    return connection;
}
