/**
 * Catalog words (docs/plans/LIVE-CURRENT.md §25): the reader names one of RISE's own visuals while a reading plays,
 * and the venue answers at once, with no model. Pure: the words in, a local answer or null out.
 *
 * The vocabulary is the manifests' (src/scenes/manifests.js): each engine the venue shows by name, its parameters'
 * values, its cues; and the small table of aliases below. Only an utterance that is nothing but a visual request is
 * answered: catalog words and the closed list of filler. Anything else is null, and goes to the model unchanged.
 * The reader's words are untrusted: bounded, folded to plain lower-case letters, and looked up only in Maps.
 */

import { SCENE_MANIFESTS, manifestFor } from '../core/beats.js';

export const CATALOG_LIMITS = Object.freeze({ length: 120 });

/** Engines the venue never shows by name: the still draws nothing, and the face's own engine is never a reading's. */
const UNNAMED = new Set(['still', 'oracle']);

/** The aliases, in one place: a word for an engine, or for one of its parameters' values (which names the engine). */
const ALIASES = Object.freeze([
    ['fractal flame', { engine: 'living-flame' }],
    ['flame', { engine: 'living-flame' }],
    ['pendulum', { engine: 'harmonograph' }],
    ['pendulums', { engine: 'harmonograph' }],
    ['swarm', { engine: 'attractor', parameter: 'trace', value: 'swarm' }],
    ['filament', { engine: 'attractor', parameter: 'trace', value: 'filament' }],
    ['rotary', { engine: 'harmonograph', parameter: 'pendulums', value: 'rotary' }],
    ['calmer', { cue: 'calm' }],
    ['brighter', { cue: 'bright' }],
    ['warmer', { cue: 'warm' }],
    ['cooler', { cue: 'cool' }]
]);

/** The words around a request that ask for nothing themselves. */
const FILLER = Object.freeze(['show me', 'show', 'the', 'a', 'an', 'visual', 'now', 'please', 'make it', 'switch to', 'go to', 'can you', 'use']);

/** An engine as the reader is told it is shown; the rest are `the <id>`, its hyphens as spaces. */
const NAMES = Object.freeze({ rockgarden: 'the rock garden' });

/** A cue as the reader is told it was taken. */
export const CUE_SAID = Object.freeze({ calm: 'calmer', bright: 'brighter', warm: 'warmer', cool: 'cooler', surge: 'surging' });

const phrase = id => id.toLowerCase().split('-').join(' ');

/** Every phrase the recogniser knows, each with what it means; values may belong to several engines. */
const VOCABULARY = (() => {
    const known = new Map();
    const add = (words, meaning) => known.set(words, [...(known.get(words) ?? []), meaning]);
    for (const manifest of SCENE_MANIFESTS) {
        if (UNNAMED.has(manifest.id)) continue;
        add(phrase(manifest.id), { engine: manifest.id });
        for (const [parameter, spec] of Object.entries(manifest.parameters)) {
            if (spec.type === 'enum') for (const value of spec.values) add(phrase(value), { value: { engine: manifest.id, parameter, value } });
        }
        for (const cue of Object.keys(manifest.cues)) if (!known.has(cue)) add(cue, { cue });
    }
    for (const [words, meaning] of ALIASES) known.set(words, [meaning]);
    for (const words of FILLER) known.set(words, [{ filler: true }]);
    return known;
})();
const LONGEST = Math.max(...[...VOCABULARY.keys()].map(words => words.split(' ').length));

/** The reader's words as plain lower-case letters, one word apart; null for anything that is not words of them. */
function wordsOf(text) {
    if (typeof text !== 'string' || text.length > CATALOG_LIMITS.length) return null;
    const plain = text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
        .replace(/[\p{C}\p{P}\p{S}\p{Z}\s]+/gu, ' ').trim();
    const words = plain ? plain.split(' ') : [];
    return words.every(word => /^[a-z]+$/u.test(word)) ? words : null;
}

/**
 * What the reader asked for, or null to ask the model.
 * @param {unknown} words the reader's words, untrusted
 * @param {{running?: string|null}} [room] the engine on screen now
 * @returns {{engine: string, params: object, cue?: string} | {engine: string, cue: string} | null} an engine to show,
 *   with the parameters chosen (and a cue's values, when one was named beside it), or a cue on the engine running
 */
export function recogniseVisual(words, { running = null } = {}) {
    const list = wordsOf(words);
    if (!list) return null;
    const meanings = [];
    for (let at = 0; at < list.length;) {
        let found = null;
        for (let length = Math.min(LONGEST, list.length - at); length > 0 && !found; length -= 1) {
            const known = VOCABULARY.get(list.slice(at, at + length).join(' '));
            if (known) found = { known, length };
        }
        if (!found) return null;
        meanings.push(found.known);
        at += found.length;
    }
    const engines = new Set();
    const cues = new Set();
    const values = [];
    for (const known of meanings) {
        const [first] = known;
        if (first.filler) continue;
        if (first.engine) engines.add(first.engine);
        if (first.cue) cues.add(first.cue);
        if (first.parameter) values.push([first]);
        else if (first.value) values.push(known.map(meaning => meaning.value));
    }
    if (engines.size > 1 || cues.size > 1) return null;
    const [engine = null] = engines;
    const [cue = null] = cues;
    const params = {};
    for (const options of values) {
        const value = options.find(option => option.engine === engine);
        if (!value || (Object.hasOwn(params, value.parameter) && params[value.parameter] !== value.value)) return null;
        params[value.parameter] = value.value;
    }
    if (engine === null) {
        const cues = manifestFor(running)?.cues;
        return cue && !UNNAMED.has(running) && cues && Object.hasOwn(cues, cue) ? { engine: running, cue } : null;
    }
    if (cue === null) return { engine, params };
    if (engine === running && Object.keys(params).length === 0) return { engine, cue };
    const cued = manifestFor(engine).cues;
    return Object.hasOwn(cued, cue) ? { engine, params: { ...params, ...cued[cue] }, cue } : null;
}

/** An engine in the reader's words: `the attractor`, `the living flame`. */
export function catalogName(engine) {
    return NAMES[engine] ?? `the ${phrase(engine)}`;
}

/** The parameters the reader named, as words: the values they chose, not the numbers a cue stands for. */
export function chosenValues(params = {}) {
    return Object.values(params).filter(value => typeof value === 'string');
}

/** The bar's one line for a local answer: what is shown, in plain words from the catalog. */
export function catalogNote({ engine, params, cue }) {
    const name = catalogName(engine);
    if (params === undefined) return `Making ${name} ${cue === 'surge' ? 'surge' : CUE_SAID[cue] ?? cue}.`;
    const named = chosenValues(params);
    return `Showing ${name}${named.length ? ` (${named.join(', ')})` : ''}${cue ? `, ${CUE_SAID[cue] ?? cue}` : ''}.`;
}
