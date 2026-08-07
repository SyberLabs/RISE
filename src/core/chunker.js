/**
 * RISE Text Chunker
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

/**
 * The floor, measured rather than chosen. Against Book VI, Iliad XXII
 * and Guillemont, floors of 4/5/6 all clear fragments and stutter runs
 * completely; 5 lands the median at 7-8 words, which is a breath, and
 * keeps roughly a third more atoms than 6 — so the phrasing stays finer
 * than sentence mode's while reading as whole units.
 */
const PHRASE_FLOOR_WORDS = 5;

/**
 * A verse line shorter than this cannot stand as its own atom — a
 * running head, a speaker name, a half-line handed between speakers.
 * Lower than the prose floor because a poet's line is ALREADY a chosen
 * unit: three words on a line may be exactly the point, where three
 * words left by a comma never are.
 */
const VERSE_MIN_WORDS = 3;
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
/**
 * Phrase floor: merge short pieces after splitPhrases. Refusals: never
 * past MAX_CHUNK_WORDS; never across a sentence end; never across an
 * authored `|` (if the paragraph contains a pipe, leave it alone).
 *
 * @param {string[]} phrases pieces from splitPhrases, one paragraph's worth
 * @param {string} paragraph the text they came from, for authored marks
 */
/**
 * Is this text actually printed as verse lines?
 *
 * Derived from the file, not a manifest flag: does the text still carry
 * its lines? Prose-set editions of poetry often do not.
 *
 * @returns {{lineated: boolean, lines: number, medianWords: number, overCeiling: number}}
 */
export function detectVerseLineation(text, { maxWords = MAX_CHUNK_WORDS } = {}) {
    const lines = String(text ?? '').split(/\r?\n/)
        .map(l => l.trim()).filter(Boolean);
    if (lines.length < 8) {
        return { lineated: false, lines: lines.length, medianWords: 0, overCeiling: 1 };
    }
    const lengths = lines.map(l => l.split(/\s+/).filter(Boolean).length);
    const sorted = [...lengths].sort((a, b) => a - b);
    const medianWords = sorted[sorted.length >> 1];
    const overCeiling = lengths.filter(n => n > maxWords).length / lengths.length;

    // Wrap crowding (chars near column max) is not authored verse.
    const chars = lines.map(l => l.length);
    const charsSorted = [...chars].sort((a, b) => a - b);
    const p90Chars = charsSorted[Math.floor(charsSorted.length * 0.9)] || 1;
    const crowding = chars.filter(c => c >= p90Chars * 0.9).length / chars.length;

    const lineated = medianWords <= 12 && overCeiling <= 0.08 && crowding < 0.6;
    return { lineated, lines: lines.length, medianWords, overCeiling, crowding };
}

/**
 * One line, one atom — with two exceptions the text itself declares.
 *
 * A line over the ceiling is not a verse line: it is prose that happened
 * to be in a lineated file, or a line the edition ran together. It falls
 * back to the punctuation splitter, which is what it would have got
 * anyway.
 *
 * A line too short to stand — a running head, a speaker name, a
 * half-line — joins the NEXT line rather than the previous one. Verse
 * runs forward: `"Hamlet,"` belongs to what Hamlet then says, and a
 * stanza's opening fragment belongs to the stanza. This is the opposite
 * direction from the prose floor, and deliberately so.
 */
function splitVerseLines(paragraph, preserveSpeakerHead, useFloor) {
    const lines = paragraph.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return splitPhrases(paragraph, preserveSpeakerHead);

    const out = [];
    let held = '';
    for (const line of lines) {
        const candidate = held ? `${held} ${line}` : line;
        const length = candidate.split(/\s+/).filter(Boolean).length;

        if (length > MAX_CHUNK_WORDS) {
            // Not a verse line. Hand it to the punctuation splitter, and
            // let the floor tidy the pieces if this session asked for it.
            let pieces = splitPhrases(candidate, preserveSpeakerHead);
            if (useFloor && !preserveSpeakerHead) {
                pieces = applyPhraseFloor(pieces, candidate);
            }
            out.push(...pieces);
            held = '';
            continue;
        }
        if (length < VERSE_MIN_WORDS) {
            // Too short to stand alone. Carry it into the next line.
            held = candidate;
            continue;
        }
        out.push(candidate);
        held = '';
    }
    if (held) out.push(held);
    return out;
}

export function applyPhraseFloor(phrases, paragraph = '', {
    floor = PHRASE_FLOOR_WORDS,
    maxWords = MAX_CHUNK_WORDS
} = {}) {
    if (!Array.isArray(phrases) || phrases.length < 2) return phrases;
    // An author who marked their own phrasing has already answered the
    // question this function exists to answer.
    if (paragraph.includes('|')) return phrases;

    const words = piece => piece.trim().split(/\s+/).filter(Boolean).length;
    const closesSentence = piece => /[.!?][)\]"'”’]*$/.test(piece.trim());
    const joinable = (prev, next) =>
        prev && !closesSentence(prev) && words(prev) + words(next) <= maxWords;

    // Backward: a short piece rejoins what it was cut from.
    const grown = [];
    for (const piece of phrases) {
        const prev = grown[grown.length - 1];
        if (words(prev ?? '') < floor && joinable(prev, piece)) {
            grown[grown.length - 1] = `${prev} ${piece}`;
            continue;
        }
        grown.push(piece);
    }

    // Forward: a piece absorbs a short follower. Backward merging alone
    // cannot rescue the LAST fragment of a sentence — `"of me."`,
    // `"is unfathomable."` — because there is nothing after it to join.
    const settled = [];
    for (const piece of grown) {
        const prev = settled[settled.length - 1];
        if (words(piece) < floor && joinable(prev, piece)) {
            settled[settled.length - 1] = `${prev} ${piece}`;
            continue;
        }
        settled.push(piece);
    }
    return settled;
}

function splitLongChunk(chunk, maxWords = MAX_CHUNK_WORDS) {
    const words = chunk.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return [chunk];

    // Stage 1: cut before connectives (hinge opens the next clause).
    // Skip after colon (speaker labels) and between adjacent connectives.
    // Noncapturing group — capturing would duplicate the connective.
    const CONNECTIVE = 'and|but|or|that|with|which';
    const stage1 = chunk
        .split(new RegExp(`(?<!:)(?<!\\b(?:${CONNECTIVE}))\\s+(?=(?:${CONNECTIVE})\\b)`, 'i'))
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
/**
 * A parenthetical is masked so that no rule can split INSIDE it.
 *
 * Sentinel is a visible character; control bytes are forbidden by
 * source-hygiene. Angle brackets do not occur in this corpus.
 */
const PAREN_OPEN = '⟨';
const PAREN_CLOSE = '⟩';

/**
 * Phrase boundaries. `?` and `!` belong here (no abbreviation guard).
 * Parentheticals: split at edges, never within. Closers may sit between
 * punctuation and space (dialogue quotes) — must agree with
 * applyPhraseFloor's closesSentence.
 */
const CLOSERS = `[)\\]"'”’»]*`;

const PHRASE_BOUNDARY = new RegExp(
    `(?<=[,;:?!—–|]${CLOSERS})\\s+`       // phrase punctuation, now with ? and !
    + `|(?<=\\.${CLOSERS})\\s+(?=[“"'‘(]?[A-Z])`  // a full stop, guarded against "Dr."
    + `|\\s+(?=${PAREN_OPEN})`            // before a parenthetical
    + `|(?<=${PAREN_CLOSE})\\s+`          // after one
    + `|\\n\\s*`
);

const PAREN_SENTINEL = new RegExp(`${PAREN_OPEN}(\\d+)${PAREN_CLOSE}`, 'g');

/**
 * The same boundaries WITHOUT the parenthetical edges — for text whose
 * author has already marked their own phrasing.
 */
const PHRASE_BOUNDARY_AUTHORED = new RegExp(
    `(?<=[,;:?!—–|]${CLOSERS})\\s+`
    + `|(?<=\\.${CLOSERS})\\s+(?=[“"'‘(]?[A-Z])`
    + `|\\n\\s*`
);

/**
 * Split into phrases, holding each parenthetical whole. Authored `|`
 * paragraphs keep their own edges (interior still protected).
 */
/**
 * Enumerators (`I.`, `1.`, `(a)`) label what follows — join forward into
 * the next piece (floor merges backward). Roman numerals use standard
 * form, not a bare letter class.
 */
// Lookahead requires ≥1 numeral char — all groups optional otherwise.
const ROMAN = '(?=[MDCLXVI])M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})';
const ENUMERATOR = new RegExp(
    `^\\(?(?:${ROMAN}|${ROMAN.toLowerCase()}|\\d{1,3}|[A-Za-z])[.)]$`
);

/**
 * Only a piece that is ENTIRELY an enumerator moves, and that constraint
 * is what keeps a real sentence intact. "He was certain the culprit was
 * I." ends in the same two characters and is a whole clause, so it stays
 * where it is; only a piece with nothing else in it is a label.
 */
function leadWithEnumerator(pieces) {
    const out = [];
    for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i].trim();
        const next = pieces[i + 1];
        if (next !== undefined && piece && ENUMERATOR.test(piece)) {
            out.push(`${piece} ${next.trim()}`);
            i += 1;
            continue;
        }
        out.push(pieces[i]);
    }
    return out;
}

function cutPhrases(text) {
    const source = String(text);
    const authored = source.includes('|');
    const held = [];
    const masked = source.replace(/\([^()]*\)/g, (match) => {
        held.push(match);
        return `${PAREN_OPEN}${held.length - 1}${PAREN_CLOSE}`;
    });
    const pieces = masked
        .split(authored ? PHRASE_BOUNDARY_AUTHORED : PHRASE_BOUNDARY)
        .map(piece => piece.replace(PAREN_SENTINEL, (_, i) => held[Number(i)]).trim())
        .filter(piece => piece.length > 0);
    // An author who marked their own phrasing has already decided where a
    // numeral belongs — the same deference `applyPhraseFloor` shows.
    return authored ? pieces : leadWithEnumerator(pieces);
}

function splitPhrases(text, preserveSpeakerHead = false) {
    // Split on phrase-level punctuation, pipes (|), or newlines.
    // Dialogue profiles may protect a label only when it begins this unit.
    if (preserveSpeakerHead) {
        const speakerMatch = text.match(LEADING_SPEAKER_LABEL);
        if (speakerMatch) {
            const phrases = cutPhrases(text.slice(speakerMatch[0].length));
            if (phrases.length === 0) return [`${speakerMatch[1]}:`];
            phrases[0] = `${speakerMatch[1]}: ${phrases[0]}`;
            return phrases;
        }
    }
    return cutPhrases(text);
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
/**
 * Phrase floor on by default (PHRASE-CHUNKING-STUDY §7b). Pass
 * `phraseFloor: false` when short phrases are authored (verse profile).
 */
export function chunkText(text, { mode = 'word', wpm = 220, source = '', sourceId = '', hints = null, phraseFloor = true, verseLines = false } = {}) {
    if (typeof text !== 'string') return [];

    // Authored markers are choreography — promote each to its own
    // paragraph before linguistic splitting so every mode preserves them.
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

    // SCRIPTURE ANCHORS (PERICOPE-IMAGERY-SPEC §4): prepareScripture
    // parsed the ingest's [v C:V] sentinels into verse anchors keyed
    // by non-empty-paragraph ordinal — the same split this loop walks.
    // Build a per-paragraph (chapter, verse) map, each paragraph
    // inheriting the last anchor at or before it (verse text may wrap
    // across paragraphs). Purely additive: no anchors → no map → no
    // atom is stamped, and every non-Chapel source is untouched.
    const verseByParagraph = new Map();
    const scriptureAnchors = Array.isArray(hints?.scripture?.verseAnchors)
        ? hints.scripture.verseAnchors
        : null;
    if (scriptureAnchors && scriptureAnchors.length > 0) {
        // Index anchors by their paragraph ordinal, then sweep the
        // paragraph array carrying the current verse forward.
        const anchorByOrdinal = new Map();
        for (const a of scriptureAnchors) {
            if (Number.isInteger(a.paragraph)) anchorByOrdinal.set(a.paragraph, a);
        }
        let ordinal = 0;
        let current = null;
        for (let index = 0; index < paragraphs.length; index++) {
            if (paragraphs[index].trim() === '') continue; // prepareScripture skipped these too
            if (anchorByOrdinal.has(ordinal)) current = anchorByOrdinal.get(ordinal);
            if (current) verseByParagraph.set(index, current);
            ordinal += 1;
        }
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

        // Every atom minted from THIS paragraph inherits its verse
        // (PERICOPE-IMAGERY-SPEC §4). Record the boundary; stamp the
        // range once the paragraph's atoms are pushed.
        const verse = verseByParagraph.get(paragraphIndex) || null;
        const atomsBeforeParagraph = atoms.length;

        // Split based on mode
        let chunks;
        switch (mode) {
            case 'paragraph':
                chunks = [trimmed];
                break;
            case 'sentence':
                chunks = splitSentences(trimmed);
                break;
            case 'phrase': {
                const speakerHead = dialogueHints?.preserveSpeakerHead === true;
                // Line is the unit when lineation survives.
                chunks = verseLines
                    ? splitVerseLines(trimmed, speakerHead, phraseFloor)
                    : splitPhrases(trimmed, speakerHead);
                // Floor for punctuation-split prose only (not speaker heads or verse).
                if (phraseFloor && !speakerHead && !verseLines) {
                    chunks = applyPhraseFloor(chunks, trimmed);
                }
                break;
            }
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
        // Stamp this paragraph's atoms with their verse. The
        // paragraph-break atom appended below belongs to no verse —
        // it is structural silence — so it is deliberately outside
        // this range.
        if (verse) {
            for (let i = atomsBeforeParagraph; i < atoms.length; i++) {
                atoms[i].chapter = verse.chapter;
                atoms[i].verse = verse.verse;
            }
        }

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
