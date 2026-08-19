/**
 * RISE Library System
 * Infrastructure for sacred texts and literary sources
 */

import { STARTER_SEQUENCES } from './starters.js';
import { SACRED_TEXTS } from '../sources/text/sacred.js';
import { SACRED_DEEP } from '../sources/text/data/sacred_deep.js';
import { LITERARY_DEEP } from '../sources/text/data/literary_deep.js';
import { DECLASSIFIED_LIBRARY } from '../sources/text/declassified.js';
import { ARXIV_CATEGORIES } from '../sources/text/arxiv.js';
import EXTENDED_SACRED from '../sources/text/data/sacred_texts.json';
// Editorial judgement lives beside the corpus, not inside the provider
// adapters: a registration loop knows where a file came from, never why
// a work is worth an hour. See library-curation.js.
import { curationFor } from './library-curation.js';
// Rights are established per EDITION, and a work whose edition is not
// established does not reach a reader. See library-quarantine.js.
import { isQuarantined } from './library-quarantine.js';
// Works ingested from verified public-domain sources, each carrying its
// own edition, source digest, and rights basis. See scripts/archive-ingest.mjs.
import { ingestedArchiveTexts, WITHHELD_WORKS } from './archive/index.js';

/**
 * Library categories
 */
// The shelves and curation vocabulary live in library-constants.js so
// that this registry and library-curation.js can both use them without
// forming an import cycle. Re-exported here: callers have always asked
// the library for its categories, and should keep being able to.
export { LIBRARY_CATEGORIES, DIVISIONS, RESONANCE_FUNCTIONS, PD_BASIS } from './library-constants.js';

/**
 * Sacred text metadata template
 * @typedef {Object} SacredText
 * @property {string} id - Unique identifier
 * @property {string} title - Display title
 * @property {string} author - Original author
 * @property {string} translator - Translation attribution
 * @property {string} category - Category ID
 * @property {string} tradition - Spiritual tradition
 * @property {string} description - Brief description
 * @property {number} chapterCount - Number of chapters/verses
 * @property {string} defaultCurve - Default pacing curve
 * @property {number} defaultWpm - Default words per minute
 * @property {Function} getSequences - Function to load sequences
 */

/**
 * Library registry - metadata for all available texts
 * Will be populated from source providers
 */
export const LIBRARY_TEXTS = [];

/**
 * Register Starter Sequences as raw foundational texts
 */
function registerStarterTexts() {
    for (const seq of STARTER_SEQUENCES) {
        const textId = `starter-${seq.id}`;
        
        // Skip if ID already exists
        if (LIBRARY_TEXTS.find(t => t.id === textId)) continue;
        
        // Skip if a title-match exists (Deep version covers it)
        if (LIBRARY_TEXTS.find(t => t.title.toLowerCase() === seq.name.toLowerCase())) continue;

        // Transform the raw string content into an array of verses by splitting on paragraphs
        const verses = seq.content.split('\n\n').filter(p => p.trim() !== '');
        const structuredVerses = verses.map((verseText, idx) => ({
            name: `Segment ${idx + 1}`,
            description: verseText.substring(0, 60) + (verseText.length > 60 ? '...' : ''),
            content: verseText,
            wpm: seq.wpm || 200,
            curve: seq.curve || 'flat'
        }));

        registerText({
            id: textId,
            title: seq.name,
            author: 'RISE Core',
            // Composed here, not inherited. Kept distinct from the found
            // works because provenance is the Archive's central promise:
            // a reader should always know which they are meeting.
            category: 'composed',
            tradition: 'Core System',
            description: seq.description,
            chapterCount: verses.length,
            defaultCurve: seq.curve || 'flat',
            defaultWpm: seq.wpm || 200,
            tags: ['starter', seq.category],
            verses: structuredVerses,
            provider: 'starters',
            getSequences: () => structuredVerses
        });
    }
}

/**
 * Register High-Fidelity Deep Texts (Priority 1)
 */
function registerDeepSacredTexts() {
    for (const [id, text] of Object.entries(SACRED_DEEP)) {
        registerText({
            id: `sacred-${id}`,
            title: text.title,
            author: text.author,
            category: 'sacred',
            tradition: text.tradition,
            description: text.description,
            chapterCount: text.sequences.length,
            defaultCurve: text.defaultCurve || 'induction',
            defaultWpm: text.defaultWpm || 120,
            tags: text.tags || ['sacred', 'deep'],
            verses: text.sequences,
            provider: 'sacred-deep',
            getSequences: () => text.sequences
        });
    }
}

/**
 * Register Simplified Sacred Texts (Priority 3 - Fallback)
 */
function registerSimplifiedSacredTexts() {
    for (const [id, text] of Object.entries(SACRED_TEXTS)) {
        const textId = `sacred-${id}`;

        // The verified Arnold Gita keeps the historical extended id.
        // Retire the unverified simplified alias instead of exposing the
        // same work twice under incompatible provenance.
        if (textId === 'sacred-bhagavad-gita') continue;
        
        // Skip if ID already exists
        if (LIBRARY_TEXTS.find(t => t.id === textId)) continue;
        
        // Skip if a title-match exists (Deep or Extended version covers it)
        if (LIBRARY_TEXTS.find(t => t.title.toLowerCase().includes(text.title.toLowerCase()))) continue;

        const structuredVerses = text.verses.map((verseText, idx) => ({
            name: `Verse ${idx + 1}`,
            description: verseText.substring(0, 60) + (verseText.length > 60 ? '...' : ''),
            content: verseText,
            wpm: 220,
            curve: 'induction'
        }));

        registerText({
            id: textId,
            title: text.title,
            author: text.author,
            category: 'sacred',
            tradition: text.tradition,
            description: `${text.verses.length} verses from ${text.tradition} tradition`,
            chapterCount: text.verses.length,
            defaultCurve: 'induction',
            defaultWpm: 220,
            tags: text.tags,
            verses: structuredVerses,
            provider: 'sacred-texts',
            getSequences: () => structuredVerses
        });
    }
}

/**
 * Register curated local literary texts (replaces Gutenberg)
 */
function registerLiteraryTexts() {
    for (const [id, text] of Object.entries(LITERARY_DEEP)) {
        registerText({
            id: `literary-${id}`,
            title: text.title,
            author: text.author,
            category: 'literary',
            tradition: text.tradition,
            description: text.description,
            chapterCount: text.sequences.length,
            defaultCurve: 'induction',
            defaultWpm: 190,
            tags: ['literary', 'curated'],
            verses: text.sequences,
            provider: 'literary-local',
            getSequences: () => text.sequences
        });
    }
}

/**
 * Register works ingested from verified public-domain sources.
 *
 * Unlike every other registration here, these arrive with their rights
 * already established at ingest time — edition, source URL, retrieval
 * date, and SHA-256 of the artifact as fetched. The registry does not
 * re-derive any of it; it carries what the ingest proved.
 */
function registerIngestedWorks() {
    for (const text of ingestedArchiveTexts()) registerText(text);
}

/**
 * Register Declassified Documents
 */
function registerDeclassifiedDocs() {
    for (const [id, doc] of Object.entries(DECLASSIFIED_LIBRARY)) {
        const verseObj = {
            name: 'Full Document',
            content: doc.content,
            wpm: 260,
            curve: 'induction',
            description: 'Declassified Text'
        };

        registerText({
            id: `cia-${id}`,
            title: doc.title,
            author: doc.author,
            category: 'declassified',
            tradition: 'Intelligence',
            description: doc.summary,
            chapterCount: 1,
            defaultCurve: 'induction',
            defaultWpm: 260,
            tags: doc.tags,
            provider: 'cia-declassified',
            verses: [verseObj],
            getSequences: () => [verseObj]
        });
    }
}

/**
 * Register ArXiv Categories as Collections
 */
function registerResearchPapers() {
    for (const [id, cat] of Object.entries(ARXIV_CATEGORIES)) {
        registerText({
            id: `arxiv-${id}`,
            title: cat.name,
            author: 'ArXiv.org',
            category: 'research',
            tradition: 'Scientific',
            description: `Live research abstracts on ${cat.name}`,
            chapterCount: 0, // Dynamic
            defaultCurve: 'flat',
            defaultWpm: 360,
            tags: cat.tags,
            provider: 'arxiv-research',
            isCollection: true,
            arxivCategory: id
        });
    }
}

/**
 * Register Extended Sacred Texts from JSON
 */
function registerExtendedSacredTexts() {
    if (!EXTENDED_SACRED) return;

    for (const [id, text] of Object.entries(EXTENDED_SACRED)) {
        const textId = `extended-${id}`;

        // This alias carried the same unverified modernized Tao payload
        // as the legacy sacred record. The exact Legge ingest now owns
        // the stable public entry, so the duplicate alias is retired.
        if (textId === 'extended-tao-te-ching-full') continue;
        
        // Skip if ID already exists
        if (LIBRARY_TEXTS.find(t => t.id === textId)) continue;
        
        // Skip if a title-match exists (Deep version covers it) 
        // We match loosely for "(Complete)" or "(Extended)" suffixes
        const normalizedTitle = text.title.replace(/\s*\((Complete|Extended|Selected)\)\s*/i, '').toLowerCase();
        if (LIBRARY_TEXTS.find(t => t.title.toLowerCase().includes(normalizedTitle))) continue;

        const structuredVerses = text.chapters.map((chapter, idx) => ({
            name: `Part ${idx + 1}`,
            description: chapter.substring(0, 80) + '...',
            content: chapter,
            wpm: 220,
            curve: 'induction'
        }));

        registerText({
            id: textId,
            title: text.title,
            author: text.author,
            category: text.category || 'sacred',
            tradition: text.tradition,
            description: text.description,
            chapterCount: text.chapters.length,
            defaultCurve: 'induction',
            defaultWpm: 220,
            tags: text.tags,
            verses: structuredVerses,
            provider: 'extended-sacred',
            getSequences: () => structuredVerses
        });
    }
}

/**
 * Register a text with the library
 * @param {SacredText} text - Text metadata
 */
export function registerText(text) {
    if (LIBRARY_TEXTS.find(t => t.id === text.id)) return;

    // A work whose rights are not established is withheld at the door.
    // Registration is the only path into the Archive, so refusing here
    // is what makes the quarantine real rather than advisory — a filter
    // applied at render time would leave the text reachable by any
    // caller that walked LIBRARY_TEXTS itself.
    if (isQuarantined(text.id)) return;

    // AND A WORK NOT IN THE CANON IS WITHHELD AT THE SAME DOOR.
    //
    // The Archive is registered first and the legacy excerpt collections
    // after it, and a duplicate id is skipped — so withholding an ingested
    // work did not remove it, it handed the reader the older unverified
    // excerpt of the same work instead. Eleven works came back through that
    // second door. A shelf with two doors is not a shelf.
    if (Object.hasOwn(WITHHELD_WORKS, text.id)) return;

    // Curation is applied HERE rather than in each provider loop, so a
    // new source cannot arrive unshelved by forgetting to ask. The
    // curated shelf wins over whatever category the adapter guessed:
    // where a work belongs is an editorial judgement, and the adapter
    // only knows which file it came out of.
    // Held-ness is asked of the withheld list rather than of LIBRARY_TEXTS,
    // which is still being built here and would make the answer depend on
    // registration order.
    const curation = curationFor(text.id, id => !Object.hasOwn(WITHHELD_WORKS, id));
    LIBRARY_TEXTS.push(curation
        ? {
            ...text,
            category: curation.shelf,
            traditionShelf: curation.traditionShelf || curation.shelf,
            subjectShelves: curation.subjectShelves || [],
            division: curation.division,
            why: curation.why,
            functions: curation.functions,
            rhymes: curation.rhymes,
            provenance: curation.provenance,
            structure: curation.structure,
            extent: curation.extent,
            caveats: curation.caveats
        }
        : text);
}

/**
 * Get all texts in a category
 * @param {string} categoryId - Category ID
 * @returns {SacredText[]}
 */
export function getTextsByCategory(categoryId) {
    return LIBRARY_TEXTS.filter(t => t.category === categoryId);
}

/**
 * Get a specific text by ID
 * @param {string} textId - Text ID
 * @returns {SacredText|undefined}
 */
export function getTextById(textId) {
    return LIBRARY_TEXTS.find(t => t.id === textId);
}

/**
 * Get all library texts
 * @returns {SacredText[]}
 */
export function getAllTexts() {
    return [...LIBRARY_TEXTS];
}

/**
 * Format verse/chapter number for display
 * @param {number} num - Chapter number
 * @param {string} style - 'arabic' | 'roman'
 * @returns {string}
 */
export function formatChapterNumber(num, style = 'arabic') {
    if (style === 'roman') {
        const romanNumerals = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
            'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
            'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX',
            'XXXI', 'XXXII', 'XXXIII', 'XXXIV', 'XXXV', 'XXXVI', 'XXXVII', 'XXXVIII', 'XXXIX', 'XL',
            'XLI', 'XLII', 'XLIII', 'XLIV', 'XLV', 'XLVI', 'XLVII', 'XLVIII', 'XLIX', 'L',
            'LI', 'LII', 'LIII', 'LIV', 'LV', 'LVI', 'LVII', 'LVIII', 'LIX', 'LX',
            'LXI', 'LXII', 'LXIII', 'LXIV', 'LXV', 'LXVI', 'LXVII', 'LXVIII', 'LXIX', 'LXX',
            'LXXI', 'LXXII', 'LXXIII', 'LXXIV', 'LXXV', 'LXXVI', 'LXXVII', 'LXXVIII', 'LXXIX', 'LXXX',
            'LXXXI'];
        return romanNumerals[num] || String(num);
    }
    return String(num);
}

console.log('[Library] System initialized');

// Register texts from providers on module load.
// Order matters: exact, checksummed editions win the identifier before
// legacy excerpts can claim it. This makes a completed re-ingest an
// atomic replacement; no temporary quarantine window is needed.
registerIngestedWorks();         // Verified public-domain ingests
registerDeepSacredTexts();       // Legacy high-fidelity excerpts
registerExtendedSacredTexts();   // Legacy extended texts
registerSimplifiedSacredTexts(); // Legacy fallback texts
registerStarterTexts();          // Original RISE compositions
registerLiteraryTexts();         // Legacy local literary excerpts

// RETIRED (LIBRARY-SPEC §0). Two registrations are deliberately absent:
//
//   registerDeclassifiedDocs() — Gateway Process, Project Stargate,
//   Soviet Psychotronics: four excerpts totalling ~5K characters. The
//   clearest instance of a register the system has outgrown. A library
//   that files remote-viewing memoranda beside Marcus Aurelius is not
//   making a claim about either.
//
//   registerResearchPapers() — a live ArXiv abstract feed is a
//   different product. Abstracts arrive unread and unchosen, so they
//   cannot be curated, cannot carry an editorial judgement, and cannot
//   rhyme with anything. Whatever else the Archive is, it holds works
//   somebody selected.
//
// The provider modules remain on disk; only the shelving is retired.

console.log(`[Library] Registered ${LIBRARY_TEXTS.length} texts`);
