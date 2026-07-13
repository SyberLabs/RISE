/**
 * Tests for the plan-driven flame builder — verifies the semantic plan
 * fully constrains the generator's parameter space.
 */
import { describe, it, expect } from 'vitest';
import { FractalFlameGenerator } from './fractal-engine.js';
import { planFlame } from '../../core/conductor.js';

describe('generateFlameFromPlan', () => {
    const rng = (() => {
        let seed = 7;
        return () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    });

    it('builds the planned number of transforms using only the planned variations', () => {
        const gen = new FractalFlameGenerator();
        const plan = planFlame({ valence: -0.6, arousal: 0.9 }, rng());
        gen.generateFlameFromPlan(plan, rng());

        expect(gen.transforms).toHaveLength(plan.numTransforms);
        for (const t of gen.transforms) {
            for (const name of Object.keys(t.variations)) {
                expect(plan.variationPool).toContain(name);
            }
            // weights normalized
            const total = Object.values(t.variations).reduce((s, w) => s + w, 0);
            expect(total).toBeCloseTo(1, 5);
        }
    });

    it('applies the planned palette to the generator', () => {
        const gen = new FractalFlameGenerator();
        const plan = planFlame({ valence: 0.7, arousal: 0.2 }, rng());
        gen.generateFlameFromPlan(plan, rng());

        expect(gen.palette).toHaveLength(256);
        expect(gen.palette[128]).toEqual(plan.palette[128]);
        // emberDawn palette: warm — red dominates blue in the upper range
        expect(gen.palette[200][0]).toBeGreaterThan(gen.palette[200][2]);
    });

    it('suppresses symmetry for chaotic plans', () => {
        const gen = new FractalFlameGenerator();
        const plan = planFlame({ valence: -0.5, arousal: 0.95 }, rng());
        expect(plan.symmetryChance).toBe(0);
        gen.generateFlameFromPlan(plan, rng());
        for (const t of gen.transforms) {
            expect(t.symmetry).toBe(0);
        }
    });

    it('leaves generateRandomFlame (raw platform) untouched', () => {
        const gen = new FractalFlameGenerator();
        gen.generateRandomFlame(3);
        expect(gen.transforms).toHaveLength(3);
    });
});
