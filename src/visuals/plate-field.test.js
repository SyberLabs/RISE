/**
 * Gallery plate field — the time adapter is on the gallery clock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ostensoria } from './ostensoria.js';
import { Apparitio } from './apparitio.js';
import { PlateField } from './plate-field.js';

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

    it('holds the reveal until the incoming plane has finished dissolving in', () => {
        vi.spyOn(performance, 'now').mockReturnValue(0);
        const field = new PlateField(host, {
            families: ['apparitio'],
            dwellMs: 8_000,
            crossfadeMs: 1_200
        });
        field.start();
        progresses.length = 0;
        frame(8_000);
        expect(progresses.at(-1)).toBe(0);
        for (let t = 8_050; t <= 9_200; t += 50) frame(t);
        expect(progresses.at(-1)).toBe(0);
        frame(9_250);
        const started = progresses.at(-1);
        expect(started).toBeGreaterThan(0);
        expect(started).toBeLessThan(0.1);
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

    it('finishes a late bake at rotate instead of starting a new generate', () => {
        vi.spyOn(performance, 'now').mockReturnValue(0);
        vi.spyOn(Apparitio.prototype, 'stepBake').mockImplementation(function stepBake(budget) {
            if (budget >= 1000) {
                this.ready = true;
                return true;
            }
            return false;
        });
        const field = new PlateField(host, {
            families: ['apparitio'],
            dwellMs: 8_000,
            crossfadeMs: 1_200
        });
        field.start();
        expect(Apparitio.prototype.generate).toHaveBeenCalledTimes(1);
        progresses.length = 0;
        frame(8_000);
        expect(Apparitio.prototype.generate).toHaveBeenCalledTimes(1);
        expect(Apparitio.prototype.stepBake).toHaveBeenCalledWith(1e9);
        expect(progresses.at(-1)).toBe(0);
        field.destroy();
    });
});
