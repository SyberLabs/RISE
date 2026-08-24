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

class SecondFamilyEngine extends FakeEngine {}

const defaultEngineLoader = async (id) => {
    if (id === 'fake-work') {
        return [{ id: 'a', name: 'A', engineClass: FakeEngine },
                { id: 'b', name: 'B', engineClass: OtherEngine }];
    }
    if (id === 'other-work') {
        return [{ id: 'z', name: 'Z', engineClass: SecondFamilyEngine }];
    }
    return [];
};
let engineLoader = defaultEngineLoader;

vi.mock('./work-engines.js', () => ({
    isWorkEngineFamily: (id) => id === 'fake-work' || id === 'other-work',
    workEngineFamilies: () => ['fake-work', 'other-work'],
    loadWorkEngines: (id) => engineLoader(id)
}));

const { WorkEngineField, TIME_SCALE } = await import('./work-engine-field.js');

let host;
let rafQueue;

beforeEach(() => {
    steps.length = 0;
    renders = 0;
    engineLoader = defaultEngineLoader;
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

describe('projection readiness', () => {
    it('reports only the first visible copied frame for the current projection host', async () => {
        const projection = document.createElement('div');
        document.body.appendChild(projection);
        const onProjectionPaint = vi.fn();
        const field = new WorkEngineField(host, {
            families: ['fake-work'],
            onProjectionPaint
        });

        field.setProjectionHost(projection);
        expect(onProjectionPaint).not.toHaveBeenCalled();
        await field.start();

        expect(onProjectionPaint).toHaveBeenCalledTimes(1);
        expect(onProjectionPaint).toHaveBeenCalledWith(projection);
        expect(onProjectionPaint.mock.calls[0][0]).toBe(projection);
        expect(onProjectionPaint.mock.calls[0][0]).not.toBe(host);
        expect([...projection.querySelectorAll('.work-engine-plane')]
            .some(canvas => canvas.style.opacity === '1')).toBe(true);

        frame(field, 1000);
        frame(field, 1016);
        field.setProjectionHost(projection);
        expect(onProjectionPaint).toHaveBeenCalledTimes(1);
        field.setProjectionHost(null);
        field._rotate(false);
        expect(onProjectionPaint).toHaveBeenCalledTimes(1);
        field.destroy();
        expect(onProjectionPaint).toHaveBeenCalledTimes(1);
        projection.remove();
    });

    it('does not publish host A load work into replacement host B', async () => {
        let finishLoad;
        engineLoader = () => new Promise(resolve => { finishLoad = resolve; });
        const first = document.createElement('div');
        const second = document.createElement('div');
        document.body.append(first, second);
        const onProjectionPaint = vi.fn();
        const field = new WorkEngineField(host, {
            families: ['fake-work'],
            onProjectionPaint
        });

        field.setProjectionHost(first);
        const starting = field.start();
        field.setProjectionHost(second);
        finishLoad([{ id: 'a', name: 'A', engineClass: FakeEngine }]);
        await starting;

        expect(onProjectionPaint).not.toHaveBeenCalled();
        expect([...second.querySelectorAll('.work-engine-plane')]
            .some(canvas => canvas.style.opacity === '1')).toBe(false);
        field.destroy();
        first.remove();
        second.remove();
    });

    it('does not publish a load that finishes after destroy', async () => {
        let finishLoad;
        engineLoader = () => new Promise(resolve => { finishLoad = resolve; });
        const projection = document.createElement('div');
        document.body.appendChild(projection);
        const onProjectionPaint = vi.fn();
        const field = new WorkEngineField(host, {
            families: ['fake-work'],
            onProjectionPaint
        });

        field.setProjectionHost(projection);
        const starting = field.start();
        field.destroy();
        finishLoad([{ id: 'a', name: 'A', engineClass: FakeEngine }]);
        await starting;

        expect(onProjectionPaint).not.toHaveBeenCalled();
        expect(projection.querySelectorAll('.work-engine-plane')).toHaveLength(0);
        projection.remove();
    });

    it('keeps a failed draw hidden and unready', async () => {
        class BlankEngine extends FakeEngine {
            render() { return false; }
        }
        engineLoader = async () => [{ id: 'blank', name: 'Blank', engineClass: BlankEngine }];
        const projection = document.createElement('div');
        document.body.appendChild(projection);
        const onProjectionPaint = vi.fn();
        const field = new WorkEngineField(host, {
            families: ['fake-work'],
            onProjectionPaint
        });

        field.setProjectionHost(projection);
        await field.start();

        expect(onProjectionPaint).not.toHaveBeenCalled();
        expect([...projection.querySelectorAll('.work-engine-plane')]
            .some(canvas => canvas.style.opacity === '1')).toBe(false);
        field.destroy();
        projection.remove();
    });

    it('stop hides and clears projection planes without duplicating them on restart', async () => {
        const projection = document.createElement('div');
        document.body.appendChild(projection);
        const addListener = vi.spyOn(window, 'addEventListener');
        const field = new WorkEngineField(host, { families: ['fake-work'] });
        field.setProjectionHost(projection);
        await field.start();
        const planes = [...projection.querySelectorAll('.work-engine-plane')];
        for (const plane of planes) plane.getContext('2d').clearRect.mockClear();

        field.stop();

        expect(planes.every(plane => plane.style.opacity === '0')).toBe(true);
        expect(planes.every(plane => plane.getContext('2d').clearRect.mock.calls.length > 0))
            .toBe(true);
        await field.start();
        expect(projection.querySelectorAll('.work-engine-plane')).toHaveLength(2);
        expect(addListener.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(1);
        field.destroy();
        projection.remove();
    });

    it('resizes and redraws a paused projection immediately', async () => {
        let width = 320;
        let height = 180;
        host.getBoundingClientRect = () => ({ width, height });
        const projection = document.createElement('div');
        document.body.appendChild(projection);
        const field = new WorkEngineField(host, { families: ['fake-work'] });
        field.setProjectionHost(projection);
        await field.start();
        field.pause();
        const mirror = projection.querySelector('.work-engine-plane[style*="opacity: 1"]');
        const draw = mirror.getContext('2d').drawImage;
        draw.mockClear();

        width = 640;
        height = 360;
        field._resize();

        expect(mirror.width).toBe(field._planes[field._active].canvas.width);
        expect(mirror.height).toBe(field._planes[field._active].canvas.height);
        expect(draw).toHaveBeenCalled();
        field.destroy();
        projection.remove();
    });

    it('resizes and redraws a reduced-motion projection without starting a loop', async () => {
        let width = 300;
        let height = 200;
        host.getBoundingClientRect = () => ({ width, height });
        const projection = document.createElement('div');
        document.body.appendChild(projection);
        const field = new WorkEngineField(host, {
            families: ['fake-work'],
            reducedMotion: true
        });
        field.setProjectionHost(projection);
        await field.start();
        const mirror = projection.querySelector('.work-engine-plane[style*="opacity: 1"]');
        const draw = mirror.getContext('2d').drawImage;
        draw.mockClear();

        width = 600;
        height = 400;
        field._resize();

        expect(mirror.width).toBe(field._planes[field._active].canvas.width);
        expect(mirror.height).toBe(field._planes[field._active].canvas.height);
        expect(draw).toHaveBeenCalled();
        expect(rafQueue).toHaveLength(0);
        field.destroy();
        projection.remove();
    });
});

describe('the reading clock may hold a bound field', () => {
    it('pauses without discarding engines and resumes without catch-up', async () => {
        const field = new WorkEngineField(host, { families: ['fake-work'] });
        await field.start();
        const engine = field._planes[field._active].engine;
        frame(field, 1000);
        const before = steps.length;

        expect(field.pause()).toBe(true);
        frame(field, 9000); // a queued callback may still arrive after cancel
        expect(steps.length).toBe(before);
        expect(field._planes[field._active].engine).toBe(engine);

        expect(field.resume()).toBe(true);
        frame(field, 10000); // establishes a fresh baseline, no catch-up step
        expect(steps.length).toBe(before);
        frame(field, 10016);
        expect(steps.length).toBeGreaterThan(before);
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

describe('a figure names its engine', () => {
    it('draws exactly the named engine and does not rotate', async () => {
        const field = new WorkEngineField(host, {
            families: ['fake-work'], only: ['b']
        });
        await field.start();
        expect(field._engines.map(e => e.id)).toEqual(['b']);
        // One engine is a figure, not a rotation: it holds.
        const before = field._cursor;
        frame(field, 1000);
        frame(field, 999999);
        expect(field._cursor).toBe(before);
        field.destroy();
    });

    it('goes still rather than substituting when the engine is unknown', async () => {
        // Falling back to the family would put a random engine at
        // Michael's sword and look like it worked.
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const field = new WorkEngineField(host, {
            families: ['fake-work'], only: ['no-such-engine']
        });
        await field.start();
        expect(field.hasEngines()).toBe(false);
        expect(renders).toBe(0);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
        field.destroy();
    });

    it('crosses to the next figure when the cue changes', async () => {
        const field = new WorkEngineField(host, { families: ['fake-work'], only: ['a'] });
        await field.start();
        expect(field._engines.map(e => e.id)).toEqual(['a']);
        await field.setFamilies(['fake-work'], ['b']);
        expect(field._engines.map(e => e.id)).toEqual(['b']);
        field.destroy();
    });

    it('ignores a cue that asks for what is already showing', async () => {
        // setFamilies runs at every cue. If an identical one restarted
        // the field, a movement would reset on every atom and the engine
        // would never advance past its first frame.
        const field = new WorkEngineField(host, { families: ['fake-work'], only: ['a'] });
        await field.start();
        const engine = field._planes[field._active].engine;
        await field.setFamilies(['fake-work'], ['a']);
        expect(field._planes[field._active].engine).toBe(engine);
        field.destroy();
    });
});


describe('one movement never bleeds into the next', () => {
    /**
     * Reported from a real reading of the Demonstration: the Jünger
     * movement opened on a MILTON engine, and the ASCII trench that
     * should have opened it was never seen.
     *
     * A Journey stops the field at the boundary — the transition cue is
     * `still`, so families go empty and the field stops — and starts it
     * again on the next movement. The Chamber's sync assigns `families`
     * and `only` directly and calls start(), which bypasses
     * setFamilies() and therefore never invalidated the load. start()
     * then awaited a promise cached for the PREVIOUS family and adopted
     * its already-narrowed engine list.
     *
     * Nothing threw and nothing warned: the engines had resolved
     * correctly, for the wrong movement.
     */
    it('reloads after a stop when the family changed underneath it', async () => {
        const field = new WorkEngineField(host, { families: ['fake-work'], only: ['a'] });
        await field.start();
        expect(field._engines.map(e => e.id)).toEqual(['a']);

        // What a movement boundary does.
        field.stop();

        // What the Chamber does on the next cue: assign, then start.
        field.families = ['other-work'];
        field.only = ['z'];
        await field.start();

        expect(field._engines.map(e => e.id)).toEqual(['z']);
        expect(field._planes[field._active].entry.familyId).toBe('other-work');
        field.destroy();
    });

    it('reloads when only the figure changed across a stop', async () => {
        const field = new WorkEngineField(host, { families: ['fake-work'], only: ['a'] });
        await field.start();
        field.stop();
        field.only = ['b'];
        await field.start();
        expect(field._engines.map(e => e.id)).toEqual(['b']);
        field.destroy();
    });

    it('still caches when nothing changed', async () => {
        // The guard must not turn every cue into a reload; a movement
        // sends its cue on every atom.
        const field = new WorkEngineField(host, { families: ['fake-work'], only: ['a'] });
        await field.start();
        const first = field._loading;
        await field._loadEngines();
        expect(field._loading).toBe(first);
        field.destroy();
    });
});
