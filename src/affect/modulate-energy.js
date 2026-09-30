/**
 * Scale the one energy parameter an engine already has.
 *
 * The signal is motionEnergy. 0.5 leaves the authored value. Arousal does
 * not, because arousal already scales color. Attractor and night-streak
 * speed are the motion clock (0.25 to 4). Living Flame energy is the
 * 0-to-1 control that speeds motion, breath, and exposure, whether it
 * sits on the field or on the recipe.
 *
 * Apparitio, Ostensoria, Harmonograph, Klee, and Genesis are not here.
 * Their motion is a palette name, a conductor plan, or a bundle of
 * factors, not one energy number.
 */

import { validateFlameRecipe } from '../core/flame-recipe.js';
import { clamp } from './schema.js';

const SPEED = Object.freeze({ key: 'speed', min: 0.25, max: 4 });

const CHANNELS = Object.freeze({
    attractor: SPEED,
    'night-streaks': SPEED,
    'living-flame': Object.freeze({ key: 'energy', min: 0, max: 1 })
});

export const ENERGY_ENGINES = Object.freeze(Object.keys(CHANNELS));

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

function scaled(value, motionEnergy, min, max) {
    return clamp(value * (0.5 + motionEnergy), min, max);
}

export function modulateEnergyAt(engine, parameters, program, phraseIndex) {
    const channel = CHANNELS[engine];
    if (!channel || !parameters || typeof parameters !== 'object') return parameters;
    const motionEnergy = axis(stateAt(program, phraseIndex), 'motionEnergy');
    if (motionEnergy == null) return parameters;

    if (engine === 'living-flame' && parameters.macros && typeof parameters.macros.energy === 'number') {
        try {
            return validateFlameRecipe({
                ...parameters,
                macros: {
                    ...parameters.macros,
                    energy: scaled(parameters.macros.energy, motionEnergy, channel.min, channel.max)
                }
            });
        } catch {
            return parameters;
        }
    }

    const current = parameters[channel.key];
    if (typeof current !== 'number' || !Number.isFinite(current)) return parameters;
    return {
        ...parameters,
        [channel.key]: scaled(current, motionEnergy, channel.min, channel.max)
    };
}
