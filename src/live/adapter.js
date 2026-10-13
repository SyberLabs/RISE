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
 *   adapter    { id, capabilities, open(request, { signal }) -> Promise<connection>, admitScene? }
 *              `signal` is aborted if the reader stops before the open resolves;
 *              an adapter should then ask its provider nothing more. `admitScene`,
 *              for an adapter whose Currents may carry a generated scene or a figure
 *              in beats, is the Worker's admission the reducer holds them to
 *              (stream.js); without it a stream admits none
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
import { admitPerception } from './perception.js';
import { RISE_CURRENT_LOOKS, RISE_CURRENT_THEME_IDS } from '../core/rise-current.js';
import { BEAT_LIMITS, SCENE_ENGINES } from '../core/beats.js';

export class AdapterError extends Error {
    constructor(code, message, { recoverable = false } = {}) {
        super(message);
        this.name = 'AdapterError';
        this.code = code;
        this.recoverable = recoverable;
    }
}

/**
 * `reading`, `readingText`: the passages of the reading so far an interjection carries, and the length of each.
 * `said`, `attempts`, `diagnostics`, `diagnostic`, `source`: what an illustrator's request carries (illustration): the
 * beats just said (each at most `readingText`), the attempts in all, a refusal's diagnostics and each one's sentence,
 * and the refused source, as long as any scene may be.
 * `earlier…`: what was said earlier in the room (LIVE-026): at most `earlier` turns, each question and answer at most
 * `earlierText`, each turn's interjections at most `earlierAsides` (the reader's words `earlierAsideAsked`, RISE's
 * answer `earlierAsideSaid`), what it showed at most `earlierShown` of `earlierShownText`, and all of it together at
 * most `earlierTotal`. One turn at every bound still fits within the whole.
 */
export const OPEN_LIMITS = Object.freeze({
    prompt: 2_000,
    context: 5,
    contextText: 500,
    id: 120,
    reading: 64,
    readingText: 300,
    said: 2,
    attempts: 3,
    diagnostics: 10,
    diagnostic: 300,
    source: Math.max(BEAT_LIMITS.code, BEAT_LIMITS.svg),
    earlier: 6,
    earlierText: 1_200,
    earlierAsides: 3,
    earlierAsideAsked: 300,
    earlierAsideSaid: 600,
    earlierShown: 6,
    earlierShownText: 120,
    earlierTotal: 6_000
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

/** The reading an interjection was made in: its passages so far, in order, and the one the reader interrupted (`at`). */
function reading(value) {
    const source = plain(value, 'reading');
    only(source, ['passages', 'at'], 'reading');
    if (!Array.isArray(source.passages) || source.passages.length === 0 || source.passages.length > OPEN_LIMITS.reading) {
        throw new AdapterError('OPEN_REQUEST', `Expected 1 to ${OPEN_LIMITS.reading} passages at reading.passages`);
    }
    if (!Number.isInteger(source.at) || source.at < 0 || source.at >= source.passages.length) {
        throw new AdapterError('OPEN_REQUEST', 'Expected the passage interrupted at reading.at');
    }
    return {
        passages: source.passages.map((line, i) => text(line, OPEN_LIMITS.readingText, `reading.passages[${i}]`)),
        at: source.at
    };
}

/** What cannot stand inside a quotation on one line: a control, a line break, or a quotation mark that could close it. */
const UNQUOTABLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}“”"]/u;

/** Text quoted on one line as it is: nonblank, trimmed, bounded, and nothing in it that could end the quotation. */
function quotable(value, max, path) {
    text(value, max, path);
    if (value !== value.trim() || UNQUOTABLE.test(value)) throw new AdapterError('OPEN_REQUEST', `Expected one line with no quotation mark at ${path}`);
    return value;
}

/** A bounded, nonempty list. */
function list(value, max, path) {
    if (!Array.isArray(value) || value.length === 0 || value.length > max) throw new AdapterError('OPEN_REQUEST', `Expected 1 to ${max} items at ${path}`);
    return value;
}

/**
 * What was said earlier in the room (LIVE-026), oldest first: each question the reader asked, what RISE said in answer
 * (only what was said before the reader cut it off, and `cut` then), the interjections inside that reading, and what
 * it showed. Every text is quoted to the model as data, so each is one line with no quotation mark of its own.
 */
function earlier(value) {
    let size = 0;
    const counted = (item, max, path) => {
        size += quotable(item, max, path).length;
        return item;
    };
    const turns = list(value, OPEN_LIMITS.earlier, 'earlier').map((item, i) => {
        const path = `earlier[${i}]`;
        const source = plain(item, path);
        only(source, ['asked', 'said', 'interjections', 'showed', 'cut'], path);
        const turn = { asked: counted(source.asked, OPEN_LIMITS.earlierText, `${path}.asked`) };
        if (source.said !== undefined) turn.said = counted(source.said, OPEN_LIMITS.earlierText, `${path}.said`);
        if (source.interjections !== undefined) {
            turn.interjections = list(source.interjections, OPEN_LIMITS.earlierAsides, `${path}.interjections`).map((aside, j) => {
                const where = `${path}.interjections[${j}]`;
                const words = plain(aside, where);
                only(words, ['asked', 'said'], where);
                const clean = { asked: counted(words.asked, OPEN_LIMITS.earlierAsideAsked, `${where}.asked`) };
                if (words.said !== undefined) clean.said = counted(words.said, OPEN_LIMITS.earlierAsideSaid, `${where}.said`);
                return clean;
            });
        }
        if (source.showed !== undefined) {
            turn.showed = list(source.showed, OPEN_LIMITS.earlierShown, `${path}.showed`)
                .map((shown, j) => counted(shown, OPEN_LIMITS.earlierShownText, `${path}.showed[${j}]`));
        }
        if (source.cut !== undefined) {
            if (source.cut !== true) throw new AdapterError('OPEN_REQUEST', `Expected true or nothing at ${path}.cut`);
            turn.cut = true;
        }
        return turn;
    });
    if (size > OPEN_LIMITS.earlierTotal) throw new AdapterError('OPEN_REQUEST', `Expected at most ${OPEN_LIMITS.earlierTotal} characters said earlier`);
    return turns;
}

/** One diagnostic of a refused picture, as the admission gives it (src/core/scene-admission.js). */
function diagnostic(value, i) {
    const path = `illustration.repair.diagnostics[${i}]`;
    const source = plain(value, path);
    only(source, ['line', 'column', 'rule', 'message'], path);
    for (const key of ['line', 'column']) {
        if (source[key] !== null && (!Number.isInteger(source[key]) || source[key] < 1)) throw new AdapterError('OPEN_REQUEST', `Expected a line or column, or null, at ${path}.${key}`);
    }
    if (typeof source.rule !== 'string' || !/^[a-z][a-z-]{0,39}$/u.test(source.rule)) throw new AdapterError('OPEN_REQUEST', `Expected a rule's name at ${path}.rule`);
    return { line: source.line, column: source.column, rule: source.rule, message: text(source.message, OPEN_LIMITS.diagnostic, `${path}.message`) };
}

/**
 * What the illustrator is given (docs/plans/LIVE-CURRENT.md §19): the medium to draw in, which attempt this is, the
 * room (its theme and look, the scene running where the picture was asked for, the beats just said, the reader's words
 * when an answer to them asked for it), and on a repair what was refused and why.
 */
function illustration(value) {
    const source = plain(value, 'illustration');
    only(source, ['medium', 'attempt', 'theme', 'look', 'running', 'said', 'asked', 'repair'], 'illustration');
    if (!['figure', 'scene'].includes(source.medium)) throw new AdapterError('OPEN_REQUEST', 'An illustrator draws a figure or a scene');
    if (!Number.isInteger(source.attempt) || source.attempt < 1 || source.attempt > OPEN_LIMITS.attempts) {
        throw new AdapterError('OPEN_REQUEST', `Expected an attempt from 1 to ${OPEN_LIMITS.attempts}`);
    }
    const clean = { medium: source.medium, attempt: source.attempt };
    if (source.theme !== undefined) {
        if (!RISE_CURRENT_THEME_IDS.includes(source.theme)) throw new AdapterError('OPEN_REQUEST', 'Unknown theme at illustration.theme');
        clean.theme = source.theme;
    }
    if (source.look !== undefined) {
        if (!RISE_CURRENT_LOOKS.includes(source.look)) throw new AdapterError('OPEN_REQUEST', 'Unknown look at illustration.look');
        clean.look = source.look;
    }
    if (source.running !== undefined) {
        const running = plain(source.running, 'illustration.running');
        only(running, ['id', 'engine', 'form'], 'illustration.running');
        const scene = { id: text(running.id, OPEN_LIMITS.id, 'illustration.running.id') };
        if ((running.engine === undefined) === (running.form === undefined)) throw new AdapterError('OPEN_REQUEST', 'A running scene is an engine or a form');
        if (running.engine !== undefined && !SCENE_ENGINES.includes(running.engine)) throw new AdapterError('OPEN_REQUEST', 'Unknown engine at illustration.running');
        if (running.form !== undefined && !['svg', 'code'].includes(running.form)) throw new AdapterError('OPEN_REQUEST', 'Unknown form at illustration.running');
        clean.running = running.engine !== undefined ? { ...scene, engine: running.engine } : { ...scene, form: running.form };
    }
    if (!Array.isArray(source.said) || source.said.length > OPEN_LIMITS.said) throw new AdapterError('OPEN_REQUEST', `Expected at most ${OPEN_LIMITS.said} beats at illustration.said`);
    clean.said = source.said.map((line, i) => text(line, OPEN_LIMITS.readingText, `illustration.said[${i}]`));
    if (source.asked !== undefined) clean.asked = text(source.asked, OPEN_LIMITS.prompt, 'illustration.asked');
    if (source.repair !== undefined) {
        const repair = plain(source.repair, 'illustration.repair');
        only(repair, ['source', 'diagnostics'], 'illustration.repair');
        if (!Array.isArray(repair.diagnostics) || repair.diagnostics.length === 0 || repair.diagnostics.length > OPEN_LIMITS.diagnostics) {
            throw new AdapterError('OPEN_REQUEST', `Expected 1 to ${OPEN_LIMITS.diagnostics} diagnostics at illustration.repair`);
        }
        clean.repair = {
            ...(repair.source === undefined ? {} : { source: text(repair.source, OPEN_LIMITS.source, 'illustration.repair.source') }),
            diagnostics: repair.diagnostics.map(diagnostic)
        };
    }
    return clean;
}

export function validateOpenRequest(input) {
    const source = plain(input, 'request');
    only(source, ['intent', 'prompt', 'parent', 'perception', 'reading', 'illustration', 'earlier'], 'request');
    if (!['answer', 'dive', 'interject', 'illustrate'].includes(source.intent)) throw new AdapterError('OPEN_REQUEST', 'Unknown intent');
    const request = { intent: source.intent, prompt: text(source.prompt, OPEN_LIMITS.prompt, 'request.prompt') };
    if (source.intent === 'illustrate') {
        // A picture asked for: the brief is the prompt; nothing a question carries goes with it (docs/plans/LIVE-CURRENT.md §19).
        if (source.illustration === undefined) throw new AdapterError('OPEN_REQUEST', 'An illustrator is given what to draw and the room');
        for (const key of ['reading', 'perception', 'parent', 'earlier']) {
            if (source[key] !== undefined) throw new AdapterError('OPEN_REQUEST', `An illustrator is given no ${key}`);
        }
        request.illustration = illustration(source.illustration);
        return request;
    }
    if (source.illustration !== undefined) throw new AdapterError('OPEN_REQUEST', 'Only an illustrator is given an illustration');
    if (source.intent === 'interject') {
        // The reader spoke mid-reading: the reading so far goes up with their words (docs/plans/LIVE-CURRENT.md §17).
        if (source.reading === undefined) throw new AdapterError('OPEN_REQUEST', 'An interjection carries the reading it was made in');
        request.reading = reading(source.reading);
    } else if (source.reading !== undefined) {
        throw new AdapterError('OPEN_REQUEST', 'Only an interjection carries a reading');
    }
    if (source.perception !== undefined) {
        // The reader's actions go up with their next words only (perception.js): a question, or an interjection.
        if (source.intent === 'dive') throw new AdapterError('OPEN_REQUEST', 'Only an answer carries the reader’s actions');
        try {
            request.perception = admitPerception(source.perception);
        } catch (error) {
            throw new AdapterError('OPEN_REQUEST', String(error?.message ?? error));
        }
    }
    if (source.earlier !== undefined) {
        // What was said earlier in the room goes up with the reader's next words only: a question, or an interjection.
        if (source.intent === 'dive') throw new AdapterError('OPEN_REQUEST', 'Only an answer carries what was said earlier');
        request.earlier = earlier(source.earlier);
    }
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
