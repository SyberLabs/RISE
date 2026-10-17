/**
 * Reads Wikisource pages into the units a School recipe declares.
 *
 * The input is the parsed HTML the MediaWiki API returns for each page
 * (`action=parse&prop=text`), never the ws-export epub. A work on several
 * subpages is read as one document, its pages in the recipe's order.
 *
 * Removed before anything is read, and reported by kind: the header and
 * licence templates and everything Wikisource marks for no export, sister-
 * project boxes, edit links, the scan's page numbers, reference markers and
 * the references list. A paragraph a scan page broke mid-sentence (the next
 * page opens in lower case) is joined again. Units and verse are then read
 * as the Gutenberg reader reads them (./gutenberg.js).
 *
 * Imported only by scripts/school-ingest.mjs.
 */

import { dropFurniture, filledChild, joinParagraphs, readUnits } from './gutenberg.js';

const DROP = Object.freeze({
    'header and licence': '.ws-noexport, .noprint, .wst-header, .ws-header, #ws-data, .licenseContainer, .licenseBanner, .licensetpl',
    'sister projects': '.plainSister, .sisterproject',
    'edit links': '.mw-editsection',
    'page numbers': '.ws-pagenum, .pagenum',
    'footnote markers': 'sup.reference',
    footnotes: 'ol.references, .mw-references-wrap, .smallrefs, .reflist',
    hidden: 'style, link, script'
});

/** `pages` are the API's HTML for each page, in reading order; the result is readGutenberg's. */
export function readWikisource(pages, parse, recipe) {
    const doc = parse(`<!DOCTYPE html><html><body>${pages.map(html => `<section class="ws-page">${html}</section>`).join('\n')}</body></html>`);
    const dropped = dropFurniture(doc, DROP);
    const scans = [...doc.body.querySelectorAll('.prp-pages-output')];
    for (let index = 1; index < scans.length; index++) {
        const next = filledChild(scans[index]);
        const previous = filledChild(scans[index - 1], true);
        if (next?.tagName === 'P' && previous?.tagName === 'P' && /^\p{Ll}/u.test(next.textContent.trim())) {
            joinParagraphs(previous, next);
        }
    }
    return readUnits(doc, recipe, dropped);
}
