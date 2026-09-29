/**
 * The intended condition of a passage, reaching the imagery beneath it.
 *
 * What is held: the mapping is closed (only the two named dimensions do
 * anything), bounded (whatever a provider sends, the numbers stay inside the
 * ranges that keep the words legible), authoring-preserving (nothing that
 * makes a visual that visual is changed, and a renderer that is not an
 * attractor is untouched), and inert when it has nothing to say.
 */
import { describe, expect, it } from 'vitest';
import { EXPERIENCE_DIMENSIONS } from './protocol.js';
import { ATTRACTOR_BOUNDS, attractorConfigFor, withExperientialState } from './state-visuals.js';

const program = () => ({
    coordinateSpace: 'source',
    segments: [
        { id: 'visual-0', match: { sourceIds: ['a'] }, cue: { kind: 'field', renderer: 'attractor', config: {} } },
        { id: 'visual-1', match: { sourceIds: ['b'] }, cue: { kind: 'still' } },
        { id: 'visual-2', match: { sourceIds: ['c'] }, cue: { kind: 'field', renderer: 'genesis', config: { preset: 'random' } } },
        { id: 'visual-3', match: { sourceIds: ['d'] }, cue: { kind: 'field', renderer: 'attractor', config: { system: 'thomas', palette: 'gold' } } }
    ],
    fallback: { kind: 'still' }
});

describe('the numbers an attractor takes', () => {
    it('reads motion as speed and density as brightness, inside the ranges', () => {
        expect(attractorConfigFor({ motionEnergy: 0, perceptualDensity: 0 })).toEqual({ speed: 0.6, intensity: 0.4 });
        expect(attractorConfigFor({ motionEnergy: 1, perceptualDensity: 1 })).toEqual({ speed: 1.6, intensity: 0.75 });
        expect(attractorConfigFor({ motionEnergy: 0.5 })).toEqual({ speed: 1.1 });
        expect(attractorConfigFor({ perceptualDensity: 0.5 })).toEqual({ intensity: 0.575 });
    });

    it('says nothing for a dimension no renderer can express honestly', () => {
        const others = EXPERIENCE_DIMENSIONS.filter(name => name !== 'motionEnergy' && name !== 'perceptualDensity');
        expect(others.length).toBe(8);
        for (const name of others) expect(attractorConfigFor({ [name]: 1 }), name).toEqual({});
        expect(attractorConfigFor({})).toEqual({});
        expect(attractorConfigFor(undefined)).toEqual({});
    });

    it('stays inside the ranges whatever it is given', () => {
        for (const value of [-5, -0.001, 1.001, 99, Infinity, -Infinity, NaN, '0.5', null, undefined, {}, []]) {
            const config = attractorConfigFor({ motionEnergy: value, perceptualDensity: value });
            if ('speed' in config) {
                expect(config.speed).toBeGreaterThanOrEqual(ATTRACTOR_BOUNDS.speed.min);
                expect(config.speed).toBeLessThanOrEqual(ATTRACTOR_BOUNDS.speed.max);
            }
            if ('intensity' in config) {
                expect(config.intensity).toBeGreaterThanOrEqual(ATTRACTOR_BOUNDS.intensity.min);
                expect(config.intensity).toBeLessThanOrEqual(ATTRACTOR_BOUNDS.intensity.max);
            }
        }
        expect(attractorConfigFor({ motionEnergy: '0.5', perceptualDensity: NaN })).toEqual({});
    });

    it('keeps every result inside what the renderer itself would accept', () => {
        // The attractor clamps speed to 0.25 to 4 and brightness to 0.2 to 1; ours are strictly inside.
        expect(ATTRACTOR_BOUNDS.speed.min).toBeGreaterThan(0.25);
        expect(ATTRACTOR_BOUNDS.speed.max).toBeLessThan(4);
        expect(ATTRACTOR_BOUNDS.intensity.min).toBeGreaterThan(0.2);
        expect(ATTRACTOR_BOUNDS.intensity.max).toBeLessThanOrEqual(1);
    });
});

describe('adjusting a visual program', () => {
    const states = { a: { motionEnergy: 1 }, b: { motionEnergy: 1, perceptualDensity: 1 }, c: { motionEnergy: 1 }, d: { perceptualDensity: 0 } };
    const stateOf = id => states[id];

    it('adjusts an attractor cue, and only what the state can express', () => {
        const result = withExperientialState(program(), stateOf);
        expect(result.segments[0].cue).toEqual({ kind: 'field', renderer: 'attractor', config: { speed: 1.6 } });
        expect(result.segments[3].cue.config).toEqual({ system: 'thomas', palette: 'gold', intensity: 0.4 });
    });

    it('leaves what makes a visual that visual alone: its system, palette and form', () => {
        const result = withExperientialState(program(), stateOf);
        expect(result.segments[3].cue.config.system).toBe('thomas');
        expect(result.segments[3].cue.config.palette).toBe('gold');
        expect(result.segments.map(s => s.id)).toEqual(['visual-0', 'visual-1', 'visual-2', 'visual-3']);
        expect(result.segments.map(s => s.match)).toEqual(program().segments.map(s => s.match));
    });

    it('does not touch a still, or a renderer that is not an attractor, whatever their state says', () => {
        const input = program();
        const result = withExperientialState(input, stateOf);
        expect(result.segments[1]).toBe(input.segments[1]);
        expect(result.segments[2]).toBe(input.segments[2]);
        expect(result.segments[1].cue).toEqual({ kind: 'still' });
        expect(result.segments[2].cue).toEqual({ kind: 'field', renderer: 'genesis', config: { preset: 'random' } });
    });

    it('does not modify its input, and hands back the same program when there is nothing to say', () => {
        const input = program();
        const before = JSON.stringify(input);
        withExperientialState(input, stateOf);
        expect(JSON.stringify(input)).toBe(before);
        expect(withExperientialState(input, () => ({}))).toBe(input);
        expect(withExperientialState(input, () => ({ tension: 1, solemnity: 1 }))).toBe(input);
    });

    it('survives a program that is missing, or not one', () => {
        expect(withExperientialState(null, stateOf)).toBeNull();
        expect(withExperientialState(undefined, stateOf)).toBeUndefined();
        const odd = { segments: 'no' };
        expect(withExperientialState(odd, stateOf)).toBe(odd);
        const noMatch = { coordinateSpace: 'source', segments: [{ id: 'x', match: {}, cue: { kind: 'field', renderer: 'attractor', config: {} } }] };
        expect(withExperientialState(noMatch, stateOf)).toBe(noMatch);
    });

    it('is deterministic: the same state gives the same program, every time', () => {
        expect(JSON.stringify(withExperientialState(program(), stateOf))).toBe(JSON.stringify(withExperientialState(program(), stateOf)));
    });
});
