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
    it('reports only the first visible projection draw for the current host', () => {
        const projection = document.createElement('div');
        document.body.appendChild(projection);
        const onProjectionPaint = vi.fn();
        const field = new HarmonographField(host, {
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
        expect([...projection.querySelectorAll('.harmonograph-plane')]
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
        const field = new HarmonographField(host, { onProjectionPaint });

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
        const field = new HarmonographField(host, { onProjectionPaint });

        field.setProjectionHost(projection);
        field.destroy();

        expect(onProjectionPaint).not.toHaveBeenCalled();
        expect(projection.querySelectorAll('.harmonograph-plane')).toHaveLength(0);
        projection.remove();
    });

    it('keeps a failed draw hidden and unready', () => {
        vi.mocked(Harmonograph.prototype.render).mockReturnValue(false);
        const projection = document.createElement('div');
        document.body.appendChild(projection);
        const onProjectionPaint = vi.fn();
        const field = new HarmonographField(host, { onProjectionPaint });

        field.setProjectionHost(projection);
        field.start();

        expect(onProjectionPaint).not.toHaveBeenCalled();
        expect([...projection.querySelectorAll('.harmonograph-plane')]
            .some(canvas => canvas.style.opacity === '1')).toBe(false);
        field.destroy();
        projection.remove();
    });

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

    it('hands the anchors the cortex supplies to every figure, beside the climate', () => {
        const anchors = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12], [13, 14, 15]];
        const field = new HarmonographField(host, {
            dwellMs: 8_000,
            getClimate: () => 'auto',
            getAnchors: () => anchors
        });
        field.start();
        field._rotate(false);
        const generate = Harmonograph.prototype.generate;
        expect(generate).toHaveBeenCalledTimes(2);
        for (const call of generate.mock.calls) {
            expect(call[2]).toEqual({ climate: 'auto', anchors, pendulums: 'lateral' });
        }
        field.destroy();
    });

    it('passes null anchors when the cortex supplies none', () => {
        const field = new HarmonographField(host, { dwellMs: 8_000 });
        field.start();
        expect(Harmonograph.prototype.generate.mock.calls[0][2])
            .toEqual({ climate: 'auto', anchors: null, pendulums: 'lateral' });
        field.destroy();
    });
});

describe('HarmonographField with rotary pendulums', () => {
    beforeEach(() => {
        vi.mocked(Harmonograph.prototype.generate).mockImplementation(function generate(_signal, _seed, options) {
            this.plan = { amplitude: 1, anchors: [[0, 0, 0]] };
            this.pendulums = options.pendulums;
            this.drawMs = options.pendulums === 'rotary' ? 5_000 : null;
            return true;
        });
        vi.spyOn(performance, 'now').mockReturnValue(0);
    });

    const rotaryField = (options = {}) => new HarmonographField(host, {
        dwellMs: 30_000, crossfadeMs: 1_200, getPendulums: () => 'rotary', ...options
    });

    it('draws the pen at its own pace, not across the dwell', () => {
        const field = rotaryField();
        field.start();
        expect(Harmonograph.prototype.generate.mock.calls[0][2].pendulums).toBe('rotary');
        for (let t = 16; t <= 2_500; t += 16) frame(t);
        expect(progresses.at(-1)).toBeCloseTo(2_496 / 5_000, 2);
        for (let t = 2_516; t <= 5_200; t += 16) frame(t);
        expect(progresses.at(-1)).toBe(1);
        field.destroy();
    });

    it('holds the finished figure 1.6 s, then fades it and starts a fresh pair', () => {
        const field = rotaryField();
        field.start();
        const generate = Harmonograph.prototype.generate;
        for (let t = 16; t <= 6_590; t += 16) frame(t);
        expect(generate).toHaveBeenCalledTimes(1);
        const [first, second] = host.querySelectorAll('.harmonograph-plane');
        expect(first.style.opacity).toBe('1');
        frame(6_600);
        expect(generate).toHaveBeenCalledTimes(2);
        expect(generate.mock.calls[1][1]).not.toBe(generate.mock.calls[0][1]);
        expect(first.style.opacity).toBe('0');
        expect(second.style.opacity).toBe('1');
        // The fresh pair waits out the fade, then draws its own 5 s, then rests 1.6 s.
        for (let t = 6_616; t <= 6_600 + 1_200 + 5_000 + 1_590; t += 16) frame(t);
        expect(generate).toHaveBeenCalledTimes(2);
        for (let t = 14_400; t <= 14_430; t += 16) frame(t);
        expect(generate).toHaveBeenCalledTimes(3);
        field.destroy();
    });

    it('holds a whole figure under reduced motion, with no clock', () => {
        const field = rotaryField({ reducedMotion: true });
        field.start();
        expect(progresses[0]).toBe(1);
        expect(rafQueue).toHaveLength(0);
        field.destroy();
    });

    it('stops its clock while paused: nothing draws and no new pair starts', () => {
        const field = rotaryField();
        field.start();
        for (let t = 16; t <= 1_000; t += 16) frame(t);
        const drawn = progresses.length;
        field.pause();
        while (rafQueue.length) frame(20_000);
        expect(progresses).toHaveLength(drawn);
        expect(Harmonograph.prototype.generate).toHaveBeenCalledTimes(1);
        field.destroy();
    });

    it('crossfades to a fresh figure at once when asked, on the new figure\'s own clock', () => {
        let pendulums = 'lateral';
        const field = rotaryField({ getPendulums: () => pendulums });
        field.start();
        for (let t = 16; t <= 1_000; t += 16) frame(t);
        pendulums = 'rotary';
        field.rotateNow();
        const generate = Harmonograph.prototype.generate;
        expect(generate).toHaveBeenCalledTimes(2);
        expect(generate.mock.calls[1][2].pendulums).toBe('rotary');
        // fade 1.2 s + draw 5 s + rest 1.6 s from now (performance.now() is 0 here)
        expect(field._nextRotateAt).toBe(7_800);
        field.pause();
        field.rotateNow();
        expect(generate).toHaveBeenCalledTimes(2);
        field.destroy();
    });
});
