/**
 * Breath: a pace that swells and eases about every ten seconds.
 *
 * It is a rhythm and nothing else. It does not change how long a reading is,
 * it never takes a word below the shortest a reader can perceive, and it gives
 * way entirely where the reading is too fast to swell.
 */
import { describe, expect, it } from 'vitest';
import { compileSession, normalizeSessionConfig } from './session-compiler.js';
import {
    BREATH, PACE_CURVE_IDS, PacingEngine, breathCycles, breathDepth, breathMultiplier
} from './pacing.js';
import { READING_PACE } from './reading-limits.js';

const FLOOR = 100; // PacingEngine's shortest atom, in milliseconds
const CEILING = 10_000;

const SENTENCE = 'The water lay still under the moon, and nothing moved but the light on it. ';
const LONG = SENTENCE.repeat(120); // about 1,700 words

const compile = (curve, wpm, chunkMode) =>
    compileSession({ title: 'Breath', text: LONG, curve, wpm, chunkMode });

const total = session => session.atoms.reduce((sum, atom) => sum + atom.duration, 0);

describe('the vocabulary of pace profiles', () => {
    it('lists breath among them', () => {
        expect(PACE_CURVE_IDS).toContain('breath');
    });

    it('is accepted by the compiler for every profile named, and refuses one that is not', () => {
        for (const id of PACE_CURVE_IDS) {
            expect(normalizeSessionConfig({ curve: id }).curve, id).toBe(id);
        }
        expect(normalizeSessionConfig({ curve: 'sigh' }).curve).toBe('flat');
    });
});

describe('the shape of a breath', () => {
    it('makes a whole number of cycles of the reading, near ten seconds each', () => {
        expect(breathCycles(60_000)).toBe(6);
        expect(breathCycles(96_000)).toBe(10);
        expect(breathCycles(2_000)).toBe(1);
        expect(breathCycles(0)).toBe(1);
        expect(BREATH.periodMs).toBe(10_000);
    });

    it('swells and eases evenly about the authored pace', () => {
        const cycles = breathCycles(60_000);
        let sum = 0;
        const steps = 6000;
        for (let i = 0; i < steps; i += 1) {
            sum += breathMultiplier((i + 0.5) / steps, { cycles, depth: BREATH.depth });
        }
        expect(sum / steps).toBeCloseTo(1, 4);
    });

    it('stays within its depth either side of the authored pace', () => {
        for (let i = 0; i <= 200; i += 1) {
            const m = breathMultiplier(i / 200, { cycles: 6, depth: BREATH.depth });
            expect(m).toBeGreaterThanOrEqual(1 - BREATH.depth - 1e-9);
            expect(m).toBeLessThanOrEqual(1 + BREATH.depth + 1e-9);
        }
    });

    it('gives an atom the whole depth when there is room, and less as the floor closes in', () => {
        expect(breathDepth(1200)).toBe(BREATH.depth);
        expect(breathDepth(FLOOR * 1.05)).toBeCloseTo(1 - FLOOR / (FLOOR * 1.05), 6);
        expect(breathDepth(FLOOR)).toBe(0);
        expect(breathDepth(60)).toBe(0);
    });

    it('never asks for more than the longest an atom may be', () => {
        expect(breathDepth(CEILING)).toBe(0);
        expect(breathDepth(CEILING * 0.95)).toBeLessThan(BREATH.depth);
    });
});

describe('breath through the reading window', () => {
    const speeds = [READING_PACE.min, 120, 300, 600, READING_PACE.max];
    const modes = ['word', 'phrase', 'sentence'];

    for (const wpm of speeds) {
        for (const mode of modes) {
            it(`keeps the reading the same length at ${wpm} wpm by ${mode}`, () => {
                const flat = compile('flat', wpm, mode);
                const breath = compile('breath', wpm, mode);
                expect(breath.atoms).toHaveLength(flat.atoms.length);
                // Words in = words out: the same words, cut the same way.
                expect(breath.atoms.map(atom => atom.content)).toEqual(flat.atoms.map(atom => atom.content));
                expect(Math.abs(total(breath) - total(flat)) / total(flat)).toBeLessThan(0.01);
            });

            it(`takes no word below the floor at ${wpm} wpm by ${mode}`, () => {
                const flat = compile('flat', wpm, mode);
                const breath = compile('breath', wpm, mode);
                breath.atoms.forEach((atom, i) => {
                    if (atom.timingLocked) {
                        expect(atom.duration).toBe(flat.atoms[i].duration);
                    } else {
                        expect(atom.duration).toBeGreaterThanOrEqual(Math.min(FLOOR, flat.atoms[i].duration));
                        expect(atom.duration).toBeLessThanOrEqual(CEILING);
                    }
                });
            });
        }
    }

    it('actually swells and eases where there is room to', () => {
        const flat = compile('flat', 120, 'phrase');
        const breath = compile('breath', 120, 'phrase');
        const ratios = breath.atoms.map((atom, i) => atom.duration / flat.atoms[i].duration);
        expect(Math.max(...ratios)).toBeGreaterThan(1.1);
        expect(Math.min(...ratios)).toBeLessThan(0.9);
    });

    it('is inert where a reading is too fast to swell', () => {
        const flat = compile('flat', READING_PACE.max, 'word');
        const breath = compile('breath', READING_PACE.max, 'word');
        expect(breath.atoms.map(atom => atom.duration)).toEqual(flat.atoms.map(atom => atom.duration));
    });

    it('leaves authored pauses exactly as authored', () => {
        const text = `${SENTENCE.repeat(30)}[PAUSE] ${SENTENCE.repeat(30)}`;
        const flat = compileSession({ title: 'P', text, curve: 'flat', wpm: 150, chunkMode: 'phrase' });
        const breath = compileSession({ title: 'P', text, curve: 'breath', wpm: 150, chunkMode: 'phrase' });
        const locked = session => session.atoms.filter(atom => atom.timingLocked).map(atom => atom.duration);
        expect(locked(breath)).toEqual(locked(flat));
        expect(locked(flat).length).toBeGreaterThan(0);
    });
});

describe('the pacing engine, atom by atom', () => {
    const atoms = (duration, n = 200) => Array.from({ length: n }, (_, i) => ({
        content: `w${i}`, modality: 'text', duration
    }));
    const pace = (list, wpm = 300) => {
        const engine = new PacingEngine({ baseWpm: wpm });
        engine.setBreath({ totalMs: list.reduce((sum, atom) => sum + atom.duration, 0) });
        return engine.paceAtoms(list).map(atom => atom.duration);
    };
    const sum = list => list.reduce((a, b) => a + b, 0);

    it('leaves an atom on the floor exactly where it is', () => {
        expect(new Set(pace(atoms(FLOOR)))).toEqual(new Set([FLOOR]));
    });

    it('lets an atom with room swell and ease the whole depth', () => {
        const held = pace(atoms(1000));
        expect(Math.max(...held)).toBeGreaterThan(1000 * (1 + BREATH.depth) - 5);
        expect(Math.min(...held)).toBeLessThan(1000 * (1 - BREATH.depth) + 5);
        expect(Math.abs(sum(held) - 200_000) / 200_000).toBeLessThan(0.005);
    });

    it('lets an atom just above the floor swell, but never below it or off the reading length', () => {
        const held = pace(atoms(108));
        expect(Math.min(...held)).toBeGreaterThanOrEqual(FLOOR);
        expect(Math.max(...held)).toBeGreaterThan(108);
        expect(Math.abs(sum(held) - 108 * 200) / (108 * 200)).toBeLessThan(0.01);
    });

    it('holds an image or a sign as long as it was authored', () => {
        const engine = new PacingEngine({ baseWpm: 300 });
        engine.setBreath({ totalMs: 40_000 });
        for (const modality of ['image', 'symbol']) {
            const paced = engine.paceAtoms(Array.from({ length: 40 }, () => ({ modality, duration: 1000 })));
            expect(new Set(paced.map(atom => atom.duration)), modality).toEqual(new Set([1000]));
        }
    });

    it('does nothing until a reading chooses it', () => {
        const engine = new PacingEngine({ baseWpm: 300 });
        const paced = engine.paceAtoms(atoms(1000, 40)).map(atom => atom.duration);
        expect(new Set(paced)).toEqual(new Set([1000]));
    });
});
