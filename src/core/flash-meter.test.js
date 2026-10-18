import { describe, expect, it } from 'vitest';
import {
    FLASH_SAFE_AREA_PX,
    FlashMeter,
    STREAM_MAX_FLASHES_PER_WINDOW,
    apertureIsInherentlySafe,
    certifySequence
} from './flash-meter.js';
import { relativeLuminance, summarizeFrame } from './luminance.js';

/** A small solid frame of one sRGB colour. */
function solid(r, g, b, { width = 8, height = 8 } = {}) {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < rgba.length; i += 4) {
        rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
    return summarizeFrame(rgba, width, height);
}

/** A frame whose cells are grey levels, one per cell (sRGB 0..255). */
function cells(levels) {
    const side = Math.sqrt(levels.length);
    const rgba = new Uint8ClampedArray(levels.length * 4);
    levels.forEach((v, i) => {
        rgba[i * 4] = v; rgba[i * 4 + 1] = v; rgba[i * 4 + 2] = v; rgba[i * 4 + 3] = 255;
    });
    return summarizeFrame(rgba, side, side, { cols: side, rows: side });
}

const BLACK = solid(0, 0, 0);
const WHITE = solid(255, 255, 255);
const WIDE = 800 * 600;        // well above the safe area
const SMALL = FLASH_SAFE_AREA_PX; // exactly at it: cannot count

function alternate(a, b, frames) {
    return Array.from({ length: frames }, (_, i) => (i % 2 ? b : a));
}

describe('the aperture', () => {
    it('is inherently safe at or below the WCAG area threshold', () => {
        expect(FLASH_SAFE_AREA_PX).toBe(21_824);
        expect(apertureIsInherentlySafe(147, 147)).toBe(true);
        expect(apertureIsInherentlySafe(341, 64)).toBe(true);
        expect(apertureIsInherentlySafe(150, 150)).toBe(false);
        expect(apertureIsInherentlySafe(Number.NaN, 10)).toBe(false);
    });

    it('lets a black/white strobe at 12 Hz through when it is that small', () => {
        const report = certifySequence(alternate(BLACK, WHITE, 24), {
            frameMs: 1000 / 12, areaPx: SMALL
        });
        expect(report.ok).toBe(true);
        expect(report.worst.general).toBe(0);
    });
});

describe('general flashes in a wide field', () => {
    it('refuses the same strobe at full size', () => {
        const report = certifySequence(alternate(BLACK, WHITE, 24), {
            frameMs: 1000 / 12, areaPx: WIDE
        });
        expect(report.ok).toBe(false);
        expect(report.worst.general).toBeGreaterThanOrEqual(5);
        expect(report.firstViolationMs).not.toBeNull();
    });

    it('counts one retired Rhythmic flash (dark, image, dark) as one flash', () => {
        const meter = new FlashMeter({ areaPx: WIDE });
        meter.observe(BLACK, 0);
        meter.observe(WHITE, 100);
        const after = meter.observe(BLACK, 300);
        expect(after.flashes.general).toBe(1);
        expect(after.ok).toBe(true);
    });

    it('holds RISE to two flashes a second, one inside WCAG\'s three', () => {
        // 3 Hz alternation: six transitions, three flashes, in every second.
        const frames = alternate(BLACK, WHITE, 12);
        const ours = certifySequence(frames, { frameMs: 1000 / 6, areaPx: WIDE });
        const wcag = certifySequence(frames, { frameMs: 1000 / 6, areaPx: WIDE, maxFlashes: 3 });
        expect(STREAM_MAX_FLASHES_PER_WINDOW).toBe(2);
        expect(ours.worst.general).toBe(3);
        expect(ours.ok).toBe(false);
        expect(wcag.ok).toBe(true);
    });

    it('passes a fast stream of different images held in one luminance band', () => {
        // Sixteen cells, each wandering within ±4 sRGB levels of mid grey:
        // different pictures, the same light.
        let seed = 7;
        const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        const frames = Array.from({ length: 30 }, () => cells(
            Array.from({ length: 16 }, () => 118 + Math.round(rand() * 8))
        ));
        const report = certifySequence(frames, { frameMs: 1000 / 12, areaPx: WIDE });
        expect(report.ok).toBe(true);
        expect(report.worst.general).toBe(0);
    });

    it('refuses a checkerboard that inverts at 12 Hz, though every coarse average stays grey', () => {
        // One-pixel squares: any cell of two or more pixels averages to the
        // same grey in both frames, while every pixel swings black to white.
        const board = (phase) => {
            const rgba = new Uint8ClampedArray(48 * 48 * 4);
            for (let y = 0; y < 48; y++) {
                for (let x = 0; x < 48; x++) {
                    const v = (x + y + phase) % 2 ? 255 : 0;
                    const i = (y * 48 + x) * 4;
                    rgba[i] = v; rgba[i + 1] = v; rgba[i + 2] = v; rgba[i + 3] = 255;
                }
            }
            return summarizeFrame(rgba, 48, 48);
        };
        const report = certifySequence(alternate(board(0), board(1), 24), {
            frameMs: 1000 / 12, areaPx: WIDE
        });
        expect(report.ok).toBe(false);
        expect(report.worst.general).toBeGreaterThanOrEqual(5);
    });

    it('treats a slow dissolve as one transition, not many small ones', () => {
        const ramp = Array.from({ length: 30 }, (_, i) => solid(
            Math.round(255 * i / 29), Math.round(255 * i / 29), Math.round(255 * i / 29)
        ));
        const meter = new FlashMeter({ areaPx: WIDE });
        let events = 0;
        ramp.forEach((frame, i) => { if (meter.observe(frame, i * 16).transition.general) events++; });
        expect(events).toBe(1);
    });

    it('ignores swings that never go below the darker ceiling', () => {
        // Both states above 0.80 relative luminance: not a flash by definition.
        const bright = solid(255, 255, 255);
        const lessBright = solid(235, 235, 235);
        expect(relativeLuminance(235, 235, 235)).toBeGreaterThan(0.8);
        const report = certifySequence(alternate(bright, lessBright, 24), {
            frameMs: 1000 / 12, areaPx: WIDE
        });
        expect(report.worst.general).toBe(0);
    });

    it('checks the wrap from the last frame back to the first', () => {
        // Three dark frames then one bright: inside the reel there is one
        // transition, but looping makes it a flash every 4 frames.
        const reel = [BLACK, BLACK, BLACK, WHITE];
        const report = certifySequence(reel, { frameMs: 1000 / 12, areaPx: WIDE });
        expect(report.worst.general).toBe(3);
        expect(report.ok).toBe(false);
    });

    it('plays a short reel long enough to fill a whole window', () => {
        // Two frames at 12 Hz: two loops last a third of a second and hold
        // one flash, but the steady stream holds six in every second.
        const report = certifySequence([BLACK, WHITE], { frameMs: 1000 / 12, areaPx: WIDE });
        expect(report.worst.general).toBe(6);
    });
});

describe('red flashes', () => {
    it('catches saturated red against grey of the same luminance', () => {
        const red = solid(255, 0, 0);
        const grey = solid(127, 127, 127);
        const report = certifySequence(alternate(red, grey, 24), {
            frameMs: 1000 / 8, areaPx: WIDE
        });
        expect(report.worst.general).toBe(0);
        expect(report.worst.red).toBeGreaterThan(STREAM_MAX_FLASHES_PER_WINDOW);
        expect(report.ok).toBe(false);
    });
});

describe('the meter\'s contract', () => {
    it('refuses frames summarised on a different grid', () => {
        const meter = new FlashMeter({ areaPx: WIDE });
        meter.observe(BLACK, 0);
        expect(() => meter.observe(cells(new Array(9).fill(0)), 16)).toThrow(/grid/u);
    });

    it('refuses a summary coarser than one cell per pixel', () => {
        const rgba = new Uint8ClampedArray(8 * 8 * 4);
        const coarse = summarizeFrame(rgba, 8, 8, { cols: 4, rows: 4 });
        expect(() => new FlashMeter({ areaPx: WIDE }).observe(coarse, 0)).toThrow(/one cell per pixel/u);
    });

    it('forgets transitions older than the window', () => {
        const meter = new FlashMeter({ areaPx: WIDE });
        [BLACK, WHITE, BLACK, WHITE, BLACK, WHITE].forEach((f, i) => meter.observe(f, i * 100));
        expect(meter.observe(BLACK, 600).ok).toBe(false);
        expect(meter.observe(BLACK, 2000).flashes.general).toBe(0);
    });

    it('starts clean after reset', () => {
        const meter = new FlashMeter({ areaPx: WIDE });
        alternate(BLACK, WHITE, 8).forEach((f, i) => meter.observe(f, i * 50));
        meter.reset();
        expect(meter.observe(WHITE, 1000)).toMatchObject({ ok: true, flashes: { general: 0, red: 0 } });
    });

    it('has nothing to certify in an empty reel', () => {
        expect(certifySequence([], { frameMs: 100, areaPx: WIDE }).ok).toBe(true);
    });
});
