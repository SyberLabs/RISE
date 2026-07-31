/**
 * The living field.
 *
 * What is worth asserting here is not that a canvas exists — the e2e
 * proves that by watching pixels change behind a real reading. It is the
 * clock: that every engine is stepped, that the step is SLOWED, and that
 * an absence (a backgrounded tab) cannot be integrated in one lurch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const steps = [];
let renders = 0;

class FakeEngine {
    constructor() { this.time = 0; this.seed = 1; }
    generate() {}
    step(dt) { steps.push(dt); this.time += dt; }
    render() { renders += 1; return true; }
}
class OtherEngine extends FakeEngine {}

vi.mock('./work-engines.js', () => ({
    isWorkEngineFamily: (id) => id === 'fake-work',
    workEngineFamilies: () => ['fake-work'],
    loadWorkEngines: async (id) => id === 'fake-work'
        ? [{ id: 'a', name: 'A', engineClass: FakeEngine },
           { id: 'b', name: 'B', engineClass: OtherEngine }]
        : []
}));

const { WorkEngineField, TIME_SCALE } = await import('./work-engine-field.js');

let host;
let rafQueue;

beforeEach(() => {
    steps.length = 0;
    renders = 0;
    rafQueue = [];
    vi.stubGlobal('requestAnimationFrame', (cb) => { rafQueue.push(cb); return rafQueue.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    host = document.createElement('div');
    document.body.appendChild(host);
});

afterEach(() => {
    host.remove();
    vi.unstubAllGlobals();
});

/** Advance the loop by hand: one frame at `at` milliseconds. */
function frame(field, at) {
    const cb = rafQueue.shift();
    if (cb) cb(at);
    return field;
}

describe('it runs a clock the engines do not own', () => {
    it('steps every engine it draws', async () => {
        const field = new WorkEngineField(host, { families: ['fake-work'] });
        await field.start();
        expect(field.hasEngines()).toBe(true);
        // The first render happens before reveal, so the plane never
        // fades in on an empty canvas.
        expect(renders).toBeGreaterThan(0);

        frame(field, 1000);
        frame(field, 1016);
        expect(steps.length).toBeGreaterThan(0);
        field.destroy();
    });

    it('scales dt down rather than retuning thirteen engines', async () => {
        // Each engine's author tuned its own constants; they were tuned
        // for a preview pane, not for behind a paragraph. Scaling the one
        // thing they all consume moves them together and preserves their
        // RELATIVE speeds.
        const field = new WorkEngineField(host, { families: ['fake-work'] });
        await field.start();
        frame(field, 1000);   // establishes the baseline timestamp
        frame(field, 1032);   // a 32ms frame, under the clamp

        const dt = steps.at(-1);
        expect(dt).toBeCloseTo(0.032 * TIME_SCALE, 5);
        expect(TIME_SCALE).toBeLessThan(1);
        field.destroy();
    });

    it('clamps the step so a backgrounded tab does not lurch', async () => {
        // Return after four minutes away and an unclamped engine
        // integrates the whole absence in a single frame.
        const field = new WorkEngineField(host, { families: ['fake-work'] });
        await field.start();
        frame(field, 1000);
        frame(field, 241000);

        const dt = steps.at(-1);
        expect(dt).toBeLessThanOrEqual((1 / 20) * TIME_SCALE);
        field.destroy();
    });

    it('takes no step on the very first frame', async () => {
        // There is no previous timestamp to measure from; a frame that
        // invented one would advance by the page's whole lifetime.
        const field = new WorkEngineField(host, { families: ['fake-work'] });
        await field.start();
        const before = steps.length;
        frame(field, 5000);
        expect(steps.length).toBe(before);
        field.destroy();
    });
});

describe('reduced motion is honoured, not approximated', () => {
    it('draws one frame and starts no loop', async () => {
        const field = new WorkEngineField(host, {
            families: ['fake-work'], reducedMotion: true
        });
        await field.start();
        // The imagery is present — a reader who asked for less motion
        // asked for less motion, not for an empty field.
        expect(renders).toBeGreaterThan(0);
        expect(rafQueue.length).toBe(0);
        expect(steps.length).toBe(0);
        field.destroy();
    });
});

describe('it degrades reverently', () => {
    it('stays dark for a family that does not exist', async () => {
        const field = new WorkEngineField(host, { families: ['not-a-work'] });
        await field.start();
        expect(field.hasEngines()).toBe(false);
        expect(renders).toBe(0);
        field.destroy();
    });

    it('drops an engine that throws instead of killing the loop', async () => {
        const field = new WorkEngineField(host, { families: ['fake-work'] });
        await field.start();
        const plane = field._planes[field._active];
        plane.engine.step = () => { throw new Error('bad frame'); };
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        frame(field, 1000);
        expect(() => frame(field, 1016)).not.toThrow();
        expect(plane.engine).toBeNull();
        // And the loop is still scheduled: one bad engine is not the end
        // of the field.
        expect(rafQueue.length).toBeGreaterThan(0);
        warn.mockRestore();
        field.destroy();
    });

    it('releases its loop and its canvases on destroy', async () => {
        const field = new WorkEngineField(host, { families: ['fake-work'] });
        await field.start();
        expect(host.querySelectorAll('canvas').length).toBe(2);
        field.destroy();
        expect(field.running).toBe(false);
        expect(host.querySelectorAll('canvas').length).toBe(0);
    });
});
