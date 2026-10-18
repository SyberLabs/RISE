import { describe, expect, it } from 'vitest';
import { relativeLuminance, saturatedRedValue, summarizeFrame } from './luminance.js';

describe('relative luminance', () => {
    it('follows the WCAG definition at its anchors', () => {
        expect(relativeLuminance(0, 0, 0)).toBe(0);
        expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 10);
        expect(relativeLuminance(128, 128, 128)).toBeCloseTo(0.2159, 4);
        expect(relativeLuminance(255, 0, 0)).toBeCloseTo(0.2126, 4);
        expect(relativeLuminance(0, 255, 0)).toBeCloseTo(0.7152, 4);
    });
});

describe('saturated red', () => {
    it('scores only reds that are at least 80% of the light', () => {
        expect(saturatedRedValue(1, 0, 0)).toBe(320);
        expect(saturatedRedValue(0.5, 0.5, 0.5)).toBe(0);
        // R / (R+G+B) = 0.75: strongly red, not saturated by the definition.
        expect(saturatedRedValue(0.75, 0.25, 0)).toBe(0);
        expect(saturatedRedValue(0, 0, 0)).toBe(0);
    });
});

describe('frame summaries', () => {
    function frame(width, height, fill) {
        const rgba = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const [r, g, b, a] = fill(x, y);
                rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
            }
        }
        return rgba;
    }

    it('averages each cell in linear light, not in sRGB', () => {
        // Half black, half white: the mean light is 0.5, though the mean
        // sRGB code (127.5) would claim about 0.21.
        const rgba = frame(2, 1, x => (x ? [255, 255, 255, 255] : [0, 0, 0, 255]));
        const summary = summarizeFrame(rgba, 2, 1, { cols: 1, rows: 1 });
        expect(summary.luminance[0]).toBeCloseTo(0.5, 6);
    });

    it('lays the grid over the frame row by row', () => {
        const rgba = frame(4, 4, (x, y) => (y < 2 && x >= 2 ? [255, 255, 255, 255] : [0, 0, 0, 255]));
        const summary = summarizeFrame(rgba, 4, 4, { cols: 2, rows: 2 });
        expect(summary.cols).toBe(2);
        expect(summary.rows).toBe(2);
        expect(Array.from(summary.luminance).map(v => Math.round(v))).toEqual([0, 1, 0, 0]);
    });

    it('composites transparency over the given ground', () => {
        const rgba = frame(1, 1, () => [255, 255, 255, 0]);
        expect(summarizeFrame(rgba, 1, 1, { cols: 1, rows: 1 }).luminance[0]).toBe(0);
        expect(summarizeFrame(rgba, 1, 1, { cols: 1, rows: 1, ground: [255, 255, 255] })
            .luminance[0]).toBeCloseTo(1, 6);
    });

    it('never gives a cell more cells than pixels', () => {
        const rgba = frame(3, 2, () => [255, 0, 0, 255]);
        const summary = summarizeFrame(rgba, 3, 2);
        expect(summary.cols).toBe(3);
        expect(summary.rows).toBe(2);
        expect(summary.red[0]).toBe(320);
    });

    it('refuses a buffer that does not match its dimensions', () => {
        expect(() => summarizeFrame(new Uint8ClampedArray(12), 2, 2)).toThrow(/dimensions/u);
    });
});
