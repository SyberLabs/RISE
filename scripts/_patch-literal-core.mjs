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

edit('src/core/chunker.js', [
[`export const SOURCE_MARKER = /\\[(?:PAUSE|FLASH|HOLD)\\]/gi;
`, `export const SOURCE_MARKER = /\\[(?:PAUSE|FLASH|HOLD)\\]/gi;

// LITERAL TEXT. A source may say that its \`|\` and its \`[PAUSE]\`, \`[FLASH]\`,
// \`[HOLD]\` are words and not choreography (\`literal: true\`). The chunker is the
// only reader of those controls, so the escape is made where they are read:
// before chunking each is swapped for a one-character stand-in that no rule of
// the chunker, the span aligner or any tokenizer treats as anything but a
// letter, and after chunking the stand-ins are swapped back into what the
// author wrote. The swap is exactly one UTF-16 unit for one, so every character
// offset in the source, and every Dive anchored to one, is the same before and
// after. It is reversible, which is what makes it unambiguous: text that already
// holds a stand-in, or the score cut, cannot be escaped and is refused, so no
// pair of different texts can ever escape to the same thing.
export const LITERAL_PIPE = '\\uE010';
export const LITERAL_BRACKET = '\\uE011';
const LITERAL_RESERVED = /[\\uE000\\uE010\\uE011]/u;
const MARKER_OPEN = /\\[(?=(?:PAUSE|FLASH|HOLD)\\])/giu;

/** True if text holds a character a literal text may never carry: the score cut or a stand-in. */
export function hasLiteralForbidden(text) {
    return LITERAL_RESERVED.test(text);
}

/** Make a literal text inert to the chunker. Same length; reversed by restoreLiteral. */
export function escapeLiteral(text) {
    if (typeof text !== 'string') throw new TypeError('Literal text is a string');
    if (hasLiteralForbidden(text)) {
        throw new RangeError('Literal text cannot contain the score cut or the stand-ins that escape it');
    }
    return text.replace(/\\|/gu, LITERAL_PIPE).replace(MARKER_OPEN, LITERAL_BRACKET);
}

/** What the author wrote, from what escapeLiteral made of it. */
export function restoreLiteral(text) {
    return text.replace(/\\uE010/gu, '|').replace(/\\uE011/gu, '[');
}
`],
[`export function isDroppedWordToken(value) {
    const val = String(value ?? '').trim();
    if (!val) return true;
    return val.length === 1 && /[^a-zA-Z0-9À-ÿ]/u.test(val);
}

function splitWords(text) {`, `export function isDroppedWordToken(value, literal = false) {
    const val = String(value ?? '').trim();
    if (!val) return true;
    // A literal \`|\` standing alone is a word the author wrote, not a stray mark.
    if (literal && (val === LITERAL_PIPE || val === LITERAL_BRACKET)) return false;
    return val.length === 1 && /[^a-zA-Z0-9À-ÿ]/u.test(val);
}

function splitWords(text, literal = false) {`],
[`    return text.split(/\\s+/).filter(w => !isDroppedWordToken(w));
}`, `    return text.split(/\\s+/).filter(w => !isDroppedWordToken(w, literal));
}`],
[`export function chunkText(text, { mode = 'word', wpm = 220, source = '', sourceId = '', hints = null, phraseFloor = true, verseLines = false } = {}) {`,
`export function chunkText(text, { mode = 'word', wpm = 220, source = '', sourceId = '', hints = null, phraseFloor = true, verseLines = false, literal = false } = {}) {`],
[`                default:
                    return splitWords(scoreUnit);`, `                default:
                    return splitWords(scoreUnit, literal);`],
[`                    .replace(/\\s+/g, ' ')
                    .trim();

                // Skip empty chunks that might result from stripping markers`, `                    .replace(/\\s+/g, ' ')
                    .trim();
                // A literal text's controls were only ever stand-ins; here they are words again.
                if (literal) cleanContent = restoreLiteral(cleanContent);

                // Skip empty chunks that might result from stripping markers`],
[`                const cleanContent = piece`, `                let cleanContent = piece`]
]);
