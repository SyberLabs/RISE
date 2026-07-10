/**
 * R.I.S.E. Library System
 * Infrastructure for sacred texts and literary sources
 */

/**
 * Library categories
 */
export const LIBRARY_CATEGORIES = [
    { id: 'sacred', name: 'Sacred Texts', icon: '☯', description: 'Ancient wisdom traditions' },
    { id: 'literary', name: 'Literary', icon: '📜', description: 'Classic literature and philosophy' },
    { id: 'research', name: 'Research', icon: '🔬', description: 'Academic and scientific papers' }
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
 * Actual content is lazy-loaded from separate modules
 */
export const LIBRARY_TEXTS = [];

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
