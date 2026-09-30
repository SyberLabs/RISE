/**
 * Placement for the RISE EMOTIONS map.
 *
 * Valence and arousal, when both are present, sit in the plane.
 * Warmth sets hue. A missing axis stays missing. A color with only
 * warmth sits on the spectral ring. The filament is a Thomas
 * attractor colored along its length, so the wheel and the orbit
 * are one drawing.
 */

import { colorimetricWarmth } from './modalities/visual.js';

const PLANE = 0.62;

function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function hueFromWarmth(warmth) {
    return 40 + (1 - warmth) * 90;
}

export function placeEmotion({ valence = null, arousal = null, warmth = null } = {}) {
    const placedValence = num(valence);
    const placedArousal = num(arousal);
    const placedWarmth = num(warmth);
    const hue = placedWarmth == null ? null : hueFromWarmth(placedWarmth);
    if (placedValence != null && placedArousal != null) {
        return {
            mode: 'plane',
            x: placedValence * PLANE,
            y: (placedArousal * 2 - 1) * PLANE,
            hue,
            valence: placedValence,
            arousal: placedArousal,
            warmth: placedWarmth
        };
    }
    if (placedWarmth == null) return null;
    const radius = placedArousal == null ? 1 : 0.72 + 0.28 * placedArousal;
    const angle = hue * Math.PI / 180;
    return {
        mode: 'ring',
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        hue,
        valence: placedValence,
        arousal: placedArousal,
        warmth: placedWarmth
    };
}

function hexToRgb(hex) {
    const match = /^#([0-9a-f]{6})$/iu.exec(hex || '');
    if (!match) return null;
    const value = Number.parseInt(match[1], 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgbToHsl(rgb) {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (delta < 1e-6) return { hue: 0, saturation: 0 };
    let hue;
    if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    const luminance = (max + min) / 2;
    const saturation = luminance > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    return { hue: hue * 60, saturation };
}

/** Warmth of a #rrggbb swatch. Unsaturated colors, including white, stay out. */
export function swatchWarmth(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    const { hue, saturation } = rgbToHsl(rgb);
    if (saturation < 0.08) return null;
    const warmth = colorimetricWarmth(hue) * saturation;
    return Math.min(1, Math.max(-1, warmth));
}

export function thomasFilament(count = 480) {
    let x = 0.5;
    let y = 0.6;
    let z = -0.7;
    const dt = 0.025;
    const transient = 400;
    const raw = [];
    for (let i = 0; i < count + transient; i++) {
        const nx = x + (Math.sin(y) - 0.19 * x) * dt;
        const ny = y + (Math.sin(z) - 0.19 * y) * dt;
        const nz = z + (Math.sin(x) - 0.19 * z) * dt;
        x = nx;
        y = ny;
        z = nz;
        if (i >= transient) raw.push([x, y]);
    }
    let sx = 0;
    let sy = 0;
    for (const [px, py] of raw) {
        sx += px;
        sy += py;
    }
    const mx = sx / raw.length;
    const my = sy / raw.length;
    let max = 0;
    const centered = raw.map(([px, py]) => [px - mx, py - my]);
    for (const [px, py] of centered) max = Math.max(max, Math.hypot(px, py));
    const scale = max || 1;
    const last = Math.max(raw.length - 1, 1);
    return centered.map(([px, py], index) => ({
        x: px / scale,
        y: py / scale,
        hue: (index / last) * 359
    }));
}
