/**
 * Reads a Christian Classics Ethereal Library plain-text file
 * (`…/cache/<name>.txt`) into the units a School recipe declares.
 *
 * The file opens with CCEL's own card (title, rights, subjects) and closes
 * with its indexes; the recipe's `extract` names the paragraph the work
 * starts at (the first after `after`, when a bundle prints it more than
 * once) and the one it stops before, so neither is read. Inside the span
 * the rules CCEL draws between sections are dropped and counted, `cut`
 * names any stretch the recipe leaves out (to a paragraph inclusive, or
 * `before` one), counted as well, and the note markers CCEL sets after a
 * space ("away [60] ,") go, with the notes themselves (paragraphs opening
 * on "[60] "). A paragraph opens a unit when the recipe lists its text, or
 * when one of `levels` (`{ 2: pattern, 3: pattern }`) matches it, at that
 * heading level.
 *
 * Imported only by scripts/school-ingest.mjs.
 */

import { paragraphsOf, readParagraphs } from './text.js';

const RULE = /^\s*_{10,}\s*$/gmu;
const RULE_MARK = '—rule—';
const MARKER = /(?<=\S)\s+\[\d{1,4}\](?=[\s,.;:)!?'’"]|$)/gu;
const flat = lines => lines.join(' ').replace(/\s+/gu, ' ').trim();
const countWords = text => String(text).split(/\s+/u).filter(Boolean).length;

function indexOf(paragraphs, text, after, label) {
    const at = paragraphs.findIndex((paragraph, index) => index > after && flat(paragraph.lines) === text);
    if (at < 0) throw new Error(`${label}: no paragraph reads "${text}"`);
    return at;
}

export function readCcel(text, parse, recipe) {
    const dropped = {};
    const add = (kind, count) => { if (count) dropped[kind] = (dropped[kind] || 0) + count; };
    // A rule stands as a paragraph of its own, so the span can be cut first and its rules counted.
    let paragraphs = paragraphsOf(String(text).replace(/\r\n?/gu, '\n').replace(RULE, `\n\n${RULE_MARK}\n\n`));
    const anchor = recipe.extract.after ? indexOf(paragraphs, recipe.extract.after, -1, 'extract.after') : -1;
    const start = indexOf(paragraphs, recipe.extract.from, anchor, 'extract.from');
    const stop = recipe.extract.to ? indexOf(paragraphs, recipe.extract.to, start, 'extract.to') : paragraphs.length;
    paragraphs = paragraphs.slice(start, stop);
    add('rules', paragraphs.filter(paragraph => flat(paragraph.lines) === RULE_MARK).length);
    paragraphs = paragraphs.filter(paragraph => flat(paragraph.lines) !== RULE_MARK);
    for (const cut of recipe.cut ?? []) {
        const from = indexOf(paragraphs, cut.from, -1, 'cut.from');
        const to = cut.before ? indexOf(paragraphs, cut.before, from, 'cut.before') - 1 : indexOf(paragraphs, cut.to, from - 1, 'cut.to');
        add('recipe', paragraphs.splice(from, to - from + 1).reduce((sum, paragraph) => sum + countWords(flat(paragraph.lines)), 0));
    }
    paragraphs = paragraphs.map(paragraph => ({
        lines: paragraph.lines.map((line, index) => line.replace(MARKER, () => {
            add('footnote markers', 1);
            return '';
        }) || (index ? '' : line)).filter(Boolean)
    }));
    const listed = new Set(Array.isArray(recipe.units) ? recipe.units.map(unit => unit.heading) : []);
    const levels = Object.entries(recipe.levels ?? {}).map(([level, pattern]) => [Number(level), new RegExp(pattern, 'u')]);
    const levelOf = lines => (listed.has(flat(lines)) ? 2 : levels.find(([, pattern]) => pattern.test(flat(lines)))?.[0] ?? 0);
    return readParagraphs(paragraphs, parse, recipe, levelOf, dropped);
}
