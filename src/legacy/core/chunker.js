/**
 * R.I.S.E. Text Chunker
 * Transforms raw text into atoms based on chunking strategy
 */

import { Atom } from './models.js';

/**
 * Special markers in text
 */
const MARKERS = {
    PAUSE: '[PAUSE]',
    FLASH: '[FLASH]',
    HOLD: '[HOLD]'
};

/**
 * Pause durations in ms
 */
const PAUSE_DURATIONS = {
    PAUSE: 2000,
    FLASH: 50,
    HOLD: 3000
};

/**
 * Punctuation that adds pause time
 */
const PUNCTUATION_DELAYS = {
    '.': 1.5,
    ',': 1.2,
    ';': 1.3,
    ':': 1.2,
    '!': 1.6,
    '?': 1.6,
    '—': 1.3,
    '–': 1.2,
    '"': 1.1,
    "'": 1.0
};

/**
 * Calculate base duration for a word at given WPM
 * @param {number} wpm - Words per minute
 * @returns {number} Duration in milliseconds for one word
 */
function getBaseDuration(wpm) {
    return (60 * 1000) / wpm;
}

/**
 * Calculate duration modifier based on word length
 * Longer words get more time
 * @param {string} word 
 * @returns {number} Multiplier (1.0 - 2.0)
 */
function getLengthModifier(word) {
    const len = word.length;
    if (len <= 3) return 1.0;
    if (len <= 6) return 1.1;
    if (len <= 9) return 1.3;
    if (len <= 12) return 1.5;
    return 1.7;
}

/**
 * Calculate duration modifier based on trailing punctuation
 * @param {string} text 
 * @returns {number} Multiplier
 */
function getPunctuationModifier(text) {
    const lastChar = text.trim().slice(-1);
    return PUNCTUATION_DELAYS[lastChar] || 1.0;
}

/**
 * Check if text is a special marker
 * @param {string} text 
 * @returns {{isMarker: boolean, type: string|null, duration: number}}
 */
function checkMarker(text) {
    const trimmed = text.trim().toUpperCase();
    for (const [type, marker] of Object.entries(MARKERS)) {
        if (trimmed === marker) {
            return {
                isMarker: true,
                type,
                duration: PAUSE_DURATIONS[type]
            };
        }
    }
    return { isMarker: false, type: null, duration: 0 };
}

/**
 * Split text into words, preserving punctuation
 * @param {string} text 
 * @returns {string[]}
 */
function splitWords(text) {
    // Split on whitespace but keep words with punctuation attached
    return text.split(/\s+/).filter(w => w.length > 0);
}

/**
 * Split text into phrases (comma/semicolon separated chunks)
 * @param {string} text 
 * @returns {string[]}
 */
function splitPhrases(text) {
    // Split on phrase-level punctuation
    const phrases = text.split(/(?<=[,;:—–])\s+|(?<=\.)\s+(?=[A-Z])/);
    return phrases.map(p => p.trim()).filter(p => p.length > 0);
}

/**
 * Split text into sentences
 * @param {string} text 
 * @returns {string[]}
 */
function splitSentences(text) {
    // Split on sentence-ending punctuation followed by space and capital
    const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Split text into paragraphs
 * @param {string} text 
 * @returns {string[]}
 */
function splitParagraphs(text) {
    return text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
}

/**
 * Main chunker function
 * @param {string} text - Raw text content
 * @param {Object} options
 * @param {'word' | 'phrase' | 'sentence' | 'paragraph'} [options.mode='word'] - Chunking mode
 * @param {number} [options.wpm=220] - Words per minute
 * @param {string} [options.source=''] - Source identifier
 * @returns {Atom[]}
 */
export function chunkText(text, { mode = 'word', wpm = 220, source = '' } = {}) {
    const baseDuration = getBaseDuration(wpm);
    const atoms = [];

    // First, split by paragraphs to handle [PAUSE] markers and line breaks
    const paragraphs = text.split(/\n\s*\n/);

    let position = 0;

    for (const paragraph of paragraphs) {
        const trimmed = paragraph.trim();
        if (!trimmed) continue;

        // Check for special markers
        const marker = checkMarker(trimmed);
        if (marker.isMarker) {
            atoms.push(new Atom({
                content: '',
                modality: 'text',
                duration: marker.duration,
                weight: 0,
                tags: [marker.type],
                source,
                position: position++
            }));
            continue;
        }

        // Split based on mode
        let chunks;
        switch (mode) {
            case 'paragraph':
                chunks = [trimmed];
                break;
            case 'sentence':
                chunks = splitSentences(trimmed);
                break;
            case 'phrase':
                chunks = splitPhrases(trimmed);
                break;
            case 'word':
            default:
                chunks = splitWords(trimmed);
                break;
        }

        // Create atoms from chunks
        for (const chunk of chunks) {
            // For modes other than word, calculate duration based on word count
            let duration;
            if (mode === 'word') {
                duration = baseDuration * getLengthModifier(chunk) * getPunctuationModifier(chunk);
            } else {
                const wordCount = chunk.split(/\s+/).length;
                duration = baseDuration * wordCount * getPunctuationModifier(chunk);
            }

            atoms.push(new Atom({
                content: chunk,
                modality: 'text',
                duration: Math.round(duration),
                weight: 0.5,
                tags: [],
                source,
                position: position++
            }));
        }

        // Add a small pause between paragraphs
        if (mode !== 'paragraph') {
            atoms.push(new Atom({
                content: '',
                modality: 'text',
                duration: baseDuration * 2,
                weight: 0,
                tags: ['paragraph-break'],
                source,
                position: position++
            }));
        }
    }

    // Remove trailing paragraph break if present
    if (atoms.length > 0 && atoms[atoms.length - 1].tags.includes('paragraph-break')) {
        atoms.pop();
    }

    return atoms;
}

/**
 * Get word count from text
 * @param {string} text 
 * @returns {number}
 */
export function countWords(text) {
    return text.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Estimate session duration in milliseconds
 * @param {string} text 
 * @param {number} wpm 
 * @returns {number}
 */
export function estimateDuration(text, wpm) {
    const wordCount = countWords(text);
    return (wordCount / wpm) * 60 * 1000;
}
