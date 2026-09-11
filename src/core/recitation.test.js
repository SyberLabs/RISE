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
    splitWords, stripEmphasis, sizeAtomScale, revealBudget, revealSchedule, speechOnsets,
    REVEAL_SHARE, REVEAL_MAX_MS, REVEAL_MIN_ATOM_MS,
    SPOKEN_REVEAL_LEAD_MS, ONSET_MIN_GAP_MS
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

    it('steps the Chamber atom face down for longer phrases', () => {
        expect(sizeAtomScale('Happy families')).toBe(1);
        expect(sizeAtomScale('Happy families are all alike; every')).toBe(56 / 72);
        expect(sizeAtomScale('A'.repeat(41))).toBe(40 / 72);
        expect(sizeAtomScale('A'.repeat(61))).toBe(32 / 72);
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

    it('preserves the first speech onset and holds a constant lead after it', () => {
        // The first word still waits for the real voice. Every later one
        // is the same step ahead of its own onset.
        expect(revealSchedule(4, 800, [0, 300, 800, 1120]))
            .toEqual([0, 210, 710, 1030]);
        expect(SPOKEN_REVEAL_LEAD_MS).toBe(90);
    });

    it('does not accelerate away from the voice as the phrase runs', () => {
        // THE DEFECT THIS REPLACES. Scaling every interval by 0.7 does
        // not hold text slightly ahead of speech, it compounds: the same
        // schedule used to put the last of four words 336ms early, and a
        // longer phrase further still, so the reveal finished while the
        // voice was in the middle of the sentence.
        const onsets = [0, 400, 800, 1200, 1600, 2000];
        const schedule = revealSchedule(onsets.length, 3000, onsets);
        const leads = onsets.slice(1).map((at, i) => at - schedule[i + 1]);
        expect(new Set(leads).size, JSON.stringify(leads)).toBe(1);
        expect(leads[0]).toBe(SPOKEN_REVEAL_LEAD_MS);
    });

    it('carries on past the onsets it was given, in order', () => {
        // Silence detection finds fewer gaps than there are words in 60%
        // of the shipped pack, so running out of onsets is the ordinary
        // case rather than an edge one.
        const s = revealSchedule(5, 800, [0, 200, 400]);
        expect(s[0]).toBe(0);
        expect(s).toEqual([...s].sort((a, b) => a - b));
        expect(new Set(s).size).toBe(s.length);
        // And it does not run to the end of the recording — see below.
        expect(s.at(-1)).toBeLessThan(800 * 0.9);
    });

    it('leaves the last word time to be read, instead of the end of the clip', () => {
        // THE DEFECT THIS REPLACES, and it was the common case, not a
        // corner. For a spoken atom `budgetMs` is the WHOLE recording,
        // trailing silence included, and the unmatched tail was spread
        // across all of it — so the final word appeared at the very end
        // and the phrase turned. Measured over the 877 clips in the
        // shipped voice pack: 529 of them, every single clip whose
        // detection came up short, showed its last word with 200ms or
        // less remaining. The median was 90ms, which is the lead, which
        // is to say the last word landed exactly as the audio stopped.
        const words = ['Light', 'enters', 'form', 'and', 'returns', 'again'];
        const clipMs = 3000;
        const s = revealSchedule(words, clipMs, [300, 700, 1100, 1500]);
        expect(clipMs - s.at(-1)).toBeGreaterThan(300);
    });

    it('gives a longer word more of the phrase than a short one', () => {
        // What keeps the rhythm between detected boundaries: "colonies"
        // takes four times as long to say as "of", and dividing the time
        // evenly is the metronome this is trying not to be.
        // One phrase, so the pace is one number: the time a word is given
        // is the gap after it, and the long word must be given more.
        const s = revealSchedule(['aa', 'aaaaaaaaaaaa', 'aa'], 3000, [200]);
        const afterShort = s[1] - s[0];
        const afterLong = s[2] - s[1];
        expect(afterLong).toBeGreaterThan(afterShort * 3);
    });

    it('does not believe two onsets about where six words go', () => {
        // Anchoring the last word to the last onset is right when
        // detection is complete enough to have found it. With two onsets
        // for six words it is not: taken at face value it put all six
        // inside the opening third of the clip and left one word standing
        // for the rest. The recording's own pace overrules it.
        const s = revealSchedule(6, 2000, [300, 650]);
        expect(s.at(-1)).toBeGreaterThan(1200);
        expect(2000 - s.at(-1)).toBeGreaterThan(300);
    });

    it('finishes a sparse short-word sentence well before its audio ends', () => {
        const s = revealSchedule(6, 2000, [300, 650]);
        expect(s[0]).toBe(300);
        expect(s.at(-1)).toBeLessThan(2000 * 0.85);
        expect(s).toEqual([...s].sort((a, b) => a - b));
    });

    it('spreads words across surplus onsets instead of taking the first few', () => {
        // Silence detection can report more boundaries than the sentence
        // has words, and the surplus is not at the end — it is wherever
        // the speaker's mouth closed. Keeping the FIRST N put the whole
        // phrase in the opening of the clip: measured on speech-shaped
        // audio, five words, eight onsets, and the last word shown at
        // 490ms of a 1700ms reading.
        expect(revealSchedule(2, 800, [0, 100, 200, 300])).toEqual([0, 210]);
    });

    it('never places two words on the same instant', () => {
        // Two ways this happened. Ranking surplus onsets by preceding
        // silence kept the earliest whenever the gaps were of a size, so
        // the words landed 10ms apart; and clamping the lead against the
        // previous word put them on the same millisecond when the voice's
        // own first interval was shorter than the lead.
        for (const onsets of [[0, 100, 200, 300], [0, 40, 80, 120, 160], [500, 520, 540]]) {
            const s = revealSchedule(2, 800, onsets);
            expect(s[1], JSON.stringify(onsets)).toBeGreaterThan(s[0]);
        }
    });

    it('leaves every interval after the first exactly as the voice spoke it', () => {
        // The lead is a head start, not a tempo change: it comes out of
        // the opening interval and nothing else is touched.
        const onsets = [200, 700, 900, 1500, 1700];
        const s = revealSchedule(onsets.length, 3000, onsets);
        const spoken = onsets.slice(2).map((at, i) => at - onsets[i + 1]);
        const shown = s.slice(2).map((at, i) => at - s[i + 1]);
        expect(shown).toEqual(spoken);
    });

    it('uses the onsets as they are when there is one for every word', () => {
        // THE DEFECT THIS REPLACES. One boundary per word is the detector
        // reporting that it found the whole phrase, and there is then
        // nothing left to model - but this predicted a rhythm from letter
        // counts anyway and only then snapped that prediction onto the
        // boundaries, and a prediction that had drifted further than its
        // own tolerance could not snap back.
        //
        // Measured on a real pack phrase, ten words and ten onsets: the
        // fifth word is spoken at 1920ms and was revealed at 2610ms, and
        // two pairs of words landed on the same instant because
        // monotonicity clamped the later of each pair onto the earlier.
        const onsets = [320, 700, 980, 1640, 1920, 2700, 3240, 3440, 4080, 4420];
        const s = revealSchedule(onsets.length, 4975, onsets);

        // Every word but the first sits its own lead ahead of its onset,
        // and nothing else moves.
        expect(s[0]).toBe(320);
        expect(s.slice(1)).toEqual(
            onsets.slice(1).map(at => at - SPOKEN_REVEAL_LEAD_MS));
        expect(new Set(s).size).toBe(s.length);
    });

    it('keeps words apart when the prediction lands a fraction of a ms away', () => {
        // Measured on the whole pack: one clip in 868. Two predicted
        // times came out 5e-13 apart - the ordinary residue of dividing a
        // span by a weight - which passed a guard that compared the
        // unrounded values, and the rounding on the way out then put both
        // words on the same millisecond anyway. The guard works in whole
        // milliseconds now, which is what the reader gets.
        const words = ['all', 'these', 'things', 'equally', 'happen',
            'to', 'good', 'men', 'and', 'bad,'];
        const s = revealSchedule(
            words, 3600, [340, 780, 1280, 1420, 1820, 2060, 2640, 2780, 3080]);

        expect(new Set(s).size, JSON.stringify(s)).toBe(s.length);
        expect(s).toEqual([...s].sort((a, b) => a - b));
    });

    it('never reveals two words together when a prediction is clamped', () => {
        // snapToOnsets keeps time from running backwards by clamping a
        // word onto the one before it, which leaves the two sharing a
        // timestamp - and two words appearing at once reads as a stutter
        // rather than as speech.
        for (const onsets of [[100, 105, 110], [0, 5], [900, 901, 902, 903]]) {
            for (const count of [3, 5, 8]) {
                const s = revealSchedule(count, 2000, onsets);
                expect(new Set(s).size, JSON.stringify({ onsets, count, s }))
                    .toBe(s.length);
                expect(s, JSON.stringify({ onsets, count, s }))
                    .toEqual([...s].sort((a, b) => a - b));
            }
        }
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

    it('does not hear a stop consonant as a word boundary', () => {
        // /t/, /k/ and /p/ close the vocal tract: they ARE silence, and a
        // single threshold read every one of them as a new word. Measured
        // on speech-shaped audio, five words came back as eight onsets,
        // three of them inside words.
        const sr = 24000;
        const samples = new Float32Array(Math.floor(sr * 0.9));
        const fill = (fromMs, toMs, amp) => {
            for (let i = Math.floor(sr * fromMs / 1000); i < Math.floor(sr * toMs / 1000); i++) {
                samples[i] = amp * (Math.sin(i * 0.06) * 0.7 + Math.sin(i * 0.19) * 0.3);
            }
        };
        // One word with a 35ms stop in it, then a real 90ms word gap.
        fill(0, 300, 0.9);
        fill(160, 195, 0);
        fill(390, 700, 0.85);

        const onsets = speechOnsets(samples, sr);
        expect(onsets, JSON.stringify(onsets)).toHaveLength(2);
        expect(onsets[1]).toBeGreaterThan(350);
        expect(onsets[1]).toBeLessThan(430);
        // The stop is shorter than the threshold; the word gap is longer.
        expect(ONSET_MIN_GAP_MS).toBeGreaterThan(35);
        expect(ONSET_MIN_GAP_MS).toBeLessThan(90);
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

describe('the utterance is the clock', () => {
    it('reports the real onset, not the start of the clip', () => {
        // Kokoro opens with ~300ms of silence. Seeding the first onset
        // at 0 made the first word appear a third of a second before it
        // was spoken, and every later word inherited the offset.
        const sr = 24000;
        const samples = new Float32Array(sr);
        for (let i = Math.floor(sr * 0.32); i < Math.floor(sr * 0.5); i++) {
            samples[i] = Math.sin(i * 0.3) * 0.8;
        }
        const onsets = speechOnsets(samples, sr);
        expect(onsets[0]).toBeGreaterThan(250);
        expect(onsets[0]).toBeLessThan(400);
    });

    it('gives a reveal schedule that waits for the voice', () => {
        // A schedule starting at 0 would reveal into silence.
        const schedule = revealSchedule(3, 0, [320, 800, 1200]);
        expect(schedule[0]).toBe(320);
        expect(schedule).toEqual([320, 710, 1110]);
    });
});
