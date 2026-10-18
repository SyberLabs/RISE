import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STREAM_APERTURE_PX, decodeStreamFrames, mountImageStream } from './image-stream.js';
import { apertureIsInherentlySafe } from '../core/flash-meter.js';
import {
    beginNonFlashingVisualSession,
    beginVisualInterlocutionSession,
    endVisualInterlocutionSession,
    grantVisualInterlocutionConsent
} from '../core/visual-safety.js';

/** A seeded generator, so a failing case can be replayed. */
function seeded(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * A display that only refreshes when the test says so. Each refresh lands on
 * the nominal grid plus up to jitterMs either way, as rAF timestamps do.
 */
function fakeDisplay({ jitterMs = 0, random = seeded(1) } = {}) {
    let queue = [];
    let nominal = 0;
    let nextId = 1;
    return {
        refreshes: 0,
        raf: callback => { const id = nextId++; queue.push({ id, callback }); return id; },
        caf: id => { queue = queue.filter(entry => entry.id !== id); },
        pending: () => queue.length,
        now: () => nominal,
        /** Advance the clock by ms and run one refresh. */
        refresh(ms = 1000 / 60) {
            nominal += ms;
            this.refreshes += 1;
            const ts = nominal + (random() * 2 - 1) * jitterMs;
            const due = queue;
            queue = [];
            for (const { callback } of due) callback(ts);
        },
        /** Run refreshes at hz for ms of display time. */
        run(ms, hz = 60) {
            const step = 1000 / hz;
            for (let t = 0; t < ms - 1e-6; t += step) this.refresh(step);
        },
        jump(ms) { nominal += ms; }
    };
}

/** How many refreshes each frame after the first was held, from the refresh each was drawn on. */
function holds(stream, display) {
    const at = [];
    stream.canvas.getContext('2d').drawImage.mockImplementation(() => at.push(display.refreshes));
    // The first frame also holds while the display is measured: left out.
    return () => at.slice(1).map((refresh, i) => refresh - at[i]).slice(1);
}

/** A decoded image the size of the aperture, one flat colour. */
function frame(id, [r, g, b] = [120, 120, 120], width = STREAM_APERTURE_PX, height = STREAM_APERTURE_PX, alpha = 255) {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < rgba.length; i += 4) {
        rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = alpha;
    }
    return { id, width, height, rgba };
}

/** A PNG with an alpha channel: a white disc's worth of pixels at half opacity. */
function translucent(id) {
    const image = frame(id, [255, 255, 255]);
    for (let i = 3; i < image.rgba.length; i += 8) image.rgba[i] = 128;
    return image;
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

/** Let the canvas give back the pixels of the frame last drawn, as a real one would. */
function wirePixels(stream) {
    const ctx = stream.canvas.getContext('2d');
    let last = null;
    ctx.drawImage.mockImplementation(source => { last = source; });
    ctx.getImageData.mockImplementation((x, y, width, height) => ({ width, height, data: last.rgba }));
    return ctx;
}

/** Black and white, alternating every frame, over the whole aperture. */
function strobe(count = 12) {
    return Array.from({ length: count }, (_, i) => frame(i, i % 2 ? [255, 255, 255] : [0, 0, 0]));
}

/** What the launch gate holds after an accepted photosensitivity notice. */
function acceptNotice() {
    grantVisualInterlocutionConsent('stream-test');
    beginVisualInterlocutionSession('stream-test');
}

beforeEach(acceptNotice);

let restoreGetContext = () => {};
// The setup mock makes any property it is asked for, so a WeakSet remembers.
const readingBack = new WeakSet();

// Every canvas gives back the pixels of the frame last drawn on it, as a real
// one would, so the opacity check and the meter read what was drawn.
beforeEach(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    const original = getContext.getMockImplementation();
    restoreGetContext = () => getContext.mockImplementation(original);
    getContext.mockImplementation(function readBack(type, options) {
        const ctx = original.call(this, type, options);
        if (ctx && !readingBack.has(ctx)) {
            readingBack.add(ctx);
            let last = null;
            ctx.drawImage.mockImplementation(source => { last = source; });
            ctx.getImageData.mockImplementation((x, y, width, height) => ({
                width, height, data: last ? last.rgba : frame(-1, [120, 120, 120], width, height).rgba
            }));
        }
        return ctx;
    });
});

afterEach(() => {
    restoreGetContext();
    endVisualInterlocutionSession();
    document.body.replaceChildren();
    document.documentElement.classList.remove('photosensitivity-mode', 'reduced-motion');
    delete document.visibilityState;
    vi.unstubAllGlobals();
});

describe('the fixation aperture', () => {
    it('is no larger than the safe area, which lowers the risk but excuses nothing', () => {
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

    it('shows its first frame still until it has measured the display', () => {
        const display = fakeDisplay();
        const stream = mountImageStream(stage(), { frames: reel(40), hz: 12, ...display });
        stream.resume();
        display.run(450, 120);
        expect(drawn(stream)).toEqual([0]);
    });

    it('holds each frame 8 refreshes on a 60 Hz display when 8 a second are asked (7.5 shown)', () => {
        const display = fakeDisplay();
        const stream = mountImageStream(stage(), { frames: reel(40), hz: 8, ...display });
        const held = holds(stream, display);
        stream.resume();
        display.run(3000);
        expect(held().length).toBeGreaterThan(10);
        expect(new Set(held())).toEqual(new Set([8]));
    });

    it('locks to a 120 Hz display it has measured: 15 refreshes, exactly 8 a second', () => {
        const display = fakeDisplay();
        const stream = mountImageStream(stage(), { frames: reel(40), hz: 8, ...display });
        const held = holds(stream, display);
        stream.resume();
        display.run(3000, 120);
        expect(held().length).toBeGreaterThan(10);
        expect(new Set(held())).toEqual(new Set([15]));
    });

    it('holds every frame the same whole number of refreshes under timestamp jitter, never faster than asked', () => {
        for (const refreshHz of [30, 60, 120, 144]) {
            for (const hz of [4, 8, 12]) {
                const rpf = Math.ceil(refreshHz / hz - 1e-9);
                const display = fakeDisplay({ jitterMs: 1, random: seeded(refreshHz * 100 + hz) });
                const stream = mountImageStream(stage(), { frames: reel(24), hz, ...display });
                const held = holds(stream, display);
                stream.resume();
                display.run(10000, refreshHz);
                const label = refreshHz + ' Hz display, ' + hz + ' asked';
                expect(held().length, label).toBeGreaterThan(30);
                for (const hold of held()) {
                    expect(hold, label).toBe(rpf);
                    expect(refreshHz / hold).toBeLessThanOrEqual(hz + 1e-9);
                }
                stream.destroy();
            }
        }
    });

    it('wraps the reel', () => {
        const display = fakeDisplay();
        const stream = mountImageStream(stage(), { frames: reel(3), hz: 12, ...display });
        stream.resume();
        display.run(1200);
        expect(drawn(stream).slice(0, 7)).toEqual([0, 1, 2, 0, 1, 2, 0]);
    });
});

describe('the rate cap when the display is not the rate it was measured at', () => {
    for (const [measured, real] of [[30, 60], [60, 120]]) {
        it(`never shows faster than asked when measured at ${measured} Hz and refreshing at ${real}, then stands down`, () => {
            const display = fakeDisplay();
            const onFallback = vi.fn();
            const stream = mountImageStream(stage(), { frames: reel(40), hz: 12, onFallback, ...display });
            const changes = [];
            stream.canvas.getContext('2d').drawImage.mockImplementation(() => changes.push(display.now()));
            stream.resume();
            display.run(600, measured);
            const switchedAt = display.now();
            display.run(1500, real);
            const holds = changes.slice(1).map((at, i) => at - changes[i]);
            expect(changes.filter(at => at > switchedAt).length, 'frames shown after the switch').toBeGreaterThan(1);
            for (const hold of holds) {
                // Never sooner than one frame at 12 Hz, less one refresh of rounding.
                expect(hold).toBeGreaterThanOrEqual(1000 / 12 - 1000 / real - 1e-6);
            }
            expect(onFallback).toHaveBeenCalledWith('refresh');
            const stoppedAt = changes.at(-1);
            expect(stoppedAt - switchedAt).toBeLessThan(1000);
        });
    }

    it('keeps playing when the display keeps the rate it was measured at, jitter and all', () => {
        const display = fakeDisplay({ jitterMs: 1, random: seeded(7) });
        const onFallback = vi.fn();
        const stream = mountImageStream(stage(), { frames: reel(40), hz: 12, onFallback, ...display });
        stream.resume();
        display.run(5000, 60);
        expect(onFallback).not.toHaveBeenCalled();
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
        display.run(1000);
        const paused = drawn(stream).at(-1);
        expect(paused).toBeGreaterThan(0);
        stream.pause();
        expect(display.pending()).toBe(0);
        display.jump(10_000);
        display.run(500);
        expect(drawn(stream).at(-1)).toBe(paused);
        stream.resume();
        display.refresh();
        // Ten paused seconds did not advance it: the next frame follows on.
        display.run(150);
        expect(drawn(stream).slice(-2)).toEqual([paused, paused + 1]);
    });

    it('recomputes the frame from time on a seek, and replays nothing on the way', () => {
        const display = fakeDisplay();
        const stream = mountImageStream(stage(), { frames: reel(40), hz: 8, ...display });
        stream.resume();
        display.run(200);
        expect(drawn(stream)).toEqual([0]);
        stream.seek(3000);
        display.refresh();
        // 3000 ms is 180 refreshes at 60 Hz, 8 a frame: frame 22, drawn next
        // with nothing between.
        expect(drawn(stream)).toEqual([0, 22]);
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

describe('the runtime meter: every frame drawn is measured, and the stream fails closed', () => {
    it('plays a benign reel at 8 Hz for five seconds without tripping, measuring every frame', () => {
        // Magnified by pinch-zoom: what keeps this reel playing is that its
        // light barely changes, not the size it is shown at.
        const display = fakeDisplay();
        const onFallback = vi.fn();
        const stream = mountImageStream(stage(), { frames: reel(40), hz: 8, onFallback, ...display });
        const ctx = wirePixels(stream);
        vi.stubGlobal('visualViewport', { scale: 3 });
        stream.resume();
        display.run(5000);
        expect(onFallback).not.toHaveBeenCalled();
        expect(stream.running).toBe(true);
        expect(stream.canvas.style.display).not.toBe('none');
        expect(ctx.drawImage.mock.calls.length).toBeGreaterThan(30);
        expect(ctx.getImageData).toHaveBeenCalledTimes(ctx.drawImage.mock.calls.length);
    });

    it('stops a black-and-white strobe within one second at the aperture\'s own size', () => {
        // 19,600 px² is under the 21,824 px² a WCAG flash must exceed, but
        // page zoom, OS magnifiers and the glass tile's blur can all enlarge
        // the light on screen without the page seeing it. The meter is armed
        // at every size.
        const display = fakeDisplay();
        const onFallback = vi.fn();
        const stream = mountImageStream(stage(), { frames: strobe(), hz: 12, onFallback, ...display });
        wirePixels(stream);
        stream.resume();
        display.run(1500);
        expect(onFallback).toHaveBeenCalledTimes(1);
        expect(onFallback).toHaveBeenCalledWith('meter');
    });

    it('refuses to mount on a page that is already zoomed', () => {
        // Browser zoom at 200%: the CSS viewport is half the window.
        vi.stubGlobal('outerWidth', 1024);
        vi.stubGlobal('innerWidth', 512);
        expect(mountImageStream(stage(), { frames: reel(4), ...fakeDisplay() })).toBeNull();
        vi.unstubAllGlobals();
        // Pinch-zoomed before the reading began.
        vi.stubGlobal('visualViewport', { scale: 2 });
        expect(mountImageStream(stage(), { frames: reel(4), ...fakeDisplay() })).toBeNull();
    });

    it('stands down once if the page is zoomed while the stream runs', () => {
        for (const [name, value] of [['devicePixelRatio', 2], ['innerWidth', 400]]) {
            vi.stubGlobal('devicePixelRatio', 1);
            vi.stubGlobal('innerWidth', 1024);
            const display = fakeDisplay();
            const onFallback = vi.fn();
            const stream = mountImageStream(stage(), { frames: reel(40), onFallback, ...display });
            wirePixels(stream);
            stream.resume();
            display.run(300);
            expect(onFallback).not.toHaveBeenCalled();
            vi.stubGlobal(name, value);
            display.run(300);
            expect(onFallback, name).toHaveBeenCalledTimes(1);
            expect(onFallback).toHaveBeenCalledWith('zoom');
            expect(stream.canvas.style.display).toBe('none');
        }
    });

    it('stops a strobe within one second once pinch-zoom makes the aperture larger than the safe area', () => {
        const display = fakeDisplay();
        const onFallback = vi.fn();
        const stream = mountImageStream(stage(), { frames: strobe(), hz: 12, onFallback, ...display });
        const ctx = wirePixels(stream);
        vi.stubGlobal('visualViewport', { scale: 3 });
        stream.resume();
        display.run(1500);
        expect(onFallback).toHaveBeenCalledTimes(1);
        expect(onFallback).toHaveBeenCalledWith('meter');
        expect(stream.running).toBe(false);
        expect(stream.canvas.style.display).toBe('none');
        expect(display.pending()).toBe(0);
        // Every frame after the first is a transition, and a flash is two.
        // Two flashes in a second are allowed; the frame that completes the
        // third (the seventh drawn) is refused.
        const drawnBefore = ctx.drawImage.mock.calls.length;
        expect(drawnBefore).toBe(7);
        stream.resume();
        display.run(1000);
        expect(ctx.drawImage.mock.calls.length).toBe(drawnBefore);
        expect(onFallback).toHaveBeenCalledTimes(1);
    });

    it('stops a strobe once a stylesheet stretches the canvas beyond the safe area', () => {
        const display = fakeDisplay();
        const onFallback = vi.fn();
        const stream = mountImageStream(stage(), { frames: strobe(), hz: 12, onFallback, ...display });
        wirePixels(stream);
        stream.canvas.getBoundingClientRect = () => ({ width: 320, height: 320 });
        stream.resume();
        display.run(1500);
        expect(onFallback).toHaveBeenCalledWith('meter');
    });

    it('treats an aperture it cannot measure as unbounded, so a change on any pixel counts', () => {
        // Ten pixels pass at the floor (it takes 307); only an unbounded area
        // counts them.
        expect(play(patch(10))).toBeNull();
        const unmeasurable = stream => { stream.canvas.getBoundingClientRect = () => ({ width: NaN, height: 140 }); };
        expect(play(patch(10), unmeasurable)).toBe('meter');
    });

    it('stops when the meter throws, as it does for pixels it cannot read', () => {
        const display = fakeDisplay();
        const onFallback = vi.fn();
        const stream = mountImageStream(stage(), { frames: reel(4), onFallback, ...display });
        const ctx = stream.canvas.getContext('2d');
        ctx.getImageData.mockImplementation(() => {
            throw new DOMException('The canvas has been tainted by cross-origin data.', 'SecurityError');
        });
        stream.resume();
        display.refresh();
        expect(onFallback).toHaveBeenCalledTimes(1);
        expect(onFallback).toHaveBeenCalledWith('error');
        expect(stream.canvas.style.display).toBe('none');
        expect(display.pending()).toBe(0);
    });

    it('stops when a summary cannot be made of what was read', () => {
        const display = fakeDisplay();
        const onFallback = vi.fn();
        const stream = mountImageStream(stage(), { frames: reel(4), onFallback, ...display });
        stream.canvas.getContext('2d').getImageData
            .mockImplementation(() => ({ width: 1, height: 1, data: new Uint8ClampedArray(4) }));
        stream.resume();
        display.refresh();
        expect(onFallback).toHaveBeenCalledWith('error');
    });

    it('stops when the display stalls and a frame is held far beyond its slot', () => {
        const display = fakeDisplay();
        const onFallback = vi.fn();
        const stream = mountImageStream(stage(), { frames: reel(40), onFallback, ...display });
        wirePixels(stream);
        stream.resume();
        display.run(300);
        display.refresh(600);
        expect(onFallback).toHaveBeenCalledWith('stall');
        expect(stream.canvas.style.display).toBe('none');
    });

    it('does not count a pause as a stall', () => {
        const display = fakeDisplay();
        const onFallback = vi.fn();
        const stream = mountImageStream(stage(), { frames: reel(40), onFallback, ...display });
        wirePixels(stream);
        stream.resume();
        display.run(300);
        stream.pause();
        display.jump(5000);
        stream.resume();
        display.run(300);
        expect(onFallback).not.toHaveBeenCalled();
        expect(stream.running).toBe(true);
    });

    it('stands down once the reading consent ends: cleared data, a visual error, the session closing', () => {
        const display = fakeDisplay();
        const onFallback = vi.fn();
        const stream = mountImageStream(stage(), { frames: reel(40), onFallback, ...display });
        wirePixels(stream);
        stream.resume();
        display.run(300);
        endVisualInterlocutionSession();
        display.refresh();
        expect(onFallback).toHaveBeenCalledTimes(1);
        expect(onFallback).toHaveBeenCalledWith('consent');
        expect(stream.canvas.style.display).toBe('none');
    });

    it('stands down when the session becomes one that never accepted the notice', () => {
        const display = fakeDisplay();
        const onFallback = vi.fn();
        const stream = mountImageStream(stage(), { frames: reel(40), onFallback, ...display });
        wirePixels(stream);
        stream.resume();
        display.run(300);
        beginNonFlashingVisualSession('gallery');
        display.refresh();
        expect(onFallback).toHaveBeenCalledWith('consent');
    });

    for (const mode of ['photosensitivity-mode', 'reduced-motion']) {
        it(`stays down after ${mode} is switched on and off again while paused`, async () => {
            const display = fakeDisplay();
            const onFallback = vi.fn();
            const stream = mountImageStream(stage(), { frames: reel(40), onFallback, ...display });
            const ctx = wirePixels(stream);
            stream.resume();
            display.run(1000);
            stream.pause();
            document.documentElement.classList.add(mode);
            await Promise.resolve();
            document.documentElement.classList.remove(mode);
            await Promise.resolve();
            const drawnBefore = ctx.drawImage.mock.calls.length;
            stream.resume();
            display.run(1000);
            expect(onFallback).toHaveBeenCalledWith('stand-down');
            expect(ctx.drawImage.mock.calls.length).toBe(drawnBefore);
            expect(stream.canvas.style.display).toBe('none');
        });

        it(`refuses to resume while ${mode} is on, before drawing anything`, () => {
            const display = fakeDisplay();
            const onFallback = vi.fn();
            const stream = mountImageStream(stage(), { frames: reel(40), onFallback, ...display });
            stream.resume();
            display.run(1000);
            stream.pause();
            // Synchronously: the class observer has not run yet, so this is the resume check.
            document.documentElement.classList.add(mode);
            stream.resume();
            expect(onFallback).toHaveBeenCalledWith('stand-down');
            expect(display.pending()).toBe(0);
        });
    }

    it('refuses to resume once the reading consent ended while paused', () => {
        const display = fakeDisplay();
        const onFallback = vi.fn();
        const stream = mountImageStream(stage(), { frames: reel(40), onFallback, ...display });
        stream.resume();
        display.run(300);
        stream.pause();
        endVisualInterlocutionSession();
        stream.resume();
        expect(onFallback).toHaveBeenCalledWith('consent');
        expect(display.pending()).toBe(0);
    });

    it('stands down mid-reading when photosensitivity mode is switched on', () => {
        const display = fakeDisplay();
        const onFallback = vi.fn();
        const stream = mountImageStream(stage(), { frames: reel(40), onFallback, ...display });
        wirePixels(stream);
        stream.resume();
        display.run(300);
        document.documentElement.classList.add('photosensitivity-mode');
        display.refresh();
        expect(onFallback).toHaveBeenCalledWith('stand-down');
        expect(stream.canvas.style.display).toBe('none');
    });
});

/**
 * Black, then black with its first `cells` pixels white, alternating: a flash
 * over a part of the aperture only.
 */
function patch(cells, count = 12) {
    return Array.from({ length: count }, (_, i) => {
        const image = frame(i, [0, 0, 0]);
        if (i % 2) for (let p = 0; p < cells; p++) image.rgba.fill(255, p * 4, p * 4 + 3);
        return image;
    });
}

/** Mount a 12 Hz reel, let `arrange` act on the mounted stream, run two seconds, and say why it stopped. */
function play(frames, arrange = () => {}) {
    const display = fakeDisplay();
    const onFallback = vi.fn();
    const stream = mountImageStream(stage(), { frames, hz: 12, onFallback, ...display });
    expect(stream, 'mounted').not.toBeNull();
    arrange(stream);
    stream.resume();
    display.run(2000);
    return onFallback.mock.calls[0]?.[0] ?? null;
}

describe('a flash over a small part of the aperture counts', () => {
    // At METER_FLOOR_AREA_PX (64 × the safe area) over 19,600 cells, a
    // transition counts once it covers more than 19,600 / 64 = 306.25 cells.
    it('counts a change over 307 of the 19,600 cells at the aperture\'s own size', () => {
        expect(play(patch(307))).toBe('meter');
    });

    it('does not count a change over 306 cells, so the threshold is the one stated', () => {
        expect(play(patch(306))).toBeNull();
    });

    it('still counts it at device pixel ratios of 3 and 5 and under pinch-zoom of 3 and 5', () => {
        for (const dpr of [3, 5]) {
            vi.stubGlobal('devicePixelRatio', dpr);
            expect(play(patch(307)), `dpr ${dpr}`).toBe('meter');
            vi.unstubAllGlobals();
        }
        for (const scale of [3, 5]) {
            expect(play(patch(307), () => vi.stubGlobal('visualViewport', { scale })), `pinch ${scale}`).toBe('meter');
            vi.unstubAllGlobals();
        }
    });

    it('judges by the magnified area once it is larger than the floor: dpr 10 counts 250 cells', () => {
        // 19,600 × 10² = 1,960,000 CSS px²: a change counts beyond 218 cells.
        expect(play(patch(250))).toBeNull();
        vi.stubGlobal('devicePixelRatio', 10);
        expect(play(patch(250))).toBe('meter');
        vi.unstubAllGlobals();
        expect(play(patch(250), () => vi.stubGlobal('visualViewport', { scale: 10 }))).toBe('meter');
    });
});

describe('frames that are not opaque', () => {
    it('are left out, so the Gallery never shows through a frame unmeasured', () => {
        const display = fakeDisplay();
        const frames = [frame(0), translucent(1), frame(2), translucent(3)];
        const stream = mountImageStream(stage(), { frames, hz: 12, ...display });
        stream.resume();
        display.run(2000);
        expect(drawn(stream).length).toBeGreaterThan(4);
        expect(drawn(stream).every(id => id === 0 || id === 2)).toBe(true);
    });

    it('leave nothing to mount when every frame is translucent', () => {
        expect(mountImageStream(stage(), { frames: [translucent(0), translucent(1)], ...fakeDisplay() })).toBeNull();
    });

    it('stop the stream if what is read back from the screen is not opaque', () => {
        const display = fakeDisplay();
        const onFallback = vi.fn();
        const stream = mountImageStream(stage(), { frames: reel(4), onFallback, ...display });
        stream.canvas.getContext('2d').getImageData
            .mockImplementation((x, y, width, height) => ({ width, height, data: translucent(9).rgba }));
        stream.resume();
        display.refresh();
        expect(onFallback).toHaveBeenCalledWith('transparent');
        expect(stream.canvas.style.display).toBe('none');
    });
});

describe('never mounting at all', () => {
    const refusals = {
        'photosensitivity mode': () => document.documentElement.classList.add('photosensitivity-mode'),
        'the reader\'s reduced-motion setting': () => document.documentElement.classList.add('reduced-motion'),
        'prefers-reduced-motion': () => vi.stubGlobal('matchMedia', query => ({
            matches: query === '(prefers-reduced-motion: reduce)'
        })),
        'a hidden document': () => Object.defineProperty(document, 'visibilityState', {
            configurable: true, value: 'hidden'
        }),
        'a media query that cannot be asked': () => vi.stubGlobal('matchMedia', () => { throw new Error('no'); }),
        'no accepted notice': () => endVisualInterlocutionSession(),
        'a Gallery session, which never accepted the notice': () => beginNonFlashingVisualSession('gallery')
    };

    for (const [condition, arrange] of Object.entries(refusals)) {
        it(`stands down under ${condition}`, () => {
            arrange();
            const host = stage();
            const display = fakeDisplay();
            expect(mountImageStream(host, { frames: reel(4), ...display })).toBeNull();
            expect(host.querySelector('canvas')).toBeNull();
            expect(display.pending()).toBe(0);
        });
    }

    it('stands down with nothing to show', () => {
        for (const frames of [[], null, undefined, 'frames']) {
            expect(mountImageStream(stage(), { frames, ...fakeDisplay() })).toBeNull();
        }
    });
});

describe('decoding the frames', () => {
    /** An Image that decodes, or refuses, by its URL. */
    /** Which URLs were decoded: the size is known at load, before decoding. */
    const decodedUrls = [];
    class FakeImage {
        constructor() { this.width = 0; this.height = 0; this.naturalWidth = 0; this.naturalHeight = 0; this._src = ''; }
        get src() { return this._src; }
        set src(url) {
            this._src = url;
            if (!url || url.includes('slow')) return;
            queueMicrotask(() => {
                const [width, height] = url.includes('huge') ? [4000, 3000]
                    : url.includes('eight') ? [4000, 2000] : [200, 100];
                this.width = this.naturalWidth = width;
                this.height = this.naturalHeight = height;
                this.onload?.();
            });
        }
        decode() {
            decodedUrls.push(this._src);
            if (this._src.includes('bad')) return Promise.reject(new Error('EncodingError'));
            return Promise.resolve();
        }
    }

    it('decodes each URL as a CORS image with no referrer, so its pixels can be measured', async () => {
        vi.stubGlobal('Image', FakeImage);
        const frames = await decodeStreamFrames(['https://a.test/1.jpg', 'https://a.test/2.jpg']);
        expect(frames.map(image => image.src)).toEqual(['https://a.test/1.jpg', 'https://a.test/2.jpg']);
        for (const image of frames) {
            expect(image.crossOrigin).toBe('anonymous');
            expect(image.referrerPolicy).toBe('no-referrer');
        }
    });

    it('leaves out what will not decode, and anything that is not a URL', async () => {
        vi.stubGlobal('Image', FakeImage);
        const frames = await decodeStreamFrames(['https://a.test/bad.jpg', null, 7, '', 'https://a.test/ok.jpg']);
        expect(frames.map(image => image.src)).toEqual(['https://a.test/ok.jpg']);
    });

    it('takes a small pool, not the whole collection', async () => {
        vi.stubGlobal('Image', FakeImage);
        const urls = Array.from({ length: 100 }, (_, i) => `https://a.test/${i}.jpg`);
        expect(await decodeStreamFrames(urls)).toHaveLength(24);
        expect(await decodeStreamFrames(urls, { limit: 3 })).toHaveLength(3);
        expect(await decodeStreamFrames(urls, { limit: 100 })).toHaveLength(24);
    });

    it('gives up on an image that has not decoded in five seconds', async () => {
        vi.useFakeTimers();
        try {
            vi.stubGlobal('Image', FakeImage);
            let frames = null;
            void decodeStreamFrames(['https://a.test/slow.jpg', 'https://a.test/ok.jpg']).then(result => { frames = result; });
            await vi.advanceTimersByTimeAsync(4999);
            expect(frames).toBeNull();
            await vi.advanceTimersByTimeAsync(1);
            expect(frames.map(image => image.src)).toEqual(['https://a.test/ok.jpg']);
        } finally {
            vi.useRealTimers();
        }
    });

    it('leaves out an image of more than eight megapixels, without decoding it', async () => {
        vi.stubGlobal('Image', FakeImage);
        decodedUrls.length = 0;
        const frames = await decodeStreamFrames(['https://a.test/huge.jpg', 'https://a.test/eight.jpg']);
        expect(frames.map(image => image.src)).toEqual(['https://a.test/eight.jpg']);
        expect(decodedUrls).toEqual(['https://a.test/eight.jpg']);
    });

    it('decodes nothing from nothing', async () => {
        expect(await decodeStreamFrames(undefined)).toEqual([]);
    });
});
