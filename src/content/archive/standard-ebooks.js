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
  'article[epub\\:type~="z3998:essay"]',
  'section[epub\\:type~="chapter"]',
  'article[epub\\:type~="chapter"]',
  'section[epub\\:type~="epilogue"]',
  'section[epub\\:type~="z3998:drama"]',
  // A preface INSIDE the bodymatter is the work — Longfellow sets a sonnet
  // before each canticle of the Commedia. A preface the edition files as
  // frontmatter never reaches here, because the file is skipped whole.
  // A numbered saying, or a numbered part of a long poem: the edition marks it
  // as its own unit, so it is one. The Analects is five hundred of them, which
  // is the verse-inside-chapter shape the Dhammapada was the only test of.
  'section[epub\\:type~="z3998:subchapter"]',
  'section[epub\\:type~="preface"]'
].join(',');

/**
 * The blocks a part is built from, in the order the edition put them.
 *
 * `cite` earns its place: a quoted poem's attribution sits beside the verse
 * rather than inside it, so leaving it out dropped "T. Carew" from Walden —
 * two words, caught by the reconciliation, which is the point of a check that
 * tolerates no loss rather than a small one.
 */
const BLOCK_SELECTOR = ['p', 'tr', 'cite',
  // A letter's signature is set as its own element rather than a paragraph —
  // Ulysses sets Milly's as a `<b>` — so one word of Joyce went missing until
  // the reconciliation refused the payload. Only the outermost block counts,
  // so an inline emphasis inside a paragraph is still read with its paragraph.
  '[epub\\:type~="z3998:signature"]',
  '[epub\\:type~="z3998:valediction"]'
].join(',');

/** Sections that group readings rather than being one. */
const CONTAINER_SELECTOR = [
  'section[epub\\:type~="part"]',
  'section[epub\\:type~="division"]',
  'section[epub\\:type~="volume"]'
].join(',');

export class StandardEbooksStructureError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'StandardEbooksStructureError';
    this.details = details;
  }
}

const clean = value => String(value ?? '').replace(/\s+/gu, ' ').trim();

/**
 * A NOTE MARKER IS NOT A WORD.
 *
 * An endnote reference is a superscript digit set against the word it follows,
 * so reading the text plainly gives "During a Tour5" and "murmur.6—Once
 * again". The notes themselves live in a backmatter file this importer never
 * opens; the marker is apparatus and goes with them.
 *
 * The word reconciliation cannot see this. A marker adds no token — it fuses
 * to the word beside it — so the counts balance while the text is wrong. It
 * was found by reading Tintern Abbey, which is the only way it could be.
 * Longfellow's Commedia carries 2,109 of them.
 */
function stripApparatus(doc) {
  for (const marker of doc.querySelectorAll('[epub\\:type~="noteref"]')) marker.remove();
  return doc;
}

function tag(node) {
  return node?.tagName ? node.tagName.toLowerCase() : '';
}

/**
 * Whether a block is verse, asked of the markup rather than assumed.
 *
 * A printed break between lines settles it. Failing that, a block whose whole
 * text sits inside spans is a stanza whose lines happen not to need a break —
 * a single-line stanza. A block with text OUTSIDE its spans is prose that
 * happens to mark a word, which is what Thoreau's Greek is.
 */
function isVerse(block) {
  if ([...block.children].some(child => tag(child) === 'br')) return true;
  const spans = [...block.children].filter(child => tag(child) === 'span');
  if (!spans.length) return false;
  return clean(spans.map(span => span.textContent).join(' ')) === clean(block.textContent);
}

function verseLines(block) {
  if (![...block.children].some(child => tag(child) === 'br')) {
    return [...block.children]
      .filter(child => tag(child) === 'span')
      .map(span => clean(span.textContent));
  }
  const lines = [];
  let current = '';
  for (const node of block.childNodes) {
    if (tag(node) === 'br') {
      lines.push(clean(current));
      current = '';
      continue;
    }
    current += node.textContent ?? '';
  }
  lines.push(clean(current));
  return lines;
}

/**
 * The text of one block, keeping the source's own line division.
 *
 * A SPAN IS NOT A LINE. Reading every span as a verse line looked right
 * against a poem, where the lines happen to be spans — and it was a decision
 * rather than a reading. Standard Ebooks also uses a span inline, for a
 * foreign word or a name, so a paragraph of Thoreau carrying
 * `<span xml:lang="el">γεἱβω</span>` was read as a two-line poem of Greek and
 * the 412 words of prose around it were dropped. The word reconciliation
 * refused the payload, which is the only reason this is a story about a bug
 * rather than a story about Walden.
 */
function stanzaText(block) {
  if (!isVerse(block)) return clean(block.textContent);
  return verseLines(block).filter(Boolean).join('\n');
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
    .map(cell => stanzaText(cell))
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
  // A HEADING GROUP IS ONE HEADING. The Analects sets "Book I" over its
  // Chinese title in an hgroup, and reading only the `h2` left the second line
  // to be picked up as prose — counted once as a title and once as content.
  const heading = element.querySelector('hgroup') || element.querySelector('h1,h2,h3,h4,h5,h6');
  const title = heading ? clean(heading.textContent) : null;

  // A PART IS ITS OWN BLOCKS. A chapter may hold numbered sub-parts, and each
  // of those is a reading in its own right — but the prose the chapter itself
  // carries before them is the chapter's, and taking only the innermost part
  // dropped 2,191 words of Dostoevsky.
  const nested = [...element.querySelectorAll(PART_SELECTOR)];
  // A block inside another block is read with its container, so taking both
  // would count the same words twice — a paragraph inside a table row, a
  // citation inside a paragraph. Only the outermost is a block of its own.
  const candidates = [...element.querySelectorAll(BLOCK_SELECTOR)]
    .filter(block => !nested.some(part => part.contains(block)))
    .filter(block => !block.closest('hgroup,h1,h2,h3,h4,h5,h6'));
  const elements = candidates.filter(block => !candidates.some(
    other => other !== block && other.contains(block)));
  const blocks = elements.map(blockText).filter(Boolean);
  const lines = elements.reduce((total, block) => total
    + (isVerse(block) ? verseLines(block).filter(Boolean).length : 0), 0);

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
 * Container headings that sit INSIDE a file rather than owning one.
 *
 * The Tao Te Ching puts its two Parts and all eighty-one chapters in a single
 * file, so `Part I` and `Part II` belong to no reading and would simply
 * vanish. They are recorded, and counted, so the reconciliation stays honest.
 */
export function readContainerHeadings(xhtml, parse) {
  const doc = stripApparatus(parse(String(xhtml)));
  // A section that holds parts and no prose of its own names them. It may be
  // marked as a container — a Book, a Volume — or be a chapter whose whole
  // body is numbered sayings, as the Analects is.
  return [...doc.querySelectorAll(`${CONTAINER_SELECTOR},${PART_SELECTOR}`)]
    .filter(section => section.querySelector(PART_SELECTOR))
    .filter(section => {
      const nested = [...section.querySelectorAll(PART_SELECTOR)];
      return ![...section.querySelectorAll(BLOCK_SELECTOR)].some(
        block => !nested.some(part => part.contains(block))
          && !block.closest('hgroup,h1,h2,h3,h4,h5,h6'));
    })
    .map(section => {
      const heading = [...section.children]
        .find(child => /^(?:h[1-6]|hgroup)$/u.test(tag(child)));
      return heading ? clean(heading.textContent) : '';
    })
    .filter(Boolean);
}

/**
 * A file that groups the readings after it, rather than being one.
 *
 * Middlemarch gives each Book its own file holding nothing but the label and
 * the title — `<section epub:type="part">` with an hgroup and no prose. It is
 * the edition naming a group, and treating it as a missing reading was the
 * importer failing to tell a container from a text.
 *
 * @returns {string|null} the container's name, or null if this is not one
 */
export function readContainerName(xhtml, parse) {
  const doc = stripApparatus(parse(String(xhtml)));
  const section = doc.querySelector(CONTAINER_SELECTOR);
  if (!section) return null;
  // A paragraph inside an hgroup is the second line of a heading — "Book I"
  // over "Miss Brooke" — not prose. Counting it made Middlemarch's Books look
  // like readings with one sentence in them.
  const prose = [...section.querySelectorAll(BLOCK_SELECTOR)]
    .filter(block => !block.closest('hgroup,h1,h2,h3,h4,h5,h6'));
  if (prose.length) return null;
  const heading = section.querySelector('hgroup,h1,h2,h3');
  return heading ? clean(heading.textContent) : null;
}

/**
 * Parse one Standard Ebooks XHTML file into the parts it declares.
 *
 * @param {string} xhtml
 * @param {(markup: string) => Document} parse a DOM parser (jsdom in Node)
 * @returns {Array<object>}
 */
export function readStandardEbooksFile(xhtml, parse) {
  const doc = stripApparatus(parse(String(xhtml)));
  // Every part, outer and inner, in the order the edition set them. Each keeps
  // only its own blocks, so nothing is counted twice and nothing is dropped;
  // a part left with no blocks of its own is a container and is recorded as
  // one by readContainerHeadings rather than served as an empty reading.
  return [...doc.querySelectorAll(PART_SELECTOR)]
    .map(readPart)
    .filter(part => part.content);
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
export function reconcileWords(xhtml, parts, parse, extra = []) {
  const doc = stripApparatus(parse(String(xhtml)));
  const body = doc.querySelector('body');
  const sourceWords = clean(body ? body.textContent : '').split(' ').filter(Boolean).length;
  const counted = [
    ...parts.map(part => `${part.title || ''} ${part.content}`),
    ...extra
  ];
  const importedWords = counted.reduce((total, text) => total
    + clean(text).split(' ').filter(Boolean).length, 0);
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
