import { describe, it, expect } from 'vitest';
import { scoreChunk, scoreAtoms, summarizeTrack, responsiveFrequency, planInterlocution, planFlame, sampleTrackSignals } from './conductor.js';

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

    it('smooths over reading time, not atom count', () => {
        // TIME-BASED SMOOTHING: the same text at sentence durations must
        // adapt faster PER ATOM than at word durations — each sentence
        // atom carries more reading time, hence more smoothing weight.
        const contents = [
            ...Array(10).fill('calm peace gentle'),
            ...Array(10).fill('terror death horror')
        ];
        const withDuration = ms => contents.map(c => ({ content: c, duration: ms }));

        const wordTrack = scoreAtoms(withDuration(200));
        const sentenceTrack = scoreAtoms(withDuration(2000));

        // Two atoms into the dark passage, the sentence-paced track has
        // travelled much further toward it
        expect(sentenceTrack[11].valence).toBeLessThan(wordTrack[11].valence);

        // A fixed alpha override still bypasses durations entirely
        const fixedShort = scoreAtoms(withDuration(200), { alpha: 0.12 });
        const fixedLong = scoreAtoms(withDuration(2000), { alpha: 0.12 });
        expect(fixedShort).toEqual(fixedLong);
    });
});

describe('responsiveFrequency', () => {
    it('dampens flashes for calm passages, reaching the base only at peak intensity', () => {
        const calm = responsiveFrequency(0.3, { valence: 0.5, arousal: 0 });
        const intense = responsiveFrequency(0.3, { valence: -0.5, arousal: 1 });
        expect(calm).toBeCloseTo(0.105, 5);
        expect(intense).toBeCloseTo(0.3, 5);
    });

    it('never exceeds the user-consented base frequency', () => {
        for (let a = 0; a <= 1; a += 0.1) {
            expect(responsiveFrequency(0.4, { valence: 0, arousal: a })).toBeLessThanOrEqual(0.4);
        }
    });

    it('returns base frequency when no signal is available', () => {
        expect(responsiveFrequency(0.25, null)).toBe(0.25);
    });
});

describe('planInterlocution', () => {
    it('only ever selects from the enabled types', () => {
        for (let i = 0; i < 50; i++) {
            const plan = planInterlocution(
                { valence: Math.random() * 2 - 1, arousal: Math.random() },
                { activeTypes: ['klee', 'rockgarden'] }
            );
            expect(['klee', 'rockgarden']).toContain(plan.type);
        }
    });

    it('returns null type when nothing is enabled', () => {
        expect(planInterlocution({ valence: 0, arousal: 0.5 }, { activeTypes: [] }).type).toBeNull();
    });

    it('biases energetic passages toward fractal and calm ones toward rockgarden', () => {
        const types = ['fractal', 'rockgarden'];
        const count = (signal) => {
            let fractal = 0;
            for (let i = 0; i < 400; i++) {
                if (planInterlocution(signal, { activeTypes: types }).type === 'fractal') fractal++;
            }
            return fractal;
        };
        const energetic = count({ valence: 0, arousal: 0.95 });
        const calm = count({ valence: 0, arousal: 0.05 });
        expect(energetic).toBeGreaterThan(240); // fractal dominates under energy
        expect(calm).toBeLessThan(160);         // rockgarden dominates under stillness
    });

    it('maps signal quadrants onto klee presets when preset is random', () => {
        const preset = (v, a) => planInterlocution({ valence: v, arousal: a }, { activeTypes: ['klee'] }).kleePreset;
        expect(preset(0.6, 0.8)).toBe('twittering');
        expect(preset(-0.6, 0.8)).toBe('chaotic');
        expect(preset(0.6, 0.2)).toBe('harmonic');
        expect(preset(-0.6, 0.2)).toBe('architectural');
        expect(preset(0, 0.3)).toBe('gravitational');
    });

    it('respects an explicit user preset (no override)', () => {
        const plan = planInterlocution({ valence: 0.9, arousal: 0.9 }, { activeTypes: ['klee'], kleePreset: 'volatile' });
        expect(plan.kleePreset).toBeNull();
    });

    it('contracts presence by at most 25% under arousal and clamps to safe bounds', () => {
        const calm = planInterlocution({ valence: 0, arousal: 0 }, { duration: 1000, activeTypes: ['klee'] });
        const intense = planInterlocution({ valence: 0, arousal: 1 }, { duration: 1000, activeTypes: ['klee'] });
        expect(calm.duration).toBeGreaterThan(intense.duration);
        expect(calm.duration).toBe(1000);
        expect(intense.duration).toBe(750);
        expect(planInterlocution({ valence: 0, arousal: 1 }, { duration: 150, activeTypes: ['klee'] }).duration).toBe(150);
    });

    it('is deterministic with an injected rng', () => {
        const rng = () => 0.5;
        const a = planInterlocution({ valence: 0.3, arousal: 0.6 }, { activeTypes: ['klee', 'turrell', 'fractal'] }, rng);
        const b = planInterlocution({ valence: 0.3, arousal: 0.6 }, { activeTypes: ['klee', 'turrell', 'fractal'] }, rng);
        expect(a).toEqual(b);
    });

    it('mood off: no type selection, no preset override — timing still responds', () => {
        const plan = planInterlocution(
            { valence: -0.8, arousal: 0.9 },
            { duration: 1000, activeTypes: ['klee', 'fractal'], kleePreset: 'random', mood: false, rhythm: true }
        );
        expect(plan.type).toBeNull();          // cortex falls back to its raw random pick
        expect(plan.kleePreset).toBeNull();    // 'random' stays truly random
        expect(plan.duration).toBe(775);        // rhythm intent still contracts
    });

    it('rhythm off: duration untouched — imagery still responds', () => {
        const plan = planInterlocution(
            { valence: -0.8, arousal: 0.9 },
            { duration: 1000, activeTypes: ['klee'], kleePreset: 'random', mood: true, rhythm: false }
        );
        expect(plan.duration).toBe(1000);
        expect(plan.type).toBe('klee');
        expect(plan.kleePreset).toBe('chaotic');
    });

    it('both intents off: plan is inert (raw platform equivalent)', () => {
        const plan = planInterlocution(
            { valence: 0.9, arousal: 0.9 },
            { duration: 1000, activeTypes: ['klee', 'fractal'], kleePreset: 'random', mood: false, rhythm: false }
        );
        expect(plan).toEqual({ type: null, duration: 1000, kleePreset: null });
    });
});

describe('planFlame', () => {
    const rng = () => 0.5;

    it('builds a full 256-entry palette with valid channels', () => {
        const plan = planFlame({ valence: 0.5, arousal: 0.5 }, rng);
        expect(plan.palette).toHaveLength(256);
        for (const [r, g, b] of plan.palette) {
            for (const c of [r, g, b]) {
                expect(c).toBeGreaterThanOrEqual(0);
                expect(c).toBeLessThanOrEqual(255);
            }
        }
    });

    it('selects palettes by signal quadrant', () => {
        expect(planFlame({ valence: 0.6, arousal: 0.2 }, rng).paletteName).toBe('emberDawn');
        expect(planFlame({ valence: 0.6, arousal: 0.8 }, rng).paletteName).toBe('solarFlare');
        expect(planFlame({ valence: -0.6, arousal: 0.2 }, rng).paletteName).toBe('midnightWater');
        expect(planFlame({ valence: -0.6, arousal: 0.8 }, rng).paletteName).toBe('stormViolet');
        expect(planFlame({ valence: 0, arousal: 0.2 }, rng).paletteName).toBe('jadeVeil');
        expect(planFlame({ valence: 0, arousal: 0.8 }, rng).paletteName).toBe('whiteHeat');
    });

    it('warm palettes skew red, cool palettes skew blue', () => {
        const warm = planFlame({ valence: 0.7, arousal: 0.7 }, rng).palette[200];
        const cool = planFlame({ valence: -0.7, arousal: 0.7 }, rng).palette[200];
        expect(warm[0]).toBeGreaterThan(warm[2]); // r > b
        expect(cool[2]).toBeGreaterThan(cool[0]); // b > r
    });

    it('scales structure and tone with arousal', () => {
        const calm = planFlame({ valence: 0, arousal: 0.1 }, rng);
        const intense = planFlame({ valence: 0, arousal: 0.9 }, rng);
        expect(intense.numTransforms).toBeGreaterThan(calm.numTransforms);
        expect(intense.tone.brightness).toBeGreaterThan(calm.tone.brightness);
        expect(intense.tone.gamma).toBeLessThan(calm.tone.gamma);
        expect(calm.variationPool).toContain('sinusoidal');
        expect(intense.variationPool).toContain('julia');
        expect(intense.symmetryChance).toBe(0);
    });

    it('mixes valence accents into the variation pool', () => {
        expect(planFlame({ valence: 0.6, arousal: 0.45 }, rng).variationPool).toContain('heart');
        expect(planFlame({ valence: -0.6, arousal: 0.45 }, rng).variationPool).toContain('hyperbolic');
    });

    it('is deterministic with an injected rng', () => {
        expect(planFlame({ valence: 0.3, arousal: 0.6 }, rng)).toEqual(planFlame({ valence: 0.3, arousal: 0.6 }, rng));
    });
});

describe('sampleTrackSignals', () => {
    it('samples evenly across the track including endpoints', () => {
        const track = Array.from({ length: 100 }, (_, i) => ({ valence: i / 100, arousal: 0.5 }));
        const samples = sampleTrackSignals(track, 5);
        expect(samples).toHaveLength(5);
        expect(samples[0]).toBe(track[0]);
        expect(samples[4]).toBe(track[99]);
    });

    it('handles short tracks and empty input', () => {
        expect(sampleTrackSignals([], 8)).toEqual([]);
        expect(sampleTrackSignals(null, 8)).toEqual([]);
        const tiny = [{ valence: 0, arousal: 0.3 }];
        expect(sampleTrackSignals(tiny, 8)).toHaveLength(1);
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
