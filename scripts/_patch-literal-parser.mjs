import fs from 'node:fs';

function edit(p, pairs) {
    let s = fs.readFileSync(p, 'utf8');
    const crlf = s.includes('\r\n');
    s = s.replace(/\r\n/g, '\n');
    for (const [a, b] of pairs) {
        if (s.split(a).length !== 2) throw new Error(`not found exactly once: ${p}: ${a.slice(0, 80)}`);
        s = s.replace(a, () => b);
    }
    if (crlf) s = s.replace(/\n/g, '\r\n');
    fs.writeFileSync(p, s);
}

edit('src/live/adapters/segment-parser.js', [
[` *     ten condition dimensions (a number from 0 to 1); every other key, and any
 *     value that is not what it should be, is dropped;`, ` *     ten condition dimensions (a number from 0 to 1), and \`literal=yes\`; every
 *     other key, and any value that is not what it should be, is dropped;
 *   - a passage that says \`literal=yes\` keeps its bars and bracketed words as
 *     words (nothing is neutralised) and is sent as literal text, which the whole
 *     path knows how to show without obeying; it still loses the score cut and
 *     the stand-ins that escape it, which are never text;`],
[`/** Marker characters and tokens the chunker reads, made ordinary. Idempotent. */`, `/** What a literal passage may never hold: the score cut and the stand-ins that escape the controls. */
export function stripForbidden(text) {
    return text.replace(/[\\uE000\\uE010\\uE011]/gu, '');
}

/** Marker characters and tokens the chunker reads, made ordinary. Idempotent. */`],
[`    const settings = { visual: 'still', state: {} };`, `    const settings = { visual: 'still', state: {}, literal: false };`],
[`        if (key === 'visual') {
            if (RISE_CURRENT_VISUALS.includes(value)) settings.visual = value;
        } else if`, `        if (key === 'visual') {
            if (RISE_CURRENT_VISUALS.includes(value)) settings.visual = value;
        } else if (key === 'literal') {
            if (value === 'yes') settings.literal = true;
        } else if`],
[`                write('segment.begin', { segmentId: current.id, visual: current.visual });`, `                write('segment.begin', { segmentId: current.id, visual: current.visual, ...(current.literal ? { literal: true } : {}) });`],
[`            write('segment.text', { segmentId: current.id, offset: current.length, text: piece });`, `            write('segment.text', { segmentId: current.id, offset: current.length, text: piece, ...(current.literal ? { literal: true } : {}) });`],
[`        let joined = held + raw;
        held = '';
        // The start of "[PAUSE]" at the very end may become one with the next delta.
        const partial = /\\[[A-Za-z]{0,5}$/u.exec(joined);
        if (partial) { held = partial[0]; joined = joined.slice(0, partial.index); }
        // Whitespace is one space, and belongs between words: it is sent with the words after it,
        // never on its own (the protocol refuses a blank chunk) and never at either end.
        const body = neutralise(joined).replace(/\\s+/gu, ' ');`, `        const literal = current?.literal === true;
        let joined = held + raw;
        held = '';
        // The start of "[PAUSE]" at the very end may become one with the next delta. A literal
        // passage has nothing to hold back: its markers are words.
        const partial = literal ? null : /\\[[A-Za-z]{0,5}$/u.exec(joined);
        if (partial) { held = partial[0]; joined = joined.slice(0, partial.index); }
        // Whitespace is one space, and belongs between words: it is sent with the words after it,
        // never on its own (the protocol refuses a blank chunk) and never at either end.
        const body = (literal ? stripForbidden(joined) : neutralise(joined)).replace(/\\s+/gu, ' ');`]
]);
