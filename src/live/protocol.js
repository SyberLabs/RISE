/**
 * rise.current-events.v1: changes to a Current over time.
 *
 * A model, or anything speaking for one, supplies declarative intent about a
 * Current as it unfolds: a segment begins, words are committed, a segment
 * ends, an experiential condition is set, a source is attached. It never
 * supplies anything executable. Every field is named here, bounded, and
 * checked; a field that is not named is refused, not ignored, so an event can
 * neither smuggle in a script, a stylesheet, a shader, a renderer, a request,
 * nor a prototype key.
 *
 * `rise.current.v1` stays the sealed, strict snapshot this protocol lowers
 * into (see stream.js). It shares that document's limits and its closed visual
 * catalog, so the two cannot drift apart.
 *
 * Validation returns a detached, frozen copy or throws a LiveProtocolError
 * carrying a code and the path of the offending field.
 */

import {
    RISE_CURRENT_LIMITS,
    RISE_CURRENT_LOOKS,
    RISE_CURRENT_THEME_IDS,
    RISE_CURRENT_VISUALS,
    hasLiteralForbidden,
    hasReservedMarker
} from '../core/rise-current.js';

export const RISE_CURRENT_EVENTS_SCHEMA = 'rise.current-events.v1';

export const EVENT_LIMITS = Object.freeze({
    /** The most a serialised event may be before it is even parsed. */
    wireBytes: 16 * 1024,
    /** One committed chunk of a segment's text. */
    textChunk: 1_000,
    seq: 2_147_483_647,
    dimensions: 10,
    evidenceTitle: 200,
    evidenceLocation: 200,
    uri: 500,
    question: 500,
    interruptText: 500,
    reason: 200,
    errorCode: 80,
    errorMessage: 500,
    /** No utterance in a Current is longer than an hour. */
    speechMs: 3_600_000
});

export const EVENT_TYPES = Object.freeze([
    'current.open',
    'segment.begin',
    'segment.text',
    'segment.end',
    'state.set',
    'evidence.add',
    'dive.attach',
    'speech.start',
    'speech.mark',
    'speech.end',
    'interrupt',
    'branch.open',
    'branch.close',
    'current.cancel',
    'current.complete',
    'error'
]);

/**
 * The intended experiential condition of a segment. These describe what the
 * presentation is meant to be, never what the reader feels: `motionEnergy` is a
 * valid setting and a diagnosis of the reader is not. The names match the
 * affect layer's dimensions so the two can share one owner when it lands.
 */
export const EXPERIENCE_DIMENSIONS = Object.freeze([
    'tension', 'warmth', 'expansiveness', 'perceptualDensity', 'motionEnergy',
    'solemnity', 'novelty', 'uncertainty', 'intimacy', 'arousal'
]);

export const EVIDENCE_KINDS = Object.freeze(['supplied', 'retrieved', 'model-proposed']);

export class LiveProtocolError extends Error {
    constructor(code, path, message) {
        super(`${message} (${path})`);
        this.name = 'LiveProtocolError';
        this.code = code;
        this.path = path;
    }
}

const fail = (code, path, message) => { throw new LiveProtocolError(code, path, message); };

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function object(value, path) {
    const proto = value !== null && typeof value === 'object' ? Object.getPrototypeOf(value) : undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || (proto !== Object.prototype && proto !== null)) {
        fail('EVENT_OBJECT', path, 'Expected a plain object');
    }
    for (const key of Object.keys(value)) {
        if (FORBIDDEN_KEYS.has(key)) fail('EVENT_UNKNOWN_FIELD', `${path}.${key}`, `Unknown field: ${key}`);
    }
    return value;
}

function only(value, allowed, path) {
    for (const key of Object.keys(value)) {
        if (!allowed.includes(key)) fail('EVENT_UNKNOWN_FIELD', `${path}.${key}`, `Unknown field: ${key}`);
    }
}

/** A field that may be left out. `undefined` means left out; anything else is checked. */
const given = (value, key) => Object.hasOwn(value, key) && value[key] !== undefined;

function text(value, max, path, code = 'EVENT_TEXT') {
    if (typeof value !== 'string' || !value.trim() || value.length > max) {
        fail(code, path, `Expected nonblank text of at most ${max} characters`);
    }
    return value;
}

function id(value, path) {
    if (typeof value !== 'string' || !value || value !== value.trim()
        || value.length > RISE_CURRENT_LIMITS.id) {
        fail('EVENT_ID', path, `Expected a trimmed id of at most ${RISE_CURRENT_LIMITS.id} characters`);
    }
    return value;
}

function count(value, max, path, code) {
    if (!Number.isInteger(value) || value < 0 || value > max) {
        fail(code, path, `Expected a whole number from 0 to ${max}`);
    }
    return value;
}

function milliseconds(value, path) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > EVENT_LIMITS.speechMs) {
        fail('EVENT_TIMING', path, `Expected a time from 0 to ${EVENT_LIMITS.speechMs} milliseconds`);
    }
    return value;
}

function span(value, path) {
    const source = object(value, path);
    only(source, ['fromCharacter', 'toCharacter'], path);
    const from = count(source.fromCharacter, RISE_CURRENT_LIMITS.segmentText, `${path}.fromCharacter`, 'EVENT_SPAN');
    const to = count(source.toCharacter, RISE_CURRENT_LIMITS.segmentText, `${path}.toCharacter`, 'EVENT_SPAN');
    if (to <= from) fail('EVENT_SPAN', path, 'Expected a span that ends after it begins');
    return { fromCharacter: from, toCharacter: to };
}

const NOT_A_PUBLIC_HOST = /(^|\.)(localhost|local|internal|lan|home|corp|test|invalid|example\.invalid)$/u;

/**
 * A source address is a plain public https URL and nothing else: no other
 * scheme, no credentials, no whitespace or control characters, no bare or
 * private host, no address literal. RISE never fetches it; it is only ever
 * shown, and opened by the reader.
 */
function uri(value, path) {
    const bad = () => fail('EVENT_EVIDENCE_URI', path, 'Expected a public https address');
    if (typeof value !== 'string' || value.length > EVENT_LIMITS.uri || /[\u0000- \u007f]/u.test(value)) bad();
    let parsed;
    try { parsed = new URL(value); } catch { bad(); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) bad();
    const host = parsed.hostname;
    if (!host.includes('.') || host.startsWith('[') || host.includes(':')
        || /^\d+(\.\d+){3}$/u.test(host) || /^\d+$/u.test(host.split('.').pop())
        || NOT_A_PUBLIC_HOST.test(host)) bad();
    return parsed.href;
}

function origin(value, path) {
    const source = object(value, path);
    only(source, ['kind', 'name', 'provider'], path);
    if (!['model', 'human'].includes(source.kind)) fail('EVENT_ORIGIN', `${path}.kind`, 'Unknown origin kind');
    const clean = { kind: source.kind, name: text(source.name, RISE_CURRENT_LIMITS.name, `${path}.name`) };
    if (source.kind === 'model') {
        if (!given(source, 'provider')) fail('EVENT_ORIGIN', `${path}.provider`, 'A model origin must name its provider');
        clean.provider = text(source.provider, RISE_CURRENT_LIMITS.name, `${path}.provider`, 'EVENT_ORIGIN');
    } else if (given(source, 'provider')) {
        fail('EVENT_ORIGIN', `${path}.provider`, 'A human origin cannot name a model provider');
    }
    return clean;
}

function state(value, path) {
    const source = object(value, path);
    const names = Object.keys(source);
    if (names.length < 1 || names.length > EVENT_LIMITS.dimensions) {
        fail('EVENT_STATE', path, `Expected 1 to ${EVENT_LIMITS.dimensions} dimensions`);
    }
    const clean = {};
    for (const name of names) {
        if (!EXPERIENCE_DIMENSIONS.includes(name)) fail('EVENT_STATE', `${path}.${name}`, `Unknown dimension: ${name}`);
        const level = source[name];
        if (typeof level !== 'number' || !Number.isFinite(level) || level < 0 || level > 1) {
            fail('EVENT_STATE', `${path}.${name}`, 'Expected a number from 0 to 1');
        }
        clean[name] = level;
    }
    return clean;
}

function evidence(value, path) {
    const source = object(value, path);
    only(source, ['id', 'kind', 'title', 'location', 'uri', 'supports'], path);
    const clean = { id: id(source.id, `${path}.id`) };
    if (!EVIDENCE_KINDS.includes(source.kind)) {
        fail('EVENT_EVIDENCE_KIND', `${path}.kind`, 'Evidence says where it came from: supplied, retrieved or model-proposed');
    }
    clean.kind = source.kind;
    clean.title = text(source.title, EVENT_LIMITS.evidenceTitle, `${path}.title`);
    if (given(source, 'location')) clean.location = text(source.location, EVENT_LIMITS.evidenceLocation, `${path}.location`);
    if (given(source, 'uri')) clean.uri = uri(source.uri, `${path}.uri`);
    if (given(source, 'supports')) clean.supports = span(source.supports, `${path}.supports`);
    return clean;
}

/** Structural only. Whether the quotes match the words is checked against the segment (see stream.js). */
function dive(value, path) {
    const source = object(value, path);
    only(source, ['id', 'text', 'anchor'], path);
    const anchor = object(source.anchor, `${path}.anchor`);
    only(anchor, ['fromCharacter', 'toCharacter', 'quoteStart', 'quoteEnd'], `${path}.anchor`);
    return {
        id: id(source.id, `${path}.id`),
        text: text(source.text, RISE_CURRENT_LIMITS.diveText, `${path}.text`),
        anchor: {
            ...span({ fromCharacter: anchor.fromCharacter, toCharacter: anchor.toCharacter }, `${path}.anchor`),
            quoteStart: text(anchor.quoteStart, 500, `${path}.anchor.quoteStart`),
            quoteEnd: text(anchor.quoteEnd, 500, `${path}.anchor.quoteEnd`)
        }
    };
}

/** `literal` is optional and only ever `true`: an event does not say a thing is not literal. */
function literalFlag(e, p) {
    if (!Object.hasOwn(e, 'literal') || e.literal === undefined) return {};
    if (typeof e.literal !== 'boolean') fail('EVENT_LITERAL', `${p}.literal`, 'literal is true or false');
    return e.literal ? { literal: true } : {};
}

function chunk(value, path, literal = false) {
    const clean = text(value, EVENT_LIMITS.textChunk, path);
    // A literal chunk's bars and bracketed words are words; the score cut and the stand-ins that
    // escape them are never text.
    if (literal ? hasLiteralForbidden(clean) : hasReservedMarker(clean)) {
        fail('EVENT_RESERVED_TEXT', path, literal
            ? 'Literal text cannot contain the score cut or the stand-ins that escape it'
            : 'Text contains a reserved playback marker');
    }
    return clean;
}

/** What each type carries beyond the envelope, and how each field is checked. */
const BODIES = {
    'current.open': {
        fields: ['title', 'origin', 'theme', 'look'],
        read: (e, p) => {
            const clean = { title: text(e.title, RISE_CURRENT_LIMITS.title, `${p}.title`), origin: origin(e.origin, `${p}.origin`) };
            if (given(e, 'theme')) {
                if (!RISE_CURRENT_THEME_IDS.includes(e.theme)) fail('EVENT_THEME', `${p}.theme`, 'Unknown theme');
                clean.theme = e.theme;
            }
            if (given(e, 'look')) {
                if (!RISE_CURRENT_LOOKS.includes(e.look)) fail('EVENT_LOOK', `${p}.look`, 'Unknown look');
                clean.look = e.look;
            }
            return clean;
        }
    },
    'segment.begin': {
        fields: ['segmentId', 'visual', 'literal'],
        read: (e, p) => {
            const clean = { segmentId: id(e.segmentId, `${p}.segmentId`), ...literalFlag(e, p) };
            if (Object.hasOwn(e, 'visual') && e.visual !== undefined) {
                if (!RISE_CURRENT_VISUALS.includes(e.visual)) fail('EVENT_VISUAL', `${p}.visual`, 'Unknown visual selection');
                clean.visual = e.visual;
            }
            return clean;
        }
    },
    'segment.text': {
        fields: ['segmentId', 'offset', 'text', 'literal'],
        read: (e, p) => {
            const literal = literalFlag(e, p);
            return {
                segmentId: id(e.segmentId, `${p}.segmentId`),
                offset: count(e.offset, RISE_CURRENT_LIMITS.segmentText, `${p}.offset`, 'EVENT_OFFSET'),
                text: chunk(e.text, `${p}.text`, literal.literal === true),
                ...literal
            };
        }
    },
    'segment.end': { fields: ['segmentId'], read: (e, p) => ({ segmentId: id(e.segmentId, `${p}.segmentId`) }) },
    'state.set': {
        fields: ['segmentId', 'state'],
        read: (e, p) => ({ segmentId: id(e.segmentId, `${p}.segmentId`), state: state(e.state, `${p}.state`) })
    },
    'evidence.add': {
        fields: ['segmentId', 'evidence'],
        read: (e, p) => ({ segmentId: id(e.segmentId, `${p}.segmentId`), evidence: evidence(e.evidence, `${p}.evidence`) })
    },
    'dive.attach': {
        fields: ['segmentId', 'dive'],
        read: (e, p) => ({ segmentId: id(e.segmentId, `${p}.segmentId`), dive: dive(e.dive, `${p}.dive`) })
    },
    'speech.start': { fields: ['segmentId'], read: (e, p) => ({ segmentId: id(e.segmentId, `${p}.segmentId`) }) },
    'speech.mark': {
        fields: ['segmentId', 'charIndex', 'tMs'],
        read: (e, p) => ({
            segmentId: id(e.segmentId, `${p}.segmentId`),
            charIndex: count(e.charIndex, RISE_CURRENT_LIMITS.segmentText, `${p}.charIndex`, 'EVENT_OFFSET'),
            tMs: milliseconds(e.tMs, `${p}.tMs`)
        })
    },
    'speech.end': {
        fields: ['segmentId', 'durationMs'],
        read: (e, p) => ({ segmentId: id(e.segmentId, `${p}.segmentId`), durationMs: milliseconds(e.durationMs, `${p}.durationMs`) })
    },
    interrupt: {
        fields: ['reason', 'text'],
        read: (e, p) => {
            if (!['user', 'system'].includes(e.reason)) fail('EVENT_INTERRUPT', `${p}.reason`, 'Unknown interruption reason');
            const clean = { reason: e.reason };
            if (Object.hasOwn(e, 'text') && e.text !== undefined) clean.text = text(e.text, EVENT_LIMITS.interruptText, `${p}.text`);
            return clean;
        }
    },
    'branch.open': {
        fields: ['branchId', 'parentSegmentId', 'atCharacter', 'question'],
        read: (e, p) => {
            const clean = {
                branchId: id(e.branchId, `${p}.branchId`),
                parentSegmentId: id(e.parentSegmentId, `${p}.parentSegmentId`),
                atCharacter: count(e.atCharacter, RISE_CURRENT_LIMITS.segmentText, `${p}.atCharacter`, 'EVENT_OFFSET')
            };
            if (Object.hasOwn(e, 'question') && e.question !== undefined) {
                clean.question = text(e.question, EVENT_LIMITS.question, `${p}.question`);
            }
            return clean;
        }
    },
    'branch.close': { fields: ['branchId'], read: (e, p) => ({ branchId: id(e.branchId, `${p}.branchId`) }) },
    'current.cancel': {
        fields: ['reason'],
        read: (e, p) => (Object.hasOwn(e, 'reason') && e.reason !== undefined
            ? { reason: text(e.reason, EVENT_LIMITS.reason, `${p}.reason`) }
            : {})
    },
    'current.complete': { fields: [], read: () => ({}) },
    error: {
        fields: ['code', 'message', 'recoverable'],
        read: (e, p) => {
            if (typeof e.recoverable !== 'boolean') fail('EVENT_ERROR', `${p}.recoverable`, 'Expected true or false');
            return {
                code: text(e.code, EVENT_LIMITS.errorCode, `${p}.code`, 'EVENT_ERROR'),
                message: text(e.message, EVENT_LIMITS.errorMessage, `${p}.message`),
                recoverable: e.recoverable
            };
        }
    }
};

function deepFreeze(value) {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(deepFreeze);
        Object.freeze(value);
    }
    return value;
}

const NOT_PLAIN = Object.freeze([]);
const DETACH_DEPTH = 8;

/**
 * The input's own enumerable data, each property read once, so that what is checked is what
 * is returned even when the input has getters or is a proxy. Anything that is not a plain
 * object becomes a value every check refuses.
 */
function detach(value, depth = 0) {
    if (value === null || typeof value !== 'object') return value;
    const proto = Object.getPrototypeOf(value);
    if (Array.isArray(value) || (proto !== Object.prototype && proto !== null)) return NOT_PLAIN;
    if (depth >= DETACH_DEPTH) fail('EVENT_OBJECT', '$', 'Nested too deeply');
    const copy = {};
    for (const key of Object.keys(value)) {
        Object.defineProperty(copy, key, { value: detach(value[key], depth + 1), enumerable: true, writable: true, configurable: true });
    }
    return copy;
}

/** Strict, detached, frozen. Anything not named here is refused. */
export function validateEvent(input) {
    const source = object(detach(input), '$');
    if (source.schema !== RISE_CURRENT_EVENTS_SCHEMA) fail('EVENT_SCHEMA', '$.schema', 'Unknown event schema');
    if (typeof source.type !== 'string' || !Object.hasOwn(BODIES, source.type)) {
        fail('EVENT_TYPE', '$.type', 'Unknown event type');
    }
    const currentId = id(source.currentId, '$.currentId');
    if (!Number.isInteger(source.seq) || source.seq < 0 || source.seq > EVENT_LIMITS.seq) {
        fail('EVENT_SEQ', '$.seq', 'Expected a whole sequence number from 0');
    }
    const body = BODIES[source.type];
    only(source, ['schema', 'currentId', 'seq', 'type', ...body.fields], '$');
    return deepFreeze({
        schema: RISE_CURRENT_EVENTS_SCHEMA,
        currentId,
        seq: source.seq,
        type: source.type,
        ...body.read(source, '$')
    });
}

function exceedsWireByteLimit(wire) {
    let bytes = 0;
    for (let index = 0; index < wire.length; index += 1) {
        const code = wire.charCodeAt(index);
        if (code <= 0x7f) bytes += 1;
        else if (code <= 0x7ff) bytes += 2;
        else if (code >= 0xd800 && code <= 0xdbff
            && index + 1 < wire.length
            && wire.charCodeAt(index + 1) >= 0xdc00
            && wire.charCodeAt(index + 1) <= 0xdfff) {
            bytes += 4;
            index += 1;
        } else bytes += 3;
        if (bytes > EVENT_LIMITS.wireBytes) return true;
    }
    return false;
}

/**
 * An event as it arrives off a wire. Size is checked before anything is parsed.
 */
export function decodeEvent(wire) {
    if (typeof wire !== 'string') fail('EVENT_JSON', '$', 'Expected an event as text');
    // Keep the constant-time fast path for oversized ASCII; shorter strings
    // still need byte accounting because UTF-8 can exceed UTF-16 code units.
    if (wire.length > EVENT_LIMITS.wireBytes || exceedsWireByteLimit(wire)) {
        fail('EVENT_TOO_LARGE', '$', `An event is at most ${EVENT_LIMITS.wireBytes} bytes`);
    }
    let parsed;
    try { parsed = JSON.parse(wire); } catch { fail('EVENT_JSON', '$', 'Not valid JSON'); }
    return validateEvent(parsed);
}
