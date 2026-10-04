/**
 * How big the flame is drawn and how many samples it gets: the device's
 * pixels (up to twice the CSS pixels), within a pixel budget, at a fixed
 * number of samples per pixel.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FractalFlame, MAX_FLAME_PIXELS, flameCanvasSize, flameIterations } from './fractal.js';

describe('flameCanvasSize', () => {
    it('draws at the device resolution, up to twice the CSS pixels', () => {
        expect(flameCanvasSize(1280, 800, 1)).toEqual({ width: 1280, height: 800 });
        expect(flameCanvasSize(390, 844, 2)).toEqual({ width: 780, height: 1688 });
        expect(flameCanvasSize(390, 844, 3)).toEqual({ width: 780, height: 1688 });
    });

    it('stays within the pixel budget and keeps the screen\'s proportions', () => {
        const { width, height } = flameCanvasSize(1280, 800, 2);
        expect(width * height).toBeLessThanOrEqual(MAX_FLAME_PIXELS);
        expect(width).toBeGreaterThan(1280);
        expect(width / height).toBeCloseTo(1280 / 800, 2);
    });

    it('treats a missing ratio as 1', () => {
        expect(flameCanvasSize(800, 600, undefined)).toEqual({ width: 800, height: 600 });
    });
});

describe('flameIterations', () => {
    it('gives every pixel the same share of samples', () => {
        expect(flameIterations(1600, 2000)).toBe(2 * flameIterations(1600, 1000));
        expect(flameIterations(1920, 1200)).toBe(4_608_000);
    });

    it('never drops below the two million samples a flame always had', () => {
        expect(flameIterations(390, 844)).toBe(2_000_000);
    });
});

describe('FractalFlame', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('sizes its canvas for the device and asks for smoothed, scaled samples', async () => {
        vi.stubGlobal('innerWidth', 390);
        vi.stubGlobal('innerHeight', 844);
        vi.stubGlobal('devicePixelRatio', 3);
        const canvas = document.createElement('canvas');
        const flame = new FractalFlame(canvas);
        expect([canvas.width, canvas.height]).toEqual([780, 1688]);

        const generateImage = vi.spyOn(flame.generator, 'generateImage').mockResolvedValue({});
        await flame.generateToQueue();
        expect(generateImage).toHaveBeenCalledWith(expect.objectContaining({
            width: 780, height: 1688, iterations: flameIterations(780, 1688), smooth: true
        }));
        flame.destroy();
    });

    it('uses at most four workers, each of which holds a whole histogram', () => {
        const flame = new FractalFlame(document.createElement('canvas'));
        expect(flame.generator.maxWorkers).toBeLessThanOrEqual(4);
        flame.destroy();
    });
});
