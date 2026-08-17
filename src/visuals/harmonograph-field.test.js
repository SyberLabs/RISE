/**
 * Gallery Harmonograph field — the pen is on the gallery clock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Harmonograph } from './harmonograph.js';
import { HarmonographField } from './harmonograph-field.js';

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
    vi.spyOn(Harmonograph.prototype, 'generate').mockImplementation(function generate() {
        this.plan = { amplitude: 1, anchors: [[0, 0, 0]] };
        this.trace = new Float32Array(8);
        this.envelope = new Float32Array(4);
        return true;
    });
    vi.spyOn(Harmonograph.prototype, 'render').mockImplementation(function render(_canvas, options) {
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

describe('HarmonographField', () => {
    it('starts the pen at the beginning of the dwell', () => {
        const field = new HarmonographField(host, { dwellMs: 8_000, crossfadeMs: 1_200 });
        field.start();
        expect(progresses[0]).toBe(0);
        expect(host.querySelectorAll('.harmonograph-plane')).toHaveLength(2);
        field.destroy();
    });

    it('advances the pen on the gallery clock', () => {
        const field = new HarmonographField(host, { dwellMs: 8_000, crossfadeMs: 1_200 });
        field.start();
        expect(progresses[0]).toBe(0);
        for (let t = 16; t <= 2_000; t += 16) frame(t);
        const latest = progresses.at(-1);
        expect(latest).toBeGreaterThan(0);
        expect(latest).toBeLessThan(1);
        field.destroy();
    });

    it('holds the pen until the incoming plane has finished dissolving in', () => {
        vi.spyOn(performance, 'now').mockReturnValue(0);
        const field = new HarmonographField(host, { dwellMs: 8_000, crossfadeMs: 1_200 });
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

    it('reduced motion holds one finished figure, with no clock', () => {
        const field = new HarmonographField(host, {
            dwellMs: 8_000,
            reducedMotion: true
        });
        field.start();
        expect(progresses[0]).toBe(1);
        expect(rafQueue).toHaveLength(0);
        field.destroy();
    });
});
