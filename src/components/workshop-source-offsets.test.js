/**
 * A passage span is a pair of character offsets into the source text, and the
 * offsets are read off the rendered text. So the string the Workshop stores
 * and the string the DOM shows must be the same string.
 *
 * They were not. The HTML parser turns CRLF and lone CR into LF, so an
 * imported .txt file — which carries CRLF as a matter of course — left every
 * selection past the first line stored short by the number of carriage
 * returns before it. The highlight landed somewhere the reader had not
 * chosen, and "Replace overlap" then cleared passages that did not overlap.
 */
import { describe, expect, it } from 'vitest';

const CRLF = 'Elon Musk, famously a man with big ideas.\r\n\r\n'
    + 'Musk on Saturday announced what he calls the "Terafab".\r\n\r\n'
    + 'In a half-hour presentation, Musk outlined his rationale.';

const normalize = (text) => text.replace(/\r\n?/gu, '\n');

describe('stored source text and rendered text are one string', () => {
    it('shows the drift a raw CRLF source produces', () => {
        const host = document.createElement('div');
        // innerHTML, because that is how the score text is rendered. The HTML
        // parser normalises CRLF in its input stream; textContent does not,
        // which is why this only shows up in the running editor.
        host.innerHTML = CRLF;
        // The DOM has silently dropped every carriage return.
        expect(host.textContent.length).toBeLessThan(CRLF.length);
        expect(CRLF.length - host.textContent.length)
            .toBe((CRLF.match(/\r/gu) || []).length);
    });

    it('agrees exactly once the source is normalised', () => {
        const text = normalize(CRLF);
        const host = document.createElement('div');
        host.innerHTML = text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;');
        expect(host.textContent).toBe(text);
        expect(host.textContent.length).toBe(text.length);
    });

    it('keeps an offset taken from the DOM valid against the source', () => {
        const text = normalize(CRLF);
        const host = document.createElement('div');
        host.innerHTML = text;
        const range = document.createRange();
        range.selectNodeContents(host);
        range.setEnd(host.firstChild, 'Elon Musk'.length);
        const offset = range.toString().length;
        // The whole point: slicing the STORED text by a DOM-measured offset
        // returns what the reader actually selected.
        expect(text.slice(0, offset)).toBe('Elon Musk');
    });
});
