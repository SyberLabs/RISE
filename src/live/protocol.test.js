/**
 * rise.current-events.v1: changes to a Current over time.
 *
 * The model, or anything speaking for it, supplies declarative intent. It is
 * never trusted to supply anything executable, so every input here that tries
 * to smuggle in a script, a stylesheet, a shader, a renderer name, a request,
 * or a prototype key must fail closed with a code and a path.
 */
import { describe, expect, it } from 'vitest';
import {
    EVENT_LIMITS,
    EVENT_TYPES,
    EXPERIENCE_DIMENSIONS,
    LiveProtocolError,
    RISE_CURRENT_EVENTS_SCHEMA,
    decodeEvent,
    validateEvent
} from './protocol.js';

const base = (type, seq, body = {}) => ({
    schema: RISE_CURRENT_EVENTS_SCHEMA, currentId: 'answer-1', seq, type, ...body
});

const VALID = {
    'current.open': base('current.open', 0, {
        title: 'Black holes', origin: { kind: 'model', name: 'Answer', provider: 'mock' }
    }),
    'segment.begin': base('segment.begin', 1, { segmentId: 's1', visual: 'attractor' }),
    'segment.text': base('segment.text', 2, { segmentId: 's1', offset: 0, text: 'A black hole is a region.' }),
    'segment.end': base('segment.end', 3, { segmentId: 's1' }),
    'state.set': base('state.set', 4, { segmentId: 's1', state: { tension: 0.4, warmth: 0 } }),
    'evidence.add': base('evidence.add', 5, {
        segmentId: 's1',
        evidence: {
            id: 'e1', kind: 'supplied', title: 'A textbook', location: 'chapter 3',
            uri: 'https://example.org/book', supports: { fromCharacter: 0, toCharacter: 7 }
        }
    }),
    'dive.attach': base('dive.attach', 6, {
        segmentId: 's1',
        dive: { id: 'd1', text: 'A note.', anchor: { fromCharacter: 0, toCharacter: 1, quoteStart: 'A', quoteEnd: 'A' } }
    }),
    'speech.start': base('speech.start', 7, { segmentId: 's1' }),
    'speech.mark': base('speech.mark', 8, { segmentId: 's1', charIndex: 4, tMs: 350 }),
    'speech.end': base('speech.end', 9, { segmentId: 's1', durationMs: 2400 }),
    interrupt: base('interrupt', 10, { reason: 'user', text: 'wait, dive on the horizon' }),
    'branch.open': base('branch.open', 11, {
        branchId: 'b1', parentSegmentId: 's1', atCharacter: 12, question: 'What is the horizon?'
    }),
    'branch.close': base('branch.close', 12, { branchId: 'b1' }),
    'current.cancel': base('current.cancel', 13, { reason: 'user stopped' }),
    'current.complete': base('current.complete', 14),
    error: base('error', 15, { code: 'PROVIDER_LOST', message: 'The connection dropped.', recoverable: true }),
    'scene.declare': base('scene.declare', 16, { sceneId: 'field', engine: 'attractor', params: { palette: 'jade' } }),
    'scene.text': base('scene.text', 17, { sceneId: 'disk', offset: 0, text: 'export default function scene(rise) {\n' })
};

const refusal = input => {
    try {
        validateEvent(input);
    } catch (error) {
        if (error instanceof LiveProtocolError) return error;
        throw error;
    }
    return null;
};

describe('the vocabulary', () => {
    it('names exactly the events the plan lists', () => {
        expect([...EVENT_TYPES].sort()).toEqual(Object.keys(VALID).sort());
    });

    it('names the experiential dimensions, and only those', () => {
        expect([...EXPERIENCE_DIMENSIONS]).toEqual([
            'tension', 'warmth', 'expansiveness', 'perceptualDensity', 'motionEnergy',
            'solemnity', 'novelty', 'uncertainty', 'intimacy', 'arousal'
        ]);
    });
});

describe('a valid event of every type', () => {
    for (const [type, event] of Object.entries(VALID)) {
        it(`${type} validates, and comes back frozen and detached`, () => {
            const copy = structuredClone(event);
            const clean = validateEvent(copy);
            expect(clean).toEqual(event);
            expect(Object.isFrozen(clean)).toBe(true);
            copy.seq = 999;
            if (copy.state) copy.state.tension = 1;
            expect(clean.seq).toBe(event.seq);
            expect(clean).toEqual(event);
        });
    }

    it('a segment may omit its visual, and a text event may carry an offset into the segment', () => {
        expect(validateEvent(base('segment.begin', 1, { segmentId: 's1' })).visual).toBeUndefined();
        expect(validateEvent(base('segment.text', 2, { segmentId: 's1', offset: 25, text: 'More.' })).offset).toBe(25);
    });

    it('an opening may name a shipped theme, and it is copied as named', () => {
        for (const theme of ['classic', 'amethyst', 'prism', 'ember', 'cobalt', 'jade']) {
            const event = base('current.open', 0, {
                title: 'Why a black hole is black', origin: { kind: 'model', name: 'n', provider: 'p' }, theme
            });
            expect(validateEvent(structuredClone(event))).toEqual(event);
        }
        expect(Object.hasOwn(validateEvent(VALID['current.open']), 'theme')).toBe(false);
        expect(decodeEvent('{"schema":"rise.current-events.v1","currentId":"c","seq":0,"type":"current.open","title":"Why a black hole is black","origin":{"kind":"model","name":"n","provider":"p"},"theme":"cobalt"}').theme)
            .toBe('cobalt');
    });

    it('a human origin needs no provider, and a model origin must name one', () => {
        expect(refusal(base('current.open', 0, { title: 'T', origin: { kind: 'human', name: 'Ada' } }))).toBeNull();
        expect(refusal(base('current.open', 0, { title: 'T', origin: { kind: 'model', name: 'X' } }))?.code)
            .toBe('EVENT_ORIGIN');
        expect(refusal(base('current.open', 0, {
            title: 'T', origin: { kind: 'human', name: 'Ada', provider: 'mock' }
        }))?.code).toBe('EVENT_ORIGIN');
    });
});

describe('the envelope', () => {
    const cases = {
        'not an object': ['a string', 'EVENT_OBJECT'],
        'null': [null, 'EVENT_OBJECT'],
        'an array': [[], 'EVENT_OBJECT'],
        'a wrong schema': [{ ...VALID['segment.end'], schema: 'rise.current-events.v2' }, 'EVENT_SCHEMA'],
        'a missing schema': [(({ schema, ...rest }) => rest)(VALID['segment.end']), 'EVENT_SCHEMA'],
        'a missing seq': [(({ seq, ...rest }) => rest)(VALID['segment.end']), 'EVENT_SEQ'],
        'a negative seq': [{ ...VALID['segment.end'], seq: -1 }, 'EVENT_SEQ'],
        'a fractional seq': [{ ...VALID['segment.end'], seq: 1.5 }, 'EVENT_SEQ'],
        'a string seq': [{ ...VALID['segment.end'], seq: '3' }, 'EVENT_SEQ'],
        'an enormous seq': [{ ...VALID['segment.end'], seq: 2 ** 40 }, 'EVENT_SEQ'],
        'NaN seq': [{ ...VALID['segment.end'], seq: NaN }, 'EVENT_SEQ'],
        'an unknown type': [{ ...VALID['segment.end'], type: 'ui.render' }, 'EVENT_TYPE'],
        'no type': [(({ type, ...rest }) => rest)(VALID['segment.end']), 'EVENT_TYPE'],
        'a blank currentId': [{ ...VALID['segment.end'], currentId: '' }, 'EVENT_ID'],
        'an untrimmed currentId': [{ ...VALID['segment.end'], currentId: ' x' }, 'EVENT_ID'],
        'a too long currentId': [{ ...VALID['segment.end'], currentId: 'x'.repeat(121) }, 'EVENT_ID']
    };
    for (const [name, [input, code]] of Object.entries(cases)) {
        it(`refuses ${name}`, () => expect(refusal(input)?.code).toBe(code));
    }

    it('refuses an object with a foreign prototype', () => {
        class Event { constructor() { Object.assign(this, VALID['segment.end']); } }
        expect(refusal(new Event())?.code).toBe('EVENT_OBJECT');
    });

    it('accepts an object with no prototype at all', () => {
        expect(refusal(Object.assign(Object.create(null), VALID['segment.end']))).toBeNull();
    });
});

describe('what an event may not carry', () => {
    it('any field it does not define, on any type', () => {
        for (const [type, event] of Object.entries(VALID)) {
            expect(refusal({ ...event, onclick: 'alert(1)' })?.code, type).toBe('EVENT_UNKNOWN_FIELD');
        }
    });

    it('executable-looking fields, by name', () => {
        for (const field of ['script', 'css', 'style', 'html', 'shader', 'glsl', 'wgsl', 'renderer',
            'url', 'href', 'src', 'fetch', 'config', 'eval', 'function', 'worker']) {
            expect(refusal({ ...VALID['segment.begin'], [field]: 'x' })?.code, field).toBe('EVENT_UNKNOWN_FIELD');
        }
    });

    it('prototype keys, including one that arrives through JSON.parse', () => {
        const parsed = JSON.parse('{"__proto__": {"polluted": true}}');
        expect(refusal({ ...VALID['segment.end'], ...parsed })?.code).not.toBeNull();
        for (const key of ['__proto__', 'constructor', 'prototype']) {
            const hostile = JSON.parse(`{"schema":"${RISE_CURRENT_EVENTS_SCHEMA}","currentId":"a","seq":1,`
                + `"type":"segment.end","segmentId":"s","${key}":{"x":1}}`);
            expect(refusal(hostile)?.code, key).toBe('EVENT_UNKNOWN_FIELD');
        }
        expect({}.polluted).toBeUndefined();
    });

    it('a nested unknown field', () => {
        expect(refusal(base('current.open', 0, {
            title: 'T', origin: { kind: 'human', name: 'A', role: 'admin' }
        }))?.code).toBe('EVENT_UNKNOWN_FIELD');
        expect(refusal(base('evidence.add', 1, {
            segmentId: 's', evidence: { id: 'e', kind: 'supplied', title: 'T', onload: 'x' }
        }))?.code).toBe('EVENT_UNKNOWN_FIELD');
    });

    it('an explicit null where a field is optional', () => {
        expect(refusal(base('segment.begin', 1, { segmentId: 's', visual: null }))?.code).toBe('EVENT_VISUAL');
        expect(refusal(base('interrupt', 1, { reason: 'user', text: null }))?.code).toBe('EVENT_TEXT');
    });

    it('a theme outside the shipped color themes, however it is spelled, and a theme anywhere but the opening', () => {
        const opening = theme => base('current.open', 0, {
            title: 'T', origin: { kind: 'model', name: 'n', provider: 'p' }, theme
        });
        for (const theme of ['neon', 'Jade', 'jade ', '', '#061912', 7, {}, ['jade'], null]) {
            const error = refusal(opening(theme));
            expect(error?.code, JSON.stringify(theme)).toBe('EVENT_THEME');
            expect(error?.path).toBe('$.theme');
            expect(error?.message).toBe('Unknown theme ($.theme)');
        }
        expect(refusal(base('segment.begin', 1, { segmentId: 's', theme: 'jade' }))?.code).toBe('EVENT_UNKNOWN_FIELD');
    });

    it('a visual outside the closed catalog, however it is spelled', () => {
        for (const visual of ['shader', 'ATTRACTOR', ' attractor', 'attractor ', 'living-flame', '', 7, {}, ['still']]) {
            expect(refusal(base('segment.begin', 1, { segmentId: 's', visual }))?.code, JSON.stringify(visual))
                .toBe('EVENT_VISUAL');
        }
    });
});

describe('text', () => {
    const text = value => refusal(base('segment.text', 1, { segmentId: 's', offset: 0, text: value }))?.code;

    it('refuses blank, non-string, and oversized text', () => {
        expect(text('')).toBe('EVENT_TEXT');
        expect(text('   ')).toBe('EVENT_TEXT');
        expect(text(5)).toBe('EVENT_TEXT');
        expect(text('x'.repeat(EVENT_LIMITS.textChunk + 1))).toBe('EVENT_TEXT');
        expect(text('x'.repeat(EVENT_LIMITS.textChunk))).toBeUndefined();
    });

    it('refuses the playback markers the chunker would obey, until a literal path exists', () => {
        for (const marker of ['[PAUSE]', '[flash]', '[HOLD]', 'a | b', '']) {
            expect(text(`before ${marker} after`), marker).toBe('EVENT_RESERVED_TEXT');
        }
    });

    it('refuses a negative, fractional, or enormous offset', () => {
        for (const offset of [-1, 1.5, '0', null, 2 ** 31]) {
            expect(refusal(base('segment.text', 1, { segmentId: 's', offset, text: 'x' }))?.code, String(offset))
                .toBe('EVENT_OFFSET');
        }
    });
});

describe('experiential state', () => {
    const state = value => refusal(base('state.set', 1, { segmentId: 's', state: value }))?.code;

    it('refuses a dimension it does not name, including a claim about the reader', () => {
        expect(state({ userEmotion: 0.5 })).toBe('EVENT_STATE');
        expect(state({ depressed: 1 })).toBe('EVENT_STATE');
        expect(state({ tension: 0.5, valence: 0.2 })).toBe('EVENT_STATE');
    });

    it('refuses values outside 0 to 1, and anything that is not a finite number', () => {
        for (const bad of [-0.01, 1.01, NaN, Infinity, '0.5', null, true, [0.5], {}]) {
            expect(state({ tension: bad }), String(bad)).toBe('EVENT_STATE');
        }
    });

    it('refuses an empty state, and accepts the boundaries', () => {
        expect(state({})).toBe('EVENT_STATE');
        expect(state({ tension: 0, arousal: 1 })).toBeUndefined();
    });

    it('refuses a state that is not a plain object', () => {
        expect(state([])).toBe('EVENT_OBJECT');
        expect(state('calm')).toBe('EVENT_OBJECT');
    });
});

describe('evidence', () => {
    const evidence = extra => refusal(base('evidence.add', 1, {
        segmentId: 's', evidence: { id: 'e1', kind: 'supplied', title: 'A source', ...extra }
    }));

    it('says where a source came from, in a closed list', () => {
        for (const kind of ['supplied', 'retrieved', 'model-proposed']) {
            expect(refusal(base('evidence.add', 1, {
                segmentId: 's', evidence: { id: 'e1', kind, title: 'A source' }
            })), kind).toBeNull();
        }
        expect(evidence({ kind: 'verified' })?.code).toBe('EVENT_EVIDENCE_KIND');
        expect(evidence({ kind: undefined })?.code).toBe('EVENT_EVIDENCE_KIND');
    });

    it('refuses a URI that is not a plain public https address', () => {
        const hostile = [
            'javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd',
            'http://example.org/', 'ftp://example.org/', '//example.org/', 'example.org',
            'https://user:pass@example.org/', 'https://localhost/', 'https://127.0.0.1/',
            'https://[::1]/', 'https://10.0.0.1/', 'https://intranet/', 'https://host.local/',
            'https://host.internal/', 'https://exa mple.org/', `https://example.org/${'a'.repeat(500)}`
        ];
        for (const uri of hostile) expect(evidence({ uri })?.code, uri).toBe('EVENT_EVIDENCE_URI');
    });

    it('accepts a public https address, and none at all', () => {
        expect(evidence({ uri: 'https://en.wikipedia.org/wiki/Black_hole' })).toBeNull();
        expect(evidence({})).toBeNull();
    });

    it('refuses blank titles, oversized fields, and a malformed supported span', () => {
        expect(evidence({ title: '' })?.code).toBe('EVENT_TEXT');
        expect(evidence({ title: 'x'.repeat(201) })?.code).toBe('EVENT_TEXT');
        expect(evidence({ location: 'x'.repeat(201) })?.code).toBe('EVENT_TEXT');
        expect(evidence({ supports: { fromCharacter: 5, toCharacter: 5 } })?.code).toBe('EVENT_SPAN');
        expect(evidence({ supports: { fromCharacter: -1, toCharacter: 5 } })?.code).toBe('EVENT_SPAN');
        expect(evidence({ supports: { fromCharacter: 0, toCharacter: 5, extra: 1 } })?.code).toBe('EVENT_UNKNOWN_FIELD');
    });
});

describe('speech and control events', () => {
    it('refuses negative or non-finite speech timing', () => {
        for (const tMs of [-1, NaN, Infinity, '5']) {
            expect(refusal(base('speech.mark', 1, { segmentId: 's', charIndex: 0, tMs }))?.code, String(tMs))
                .toBe('EVENT_TIMING');
        }
        expect(refusal(base('speech.mark', 1, { segmentId: 's', charIndex: -1, tMs: 0 }))?.code).toBe('EVENT_OFFSET');
        expect(refusal(base('speech.end', 1, { segmentId: 's', durationMs: -5 }))?.code).toBe('EVENT_TIMING');
        expect(refusal(base('speech.end', 1, { segmentId: 's', durationMs: 3_600_001 }))?.code).toBe('EVENT_TIMING');
    });

    it('refuses an unknown interruption reason', () => {
        expect(refusal(base('interrupt', 1, { reason: 'admin' }))?.code).toBe('EVENT_INTERRUPT');
    });

    it('refuses an error with a non-boolean recoverable flag, or a message that is too long', () => {
        expect(refusal(base('error', 1, { code: 'X', message: 'm', recoverable: 'yes' }))?.code).toBe('EVENT_ERROR');
        expect(refusal(base('error', 1, { code: 'X', message: 'm'.repeat(501), recoverable: true }))?.code)
            .toBe('EVENT_TEXT');
    });

    it('refuses a branch with a negative position', () => {
        expect(refusal(base('branch.open', 1, { branchId: 'b', parentSegmentId: 's', atCharacter: -1 }))?.code)
            .toBe('EVENT_OFFSET');
    });
});

describe('beats streamed (additive: a segment may be one beat of a rise.current.v2)', () => {
    const beat = (body, extra = {}) => base('segment.begin', 1, { segmentId: 'beat-0', beat: body, ...extra });

    it('carries a beat’s fields as rise.current.v2 names them, and nothing else', () => {
        const full = {
            show: 'Shown, not said.', hold: { ms: 1200, maxMs: 4000 }, scene: 'disk', cue: 'set:intensity=0.7',
            transition: { ms: 300 }, place: 'caption', size: 'larger', type: 'book-serif', emphasis: ['light'], sound: 'piano'
        };
        expect(validateEvent(beat(full)).beat).toEqual(full);
        expect(validateEvent(beat({})).beat).toEqual({});
        expect(refusal(beat({ say: 'The words are the segment’s own text.' }))?.code).toBe('EVENT_UNKNOWN_FIELD');
        expect(refusal(beat({ onclick: 'x' }))?.code).toBe('EVENT_UNKNOWN_FIELD');
    });

    it('refuses a beat field of the wrong shape, with EVENT_BEAT', () => {
        for (const [name, body] of Object.entries({
            'hold without ms': { hold: {} },
            'fractional hold': { hold: { ms: 1.5 } },
            'hold with a stray key': { hold: { ms: 900, src: 'x' } },
            'blank show': { show: ' ' },
            'show with a marker': { show: 'A [PAUSE] here' },
            'numeric scene': { scene: 3 },
            'long cue': { cue: 'c'.repeat(41) },
            'cue with a space': { cue: 'two words' },
            'emphasis not a list': { emphasis: 'light' },
            'nine emphases': { emphasis: Array(9).fill('a') },
            'transition as a number': { transition: 300 },
            'place as an object': { place: { x: 1 } }
        })) {
            expect(refusal(beat(body))?.code, name).toMatch(/^EVENT_(BEAT|OBJECT|UNKNOWN_FIELD|RESERVED_TEXT)$/u);
        }
    });

    it('refuses a beat with a visual or a literal flag: a beat’s imagery is its scene', () => {
        expect(refusal(beat({}, { visual: 'attractor' }))?.code).toBe('EVENT_BEAT');
        expect(refusal(beat({}, { literal: true }))?.code).toBe('EVENT_BEAT');
    });

    it('declares a native scene by engine and params, or one whose source follows by form, never both', () => {
        expect(validateEvent(base('scene.declare', 1, { sceneId: 'disk', form: 'code' }))).toMatchObject({ sceneId: 'disk', form: 'code' });
        expect(validateEvent(base('scene.declare', 1, { sceneId: 'fig', form: 'svg' }))).toMatchObject({ form: 'svg' });
        for (const body of [
            { sceneId: 'x' },
            { sceneId: 'x', form: 'html' },
            { sceneId: 'x', engine: 'attractor', form: 'code' },
            { sceneId: 'x', form: 'code', params: {} },
            { sceneId: 'x', engine: 7 },
            { sceneId: 'x', engine: 'attractor', params: { nested: { a: 1 } } },
            { sceneId: 'x', engine: 'attractor', params: [] }
        ]) {
            expect(refusal(base('scene.declare', 1, body))?.code, JSON.stringify(body)).toMatch(/^EVENT_(SCENE|OBJECT)$/u);
        }
    });

    it('carries a scene’s source in pieces of at most 2,000 characters, which are not words', () => {
        // Source is code or markup: bars and brackets are its own, never playback markers.
        expect(validateEvent(base('scene.text', 1, { sceneId: 'disk', offset: 0, text: 'a | b [PAUSE]\n' })).text).toBe('a | b [PAUSE]\n');
        expect(validateEvent(base('scene.text', 1, { sceneId: 'disk', offset: 4, text: '\n' })).text).toBe('\n');
        expect(refusal(base('scene.text', 1, { sceneId: 'disk', offset: 0, text: 'x'.repeat(EVENT_LIMITS.sceneChunk + 1) }))?.code).toBe('EVENT_SCENE');
        expect(refusal(base('scene.text', 1, { sceneId: 'disk', offset: 0, text: '' }))?.code).toBe('EVENT_SCENE');
        expect(refusal(base('scene.text', 1, { sceneId: 'disk', offset: -1, text: 'x' }))?.code).toBe('EVENT_OFFSET');
    });

    it('keeps a piece of the largest source inside one event on the wire', () => {
        // The worst case JSON makes of a character is six bytes (\u0001).
        expect(EVENT_LIMITS.sceneChunk * 6 + 200).toBeLessThan(EVENT_LIMITS.wireBytes);
    });
});

describe('errors say where', () => {
    it('carries a code and a path', () => {
        const error = refusal(base('segment.begin', 1, { segmentId: 's', visual: 'shader' }));
        expect(error).toBeInstanceOf(LiveProtocolError);
        expect(error.code).toBe('EVENT_VISUAL');
        expect(error.path).toBe('$.visual');
    });
});

describe('an event off the wire', () => {
    it('is decoded and validated', () => {
        expect(decodeEvent(JSON.stringify(VALID['segment.end']))).toEqual(VALID['segment.end']);
    });

    it('is refused for size before it is ever parsed', () => {
        const huge = JSON.stringify({ ...VALID['segment.end'], padding: 'x'.repeat(EVENT_LIMITS.wireBytes) });
        let parsed = false;
        const original = JSON.parse;
        JSON.parse = (...args) => { parsed = true; return original(...args); };
        try {
            expect(() => decodeEvent(huge)).toThrowError(expect.objectContaining({ code: 'EVENT_TOO_LARGE' }));
        } finally {
            JSON.parse = original;
        }
        expect(parsed).toBe(false);
    });

    it('measures the wire limit in UTF-8 bytes before parsing', () => {
        const huge = JSON.stringify({ ...VALID['segment.end'], padding: '🙂'.repeat(EVENT_LIMITS.wireBytes / 4) });
        expect(huge.length).toBeLessThan(EVENT_LIMITS.wireBytes);
        let parsed = false;
        const original = JSON.parse;
        JSON.parse = (...args) => { parsed = true; return original(...args); };
        try {
            expect(() => decodeEvent(huge)).toThrowError(expect.objectContaining({ code: 'EVENT_TOO_LARGE' }));
        } finally {
            JSON.parse = original;
        }
        expect(parsed).toBe(false);
    });

    it('is refused when it is not JSON, or not a string at all', () => {
        expect(() => decodeEvent('{nope')).toThrowError(expect.objectContaining({ code: 'EVENT_JSON' }));
        expect(() => decodeEvent(undefined)).toThrowError(expect.objectContaining({ code: 'EVENT_JSON' }));
        expect(() => decodeEvent({})).toThrowError(expect.objectContaining({ code: 'EVENT_JSON' }));
    });

    it('is refused with a prototype key in it', () => {
        expect(() => decodeEvent(`{"__proto__":{"x":1},"schema":"${RISE_CURRENT_EVENTS_SCHEMA}"}`))
            .toThrowError(expect.objectContaining({ code: 'EVENT_UNKNOWN_FIELD' }));
    });
});

describe('random garbage', () => {
    // A tiny deterministic generator, so a failure is reproducible from its seed.
    const random = seed => () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 2 ** 32;
    };

    it('either validates cleanly or fails with a protocol error, and never throws anything else', () => {
        const next = random(20260929);
        // The real schema and real type names are in the pool, so a good share of
        // these reach the per-type checks rather than stopping at the envelope.
        const pieces = [null, undefined, true, 0, 1, -1, 1.5, NaN, Infinity, '', ' ', 'x', 'a1', 'segment.end',
            'segment.text', 'state.set', 'evidence.add', 'interrupt', RISE_CURRENT_EVENTS_SCHEMA, 'attractor',
            '__proto__', [], [1], {}, { a: 1 }, { tension: 0.5 }, { tension: 7 }, () => 1, Symbol('s'), 10n];
        let valid = 0;
        let refused = 0;
        for (let round = 0; round < 6000; round += 1) {
            const event = {};
            for (const key of ['schema', 'currentId', 'seq', 'type', 'segmentId', 'offset', 'text', 'state',
                'evidence', 'visual', 'reason', 'x']) {
                if (next() < 0.55) event[key] = pieces[Math.floor(next() * pieces.length)];
            }
            try {
                const clean = validateEvent(event);
                expect(Object.isFrozen(clean)).toBe(true);
                valid += 1;
            } catch (caught) {
                expect(caught, JSON.stringify(Object.keys(event))).toBeInstanceOf(LiveProtocolError);
                refused += 1;
            }
        }
        expect(refused).toBeGreaterThan(5000);
        expect(valid + refused).toBe(6000);
    });
});

describe('the interjection’s ending (stage 4.5)', () => {
    it('may name how a held reading goes on when an answer completes', () => {
        for (const ending of ['resume', 'replace', 'end']) {
            expect(validateEvent(base('current.complete', 3, { ending }))).toMatchObject({ type: 'current.complete', ending });
        }
        expect(validateEvent(base('current.complete', 3))).not.toHaveProperty('ending');
    });

    it('names one of three, and nothing else', () => {
        for (const ending of ['stop', '', 'RESUME', 1, null, { then: 'resume' }]) {
            expect(refusal(base('current.complete', 3, { ending }))).toMatchObject({ code: 'EVENT_ENDING', path: '$.ending' });
        }
    });
});
