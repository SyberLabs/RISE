/**
 * Literal text, through the live layer.
 *
 * The strict refusal of `|`, `[PAUSE]` and the rest is not weakened: an
 * ordinary segment is refused exactly as before. A segment that says, once,
 * when it begins, that it is literal may carry them as words; every chunk must
 * agree; the score cut and the escape's stand-ins are refused either way; and
 * what the reducer holds lowers to a sealed literal segment that the Player
 * shows as written, with no pause, flash or hold made of it.
 */
import { describe, expect, it } from 'vitest';
import { compileRiseCurrent } from '../core/rise-current.js';
import { LITERAL_BRACKET, LITERAL_PIPE, SOURCE_SCORE_CUT } from '../core/chunker.js';
import { createEventWriter } from './adapter.js';
import { currentToEvents } from './adapters/current-events.js';
import { createSegmentParser } from './adapters/segment-parser.js';
import { LiveProtocolError, validateEvent } from './protocol.js';
import { createCurrentStream } from './stream.js';

const ORIGIN = { kind: 'model', name: 'Test', provider: 'test' };
const WORDS = 'To pause write [PAUSE]. To split write a | b. Neither is an instruction here.';

function open() {
    const writer = createEventWriter('lit-1');
    const stream = createCurrentStream({ refusals: 1_000 });
    stream.apply(writer.next('current.open', { title: 'Literal', origin: ORIGIN }));
    return { writer, stream };
}

const codeOf = fn => { try { fn(); return null; } catch (error) { return error instanceof LiveProtocolError ? error.code : error; } };

describe('the protocol', () => {
    const event = (type, body) => ({ schema: 'rise.current-events.v1', currentId: 'c', seq: 1, type, ...body });

    it('refuses bars and marker words in an ordinary chunk, exactly as before', () => {
        for (const text of ['a | b', 'a [PAUSE] b', 'a [flash] b', 'a [Hold] b']) {
            expect(codeOf(() => validateEvent(event('segment.text', { segmentId: 's', offset: 0, text }))), text).toBe('EVENT_RESERVED_TEXT');
            expect(codeOf(() => validateEvent(event('segment.text', { segmentId: 's', offset: 0, text, literal: false }))), `${text} (false)`).toBe('EVENT_RESERVED_TEXT');
        }
    });

    it('takes them in a chunk that says it is literal', () => {
        const clean = validateEvent(event('segment.text', { segmentId: 's', offset: 0, text: WORDS, literal: true }));
        expect(clean.text).toBe(WORDS);
        expect(clean.literal).toBe(true);
    });

    it('still refuses the score cut and the stand-ins in a literal chunk, and in an ordinary one', () => {
        for (const bad of [`a${SOURCE_SCORE_CUT}b`, `a${LITERAL_PIPE}b`, `a${LITERAL_BRACKET}b`]) {
            expect(codeOf(() => validateEvent(event('segment.text', { segmentId: 's', offset: 0, text: bad, literal: true }))), JSON.stringify(bad)).toBe('EVENT_RESERVED_TEXT');
        }
        expect(codeOf(() => validateEvent(event('segment.text', { segmentId: 's', offset: 0, text: `a${SOURCE_SCORE_CUT}b` })))).toBe('EVENT_RESERVED_TEXT');
    });

    it('takes literal on a beginning too, says nothing when it is false, and refuses one that is not a boolean', () => {
        expect(validateEvent(event('segment.begin', { segmentId: 's', literal: true })).literal).toBe(true);
        expect(validateEvent(event('segment.begin', { segmentId: 's', literal: false }))).not.toHaveProperty('literal');
        expect(validateEvent(event('segment.begin', { segmentId: 's' }))).not.toHaveProperty('literal');
        for (const bad of ['yes', 1, 'true', null, {}, []]) {
            expect(codeOf(() => validateEvent(event('segment.begin', { segmentId: 's', literal: bad }))), String(bad)).toBe('EVENT_LITERAL');
            expect(codeOf(() => validateEvent(event('segment.text', { segmentId: 's', offset: 0, text: 'ok', literal: bad }))), String(bad)).toBe('EVENT_LITERAL');
        }
    });

    it('does not let literal be smuggled in on any other event', () => {
        for (const type of ['segment.end', 'state.set', 'current.complete']) {
            const body = type === 'state.set' ? { segmentId: 's', state: {}, literal: true } : type === 'segment.end' ? { segmentId: 's', literal: true } : { literal: true };
            expect(codeOf(() => validateEvent(event(type, body))), type).toBe('EVENT_UNKNOWN_FIELD');
        }
    });
});

describe('the reducer', () => {
    it('holds a literal segment whose words are bars and marker words, and refuses the same in an ordinary one', () => {
        const { writer, stream } = open();
        stream.apply(writer.next('segment.begin', { segmentId: 'lit', literal: true }));
        expect(stream.apply(writer.next('segment.text', { segmentId: 'lit', offset: 0, text: WORDS, literal: true })).status).toBe('applied');
        stream.apply(writer.next('segment.end', { segmentId: 'lit' }));

        stream.apply(writer.next('segment.begin', { segmentId: 'plain' }));
        const refused = stream.apply(writer.next('segment.text', { segmentId: 'plain', offset: 0, text: 'a | b' }));
        expect(refused.status).toBe('refused');
        const view = stream.snapshot();
        expect(view.segments[0]).toMatchObject({ id: 'lit', text: WORDS, literal: true });
        expect(view.segments[1].literal).toBeUndefined();
    });

    it('catches a marker split across two literal chunks as words too, and across two ordinary chunks as a marker', () => {
        const { writer, stream } = open();
        stream.apply(writer.next('segment.begin', { segmentId: 'lit', literal: true }));
        stream.apply(writer.next('segment.text', { segmentId: 'lit', offset: 0, text: 'press [PAU', literal: true }));
        expect(stream.apply(writer.next('segment.text', { segmentId: 'lit', offset: 10, text: 'SE] now', literal: true })).status).toBe('applied');
        stream.apply(writer.next('segment.begin', { segmentId: 'plain' }));
        stream.apply(writer.next('segment.text', { segmentId: 'plain', offset: 0, text: 'press [PAU' }));
        expect(stream.apply(writer.next('segment.text', { segmentId: 'plain', offset: 10, text: 'SE] now' })).status).toBe('refused');
    });

    it('refuses a chunk that disagrees with its segment about being literal, either way', () => {
        const { writer, stream } = open();
        stream.apply(writer.next('segment.begin', { segmentId: 'a', literal: true }));
        const notLiteral = stream.apply(writer.next('segment.text', { segmentId: 'a', offset: 0, text: 'words' }));
        expect(notLiteral).toMatchObject({ status: 'refused', code: 'LITERAL_MISMATCH' });
        const other = open();
        other.stream.apply(other.writer.next('segment.begin', { segmentId: 'b' }));
        const literal = other.stream.apply(other.writer.next('segment.text', { segmentId: 'b', offset: 0, text: 'words', literal: true }));
        expect(literal).toMatchObject({ status: 'refused', code: 'LITERAL_MISMATCH' });
    });

    it('lowers to a sealed literal segment, and only that one is literal', () => {
        const { writer, stream } = open();
        stream.apply(writer.next('segment.begin', { segmentId: 'lit', literal: true }));
        stream.apply(writer.next('segment.text', { segmentId: 'lit', offset: 0, text: WORDS, literal: true }));
        stream.apply(writer.next('segment.end', { segmentId: 'lit' }));
        stream.apply(writer.next('segment.begin', { segmentId: 'plain' }));
        stream.apply(writer.next('segment.text', { segmentId: 'plain', offset: 0, text: 'Plain words here.' }));
        stream.apply(writer.next('segment.end', { segmentId: 'plain' }));
        const sealed = stream.toCurrent();
        expect(sealed.segments[0].literal).toBe(true);
        expect(sealed.segments[1]).not.toHaveProperty('literal');
        const session = compileRiseCurrent(sealed);
        const shown = session.atoms.map(atom => atom.content).join(' ');
        expect(shown).toContain('[PAUSE]');
        expect(shown).toContain('a | b');
        expect(session.atoms.flatMap(atom => atom.tags).map(String)).not.toContain('PAUSE');
    });

    it('keeps each lowering a prefix of the next when a literal segment is followed by more', () => {
        const { writer, stream } = open();
        const lowerings = [];
        for (const [id, text, literal] of [['one', WORDS, true], ['two', 'Then plain words follow.', false], ['three', 'And a | b again.', true]]) {
            stream.apply(writer.next('segment.begin', { segmentId: id, ...(literal ? { literal: true } : {}) }));
            stream.apply(writer.next('segment.text', { segmentId: id, offset: 0, text, ...(literal ? { literal: true } : {}) }));
            stream.apply(writer.next('segment.end', { segmentId: id }));
            lowerings.push(compileRiseCurrent(stream.toCurrent()).atoms);
        }
        for (let i = 1; i < lowerings.length; i += 1) {
            const before = lowerings[i - 1];
            for (let j = 0; j < before.length; j += 1) {
                expect(lowerings[i][j].content).toBe(before[j].content);
                expect(lowerings[i][j].duration).toBe(before[j].duration);
                expect(lowerings[i][j].sourceId).toBe(before[j].sourceId);
            }
        }
    });
});

function parse(deltas) {
    const { writer, stream } = open();
    const parser = createSegmentParser((type, body) => { stream.apply(writer.next(type, body)); });
    for (const delta of deltas) parser.push(delta);
    parser.finish();
    const view = stream.snapshot();
    return { view, refusals: view.refusals, texts: view.segments.map(s => [s.id, s.text, s.literal === true]) };
}

describe('a model that says a passage is literal', () => {
    const answer = '@passage visual=still literal=yes\nWrite a | b, or [PAUSE], to show them.\n@end\n@passage\nOrdinary | words [PAUSE] here.\n@end\n';

    it('keeps its bars and marker words, and neutralises the same in a passage that does not say so', () => {
        const { texts, refusals } = parse([answer]);
        expect(refusals).toBe(0);
        expect(texts).toEqual([
            ['p1', 'Write a | b, or [PAUSE], to show them.', true],
            ['p2', 'Ordinary / words (PAUSE) here.', false]
        ]);
    });

    it('is the same however the words are cut, at every position and in random pieces', () => {
        const whole = parse([answer]).texts;
        for (let at = 0; at <= answer.length; at += 1) expect(parse([answer.slice(0, at), answer.slice(at)]).texts, `cut at ${at}`).toEqual(whole);
        expect(parse([...answer]).texts).toEqual(whole);
        let seed = 7;
        const next = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
        for (let round = 0; round < 60; round += 1) {
            const pieces = [];
            for (let i = 0; i < answer.length;) { const size = 1 + Math.floor(next() * 9); pieces.push(answer.slice(i, i + size)); i += size; }
            expect(parse(pieces).texts, `round ${round}`).toEqual(whole);
        }
    });

    it('does not hold back the start of a marker in a literal passage: its markers are words', () => {
        const { texts } = parse(['@passage literal=yes\nend with [PAU', 'SE] and more\n@end\n']);
        expect(texts[0][1]).toBe('end with [PAUSE] and more');
    });

    it('takes only literal=yes, and ignores every other value, so a passage is literal only when it clearly says so', () => {
        for (const value of ['no', 'true', '1', 'YES', 'Yes', 'y', 'literal', 'yes;', '']) {
            const { texts } = parse([`@passage literal=${value}\nA | B\n@end\n`]);
            expect(texts[0], value).toEqual(['p1', 'A / B', false]);
        }
    });

    it('still removes the score cut and the stand-ins from a literal passage, so the reducer refuses nothing', () => {
        const { texts, refusals } = parse([`@passage literal=yes\nA${SOURCE_SCORE_CUT}B ${LITERAL_PIPE}C${LITERAL_BRACKET} D | E\n@end\n`]);
        expect(refusals).toBe(0);
        expect(texts[0][1]).toBe('AB C D | E');
    });

    it('never produces an event the reducer refuses, for random text with literal headers, in random pieces', () => {
        const alphabet = ['@passage', ' literal=yes', ' visual=still', '\n', '@end', '|', '[PAUSE]', '[flash]', '[', ']', 'word', ' ', SOURCE_SCORE_CUT, LITERAL_PIPE, LITERAL_BRACKET, '\r', 'x'];
        let seed = 99;
        const next = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
        for (let round = 0; round < 400; round += 1) {
            let input = '';
            for (let i = 0, n = 1 + Math.floor(next() * 80); i < n; i += 1) input += alphabet[Math.floor(next() * alphabet.length)];
            const pieces = [];
            for (let i = 0; i < input.length;) { const size = 1 + Math.floor(next() * 7); pieces.push(input.slice(i, i + size)); i += size; }
            const { refusals, view } = parse(pieces);
            expect(refusals, JSON.stringify(input)).toBe(0);
            expect(view.phase, JSON.stringify(input)).not.toBe('failed');
        }
    });
});

describe('an answer that arrives whole, from a host', () => {
    const sealed = literal => ({
        schema: 'rise.current.v1', id: 'whole', title: 'Whole', origin: { kind: 'human', name: 'Tester' },
        segments: [{ id: 's', text: WORDS, ...(literal ? { literal: true } : {}) }]
    });

    it('becomes events that carry literal, and the reducer holds it as written', () => {
        const writer = createEventWriter('c');
        const stream = createCurrentStream();
        const events = currentToEvents(sealed(true));
        expect(events.find(item => item.type === 'segment.begin').body.literal).toBe(true);
        for (const item of events.filter(entry => entry.type === 'segment.text')) expect(item.body.literal).toBe(true);
        for (const { type, body } of events) stream.apply(writer.next(type, body));
        const view = stream.snapshot();
        expect(view.refusals).toBe(0);
        expect(view.segments[0].text).toBe(WORDS);
        expect(view.phase).toBe('complete');
    });

    it('is refused whole, before any event, if the same words are not marked literal', () => {
        expect(() => currentToEvents(sealed(false))).toThrow(/reserved playback marker/u);
    });

    it('says nothing about literal for an ordinary Current, so its events are what they always were', () => {
        const plain = currentToEvents({ ...sealed(false), segments: [{ id: 's', text: 'Plain words.' }] });
        for (const item of plain) expect(item.body).not.toHaveProperty('literal');
    });
});
