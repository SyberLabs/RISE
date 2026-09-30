import { describe, expect, it } from 'vitest';
import { validateFlameRecipe } from '../core/flame-recipe.js';
import { flamePreset } from '../visuals/living-flame/flame-presets.js';
import { contentHash } from './hash.js';
import {
    modulateFlameColorsAt,
    modulatePlateColorsAt
} from './modulate-color.js';
import { AFFECT_PROGRAM_SCHEMA } from './program.js';

const TEXT = 'I celebrate myself, and sing myself.';

function state(dimensions) {
    return {
        version: 1,
        modality: 'text',
        dimensions,
        provenance: { method: 'hand' }
    };
}

function slot(value, source = 'authored') {
    return { value, confidence: 1, source };
}

function program(spans) {
    return {
        schema: AFFECT_PROGRAM_SCHEMA,
        authority: 'user',
        textHash: contentHash(TEXT),
        chunk: { mode: 'phrase', wpm: 220, phraseFloor: true },
        spans
    };
}

const LOOK = Object.freeze({
    hue: 0.1,
    sat: 0.8,
    chroma: 5,
    grain: 0.06,
    palette: 'prism',
    exposure: 1.6
});

describe('plate color modulation', () => {
    it('turns hue with warmth and scales saturation with arousal', () => {
        const modulated = modulatePlateColorsAt(LOOK, program([{
            index: 0,
            text: TEXT,
            state: state({
                warmth: slot(1),
                arousal: slot(1)
            })
        }]), 0);
        expect(modulated.hue).toBeCloseTo(0.25);
        expect(modulated.sat).toBeCloseTo(1);
        expect(modulated.palette).toBe('prism');
        expect(modulated.grain).toBe(0.06);
        expect(modulated.chroma).toBe(5);
        expect(LOOK.hue).toBe(0.1);
        expect(LOOK.sat).toBe(0.8);
    });

    it('leaves the look untouched when the phrase has no span', () => {
        expect(modulatePlateColorsAt(LOOK, program([]), 0)).toBe(LOOK);
    });

    it('does not move hue from valence', () => {
        const modulated = modulatePlateColorsAt(LOOK, program([{
            index: 0,
            text: TEXT,
            state: state({ valence: slot(-1) })
        }]), 0);
        expect(modulated).toBe(LOOK);
    });

    it('holds saturation when arousal is the middle of its range', () => {
        const modulated = modulatePlateColorsAt(LOOK, program([{
            index: 0,
            text: TEXT,
            state: state({ arousal: slot(0.5) })
        }]), 0);
        expect(modulated.sat).toBeCloseTo(0.8);
        expect(modulated.hue).toBe(0.1);
    });
});

describe('living flame color modulation', () => {
    it('shifts the hue macro and vibrancy and leaves the geometry', () => {
        const recipe = flamePreset('ember-cathedral');
        const modulated = modulateFlameColorsAt(recipe, program([{
            index: 0,
            text: TEXT,
            state: state({
                warmth: slot(1),
                arousal: slot(1)
            })
        }]), 0);
        expect(validateFlameRecipe(modulated)).toEqual(modulated);
        expect(modulated.macros.hue).toBeCloseTo(recipe.macros.hue + 40);
        expect(modulated.tone.vibrancy).toBeGreaterThan(recipe.tone.vibrancy);
        expect(modulated.palette).toEqual(recipe.palette);
        expect(modulated.transforms).toEqual(recipe.transforms);
        expect(modulated.motion).toEqual(recipe.motion);
        expect(recipe.macros.hue).toBe(0);
    });

    it('returns the recipe when the phrase is absent', () => {
        const recipe = flamePreset('ember-cathedral');
        expect(modulateFlameColorsAt(recipe, program([]), 2)).toBe(recipe);
    });
});
