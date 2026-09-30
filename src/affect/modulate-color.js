/**
 * Modulate the fine color parameters a procedural visual already has.
 *
 * Plate looks use `hue` as a turn of the ramp and `sat` as saturation.
 * A Living Flame recipe uses `macros.hue` in degrees and `tone.vibrancy`.
 * Warmth turns the hue. Arousal scales the color strength around the
 * authored value, so 0.5 leaves it. Valence does not move hue. A phrase
 * with no span leaves the parameters as they were.
 *
 * Palette names, grain, chroma, geometry, and motion are not parameters
 * of this layer.
 */

import { validateFlameRecipe } from '../core/flame-recipe.js';
import { clamp } from './schema.js';

const PLATE_HUE_TURN = 0.15;
const FLAME_HUE_TURN = 40;

function axis(state, id) {
    const value = state?.dimensions?.[id]?.value;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stateAt(program, phraseIndex) {
    const spans = program?.spans;
    if (!Array.isArray(spans)) return null;
    const span = spans.find(item => item?.index === phraseIndex);
    return span?.state || null;
}

function wrap01(value) {
    const wrapped = value - Math.floor(value);
    return Object.is(wrapped, -0) ? 0 : wrapped;
}

function colorGain(arousal) {
    return 0.5 + arousal;
}

export function modulatePlateColorsAt(look, program, phraseIndex) {
    if (!look || typeof look !== 'object') return look;
    const state = stateAt(program, phraseIndex);
    if (!state) return look;
    const warmth = axis(state, 'warmth');
    const arousal = axis(state, 'arousal');
    if (warmth == null && arousal == null) return look;
    const next = { ...look };
    if (warmth != null && typeof look.hue === 'number' && Number.isFinite(look.hue)) {
        next.hue = wrap01(look.hue + warmth * PLATE_HUE_TURN);
    }
    if (arousal != null && typeof look.sat === 'number' && Number.isFinite(look.sat)) {
        next.sat = clamp(look.sat * colorGain(arousal), 0, 1);
    }
    return next;
}

export function modulateFlameColorsAt(recipe, program, phraseIndex) {
    if (!recipe || typeof recipe !== 'object') return recipe;
    const state = stateAt(program, phraseIndex);
    if (!state) return recipe;
    const warmth = axis(state, 'warmth');
    const arousal = axis(state, 'arousal');
    if (warmth == null && arousal == null) return recipe;
    const hue = recipe.macros?.hue;
    const vibrancy = recipe.tone?.vibrancy;
    const nextHue = warmth != null && typeof hue === 'number'
        ? clamp(hue + warmth * FLAME_HUE_TURN, -180, 180)
        : hue;
    const nextVibrancy = arousal != null && typeof vibrancy === 'number'
        ? clamp(vibrancy * colorGain(arousal), 0, 1)
        : vibrancy;
    try {
        return validateFlameRecipe({
            ...recipe,
            macros: { ...recipe.macros, hue: nextHue },
            tone: { ...recipe.tone, vibrancy: nextVibrancy }
        });
    } catch {
        return recipe;
    }
}
