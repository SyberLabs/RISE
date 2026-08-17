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
    vi.spyOn(Ostensoria.prototype, 'generate').mockImplementation(stub);
    vi.spyOn(Apparitio.prototype, 'generate').mockImplementation(stub);
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
});
