/**
 * Neural engine: a palette key names the palette; none keeps the random pick.
 */
import { describe, expect, it, vi } from 'vitest';
import { NeuralNetwork } from './neural.js';
import { JEV_COLOR_THEMES } from '../core/jev-color-themes.js';
import { themeEngine } from '../core/theme-engine-map.js';

function makeCanvas(width = 800, height = 600) {
    const gradient = { addColorStop: vi.fn() };
    // Every drawing call is a no-op; the one call whose result is used returns a gradient.
    const ctx = new Proxy({}, {
        get: (target, key) => (key in target ? target[key] : () => gradient)
    });
    return { width, height, getContext: () => ctx };
}

describe('NeuralNetwork palette key', () => {
    it.each(JEV_COLOR_THEMES)('%s: generate(key) draws the mapped palette', theme => {
        const neural = new NeuralNetwork(makeCanvas());
        const key = themeEngine(theme, 'neural');

        for (let i = 0; i < 10; i++) {
            expect(neural.generate(key)).toBe(true);
            expect(neural.currentPalette).toBe(neural.palettes[key]);
        }
    });

    it('without a key the palette still varies', () => {
        const neural = new NeuralNetwork(makeCanvas());
        const seen = new Set();
        for (let i = 0; i < 60; i++) {
            neural.generate();
            seen.add(neural.currentPalette);
        }
        expect(seen.size).toBeGreaterThanOrEqual(3);
    });
});
