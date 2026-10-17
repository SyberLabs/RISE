/**
 * Reads sacred-texts.com chapter pages into the units a School recipe
 * declares.
 *
 * The pages are read as one document, in the recipe's order. Removed before
 * anything is read, and reported by kind: the navigation the site sets in
 * CENTER above and below the text, its line naming the book "at
 * sacred-texts.com", page numbers (named anchors), footnote markers and
 * each page's Footnotes list, and the "[paragraph continues]" notes. A
 * paragraph a page turn split is joined again where the site marked it
 * continuing, or where the next page's text opens in lower case. Units and
 * verse are then read as the Gutenberg reader reads them (./gutenberg.js).
 *
 * Imported only by scripts/school-ingest.mjs.
 */

import { dropFurniture, joinParagraphs, readUnits } from './gutenberg.js';

const countWords = text => String(text).split(/\s+/u).filter(Boolean).length;

/** Removes `nodes` (elements or a Range), returning their words. */
function remove(nodes) {
    let total = 0;
    for (const node of nodes) {
        total += countWords(node.textContent ?? node.toString());
        if (node.deleteContents) node.deleteContents();
        else node.remove();
    }
    return total;
}

/** A CENTER, or the nav, that holds nothing but links. */
function isNavigation(element) {
    const linked = [...element.querySelectorAll('a')].map(anchor => anchor.textContent).join('');
    return element.tagName === 'NAV' || element.textContent.replace(/[\s|]+/gu, '') === linked.replace(/\s+/gu, '');
}

function filledSibling(element, direction) {
    let node = element[direction];
    while (node && !node.textContent.trim()) node = node[direction];
    return node;
}

/** `pages` are the chapter pages' HTML, in reading order; the result is readGutenberg's. */
export function readSacredTexts(pages, parse, recipe) {
    const bodies = pages.map(html => `<section class="st-page">${parse(String(html)).body.innerHTML}</section>`);
    const doc = parse(`<!DOCTYPE html><html><body>${bodies.join('\n')}</body></html>`);
    const dropped = {};
    const add = (kind, count) => { if (count) dropped[kind] = (dropped[kind] || 0) + count; };

    add('navigation', remove([...doc.body.querySelectorAll('center, nav')].filter(isNavigation)));
    add('site notes', remove([...doc.body.querySelectorAll('p')]
        .filter(p => p.querySelector('font[color="green" i]') && /at sacred-texts\.com/u.test(p.textContent))));
    for (const heading of [...doc.body.querySelectorAll('h3')].filter(h3 => h3.textContent.trim() === 'Footnotes')) {
        const range = doc.createRange();
        range.setStartBefore(heading);
        range.setEndAfter(heading.closest('section').lastChild);
        add('footnotes', remove([range]));
    }
    add('footnote markers', remove(doc.body.querySelectorAll('a[href^="#fn"]')));

    const turns = [...doc.body.querySelectorAll('a[name^="page_"]')].map(anchor => anchor.closest('p') ?? anchor);
    add('page numbers', remove(doc.body.querySelectorAll('a[name^="page_"]')));
    for (const turn of turns) {
        const previous = filledSibling(turn, 'previousElementSibling');
        const next = filledSibling(turn, 'nextElementSibling');
        if (previous?.tagName !== 'P' || next?.tagName !== 'P') continue;
        const marked = next.querySelector('.contnote');
        if (marked) add('continuation notes', remove([marked]));
        if (marked || /^\p{Ll}/u.test(next.textContent.trim())) joinParagraphs(previous, next);
    }
    add('continuation notes', remove(doc.body.querySelectorAll('.contnote')));

    for (const [kind, count] of Object.entries(dropFurniture(doc, { hidden: 'script, style' }))) add(kind, count);
    return readUnits(doc, recipe, dropped);
}
