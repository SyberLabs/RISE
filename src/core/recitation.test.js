/**
 * The reveal's promises, enforced.
 *
 * Two of these are contracts rather than preferences: the reveal never
 * extends an atom's duration, and reduced motion turns it off entirely.
 * Both protect a reader from an animation taking time the pacing system
 * promised them for reading.
 */
import { describe, expect, it } from 'vitest';
import {
    splitWords, stripEmphasis, revealBudget, revealSchedule, speechOnsets,
    REVEAL_SHARE, REVEAL_MAX_MS, REVEAL_MIN_ATOM_MS
} from './recitation.js';

describe('authored emphasis', () => {
    it('marks single and multi-word spans', () => {
        // A span may cover several words — "*Lord Jesus Christ*" — so
        // marks must resolve before splitting, or the first and last
        // words keep orphaned asterisks.
        const words = splitWords('how *beautiful* and *Lord Jesus Christ* is');
        expect(words.map(w => w.text)).toEqual(
            ['how', 'beautiful', 'and', 'Lord', 'Jesus', 'Christ', 'is']);
        expect(words.filter(w => w.emphasised).map(w => w.text))
            .toEqual(['beautiful', 'Lord', 'Jesus', 'Christ']);
    });

    it('leaves unmarked text entirely unemphasised', () => {
        const words = splitWords('the words are plain');
        expect(words).toHaveLength(4);
        expect(words.some(w => w.emphasised)).toBe(false);
    });

    it('strips marks for speech and plain display', () => {
        // The marks are notation, never content: a synthesiser must
        // never read an asterisk aloud.
        expect(stripEmphasis('how *beautiful* and *amazing*'))
            .toBe('how beautiful and amazing');
        expect(stripEmphasis('')).toBe('');
        expect(stripEmphasis(null)).toBe('');
    });

    it('survives repeated calls', () => {
        // The regex is module-level and global; a stale lastIndex would
        // make the second call skip the first match.
        const once = splitWords('*a* b *c*');
        const twice = splitWords('*a* b *c*');
        expect(twice).toEqual(once);
        expect(twice.filter(w => w.emphasised).map(w => w.text)).toEqual(['a', 'c']);
    });

    it('handles empty and whitespace content', () => {
        expect(splitWords('')).toEqual([]);
        expect(splitWords('   ')).toEqual([]);
        expect(splitWords(null)).toEqual([]);
    });
});

describe('reveal budget — the temporal contract', () => {
    it('never spends more than its share of the atom', () => {
        // The reader is promised `duration` to read the phrase. The
        // reveal borrows from that; it must never extend it.
        for (const d of [500, 800, 1200, 2000, 5000]) {
            expect(revealBudget(d)).toBeLessThanOrEqual(d * REVEAL_SHARE + 1);
            expect(revealBudget(d)).toBeLessThan(d);
        }
    });

    it('caps so a long atom does not crawl', () => {
        expect(revealBudget(60000)).toBe(REVEAL_MAX_MS);
    });

    it('leaves fast atoms whole rather than strobing them', () => {
        // Below the threshold displayAtom already skips the fade path.
        // Revealing a phrase that lives 300ms would flicker, not reveal.
        expect(revealBudget(REVEAL_MIN_ATOM_MS - 1)).toBe(0);
        expect(revealBudget(200)).toBe(0);
        expect(revealBudget(REVEAL_MIN_ATOM_MS)).toBeGreaterThan(0);
    });

    it('is disabled entirely by reduced motion', () => {
        // Off, not faster. This is animation, and the safety posture is
        // opt-out by default.
        expect(revealBudget(2000, { reducedMotion: true })).toBe(0);
    });

    it('refuses malformed durations', () => {
        expect(revealBudget(undefined)).toBe(0);
        expect(revealBudget(NaN)).toBe(0);
        expect(revealBudget(-500)).toBe(0);
    });
});

describe('reveal schedule', () => {
    it('lands the last word at the end of the budget, not past it', () => {
        // If the final word arrived after the budget the phrase would
        // still be assembling into time reserved for reading it.
        const s = revealSchedule(4, 800);
        expect(s[0]).toBe(0);
        expect(s.at(-1)).toBe(800);
        expect(s).toEqual([...s].sort((a, b) => a - b));
    });

    it('shows a single word immediately', () => {
        expect(revealSchedule(1, 800)).toEqual([0]);
    });

    it('shows everything at once when the budget is zero', () => {
        expect(revealSchedule(5, 0)).toEqual([0, 0, 0, 0, 0]);
    });

    it('follows speech onsets when they are given', () => {
        // With a voice the reveal tracks REAL onsets rather than
        // interpolating: the voice is the clock.
        expect(revealSchedule(4, 800, [0, 300, 800, 1120]))
            .toEqual([0, 300, 800, 1120]);
    });

    it('drifts rather than bunching when onsets run short', () => {
        // Silence detection is a heuristic and will sometimes find
        // fewer gaps than there are words. The tail should continue at
        // the established pace, not dump the remainder at once.
        const s = revealSchedule(5, 800, [0, 200, 400]);
        expect(s.slice(0, 3)).toEqual([0, 200, 400]);
        expect(s[3]).toBeGreaterThan(s[2]);
        expect(s[4]).toBeGreaterThan(s[3]);
        expect(s).toEqual([...s].sort((a, b) => a - b));
    });

    it('ignores surplus onsets', () => {
        expect(revealSchedule(2, 800, [0, 100, 200, 300])).toEqual([0, 100]);
    });

    it('returns nothing for no words', () => {
        expect(revealSchedule(0, 800)).toEqual([]);
    });
});

describe('speech onsets', () => {
    it('finds the gaps between bursts of energy', () => {
        // Three 100ms tones separated by silence: the onsets are the
        // samples where energy returns.
        const sr = 24000;
        const samples = new Float32Array(sr);          // 1s of silence
        const burst = (startMs, lenMs) => {
            const from = Math.floor(sr * startMs / 1000);
            const to = from + Math.floor(sr * lenMs / 1000);
            for (let i = from; i < to; i++) samples[i] = Math.sin(i * 0.3) * 0.8;
        };
        burst(0, 100); burst(300, 100); burst(700, 100);

        const onsets = speechOnsets(samples, sr);
        expect(onsets[0]).toBe(0);
        expect(onsets.length).toBeGreaterThanOrEqual(3);
        // Roughly where the bursts start, within a window's tolerance.
        expect(onsets[1]).toBeGreaterThan(250);
        expect(onsets[1]).toBeLessThan(350);
        expect(onsets[2]).toBeGreaterThan(650);
        expect(onsets[2]).toBeLessThan(750);
    });

    it('yields nothing for empty or malformed audio', () => {
        expect(speechOnsets(new Float32Array(0), 24000)).toEqual([]);
        expect(speechOnsets(null, 24000)).toEqual([]);
        expect(speechOnsets(new Float32Array(100), 0)).toEqual([]);
    });

    it('returns ascending offsets', () => {
        const sr = 24000;
        const s = new Float32Array(sr);
        for (let i = 0; i < s.length; i++) {
            s[i] = (Math.floor(i / 2400) % 2) ? Math.sin(i * 0.3) * 0.7 : 0;
        }
        const onsets = speechOnsets(s, sr);
        expect(onsets).toEqual([...onsets].sort((a, b) => a - b));
    });
});
