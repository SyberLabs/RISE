/**
 * The flame's sampling and tone stage: the worker's random source, the
 * density-aware smoothing, and the worker's tone step, which must paint the
 * same pixels the engine's own (single-threaded) tone map paints.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { FractalFlameGenerator, smoothHistograms } from './fractal-engine.js';

const WORKER_SOURCE = readFileSync(resolve('public/fractal-flame-worker.js'), 'utf8');

/** Run one message through a fresh copy of the worker script; return its reply. */
function workerReply(message) {
    let reply;
    const context = { self: { postMessage: data => { reply = data; } }, Math, Float32Array, Float64Array, Uint8ClampedArray };
    vm.createContext(context);
    vm.runInContext(WORKER_SOURCE, context);
    context.self.onmessage({ data: message });
    return reply;
}

const square = (width, height, fill) => ({
    density: new Float64Array(width * height).fill(fill),
    colorR: new Float64Array(width * height),
    colorG: new Float64Array(width * height),
    colorB: new Float64Array(width * height)
});

const sum = array => array.reduce((total, value) => total + value, 0);

describe('the worker samples the whole attractor', () => {
    it('is not held to a short random cycle', () => {
        // Four half-size copies of the square tile it exactly, so the
        // attractor fills every pixel. A million samples should land on
        // about 1 - 1/e of a million pixels; a generator that repeats every
        // 233,280 draws can reach at most that many.
        const quarter = (c, f) => ({ affine: [0.5, 0, c, 0, 0.5, f], variations: { linear: 1 }, color: 0.5, weight: 1 });
        const reply = workerReply({
            type: 'render',
            transforms: [quarter(-0.5, -0.5), quarter(0.5, -0.5), quarter(-0.5, 0.5), quarter(0.5, 0.5)],
            finalTransform: null,
            palette: Array.from({ length: 256 }, () => [255, 255, 255]),
            camera: { centerX: 0, centerY: 0, zoom: 1, rotation: 0 },
            width: 1024,
            height: 1024,
            iterations: 1_000_000,
            skipIterations: 20,
            workerId: 0,
            seed: 12345
        });
        expect(reply.type).toBe('complete');
        const density = new Float32Array(reply.density);
        const hit = density.reduce((count, value) => count + (value > 0 ? 1 : 0), 0);
        expect(hit).toBeGreaterThan(550_000);
    });
});

describe('smoothHistograms', () => {
    it('keeps every sample away from the edge: total density and color are unchanged', () => {
        const width = 40, height = 30;
        const h = square(width, height, 0);
        for (let i = 0; i < h.density.length; i += 7) {
            const x = i % width, y = Math.floor(i / width);
            if (x < 8 || y < 8 || x >= width - 8 || y >= height - 8) continue;
            h.density[i] = (i % 5) + 1;
            h.colorR[i] = h.density[i] * 200;
            h.colorG[i] = h.density[i] * 40;
            h.colorB[i] = h.density[i] * 255;
        }
        const before = [h.density, h.colorR, h.colorG, h.colorB].map(sum);
        smoothHistograms(h.density, h.colorR, h.colorG, h.colorB, width, height);
        const after = [h.density, h.colorR, h.colorG, h.colorB].map(sum);
        after.forEach((total, i) => expect(total).toBeCloseTo(before[i], 6));
    });

    it('spreads a lone sample into a soft spot and leaves a dense one in place', () => {
        const width = 31, height = 31, centre = 15 * width + 15;
        const lone = square(width, height, 0);
        lone.density[centre] = 1;
        smoothHistograms(lone.density, lone.colorR, lone.colorG, lone.colorB, width, height);
        expect(lone.density[centre]).toBeLessThan(0.3);
        expect(lone.density[centre + 1]).toBeGreaterThan(0);
        expect(lone.density[centre + 2 * width]).toBeGreaterThan(0);

        const dense = square(width, height, 0);
        dense.density[centre] = 1000;
        smoothHistograms(dense.density, dense.colorR, dense.colorG, dense.colorB, width, height);
        expect(dense.density[centre]).toBeGreaterThan(990);
    });

    it('does not darken the frame edge of an even field', () => {
        const width = 20, height = 12;
        const h = square(width, height, 2);
        smoothHistograms(h.density, h.colorR, h.colorG, h.colorB, width, height);
        for (const value of h.density) expect(value).toBeCloseTo(2, 9);
    });

    it('leaves empty sky exactly empty, so it paints the background', () => {
        const width = 64, height = 64;
        const h = square(width, height, 0);
        h.density[5 * width + 5] = 3;
        h.colorR[5 * width + 5] = 600;
        smoothHistograms(h.density, h.colorR, h.colorG, h.colorB, width, height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (x > 10 || y > 10) expect(h.density[y * width + x]).toBe(0);
            }
        }
    });
});

describe('the worker tone step', () => {
    it('paints the same pixels as the engine, from the summed worker histograms', () => {
        const width = 48, height = 32, n = width * height;
        let seed = 9;
        const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
        const parts = [0, 1, 2].map(() => {
            const part = { density: new Float32Array(n), colorR: new Float32Array(n), colorG: new Float32Array(n), colorB: new Float32Array(n) };
            for (let i = 0; i < n; i++) {
                if (random() < 0.4) continue;
                const hits = Math.floor(random() * 40);
                part.density[i] = hits;
                part.colorR[i] = hits * Math.floor(random() * 256);
                part.colorG[i] = hits * Math.floor(random() * 256);
                part.colorB[i] = hits * Math.floor(random() * 256);
            }
            return part;
        });

        vi.stubGlobal('ImageData', class {
            constructor(width, height) { this.width = width; this.height = height; this.data = new Uint8ClampedArray(width * height * 4); }
        });
        const generator = new FractalFlameGenerator();
        generator.backgroundColor = [10, 10, 12];
        const merged = square(width, height, 0);
        for (const part of parts) {
            for (const key of Object.keys(merged)) {
                for (let i = 0; i < n; i++) merged[key][i] += part[key][i];
            }
        }
        smoothHistograms(merged.density, merged.colorR, merged.colorG, merged.colorB, width, height);
        const expected = generator._renderFlame(merged.density, merged.colorR, merged.colorG, merged.colorB,
            width, height, width, height, 2.2, 15, 1.2, 1);

        const reply = workerReply({
            type: 'tone',
            parts: parts.map(part => ({
                density: part.density.buffer, colorR: part.colorR.buffer,
                colorG: part.colorG.buffer, colorB: part.colorB.buffer
            })),
            width, height, finalWidth: width, finalHeight: height,
            gamma: 2.2, brightness: 15, vibrancy: 1.2, oversample: 1,
            backgroundColor: [10, 10, 12],
            smooth: true
        });
        expect(reply.type).toBe('toned');
        expect(Array.from(new Uint8ClampedArray(reply.pixels))).toEqual(Array.from(expected.data));
        vi.unstubAllGlobals();
    });
});
