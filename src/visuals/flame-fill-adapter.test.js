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

function isVoidRgb(r, g, b) {
    return Math.abs(r - FLAME_VOID[0]) <= 6
        && Math.abs(g - FLAME_VOID[1]) <= 6
        && Math.abs(b - FLAME_VOID[2]) <= 6
        && (r + g + b) < 50;
}

/**
 * Engine-like Layer B still: void holes, dim filaments, and interiors the
 * classic generateImage path already clips (brightness 15 × vibrancy 1.2).
 * That is the live-Chamber case that blew to a white slab after #36.
 */
function paintTypicalEngineFlame(width = 16, height = 16) {
    const image = makeImage(width, height);
    const px = image.data;
    for (let i = 0; i < px.length; i += 4) {
        px[i] = FLAME_VOID[0];
        px[i + 1] = FLAME_VOID[1];
        px[i + 2] = FLAME_VOID[2];
        px[i + 3] = 255;
    }
    const set = (index, rgb) => {
        const o = index * 4;
        px[o] = rgb[0];
        px[o + 1] = rgb[1];
        px[o + 2] = rgb[2];
    };
    // Dim edge filaments — occupancy must still climb above cream-holes.
    for (const i of [17, 18, 33, 34, 49, 65, 81, 97, 113, 129]) {
        set(i, [28, 12, 8]);
    }
    for (const i of [19, 35, 51, 67, 83, 99]) {
        set(i, [80, 36, 18]);
    }
    // Mid chroma — color must survive the LUT.
    for (const i of [36, 37, 52, 53, 68, 69]) {
        set(i, [160, 58, 22]);
    }
    for (const i of [38, 54, 70]) {
        set(i, [48, 72, 170]);
    }
    // Clipped IFS cores (what brightness 15 already writes on a typical still).
    for (let i = 84; i <= 92; i += 1) set(i, [255, 168, 42]);
    for (let i = 100; i <= 108; i += 1) set(i, [255, 220, 96]);
    for (let i = 116; i <= 124; i += 1) set(i, [255, 244, 180]);
    for (let i of [132, 133, 134, 148, 149, 150]) set(i, [255, 255, 210]);
    for (let i of [166, 167, 182, 183]) set(i, [255, 255, 255]);
    return image;
}

function occupiedTone(imageData) {
    const px = imageData.data;
    let n = 0;
    let sum = 0;
    let max = 0;
    let white = 0;
    let nearWhite = 0;
    let blown = 0;
    let chroma = 0;
    for (let i = 0; i < px.length; i += 4) {
        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];
        if (isVoidRgb(r, g, b)) continue;
        n += 1;
        const mean = (r + g + b) / 3;
        const hi = Math.max(r, g, b);
        const lo = Math.min(r, g, b);
        sum += mean;
        max = Math.max(max, hi);
        chroma += hi - lo;
        if (r === 255 && g === 255 && b === 255) white += 1;
        if (r >= 248 && g >= 248 && b >= 248) nearWhite += 1;
        if (lo >= 220) blown += 1;
    }
    return {
        count: n,
        mean: n ? sum / n : 0,
        max,
        white,
        nearWhite,
        blown,
        blownFraction: n ? blown / n : 0,
        chroma: n ? chroma / n : 0
    };
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
        expect(fill.brightness).toBeLessThanOrEqual(22);
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

    it('lifts density for a sparse glyph window and leaves a full window untouched', () => {
        const full = boundFlameFillTone(ROOM_FLAME_TONE, { visibleAreaRatio: 1 });
        const sparse = boundFlameFillTone(ROOM_FLAME_TONE, { visibleAreaRatio: 0.15 });
        // A whitespace-heavy word reveals little, so its density climbs.
        expect(sparse.brightness).toBeGreaterThan(full.brightness);
        // Never past the existing fill ceiling — the lift multiplies before the clamp.
        expect(sparse.brightness).toBeLessThanOrEqual(22);
        // A full window is byte-for-byte the no-ratio default.
        expect(full).toEqual(boundFlameFillTone(ROOM_FLAME_TONE));
    });

    it('treats an absent or malformed visible ratio as a full window', () => {
        const base = boundFlameFillTone(ROOM_FLAME_TONE);
        expect(boundFlameFillTone(ROOM_FLAME_TONE, { visibleAreaRatio: undefined })).toEqual(base);
        expect(boundFlameFillTone(ROOM_FLAME_TONE, { visibleAreaRatio: NaN })).toEqual(base);
        // Out-of-range clamps rather than overshooting the ceiling.
        expect(boundFlameFillTone(ROOM_FLAME_TONE, { visibleAreaRatio: -5 }).brightness)
            .toBeLessThanOrEqual(22);
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

    it('does not blow a typical engine still to a #fff / cream slab', () => {
        const source = paintTypicalEngineFlame();
        const before = occupancy(source);
        const filled = applyFlameFillLut(source);
        const tone = occupiedTone(filled);

        expect(occupancy(filled)).toBeGreaterThan(before);
        expect(tone.white).toBe(0);
        expect(tone.nearWhite).toBe(0);
        expect(tone.max).toBeLessThan(230);
        expect(tone.mean).toBeLessThan(190);
        expect(tone.blownFraction).toBeLessThan(0.12);
        expect(tone.chroma).toBeGreaterThan(20);
        const distantVoid = 15 * 4;
        expect([
            filled.data[distantVoid],
            filled.data[distantVoid + 1],
            filled.data[distantVoid + 2]
        ]).toEqual([...FLAME_VOID]);
        expect(filled.data[distantVoid + 3]).toBe(0);
    });

    it('makes source void transparent so the declared ground can show through', () => {
        const source = paintSparseFlame();
        const filled = applyFlameFillLut(source);
        const px = filled.data;
        // Corner pixels were void and must become honest alpha holes.
        expect([px[0], px[1], px[2]]).toEqual([...FLAME_VOID]);
        expect(px[3]).toBe(0);
        const last = (source.width * source.height - 1) * 4;
        expect([px[last], px[last + 1], px[last + 2]]).toEqual([...FLAME_VOID]);
        expect(px[last + 3]).toBe(0);
    });

    it('expands one occupied pixel by exactly one frozen neighbourhood', () => {
        const source = makeImage(5, 5);
        for (let i = 0; i < source.data.length; i += 4) {
            source.data.set([...FLAME_VOID, 255], i);
        }
        const center = (2 * 5 + 2) * 4;
        source.data.set([120, 48, 20, 173], center);

        const first = applyFlameFillLut(source);
        const second = applyFlameFillLut(cloneImage(source));

        for (let y = 0; y < 5; y += 1) {
            for (let x = 0; x < 5; x += 1) {
                const alpha = first.data[(y * 5 + x) * 4 + 3];
                const immediate = Math.abs(x - 2) <= 1 && Math.abs(y - 2) <= 1;
                expect(alpha, `${x},${y}`).toBe(immediate ? 173 : 0);
            }
        }
        expect(Array.from(second.data)).toEqual(Array.from(first.data));
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
