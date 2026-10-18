/**
 * Plain text, set as paragraphs separated by blank lines, read into the
 * units a School recipe declares: the CCEL reader (./ccel.js) and the local
 * file reader (./file.js) both come through here.
 *
 * `paragraphs` is the text already cut to the work and cleared of its
 * distributor's furniture. A paragraph `isHeading` accepts becomes a heading
 * of the level it returns; every other paragraph is one paragraph, its
 * hard-wrapped lines joined, or kept as lines when the recipe marks the work
 * verse. The document then reads as the Gutenberg reader reads an edition
 * (./gutenberg.js), words counted from its own text.
 */

import { dropFurniture, readUnits } from './gutenberg.js';

const escape = text => text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');

/** `[{ lines }]` → readGutenberg's result; `dropped` holds what the caller already removed. */
export function readParagraphs(paragraphs, parse, recipe, isHeading, dropped = {}) {
    const html = paragraphs.map(({ lines }) => {
        const level = isHeading(lines);
        if (level) return `<h${level}>${escape(lines.join(' '))}</h${level}>`;
        return `<p>${lines.map(escape).join(recipe.verse ? '<br>' : ' ')}</p>`;
    }).join('\n');
    const doc = parse(`<!DOCTYPE html><html><body>${html}</body></html>`);
    for (const [kind, count] of Object.entries(dropFurniture(doc, {}))) dropped[kind] = (dropped[kind] || 0) + count;
    // The caller has already cut the text to its span.
    return readUnits(doc, { ...recipe, extract: undefined }, dropped);
}

/** Text → `[{ lines }]`, split at blank lines, each line trimmed. */
export function paragraphsOf(text) {
    return String(text).replace(/\r\n?/gu, '\n').split(/\n\s*\n/u)
        .map(block => ({ lines: block.split('\n').map(line => line.trim()).filter(Boolean) }))
        .filter(paragraph => paragraph.lines.length);
}
