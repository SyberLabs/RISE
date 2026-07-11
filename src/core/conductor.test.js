import { describe, it, expect } from 'vitest';
import { scoreChunk, scoreAtoms, summarizeTrack } from './conductor.js';

const mkAtoms = (...contents) => contents.map(c => ({ content: c, duration: 300 }));

describe('scoreChunk', () => {
    it('scores positive words with positive valence', () => {
        const s = scoreChunk('love joy light beautiful');
        expect(s).not.toBeNull();
        expect(s.valence).toBeGreaterThan(0.5);
        expect(s.hits).toBe(4);
    });

    it('scores negative words with negative valence', () => {
        const s = scoreChunk('death grief pain darkness');
        expect(s.valence).toBeLessThan(-0.4);
    });

    it('scores calm words with low arousal and violent words with high arousal', () => {
        const calm = scoreChunk('peace calm quiet sleep');
        const intense = scoreChunk('war scream fury panic');
        expect(calm.arousal).toBeLessThan(0.3);
        expect(intense.arousal).toBeGreaterThan(0.7);
    });

    it('returns null when no lexicon words are found', () => {
        expect(scoreChunk('the of and quixotic zzz')).toBeNull();
        expect(scoreChunk('')).toBeNull();
        expect(scoreChunk(null)).toBeNull();
    });

    it('handles case and punctuation', () => {
        const s = scoreChunk('LOVE, Joy! (beautiful)');
        expect(s.hits).toBe(3);
        expect(s.valence).toBeGreaterThan(0.5);
    });

    it('negation dampens and flips valence', () => {
        const plain = scoreChunk('happy');
        const negated = scoreChunk('not happy');
        expect(negated.valence).toBeLessThan(0);
        expect(Math.abs(negated.valence)).toBeLessThan(Math.abs(plain.valence));
    });

    it('finds words via suffix fallback', () => {
        // "whispers" isn't in the lexicon but "flowers"→"flower" style fallbacks are
        const s = scoreChunk('blooming');
        expect(s).not.toBeNull();
        expect(s.valence).toBeGreaterThan(0);
    });
});

describe('scoreAtoms', () => {
    it('returns a track aligned with the atom array', () => {
        const atoms = mkAtoms('love', 'the', 'grief', 'the', 'peace');
        const track = scoreAtoms(atoms);
        expect(track).toHaveLength(atoms.length);
        for (const sig of track) {
            expect(sig.valence).toBeGreaterThanOrEqual(-1);
            expect(sig.valence).toBeLessThanOrEqual(1);
            expect(sig.arousal).toBeGreaterThanOrEqual(0);
            expect(sig.arousal).toBeLessThanOrEqual(1);
        }
    });

    it('is smooth: adjacent atoms never jump sharply', () => {
        // Alternating extremes must be heavily damped by the smoothing
        const contents = [];
        for (let i = 0; i < 60; i++) contents.push(i % 2 === 0 ? 'ecstasy joy' : 'terror horror');
        const track = scoreAtoms(mkAtoms(...contents));
        for (let i = 1; i < track.length; i++) {
            expect(Math.abs(track[i].valence - track[i - 1].valence)).toBeLessThan(0.25);
        }
    });

    it('anticipates: signal begins turning before a dark passage starts', () => {
        const contents = [
            ...Array(20).fill('calm peace gentle'),
            ...Array(20).fill('terror death horror')
        ];
        const track = scoreAtoms(mkAtoms(...contents));
        // The last "calm" atom should already be pulled below the first one
        expect(track[19].valence).toBeLessThan(track[5].valence);
    });

    it('tracks a valence arc across a text', () => {
        const contents = [
            ...Array(15).fill('joy love light'),
            ...Array(15).fill('grief death sorrow')
        ];
        const track = scoreAtoms(mkAtoms(...contents));
        expect(track[7].valence).toBeGreaterThan(0.2);
        expect(track[25].valence).toBeLessThan(-0.2);
    });

    it('is deterministic', () => {
        const atoms = mkAtoms('love', 'war', 'peace', 'the end', 'darkness');
        expect(scoreAtoms(atoms)).toEqual(scoreAtoms(atoms));
    });

    it('handles empty input and atoms without content', () => {
        expect(scoreAtoms([])).toEqual([]);
        expect(scoreAtoms(null)).toEqual([]);
        const track = scoreAtoms([{ duration: 500 }, { content: '', duration: 300 }]);
        expect(track).toHaveLength(2);
        expect(track[0].valence).toBe(0);
    });

    it('marks confidence 0 for atoms with no lexicon hits', () => {
        const track = scoreAtoms(mkAtoms('love joy', 'xyzzy blorp'));
        expect(track[0].confidence).toBeGreaterThan(0);
        expect(track[1].confidence).toBe(0);
    });
});

describe('summarizeTrack', () => {
    it('summarizes mean and peak', () => {
        const track = scoreAtoms(mkAtoms(...Array(10).fill('war terror scream')));
        const summary = summarizeTrack(track);
        expect(summary.meanValence).toBeLessThan(0);
        expect(summary.peakArousal).toBeGreaterThan(0.5);
    });

    it('handles empty tracks', () => {
        expect(summarizeTrack([]).meanValence).toBe(0);
    });
});
