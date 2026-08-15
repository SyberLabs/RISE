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

    it('advances the reveal on the gallery clock', () => {
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
