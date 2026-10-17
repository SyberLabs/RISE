/**
 * Reads a local text artifact under scripts/school-sources/<id>/ (a text
 * re-keyed or proofed by hand, with its provenance written above it) into
 * the units a School recipe declares.
 *
 * The file is Markdown of the plainest kind: `#` headings and paragraphs
 * separated by blank lines. The recipe's `extract.from` names the heading
 * the work starts at, so the provenance above it is never read. `strike`
 * removes, and counts, what the file carries for reference but a reader is
 * not to hear (`{ pattern, kind }`: the running sentence numbers of a
 * scholarly edition, say).
 *
 * Imported only by scripts/school-ingest.mjs.
 */

import { paragraphsOf, readParagraphs } from './text.js';

const HEADING = /^(#{1,6})\s+(.*)$/u;
const countWords = text => String(text).split(/\s+/u).filter(Boolean).length;

export function readFile(text, parse, recipe) {
    let paragraphs = paragraphsOf(text);
    const start = paragraphs.findIndex(paragraph => paragraph.lines[0].replace(HEADING, '$2') === recipe.extract.from
        && HEADING.test(paragraph.lines[0]));
    if (start < 0) throw new Error(`extract.from: no heading reads "${recipe.extract.from}"`);
    paragraphs = paragraphs.slice(start);
    const dropped = {};
    const strike = recipe.strike ? new RegExp(recipe.strike.pattern, 'gu') : null;
    const levels = new Map();
    paragraphs = paragraphs.map(paragraph => {
        const heading = HEADING.exec(paragraph.lines[0]);
        if (heading && paragraph.lines.length === 1) {
            const lines = [heading[2]];
            levels.set(lines, heading[1].length);
            return { lines };
        }
        if (!strike) return paragraph;
        return {
            lines: paragraph.lines.map(line => line.replace(strike, match => {
                dropped[recipe.strike.kind] = (dropped[recipe.strike.kind] || 0) + countWords(match);
                return '';
            }).trim()).filter(Boolean)
        };
    });
    return readParagraphs(paragraphs, parse, recipe, lines => levels.get(lines) ?? 0, dropped);
}
