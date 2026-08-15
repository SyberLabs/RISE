/**
 * Parametric plate-draw adapter — order fields and time stencils,
 * without re-running Ostensoria or Apparitio.
 */
import { describe, expect, it, vi } from 'vitest';
import {
    APPARITIO_VOID_RGB,
    buildPlateOrder,
    buildPlateOrderFromRgb,
    revealPlate
} from './plate-draw.js';

describe('plate-draw adapter', () => {
    it('ranks dense cores above faint wash, and the centre above the rim', () => {
        const field = new Float32Array(9);
        field[4] = 80;
        field[0] = 80;
        const order = buildPlateOrder(field, 3, 3, 'radial');
        expect(order[4]).toBeGreaterThan(order[0]);
    });

    it('unfurls Spectral Plates from the mirror axis', () => {
        const n = 5 * 3;
        const accR = new Float32Array(n);
        const accG = new Float32Array(n);
        const accB = new Float32Array(n);
        const shR = new Float32Array(n);
        const shG = new Float32Array(n);
        const shB = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            accR[i] = 1;
            accG[i] = 1;
            accB[i] = 1;
        }
        const order = buildPlateOrderFromRgb(accR, accG, accB, shR, shG, shB, 5, 3, 'axis');
        const spine = order[2];
        const wing = order[0];
        expect(spine).toBeGreaterThan(wing);
    });

    it('progress 0 is empty ground; progress 1 is the finished plate', () => {
        const drawImage = vi.fn();
        const fillRect = vi.fn();
        const canvas = {
            width: 8,
            height: 8,
            getContext: () => ({
                fillStyle: '',
                fillRect,
                drawImage,
                createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
                putImageData: vi.fn()
            })
        };
        const plate = { width: 2, height: 2 };
        expect(revealPlate(canvas, {
            plate,
            progress: 0,
            paperRgb: APPARITIO_VOID_RGB
        })).toBe(true);
        expect(fillRect).toHaveBeenCalled();
        expect(drawImage).not.toHaveBeenCalled();

        fillRect.mockClear();
        expect(revealPlate(canvas, { plate, progress: 1 })).toBe(true);
        expect(drawImage).toHaveBeenCalledWith(plate, expect.any(Number), expect.any(Number),
            expect.any(Number), expect.any(Number));
    });
});
