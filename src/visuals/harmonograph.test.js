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

    it('unresponsive Auto varies the climate instead of settling on one', () => {
        const rng = createSeededRandom('variety');
        const seen = new Set();
        for (let i = 0; i < 24; i++) {
            seen.add(planHarmonograph(null, rng).paletteName);
        }
        expect(seen.size).toBeGreaterThan(2);
    });

    it('an explicit climate is a veto — palette pinned, energy still the signal\'s', () => {
        const rng = createSeededRandom('veto');
        // Warm intense signal would pick solarFlare on auto…
        const auto = planHarmonograph({ valence: 0.8, arousal: 0.9 }, rng, { climate: 'auto' });
        expect(auto.paletteName).toBe('solarFlare');

        // …but a pinned midnightWater holds against the same signal
        const pinned = planHarmonograph({ valence: 0.8, arousal: 0.9 },
            createSeededRandom('veto2'), { climate: 'midnightWater' });
        expect(pinned.paletteName).toBe('midnightWater');
        expect([[8, 9], [5, 6], [5, 8]]).toContainEqual(pinned.ratio);

        // Energy subparameters still answer to arousal within the veto
        const calm = planHarmonograph({ valence: 0.8, arousal: 0.1 },
            createSeededRandom('veto2'), { climate: 'midnightWater' });
        expect(pinned.damping).toBeLessThan(calm.damping);
        expect(pinned.rotary).toBeGreaterThan(calm.rotary);

        // Unknown climates fall back to auto behavior, never crash
        const bogus = planHarmonograph({ valence: 0.8, arousal: 0.9 },
            createSeededRandom('veto3'), { climate: 'neonPlaid' });
        expect(bogus.paletteName).toBe('solarFlare');
    });

    describe('colour-only anchors', () => {
        const anchors = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12], [13, 14, 15]];
        const FIGURE = ['paletteName', 'ratio', 'detune', 'damping', 'rotary',
            'rotation', 'amplitude', 'cycles'];

        it('recolour the same figure: chord, ratio, rotation and cycles unchanged', () => {
            const plain = planHarmonograph(null, createSeededRandom('anchors'));
            const themed = planHarmonograph(null, createSeededRandom('anchors'), { anchors });
            expect(themed.anchors).toBe(anchors);
            expect(plain.anchors).not.toBe(anchors);
            for (const key of FIGURE) expect(themed[key], key).toEqual(plain[key]);

            const signalled = planHarmonograph({ valence: 0.7, arousal: 0.3 },
                createSeededRandom('anchors'), { climate: 'auto', anchors });
            expect(signalled.paletteName).toBe('emberDawn');
            expect(signalled.anchors).toBe(anchors);
        });

        it('yield to an explicit climate, which keeps its own anchors', () => {
            const pinned = planHarmonograph(null, createSeededRandom('veto'),
                { climate: 'midnightWater', anchors });
            expect(pinned.paletteName).toBe('midnightWater');
            expect(pinned.anchors).toEqual(
                [[8, 10, 30], [24, 34, 90], [58, 78, 140], [120, 145, 190], [205, 215, 235]]);
        });

        it('replace the climate\'s shared anchors and never mutate them', () => {
            const shared = planHarmonograph(null, createSeededRandom('x'), { climate: 'emberDawn' }).anchors;
            const before = JSON.parse(JSON.stringify(shared));
            planHarmonograph(null, createSeededRandom('x'), { anchors });
            planHarmonograph({ valence: 0.7, arousal: 0.3 }, createSeededRandom('x'), { anchors });
            expect(planHarmonograph(null, createSeededRandom('x'), { climate: 'emberDawn' }).anchors)
                .toBe(shared);
            expect(shared).toEqual(before);
        });

        it('absent or null anchors leave the climate\'s, as today', () => {
            const plain = planHarmonograph(null, createSeededRandom('none'));
            const nulled = planHarmonograph(null, createSeededRandom('none'), { anchors: null });
            expect(nulled.anchors).toBe(plain.anchors);
        });
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

    it('progress traces the pen; omitted progress is the finished figure', () => {
        const hg = new Harmonograph();
        hg.generate({ valence: 0.2, arousal: 0.4 }, 'progress');
        const short = makeCanvas(400, 400);
        const full = makeCanvas(400, 400);
        hg.render(short, { progress: 0.15 });
        hg.render(full);
        expect(full.ctx.stroke.mock.calls.length)
            .toBeGreaterThan(short.ctx.stroke.mock.calls.length);
    });
});

describe('Harmonograph rotary pendulums', () => {
    function rotary(seed, options = {}) {
        const hg = new Harmonograph();
        hg.generate(null, seed, { pendulums: 'rotary', ...options });
        return hg;
    }

    it('is lateral unless rotary is chosen', () => {
        const hg = new Harmonograph();
        hg.generate(null, 'plain');
        expect(hg.pendulums).toBe('lateral');
        expect(hg.drawMs).toBeNull();
        expect(rotary('r').pendulums).toBe('rotary');
    });

    it('draws two pendulums turning opposite ways, with the study\'s ranges', () => {
        for (let i = 0; i < 40; i++) {
            const { f1, f2, d1, d2 } = rotary(`range-${i}`).pair;
            expect([2, 3]).toContain(f1);
            const turn = Math.round(-f2);
            expect([3, 4]).toContain(turn);
            expect(Math.abs(-f2 - turn)).toBeLessThanOrEqual(0.02);
            for (const d of [d1, d2]) {
                expect(d).toBeGreaterThanOrEqual(0.010);
                expect(d).toBeLessThanOrEqual(0.018);
            }
        }
    });

    it('is deterministic under a seed and differs between seeds', () => {
        const a = rotary('same');
        const b = rotary('same');
        expect(Array.from(a.trace)).toEqual(Array.from(b.trace));
        expect(a.pair).toEqual(b.pair);
        expect(Array.from(rotary('other').trace.slice(0, 20))).not.toEqual(Array.from(a.trace.slice(0, 20)));
    });

    it('loses energy until under 5%, and stops there', () => {
        for (const seed of ['e1', 'e2', 'e3', 'e4']) {
            const { envelope } = rotary(seed);
            expect(envelope[0]).toBeCloseTo(1, 6);
            for (let i = 1; i < envelope.length; i++) expect(envelope[i]).toBeLessThan(envelope[i - 1]);
            expect(envelope.at(-1)).toBeLessThan(0.05);
            expect(envelope.at(-2)).toBeGreaterThanOrEqual(0.05);
        }
    });

    it('takes about 18 units of pendulum time a second to draw', () => {
        const hg = rotary('pace');
        const units = (hg.envelope.length - 1) * 0.01;
        expect(hg.drawMs).toBeCloseTo((units / 18) * 1000, 6);
        expect(hg.drawMs).toBeGreaterThan(9_000);
        expect(hg.drawMs).toBeLessThan(17_000);
    });

    it('keeps every point inside the circle inscribed in the frame', () => {
        for (const [w, h] of [[600, 600], [1200, 700], [390, 844]]) {
            for (const seed of ['c1', 'c2', 'c3']) {
                const canvas = makeCanvas(w, h);
                rotary(seed).render(canvas);
                const radius = Math.min(w, h) / 2;
                const points = [...canvas.ctx.moveTo.mock.calls, ...canvas.ctx.lineTo.mock.calls];
                expect(points.length).toBeGreaterThan(1000);
                for (const [x, y] of points) {
                    expect(Math.hypot(x - w / 2, y - h / 2)).toBeLessThanOrEqual(radius * 0.88 + 1e-6);
                }
            }
        }
    });

    it('strokes the pen additively at 0.55 over a wide glow understroke, never with shadowBlur', () => {
        const canvas = makeCanvas(600, 600);
        const modes = [];
        const styles = [];
        canvas.ctx.stroke = vi.fn(() => {
            modes.push(canvas.ctx.globalCompositeOperation);
            styles.push([canvas.ctx.strokeStyle, canvas.ctx.lineWidth]);
        });
        rotary('look').render(canvas);
        expect(styles[0][0]).toMatch(/, 0\.10\)$/);
        expect(styles[0][1]).toBeGreaterThan(styles[1][1]);
        const pen = styles.slice(1);
        expect(pen.length).toBeGreaterThan(100);
        for (const [style] of pen) expect(style).toMatch(/, 0\.55\)$/);
        expect(modes.slice(1).every(mode => mode === 'lighter')).toBe(true);
        expect(canvas.ctx.globalCompositeOperation).toBe('source-over');
        expect(canvas.ctx.shadowBlur).toBeUndefined();
    });

    it('moves from the palette\'s iris toward its core as energy is lost', () => {
        const anchors = [[0, 0, 0], [10, 10, 10], [20, 20, 20], [100, 0, 0], [0, 0, 200]];
        const canvas = makeCanvas(600, 600);
        const styles = [];
        canvas.ctx.stroke = vi.fn(() => styles.push(canvas.ctx.strokeStyle));
        rotary('colour', { anchors }).render(canvas);
        const rgb = style => style.match(/\d+/g).slice(0, 3).map(Number);
        const first = rgb(styles[1]);
        const last = rgb(styles.at(-1));
        expect(first[0]).toBeGreaterThan(90);
        expect(first[2]).toBeLessThan(15);
        expect(last[2]).toBeGreaterThan(180);
        expect(last[0]).toBeLessThan(10);
    });

    it('draws only part of the pen at partial progress', () => {
        const hg = rotary('partial');
        const half = makeCanvas(400, 400);
        const full = makeCanvas(400, 400);
        hg.render(half, { progress: 0.5 });
        hg.render(full);
        const ratio = half.ctx.lineTo.mock.calls.length / full.ctx.lineTo.mock.calls.length;
        expect(ratio).toBeGreaterThan(0.45);
        expect(ratio).toBeLessThan(0.55);
    });
});
