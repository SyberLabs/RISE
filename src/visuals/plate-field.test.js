/**
 * Gallery plate field — the time adapter is on the gallery clock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ostensoria } from './ostensoria.js';
import { Apparitio } from './apparitio.js';
import { PlateField } from './plate-field.js';
import { PLATE_BAKE_BUDGET_MS } from './plate-bake.js';

let host;
let rafQueue;
const progresses = [];

beforeEach(() => {
    progresses.length = 0;
    rafQueue = [];
    vi.stubGlobal('requestAnimationFrame', (cb) => {
        rafQueue.push(cb);
        return rafQueue.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const stub = function generate() {
        this.ready = true;
        return true;
    };
    const begin = function beginBake() {
        this.ready = false;
    };
    const step = function stepBake() {
        this.ready = true;
        return true;
    };
    vi.spyOn(Ostensoria.prototype, 'generate').mockImplementation(stub);
    vi.spyOn(Apparitio.prototype, 'generate').mockImplementation(stub);
    vi.spyOn(Ostensoria.prototype, 'beginBake').mockImplementation(begin);
    vi.spyOn(Apparitio.prototype, 'beginBake').mockImplementation(begin);
    vi.spyOn(Ostensoria.prototype, 'stepBake').mockImplementation(step);
    vi.spyOn(Apparitio.prototype, 'stepBake').mockImplementation(step);
    vi.spyOn(Ostensoria.prototype, 'render').mockImplementation(function render(_canvas, options) {
        progresses.push(options?.progress);
        return true;
    });
    vi.spyOn(Apparitio.prototype, 'render').mockImplementation(function render(_canvas, options) {
        progresses.push(options?.progress);
        return true;
    });
    host = document.createElement('div');
    document.body.appendChild(host);
});

afterEach(() => {
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function frame(at) {
    const cb = rafQueue.shift();
    if (cb) cb(at);
}

describe('PlateField', () => {
    it('reports only the first successful visible projection draw for the current host', () => {
        const projection = document.createElement('div');
        document.body.appendChild(projection);
        const onProjectionPaint = vi.fn();
        const field = new PlateField(host, {
            families: ['ostensoria'],
            dwellMs: 8_000,
            crossfadeMs: 1_200,
            onProjectionPaint
        });

        field.setProjectionHost(projection);
        expect(onProjectionPaint).not.toHaveBeenCalled();
        field.start();

        expect(onProjectionPaint).toHaveBeenCalledTimes(1);
        expect(onProjectionPaint).toHaveBeenCalledWith(projection);
        expect(onProjectionPaint).not.toHaveBeenCalledWith(host);
        expect([...projection.querySelectorAll('.plate-plane')]
            .some(canvas => canvas.style.opacity === '1')).toBe(true);
        frame(16);
        frame(32);
        field.setProjectionHost(projection);
        expect(onProjectionPaint).toHaveBeenCalledTimes(1);
        field.setProjectionHost(null);
        field._rotate(false);
        expect(onProjectionPaint).toHaveBeenCalledTimes(1);
        field.destroy();
        expect(onProjectionPaint).toHaveBeenCalledTimes(1);
        projection.remove();
    });

    it('reports replacement B, not A, when replacement happens before start', () => {
        const first = document.createElement('div');
        const second = document.createElement('div');
        document.body.append(first, second);
        const onProjectionPaint = vi.fn();
        const field = new PlateField(host, {
            families: ['ostensoria'],
            onProjectionPaint
        });

        field.setProjectionHost(first);
        field.setProjectionHost(second);
        field.start();

        expect(onProjectionPaint).toHaveBeenCalledTimes(1);
        expect(onProjectionPaint).toHaveBeenCalledWith(second);
        expect(onProjectionPaint).not.toHaveBeenCalledWith(first);
        field.destroy();
        first.remove();
        second.remove();
    });

    it('does not report when destroyed before its first draw', () => {
        const projection = document.createElement('div');
        document.body.appendChild(projection);
        const onProjectionPaint = vi.fn();
        const field = new PlateField(host, {
            families: ['ostensoria'],
            onProjectionPaint
        });

        field.setProjectionHost(projection);
        field.destroy();

        expect(onProjectionPaint).not.toHaveBeenCalled();
        expect(projection.querySelectorAll('.plate-plane')).toHaveLength(0);
        projection.remove();
    });

    it('keeps a failed draw hidden and unready', () => {
        vi.mocked(Ostensoria.prototype.render).mockReturnValue(false);
        const projection = document.createElement('div');
        document.body.appendChild(projection);
        const onProjectionPaint = vi.fn();
        const field = new PlateField(host, {
            families: ['ostensoria'],
            onProjectionPaint
        });

        field.setProjectionHost(projection);
        field.start();

        expect(onProjectionPaint).not.toHaveBeenCalled();
        expect([...projection.querySelectorAll('.plate-plane')]
            .some(canvas => canvas.style.opacity === '1')).toBe(false);
        field.destroy();
        projection.remove();
    });

    it('starts the plate at the beginning of the dwell', () => {
        const field = new PlateField(host, {
            families: ['ostensoria'],
            dwellMs: 8_000,
            crossfadeMs: 1_200
        });
        field.start();
        expect(progresses[0]).toBe(0);
        expect(host.querySelectorAll('.plate-plane')).toHaveLength(2);
        field.destroy();
    });

    it('advances the Iris reveal on the gallery clock', () => {
        const field = new PlateField(host, {
            families: ['ostensoria'],
            dwellMs: 8_000,
            crossfadeMs: 1_200
        });
        field.start();
        expect(progresses[0]).toBe(0);
        for (let t = 16; t <= 2_000; t += 16) frame(t);
        const latest = progresses.at(-1);
        expect(latest).toBeGreaterThan(0);
        expect(latest).toBeLessThan(1);
        field.destroy();
    });

    it('advances Spectral Plates on the same gallery clock', () => {
        const field = new PlateField(host, {
            families: ['apparitio'],
            dwellMs: 8_000,
            crossfadeMs: 1_200
        });
        field.start();
        expect(progresses[0]).toBe(0);
        for (let t = 16; t <= 2_000; t += 16) frame(t);
        const latest = progresses.at(-1);
        expect(latest).toBeGreaterThan(0);
        expect(latest).toBeLessThan(1);
        field.destroy();
    });

    it('draws a new plate from the moment it arrives, over the plate before it', () => {
        vi.spyOn(performance, 'now').mockReturnValue(0);
        const options = [];
        vi.mocked(Apparitio.prototype.render).mockImplementation(function render(_canvas, opts) {
            options.push(opts);
            return true;
        });
        const field = new PlateField(host, {
            families: ['apparitio'],
            dwellMs: 8_000,
            crossfadeMs: 1_200
        });
        field.start();
        options.length = 0;
        frame(8_000);
        expect(options.at(-1)).toEqual({ progress: 0, clearGround: true });
        frame(8_050);
        expect(options.at(-1).progress).toBeGreaterThan(0);
        expect(options.at(-1).clearGround).toBe(true);
        field.destroy();
    });

    it('holds the plate before under the new one until it is half drawn, then dissolves it', () => {
        // The screen never passes through black: the incoming canvas carries
        // the outgoing image beneath its own reveal, so the planes swap at
        // once and the old plate leaves only as the new one fills in.
        vi.spyOn(performance, 'now').mockReturnValue(0);
        const field = new PlateField(host, {
            families: ['ostensoria', 'apparitio'],
            dwellMs: 8_000,
            crossfadeMs: 1_200
        });
        field.start();
        const [first, second] = field._planes;
        expect(first.canvas.style.opacity).toBe('1');

        frame(8_000);
        expect(second.underlay).toEqual({ canvas: first.canvas, alpha: 1, fadedMs: 0 });
        expect(first.canvas.style.opacity).toBe('0');
        expect(second.canvas.style.opacity).toBe('1');
        expect(second.canvas.style.transition).toBe('none');

        let t = 8_000;
        while (field._progress(second) < 0.5) {
            t += 50;
            frame(t);
            if (field._progress(second) < 0.5) expect(second.underlay.alpha).toBe(1);
        }
        for (let end = t + 600; t < end;) { t += 50; frame(t); }
        expect(second.underlay.alpha).toBeGreaterThan(0);
        expect(second.underlay.alpha).toBeLessThan(1);
        expect(first.engine).not.toBeNull();

        for (let end = t + 700; t < end;) { t += 50; frame(t); }
        expect(second.underlay).toBeNull();
        expect(first.engine).toBeNull();
        field.destroy();
    });

    it('takes the outgoing projection with it', () => {
        // A plane only ever synced its projection while it was INCOMING,
        // so the copy stayed at full opacity for good. From the third
        // rotation the outgoing copy — later in the DOM, and so on top —
        // covered the plate that had just arrived.
        vi.spyOn(performance, 'now').mockReturnValue(0);
        const projection = document.createElement('div');
        document.body.appendChild(projection);
        const field = new PlateField(host, {
            families: ['ostensoria', 'apparitio'],
            dwellMs: 8_000,
            crossfadeMs: 1_200
        });
        field.setProjectionHost(projection);
        field.start();
        const copies = [...projection.querySelectorAll('.plate-plane')];
        expect(copies).toHaveLength(2);

        frame(8_000);
        expect(copies[0].style.opacity).toBe('0');
        expect(copies[1].style.opacity).toBe('1');

        frame(16_000);
        expect(copies[1].style.opacity).toBe('0');
        expect(copies[0].style.opacity).toBe('1');

        field.destroy();
        projection.remove();
    });

    it('cuts rather than dissolves when motion is reduced', () => {
        // Reduced motion holds one still and never rotates, so the plane
        // that arrived first is the only one that ever carries a style.
        vi.spyOn(performance, 'now').mockReturnValue(0);
        const field = new PlateField(host, {
            families: ['ostensoria', 'apparitio'],
            dwellMs: 8_000,
            crossfadeMs: 1_200,
            reducedMotion: true
        });
        field.start();
        const planes = [...host.querySelectorAll('.plate-plane')];
        expect(planes[0].style.transition).toBe('none');
        expect(planes[0].style.opacity).toBe('1');
        field.destroy();
    });

    it('repaints a finished plate after the canvas is resized', () => {
        const field = new PlateField(host, {
            families: ['apparitio'],
            dwellMs: 8_000,
            reducedMotion: true
        });
        field.start();
        const painted = progresses.length;
        expect(painted).toBeGreaterThan(0);
        host.getBoundingClientRect = () => ({ width: 400, height: 800, top: 0, left: 0, bottom: 800, right: 400 });
        field._resize();
        expect(progresses.length).toBeGreaterThan(painted);
        expect(progresses.at(-1)).toBe(1);
        field.destroy();
    });

    it('reduced motion holds one finished plate, with no clock', () => {
        const field = new PlateField(host, {
            families: ['ostensoria'],
            dwellMs: 8_000,
            reducedMotion: true
        });
        field.start();
        expect(progresses[0]).toBe(1);
        expect(rafQueue).toHaveLength(0);
        field.destroy();
    });

    it('bakes the next plate during the dwell, not at the seam', () => {
        vi.spyOn(performance, 'now').mockReturnValue(0);
        const field = new PlateField(host, {
            families: ['apparitio'],
            dwellMs: 8_000,
            crossfadeMs: 1_200
        });
        field.start();
        expect(Apparitio.prototype.generate).toHaveBeenCalledTimes(1);
        expect(Apparitio.prototype.beginBake).toHaveBeenCalledTimes(1);
        expect(Apparitio.prototype.beginBake.mock.calls[0][1]).toBe('gallery-plate:apparitio:2');
        for (let t = 16; t <= 200; t += 16) frame(t);
        const gens = Apparitio.prototype.generate.mock.calls.length;
        progresses.length = 0;
        frame(8_000);
        expect(Apparitio.prototype.generate).toHaveBeenCalledTimes(gens);
        expect(progresses.at(-1)).toBe(0);
        field.destroy();
    });

    it('projects a finished plate by copy, without re-rendering it every frame', () => {
        vi.spyOn(performance, 'now').mockReturnValue(0);
        const projection = document.createElement('div');
        document.body.appendChild(projection);
        const field = new PlateField(host, {
            families: ['apparitio'],
            dwellMs: 8_000,
            crossfadeMs: 1_200
        });
        field.start();
        field.setProjectionHost(projection);
        expect(projection.querySelectorAll('.plate-plane')).toHaveLength(2);

        let t = 16;
        for (; t <= 7_000 && progresses.at(-1) !== 1; t += 16) frame(t);
        expect(progresses.at(-1)).toBe(1);

        // The plate is done. Holding it must cost no further engine renders,
        // on the gallery canvas or on the projection canvas.
        const afterComplete = progresses.length;
        for (; t <= 7_800; t += 16) frame(t);
        expect(progresses.length).toBe(afterComplete);

        field.destroy();
        projection.remove();
    });

    it('keeps the bake under way when the same families are set again', () => {
        // The visual cortex sets the families on every sync. Restarting the
        // bake each time meant it never finished before the seam.
        vi.spyOn(performance, 'now').mockReturnValue(0);
        const field = new PlateField(host, {
            families: ['apparitio'],
            dwellMs: 8_000,
            crossfadeMs: 1_200
        });
        field.start();
        expect(Apparitio.prototype.beginBake).toHaveBeenCalledTimes(1);
        field.setFamilies(['apparitio']);
        field.setFamilies(['apparitio']);
        expect(Apparitio.prototype.beginBake).toHaveBeenCalledTimes(1);
        field.setFamilies(['ostensoria']);
        expect(Ostensoria.prototype.beginBake).toHaveBeenCalledTimes(1);
        field.destroy();
    });

    it('waits for a late bake rather than finishing it in one long frame at the seam', () => {
        // On a slow phone the slices had not finished by the seam, and
        // finishing them there froze the reading for seconds. The plate on
        // screen stays a little longer instead.
        vi.spyOn(performance, 'now').mockReturnValue(0);
        let steps = 0;
        vi.spyOn(Apparitio.prototype, 'stepBake').mockImplementation(function stepBake() {
            steps += 1;
            this.ready = steps >= 10;
            return this.ready;
        });
        const field = new PlateField(host, {
            families: ['apparitio'],
            dwellMs: 8_000,
            crossfadeMs: 1_200
        });
        field.start();
        const first = field._active;
        frame(16);
        frame(8_000);
        expect(field._active).toBe(first);
        for (let t = 8_016; field._active === first && t < 8_400; t += 16) frame(t);
        expect(field._active).not.toBe(first);
        expect(Apparitio.prototype.stepBake).not.toHaveBeenCalledWith(1e9);
        expect(Apparitio.prototype.generate).toHaveBeenCalledTimes(1);
        field.destroy();
    });
});

describe('PlateField, first plate baked in slices', () => {
    // A plate costs WORK_MS of engine time. generate() pays it in one call;
    // stepBake(budget) pays at most `budget` of it. The fake clock records
    // the cost of each animation frame, so a frame that ran generate() or
    // drained the bake shows up as one long frame.
    const WORK_MS = 600;
    let clock;
    let frameCosts;

    beforeEach(() => {
        clock = 0;
        frameCosts = [];
        vi.spyOn(performance, 'now').mockImplementation(() => clock);
        vi.spyOn(Apparitio.prototype, 'generate').mockImplementation(function generate() {
            clock += WORK_MS;
            this.ready = true;
            return true;
        });
        vi.spyOn(Apparitio.prototype, 'beginBake').mockImplementation(function beginBake() {
            this.ready = false;
            this._left = WORK_MS;
        });
        vi.spyOn(Apparitio.prototype, 'stepBake').mockImplementation(function stepBake(budget) {
            const spent = Math.min(budget, this._left);
            clock += spent;
            this._left -= spent;
            if (this._left <= 0) this.ready = true;
            return this.ready;
        });
    });

    function timedFrame() {
        const before = clock;
        frame(clock);
        frameCosts.push(clock - before);
        clock += 16;
    }

    const settled = promise => {
        const state = { done: false, value: undefined };
        promise.then((value) => { state.done = true; state.value = value; });
        return state;
    };
    const flush = () => new Promise(resolve => setTimeout(resolve, 0));

    it('never freezes a frame, and is ready only once the first plate is drawn', async () => {
        const field = new PlateField(host, {
            families: ['apparitio'],
            dwellMs: 8_000,
            crossfadeMs: 1_200,
            sliceFirstPlate: true
        });
        const startCost = clock;
        const ready = settled(field.start());
        expect(clock - startCost).toBeLessThanOrEqual(PLATE_BAKE_BUDGET_MS);
        expect(Apparitio.prototype.generate).not.toHaveBeenCalled();
        expect(Apparitio.prototype.beginBake.mock.calls[0][1]).toBe('gallery-plate:apparitio:1');

        const planes = [...host.querySelectorAll('.plate-plane')];
        let frames = 0;
        while (!planes.some(plane => plane.style.opacity === '1') && frames < 500) {
            await flush();
            expect(ready.done).toBe(false);
            timedFrame();
            frames += 1;
        }
        expect(frames).toBeGreaterThan(WORK_MS / PLATE_BAKE_BUDGET_MS - 1);
        expect(Math.max(...frameCosts)).toBeLessThanOrEqual(PLATE_BAKE_BUDGET_MS);
        expect(Apparitio.prototype.generate).not.toHaveBeenCalled();
        expect(progresses[0]).toBe(0);
        await flush();
        expect(ready).toEqual({ done: true, value: true });

        // The plate after it is baked the old way: in slices, during the dwell.
        expect(Apparitio.prototype.beginBake.mock.calls[1][1]).toBe('gallery-plate:apparitio:2');
        for (let i = 0; i < 100; i++) timedFrame();
        expect(Math.max(...frameCosts)).toBeLessThanOrEqual(PLATE_BAKE_BUDGET_MS);
        expect(planes[0].style.opacity).toBe('1');
        field.destroy();
    });

    it('holds one finished still under reduced motion, also in slices', async () => {
        const field = new PlateField(host, {
            families: ['apparitio'],
            dwellMs: 8_000,
            reducedMotion: true,
            sliceFirstPlate: true
        });
        const ready = settled(field.start());
        for (let i = 0; i < 500 && rafQueue.length; i++) timedFrame();
        await flush();
        expect(ready).toEqual({ done: true, value: true });
        expect(Math.max(...frameCosts)).toBeLessThanOrEqual(PLATE_BAKE_BUDGET_MS);
        expect(Apparitio.prototype.generate).not.toHaveBeenCalled();
        expect(Apparitio.prototype.beginBake).toHaveBeenCalledTimes(1);
        expect(progresses).toEqual([1]);
        expect(rafQueue).toHaveLength(0);
        field.destroy();
    });

    it('keeps baking across a pause under reduced motion', async () => {
        const field = new PlateField(host, {
            families: ['apparitio'],
            reducedMotion: true,
            sliceFirstPlate: true
        });
        const ready = settled(field.start());
        timedFrame();
        field.pause();
        rafQueue.length = 0;
        field.resume();
        for (let i = 0; i < 500 && rafQueue.length; i++) timedFrame();
        await flush();
        expect(ready).toEqual({ done: true, value: true });
        field.destroy();
    });

    describe('mounted in a hidden tab', () => {
        // Frames that can be cancelled, like the browser's: a hidden tab
        // holds a requested frame until it shows again.
        let cancelled;
        let hidden;
        beforeEach(() => {
            cancelled = new Set();
            let id = 0;
            vi.stubGlobal('requestAnimationFrame', (cb) => {
                const mine = ++id;
                rafQueue.push(Object.assign((t) => { if (!cancelled.has(mine)) cb(t); }, { id: mine }));
                return mine;
            });
            vi.stubGlobal('cancelAnimationFrame', id => cancelled.add(id));
            hidden = true;
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
        });
        afterEach(() => { delete document.hidden; });

        const live = () => rafQueue.filter(cb => !cancelled.has(cb.id)).length;
        const show = () => {
            hidden = false;
            document.dispatchEvent(new Event('visibilitychange'));
        };

        it('runs one frame loop once the tab shows', async () => {
            const field = new PlateField(host, { families: ['apparitio'], sliceFirstPlate: true });
            const ready = settled(field.start());
            show();
            expect(live()).toBe(1);
            for (let i = 0; i < 200 && !ready.done; i++) {
                timedFrame();
                expect(live()).toBe(1);
                await flush();
            }
            expect(ready).toEqual({ done: true, value: true });
            expect(Math.max(...frameCosts)).toBeLessThanOrEqual(PLATE_BAKE_BUDGET_MS);
            field.destroy();
        });

        it('holds one still under reduced motion, whichever frame arrives', async () => {
            const field = new PlateField(host, {
                families: ['ostensoria', 'apparitio'],
                dwellMs: 8_000,
                reducedMotion: true,
                sliceFirstPlate: true
            });
            const ready = settled(field.start());
            show();
            for (let i = 0; i < 500 && rafQueue.length; i++) timedFrame();
            clock += 20_000;
            // A stray frame after the still is shown must not rotate it.
            field._tick(clock);
            await flush();
            expect(ready).toEqual({ done: true, value: true });
            expect(progresses).toEqual([1]);
            const planes = [...host.querySelectorAll('.plate-plane')];
            expect(planes.map(plane => plane.style.opacity)).toEqual(['1', '0']);
            field.destroy();
        });
    });

    it('cancels the bake when destroyed before the first plate, and settles unready', async () => {
        const field = new PlateField(host, {
            families: ['apparitio'],
            sliceFirstPlate: true
        });
        const ready = settled(field.start());
        timedFrame();
        timedFrame();
        const steps = Apparitio.prototype.stepBake.mock.calls.length;
        field.destroy();
        while (rafQueue.length) timedFrame();
        await flush();
        expect(ready).toEqual({ done: true, value: false });
        expect(Apparitio.prototype.stepBake).toHaveBeenCalledTimes(steps);
        expect(Apparitio.prototype.generate).not.toHaveBeenCalled();
        expect(progresses).toHaveLength(0);
    });
});
