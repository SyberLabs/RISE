// Rotating hints diversify Jev's single decision without replacing its judgment.
// The caller supplies a persisted, atomic turn number; no reader text is stored here.
const DIRECTIONS = Object.freeze([
  'a prismatic continuous Gallery (visualStyle=psychedelic, visualEngine=fractal, colorTheme=prism)',
  'energetic growing line art (visual=genesis, kleePreset=chaotic, colorTheme=ember)',
  'a luminous strange attractor (visual=attractor, visualPalette=purple, colorTheme=amethyst)',
  'a spectral Gallery (visual=interlocution, visualEngine=apparitio, colorTheme=cobalt)',
  'soft atmospheric light (visual=interlocution, visualEngine=turrell, colorTheme=jade)',
  'an iridescent radial Gallery (visual=interlocution, visualEngine=ostensoria, colorTheme=ember)',
  'fine harmonic line work (visual=interlocution, visualEngine=harmonograph, colorTheme=amethyst)',
  'a single still focal figure (visual=focals, visualStyle=quiet, colorTheme=classic)'
]);

export const VARIATION_COUNT = DIRECTIONS.length;
const TEXT_SECTIONS = Object.freeze(['first', 'middle', 'last', 'shortest', 'longest']);

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
  return !namesCatalogEntry(intent, books) && /^(?:surprise me(?: with .+)?|anything(?: is fine)?|(?:choose|pick) (?:a book |something )?for me|recommend (?:me )?something|what should i read|i don t know what to read)(?: please)?$/u.test(normalized);
}

export function buildJevVarianceHints({ books, intent = '', turn }) {
  const index = Number.isSafeInteger(turn) && turn >= 0 ? turn : 0;
  const slot = index % VARIATION_COUNT;
  const catalog = Array.isArray(books) ? [...books].sort((a, b) => a.work_id.localeCompare(b.work_id)) : [];
  const cohort = slot % 2;
  const narrow = catalog.length > 1 && isOpenEnded(intent, catalog);
  const eligibleBooks = narrow ? catalog.filter((_, position) => position % 2 === cohort) : catalog;
  const focusWorkId = eligibleBooks.length ? eligibleBooks[Math.floor(slot / 2) % eligibleBooks.length].work_id : null;
  const direction = DIRECTIONS[slot];
  const sectionHint = narrow ? TEXT_SECTIONS[slot % TEXT_SECTIONS.length] : null;

  return {
    eligibleBooks,
    bookHint: focusWorkId
      ? `When several readings fit the reader equally well, consider ${focusWorkId} on this turn. A named or clearly requested work and the reader's intent always take priority.`
      : 'Choose the reading that best fits the reader intent.',
    configHint: `If unspecified, consider ${direction}${sectionHint ? ` and section=${sectionHint}` : ''}. Explicit reader preferences always take priority; select only offered values.`,
    variation: { turn: index, focusWorkId, directionIndex: slot,
      sectionHint, cohort: narrow ? cohort : null }
  };
}
