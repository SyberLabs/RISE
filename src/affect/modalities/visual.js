/**
 * Visual contribution.
 *
 * Authoritative parameters (mode, palette swatch, frequency, duration)
 * are measured or derived from the configuration RISE already holds.
 * Hue is mapped to colorimetric warmth only. It is not mapped to
 * valence. That mapping is a scale choice with modest confidence, not
 * a finding that blue is sad.
 */

import { ATTRACTOR_PALETTES } from '../../core/visual-style-definitions.js';
import { contentHash } from '../hash.js';
import { clamp, experienceState, slot, unavailableState } from '../schema.js';

const SWATCHES = Object.freeze(Object.fromEntries(
    ATTRACTOR_PALETTES.map(palette => [palette.id, palette.swatch])
));

const KLEE_DENSITY = Object.freeze({
    chaotic: 0.8,
    twittering: 0.65,
    gravitational: 0.5,
    random: 0.45,
    architectural: 0.35,
    harmonic: 0.3
});

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
    const luminance = (max + min) / 2;
    const delta = max - min;
    if (delta < 1e-6) return { hue: 0, saturation: 0, luminance };
    const saturation = luminance > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    let hue;
    if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    return { hue: hue * 60, saturation, luminance };
}

/** Warm hues near orange score positive. Opposite hues score negative. */
export function colorimetricWarmth(hue) {
    return Math.cos((hue - 40) * Math.PI / 180);
}

function fromConfig(visualConfig = {}) {
    const mode = visualConfig.visualMode || 'off';
    if (mode === 'off') return { visualMode: 'off' };
    const interlocution = visualConfig.interlocution || {};
    const attractor = visualConfig.attractor || {};
    const paletteId = attractor.palette || interlocution.palette;
    const swatch = SWATCHES[paletteId] || null;
    const hsl = swatch ? rgbToHsl(hexToRgb(swatch)) : null;
    const frequency = Number.isFinite(interlocution.frequency) ? interlocution.frequency : null;
    const duration = Number.isFinite(interlocution.duration) ? interlocution.duration : null;
    const form = attractor.form || null;
    const preset = interlocution.kleePreset || null;
    return {
        visualMode: mode,
        paletteId: paletteId || null,
        hue: hsl ? hsl.hue : null,
        saturation: hsl ? hsl.saturation : null,
        luminance: hsl ? hsl.luminance : null,
        flashCadence: frequency,
        transitionRate: duration == null ? null : clamp(1 - duration / 8000, 0, 1),
        densityBoost: form === 'kaleido' ? 0.2 : form === 'bilateral' ? 0.1 : 0,
        presetDensity: KLEE_DENSITY[preset] ?? null
    };
}

function measuredOf(input) {
    if (input.measured && typeof input.measured === 'object') return { ...input.measured };
    if (input.visualConfig) return fromConfig(input.visualConfig);
    return null;
}

export function visualState(input = {}) {
    const measured = measuredOf(input);
    if (!measured) return unavailableState('visual', 'visual-unspecified');
    if (measured.visualMode === 'off') {
        return experienceState({
            modality: 'visual',
            dimensions: {
                perceptualDensity: slot(0, 0.9, 'measured'),
                motionEnergy: slot(0, 0.9, 'measured')
            },
            measurements: { visualMode: 'off' },
            caveats: ['visual-mode-off-is-absence'],
            provenance: {
                method: 'visual-absence',
                note: 'visualMode off is an authoritative absence, not a guessed calm image'
            }
        });
    }

    const motion = Number.isFinite(measured.motionVelocity) ? clamp(measured.motionVelocity, 0, 1) : null;
    const cadence = Number.isFinite(measured.flashCadence) ? clamp(measured.flashCadence, 0, 1) : null;
    const density = Number.isFinite(measured.density) ? clamp(measured.density, 0, 1) : null;
    const entropy = Number.isFinite(measured.entropy) ? clamp(measured.entropy, 0, 1) : null;
    const openness = Number.isFinite(measured.openness) ? clamp(measured.openness, 0, 1) : null;
    const scale = Number.isFinite(measured.scale) ? clamp(measured.scale, 0, 1) : null;
    const contrast = Number.isFinite(measured.contrast) ? clamp(measured.contrast, 0, 1) : null;
    const saturation = Number.isFinite(measured.saturation) ? clamp(measured.saturation, 0, 1) : null;
    const hue = Number.isFinite(measured.hue) ? measured.hue : null;

    const dimensions = {};
    const motionEnergy = motion != null || cadence != null
        ? clamp((motion ?? 0) * 0.7 + (cadence ?? 0) * 0.3 + (measured.densityBoost || 0) * 0.1, 0, 1)
        : null;
    if (motionEnergy != null) {
        dimensions.motionEnergy = slot(motionEnergy, motion != null ? 0.7 : 0.4, motion != null ? 'measured' : 'prior');
        dimensions.arousal = slot(
            clamp(motionEnergy * 0.85 + (cadence ?? 0) * 0.15, 0, 1),
            0.35,
            'prior'
        );
    }
    const densityValue = density != null || entropy != null || measured.presetDensity != null
        ? clamp(
            (density ?? measured.presetDensity ?? 0.3) * 0.6
            + (entropy ?? 0) * 0.25
            + (contrast ?? 0) * 0.15
            + (measured.densityBoost || 0),
            0,
            1
        )
        : null;
    if (densityValue != null) {
        dimensions.perceptualDensity = slot(
            densityValue,
            density != null ? 0.65 : 0.3,
            density != null ? 'measured' : 'prior'
        );
    }
    if (openness != null || scale != null) {
        dimensions.expansiveness = slot(
            clamp((openness ?? 0.5) * 0.7 + (scale ?? 0.5) * 0.3, 0, 1),
            0.4,
            openness != null ? 'measured' : 'prior'
        );
    }
    if (hue != null && saturation != null && saturation >= 0.08) {
        dimensions.warmth = slot(clamp(colorimetricWarmth(hue) * saturation, -1, 1), 0.45, 'measured');
    }

    if (Object.keys(dimensions).length === 0) return unavailableState('visual', 'visual-features-insufficient');

    return experienceState({
        modality: 'visual',
        dimensions,
        measurements: {
            hue: hue ?? undefined,
            saturation: saturation ?? undefined,
            luminance: Number.isFinite(measured.luminance) ? measured.luminance : undefined,
            flashCadence: cadence ?? undefined,
            visualMode: measured.visualMode || undefined,
            paletteId: measured.paletteId || undefined
        },
        caveats: ['hue-is-not-valence', 'visual-priors-are-scale-choices'],
        provenance: {
            method: 'visual-parameter-prior-v1',
            contentHash: contentHash(JSON.stringify(measured)),
            note: 'Colorimetric warmth uses hue. Valence is not set from color.'
        }
    });
}
