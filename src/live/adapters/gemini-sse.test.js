/**
 * The server-sent-events parser under Google's streaming answer.
 *
 * What is held: an event is the same however the bytes arrive (every cut of a
 * transcript, and one character at a time); all three line endings work, even
 * when a CRLF is split between two chunks; a field that is not data is ignored;
 * an oversize line or event is dropped and the parser goes on, and what it holds
 * is bounded whatever it is fed; and nothing it is fed can make it throw.
 */
import { describe, expect, it } from 'vitest';
import { createSseParser, SSE_LIMITS } from './gemini-sse.js';

function parse(chunks, options) {
    const seen = [];
    const parser = createSseParser({ onData: data => seen.push(data), ...options });
    for (const chunk of chunks) parser.feed(chunk);
    parser.end();
    return seen;
}

const TRANSCRIPT = 'data: {"a":1}\r\n\r\n: keep-alive\r\n\r\nevent: x\rdata: line one\rdata: line two\r\r\ndata:no-space\n\ndata:  two spaces\n\n';
const EXPECTED = ['{"a":1}', 'line one\nline two', 'no-space', ' two spaces'];

describe('what an event is', () => {
    it('is the data of a block of lines that ends with a blank line', () => {
        expect(parse(['data: a\n\ndata: b\n\n'])).toEqual(['a', 'b']);
    });

    it('reads all three line endings, and the same events from each', () => {
        for (const ending of ['\n', '\r\n', '\r']) {
            expect(parse([`data: a${ending}${ending}data: b${ending}data: c${ending}${ending}`]), JSON.stringify(ending)).toEqual(['a', 'b\nc']);
        }
    });

    it('takes one leading space off a value and no more', () => {
        expect(parse(['data:x\n\ndata: x\n\ndata:  x\n\ndata:\n\ndata: \n\n'])).toEqual(['x', 'x', ' x', '', '']);
    });

    it('joins several data lines with a newline', () => {
        expect(parse(['data: a\ndata: b\ndata: c\n\n'])).toEqual(['a\nb\nc']);
    });

    it('ignores comments, other fields, and lines with no field, and does not dispatch an event with no data', () => {
        expect(parse([': hello\n\nevent: ping\nid: 7\nretry: 100\n\nnonsense\n\n:\n\ndata: kept\n\n'])).toEqual(['kept']);
    });

    it('ignores a byte order mark at the start of the stream', () => {
        expect(parse(['\uFEFFdata: a\n\n'])).toEqual(['a']);
    });

    it('gives the whole transcript', () => {
        expect(parse([TRANSCRIPT])).toEqual(EXPECTED);
    });
});

describe('however the bytes are cut', () => {
    it('gives the same events for every single cut, and for one character at a time', () => {
        for (let cut = 0; cut <= TRANSCRIPT.length; cut += 1) {
            expect(parse([TRANSCRIPT.slice(0, cut), TRANSCRIPT.slice(cut)]), `cut at ${cut}`).toEqual(EXPECTED);
        }
        expect(parse([...TRANSCRIPT])).toEqual(EXPECTED);
    });

    it('gives the same events for every pair of cuts', () => {
        for (let a = 0; a <= TRANSCRIPT.length; a += 1) {
            for (let b = a; b <= TRANSCRIPT.length; b += 1) {
                expect(parse([TRANSCRIPT.slice(0, a), TRANSCRIPT.slice(a, b), TRANSCRIPT.slice(b)]), `cuts at ${a}, ${b}`).toEqual(EXPECTED);
            }
        }
    });

    it('does not make an extra blank line of a CRLF split between two chunks', () => {
        expect(parse(['data: a\r', '\ndata: b\r\n\r', '\n'])).toEqual(['a\nb']);
    });

    it('gives the same events for seeded random transcripts cut at random', () => {
        let seed = 20260930;
        const next = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
        const endings = ['\n', '\r\n', '\r'];
        for (let round = 0; round < 300; round += 1) {
            let text = '';
            const expected = [];
            for (let events = 0; events < 1 + Math.floor(next() * 5); events += 1) {
                const lines = [];
                for (let l = 0; l < 1 + Math.floor(next() * 3); l += 1) lines.push(`${Math.floor(next() * 1e6).toString(36)}${next() < 0.3 ? ' ünï ' : ''}`);
                if (next() < 0.3) text += `: comment${endings[Math.floor(next() * 3)]}`;
                let last = '\n';
                for (const line of lines) {
                    last = endings[Math.floor(next() * 3)];
                    text += `data: ${line}${last}`;
                }
                // The blank line repeats the last ending: a CR then an LF would be one CRLF, and no blank line at all.
                text += last;
                expected.push(lines.join('\n'));
            }
            const chunks = [];
            for (let at = 0; at < text.length;) { const size = 1 + Math.floor(next() * 9); chunks.push(text.slice(at, at + size)); at += size; }
            expect(parse(chunks), `round ${round}`).toEqual(expected);
        }
    });
});

describe('the end of the stream', () => {
    it('dispatches an event whose lines were complete but whose blank line never came, since the answer is checked as JSON afterwards', () => {
        expect(parse(['data: {"x":1}\n'])).toEqual(['{"x":1}']);
        expect(parse(['data: {"x":1}'])).toEqual(['{"x":1}']);
    });

    it('hears nothing after the end, and can be ended twice', () => {
        const seen = [];
        const parser = createSseParser({ onData: data => seen.push(data) });
        parser.feed('data: a\n\n');
        parser.end();
        parser.feed('data: b\n\n');
        parser.end();
        expect(seen).toEqual(['a']);
    });
});

describe('what it will not hold', () => {
    it('drops a line longer than the limit and carries on with the next event', () => {
        const long = `data: ${'x'.repeat(SSE_LIMITS.line + 10)}\n\n`;
        expect(parse([`data: before\n\n${long}data: after\n\n`])).toEqual(['before', 'after']);
        expect(parse([`data: before\n\n`, long.slice(0, 1000), long.slice(1000), 'data: after\n\n'])).toEqual(['before', 'after']);
    });

    it('drops the whole event, not just the line, when one of its lines was too long', () => {
        const long = `data: ${'x'.repeat(SSE_LIMITS.line + 10)}\n`;
        expect(parse([`data: keep-me\n${long}data: and-me\n\ndata: next\n\n`])).toEqual(['next']);
        expect(parse([`data: keep-me\n${long.slice(0, 40_000)}`, `${long.slice(40_000)}data: and-me\n\ndata: next\n\n`])).toEqual(['next']);
    });

    it('drops an event whose data together is longer than the limit, and carries on', () => {
        const piece = 'y'.repeat(SSE_LIMITS.line - 20);
        const lines = Array.from({ length: Math.ceil(SSE_LIMITS.event / piece.length) + 1 }, () => `data: ${piece}\n`).join('');
        expect(parse([`${lines}\ndata: after\n\n`])).toEqual(['after']);
    });

    it('holds no more than a line and an event however much it is fed without a line ending', () => {
        const parser = createSseParser({ onData: () => {} });
        for (let i = 0; i < 200; i += 1) parser.feed('z'.repeat(50_000));
        expect(parser.pending()).toBeLessThanOrEqual(SSE_LIMITS.line + SSE_LIMITS.event);
        parser.feed('\n\ndata: still works\n\n');
        parser.end();
    });

    it('takes limits that are told to it', () => {
        expect(parse(['data: 12345\n\ndata: 123\n\n'], { maxLine: 12 })).toEqual(['12345', '123']);
        expect(parse(['data: 123456789\n\ndata: 123\n\n'], { maxLine: 12 })).toEqual(['123']);
        expect(parse(['data: 12345\ndata: 12345\n\ndata: 123\n\n'], { maxEvent: 10 })).toEqual(['123']);
    });
});

describe('anything at all', () => {
    it('never throws, whatever it is fed, and reads only strings', () => {
        const parser = createSseParser({ onData: () => {} });
        for (const junk of [undefined, null, 5, {}, [], Symbol.iterator, () => 1, '\u0000\u0007', '\ud800', 'data', 'data:', ':', '\r', '\n', '\r\r\r', 'data: \u2028\n\n', '__proto__: x\n\n', 'data: '.repeat(10_000)]) {
            expect(() => parser.feed(junk), String(junk)).not.toThrow();
        }
        expect(() => parser.end()).not.toThrow();
    });

    it('does not hand over an event that is not a string', () => {
        const seen = [];
        const parser = createSseParser({ onData: data => seen.push(data) });
        parser.feed('data: a\n\n');
        parser.end();
        expect(seen.every(item => typeof item === 'string')).toBe(true);
    });
});
