/**
 * Reads a Christian Classics Ethereal Library plain-text file
 * (`…/cache/<name>.txt`) into the units a School recipe declares.
 *
 * The file opens with CCEL's own card (title, rights, subjects) and closes
 * with its indexes; the recipe's `extract` names the paragraphs the work
 * starts at and stops before, so neither is read. Inside the span the rules
 * CCEL draws between sections are dropped and counted, and `cut` names any
 * stretch the recipe leaves out (a table of chapters), counted as well.
 * Units open at the paragraphs the recipe lists by their text, or that its
 * `heading` pattern matches.
 *
 * Imported only by scripts/school-ingest.mjs.
 */

import { paragraphsOf, readParagraphs } from './text.js';

const RULE = /^\s*_{10,}\s*$/gmu;
const RULE_MARK = '—rule—';
const flat = lines => lines.join(' ').replace(/\s+/gu, ' ').trim();

function indexOf(paragraphs, text, after, label) {
    const at = paragraphs.findIndex((paragraph, index) => index > after && flat(paragraph.lines) === text);
    if (at < 0) throw new Error(`${label}: no paragraph reads "${text}"`);
    return at;
}

export function readCcel(text, parse, recipe) {
    const dropped = {};
    // A rule stands as a paragraph of its own, so the span can be cut first and its rules counted.
    let paragraphs = paragraphsOf(String(text).replace(/\r\n?/gu, '\n').replace(RULE, `\n\n${RULE_MARK}\n\n`));
    const start = indexOf(paragraphs, recipe.extract.from, -1, 'extract.from');
    const stop = recipe.extract.to ? indexOf(paragraphs, recipe.extract.to, start, 'extract.to') : paragraphs.length;
    paragraphs = paragraphs.slice(start, stop);
    const rules = paragraphs.filter(paragraph => flat(paragraph.lines) === RULE_MARK).length;
    if (rules) dropped.rules = rules;
    paragraphs = paragraphs.filter(paragraph => flat(paragraph.lines) !== RULE_MARK);
    for (const cut of recipe.cut ?? []) {
        const from = indexOf(paragraphs, cut.from, -1, 'cut.from');
        const to = indexOf(paragraphs, cut.to, from - 1, 'cut.to');
        const gone = paragraphs.splice(from, to - from + 1);
        dropped.recipe = (dropped.recipe || 0) + gone.reduce((sum, paragraph) => sum + flat(paragraph.lines).split(' ').length, 0);
    }
    const listed = new Set(Array.isArray(recipe.units) ? recipe.units.map(unit => unit.heading) : []);
    const pattern = recipe.heading ? new RegExp(recipe.heading, 'u') : null;
    return readParagraphs(paragraphs, parse, recipe, lines => (listed.has(flat(lines)) || pattern?.test(flat(lines)) ? 2 : 0), dropped);
}
