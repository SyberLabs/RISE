/**
 * Word-fill flame adapter — brightness/density profile above color plates.
 *
 * The classic room Fractal Flames engine is not under test here. This
 * bounds the generateImage knobs that port already exposes (brightness,
 * gamma, vibrancy) and applies them as a session-locked 1D LUT so a
 * glyph reads as filled flame, not sparse black over cream.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { planFlame } from '../core/conductor.js';
import {
    ROOM_FLAME_TONE,
    FLAME_VOID,
    boundFlameFillTone,
    applyFlameFillLut,
    applyFlameFillToCanvas,
    prefersFlameFillReducedMotion
} from './flame-fill-adapter.js';

function makeImage(width, height) {
    return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

function occupancy(imageData, threshold = 40) {
    const px = imageData.data;
    let n = 0;
    for (let i = 0; i < px.length; i += 4) {
        if (px[i] > threshold || px[i + 1] > threshold || px[i + 2] > threshold) n += 1;
    }
    return n;
}

function paintSparseFlame(width = 8, height = 8) {
    const image = makeImage(width, height);
    const px = image.data;
    for (let i = 0; i < px.length; i += 4) {
        px[i] = FLAME_VOID[0];
        px[i + 1] = FLAME_VOID[1];
        px[i + 2] = FLAME_VOID[2];
        px[i + 3] = 255;
    }
    // Dim filaments: present, but they read as holes against cream.
    const filaments = [3, 11, 19, 27, 28, 35, 36, 43];
    for (const i of filaments) {
        const o = i * 4;
        px[o] = 28;
        px[o + 1] = 12;
        px[o + 2] = 8;
    }
    // A few brighter cores so uniqueness has a signature.
    for (const i of [20, 21, 29]) {
        const o = i * 4;
        px[o] = 96;
        px[o + 1] = 42;
        px[o + 2] = 18;
    }
    return image;
}

function cloneImage(image) {
    const copy = makeImage(image.width, image.height);
    copy.data.set(image.data);
    return copy;
}

describe('boundFlameFillTone', () => {
    it('bounds only the generateImage knobs the Chamber flame port already exposes', () => {
        const tone = boundFlameFillTone(ROOM_FLAME_TONE);
        expect(Object.keys(tone).sort()).toEqual(['brightness', 'gamma', 'vibrancy']);
        expect(tone).not.toHaveProperty('contrast');
        expect(tone).not.toHaveProperty('iterations');
        expect(tone).not.toHaveProperty('zoom');
        expect(tone).not.toHaveProperty('scale');
    });

    it('raises brightness and punch so fill occupancy can climb above the room still', () => {
        const room = ROOM_FLAME_TONE;
        const fill = boundFlameFillTone(room);
        expect(fill.brightness).toBeGreaterThan(room.brightness);
        expect(fill.gamma).toBeLessThan(room.gamma);
        expect(fill.vibrancy).toBeGreaterThanOrEqual(room.vibrancy);
    });

    it('lifts a semantic plan without mutating it or inventing a second IFS', () => {
        const plan = planFlame({ valence: 0.3, arousal: 0.6 }, () => 0.4);
        const before = { ...plan.tone };
        const fill = boundFlameFillTone(plan.tone);
        expect(plan.tone).toEqual(before);
        expect(fill.brightness).toBeGreaterThan(plan.tone.brightness);
        expect(fill.gamma).toBeLessThan(plan.tone.gamma);
    });

    it('is milder under prefers-reduced-motion and still session-locked (no auto-exposure)', () => {
        const live = boundFlameFillTone(ROOM_FLAME_TONE, { reducedMotion: false });
        const still = boundFlameFillTone(ROOM_FLAME_TONE, { reducedMotion: true });
        expect(still.brightness).toBeGreaterThan(ROOM_FLAME_TONE.brightness);
        expect(still.brightness).toBeLessThan(live.brightness);
        expect(boundFlameFillTone(ROOM_FLAME_TONE, { reducedMotion: true }))
            .toEqual(still);
    });
});

describe('applyFlameFillLut', () => {
    it('raises filament occupancy so letters read as filled flame, not cream', () => {
        const source = paintSparseFlame();
        const before = occupancy(source);
        const filled = applyFlameFillLut(source);
        expect(occupancy(filled)).toBeGreaterThan(before);
        expect(occupancy(filled)).toBeGreaterThan(source.width);
    });

    it('leaves the void plate-holes alone so cream stays ground, not a baked PNG', () => {
        const source = paintSparseFlame();
        const filled = applyFlameFillLut(source);
        const px = filled.data;
        // Corner pixels were void and must stay void.
        expect([px[0], px[1], px[2]]).toEqual([...FLAME_VOID]);
        const last = (source.width * source.height - 1) * 4;
        expect([px[last], px[last + 1], px[last + 2]]).toEqual([...FLAME_VOID]);
    });

    it('keeps generative uniqueness: different stills stay different after the same LUT', () => {
        const a = paintSparseFlame();
        const b = paintSparseFlame();
        b.data[20 * 4] = 140;
        b.data[20 * 4 + 1] = 70;
        const fa = applyFlameFillLut(a);
        const fb = applyFlameFillLut(b);
        expect(fa.data.slice(20 * 4, 20 * 4 + 3))
            .not.toEqual(fb.data.slice(20 * 4, 20 * 4 + 3));
    });

    it('is a session-locked 1D curve, not hist-eq or per-frame auto-exposure', () => {
        const dark = paintSparseFlame();
        const bright = paintSparseFlame();
        for (let i = 0; i < bright.data.length; i += 4) {
            if (bright.data[i] > FLAME_VOID[0]) {
                bright.data[i] = Math.min(255, bright.data[i] + 80);
                bright.data[i + 1] = Math.min(255, bright.data[i + 1] + 40);
            }
        }
        const probe = 11 * 4;
        const darkIn = dark.data[probe];
        const brightIn = bright.data[probe];
        expect(darkIn).not.toBe(brightIn);

        const darkOut = applyFlameFillLut(dark);
        const brightOut = applyFlameFillLut(bright);
        const again = applyFlameFillLut(cloneImage(dark));
        expect(darkOut.data[probe]).toBe(again.data[probe]);

        // Same input channel always maps to the same output (1D, no image stats).
        const loneDark = makeImage(1, 1);
        loneDark.data.set([darkIn, 12, 8, 255]);
        const loneBright = makeImage(1, 1);
        loneBright.data.set([brightIn, 12, 8, 255]);
        expect(applyFlameFillLut(loneDark).data[0]).toBe(darkOut.data[probe]);
        expect(applyFlameFillLut(loneBright).data[0]).toBe(brightOut.data[probe]);
    });

    it('does not mutate the source ImageData', () => {
        const source = paintSparseFlame();
        const snapshot = Uint8ClampedArray.from(source.data);
        applyFlameFillLut(source);
        expect(Array.from(source.data)).toEqual(Array.from(snapshot));
    });
});

describe('applyFlameFillToCanvas', () => {
    it('writes the LUT back onto an existing canvas (no second IFS)', () => {
        let stored = paintSparseFlame();
        const before = occupancy(stored);
        const canvas = {
            width: 8,
            height: 8,
            getContext: () => ({
                getImageData: () => cloneImage(stored),
                putImageData: (image) => { stored = image; }
            })
        };
        expect(applyFlameFillToCanvas(canvas)).toBe(true);
        expect(occupancy(stored)).toBeGreaterThan(before);
    });
});

describe('prefersFlameFillReducedMotion', () => {
    afterEach(() => {
        document.documentElement.classList.remove('reduced-motion');
    });

    it('honors the OS media query and the app reduced-motion class', () => {
        const media = { matches: false };
        const fakeWindow = { matchMedia: () => media };
        expect(prefersFlameFillReducedMotion(document, fakeWindow)).toBe(false);

        media.matches = true;
        expect(prefersFlameFillReducedMotion(document, fakeWindow)).toBe(true);

        media.matches = false;
        document.documentElement.classList.add('reduced-motion');
        expect(prefersFlameFillReducedMotion(document, fakeWindow)).toBe(true);
    });
});
