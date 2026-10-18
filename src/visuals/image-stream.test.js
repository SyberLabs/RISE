import { afterEach, describe, expect, it } from 'vitest';
import { STREAM_APERTURE_PX, mountImageStream } from './image-stream.js';
import { apertureIsInherentlySafe } from '../core/flash-meter.js';

/** A display that only refreshes when the test says so. */
function fakeDisplay() {
    let queue = [];
    let ts = 0;
    let nextId = 1;
    return {
        raf: callback => { const id = nextId++; queue.push({ id, callback }); return id; },
        caf: id => { queue = queue.filter(entry => entry.id !== id); },
        pending: () => queue.length,
        /** Advance the clock by `ms` and run one refresh. */
        refresh(ms = 1000 / 60) {
            ts += ms;
            const due = queue;
            queue = [];
            for (const { callback } of due) callback(ts);
        },
        /** Run refreshes at `hz` for `ms` of display time. */
        run(ms, hz = 60) {
            const step = 1000 / hz;
            for (let t = 0; t < ms - 1e-6; t += step) this.refresh(step);
        },
        jump(ms) { ts += ms; }
    };
}

/** A decoded image the size of the aperture, one flat colour. */
function frame(id, [r, g, b] = [120, 120, 120], width = STREAM_APERTURE_PX, height = STREAM_APERTURE_PX) {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < rgba.length; i += 4) {
        rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
    return { id, width, height, rgba };
}

function reel(count) {
    return Array.from({ length: count }, (_, i) => frame(i, [110 + i % 4, 110 + i % 4, 110 + i % 4]));
}

function stage() {
    const el = document.createElement('div');
    document.body.appendChild(el);
    return el;
}

/** The ids of the frames drawn, in order. */
function drawn(stream) {
    const ctx = stream.canvas.getContext('2d');
    return ctx.drawImage.mock.calls.map(([source]) => source.id);
}

afterEach(() => {
    document.body.replaceChildren();
    document.documentElement.classList.remove('photosensitivity-mode', 'reduced-motion');
});

describe('the fixation aperture', () => {
    it('is no larger than the safe area, so its safety is geometry', () => {
        expect(apertureIsInherentlySafe(STREAM_APERTURE_PX, STREAM_APERTURE_PX)).toBe(true);
    });

    it('mounts one canvas, 140 CSS px square, centred in the stage', () => {
        const host = stage();
        const stream = mountImageStream(host, { frames: reel(4), ...fakeDisplay() });
        const canvases = host.querySelectorAll('canvas');
        expect(canvases).toHaveLength(1);
        expect(canvases[0]).toBe(stream.canvas);
        expect(stream.canvas.style.width).toBe('140px');
        expect(stream.canvas.style.height).toBe('140px');
        expect(stream.canvas.style.left).toBe('50%');
        expect(stream.canvas.style.top).toBe('50%');
        expect(stream.canvas.style.transform).toBe('translate(-50%, -50%)');
    });

    it('never exceeds 140 × 140, whatever size it is asked for', () => {
        for (const sizePx of [1e6, 300, 148, Infinity, '900', NaN, -5, 0, null, undefined, {}]) {
            const stream = mountImageStream(stage(), { frames: reel(2), sizePx, ...fakeDisplay() });
            const css = parseFloat(stream.canvas.style.width);
            expect(css, `asked for ${String(sizePx)}`).toBeLessThanOrEqual(140);
            expect(parseFloat(stream.canvas.style.height)).toBe(css);
            expect(stream.canvas.width).toBeLessThanOrEqual(140);
            expect(stream.canvas.height).toBeLessThanOrEqual(140);
            expect(stream.canvas.width * stream.canvas.height).toBeLessThanOrEqual(140 * 140);
            stream.destroy();
        }
    });

    it('honours a smaller aperture', () => {
        const stream = mountImageStream(stage(), { frames: reel(2), sizePx: 96, ...fakeDisplay() });
        expect(stream.canvas.style.width).toBe('96px');
        expect(stream.canvas.width).toBe(96);
    });
});

describe('frame replaces frame', () => {
    it('draws each frame over the last, with no clear, no fill and no fade', () => {
        const display = fakeDisplay();
        const stream = mountImageStream(stage(), { frames: reel(4), ...display });
        stream.resume();
        display.run(1000);
        const ctx = stream.canvas.getContext('2d');
        expect(ctx.drawImage).toHaveBeenCalled();
        expect(ctx.clearRect).not.toHaveBeenCalled();
        expect(ctx.fillRect).not.toHaveBeenCalled();
        expect(stream.canvas.style.transition).toBe('');
        expect(stream.canvas.style.opacity).toBe('');
    });

    it('covers the whole aperture, cropping rather than letterboxing to black', () => {
        const display = fakeDisplay();
        const wide = frame(0, [120, 120, 120], 280, 140);
        const stream = mountImageStream(stage(), { frames: [wide], ...display });
        stream.resume();
        display.refresh();
        const ctx = stream.canvas.getContext('2d');
        expect(ctx.drawImage).toHaveBeenCalledWith(wide, 70, 0, 140, 140, 0, 0, 140, 140);
    });

    it('holds each frame for whole refreshes: 8 per second asked, 7.5 shown on a 60 Hz display', () => {
        const display = fakeDisplay();
        const stream = mountImageStream(stage(), { frames: reel(40), hz: 8, ...display });
        stream.resume();
        display.run(1000);
        // 8 refreshes a frame at 60 Hz is 133⅓ ms: frames 0..7 in the first second.
        expect(drawn(stream)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it('measures the display over the first half second and locks to it', () => {
        const display = fakeDisplay();
        const stream = mountImageStream(stage(), { frames: reel(40), hz: 8, ...display });
        stream.resume();
        display.run(2000, 120);
        // 240 refreshes, the first one the start: 1991⅔ ms shown. At 120 Hz a
        // frame is 15 refreshes, 125 ms, which ends on frame 15; assumed at
        // 60 Hz throughout (133⅓ ms) it would end on frame 14.
        expect(drawn(stream).at(-1)).toBe(15);
        expect(new Set(drawn(stream)).size).toBe(drawn(stream).length);
    });

    it('wraps the reel', () => {
        const display = fakeDisplay();
        const stream = mountImageStream(stage(), { frames: reel(3), hz: 12, ...display });
        stream.resume();
        display.run(500);
        // 12 asked on 60 Hz is 5 refreshes, 83⅓ ms: six frames in half a second.
        expect(drawn(stream)).toEqual([0, 1, 2, 0, 1, 2]);
    });
});

describe('its own clock, driven by the reading', () => {
    it('stays still until the reading plays', () => {
        const display = fakeDisplay();
        const stream = mountImageStream(stage(), { frames: reel(4), ...display });
        expect(display.pending()).toBe(0);
        display.run(500);
        expect(drawn(stream)).toEqual([]);
    });

    it('freezes the frame on pause and continues from it on resume', () => {
        const display = fakeDisplay();
        const stream = mountImageStream(stage(), { frames: reel(40), hz: 8, ...display });
        stream.resume();
        display.run(500);
        expect(drawn(stream).at(-1)).toBe(3);
        stream.pause();
        expect(display.pending()).toBe(0);
        display.jump(10_000);
        display.run(500);
        expect(drawn(stream).at(-1)).toBe(3);
        stream.resume();
        display.refresh();
        // Ten paused seconds did not advance it: the next frame is 4, not 78.
        display.run(100);
        expect(drawn(stream).slice(-2)).toEqual([3, 4]);
    });

    it('recomputes the frame from time on a seek, and replays nothing on the way', () => {
        const display = fakeDisplay();
        const stream = mountImageStream(stage(), { frames: reel(40), hz: 8, ...display });
        stream.resume();
        display.run(200);
        expect(drawn(stream)).toEqual([0, 1]);
        stream.seek(3000);
        display.refresh();
        // 3000 ms at 133⅓ ms a frame is frame 22: drawn next, with nothing between.
        expect(drawn(stream)).toEqual([0, 1, 22]);
    });

    it('lets go of the canvas and the display on destroy', () => {
        const display = fakeDisplay();
        const host = stage();
        const stream = mountImageStream(host, { frames: reel(4), ...display });
        stream.resume();
        display.refresh();
        stream.destroy();
        expect(host.querySelector('canvas')).toBeNull();
        expect(display.pending()).toBe(0);
    });
});
