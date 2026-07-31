/**
 * Heaven in Order.
 *
 * The design thesis of this engine is a claim about MOTION, not about
 * colour: every element rotates or translates as a rigid body, and
 * nothing scatters, spawns, decays or drifts. That is what makes it the
 * state the rest of Book VI is measured against, and what makes the
 * sword and the sulphurous invention legible when they arrive.
 *
 * A claim like that is worth nothing if it is only in a comment. These
 * assertions are the claim, made checkable.
 */
import { describe, expect, it, vi } from 'vitest';
import { ParadiseHeavenInOrderEngine } from './ParadiseHeavenInOrderEngine.js';

/** A canvas that records what was asked of it. */
function stubCanvas(width = 1280, height = 800) {
    const calls = { arc: 0, fill: 0, stroke: 0, fillRect: 0, gradients: 0 };
    const gradient = () => {
        calls.gradients += 1;
        return { addColorStop() {} };
    };
    const ctx = {
        save() {}, restore() {}, beginPath() {}, closePath() {},
        moveTo() {}, lineTo() {}, translate() {}, scale() {}, rect() {}, clip() {},
        arc() { calls.arc += 1; }, fill() { calls.fill += 1; },
        stroke() { calls.stroke += 1; }, fillRect() { calls.fillRect += 1; },
        createLinearGradient: gradient,
        createRadialGradient: gradient,
        createConicGradient: gradient,
        globalAlpha: 1, globalCompositeOperation: 'source-over',
        lineWidth: 1, lineCap: 'butt', fillStyle: '', strokeStyle: ''
    };
    return { canvas: { width, height, getContext: () => ctx }, calls, ctx };
}

describe('it draws', () => {
    it('renders without being generated first', () => {
        // The field calls generate(), but a caller that forgets must get
        // a drawn frame rather than an empty one.
        const engine = new ParadiseHeavenInOrderEngine();
        const { canvas, calls } = stubCanvas();
        expect(engine.render(canvas)).toBe(true);
        expect(calls.arc).toBeGreaterThan(0);
        expect(calls.gradients).toBeGreaterThan(4);
    });

    it('refuses a canvas with no area rather than dividing by it', () => {
        const engine = new ParadiseHeavenInOrderEngine();
        expect(engine.render(stubCanvas(0, 0).canvas)).toBe(false);
        expect(engine.render(null)).toBe(false);
    });

    it('offers the three registers at every size it will be asked for', () => {
        const engine = new ParadiseHeavenInOrderEngine();
        engine.generate({}, 'seed');
        for (const [w, h] of [[2560, 1600], [1280, 800], [390, 844], [844, 390]]) {
            expect(engine.render(stubCanvas(w, h).canvas), `${w}x${h}`).toBe(true);
        }
    });
});

describe('every motion is rigid', () => {
    it('keeps no state but the clock', () => {
        // If step() ever touches anything else, the "rigid" claim stops
        // being structural and becomes a matter of tuning.
        const engine = new ParadiseHeavenInOrderEngine();
        engine.generate({}, 'seed');
        const before = JSON.stringify({ lattice: engine.lattice, motes: engine.motes });
        for (let i = 0; i < 5000; i += 1) engine.step(0.016, {});
        const after = JSON.stringify({ lattice: engine.lattice, motes: engine.motes });
        expect(after).toBe(before);
        expect(engine.time).toBeCloseTo(80, 5);
    });

    it('never consults Math.random after generation', () => {
        // The Chariot spawns lightning on a timer and the Dark Ocean
        // drifts its particles. This one may do neither: an unpredictable
        // event is exactly the thing that has not happened yet in Book VI.
        const engine = new ParadiseHeavenInOrderEngine();
        engine.generate({}, 'seed');
        const random = vi.spyOn(Math, 'random');
        for (let i = 0; i < 600; i += 1) engine.step(0.016, {});
        engine.render(stubCanvas().canvas);
        expect(random).not.toHaveBeenCalled();
        random.mockRestore();
    });

    it('holds the ranks exactly, however long the reading', () => {
        // The quadrate's positions are derived from integer (col, row)
        // every frame and the body wraps by whole cells, so there is no
        // accumulator to drift. Two engines at wildly different points
        // in time must hold an identical grid.
        const a = new ParadiseHeavenInOrderEngine();
        const b = new ParadiseHeavenInOrderEngine();
        a.generate({}, 'seed');
        b.generate({}, 'seed');
        for (let i = 0; i < 200000; i += 1) b.step(0.016, {});
        expect(b.lattice.map(p => [p.col, p.row]))
            .toEqual(a.lattice.map(p => [p.col, p.row]));
    });

    it('is the same heaven every time from the same seed', () => {
        const a = new ParadiseHeavenInOrderEngine();
        const b = new ParadiseHeavenInOrderEngine();
        a.generate({}, 'book-vi');
        b.generate({}, 'book-vi');
        expect(b.lattice).toEqual(a.lattice);
        expect(b.motes).toEqual(a.motes);
    });
});

describe('dawn is an event that finishes', () => {
    it('opens the gates once and leaves them open', () => {
        // A sine would make the gates breathe, and Milton's line is that
        // Morn unbarred them. The order revealed is the subject, not the
        // revealing.
        const engine = new ParadiseHeavenInOrderEngine();
        engine.generate({}, 'seed');
        const at = seconds => 1 - Math.exp(-seconds * engine.params.dawnSpeed);
        expect(at(0)).toBe(0);
        expect(at(30)).toBeGreaterThan(at(5));
        expect(at(600)).toBeGreaterThan(0.99);
        // And never comes back down.
        let last = -1;
        for (let s = 0; s < 2000; s += 7) {
            expect(at(s)).toBeGreaterThanOrEqual(last);
            last = at(s);
        }
    });

    it('never completes a turn while anyone is watching', () => {
        // The figure accompanies Book VI lines 0-111: roughly 820 words,
        // about four minutes at reading pace. A revolution shorter than
        // that would return the Hours to a position the reader has
        // already seen, and a mechanism that visibly repeats is an
        // ornament. The field scales dt by 0.3, so that is in here too.
        const engine = new ParadiseHeavenInOrderEngine();
        const FIGURE_SECONDS = (820 / 200) * 60;
        const revolution = (Math.PI * 2) / engine.params.roundSpeed / 0.3;
        expect(revolution).toBeGreaterThan(FIGURE_SECONDS * 2);
    });
});

describe('it is registered as one of Milton\'s engines', () => {
    it('is in the family under the id the Journey names', async () => {
        const { PARADISE_LOST_ENGINES } = await import('./index.js');
        const entry = PARADISE_LOST_ENGINES.find(e => e.id === 'heaven_in_order');
        expect(entry).toBeTruthy();
        expect(entry.engineClass).toBe(ParadiseHeavenInOrderEngine);
    });
});
