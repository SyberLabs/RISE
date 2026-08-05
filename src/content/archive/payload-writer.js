/**
 * The one way to rewrite a generated payload's SECTIONS array.
 *
 * WHY THIS IS A MODULE AND NOT A HELPER COPIED TWICE. The cleanser
 * learned that the array terminator is three characters — newline,
 * bracket, semicolon — and that `JSON.stringify` ends at the bracket, so
 * the semicolon has to be put back. Losing it left five payloads relying
 * on automatic semicolon insertion: valid JavaScript, and an unintended
 * edit all the same, invisible to 1,557 passing tests.
 *
 * The withdrawal script performed nearly the same rewrite and had NOT
 * learned it, so the Mahabharata lost its terminator too and turned up
 * in the repair list. One vocabulary in two places where only one copy
 * learned the new word — the failure this codebase is named for, arriving
 * again inside the work that was documenting it.
 *
 * So there is one writer. A script that rewrites a payload calls this or
 * it does not rewrite a payload.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SECTIONS_OPEN = /export const [A-Z0-9_]+_SECTIONS = \[/;
/** Newline, bracket, semicolon. Three characters, and the last one matters. */
const SECTIONS_CLOSE = '\n];';

/**
 * Replace a payload's SECTIONS array, leaving its header, its META
 * export and every other byte exactly as the ingest wrote them.
 *
 * @param {string} path
 * @param {Array} sections
 * @returns {{ok: true} | {ok: false, reason: string}} — it reports rather
 *   than throws, because callers are batch scripts that must skip a work
 *   and carry on rather than abort a run mid-corpus.
 */
export function rewriteSections(path, sections) {
    const src = readFileSync(path, 'utf8');

    const open = src.match(SECTIONS_OPEN);
    if (!open) return { ok: false, reason: 'no SECTIONS array found' };
    const start = open.index + open[0].length - 1;

    const end = src.indexOf(SECTIONS_CLOSE, start);
    if (end < 0) return { ok: false, reason: 'unterminated SECTIONS array' };

    const rewritten = src.slice(0, start)
        + JSON.stringify(sections, null, 4)
        + ';'
        + src.slice(end + SECTIONS_CLOSE.length);

    // The terminator is the thing that was lost twice. Prove it is there
    // before writing rather than discovering it in a test afterwards.
    const meta = rewritten.indexOf('_META');
    if (meta >= 0 && !/\n\];\s*\n/.test(rewritten.slice(0, meta))) {
        return { ok: false, reason: 'rewrite would drop the array terminator' };
    }

    writeFileSync(path, rewritten, 'utf8');
    return { ok: true };
}

/**
 * Replace the frozen META object, for the rare edit that changes what a
 * work CLAIMS rather than what it contains — a withdrawal, a corrected
 * edition statement. A payload trimmed without its dossier following is
 * a book presented under a name that no longer describes it.
 */
export function rewriteMeta(path, metaKey, meta) {
    const src = readFileSync(path, 'utf8');
    const at = src.lastIndexOf(`export const ${metaKey} = Object.freeze(`);
    if (at < 0) return { ok: false, reason: `no ${metaKey} export` };
    const open = src.indexOf('{', at);
    const close = src.lastIndexOf('});');
    if (open < 0 || close < open) return { ok: false, reason: 'unterminated META object' };

    writeFileSync(path,
        src.slice(0, open) + JSON.stringify(meta, null, 4) + src.slice(close + 1), 'utf8');
    return { ok: true };
}
