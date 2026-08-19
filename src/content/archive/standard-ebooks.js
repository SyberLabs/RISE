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
  // `z3998:subchapter` IS NOT HERE, DELIBERATELY.
  //
  // It was, briefly, because the Analects marks each saying with one and those
  // sayings are what a reader wants. But the word means a subdivision OF a
  // chapter, and a division is what a reader ENTERS — so reading subchapters
  // as divisions put twenty-three entries named "I" through "XXIII" on the
  // shelf beside Tintern Abbey, each a stanza group of one poem, The Thorn,
  // broken apart to make them. A subdivision belongs to its division, its
  // printed headings with it, and is addressed inside it by the extent grammar.
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
// Outermost first. A container closes every open container at its own depth
// or deeper: Karamazov's Part I holds Books I to III, and Part II opens with
// Book IV, so the Part must close the Book before it closes itself.
const CONTAINER_RANK = Object.freeze(['volume', 'part', 'division']);

function hasType(element, type) {
  return (element.getAttribute('epub:type') || '').split(/\s+/u).includes(type);
}

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
  // A HEADING IS NEVER VERSE. Standard Ebooks sets a label and its ordinal as
  // separate spans — "Part" and "Second" — and the verse test reads a block
  // whose whole text sits in spans as a stanza, so Hart-Leap Well's second
  // half was announced on two lines.
  if (/^(?:h[1-6]|hgroup)$/u.test(tag(element))) return clean(element.textContent);
  return tag(element) === 'tr' ? rowText(element) : stanzaText(element);
}

/**
 * The headings that belong to THIS section rather than to one inside it.
 *
 * "Part Second" over the second half of Hart-Leap Well is printed in the book
 * and belongs to the reading; it is not the reading's title.
 */
function ownHeadings(element) {
  const inner = [...element.querySelectorAll('section,article')];
  return [...element.querySelectorAll('hgroup,h1,h2,h3,h4,h5,h6')]
    .filter(node => !inner.some(section => section.contains(node)));
}

function ownHeading(element) {
  const headings = ownHeadings(element);
  return headings.find(node => tag(node) === 'hgroup') || headings[0] || null;
}

/** The word a section uses for itself, when its heading is only a number. */
const UNIT_WORDS = Object.freeze({
  chapter: 'Chapter', part: 'Part', volume: 'Volume', division: 'Book',
  preface: 'Preface', epilogue: 'Epilogue'
});

/** The unit a section calls itself, or null where it names none. */
function unitWord(element) {
  return (element.getAttribute('epub:type') || '').split(/\s+/u)
    .map(token => UNIT_WORDS[token])
    .find(Boolean) || null;
}

/**
 * A HEADING IS STRUCTURED, AND IS NOT ONE STRING.
 *
 * Standard Ebooks marks a heading's parts: `se:label` is the unit word,
 * `z3998:ordinal` the number, `epub:type="title"` the title. Read flat by
 * `textContent` they smash into each other — "Book I The Contention of
 * Achilles", and, where the label is printed by the stylesheet rather than
 * written, "I Fyodor Pavlovitch Karamazov", whose numeral restarts at every
 * Book and so explains nothing on a flat shelf.
 *
 * A position and a title are two facts and are joined as a book joins them.
 *
 * Middlemarch and the Tao Te Ching both set a chapter's heading as
 * `<h3 epub:type="z3998:ordinal z3998:roman">I</h3>` and let the stylesheet
 * print the word "Chapter" from the section's own type. Read plainly that is
 * eighty-one entries called "I" through "LXXXI", which is what the shelf
 * showed. The unit word is declared on the section and the number in the
 * heading; putting them together reads two facts rather than inventing one,
 * and it is what RISE's own divider does when it says "Essay 12".
 */
function marked(heading, type) {
  const nodes = [heading, ...heading.querySelectorAll('*')].filter(
    node => (node.getAttribute('epub:type') || '').split(/\s+/u).includes(type));
  const outermost = nodes.filter(
    node => !nodes.some(other => other !== node && other.contains(node)));
  return clean(outermost.map(node => node.textContent).join(' ')) || null;
}

/**
 * What the edition calls this part's POSITION — "Book I", "Canto XXIII".
 *
 * The label may be printed by the stylesheet rather than written in the
 * heading, in which case the section's own type supplies the word.
 */
function designation(element, heading) {
  const ordinal = marked(heading, 'z3998:ordinal');
  if (!ordinal) return null;
  const label = marked(heading, 'se:label') || unitWord(element);
  return label ? `${label} ${ordinal}` : ordinal;
}

function partTitle(element, heading) {
  if (!heading) return null;
  const text = clean(heading.textContent);
  if (!text) return null;
  const title = marked(heading, 'title');
  const position = designation(element, heading);
  if (title && position) return `${position}: ${title}`;
  return title || position || text;
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
  // ONLY THE PART'S OWN HEADING IS ITS TITLE. A heading inside a subdivision
  // — "Part Second" over the second half of Hart-Leap Well, the numeral over
  // an Analects saying — is printed in the book and belongs to the reading, so
  // it is read as a line of content below rather than mistaken for the title.
  const headings = ownHeadings(element);
  const heading = ownHeading(element);
  const title = partTitle(element, heading);
  // WHAT THE DOCUMENT SAID, beside what the reader is shown. The unit word in
  // "Chapter I" is printed by the stylesheet from the section's type and is
  // not in the text, so the reconciliation must weigh the heading as written
  // or every such title would read as a word we invented.
  const sourceTitle = heading ? clean(heading.textContent) : null;

  // A PART IS ITS OWN BLOCKS. A chapter may hold nested parts of its own, and
  // the prose it carries before them is still the chapter's — taking only the
  // innermost part dropped 2,191 words of Dostoevsky.
  const nested = [...element.querySelectorAll(PART_SELECTOR)];
  // A block inside another block is read with its container, so taking both
  // would count the same words twice — a paragraph inside a table row, a
  // citation inside a paragraph. Only the outermost is a block of its own.
  const candidates = [...element.querySelectorAll(`${BLOCK_SELECTOR},hgroup,h1,h2,h3,h4,h5,h6`)]
    .filter(block => !nested.some(part => part.contains(block)))
    .filter(block => block !== heading && !heading?.contains(block))
    .filter(block => !headings.some(other => other !== block && other.contains(block)));
  const elements = candidates.filter(block => !candidates.some(
    other => other !== block && other.contains(block)));
  const blocks = elements.map(blockText).filter(Boolean);
  const lines = elements.reduce((total, block) => total
    + (isVerse(block) ? verseLines(block).filter(Boolean).length : 0), 0);

  return {
    id: element.getAttribute('id') || null,
    title,
    sourceTitle,
    // The word this section uses for itself, for a reading with no heading.
    unit: unitWord(element),
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
  const heading = ownHeading(section);
  if (!heading) return null;
  return {
    name: partTitle(section, heading),
    // What a reading inside this container is prefixed with, and the depth at
    // which an opening container closes the ones already open.
    prefix: designation(section, heading) || clean(heading.textContent),
    rank: CONTAINER_RANK.findIndex(type => hasType(section, type))
  };
}

/**
 * Parse one Standard Ebooks XHTML file into the parts it declares.
 *
 * @param {string} xhtml
 * @param {(markup: string) => Document} parse a DOM parser (jsdom in Node)
 * @returns {Array<object>}
 */
/**
 * A NESTED PART CARRIES ITS PARENT'S NAME.
 *
 * The Library is a flat list of readings, and the edition's hierarchy is real:
 * the Ancient Mariner's seven parts are each titled "I" through "VII", and
 * shown beside Tintern Abbey they read as nothing at all. Composing
 * "parent · child" is a faithful flattening of two facts the edition stated,
 * not a title we invented — it is the same shape `extentSourceName` already
 * uses for "Essays · Essay 42".
 *
 * A child with no heading of its own takes its POSITION among its siblings.
 * Hart-Leap Well leaves its first part unlabelled and calls only the second
 * "Part Second", so the first arrived named `hart-leap-well-part-1` — an id
 * leaking into the reading, which is the one thing an id must never do.
 */
function nameParts(parts) {
  return parts.map(part => {
    const ancestor = part.element.parentElement
      ?.closest(`${PART_SELECTOR},${CONTAINER_SELECTOR}`) || null;
    const head = ancestor ? ownHeading(ancestor) : null;
    // A PARENT LENDS ITS POSITION, NOT ITS WHOLE HEADING. Composing the full
    // one gives "Book I: The History of a Family · Chapter I: Fyodor
    // Pavlovitch Karamazov"; the Book's own title is recorded with the
    // containers and is not needed to locate the child.
    const above = head ? (designation(ancestor, head) || clean(head.textContent)) : '';
    const siblings = parts.filter(other => (other.element.parentElement
      ?.closest(`${PART_SELECTOR},${CONTAINER_SELECTOR}`) || null) === ancestor);
    const own = part.title || part.unit || String(siblings.indexOf(part) + 1);
    return {
      ...part,
      composed: Boolean(above),
      name: above ? `${above} · ${own}` : (part.title || null)
    };
  });
}

export function readStandardEbooksFile(xhtml, parse) {
  const doc = stripApparatus(parse(String(xhtml)));
  // Every part, outer and inner, in the order the edition set them. Each keeps
  // only its own blocks, so nothing is counted twice and nothing is dropped;
  // a part left with no blocks of its own is a container and is recorded as
  // one by readContainerHeadings rather than served as an empty reading.
  const parts = [...doc.querySelectorAll(PART_SELECTOR)]
    .map(element => ({ element, ...readPart(element) }));
  return nameParts(parts)
    .filter(part => part.content)
    .map(({ element, own, ...part }) => part);
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
    ...parts.map(part => `${part.sourceTitle ?? part.title ?? ''} ${part.content}`),
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
    // `name`, never `id`. A slug is how a curator addresses a part; it is not
    // what a reader is shown, and falling back to one put
    // `hart-leap-well-part-1` on the shelf beside Tintern Abbey.
    name: part.name || part.title || 'Untitled',
    content: part.content
  }));
}
