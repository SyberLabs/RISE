/**
 * Word-fill-only brightness/density adapter for Fractal Flame.
 *
 * One level above color profiles (Cream / Dark Slate / Transparent).
 * The classic room Fractal Flames program is unchanged. Word-fill stills
 * keep the existing generate / planFlame / queue path — this module does
 * not start a second IFS and does not bake a stock PNG. It bounds the
 * generateImage knobs that port already exposes (brightness, gamma,
 * vibrancy) and applies them as a session-locked 1D LUT so a glyph
 * reads as filled flame, not sparse black over cream.
 *
 * Transfer: gain from those knobs → log1p → gamma → knee → clamp
 * below white. Not hist-eq. Not per-frame auto-exposure.
 * prefers-reduced-motion uses a milder locked curve; it does not animate.
 */

/** Room wrapper defaults from `FractalFlame.generateToQueue` (raw mode). */
export const ROOM_FLAME_TONE = Object.freeze({
    gamma: 2.2,
    brightness: 15.0,
    vibrancy: 1.2
});

/** FractalFlame canvas clear: --color-void (#0A0A0C). Plate shows through. */
export const FLAME_VOID = Object.freeze([10, 10, 12]);

const FILL = Object.freeze({
    brightnessScale: 1.28,
    brightnessMin: 16,
    brightnessMax: 22,
    gammaScale: 0.88,
    gammaMin: 1.65,
    gammaMax: 2.05,
    vibrancyScale: 1.08,
    vibrancyMax: 1.45
});

const REDUCED = Object.freeze({
    brightnessScale: 1.16,
    brightnessMin: 16,
    brightnessMax: 20,
    gammaScale: 0.94
});

const VOID_SLACK = 6;
const KNEE_START = 0.62;
const KNEE_STRENGTH = 1.15;
/**
 * How far a sparse glyph window may lift density. A whitespace-heavy or off-
 * aspect Fit word reveals only a little of the flame (a low visibleAreaRatio
 * from fit-projection.js), so its density is lifted toward the fill ceiling so
 * the little that shows still reads. The lift multiplies brightness BEFORE the
 * existing clamp, so it can never exceed the fill safety bounds, and a ratio of
 * 1 (a full window, or no ratio supplied) lifts nothing — output stays
 * byte-for-byte identical to today.
 */
const DENSITY_LIFT = 0.5;
/** Occupied channels stay below #fff. Transparent void keeps #0A0A0C RGB. */
const HIGHLIGHT_CEILING = 220;
const CHANNEL_FLOOR = 1;

function clamp(value, lo, hi) {
    return Math.min(hi, Math.max(lo, value));
}

function createImageBuffer(width, height) {
    const pixels = new Uint8ClampedArray(width * height * 4);
    if (typeof ImageData === 'function') {
        try {
            return new ImageData(pixels, width, height);
        } catch {
            /* jsdom / node: fall through to a buffer the LUT can still write */
        }
    }
    return { width, height, data: pixels };
}

function numberOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * Bound fill tone from a room plan or the wrapper default.
 * Only brightness / gamma / vibrancy — the generateImage knobs.
 */
export function boundFlameFillTone(tone = ROOM_FLAME_TONE, { reducedMotion = false, visibleAreaRatio = 1 } = {}) {
    const roomGamma = numberOr(tone?.gamma, ROOM_FLAME_TONE.gamma);
    const roomBrightness = numberOr(tone?.brightness, ROOM_FLAME_TONE.brightness);
    const roomVibrancy = numberOr(tone?.vibrancy, ROOM_FLAME_TONE.vibrancy);
    const scale = reducedMotion ? REDUCED : FILL;
    // A sparse glyph window lifts density toward the ceiling; a full window (or
    // an unsupplied ratio) lifts nothing. Clamped to [0,1] so a bad value
    // cannot push past the fill bounds the final clamp already enforces.
    const ratio = clamp(numberOr(visibleAreaRatio, 1), 0, 1);
    const densityLift = 1 + (1 - ratio) * DENSITY_LIFT;

    return Object.freeze({
        brightness: +clamp(
            Math.max(roomBrightness * scale.brightnessScale * densityLift, scale.brightnessMin),
            scale.brightnessMin,
            scale.brightnessMax
        ).toFixed(1),
        gamma: +clamp(
            roomGamma * scale.gammaScale,
            FILL.gammaMin,
            FILL.gammaMax
        ).toFixed(2),
        vibrancy: +clamp(
            roomVibrancy * FILL.vibrancyScale,
            roomVibrancy,
            FILL.vibrancyMax
        ).toFixed(2)
    });
}

function isVoidPixel(r, g, b) {
    return Math.abs(r - FLAME_VOID[0]) <= VOID_SLACK
        && Math.abs(g - FLAME_VOID[1]) <= VOID_SLACK
        && Math.abs(b - FLAME_VOID[2]) <= VOID_SLACK
        && (r + g + b) < 50;
}

function knee(x) {
    if (x <= KNEE_START) return x;
    const t = (x - KNEE_START) / (1 - KNEE_START);
    return KNEE_START + (1 - KNEE_START) * (t / (1 + KNEE_STRENGTH * t));
}

/**
 * Session-locked 1D curve. Same input channel always maps to the same
 * output; image histograms never move the gain.
 */
function transferChannel(x, tone, gain, gainNorm) {
    const lifted = Math.log1p(gain * x) / gainNorm;
    const shaped = Math.pow(Math.max(0, lifted), 1 / tone.gamma);
    return clamp(knee(shaped), 0, HIGHLIGHT_CEILING / 255);
}

const lutCache = new Map();

/**
 * The curve as the 256-entry table it is. Channel input is always an
 * integer byte, so the table reproduces `transferChannel` exactly while
 * pulling two logs and a pow out of the per-pixel loop.
 */
function flameFillLut(tone) {
    const key = `${tone.brightness}|${tone.gamma}|${tone.vibrancy}`;
    const cached = lutCache.get(key);
    if (cached) return cached;

    const gain = (tone.brightness * tone.vibrancy)
        / (ROOM_FLAME_TONE.brightness * ROOM_FLAME_TONE.vibrancy);
    const gainNorm = Math.log1p(gain);
    const table = new Uint8Array(256);
    for (let v = 0; v < 256; v += 1) {
        // FM-RISE-52's occupied-channel bounds fold into the table: they are
        // a function of the input byte alone, like the rest of the curve.
        table[v] = clamp(
            Math.round(transferChannel(v / 255, tone, gain, gainNorm) * 255),
            CHANNEL_FLOOR,
            HIGHLIGHT_CEILING
        );
    }
    lutCache.set(key, table);
    return table;
}

function resolveTone(options) {
    return options.tone || boundFlameFillTone(options.roomTone || ROOM_FLAME_TONE, {
        reducedMotion: options.reducedMotion === true,
        visibleAreaRatio: options.visibleAreaRatio
    });
}

/**
 * Transform occupied flame and add one frozen pixel of support. Original
 * occupancy is captured before expansion, so new pixels cannot cascade.
 * `src` and `dst` may be the same array.
 */
function writeFlameFill(src, dst, lut, width, height) {
    const pixelCount = width * height;
    const occupied = new Uint8Array(pixelCount);

    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
        const i = pixel * 4;
        const r = src[i];
        const g = src[i + 1];
        const b = src[i + 2];
        const alpha = src[i + 3];
        const hasFlame = alpha > 0 && !isVoidPixel(r, g, b);
        occupied[pixel] = hasFlame ? 1 : 0;
        if (!hasFlame) {
            dst[i] = FLAME_VOID[0];
            dst[i + 1] = FLAME_VOID[1];
            dst[i + 2] = FLAME_VOID[2];
            dst[i + 3] = 0;
            continue;
        }
        dst[i] = lut[r];
        dst[i + 1] = lut[g];
        dst[i + 2] = lut[b];
        dst[i + 3] = alpha;
    }

    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
        if (occupied[pixel]) continue;
        const x = pixel % width;
        const y = Math.floor(pixel / width);
        let strongest = -1;
        let strongestValue = -1;
        for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny += 1) {
            for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx += 1) {
                const neighbour = ny * width + nx;
                if (!occupied[neighbour]) continue;
                const offset = neighbour * 4;
                const strength = dst[offset] + dst[offset + 1] + dst[offset + 2];
                if (strength > strongestValue) {
                    strongest = offset;
                    strongestValue = strength;
                }
            }
        }
        if (strongest < 0) continue;
        const i = pixel * 4;
        dst[i] = dst[strongest];
        dst[i + 1] = dst[strongest + 1];
        dst[i + 2] = dst[strongest + 2];
        dst[i + 3] = dst[strongest + 3];
    }
}

export function applyFlameFillLut(imageData, options = {}) {
    if (!imageData?.data || !imageData.width || !imageData.height) return imageData;
    const out = createImageBuffer(imageData.width, imageData.height);
    writeFlameFill(
        imageData.data,
        out.data,
        flameFillLut(resolveTone(options)),
        imageData.width,
        imageData.height
    );
    return out;
}

export function applyFlameFillToCanvas(canvas, options = {}) {
    const ctx = typeof canvas?.getContext === 'function'
        ? canvas.getContext('2d')
        : null;
    if (!ctx || typeof ctx.getImageData !== 'function' || !canvas.width || !canvas.height) {
        return false;
    }
    const reducedMotion = options.reducedMotion
        ?? prefersFlameFillReducedMotion();
    // getImageData already hands back a private copy, so fill it in place
    // rather than allocating a second full-canvas buffer per flash.
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    writeFlameFill(
        image.data,
        image.data,
        flameFillLut(resolveTone({ ...options, reducedMotion })),
        canvas.width,
        canvas.height
    );
    ctx.putImageData(image, 0, 0);
    return true;
}

export function prefersFlameFillReducedMotion(
    doc = typeof document !== 'undefined' ? document : null,
    win = typeof window !== 'undefined' ? window : null
) {
    if (doc?.documentElement?.classList?.contains('reduced-motion')) return true;
    if (typeof win?.matchMedia === 'function') {
        return win.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
    }
    return false;
}
