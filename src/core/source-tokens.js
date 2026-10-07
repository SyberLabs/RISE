/**
 * The vocabulary the chunker and the span aligner share about a source text:
 * the private-use sentinels the session compiler inserts, the markers that
 * are choreography rather than words, and the rule for which lone marks are
 * not words. A leaf on purpose: `source-span.js` needs these and nothing else
 * of the chunker, and importing the chunker for them closed a cycle through
 * `models.js` and `visual-score-lane.js`. This module imports nothing.
 */

// Private-use sentinel inserted by the session compiler at authored media
// boundaries. It is deliberately neither whitespace nor punctuation: the
// chunker, and only the chunker, interprets it. It creates no atom, pause, or
// display character; it merely prevents a linguistic chunk from crossing a
// score-authority boundary.
export const SOURCE_SCORE_CUT = '';
export const SOURCE_MARKER = /\[(?:PAUSE|FLASH|HOLD)\]/gi;

// One-character stand-ins for a literal `|` and a literal `[` before a
// marker word, so that a source whose `|` and `[PAUSE]` are words
// (`literal: true`) passes the chunker inert. `escapeLiteral` in the chunker
// puts them in; `restoreLiteral` takes them out. Same length both ways, so
// every character offset survives the round trip.
export const LITERAL_PIPE = '';
export const LITERAL_BRACKET = '';

/** What the author wrote, from what escapeLiteral made of it. */
export function restoreLiteral(text) {
    return text.replace(//gu, '|').replace(//gu, '[');
}

/**
 * A standalone token that word chunking discards: a lone mark carrying no
 * letter or digit, which would otherwise be flashed at the reader as if it
 * were a word. Punctuation attached to a word stays with the word; only a
 * mark standing by itself is dropped.
 *
 * EXPORTED BECAUSE THE SPAN ALIGNER MUST GET THE SAME ANSWER.
 * `alignSourceAtoms` walks the raw source token stream against compiled
 * atoms, so it has to know exactly what the chunker left behind. When it did
 * not, a spaced em-dash — ordinary in any pasted article — made every atom
 * after it disagree with the text, and passage authoring failed at Run with
 * SOURCE_SPAN_ATOM_ALIGNMENT.
 */
export function isDroppedWordToken(value, literal = false) {
    const val = String(value ?? '').trim();
    if (!val) return true;
    // A literal `|` standing alone is a word the author wrote, not a stray mark.
    if (literal && (val === LITERAL_PIPE || val === LITERAL_BRACKET)) return false;
    return val.length === 1 && /[^a-zA-Z0-9À-ÿ]/u.test(val);
}
