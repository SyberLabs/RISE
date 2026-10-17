/**
 * Converts a Project Gutenberg LaTeX edition into the plain Markdown a School
 * source file holds (./file.js reads it): each `\chapter` a `##` heading
 * named from its short title, its longer printed title kept as its first
 * paragraph; paragraphs at blank lines; mathematics kept as plain text in
 * its TeX form inside brackets, a lone letter or number left bare as the
 * word it is in the sentence; emphasis unwrapped; footnotes and comments
 * dropped. Only the text between `from` and `to` is read, so the front
 * matter and the distributor's licence are never reached.
 *
 * A command it does not know refuses the conversion, naming it: nothing
 * passes through unread, and nothing is lost unreported.
 *
 * Imported only by scripts/school-latex.mjs.
 */

import { titleCase } from './gutenberg.js';

const MATH_ENVS = 'equation|eqnarray|gather|align|alignat|multline';
const DISPLAY = new RegExp(`\\\\begin\\{((?:${MATH_ENVS})\\*?)\\}([\\s\\S]*?)\\\\end\\{\\1\\}`, 'gu');
const OPEN = '';
const CLOSE = '';
const TOKEN = new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'gu');
// Layout and size declarations: they set how the page looked, not what it says.
const DECLARATIONS = new Set(['large', 'Large', 'Huge', 'normalsize', 'small', 'bigskip', 'medskip', 'smallskip', 'hfill',
    'dotfill', 'newpage', 'clearpage', 'centering', 'noindent', 'it', 'sc', 'newline', 'quad', 'qquad', 'kill']);
// Commands whose argument is the text itself.
const UNWRAP = new Set(['emph', 'textit', 'textrm', 'textbf', 'text', 'centerline', 'mbox']);
// Commands dropped with every argument they take.
const DROP_ARGS = { hspace: 1, vspace: 1, setcounter: 2 };
const SYMBOLS = { ae: 'æ', AE: 'Æ', oe: 'œ', OE: 'Œ', lq: '‘', rq: '’', dots: '…', ldots: '…', dotsc: '…', dotso: '…', S: '§' };
const ACCENTS = { "'": '́', '`': '̀', '^': '̂', '"': '̈', '~': '̃', c: '̧', '=': '̄' };
const GREEK = Object.fromEntries([...'abgdezhjiklmnxoprstufqyw'].map((latin, index) => [latin, 'αβγδεζηθικλμνξοπρστυφχψω'[index]]));
const GREEK_MARKS = { "'": '́', '`': '̀', '~': '͂', '<': '̔', '>': '̓', '"': '̈', '|': 'ͅ' };

const MATH_GREEK = Object.fromEntries(['alpha', 'beta', 'gamma', 'delta', 'varepsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa',
    'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega']
    .map((name, index) => [name, 'αβγδεζηθικλμνξοπρστυφχψω'[index]]).concat([['varsigma', 'ς'], ['epsilon', 'ε']]));
const MATH_ACCENTS = { acute: '́', grave: '̀', tilde: '͂', ddot: '̈' };
// A character no odd run of backslashes escapes.
const UNESCAPED = '(?<=(?:^|[^\\\\])(?:\\\\\\\\)*)';

const countWords =text => String(text).split(/\s+/u).filter(Boolean).length;
const flat = text => String(text).replace(/\s+/gu, ' ').trim();

/** 1 -> 'I', 24 -> 'XXIV'. */
function roman(n) {
    return [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].reduce((out, [value, numeral]) => {
        while (n >= value) {
            out += numeral;
            n -= value;
        }
        return out;
    }, '');
}

/** The index just past the group that opens at `start` (a `{` or `[`), its brackets balanced. */
function groupEnd(text, start) {
    const open = text[start];
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    for (let at = start; at < text.length; at++) {
        if (text[at] === '\\') {
            at++;
            continue;
        }
        if (text[at] === open) depth++;
        else if (text[at] === close && --depth === 0) return at + 1;
    }
    throw new Error(`unbalanced ${open} at ${JSON.stringify(text.slice(start, start + 60))}`);
}

/** Skips whitespace, then an optional `[…]` group when `optional`; returns the next index. */
function skipOptional(text, at) {
    let next = at;
    while (/\s/u.test(text[next] ?? '')) next++;
    return text[next] === '[' ? groupEnd(text, next) : at;
}

/** `{ args: [string], end }` for `count` brace groups from `at`, whitespace allowed between them. */
function readArgs(text, at, count) {
    const args = [];
    let next = at;
    for (let index = 0; index < count; index++) {
        while (/\s/u.test(text[next] ?? '')) next++;
        if (text[next] !== '{') throw new Error(`expected an argument at ${JSON.stringify(text.slice(at - 20, at + 40))}`);
        const end = groupEnd(text, next);
        args.push(text.slice(next + 1, end - 1));
        next = end;
    }
    return { args, end: next };
}

/** Babel's LGR transliteration ("p'ajos") as Unicode Greek ("πάθος"). */
export function greek(text) {
    let out = '';
    let marks = '';
    const source = text.replace(/\\~/gu, '~').replace(/\\dots/gu, '…');
    for (let at = 0; at < source.length; at++) {
        const char = source[at];
        // LGR's v only keeps a sigma medial ("sv" is σ before a break); it prints nothing.
        if (char === 'v') continue;
        if (GREEK_MARKS[char]) {
            marks += GREEK_MARKS[char];
            continue;
        }
        const lower = char.toLowerCase();
        const letter = lower === 'c' ? 'ς' : GREEK[lower];
        if (!letter) {
            out += marks + char;
            marks = '';
            continue;
        }
        const final = lower === 's' && !/[a-z]/iu.test(source[at + 1] ?? '');
        const base = final ? 'ς' : letter;
        out += (char === lower ? base : base.toUpperCase()) + marks;
        marks = '';
    }
    return out.normalize('NFC');
}

/**
 * Greek words the edition set as mathematics ("\acute{\omega}\varsigma\ \kappa\alpha\grave{\iota}") as
 * Unicode Greek; null when the formula holds anything but Greek letters, their accents and punctuation.
 */
export function mathGreek(tex, inner = false) {
    let rest = tex;
    let out = '';
    while (rest) {
        const accent = /^\\(acute|grave|tilde|ddot)\{(\\?[a-z]*)\}/u.exec(rest);
        if (accent) {
            const base = accent[2] ? mathGreek(accent[2], true) : '';
            if (base === null) return null;
            out += base ? `${base}${MATH_ACCENTS[accent[1]]}`.normalize('NFC') : '’';
            rest = rest.slice(accent[0].length);
            continue;
        }
        const command = /^\\([a-zA-Z]+)/u.exec(rest);
        if (command) {
            if (command[1] === 'centerdot') out += '·';
            else if (MATH_GREEK[command[1]]) out += MATH_GREEK[command[1]];
            else return null;
            rest = rest.slice(command[0].length);
            continue;
        }
        const char = rest[0];
        // A bare o is omicron, which TeX has no command for.
        if (char === 'o') out += 'ο';
        else if (rest.startsWith('\\ ')) {
            out += ' ';
            rest = rest.slice(1);
        } else if (/[\s,.;:()]/u.test(char)) out += char;
        else if (!/[{}^]/u.test(char)) return null;
        rest = rest.slice(1);
    }
    // A word of Greek carries its accents; unaccented letters side by side are a product of variables.
    if (inner) return out;
    const greekLetters = (out.match(/\p{Script=Greek}/gu) ?? []).length;
    return greekLetters > 1 && /[̀-ͅ]/u.test(out.normalize('NFD')) ? flat(out).normalize('NFC') : null;
}

/** Removes `\name{…}` (an optional `[…]` first) wherever it stands; returns the text and the words removed. */
function removeCommand(text, name) {
    let words = 0;
    const pattern = new RegExp(`\\\\${name}(?![a-zA-Z])`, 'gu');
    let out = text;
    for (let match = pattern.exec(out); match; match = pattern.exec(out)) {
        let end = skipOptional(out, match.index + match[0].length);
        if (out[end] === '{') {
            const close = groupEnd(out, end);
            words += countWords(convertText(out.slice(end + 1, close - 1)));
            end = close;
        }
        // An empty group, so a control word before the note never runs into the word after it.
        out = `${out.slice(0, match.index)}{}${out.slice(end)}`;
        pattern.lastIndex = match.index;
    }
    return { text: out, words };
}

/** Text-mode LaTeX (no mathematics left in it) as plain text. */
function convertText(text) {
    let out = '';
    for (let at = 0; at < text.length; at++) {
        const char = text[at];
        if (char === '\\') {
            const next = text[at + 1];
            if (next === '\\') {
                // A forced line break, with the source's own line end after it.
                out += '\n';
                at = skipOptional(text, at + 2);
                at += /^[ \t]*\n?/u.exec(text.slice(at))[0].length - 1;
                continue;
            }
            if (ACCENTS[next] && !/[a-zA-Z]/u.test(next) || (next === 'c' && text[at + 2] === '{')) {
                let end = at + 2;
                let base;
                if (text[end] === '{') {
                    const close = groupEnd(text, end);
                    base = text.slice(end + 1, close - 1);
                    end = close;
                } else {
                    base = text[end];
                    end += 1;
                }
                out += `${base.replace(/^\\i$/u, 'i')}${ACCENTS[next]}`.normalize('NFC');
                at = end - 1;
                continue;
            }
            // A control space ("Rev.\ " or a backslash ending the line), a thin space, or a character escaped.
            if (/[&%$#_{} ,\n]/u.test(next)) {
                out += next === ',' || next === '\n' ? ' ' : next;
                at += 1;
                continue;
            }
            const name = /^[a-zA-Z]+/u.exec(text.slice(at + 1))?.[0];
            if (!name) throw new Error(`unknown command \\${next} at ${JSON.stringify(text.slice(Math.max(0, at - 40), at + 40))}`);
            let end = at + 1 + name.length;
            // A control word eats the spaces after it ("\lq art").
            // An ellipsis keeps the space the reader expects after it.
            if (DECLARATIONS.has(name) || (SYMBOLS[name] && SYMBOLS[name] !== '…')) end += /^[ \t]*/u.exec(text.slice(end))[0].length;
            if (DECLARATIONS.has(name)) {
                at = end - 1;
                continue;
            }
            if (SYMBOLS[name]) {
                // A control word eats the space after it unless the source protected it.
                out += SYMBOLS[name];
                if (text[end] === '{' && text[end + 1] === '}') end += 2;
                at = end - 1;
                continue;
            }
            if (name in DROP_ARGS) {
                at = readArgs(text, end, DROP_ARGS[name]).end - 1;
                continue;
            }
            if (UNWRAP.has(name) || name === 'textsc' || name === 'textgreek') {
                const { args: [arg], end: close } = readArgs(text, end, 1);
                const inner = name === 'textgreek' ? greek(arg) : convertText(arg);
                out += name === 'textsc' ? inner.toUpperCase() : inner;
                at = close - 1;
                continue;
            }
            if (name === 'multicolumn' || name === 'raisebox' || name === 'parbox') {
                const count = name === 'multicolumn' ? 3 : 2;
                const { args, end: close } = readArgs(text, end, count);
                out += convertText(args[count - 1]);
                at = close - 1;
                continue;
            }
            if (name === 'item') {
                out += '\n';
                at = skipOptional(text, end) - 1;
                continue;
            }
            if (name === 'begin' || name === 'end') {
                const { args: [env], end: close } = readArgs(text, end, 1);
                if (!['center', 'tabular', 'tabbing', 'itemize', 'verse', 'quote', 'minipage', 'array'].includes(env)) {
                    throw new Error(`unknown environment ${env} at ${JSON.stringify(text.slice(Math.max(0, at - 40), at + 40))}`);
                }
                let after = close;
                // A table's column spec, and a minipage's width, are layout.
                if (name === 'begin' && ['tabular', 'array', 'minipage'].includes(env)) after = readArgs(text, skipOptional(text, close), 1).end;
                out += '\n';
                at = after - 1;
                continue;
            }
            throw new Error(`unknown command \\${name} at ${JSON.stringify(text.slice(Math.max(0, at - 40), at + 40))}`);
        }
        if (char === '{' || char === '}') continue;
        if (char === '&') {
            out += ' ';
            continue;
        }
        if (char === '~') {
            out += ' ';
            continue;
        }
        out += char;
    }
    return out
        .replace(/---/gu, '—').replace(/--/gu, '–')
        .replace(/``/gu, '“').replace(/''/gu, '”').replace(/`/gu, '‘').replace(/'/gu, '’');
}

/**
 * `{ markdown, chapters, dropped }`: the text between `from` and `to` as
 * Markdown; `dropped` counts the words of the notes left out.
 */
export function latexToMarkdown(tex, { from, to }) {
    const start = tex.indexOf(from);
    if (start < 0) throw new Error(`the span's start ${from} is not in the source`);
    const stop = tex.indexOf(to, start);
    if (stop < 0) throw new Error(`the span's end ${to} is not in the source`);
    let text = tex.slice(start + from.length, stop).replace(/\r\n?/gu, '\n')
        // A comment runs to the end of its line and takes the line break with it.
        .replace(new RegExp(`${UNESCAPED}%[^\\n]*\\n[ \\t]*`, 'gu'), '');

    const maths = [];
    const hold = tex => `${OPEN}${maths.push(flat(tex)) - 1}${CLOSE}`;
    text = text
        // A displayed box of prose is prose.
        .replace(/\\begin\{equation\*\}\s*\\begin\{minipage\}\{[^}]*\}([\s\S]*?)\\end\{minipage\}\s*\\end\{equation\*\}/gu, '\n\n$1\n\n')
        .replace(DISPLAY, (_, env, body) => hold(body))
        .replace(/\\\[([\s\S]*?)\\\]/gu, (_, body) => hold(body))
        .replace(/\$\$([\s\S]*?)\$\$/gu, (_, body) => hold(body))
        .replace(new RegExp(`${UNESCAPED}\\$([\\s\\S]*?)${UNESCAPED}\\$`, 'gu'), (_, body) => hold(body));

    let notes = 0;
    for (const name of ['footnotetext', 'footnotemark', 'footnote']) {
        const removed = removeCommand(text, name);
        text = removed.text;
        notes += removed.words;
    }
    // \tabbing's tab stops are layout.
    text = text.replace(/\\[=>]/gu, ' ');

    let chapters = 0;
    const CHAPTER = '\\chapter[';
    for (let at = text.indexOf(CHAPTER); at >= 0; at = text.indexOf(CHAPTER, at)) {
        const shortEnd = groupEnd(text, at + CHAPTER.length - 1);
        const short = flat(convertText(text.slice(at + CHAPTER.length, shortEnd - 1))).replace(/\.$/u, '');
        let end = shortEnd;
        let long = '';
        const brace = /^\s*\{/u.exec(text.slice(shortEnd));
        if (brace) {
            end = groupEnd(text, shortEnd + brace[0].length - 1);
            long = text.slice(shortEnd + brace[0].length, end - 1);
        }
        chapters += 1;
        const printed = flat(convertText(long)).replace(/\.$/u, '');
        const replacement = `\n\n## Chapter ${roman(chapters)}: ${titleCase(short)}\n\n${printed && printed !== short ? `${long}\n\n` : ''}`;
        text = text.slice(0, at) + replacement + text.slice(end);
        at += replacement.length;
    }

    const converted = convertText(text).replace(TOKEN, (_, index) => {
        const math = maths[Number(index)];
        // A lone letter or number is a word of the sentence, not an equation; Greek set as mathematics is Greek.
        if (/^(?:[A-Za-z]|\d+)$/u.test(math)) return math;
        // "[V]" inside a formula is spaced, as TeX reads it the same, so no reader takes it for a note marker.
        return mathGreek(math) ?? `[${math.replace(/\[(\d{1,4}|[A-Z]{1,2})\]/gu, '[ $1 ]')}]`;
    });
    const markdown = converted.replace(/\r\n?/gu, '\n').split(/\n[ \t]*\n/u)
        .map(block => block.split('\n').map(line => flat(line)).filter(Boolean).join(' '))
        .filter(Boolean)
        .join('\n\n');
    return { markdown, chapters, dropped: notes ? { footnotes: notes } : {} };
}
