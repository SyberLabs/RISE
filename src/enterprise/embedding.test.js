// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { calibrate, cosine, meanPool } from './embedding.js';

describe('sentence vectors', () => {
    it('averages only the tokens the mask keeps, then normalizes', () => {
        // Two dims, three tokens; the last token is padding.
        const hidden = new Float32Array([1, 0, 3, 4, 100, 100]);
        const vector = meanPool(hidden, [1, 1, 0], 2);
        expect(vector[0]).toBeCloseTo(2 / Math.hypot(2, 2), 6);
        expect(vector[1]).toBeCloseTo(2 / Math.hypot(2, 2), 6);
        expect(Math.hypot(...vector)).toBeCloseTo(1, 6);
    });

    it('measures unit vectors by their dot product', () => {
        expect(cosine(new Float32Array([1, 0]), new Float32Array([0, 1]))).toBe(0);
        expect(cosine(new Float32Array([0.6, 0.8]), new Float32Array([0.6, 0.8]))).toBeCloseTo(1, 6);
    });

    it('maps cosine onto the rail scale, clamped', () => {
        const scale = { floor: 0.4, ceiling: 0.8 };
        expect(calibrate(0.4, scale)).toBe(0);
        expect(calibrate(0.6, scale)).toBeCloseTo(0.5, 6);
        expect(calibrate(0.95, scale)).toBe(1);
        expect(calibrate(0.1, scale)).toBe(0);
    });
});
