// Rotating hints diversify Jev's single decision without replacing its judgment.
// The caller supplies a persisted, atomic turn number; no reader text is stored here.
const DIRECTIONS = Object.freeze([
  'a prismatic Gallery (visualStyle=psychedelic, visualEngine=fractal, colorTheme=prism, pace=250, chunk=word, audio=faded-signal, chamberFace=thick, fontSize=fit)',
  'energetic line art (visual=genesis, kleePreset=chaotic, colorTheme=ember, pace=300, chunk=phrase, audio=faded-signal, chamberFace=thick, fontSize=large)',
  'soft atmospheric light (visual=interlocution, visualEngine=turrell, colorTheme=jade, pace=150, chunk=phrase, audio=aurora, chamberFace=literary, fontSize=large)',
  'fine harmonic line work (visual=interlocution, visualEngine=harmonograph, colorTheme=amethyst, pace=100, chunk=paragraph, audio=silent, chamberFace=literary, fontSize=medium)'
]);

export const VARIATION_COUNT = DIRECTIONS.length;

function words(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/gu, ' ');
}

function namesCatalogEntry(intent, books) {
  const phrase = ` ${words(intent)} `;
  return books.some(book => [book.title, book.author]
    .some(name => words(name).length > 2 && phrase.includes(` ${words(name)} `)));
}

function isOpenEnded(intent, books) {
  const normalized = words(intent);
  // Only explicit discovery requests can safely lose half the catalog.
  // A short thematic request still needs every book for relevance.
  return !namesCatalogEntry(intent, books) && /^(?:surprise me(?: with (?:a )?book)?|anything(?: is fine)?|(?:choose|pick) (?:a book |something )?for me|recommend (?:me )?something|what should i read|i don t know what to read)(?: please)?$/u.test(normalized);
}

export function buildJevVarianceHints({ books, intent = '', turn }) {
  const index = Number.isSafeInteger(turn) && turn >= 0 ? turn : 0;
  const catalog = Array.isArray(books) ? [...books].sort((a, b) => a.work_id.localeCompare(b.work_id)) : [];
  const cohort = index % 2;
  const narrow = catalog.length > 1 && isOpenEnded(intent, catalog);
  const eligibleBooks = narrow ? catalog.filter((_, position) => position % 2 === cohort) : catalog;
  const focusWorkId = eligibleBooks.length ? eligibleBooks[Math.floor(index / 2) % eligibleBooks.length].work_id : null;
  const direction = DIRECTIONS[index % DIRECTIONS.length];

  return {
    eligibleBooks,
    bookHint: focusWorkId
      ? `When several readings fit the reader equally well, consider ${focusWorkId} on this turn. A named or clearly requested work and the reader's intent always take priority.`
      : 'Choose the reading that best fits the reader intent.',
    configHint: narrow
      ? `For this open discovery request, consider ${direction} as a coherent direction this turn. Explicit reader preferences always take priority; select only offered values.`
      : 'Choose every presentation setting to fit the reader intent. Explicit reader preferences always take priority; select only offered values.',
    variation: { turn: index, focusWorkId, directionIndex: index % DIRECTIONS.length, cohort: narrow ? cohort : null }
  };
}
