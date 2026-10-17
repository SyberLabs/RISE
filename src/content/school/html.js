/**
 * Reads plain HTML pages from a site with no reader of its own into the
 * units a School recipe declares, by the selectors the recipe names.
 *
 * `body` names the element that holds the text on each page; `drops`
 * (`{ kind: selector }`) names what inside it is not the work; `strike`
 * (`{ pattern, kind }`) removes text the site set inline for reference,
 * such as page numbers in brackets. Everything removed is counted by kind.
 * The pages are read as one document, in the recipe's order, as the
 * Gutenberg reader reads an edition (./gutenberg.js).
 *
 * Imported only by scripts/school-ingest.mjs.
 */

import { dropFurniture, readUnits, strikeText } from './gutenberg.js';

export function readHtml(pages, parse, recipe) {
    const bodies = pages.map((html, index) => {
        const holder = parse(String(html)).querySelector(recipe.body);
        if (!holder) throw new Error(`page ${index + 1}: nothing matches "${recipe.body}"`);
        return `<section>${holder.innerHTML}</section>`;
    });
    const doc = parse(`<!DOCTYPE html><html><body>${bodies.join('\n')}</body></html>`);
    const dropped = dropFurniture(doc, { ...recipe.drops, hidden: 'script, style' });
    if (recipe.strike) strikeText(doc, recipe.strike, dropped);
    return readUnits(doc, recipe, dropped);
}
