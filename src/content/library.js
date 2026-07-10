/**
 * R.I.S.E. Library System
 * Infrastructure for sacred texts and literary sources
 */

import { STARTER_SEQUENCES } from './starters.js';
import { SACRED_TEXTS } from '../sources/text/sacred.js';
import { SACRED_DEEP } from '../sources/text/data/sacred_deep.js';
import { LITERARY_DEEP } from '../sources/text/data/literary_deep.js';
import { DECLASSIFIED_LIBRARY } from '../sources/text/declassified.js';
import { ARXIV_CATEGORIES } from '../sources/text/arxiv.js';
import EXTENDED_SACRED from '../sources/text/data/sacred_texts.json';

/**
 * Library categories
 */
export const LIBRARY_CATEGORIES = [
    { id: 'foundational', name: 'Foundational', icon: '⚿', description: 'Core sequences formatted as pure text' },
    { id: 'sacred', name: 'Sacred Texts', icon: '☯', description: 'Ancient wisdom traditions' },
    { id: 'literary', name: 'Literary', icon: '📜', description: 'Classic literature and philosophy' },
    { id: 'research', name: 'Research', icon: '🔬', description: 'Academic and scientific papers' },
    { id: 'declassified', name: 'Declassified', icon: '👁️', description: 'Released intelligence documents' }
];

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
            wpm: seq.wpm || 220,
            curve: seq.curve || 'flat'
        }));

        registerText({
            id: textId,
            title: seq.name,
            author: 'R.I.S.E. Core',
            category: 'foundational',
            tradition: 'Core System',
            description: seq.description,
            chapterCount: verses.length,
            defaultCurve: seq.curve || 'flat',
            defaultWpm: seq.wpm || 220,
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
        
        // Skip if ID already exists
        if (LIBRARY_TEXTS.find(t => t.id === textId)) continue;
        
        // Skip if a title-match exists (Deep or Extended version covers it)
        if (LIBRARY_TEXTS.find(t => t.title.toLowerCase().includes(text.title.toLowerCase()))) continue;

        const structuredVerses = text.verses.map((verseText, idx) => ({
            name: `Verse ${idx + 1}`,
            description: verseText.substring(0, 60) + (verseText.length > 60 ? '...' : ''),
            content: verseText,
            wpm: 150,
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
            defaultWpm: 150,
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
            defaultWpm: 130,
            tags: ['literary', 'curated'],
            verses: text.sequences,
            provider: 'literary-local',
            getSequences: () => text.sequences
        });
    }
}

/**
 * Register Declassified Documents
 */
function registerDeclassifiedDocs() {
    for (const [id, doc] of Object.entries(DECLASSIFIED_LIBRARY)) {
        const verseObj = {
            name: 'Full Document',
            content: doc.content,
            wpm: 180,
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
            defaultWpm: 180,
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
            defaultWpm: 250,
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
            wpm: 150,
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
            defaultWpm: 150,
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
    if (!LIBRARY_TEXTS.find(t => t.id === text.id)) {
        LIBRARY_TEXTS.push(text);
        console.log(`[Library] Registered: ${text.title}`);
    }
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

// Register texts from providers on module load
// Order matters: higher fidelity sources should be registered first
registerDeepSacredTexts();       // Priority 1
registerExtendedSacredTexts();   // Priority 2
registerSimplifiedSacredTexts(); // Priority 3 (Fallback)
registerStarterTexts();          // Registers Starters - now with Title check
registerLiteraryTexts();         // Local curated literary texts (replaces Gutenberg)
registerDeclassifiedDocs();
registerResearchPapers();

console.log(`[Library] Registered ${LIBRARY_TEXTS.length} texts`);
