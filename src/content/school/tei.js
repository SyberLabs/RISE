/**
 * Reads an EEBO-TCP TEI transcription into the units a School recipe
 * declares.
 *
 * Only `<text><body>` is read: the front matter (title page, epistles) and
 * the back matter are not the work. Before anything is read, page breaks
 * go, forme work (running heads, catchwords, signatures) and notes are
 * dropped and counted, a word the line end hyphenated (`<g
 * ref="char:EOLhyphen"/>`) is joined again, and a gap reads as the mark the
 * transcribers set for it. The body is then set as HTML, a head at the
 * level of its division's depth (a book's heads h2, a chapter's h3), `<p>`
 * as paragraphs and `<l>` as verse lines, and read as the Gutenberg reader
 * reads an edition (./gutenberg.js).
 *
 * `parseXml` is the caller's XML parser and `parse` its HTML parser.
 * Imported only by scripts/school-ingest.mjs.
 */

import { dropFurniture, readUnits } from './gutenberg.js';

const countWords = text => String(text).split(/\s+/u).filter(Boolean).length;
const flat = text => String(text).replace(/\s+/gu, ' ').trim();
const JOINS = new Set(['char:EOLhyphen', 'char:EOLunhyphen']);
const BLOCKS = { p: 'p', div: 'div', lb: 'br', table: 'table', row: 'tr', cell: 'td', list: 'ul', item: 'li', figure: 'div',
    closer: 'div', opener: 'div', signed: 'div', trailer: 'div', salute: 'div', dateline: 'div', byline: 'div', argument: 'div',
    epigraph: 'div', lg: 'div', sp: 'div', speaker: 'div' };

function source(xml, parseXml) {
    const doc = parseXml(String(xml));
    if (doc.getElementsByTagName('parsererror').length) throw new Error('the TEI does not parse as XML');
    return doc;
}

/** The header's availability statement, as one line. */
export function teiAvailability(xml, parseXml) {
    const availability = source(xml, parseXml).getElementsByTagName('availability')[0];
    if (!availability) throw new Error('the TEI header states no availability');
    return flat(availability.textContent);
}

function drop(elements) {
    let total = 0;
    for (const element of [...elements]) {
        total += countWords(element.textContent);
        element.remove();
    }
    return total;
}

/** The TEI element as HTML, built in `html`; a head takes the level of its division. */
function convert(node, html, depth) {
    if (node.nodeType === 3) return html.createTextNode(node.data);
    if (node.nodeType !== 1) return null;
    const name = node.localName;
    const verse = (name === 'q' || name === 'lg') && node.getElementsByTagName('l').length;
    // Only a division's head is a heading; a figure's, table's or list's is a caption, read as a paragraph.
    const head = name === 'head' && node.parentNode?.localName === 'div';
    const tag = head ? `h${Math.min(6, depth + 1)}` : name === 'head' ? 'p' : verse ? 'div' : name === 'l' ? 'div' : BLOCKS[name] ?? 'span';
    const element = html.createElement(tag);
    if (verse) element.className = 'poem';
    const inner = name === 'div' ? depth + 1 : depth;
    for (const child of node.childNodes) {
        const converted = convert(child, html, inner);
        if (converted) element.append(converted);
    }
    return element;
}

export function readTei(xml, parseXml, parse, recipe) {
    const doc = source(xml, parseXml);
    const body = doc.getElementsByTagName('body')[0];
    if (!body) throw new Error('the TEI has no <body>');
    const dropped = {};
    const add = (kind, count) => { if (count) dropped[kind] = (dropped[kind] || 0) + count; };
    drop(body.getElementsByTagName('pb'));
    add('forme work', drop(body.getElementsByTagName('fw')));
    add('notes', drop(body.getElementsByTagName('note')));
    for (const gap of [...body.getElementsByTagName('gap')]) {
        gap.replaceWith(doc.createTextNode(flat(gap.textContent)));
    }
    body.normalize();
    for (const g of [...body.getElementsByTagName('g')].filter(g => JOINS.has(g.getAttribute('ref')))) {
        const next = g.nextSibling;
        g.remove();
        if (next?.nodeType === 3) next.data = next.data.trimStart();
    }

    const html = parse('<!DOCTYPE html><html><body></body></html>');
    for (const child of body.childNodes) {
        const converted = convert(child, html, 0);
        if (converted) html.body.append(converted);
    }
    for (const [kind, count] of Object.entries(dropFurniture(html, {}))) add(kind, count);
    return readUnits(html, recipe, dropped);
}
