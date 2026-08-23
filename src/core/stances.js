/**
 * Stances — the first doorway over the parameter engine (NORTH-STAR §4).
 *
 * Entering a reading meant confronting four orbits at once: Visual (mode,
 * source family, presentation, focals), Audio (soundscape, preset,
 * entrainment, voice), Temporal (wpm, curve, chunk), plus the text. The engine
 * was finished; orientation was missing. A stance is a single named choice
 * that sets a coherent slice across all of them — a curated intention.
 *
 * It is NOT new machinery. Every stance is a partial of the shape
 * `createDefaultConfig()` already produces, and what it emits takes the same
 * road to the cortex as a hand-built configuration: the Orbital's persistence
 * normalizers, then `normalizeVisualConfig` in the session compiler. There is
 * still exactly one validated path, and this module is not on it — which is
 * why it holds no clamps of its own and reaches for `normalizeVisualSelection`
 * rather than writing a second answer about source families.
 *
 * THREE RULES ARE VISIBLE IN THE DATA BELOW, so read the omissions:
 *
 *   `focals` is written by NO stance. The Chapel seeds an icon or the rose and
 *   that focal belongs to the launch, so Contemplate turns the mode to focals
 *   and lets whatever is held stand. Sacred restraint by construction rather
 *   than by a check that could be forgotten.
 *
 *   `livingText` is written by NO stance. The semantic condition of the text
 *   is in the words rather than behind them, it is on by a deliberate
 *   decision, and no stance is a vote on it.
 *
 *   the source selection is written only through `emptyShelf`, and only when
 *   the reader has nothing. A reading that arrived with its own art keeps it;
 *   a stance names the surface, never the subject.
 *
 * There is no `study` stance. It would be the entry to Page mode, which the
 * arc sequences after this step, and the Orbital has no projection control for
 * it to open yet.
 */

import { normalizeVisualSelection } from './visual-selection.js';

/**
 * @typedef {object} Stance
 * @property {string} id
 * @property {string} name what the reader reads on the control
 * @property {string} line one sentence, what the posture feels like
 * @property {object} config a partial of the Orbital's config shape
 * @property {string[]} [emptyShelf] procedural engines to seed when — and only
 *   when — the reader's own visual selection is empty
 */

/** @type {readonly Stance[]} */
export const STANCES = Object.freeze([
    Object.freeze({
        id: 'plainly',
        name: 'Read plainly',
        line: 'The words, well paced, and nothing behind them.',
        config: Object.freeze({
            visualInterlocution: Object.freeze({ visualMode: 'off' }),
            wpm: 200,
            curve: 'flat',
            soundscape: 'none',
            audioPreset: 'silent'
        })
    }),
    Object.freeze({
        id: 'imagery',
        name: 'Read with imagery',
        line: 'A gallery behind the text, one work dissolving into the next.',
        config: Object.freeze({
            visualInterlocution: Object.freeze({
                visualMode: 'interlocution',
                interlocution: Object.freeze({
                    // Gallery: the one surface that never flashes and never
                    // goes black, which is why it is what a reader who asked
                    // for imagery and nothing more should meet.
                    presentation: 'continuous',
                    streamGlass: true,
                    // Contemplative rather than lively — about 22 seconds a
                    // work, so the imagery is a room and not a slideshow.
                    galleryCadence: 0.3
                })
            }),
            wpm: 180,
            // A gallery with no air is a slideshow, so this stance names a bed.
            // Aurora is synthesized, gentle, and already the calmest option.
            soundscape: 'aurora',
            audioPreset: 'silent',
            curve: 'flat'
        }),
        // Turrell Fields: a bounded aperture of soft light, almost still, no
        // line work. The procedural surface that belongs behind words, and it
        // needs no network, so "read with imagery" is honest offline too.
        emptyShelf: Object.freeze(['turrell'])
    }),
    Object.freeze({
        id: 'contemplate',
        name: 'Contemplate',
        line: 'One held focal, an unhurried pace, a soundscape.',
        config: Object.freeze({
            visualInterlocution: Object.freeze({ visualMode: 'focals' }),
            wpm: 140,
            curve: 'flat',
            soundscape: 'aurora',
            audioPreset: 'silent'
        })
    })
]);

/** The stance with this id, or null. */
export function findStance(id) {
    return STANCES.find(stance => stance.id === id) || null;
}

const asObject = value =>
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};

/**
 * The config a reader is standing in after choosing a stance.
 *
 * Merged over three known levels rather than by a generic deep merge: the
 * shape is small, fixed, and named in `createDefaultConfig`, and a recursive
 * merge would silently acquire whatever field someone adds to it next.
 *
 * @param {string} id a stance id
 * @param {object} baseConfig the configuration the reader has now
 * @returns {object} a new configuration; `baseConfig` is not modified
 */
export function applyStance(id, baseConfig) {
    const stance = findStance(id);
    // Ids come from this registry, not from a reader or a stored file, so an
    // unknown one is a wiring mistake. A doorway that quietly opened onto the
    // same room would hide it.
    if (!stance) throw new TypeError(`Unknown stance: ${JSON.stringify(id)}`);

    const base = asObject(baseConfig);
    const { visualInterlocution: patchVisual, ...scalars } = stance.config;
    const baseVisual = asObject(base.visualInterlocution);
    const baseInterlocution = asObject(baseVisual.interlocution);

    return {
        ...base,
        ...scalars,
        visualInterlocution: {
            ...baseVisual,
            ...asObject(patchVisual),
            interlocution: {
                ...baseInterlocution,
                ...asObject(asObject(patchVisual).interlocution),
                ...seedEmptyShelf(stance, baseInterlocution)
            }
        }
    };
}

/**
 * A selection for a reader who has none — or nothing at all, which is the
 * ordinary case, because most readings bring their own art or want none.
 */
function seedEmptyShelf(stance, interlocution) {
    if (!stance.emptyShelf) return {};
    const shelf = normalizeVisualSelection(interlocution);
    if (shelf.procedural.length > 0 || shelf.sourced.length > 0) return {};
    return normalizeVisualSelection({
        sourceFamily: 'procedural',
        procedural: [...stance.emptyShelf],
        sourced: []
    });
}

/**
 * The stance a configuration is standing in, or null.
 *
 * DERIVED, never stored. A remembered choice would keep claiming a posture the
 * reader had already adjusted away from, and "a stance sets, it does not lock"
 * has to be visible rather than asserted. The fields a stance does not write —
 * a reading's own collections, a held focal — are not compared, so a Chapel
 * launch under Contemplate is still standing in Contemplate.
 *
 * @param {object} config
 * @returns {string|null}
 */
export function matchStance(config) {
    const base = asObject(config);
    const baseVisual = asObject(base.visualInterlocution);
    const baseInterlocution = asObject(baseVisual.interlocution);

    const found = STANCES.find(({ config: patch }) => {
        const { visualInterlocution: patchVisual, ...scalars } = patch;
        const { interlocution: patchInterlocution, ...visualScalars } = asObject(patchVisual);
        return holds(scalars, base)
            && holds(visualScalars, baseVisual)
            && holds(asObject(patchInterlocution), baseInterlocution);
    });
    return found ? found.id : null;
}

const holds = (patch, actual) =>
    Object.entries(patch).every(([key, value]) => actual[key] === value);
