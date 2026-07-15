/**
 * Harmonograph engine tests — the conductor's instrument draws a
 * deterministic damped-pendulum trace that stays inside the frame,
 * dies toward stillness, and survives headless environments.
 */
import { describe, it, expect, vi } from 'vitest';
import { Harmonograph } from './harmonograph.js';
import { planHarmonograph } from '../core/conductor.js';
import { createSeededRandom } from './lib/klee-core.js';

function makeCanvas(w = 800, h = 600, withCtx = true) {
    const ctx = {
        fillStyle: '', strokeStyle: '', lineWidth: 0, lineCap: '', lineJoin: '',
        fillRect: vi.fn(), beginPath: vi.fn(), stroke: vi.fn(),
        moveTo: vi.fn(), lineTo: vi.fn()
    };
    return {
        width: w, height: h,
        getContext: () => (withCtx ? ctx : null),
        ctx
    };
}

describe('planHarmonograph', () => {
    it('valence chooses the chord: consonant / tense / golden', () => {
        const rng = createSeededRandom('chords');

        const warm = planHarmonograph({ valence: 0.7, arousal: 0.3 }, rng);
        expect(warm.paletteName).toBe('emberDawn');
        expect([[1, 2], [2, 3], [3, 4]]).toContainEqual(warm.ratio);

        const storm = planHarmonograph({ valence: -0.7, arousal: 0.8 }, rng);
        expect(storm.paletteName).toBe('stormViolet');
        expect([[8, 15], [15, 16], [5, 7]]).toContainEqual(storm.ratio);

        // Neutral gets the golden ratio — the figure that never closes
        const calm = planHarmonograph({ valence: 0, arousal: 0.3 }, rng);
        expect(calm.paletteName).toBe('jadeVeil');
        expect(calm.ratio[1]).toBeCloseTo((1 + Math.sqrt(5)) / 2, 5);
    });

    it('arousal sets pendulum energy: damping falls, motion rises', () => {
        const still = planHarmonograph({ valence: 0.5, arousal: 0.1 }, createSeededRandom('a'));
        const wild = planHarmonograph({ valence: 0.5, arousal: 0.9 }, createSeededRandom('a'));
        expect(still.damping).toBeGreaterThan(wild.damping);
        expect(wild.rotary).toBeGreaterThan(still.rotary);
        expect(wild.detune).toBeGreaterThan(still.detune);
        expect(wild.amplitude).toBeGreaterThan(still.amplitude);
    });

    it('null signal yields a neutral, renderable plan', () => {
        const plan = planHarmonograph(null, createSeededRandom('n'));
        expect(plan.anchors.length).toBeGreaterThan(2);
        expect(plan.ratio.length).toBe(2);
        expect(plan.damping).toBeGreaterThan(0);
    });
});

describe('Harmonograph engine', () => {
    it('generates deterministically for a fixed seed', () => {
        const signal = { valence: 0.4, arousal: 0.6 };
        const a = new Harmonograph();
        const b = new Harmonograph();
        a.generate(signal, 'fixed-seed');
        b.generate(signal, 'fixed-seed');
        expect(Array.from(a.trace.slice(0, 10))).toEqual(Array.from(b.trace.slice(0, 10)));

        const c = new Harmonograph();
        c.generate(signal, 'other-seed');
        expect(Array.from(c.trace.slice(0, 10))).not.toEqual(Array.from(a.trace.slice(0, 10)));
    });

    it('the trace decays: late envelope is far below early', () => {
        const hg = new Harmonograph();
        hg.generate({ valence: -0.5, arousal: 0.2 }, 'decay');
        const early = hg.envelope[10];
        const late = hg.envelope[hg.envelope.length - 10];
        expect(late).toBeLessThan(early * 0.2);
    });

    it('renders inside the frame with glow + pen passes', () => {
        const hg = new Harmonograph();
        hg.generate({ valence: 0.8, arousal: 1 }, 'bounds'); // hottest case
        const canvas = makeCanvas(600, 600);
        expect(hg.render(canvas)).toBe(true);

        // Background painted, then many strokes
        expect(canvas.ctx.fillRect).toHaveBeenCalledWith(0, 0, 600, 600);
        expect(canvas.ctx.stroke.mock.calls.length).toBeGreaterThan(10);

        // Every plotted point stays within the canvas
        for (const [x, y] of canvas.ctx.lineTo.mock.calls) {
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(600);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThanOrEqual(600);
        }
    });

    it('is silent without a 2d context or before generate', () => {
        const hg = new Harmonograph();
        expect(hg.render(makeCanvas())).toBe(false); // nothing generated yet

        hg.generate(null, 's');
        expect(hg.render(makeCanvas(800, 600, false))).toBe(false); // headless
        expect(hg.render(null)).toBe(false);
    });
});
