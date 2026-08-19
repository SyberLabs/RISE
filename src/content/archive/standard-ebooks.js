/**
 * Reading a Standard Ebooks edition, which already knows its own shape.
 *
 * Every ingest before this one was archaeology: a flat text arrived, and RISE
 * guessed where the chapters were, whether a line break was the poet's or the
 * file's, and which lines were headings. It guessed wrong often enough to
 * delete 303 words of Walden and 11,359 of Leaves of Grass, and no detector we
 * own could ever have found that, because a missing line has no shape
 * (ARCHIVE-CLEANSING-SPEC §2j).
 *
 * A Standard Ebooks edition declares all of it:
 *
 *     <article epub:type="z3998:poem" id="hod-putt">   a poem, with a slug
 *       <h2 epub:type="title">Hod Putt</h2>            its title
 *       <p>                                            a stanza
 *         <span>Here I lie close to the grave</span>   a verse line
 *
 * So this module READS structure rather than inferring it. It is deliberately
 * dumb: it walks the source's own elements and refuses anything it does not
 * recognise, because the one thing an importer must never do is decide.
 *
 * A slug is worth more than an ordinal. `spoon-river#hod-putt` says what a
 * reader is being handed; `spoon-river#87` does not.
 */

/** Elements Standard Ebooks uses for a work's addressable parts. */
const PART_SELECTOR = [
  'article[epub\\:type~="z3998:poem"]',
  'article[epub\\:type~="z3998:song"]',
  'section[epub\\:type~="chapter"]',
  'article[epub\\:type~="chapter"]',
  'section[epub\\:type~="epilogue"]',
  'section[epub\\:type~="z3998:drama"]'
].join(',');

/** The blocks a part is built from, in the order the edition put them. */
const BLOCK_SELECTOR = 'p,tr';

/** A line break inside a stanza is the poet's; a stanza break is a paragraph. */
const LINE = 'span';

export class StandardEbooksStructureError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'StandardEbooksStructureError';
    this.details = details;
  }
}

const clean = value => String(value ?? '').replace(/\s+/gu, ' ').trim();

/**
 * The text of one stanza, keeping the source's own line division.
 *
 * A `<p>` holding `<span>` lines is verse and each span is a line. A `<p>`
 * holding no spans is prose and is one paragraph. Nothing here decides which;
 * the edition already did.
 */
function stanzaText(paragraph) {
  const lines = [...paragraph.querySelectorAll(LINE)];
  if (!lines.length) return clean(paragraph.textContent);
  return lines.map(line => clean(line.textContent)).filter(Boolean).join('\n');
}

/**
 * A verse drama sets its dialogue as a table: a `persona` cell naming the
 * speaker, and the cells beside it carrying what they say.
 *
 * The speaker is kept on its own line rather than joined to the line with a
 * colon, because a colon is punctuation the edition did not print and this
 * module does not invent any.
 */
function rowText(row) {
  return [...row.children]
    .map(cell => (cell.querySelectorAll(LINE).length
      ? stanzaText(cell)
      : clean(cell.textContent)))
    .filter(Boolean)
    .join('\n');
}

function blockText(element) {
  return element.tagName?.toLowerCase() === 'tr' ? rowText(element) : stanzaText(element);
}

/**
 * One addressable part — a poem, a song, a chapter, a verse drama.
 *
 * @returns {{ id: string, title: string|null, kind: string, content: string,
 *   stanzas: number, lines: number }}
 */
function readPart(element) {
  const heading = element.querySelector('h1,h2,h3,h4,h5,h6');
  const title = heading ? clean(heading.textContent) : null;
  if (heading) heading.remove();

  // A paragraph inside a table row belongs to that row and is read with it,
  // so taking both would count the same words twice.
  const elements = [...element.querySelectorAll(BLOCK_SELECTOR)]
    .filter(block => block.tagName.toLowerCase() === 'tr' || !block.closest('tr'));
  const blocks = elements.map(blockText).filter(Boolean);
  const lines = elements.reduce(
    (total, block) => total + (block.querySelectorAll(LINE).length || 0), 0);

  return {
    id: element.getAttribute('id') || null,
    title,
    kind: (element.getAttribute('epub:type') || '').includes('poem') ? 'poem' : 'division',
    content: blocks.join('\n\n'),
    stanzas: blocks.length,
    lines
  };
}

/**
 * Parse one Standard Ebooks XHTML file into the parts it declares.
 *
 * @param {string} xhtml
 * @param {(markup: string) => Document} parse a DOM parser (jsdom in Node)
 * @returns {Array<object>}
 */
export function readStandardEbooksFile(xhtml, parse) {
  const doc = parse(String(xhtml));
  const parts = [...doc.querySelectorAll(PART_SELECTOR)];
  if (!parts.length) return [];
  // A part inside another part would be counted twice, and the inner one is
  // the real unit — a chapter wrapping poems is a container, not a reading.
  const innermost = parts.filter(part => !parts.some(
    other => other !== part && part.contains(other)));
  return innermost.map(readPart).filter(part => part.content);
}

/**
 * WORDS IN MUST EQUAL WORDS OUT.
 *
 * The check that would have caught §2j on the day it was made. The source's
 * own text, stripped of markup, against what the importer produced — a
 * difference is text the importer lost, and there is no acceptable amount.
 *
 * Headings are excluded from the payload body but counted here, because a
 * title is words the source carried.
 */
export function reconcileWords(xhtml, parts, parse) {
  const doc = parse(String(xhtml));
  const body = doc.querySelector('body');
  const sourceWords = clean(body ? body.textContent : '').split(' ').filter(Boolean).length;
  const importedWords = parts.reduce((total, part) => total
    + clean(`${part.title || ''} ${part.content}`).split(' ').filter(Boolean).length, 0);
  return { sourceWords, importedWords, lost: sourceWords - importedWords };
}

/**
 * Sections in the shape every other work on the shelf uses, so nothing
 * downstream learns a second vocabulary.
 */
export function sectionsFromParts(parts) {
  return parts.map(part => ({
    name: part.title || part.id || 'Untitled',
    content: part.content
  }));
}
