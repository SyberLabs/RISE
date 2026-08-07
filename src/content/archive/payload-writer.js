/**
 * Single writer for generated payload SECTIONS arrays.
 * Terminator is `\n];` — JSON.stringify ends at the bracket; the
 * semicolon must be restored. One vocabulary; scripts call this or do
 * not rewrite.
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
