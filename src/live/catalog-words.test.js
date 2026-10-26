/**
 * Catalog words (docs/plans/LIVE-CURRENT.md §25): the reader names one of RISE's own visuals, and the venue answers at
 * once with no model. Only an utterance that is nothing but a visual request is answered; anything else is null and
 * goes to the model unchanged.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG_LIMITS, catalogNote, recogniseVisual } from './catalog-words.js';
import { SCENE_MANIFESTS } from '../core/beats.js';

const heard = (words, running = null) => recogniseVisual(words, { running });

describe('an engine, by its name or an alias', () => {
    it('answers every engine the venue shows by name, with no parameters', () => {
        for (const engine of ['attractor', 'genesis', 'fractal', 'turrell', 'neural', 'rockgarden', 'harmonograph', 'ostensoria', 'apparitio']) {
            expect(heard(engine)).toEqual({ engine, params: {} });
        }
        expect(heard('living flame')).toEqual({ engine: 'living-flame', params: {} });
        expect(heard('living-flame')).toEqual({ engine: 'living-flame', params: {} });
    });

    it('takes every alias in the table', () => {
        expect(heard('fractal flame')).toEqual({ engine: 'living-flame', params: {} });
        expect(heard('flame')).toEqual({ engine: 'living-flame', params: {} });
        expect(heard('pendulum')).toEqual({ engine: 'harmonograph', params: {} });
        expect(heard('pendulums')).toEqual({ engine: 'harmonograph', params: {} });
        expect(heard('swarm')).toEqual({ engine: 'attractor', params: { trace: 'swarm' } });
        expect(heard('filament')).toEqual({ engine: 'attractor', params: { trace: 'filament' } });
        expect(heard('rotary')).toEqual({ engine: 'harmonograph', params: { pendulums: 'rotary' } });
        expect(heard('klee')).toEqual({ engine: 'genesis', params: {} });
        expect(heard('show me klee lines')).toEqual({ engine: 'genesis', params: {} });
        expect(heard('night streaks')).toEqual({ engine: 'attractor', params: { streaks: 'night' } });
        expect(heard('show me the streaks')).toEqual({ engine: 'attractor', params: { streaks: 'night' } });
    });

    it('names the Reader’s catalog entries the room draws under another name: Klee as Genesis, night streaks under the attractor', () => {
        expect(heard('night attractor')).toEqual({ engine: 'attractor', params: { streaks: 'night' } });
        expect(heard('halvorsen attractor night streaks')).toEqual({ engine: 'attractor', params: { system: 'halvorsen', streaks: 'night' } });
        expect(heard('chaotic klee')).toEqual({ engine: 'genesis', params: { preset: 'chaotic' } });
        expect(heard('night streaks harmonograph')).toBeNull();
        expect(heard('night')).toBeNull();
        expect(catalogNote({ engine: 'attractor', params: { streaks: 'night' } })).toBe('Showing the attractor (night).');
    });

    it('never matches the still, or the face’s own engine', () => {
        expect(heard('still')).toBeNull();
        expect(heard('oracle')).toBeNull();
        expect(heard('show me the still')).toBeNull();
        expect(heard('oracle', 'attractor')).toBeNull();
    });
});

describe('parameters with their engine', () => {
    it('sets a system or a palette named beside the attractor', () => {
        expect(heard('attractor thomas')).toEqual({ engine: 'attractor', params: { system: 'thomas' } });
        expect(heard('the halvorsen attractor')).toEqual({ engine: 'attractor', params: { system: 'halvorsen' } });
        expect(heard('gold attractor')).toEqual({ engine: 'attractor', params: { palette: 'gold' } });
        expect(heard('jade aizawa attractor swarm')).toEqual({ engine: 'attractor', params: { palette: 'jade', system: 'aizawa', trace: 'swarm' } });
        expect(heard('harmonograph rotary')).toEqual({ engine: 'harmonograph', params: { pendulums: 'rotary' } });
        expect(heard('lateral pendulums')).toEqual({ engine: 'harmonograph', params: { pendulums: 'lateral' } });
    });

    it('refuses a value without its engine, a value of another engine, and two values for one parameter', () => {
        expect(heard('gold')).toBeNull();
        expect(heard('thomas')).toBeNull();
        expect(heard('harmonograph swarm')).toBeNull();
        expect(heard('attractor thomas aizawa')).toBeNull();
        expect(heard('attractor swarm filament')).toBeNull();
    });

    it('refuses two engines at once', () => {
        expect(heard('attractor fractal')).toBeNull();
        expect(heard('swarm rotary')).toBeNull();
    });
});

describe('cues on the running engine', () => {
    it('answers a cue the running engine takes', () => {
        expect(heard('calmer', 'attractor')).toEqual({ engine: 'attractor', cue: 'calm' });
        expect(heard('calm', 'living-flame')).toEqual({ engine: 'living-flame', cue: 'calm' });
        expect(heard('brighter', 'attractor')).toEqual({ engine: 'attractor', cue: 'bright' });
        expect(heard('warmer', 'living-flame')).toEqual({ engine: 'living-flame', cue: 'warm' });
        expect(heard('cooler', 'living-flame')).toEqual({ engine: 'living-flame', cue: 'cool' });
        expect(heard('surge', 'living-flame')).toEqual({ engine: 'living-flame', cue: 'surge' });
        expect(heard('make it calmer please', 'attractor')).toEqual({ engine: 'attractor', cue: 'calm' });
    });

    it('is null for a cue the running engine does not take, or with nothing running', () => {
        expect(heard('warmer', 'attractor')).toBeNull();
        expect(heard('brighter', 'living-flame')).toBeNull();
        expect(heard('calmer', 'harmonograph')).toBeNull();
        expect(heard('calmer')).toBeNull();
        expect(heard('calmer', 'still')).toBeNull();
    });

    it('starts a named engine with the cue’s values, and takes the cue on the engine already running', () => {
        expect(heard('calmer attractor', 'living-flame')).toEqual({ engine: 'attractor', params: { intensity: 0.45 }, cue: 'calm' });
        expect(heard('warmer flame', 'attractor')).toEqual({ engine: 'living-flame', params: { hue: 30 }, cue: 'warm' });
        expect(heard('calmer attractor', 'attractor')).toEqual({ engine: 'attractor', cue: 'calm' });
        expect(heard('warmer attractor', 'living-flame')).toBeNull();
        expect(heard('calmer brighter', 'attractor')).toBeNull();
    });
});

describe('only a visual request, and nothing else', () => {
    it('takes the closed list of filler, and punctuation', () => {
        expect(heard('Show me the attractor.')).toEqual({ engine: 'attractor', params: {} });
        expect(heard('show the attractor now, please!')).toEqual({ engine: 'attractor', params: {} });
        expect(heard('Switch to a fractal flame')).toEqual({ engine: 'living-flame', params: {} });
        expect(heard('go to the harmonograph visual')).toEqual({ engine: 'harmonograph', params: {} });
        expect(heard('can you use an attractor?')).toEqual({ engine: 'attractor', params: {} });
        expect(heard('“Attractor” — please…')).toEqual({ engine: 'attractor', params: {} });
    });

    it('sends anything else to the model unchanged', () => {
        expect(heard('attractor, and why does it never repeat?')).toBeNull();
        expect(heard('what is an attractor')).toBeNull();
        expect(heard('show me something calmer', 'attractor')).toBeNull();
        expect(heard('make the attractor')).toBeNull();
        expect(heard('can attractor')).toBeNull();
        expect(heard('calmer and warmer', 'living-flame')).toBeNull();
        expect(heard('attractor attractor')).toEqual({ engine: 'attractor', params: {} });
    });

    it('is null for nothing but filler, and for no words at all', () => {
        for (const words of ['', '   ', 'show me', 'please', 'the visual now', '?!', null, undefined, 42, {}]) expect(heard(words)).toBeNull();
    });
});

describe('untrusted words', () => {
    it('is case-insensitive and folds accents and full-width letters', () => {
        expect(heard('ATTRACTOR')).toEqual({ engine: 'attractor', params: {} });
        expect(heard('Áttráctor')).toEqual({ engine: 'attractor', params: {} });
        expect(heard('ａｔｔｒａｃｔｏｒ')).toEqual({ engine: 'attractor', params: {} });
        expect(heard('CALMER', 'attractor')).toEqual({ engine: 'attractor', cue: 'calm' });
    });

    it('is null past its bound, and for words with hidden characters between letters', () => {
        expect(heard(`show me the attractor${' '.repeat(CATALOG_LIMITS.length)}`)).toBeNull();
        expect(heard('attr​actor')).toBeNull();
        expect(heard('attractor\u0000')).toEqual({ engine: 'attractor', params: {} });
    });

    it('never takes an inherited name as a word', () => {
        for (const words of ['constructor', '__proto__', 'toString', 'hasOwnProperty attractor']) expect(heard(words, 'attractor')).toBeNull();
    });
});

describe('the note in the bar', () => {
    it('says what is shown in plain words from the catalog', () => {
        expect(catalogNote({ engine: 'attractor', params: {} })).toBe('Showing the attractor.');
        expect(catalogNote({ engine: 'attractor', params: { trace: 'swarm' } })).toBe('Showing the attractor (swarm).');
        expect(catalogNote({ engine: 'living-flame', params: {} })).toBe('Showing the living flame.');
        expect(catalogNote({ engine: 'rockgarden', params: {} })).toBe('Showing the rock garden.');
        expect(catalogNote({ engine: 'attractor', cue: 'calm' })).toBe('Making the attractor calmer.');
        expect(catalogNote({ engine: 'living-flame', cue: 'surge' })).toBe('Making the living flame surge.');
        expect(catalogNote({ engine: 'attractor', params: { intensity: 0.45 }, cue: 'calm' })).toBe('Showing the attractor, calmer.');
    });

    it('names each engine as the Reader’s catalog does: a common noun with “the”, a proper name without', () => {
        const said = Object.fromEntries(SCENE_MANIFESTS.filter(({ id }) => id !== 'still' && id !== 'oracle').map(({ id }) => [id, catalogNote({ engine: id, params: {} })]));
        expect(said).toEqual({
            attractor: 'Showing the attractor.',
            genesis: 'Showing Genesis.',
            'living-flame': 'Showing the living flame.',
            fractal: 'Showing the fractal.',
            turrell: 'Showing Turrell Fields.',
            neural: 'Showing the neural network.',
            rockgarden: 'Showing the rock garden.',
            harmonograph: 'Showing the harmonograph.',
            ostensoria: 'Showing Ostensoria.',
            apparitio: 'Showing Apparitio.'
        });
        expect(catalogNote({ engine: 'genesis', cue: 'calm' })).toBe('Making Genesis calmer.');
    });
});
