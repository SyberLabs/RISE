/**
 * Looks: one preset vocabulary over the parameter engine.
 *
 * A look is one named choice of field, colour, sound and typography. Like a
 * stance (ARCHITECTURE §8.26) it is a partial of the configuration the Orbital
 * already builds, and what it emits takes the same road as a hand-built
 * configuration: the Orbital's persistence normalizers, `normalizeVisualConfig`
 * in the session compiler, and the presentation gates in
 * session-presentation.js. This module is not on that road, so it holds no
 * clamps of its own, and every value below is one those gates admit unchanged.
 *
 * WHAT NO LOOK WRITES, visible in the data below:
 *
 *   `focals` and `livingText`. A launch's held focal belongs to the launch,
 *   and the semantic condition of the text is the reader's.
 *
 *   `wpm` and `curve`. Pace and rhythm are separate choices. Inlay alone sets
 *   `chunkMode`, because it paints one word at a time by mechanism.
 *
 *   the source selection, except through an empty shelf. `engines` names what
 *   the field draws, and only a Gallery field seeds them, only into a shelf
 *   that holds nothing, and only those the shelf admits. Living Flame is not
 *   a shelf engine: Follow text draws it over a continuous Gallery whose shelf
 *   is empty (passage-visuals/reading-state.js).
 *
 * WHICH LOOK A CONFIGURATION IS IN is derived by `lookOf`, never stored. A look
 * holds when every field its `config` writes has that value; nothing else is
 * compared. So a reading's own collections, a held focal, pace, curve and
 * (outside Inlay) rhythm never change the answer. A configuration that claims
 * no presentation reads in the reader's own face, size and colours, and is
 * judged by its field and sound alone.
 */

import { jevColors } from './jev-palette.js';
import { normalizeVisualSelection } from './visual-selection.js';

/**
 * @typedef {object} Look
 * @property {string} id
 * @property {string} name what the reader reads on the control
 * @property {string} line one sentence, what the look feels like
 * @property {object} config a partial of the Orbital's config shape
 * @property {string[]} engines ENGINE_CATALOG ids the field draws
 * @property {number} [maxViewportWidth] widest screen, in CSS pixels, a
 *   surface may offer the look on
 */

const presentation = (chamberFace, fontSize, theme) => Object.freeze({
    chamberFace,
    fontSize,
    colorTheme: theme,
    textColor: theme,
    backgroundColor: theme,
    colors: Object.freeze(jevColors(theme, theme, theme))
});

const gallery = interlocution => Object.freeze({
    visualMode: 'interlocution',
    interlocution: Object.freeze({ presentation: 'continuous', streamGlass: true, ...interlocution })
});

const look = (id, name, line, config, engines, extra = {}) => Object.freeze({
    id,
    name,
    line,
    config: Object.freeze({ audioPreset: 'silent', ...config }),
    engines: Object.freeze(engines),
    ...extra
});

/** @type {readonly Look[]} */
export const LOOKS = Object.freeze([
    look('plain', 'Plain', 'The words, and nothing behind them.', {
        visualInterlocution: Object.freeze({ visualMode: 'off' }),
        soundscape: 'none',
        presentation: presentation('book', 'large', 'classic')
    }, []),
    look('gallery', 'Gallery', 'A gallery behind the text, one work dissolving into the next.', {
        visualInterlocution: gallery({ galleryCadence: 0.3 }),
        soundscape: 'aurora',
        presentation: presentation('literary', 'medium', 'classic')
    }, ['turrell']),
    look('nocturne', 'Nocturne', 'Soft light at a slow cadence, under rain.', {
        visualInterlocution: gallery({ galleryCadence: 0.15 }),
        soundscape: 'soft-rain',
        presentation: presentation('literary', 'medium', 'amethyst')
    }, ['turrell', 'harmonograph']),
    look('garden', 'Garden', 'A composition growing behind the words, with piano.', {
        visualInterlocution: Object.freeze({ visualMode: 'genesis' }),
        soundscape: 'piano',
        presentation: presentation('literary', 'medium', 'jade')
    }, ['klee']),
    look('flame', 'Flame', 'A living flame behind the text, breathing with it.', {
        visualInterlocution: gallery({}),
        soundscape: 'wonder',
        presentation: presentation('display', 'large', 'ember')
    }, ['living-flame']),
    look('signal', 'Signal', 'A strange attractor circling the words, and a faded signal.', {
        visualInterlocution: Object.freeze({ visualMode: 'attractor' }),
        soundscape: 'faded-signal',
        presentation: presentation('mono', 'large', 'cobalt')
    }, ['attractor']),
    look('iris', 'Iris', 'Spectral plates turning behind the text, and a rising theme.', {
        visualInterlocution: gallery({ galleryCadence: 0.5 }),
        soundscape: 'triumph',
        presentation: presentation('display', 'large', 'rose')
    }, ['ostensoria', 'apparitio']),
    look('revel', 'Revel', 'Fractal flames at a lively cadence, and a chase.', {
        visualInterlocution: gallery({ galleryCadence: 0.85 }),
        soundscape: 'chase',
        presentation: presentation('thick', 'xlarge', 'prism')
    }, ['fractal']),
    look('vigil', 'Vigil', 'One held image, and a soundscape beneath it.', {
        visualInterlocution: Object.freeze({ visualMode: 'focals' }),
        soundscape: 'aurora',
        presentation: presentation('display', 'large', 'amethyst')
    }, []),
    look('inlay', 'Inlay', 'The imagery inside each word, one word at a time.', {
        visualInterlocution: gallery({
            galleryCadence: 0.3,
            wordFill: Object.freeze({ mode: 'same', border: 'cream' })
        }),
        soundscape: 'aurora',
        chunkMode: 'word',
        presentation: presentation('thick', 'fit', 'classic')
    }, ['fractal'], { maxViewportWidth: 820 })
]);

/** The look each roll temper becomes. */
export const TEMPER_LOOKS = Object.freeze({
    nocturne: 'nocturne',
    plainsong: 'plain',
    signal: 'signal',
    ember: 'iris',
    garden: 'garden',
    vigil: 'vigil',
    revel: 'revel',
    salon: 'garden'
});

/** The look each Reader setup stance becomes. */
export const STANCE_LOOKS = Object.freeze({
    plainly: 'plain',
    imagery: 'gallery',
    contemplate: 'vigil'
});

const asObject = value =>
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};

/**
 * The config a reader is in after choosing a look.
 *
 * Merged over the known levels rather than by a generic deep merge, so a
 * field added to the config shape later is never acquired silently.
 *
 * @param {object} baseConfig the configuration the reader has now
 * @param {string} id a look id
 * @returns {object} a new configuration; `baseConfig` is not modified
 */
export function applyLook(baseConfig, id) {
    const found = LOOKS.find(entry => entry.id === id);
    // Ids come from this registry, never from a reader or a stored file, so an
    // unknown one is a wiring mistake.
    if (!found) throw new TypeError(`Unknown look: ${JSON.stringify(id)}`);

    const base = asObject(baseConfig);
    const { visualInterlocution: patchVisual, presentation: patchPresentation, ...scalars } = found.config;
    const baseVisual = asObject(base.visualInterlocution);
    const baseInterlocution = asObject(baseVisual.interlocution);

    return {
        ...base,
        ...scalars,
        presentation: { ...asObject(base.presentation), ...patchPresentation },
        visualInterlocution: {
            ...baseVisual,
            ...patchVisual,
            interlocution: {
                ...baseInterlocution,
                ...asObject(patchVisual.interlocution),
                ...seedEmptyShelf(found, baseInterlocution)
            }
        }
    };
}

function seedEmptyShelf(found, interlocution) {
    if (found.config.visualInterlocution.visualMode !== 'interlocution') return {};
    const shelf = normalizeVisualSelection(interlocution);
    if (shelf.procedural.length > 0 || shelf.sourced.length > 0) return {};
    return normalizeVisualSelection({ sourceFamily: 'procedural', procedural: [...found.engines], sourced: [] });
}

/**
 * The look a configuration is in, or 'custom'.
 *
 * @param {object} config
 * @returns {string}
 */
export function lookOf(config) {
    const base = asObject(config);
    const found = LOOKS.find(({ config: patch }) => {
        const { presentation: patchPresentation, ...rest } = patch;
        return holds(rest, base)
            && (base.presentation == null || holds(patchPresentation, base.presentation));
    });
    return found ? found.id : 'custom';
}

const holds = (patch, actual) => Object.entries(patch).every(([key, value]) =>
    value && typeof value === 'object'
        ? holds(value, asObject(actual[key]))
        : actual[key] === value);
