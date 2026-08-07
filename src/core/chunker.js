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
 * The floor. Phrase mode had a ceiling and nothing underneath it.
 *
 * `splitPhrases` cuts after every `, ; : — – |` and every sentence end,
 * and nothing ever put a short piece back. A comma-separated list — one
 * thought — became one screen per item, and Book VI measured 27%
 * fragments and 95 stutter runs: `"unpursued,"` alone on screen, then
 * `"till Morn,"` alone after it.
 *
 * Sentence mode is not the answer to that. It has no fragments, but
 * Milton's sentences run ten lines, so `splitLongChunk` windows them by
 * word count and 71.6% of atoms end mid-phrase — `"...Lodge and"`,
 * `"dislodge by turns, which"`. Phrase mode gets the BOUNDARIES right
 * and the LENGTHS wrong; this fixes the lengths and touches nothing
 * else.
 *
 * Three refusals, and the third is the important one:
 *
 *   1. Never past the ceiling — MAX_CHUNK_WORDS still governs.
 *   2. Never across a sentence end. A naive floor produces
 *      `"unsociable people. But all of this arises"`, which is two
 *      thoughts in one breath.
 *   3. NEVER ACROSS AN AUTHORED BOUNDARY. The Vault's sequences carry
 *      hand-placed `|` marks, and by every metric here they look like
 *      the defect — 19.5% fragments — because they are short BY DESIGN.
 *      That is the phrasing an author asked for. `splitPhrases` treats
 *      `|` and `,` identically and the provenance is gone by the time we
 *      see the pieces, so this checks the paragraph's own text: if a
 *      pipe was written anywhere in it, the floor declines to touch that
 *      paragraph at all.
 *
 * Coarse, and deliberately so. Content authors; the runtime follows.
 * The finer version is per-boundary provenance through `splitPhrases`,
 * which is the real Chunker V2 item.
 *
 * @param {string[]} phrases pieces from splitPhrases, one paragraph's worth
 * @param {string} paragraph the text they came from, for authored marks
 */
/**
 * Is this text actually printed as verse lines?
 *
 * DERIVED, NEVER DECLARED — and the reason is Dickinson. Labelling a
 * work "verse" in a manifest describes the poem; it does not describe
 * the FILE. Measured, our Dickinson edition has a median line of 19
 * words with 66% of lines over the chunker's ceiling, because its poems
 * are set as running prose and the lineation is simply gone. Milton's
 * Book VI measures a median of 8 with nothing over the ceiling.
 *
 * A `structure: "verse"` flag would have been true about both and
 * useful for only one. So the question this asks is not "is this
 * poetry" but "does this text still carry its lines", which is the only
 * form of the question the chunker can act on.
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

    // WRAPPED PROSE IS NOT VERSE, and by word count alone it looks
    // exactly like it. Gutenberg wraps at a fixed column, so Moby-Dick,
    // Karamazov, Swann's Way and the prose Odyssey all have short lines
    // and none over the ceiling — and a wrap point is not an authored
    // boundary, it is an artefact of plain-text typesetting from before
    // any of this existed.
    //
    // The tell is character length, and the separation is total:
    //
    //   Milton         max 59 chars, 40% of lines near the maximum
    //   Dante          max 58,       41%
    //   Moby-Dick      max 71,       82%
    //   Karamazov      max 71,       84%
    //   Odyssey (prose) max 71,      86%
    //   Swann's Way    max 73,       89%
    //
    // A wrapped file crowds its lines against the column because the
    // wrapper filled each one. A poet's line ends where the line ends.
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

    // Stage 1: connective boundaries.
    //
    // A CONNECTIVE OPENS A CLAUSE; IT DOES NOT CLOSE ONE. This split used
    // a lookBEHIND and cut after the word, so the hinge was stranded at
    // the end of the phrase it was there to introduce — "The many
    // different acts and" left a reader hanging, and two connectives in a
    // row left a phrase that was one word long: "…in other ways and" /
    // "with" / "better examples." That lone "with" is what a reader
    // noticed, and it was this line.
    //
    // Cutting BEFORE the word puts the hinge at the head of what it
    // hinges to, which is the same rule the enumerator pass follows: a
    // token whose whole job is to point forward belongs with what it
    // points at. `\b` so `android` and `organ` are not connectives.
    //
    // (The noncapturing group is load-bearing for a different reason — a
    // capturing group here once duplicated the connective into its own
    // atom.)
    // …EXCEPT AFTER A COLON, which is a label and not a clause. Cutting
    // before the connective in "SOCRATES: And what do you mean" strands
    // the speaker on a line of his own — the label loses the utterance it
    // introduces, which is the very thing `preserveSpeakerHead` exists to
    // prevent one layer up. This is §4's warning arriving on schedule: a
    // rule that improves mechanically split prose can misread deliberate
    // phrasing as the same defect.
    // …AND NOT BETWEEN TWO OF THEM. "in other ways and with better
    // examples" holds two connectives in a row; cutting before each in
    // turn leaves the first one alone, which is the exact one-word phrase
    // that started this — the reader's "with". Adjacent hinges are one
    // hinge and travel together.
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
 * The sentinel is deliberately a VISIBLE character. A control byte is
 * the obvious choice and this codebase has lost days to invisible ones —
 * a U+0008 inside a regex, a U+0000 used as a separator — so
 * `src/core/source-hygiene.test.js` now forbids them outright. Angle
 * brackets do not occur in this corpus and can be read in a debugger.
 */
const PAREN_OPEN = '⟨';
const PAREN_CLOSE = '⟩';

/**
 * Phrase boundaries.
 *
 * `?` AND `!` BELONG HERE and were missing, which made PHRASE mode —
 * the finer mode — coarser than SENTENCE mode at a question:
 *
 *     "Who goes there? He asked again."
 *       phrase   → one atom
 *       sentence → two
 *
 * They need no capital-letter guard. That guard exists for `.` because
 * of "Dr. Smith" and "i.e."; no abbreviation ends in a question mark. It
 * matters here because this corpus continues in lower case after one —
 * *"…to do me hurt? for what profit…"* — which the capital rule would
 * have missed even in sentence mode.
 *
 * A PARENTHETICAL IS ONE BREATH: split at its edges, never within it.
 * Splitting inside is what left `"(which indeed is very irreligious for
 * any man to believe:"` open and `"and to-day), thou didst first breathe
 * it in"` closed by nothing. Measured on Meditations VI, edge-splitting
 * with a protected interior removed every unbalanced atom (4 → 0) and
 * lowered the fragment rate at the same time (8.2% → 7.8%).
 */
/**
 * A closing mark may stand between the punctuation and the space.
 *
 * `“You have a house in town, I conclude?”` puts a curly quote after the
 * question, so the mark is not adjacent to the whitespace and a naive
 * lookbehind misses every line of dialogue in the corpus — 16 of them in
 * three chapters of Pride and Prejudice alone. `applyPhraseFloor` had
 * already learned this: its `closesSentence` tests `[.!?][)\]"'”’]*$`.
 * The splitter and the floor must agree about where a sentence ends, or
 * one cuts where the other refuses to join.
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
 * Split a unit into phrases, holding each parenthetical whole.
 *
 * AN AUTHORED PARAGRAPH KEEPS ITS OWN PHRASING. `applyPhraseFloor`
 * already declines to MERGE across a hand-placed `|`; adding boundaries
 * inside one is the same overreach from the other direction. If an
 * author wrote `said nothing (at all)` as one phrase, they have answered
 * the question this function exists to answer. The interior is still
 * protected — nothing may split inside the aside — but its edges are not
 * promoted to breaks.
 *
 * Content authors; the runtime follows.
 */
/**
 * An ENUMERATOR labels what follows; it is not a thought of its own.
 *
 * `I.`, `II.`, `1.`, `2.`, `(a)` — Vitruvius numbers every clause and the
 * splitter was handing each number its own beat, so a reader met a lone
 * "II." for four hundred milliseconds and then the sentence it belonged
 * to. The mark is a pointer into the text, and a pointer shown apart from
 * what it points at is just a noise.
 *
 * THE FLOOR CANNOT DO THIS, which is why it is a separate pass. The
 * phrase floor merges a short piece BACKWARD into what it was cut from;
 * an enumerator has to go FORWARD into what it introduces. It is also
 * exempt from rescue in both directions — `closesSentence('1.')` is true,
 * so nothing may merge into it — and it is usually the first piece of its
 * paragraph, so there is nothing behind it anyway. Three reasons the
 * existing machinery was never going to reach it.
 *
 * ROMAN NUMERALS ARE VALIDATED, NOT SPELLED FROM THEIR ALPHABET. A naive
 * `[IVXLCDM]+` also matches CIVIL, DID and MIMIC, which in an all-capital
 * heading would be swallowed into the following phrase. This is the
 * standard-form pattern, so DID and CIVIL fail it and MIX — a real
 * numeral, and a phrase nobody writes alone — passes.
 */
// A ROMAN NUMERAL MUST HAVE AT LEAST ONE CHARACTER. Every group in the
// standard-form pattern is optional, so the whole of it matches the EMPTY
// string — and the enumerator branch then accepted a bare "." or ")" as a
// numeral with a terminator. The lookahead requires one numeral character
// before the pattern is allowed to run, which costs nothing and closes
// the gap between what the rule claims and what it matches.
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
 * THE PHRASE FLOOR IS ON BY DEFAULT from 2026-08-06, reversing the
 * opt-in ruling of PHRASE-CHUNKING-STUDY §7 on evidence §7 did not have.
 *
 * Measured paired across 24 works sampled from the Archive: the
 * coefficient of variation of phrase length falls 0.227 (95% CI [0.196,
 * 0.258], d = 2.92), phrases of two words or fewer fall 23 points, and 23
 * of 24 works improve. §7's recorded harms do not survive checking —
 * verse comes out BYTE-IDENTICAL, and unprofiled dialogue goes from three
 * stranded speaker labels to none, the floor un-stranding a label rather
 * than stranding one.
 *
 * Pass `phraseFloor: false` for a text whose short phrases are AUTHORED.
 * Nothing in the corpus has needed it yet; the door is open because the
 * measurement covers 24 works and the shelf holds 91.
 */
export function chunkText(text, { mode = 'word', wpm = 220, source = '', sourceId = '', hints = null, phraseFloor = true, verseLines = false } = {}) {
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
                // THE LINE IS THE UNIT, WHERE THERE ARE LINES.
                //
                // Milton wrote in lines. `splitPhrases` splits on his
                // commas instead, and `splitLongChunk` windows what is
                // left by word count — so the chunker had two opinions
                // about where Book VI breathes and neither was Milton's.
                // Measured, his lines are a median of 8 words with NONE
                // over the ceiling: the poet already solved the problem
                // this module exists to solve.
                //
                // Only where the lines survive in the file. See
                // detectVerseLineation, and Dickinson.
                chunks = verseLines
                    ? splitVerseLines(trimmed, speakerHead, phraseFloor)
                    : splitPhrases(trimmed, speakerHead);
                // ON BY DEFAULT, AND THE TWO REFUSALS BELOW ARE NOT A
                // HEDGE — they are the study's finding about what the
                // metrics cannot see.
                //
                // The floor was ruled opt-in on evidence from one book,
                // where enabling it globally rewrote pinned durations and
                // merged a stranded `SOCRATES:`. The 24-work paired study
                // reversed that: see the note on this function. What
                // survived the reversal is the reason those two cases
                // looked like harm — the metrics measure text split
                // MECHANICALLY on punctuation, and where a human already
                // set the boundary there is no defect to repair.
                //
                // A speaker label is an authored boundary, and the
                // strongest kind: it says a different person is talking.
                // A verse line is the poet's own unit. Neither is a
                // punctuation artifact, so neither is grown.
                // The floor is for punctuation-split text. A verse line
                // is already the author's unit and must not be grown
                // into the next one.
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
