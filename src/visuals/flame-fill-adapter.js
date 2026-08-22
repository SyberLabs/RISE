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
/** Occupied channels stay below #fff. Void stays #0A0A0C. */
const HIGHLIGHT_CEILING = 220;
const CHANNEL_FLOOR = 1;

function clamp(value, lo, hi) {
    return Math.min(hi, Math.max(lo, value));
}

function createImageBuffer(width, height, data) {
    const pixels = data
        ? new Uint8ClampedArray(data)
        : new Uint8ClampedArray(width * height * 4);
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
export function boundFlameFillTone(tone = ROOM_FLAME_TONE, { reducedMotion = false } = {}) {
    const roomGamma = numberOr(tone?.gamma, ROOM_FLAME_TONE.gamma);
    const roomBrightness = numberOr(tone?.brightness, ROOM_FLAME_TONE.brightness);
    const roomVibrancy = numberOr(tone?.vibrancy, ROOM_FLAME_TONE.vibrancy);
    const scale = reducedMotion ? REDUCED : FILL;

    return Object.freeze({
        brightness: +clamp(
            Math.max(roomBrightness * scale.brightnessScale, scale.brightnessMin),
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
function transferChannel(x, tone) {
    const gain = (tone.brightness * tone.vibrancy)
        / (ROOM_FLAME_TONE.brightness * ROOM_FLAME_TONE.vibrancy);
    const lifted = Math.log1p(gain * x) / Math.log1p(gain);
    const shaped = Math.pow(Math.max(0, lifted), 1 / tone.gamma);
    return clamp(knee(shaped), 0, HIGHLIGHT_CEILING / 255);
}

export function applyFlameFillLut(imageData, options = {}) {
    if (!imageData?.data || !imageData.width || !imageData.height) return imageData;
    const tone = options.tone || boundFlameFillTone(options.roomTone || ROOM_FLAME_TONE, {
        reducedMotion: options.reducedMotion === true
    });
    const src = imageData.data;
    const out = createImageBuffer(imageData.width, imageData.height);
    const dst = out.data;
    for (let i = 0; i < src.length; i += 4) {
        const r = src[i];
        const g = src[i + 1];
        const b = src[i + 2];
        dst[i + 3] = src[i + 3];
        if (isVoidPixel(r, g, b)) {
            dst[i] = FLAME_VOID[0];
            dst[i + 1] = FLAME_VOID[1];
            dst[i + 2] = FLAME_VOID[2];
            continue;
        }
        dst[i] = clamp(Math.round(transferChannel(r / 255, tone) * 255), CHANNEL_FLOOR, HIGHLIGHT_CEILING);
        dst[i + 1] = clamp(Math.round(transferChannel(g / 255, tone) * 255), CHANNEL_FLOOR, HIGHLIGHT_CEILING);
        dst[i + 2] = clamp(Math.round(transferChannel(b / 255, tone) * 255), CHANNEL_FLOOR, HIGHLIGHT_CEILING);
    }
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
    const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.putImageData(applyFlameFillLut(src, { ...options, reducedMotion }), 0, 0);
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
