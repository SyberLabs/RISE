import { describe, expect, it } from 'vitest';
import { wordsWithOffsets } from '../../scripts/align-narration.mjs';
import { assertWordsInsideSpan, validateNarrationWords } from '../core/narration.js';
import { splitWords } from '../core/recitation.js';

/**
 * The text half of long-form alignment, which is the half a model cannot
 * check. Whether the words land where they are SAID needs a real acoustic
 * model and a recording minutes long — that lives in
 * `scripts/verify-narration-alignment.mjs`, kept runnable because a stub
 * would only prove we can satisfy our own stub.
 *
 * What is provable here is the contract the lane enforces: a narration word
 * names a span of the real source, and `text.slice(from, to)` has to BE that
 * word. Narration does not rewrite.
 */

const PASSAGE = 'Of five long winters! And again, I hear\n  these waters, rolling.';

describe('a narration word names the source it came from', () => {
    it('slices back to exactly the word it carries', () => {
        for (const word of wordsWithOffsets(PASSAGE)) {
            expect(PASSAGE.slice(word.fromCharacter, word.toCharacter)).toBe(word.text);
        }
    });

    it('satisfies the lane the score will check it with', () => {
        // The same two proofs an imported program runs. Durations are
        // stand-ins here; the offsets are the thing under test.
        const words = wordsWithOffsets(PASSAGE).map(word => ({ ...word, durationMs: 120 }));
        expect(() => validateNarrationWords(words)).not.toThrow();
        expect(() => assertWordsInsideSpan(words, 0, PASSAGE.length, PASSAGE)).not.toThrow();
    });

    it('counts words the way the reveal counts them', () => {
        // NARRATION AND THE REVEAL MUST AGREE ON HOW MANY WORDS THERE ARE.
        // One timing per word is the whole contract; if these two ever
        // disagreed, a reading would reveal a word the recording had no
        // time for, or run out of timings before it ran out of text.
        expect(wordsWithOffsets(PASSAGE).map(word => word.text))
            .toEqual(splitWords(PASSAGE).map(word => word.text));
    });

    it('keeps punctuation attached, because the source has it', () => {
        const words = wordsWithOffsets('winters! And again,');
        expect(words.map(word => word.text)).toEqual(['winters!', 'And', 'again,']);
    });

    it('spans nothing for empty or blank text', () => {
        expect(wordsWithOffsets('')).toEqual([]);
        expect(wordsWithOffsets('   \n\t ')).toEqual([]);
    });

    it('offsets survive characters outside the model alphabet', () => {
        // The aligner strips these to reach the model's alphabet; the
        // OFFSETS still have to address the original, or the lane's slice
        // check fails on the very words a reader is most likely to notice.
        const text = 'the reader’s own “quiet” — held';
        for (const word of wordsWithOffsets(text)) {
            expect(text.slice(word.fromCharacter, word.toCharacter)).toBe(word.text);
        }
    });
});

describe('words the model alphabet cannot carry', () => {
    /**
     * THE BUG THIS EXISTS FOR desynchronised a five-minute recording on one
     * character. The model's vocabulary is A-Z and an apostrophe, so "4" in
     * "a 4 AM Walk in the Park" normalises to nothing and has no frame to
     * report — and the window loop read "cannot be placed" as "the audio
     * stopped matching the text". It stalled, hopped past twenty-four
     * seconds of speech, and never re-synchronised: 694 words compressed
     * into the first 66 seconds of a 295-second reading.
     *
     * Every lane check still passed. The count matched, the spans matched,
     * the durations were legal. Only a coverage number caught it.
     */
    it('still gives a numeral a span in the source', () => {
        const text = 'Music for a 4 AM Walk in the Park and 14% more productive';
        const words = wordsWithOffsets(text);
        for (const word of words) {
            expect(text.slice(word.fromCharacter, word.toCharacter)).toBe(word.text);
        }
        expect(words.map(word => word.text)).toContain('4');
        expect(words.map(word => word.text)).toContain('14%');
    });

    it('counts them, so the reveal and the recording still agree', () => {
        // A carried word is still a word. If these ever diverged, a reading
        // would run out of timings before it ran out of text.
        const text = 'a 4 AM walk, 14% quieter';
        expect(wordsWithOffsets(text).map(word => word.text))
            .toEqual(splitWords(text).map(word => word.text));
    });
});
