/**
 * A model's words into events, however it sends them.
 *
 * Held here: the well-formed case becomes exactly the passages written; the
 * result does not depend on how the words were cut into deltas; everything the
 * format does not name is dropped and nothing is guessed; the playback markers
 * are neutralised even when split across deltas; limits are respected by
 * ending and dropping, not by producing what the reducer would refuse; and
 * whatever garbage arrives, the reducer accepts every event that is sent.
 */
import { describe, expect, it } from 'vitest';
import { createEventWriter } from '../adapter.js';
import { createCurrentStream, STREAM_LIMITS } from '../stream.js';
import { createSegmentParser, neutralise, PARSER_LIMITS } from './segment-parser.js';

/** Feed deltas through a parser into a real reducer; return what the reducer holds. */
function run(deltas, { seed } = {}) {
    const writer = createEventWriter('parse-1');
    const stream = createCurrentStream();
    stream.apply(writer.next('current.open', { title: 'Parsed', origin: { kind: 'model', name: 'Test', provider: 'test' } }));
    const sent = [];
    const parser = createSegmentParser((type, body) => {
        const event = writer.next(type, body);
        sent.push(event);
        stream.apply(event);
    });
    for (const delta of deltas) parser.push(delta);
    parser.finish();
    const view = stream.snapshot();
    return { view, sent, refusals: view.refusals, passages: view.segments.map(s => ({ id: s.id, text: s.text, ended: s.ended, visual: s.visual, state: s.state })) };
}

const ANSWER = [
    '@passage visual=attractor motionEnergy=0.4 solemnity=0.6',
    'A black hole is a region of space',
    'where gravity is so strong.',
    '@end',
    '@passage visual=still',
    'Its boundary is the event horizon.',
    '@end',
    ''
].join('\n');

const EXPECTED = [
    { id: 'p1', text: 'A black hole is a region of space where gravity is so strong.', ended: true, visual: 'attractor', state: { motionEnergy: 0.4, solemnity: 0.6 } },
    { id: 'p2', text: 'Its boundary is the event horizon.', ended: true, visual: 'still', state: {} }
];

describe('a well-formed answer', () => {
    it('becomes the passages written, with their visuals and conditions', () => {
        const { passages, refusals } = run([ANSWER]);
        expect(passages).toEqual(EXPECTED);
        expect(refusals).toBe(0);
    });

    it('begins a passage only when it has words, and sends chunks the protocol allows', () => {
        const { sent } = run([ANSWER]);
        const types = sent.map(e => e.type);
        // A passage's words are gathered, and sent in as few chunks as the protocol allows.
        expect(types.slice(0, 4)).toEqual(['segment.begin', 'state.set', 'segment.text', 'segment.end']);
        for (const event of sent.filter(e => e.type === 'segment.text')) {
            expect(event.text.trim()).not.toBe('');
            expect(event.text.length).toBeLessThanOrEqual(1000);
        }
    });
});

describe('however it is cut into deltas', () => {
    it('gives the same passages when cut at every single position', () => {
        for (let at = 0; at <= ANSWER.length; at += 1) {
            const { passages, refusals } = run([ANSWER.slice(0, at), ANSWER.slice(at)]);
            expect(passages, `cut at ${at}`).toEqual(EXPECTED);
            expect(refusals, `cut at ${at}`).toBe(0);
        }
    });

    it('gives the same passages one character at a time, and in random pieces', () => {
        expect(run([...ANSWER]).passages).toEqual(EXPECTED);
        let seed = 12345;
        const next = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
        for (let round = 0; round < 60; round += 1) {
            const pieces = [];
            for (let i = 0; i < ANSWER.length;) {
                const size = 1 + Math.floor(next() * 12);
                pieces.push(ANSWER.slice(i, i + size));
                i += size;
            }
            expect(run(pieces).passages, `round ${round}`).toEqual(EXPECTED);
        }
    });

    it('does not send a blank chunk when a delta is only whitespace', () => {
        const { sent, passages, refusals } = run(['@passage', '\n', 'one', ' ', '\n', ' ', 'two', '\n', '\n', ' ', '\n', '@end\n']);
        expect(refusals).toBe(0);
        expect(passages[0].text).toBe('one two');
        expect(sent.filter(e => e.type === 'segment.text').every(e => e.text.trim() !== '')).toBe(true);
    });

    it('does not begin a header that is cut off in the middle of its name', () => {
        expect(run(['@pass', 'age visual=still\nHello', ' there\n@e', 'nd\n']).passages).toEqual([
            { id: 'p1', text: 'Hello there', ended: true, visual: 'still', state: {} }
        ]);
    });
});

describe('the playback markers', () => {
    it('are neutralised, and the reducer refuses nothing', () => {
        const { passages, refusals } = run(['@passage\nA | B [PAUSE] C [flash] D [HOLD] E  F\n@end\n']);
        expect(refusals).toBe(0);
        expect(passages[0].text).toBe('A / B (PAUSE) C (flash) D (HOLD) E F');
    });

    it('are neutralised when split across deltas', () => {
        for (const cut of ['[', '[P', '[PA', '[PAU', '[PAUS', '[PAUSE', '[PAUSE]']) {
            const marker = '[PAUSE]';
            const { passages, refusals } = run(['@passage\nbefore ' + cut, marker.slice(cut.length) + ' after\n@end\n']);
            expect(refusals, cut).toBe(0);
            expect(passages[0].text, cut).not.toMatch(/\[(PAUSE|FLASH|HOLD)\]/iu);
        }
    });

    it('neutralise is idempotent and leaves ordinary text alone', () => {
        const text = 'Nothing to change here: [brackets] and (parens) and slashes / are fine.';
        expect(neutralise(text)).toBe(text);
        const dirty = 'a|b [PAUSE] ';
        expect(neutralise(neutralise(dirty))).toBe(neutralise(dirty));
    });
});

describe('what the format does not name is dropped', () => {
    it('ignores unknown keys, unknown visuals, out-of-range and hostile values', () => {
        const { passages, refusals } = run([[
            '@passage visual=hologram motionEnergy=7 tension=-1 warmth=abc __proto__=1 constructor=2 solemnity=0.5 extra=1',
            'Words.',
            '@end', ''
        ].join('\n')]);
        expect(refusals).toBe(0);
        expect(passages[0]).toMatchObject({ visual: 'still', state: { solemnity: 0.5 } });
        expect(Object.keys(passages[0].state)).toEqual(['solemnity']);
        expect({}.polluted).toBeUndefined();
    });

    it('ignores a directive that is not part of the format, and treats a mid-line @ as words', () => {
        const { passages } = run(['@passage\n@evidence uri=https://example.org\nEmail me @ home\n@end\n']);
        expect(passages[0].text).toBe('Email me @ home');
    });

    it('turns words before any header into one plain passage, and loses nothing', () => {
        const { passages } = run(['Just some words.\nAnd more.\n']);
        expect(passages).toEqual([{ id: 'p1', text: 'Just some words. And more.', ended: true, visual: 'still', state: {} }]);
    });

    it('sends nothing for a passage with no words, and ends an unfinished passage when the answer stops', () => {
        expect(run(['@passage visual=attractor\n@end\n@passage\n@end\n']).passages).toEqual([]);
        expect(run(['@passage\nUnfinished words']).passages).toEqual([
            { id: 'p1', text: 'Unfinished words', ended: true, visual: 'still', state: {} }
        ]);
    });

    it('never carries evidence or a Dive: whatever the model says about sources is not evidence', () => {
        const { sent } = run(['@passage\nSee doi 10.1234/x.\n@source title=Paper uri=https://doi.org/10.1/x\n@end\n']);
        expect(sent.some(e => e.type === 'evidence.add' || e.type === 'dive.attach')).toBe(false);
    });
});

describe('the limits', () => {
    it('drops passages past the limit, and the reducer refuses nothing', () => {
        const many = Array.from({ length: PARSER_LIMITS.passages + 6 }, (_, i) => `@passage\nPassage ${i} here.\n@end\n`).join('');
        const { passages, refusals } = run([many]);
        expect(passages).toHaveLength(PARSER_LIMITS.passages);
        expect(refusals).toBe(0);
    });

    it('ends a passage that reaches its length limit where it is, and drops the rest of it', () => {
        const long = 'word '.repeat(2_000);
        const { passages, refusals } = run([`@passage\n${long}\n@end\n@passage\nAfter it.\n@end\n`]);
        expect(refusals).toBe(0);
        expect(passages[0].text.length).toBeLessThanOrEqual(STREAM_LIMITS.segmentText);
        expect(passages[0].ended).toBe(true);
        expect(passages[1].text).toBe('After it.');
    });

    it('respects the total limit across passages', () => {
        const big = Array.from({ length: 10 }, () => `@passage\n${'word '.repeat(900)}\n@end\n`).join('');
        const { passages, refusals } = run([big]);
        expect(refusals).toBe(0);
        expect(passages.reduce((sum, p) => sum + p.text.length, 0)).toBeLessThanOrEqual(STREAM_LIMITS.totalText);
    });

    it('does nothing after it has finished', () => {
        const writer = createEventWriter('x');
        const sent = [];
        const parser = createSegmentParser((type, body) => sent.push([type, body]));
        parser.push('@passage\nHi\n');
        parser.finish();
        const count = sent.length;
        parser.push('more words');
        parser.finish();
        expect(sent).toHaveLength(count);
        expect(writer.nextSeq).toBe(0);
    });
});

describe('letting go', () => {
    it('leaves the passage it was writing open, never ended, so half a sentence is never read', () => {
        const writer = createEventWriter('x');
        const stream = createCurrentStream();
        stream.apply(writer.next('current.open', { title: 'T', origin: { kind: 'model', name: 'T', provider: 't' } }));
        const sent = [];
        const parser = createSegmentParser((type, body) => { sent.push(type); stream.apply(writer.next(type, body)); });
        parser.push('@passage\nA whole one.\n@end\n@passage\nHalf a sent');
        parser.abandon();
        parser.push('ence that never ends.\n@end\n');
        parser.finish();
        const view = stream.snapshot();
        expect(view.segments.map(s => [s.id, s.ended])).toEqual([['p1', true], ['p2', false]]);
        expect(stream.toCurrent().segments.map(s => s.text)).toEqual(['A whole one.']);
        expect(sent.filter(type => type === 'segment.end')).toHaveLength(1);
    });
});

describe('whatever arrives', () => {
    it('never produces an event the reducer refuses, for random garbage in random pieces', () => {
        const alphabet = ['@', '\n', '\r', ' ', '|', '[', ']', 'P', 'A', 'U', 'S', 'E', 'passage', 'end', 'visual=', 'still', 'attractor', 'genesis',
            'motionEnergy=0.5', '=', '', '\u0000', ' ', 'x', 'word', '<b>', '{', '}', '__proto__', '0.1', '9'];
        let seed = 987654321;
        const next = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
        for (let round = 0; round < 400; round += 1) {
            let input = '';
            const length = 1 + Math.floor(next() * 200);
            for (let i = 0; i < length; i += 1) input += alphabet[Math.floor(next() * alphabet.length)];
            const pieces = [];
            for (let i = 0; i < input.length;) {
                const size = 1 + Math.floor(next() * 9);
                pieces.push(input.slice(i, i + size));
                i += size;
            }
            const { refusals, view } = run(pieces);
            expect(refusals, JSON.stringify(input)).toBe(0);
            expect(view.phase, JSON.stringify(input)).not.toBe('failed');
            for (const segment of view.segments) {
                expect(segment.text.trim(), JSON.stringify(input)).not.toBe('');
                expect(segment.text).not.toMatch(/[|]|\[(PAUSE|FLASH|HOLD)\]/iu);
            }
        }
    });

    it('gives the same passages for the same text however random garbage is cut', () => {
        const text = '@passage visual=genesis warmth=0.2\nsome | words\n@end\nloose [HOLD] words @ end\n@passage\nmore\n';
        const whole = run([text]).passages;
        let seed = 42;
        const next = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
        for (let round = 0; round < 100; round += 1) {
            const pieces = [];
            for (let i = 0; i < text.length;) {
                const size = 1 + Math.floor(next() * 7);
                pieces.push(text.slice(i, i + size));
                i += size;
            }
            expect(run(pieces).passages, `round ${round}`).toEqual(whole);
        }
    });
});
