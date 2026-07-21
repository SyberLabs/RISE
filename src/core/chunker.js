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
 * TEMPORAL CONTRACT — punctuation adds bounded TERMINAL time, it never
 * multiplies a whole chunk. The weights are the old multipliers minus
 * one, so single-word (word-mode) feel is mathematically unchanged
 * (word × 1.5 ≡ word + word × 0.5) while a period at the end of a
 * twelve-word sentence now adds one breath instead of half the
 * sentence again.
 */
const PUNCTUATION_PAUSE_WEIGHTS = {
    '.': 0.5,
    ',': 0.2,
    ';': 0.3,
    ':': 0.2,
    '!': 0.6,
    '?': 0.6,
    '—': 0.3,
    '–': 0.2,
    '"': 0.1,
    "'": 0
};

/**
 * Chunks longer than this are subdivided before pacing — long atoms
 * must be split into readable pieces, never compressed by a ceiling.
 */
const MAX_CHUNK_WORDS = 16;
const LEADING_SPEAKER_LABEL = /^([A-Z][A-Z '.-]{1,30}):\s+/;

/**
 * Calculate base duration for a word at given WPM
 * @param {number} wpm - Words per minute
 * @returns {number} Duration in milliseconds for one word
 */
function getBaseDuration(wpm) {
    const safeWpm = Number.isFinite(Number(wpm))
        ? Math.max(50, Math.min(1000, Number(wpm)))
        : 320;
    return (60 * 1000) / safeWpm;
}

/**
 * Word-length texture, rescaled to be approximately zero-mean over
 * typical English (short words move, long words linger) so word-mode
 * delivered WPM tracks the nominal request instead of silently
 * running ~15% slow.
 * @param {string} word
 * @returns {number} Multiplier (0.85 - 1.4)
 */
function getLengthModifier(word) {
    const len = word.length;
    if (len <= 3) return 0.85;
    if (len <= 6) return 0.95;
    if (len <= 9) return 1.1;
    if (len <= 12) return 1.25;
    return 1.4;
}

/**
 * Terminal punctuation pause in ms — additive, once per chunk.
 * @param {string} text
 * @param {number} baseDuration - one word's duration at session WPM
 * @returns {number} Milliseconds of added terminal time
 */
function getPunctuationPause(text, baseDuration) {
    const lastChar = text.trim().slice(-1);
    return (PUNCTUATION_PAUSE_WEIGHTS[lastChar] || 0) * baseDuration;
}

/**
 * Lossless subdivision of an over-long chunk: first at connective
 * boundaries (noncapturing — the connective stays exactly once at the
 * end of its segment), then any still-long piece is windowed into
 * near-equal word runs. Every source token appears exactly once.
 * @param {string} chunk
 * @param {number} maxWords
 * @returns {string[]}
 */
function splitLongChunk(chunk, maxWords = MAX_CHUNK_WORDS) {
    const words = chunk.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return [chunk];

    // Stage 1: connective boundaries (noncapturing group — a capturing
    // group here once duplicated the connective into its own atom)
    const stage1 = chunk
        .split(/(?<=\s(?:and|but|or|that|with|which))\s+/i)
        .map(piece => piece.trim())
        .filter(Boolean);

    // Stage 2: window anything still over budget into equal-ish runs
    const result = [];
    for (const piece of stage1) {
        const pieceWords = piece.split(/\s+/).filter(Boolean);
        if (pieceWords.length <= maxWords) {
            result.push(piece);
            continue;
        }
        const windows = Math.ceil(pieceWords.length / maxWords);
        const per = Math.ceil(pieceWords.length / windows);
        for (let i = 0; i < pieceWords.length; i += per) {
            result.push(pieceWords.slice(i, i + per).join(' '));
        }
    }
    return result;
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
    // Filter out standalone punctuation/symbols and synthesis barrier markers
    return text.split(/\s+/).filter(w => {
        const val = w.trim();
        if (!val) return false;
        
        // Discard standalone punctuation/icons (e.g. "|", "◈", "—")
        // but keep actual words and markers like [PAUSE]
        if (val.length === 1 && /[^a-zA-Z0-9À-ÿ]/.test(val)) return false;
        if (val === '◈' || val == '—') return false;
        if (val === 'SYNTHESIS' || val === 'BARRIER') return false; // Clean up the label too
        
        return true;
    });
}

/**
 * Split text into phrases (comma/semicolon separated chunks)
 * @param {string} text 
 * @returns {string[]}
 */
function splitPhrases(text, preserveSpeakerHead = false) {
    // Split on phrase-level punctuation, pipes (|), or newlines.
    // Dialogue profiles may protect a label only when it begins this unit.
    if (preserveSpeakerHead) {
        const speakerMatch = text.match(LEADING_SPEAKER_LABEL);
        if (speakerMatch) {
            const utterance = text.slice(speakerMatch[0].length);
            const phrases = utterance
                .split(/(?<=[,;:—–|])\s+|(?<=\.)\s+(?=[A-Z])|\n\s*/)
                .map(p => p.trim())
                .filter(p => p.length > 0);
            if (phrases.length === 0) return [`${speakerMatch[1]}:`];
            phrases[0] = `${speakerMatch[1]}: ${phrases[0]}`;
            return phrases;
        }
    }
    const phrases = text.split(/(?<=[,;:—–|])\s+|(?<=\.)\s+(?=[A-Z])|\n\s*/);
    return phrases.map(p => p.trim()).filter(p => p.length > 0);
}

/**
 * Split text into sentences
 * @param {string} text 
 * @returns {string[]}
 */
function splitSentences(text) {
    // Split on sentence-ending punctuation followed by space and capital
    // We remove the pipe (|) split to distinguish this from Phrase mode
    const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
    return sentences.map(s => s ? s.trim() : '').filter(s => s.length > 0);
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
 * @param {number} [options.wpm=320] - Words per minute
 * @param {string} [options.source=''] - Human-readable source identifier
 * @param {string} [options.sourceId=''] - Stable source identifier
 * @param {Object|null} [options.hints=null] - Default-off, profile-authored structural hints
 * @returns {Atom[]}
 */
export function chunkText(text, { mode = 'word', wpm = 220, source = '', sourceId = '', hints = null } = {}) {
    if (typeof text !== 'string') return [];

    // STRUCTURAL TOKENIZATION: authored markers are choreography, not
    // prose — they must survive every chunking mode. Promote each
    // inline marker to its own paragraph BEFORE any linguistic
    // splitting, so Phrase/Sentence/Paragraph logic only ever operates
    // on the text spans between structural tokens. (Previously an
    // inline [PAUSE] survived Word mode by luck of tokenization and
    // was silently destroyed in every other mode.)
    text = text.replace(/[ \t]*\|?[ \t]*(\[(?:PAUSE|FLASH|HOLD)\])[ \t]*\|?[ \t]*/gi, '\n\n$1\n\n');

    const baseDuration = getBaseDuration(wpm);
    const atoms = [];
    const dialogueHints = hints?.dialogue?.preserveSpeakerHead === true
        ? hints.dialogue
        : null;
    const syntheticSpeakerBoundaries = new Set(
        Array.isArray(dialogueHints?.syntheticSpeakerBoundaries)
            ? dialogueHints.syntheticSpeakerBoundaries
            : []
    );

    // First, split by paragraphs to handle [PAUSE] markers and line breaks
    const paragraphs = text.split(/\n\s*\n/);
    const speakerOrdinalByParagraph = new Map();
    if (dialogueHints) {
        let speakerOrdinal = 0;
        paragraphs.forEach((paragraph, index) => {
            if (LEADING_SPEAKER_LABEL.test(paragraph.trim())) {
                speakerOrdinalByParagraph.set(index, speakerOrdinal++);
            }
        });
    }

    let position = 0;

    for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
        const paragraph = paragraphs[paragraphIndex];
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
                sourceId,
                timingLocked: true,
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
                chunks = splitPhrases(trimmed, dialogueHints?.preserveSpeakerHead === true);
                break;
            case 'word':
            default:
                chunks = splitWords(trimmed);
                break;
        }

        // Create atoms from chunks
        for (const chunk of chunks) {
            // Check for special markers inside chunk loop
            const marker = checkMarker(chunk);
            if (marker.isMarker) {
                atoms.push(new Atom({
                    content: '',
                    modality: 'text',
                    duration: marker.duration,
                    weight: 0,
                    tags: [marker.type],
                    source,
                    sourceId,
                    timingLocked: true,
                    position: position++
                }));
                continue;
            }

            // Over-long chunks are SUBDIVIDED into readable pieces (all
            // multi-word modes), never left for a ceiling to compress
            // into transient unreadable text
            const pieces = mode === 'word' ? [chunk] : splitLongChunk(chunk);
            const wasSplit = pieces.length > 1;

            for (const piece of pieces) {
                // CLEAN CONTENT FOR DISPLAY:
                // Strip markers like |, [PAUSE], [FLASH], etc. so the user never sees them.
                // Also normalize whitespace.
                const cleanContent = piece
                    .replace(/\|/g, ' ')
                    .replace(/\[PAUSE\]/gi, '')
                    .replace(/\[FLASH\]/gi, '')
                    .replace(/\[HOLD\]/gi, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                // Skip empty chunks that might result from stripping markers
                if (!cleanContent && piece.length > 0) continue;

                // TEMPORAL CONTRACT: duration = words at nominal WPM,
                // plus one bounded terminal pause for punctuation
                let duration;
                if (mode === 'word') {
                    duration = baseDuration * getLengthModifier(piece)
                        + getPunctuationPause(piece, baseDuration);
                } else {
                    const wordCount = cleanContent.split(/\s+/).length;
                    duration = baseDuration * wordCount
                        + getPunctuationPause(piece, baseDuration);
                    // Phrase mode formerly emitted SPEAKER: as its own atom,
                    // including the colon breath. Reattaching the label keeps
                    // that aggregate temporal contract intact.
                    if (
                        mode === 'phrase'
                        && dialogueHints?.preserveSpeakerHead === true
                        && LEADING_SPEAKER_LABEL.test(`${cleanContent} `)
                    ) {
                        duration += PUNCTUATION_PAUSE_WEIGHTS[':'] * baseDuration;
                    }
                }

                atoms.push(new Atom({
                    content: cleanContent,
                    modality: 'text',
                    duration: Math.round(duration),
                    weight: 0.5,
                    tags: wasSplit ? ['smart-split'] : [],
                    source,
                    sourceId,
                    position: position++
                }));
            }
        }

        // Add a small pause between paragraphs
        const nextSpeakerOrdinal = speakerOrdinalByParagraph.get(paragraphIndex + 1);
        const isSyntheticDialogueBoundary = nextSpeakerOrdinal !== undefined
            && syntheticSpeakerBoundaries.has(nextSpeakerOrdinal);
        // A promoted inline marker IS the authored pause — adding a
        // paragraph break beside it would double-count the silence
        // (and change Word mode's historical timing for inline markers)
        const nextIsMarker = paragraphIndex + 1 < paragraphs.length
            && checkMarker(paragraphs[paragraphIndex + 1].trim()).isMarker;
        if (mode !== 'paragraph' && !isSyntheticDialogueBoundary && !nextIsMarker) {
            atoms.push(new Atom({
                content: '',
                modality: 'text',
                duration: baseDuration * 2,
                weight: 0,
                tags: ['paragraph-break'],
                source,
                sourceId,
                timingLocked: true,
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
