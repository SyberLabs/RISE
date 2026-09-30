import { describe, expect, it } from 'vitest';
import { placeEmotion, swatchWarmth, thomasFilament } from './emotion-map.js';

describe('RISE EMOTIONS map', () => {
    it('places valence and arousal in the plane and paints hue from warmth', () => {
        const warm = placeEmotion({ valence: 1, arousal: 1, warmth: 1 });
        const cool = placeEmotion({ valence: 1, arousal: 1, warmth: -1 });
        expect(warm.mode).toBe('plane');
        expect(warm.x).toBeCloseTo(0.62);
        expect(warm.y).toBeCloseTo(0.62);
        expect(warm.hue).toBeCloseTo(40);
        expect(cool.hue).toBeCloseTo(220);
        expect(cool.x).toBeCloseTo(warm.x);
    });

    it('holds the middle of each axis and refuses to invent a missing one', () => {
        const mid = placeEmotion({ valence: 0, arousal: 0.5, warmth: 0 });
        expect(mid.x).toBeCloseTo(0);
        expect(mid.y).toBeCloseTo(0);
        expect(mid.hue).toBeCloseTo(130);
        expect(placeEmotion({ valence: 1, arousal: 0.2, warmth: null }).hue).toBeNull();
        expect(placeEmotion({ valence: null, arousal: null, warmth: null })).toBeNull();
        expect(placeEmotion({ valence: 1, arousal: null, warmth: null })).toBeNull();
    });

    it('sets a warmth-only color on the spectral ring', () => {
        const ring = placeEmotion({ valence: null, arousal: null, warmth: 1 });
        expect(ring.mode).toBe('ring');
        expect(ring.valence).toBeNull();
        expect(Math.hypot(ring.x, ring.y)).toBeCloseTo(1);
        const stirred = placeEmotion({ valence: null, arousal: 1, warmth: 1 });
        const still = placeEmotion({ valence: null, arousal: 0, warmth: 1 });
        expect(Math.hypot(stirred.x, stirred.y)).toBeGreaterThan(Math.hypot(still.x, still.y));
    });

    it('reads warmth from a swatch and leaves an unsaturated one unplaced', () => {
        expect(swatchWarmth('#ffc4aa')).toBeGreaterThan(0.4);
        expect(swatchWarmth('#c6e2ff')).toBeLessThan(0);
        expect(swatchWarmth('#ffffff')).toBeNull();
        expect(swatchWarmth('nope')).toBeNull();
    });

    it('draws one deterministic spectral filament', () => {
        const filament = thomasFilament();
        expect(filament.length).toBeGreaterThan(200);
        expect(filament[0].hue).toBe(0);
        expect(filament.at(-1).hue).toBeGreaterThan(300);
        expect(thomasFilament()).toEqual(filament);
        for (const point of filament) {
            expect(Number.isFinite(point.x)).toBe(true);
            expect(Math.abs(point.x)).toBeLessThanOrEqual(1);
            expect(Math.abs(point.y)).toBeLessThanOrEqual(1);
        }
    });
});
