import { describe, expect, it } from 'vitest';
import { validateFlameRecipe } from '../core/flame-recipe.js';
import { flamePreset } from '../visuals/living-flame/flame-presets.js';
import { contentHash } from './hash.js';
import { ENERGY_ENGINES, modulateEnergyAt } from './modulate-energy.js';
import { AFFECT_PROGRAM_SCHEMA } from './program.js';

function state(dimensions) {
    return {
        version: 1,
        modality: 'text',
        dimensions,
        provenance: { method: 'hand' }
    };
}

function slot(value) {
    return { value, confidence: 1, source: 'authored' };
}

function program(spans) {
    return {
        schema: AFFECT_PROGRAM_SCHEMA,
        authority: 'user',
        textHash: contentHash('text'),
        chunk: { mode: 'phrase', wpm: 220, phraseFloor: true },
        spans
    };
}

function span(dimensions) {
    return program([{ index: 0, text: 'text', state: state(dimensions) }]);
}

describe('shared energy modulation', () => {
    it('scales attractor speed from motion energy and leaves brightness', () => {
        const look = { system: 'aizawa', palette: 'white', speed: 2, intensity: 0.65 };
        const modulated = modulateEnergyAt('attractor', look, span({ motionEnergy: slot(1) }), 0);
        expect(modulated.speed).toBeCloseTo(3);
        expect(modulated.intensity).toBe(0.65);
        expect(modulated.system).toBe('aizawa');
        expect(look.speed).toBe(2);
    });

    it('holds speed at the middle of motion energy and clamps the top', () => {
        const held = modulateEnergyAt('attractor', { speed: 2 }, span({ motionEnergy: slot(0.5) }), 0);
        expect(held.speed).toBeCloseTo(2);
        const capped = modulateEnergyAt('night-streaks', { speed: 4 }, span({ motionEnergy: slot(1) }), 0);
        expect(capped.speed).toBe(4);
    });

    it('scales a living flame field energy the same way as the recipe', () => {
        const field = { energy: 0.35, recipeId: 'ember-cathedral' };
        const modulated = modulateEnergyAt('living-flame', field, span({ motionEnergy: slot(1) }), 0);
        expect(modulated.energy).toBeCloseTo(0.525);
        expect(modulated.recipeId).toBe('ember-cathedral');
        expect(field.energy).toBe(0.35);
    });

    it('scales a living flame recipe energy and leaves the drawing', () => {
        const recipe = flamePreset('ember-cathedral');
        const modulated = modulateEnergyAt('living-flame', recipe, span({ motionEnergy: slot(1) }), 0);
        expect(validateFlameRecipe(modulated)).toEqual(modulated);
        expect(modulated.macros.energy).toBeCloseTo(recipe.macros.energy * 1.5);
        expect(modulated.macros.hue).toBe(recipe.macros.hue);
        expect(modulated.transforms).toEqual(recipe.transforms);
        expect(modulated.palette).toEqual(recipe.palette);
    });

    it('does not treat arousal as energy', () => {
        const look = { speed: 2, intensity: 0.65 };
        expect(modulateEnergyAt('attractor', look, span({ arousal: slot(1) }), 0)).toBe(look);
    });

    it('returns the same object when the phrase or the engine has no energy parameter', () => {
        const look = { speed: 1, palette: 'prism', hue: 0.1, sat: 0.8 };
        expect(modulateEnergyAt('attractor', look, program([]), 0)).toBe(look);
        expect(modulateEnergyAt('apparitio', look, span({ motionEnergy: slot(1) }), 0)).toBe(look);
        expect(modulateEnergyAt('harmonograph', look, span({ motionEnergy: slot(1) }), 0)).toBe(look);
        expect(ENERGY_ENGINES).toEqual(['attractor', 'night-streaks', 'living-flame']);
    });
});
