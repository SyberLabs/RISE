/**
 * Procedural engine families authored FOR a particular work.
 *
 * The cortex's own generators — klee, turrell, fractal, harmonograph —
 * are general: they answer a mood or a signal and belong to no text.
 * These are the opposite. Five engines exist because Milton's Book VI
 * has a chariot, a flaming sword, and a fall; eight exist because
 * Jünger's war is trench geometry, ballistic vectors, gas diffusion and
 * flare phosphenes. They are readings of a specific book.
 *
 * WHY THEY ARE A REGISTRY AND NOT THIRTEEN BRANCHES
 * ────────────────────────────────────────────────
 * Every one of them shares a single method — `render(canvas, options)` —
 * so the cortex needs to know that a family EXISTS, not what any member
 * of it draws. A new work arriving with its own engines adds a line
 * here and nothing anywhere else, which is what keeps the cortex
 * domain-blind while the imagery gets more specific.
 *
 * They are stills rather than loops. One render fills the field and the
 * gallery holds it behind the reading, which is what a procedural
 * accompaniment should be: a place the words happen in, not a thing
 * competing with them for motion.
 */

/** family id → () => Promise<{id, name, engineClass}[]> */
const FAMILIES = Object.freeze({
    'paradise-lost': () => import('./paradise_lost/index.js')
        .then(m => m.PARADISE_LOST_ENGINES),
    'storm-of-steel': () => import('./storm/index.js')
        .then(m => m.STORM_OF_STEEL_ENGINES)
});

const cache = new Map();

/** Is this a family authored for a work? */
export function isWorkEngineFamily(id) {
    return Object.hasOwn(FAMILIES, id);
}

/** Every family id, for diagnostics and for the config's type list. */
export function workEngineFamilies() {
    return Object.keys(FAMILIES);
}

/**
 * The engines of one family, loaded once.
 *
 * Lazily, because a reading that never enters Under Steel should not
 * download eight ways of drawing a bombardment.
 */
export async function loadWorkEngines(familyId) {
    if (!isWorkEngineFamily(familyId)) return [];
    if (cache.has(familyId)) return cache.get(familyId);
    try {
        const engines = await FAMILIES[familyId]();
        const list = Array.isArray(engines) ? engines : [];
        cache.set(familyId, list);
        return list;
    } catch (error) {
        // Reverent degradation: a family that will not load leaves the
        // field still. It never falls back to a general generator,
        // because a Klee flash is not a reading of Paradise Lost.
        console.warn(`[WorkEngines] ${familyId} unavailable:`, error?.message || error);
        cache.set(familyId, []);
        return [];
    }
}

/**
 * Draw one engine from a family onto a canvas.
 *
 * `index` selects deterministically so a movement can walk its family
 * rather than re-rolling the same still: the caller advances it.
 *
 * @returns {Promise<boolean>} whether anything was drawn
 */
export async function renderWorkEngine(familyId, canvas, index = 0, options = {}) {
    if (!canvas) return false;
    const engines = await loadWorkEngines(familyId);
    if (!engines.length) return false;

    const entry = engines[Math.abs(index) % engines.length];
    try {
        const engine = new entry.engineClass();
        const result = engine.render(canvas, options);
        // Some engines report, some just draw. Absence of `false` is
        // taken as success; an exception is not.
        return result !== false;
    } catch (error) {
        console.warn(`[WorkEngines] ${familyId}/${entry.id} failed:`, error?.message || error);
        return false;
    }
}

/**
 * PAGE MODE ASKS FOR ONE ENGINE, NOT A FAMILY.
 *
 * The Page resolves imagery by an opaque collection id, and a Journey's
 * figures each name their own engine — so "paradise-lost" alone is not
 * enough to put the flaming sword beside Michael's sword. The id
 * therefore carries both, and BOTH ENDS USE THESE FUNCTIONS rather than
 * writing the format by hand. That rule is not fussiness: a vocabulary
 * kept in two places has failed six times in this codebase, and every
 * time it was silent.
 */
const PAGE_ID_SEPARATOR = '::';

export function pageCollectionId(familyId, engineId = '') {
    return engineId ? `${familyId}${PAGE_ID_SEPARATOR}${engineId}` : String(familyId);
}

/** @returns {{familyId: string, engineId: string}|null} null when not a work family */
export function parsePageCollectionId(id) {
    const [familyId, engineId = ''] = String(id ?? '').split(PAGE_ID_SEPARATOR);
    return isWorkEngineFamily(familyId) ? { familyId, engineId } : null;
}

/**
 * The step used when winding an engine forward to a sampled moment.
 * Coarser than a real frame because nobody is watching the intermediate
 * states — but not so coarse that an integrator diverges from what the
 * live field would have shown.
 */
const SAMPLE_STEP_SECONDS = 1 / 24;

/**
 * One engine, at one moment of its life, as an immutable image.
 *
 * The Page has no clock — that is its whole premise — so a living field
 * has to be translated rather than embedded. The Chamber already
 * decided how: Genesis and the attractor are sampled at evenly spaced
 * states because "a single still would misrepresent them", and their
 * honest spatial translation is a SEQUENCE. Work engines are the same
 * kind of thing and get the same treatment.
 *
 * @param {string} familyId
 * @param {string} engineId  '' takes the family's first engine
 * @param {number} atSeconds how far into its life to sample
 */
export async function sampleWorkEngine(familyId, engineId, atSeconds, {
    width = 1200, height = 800, timeScale = 1
} = {}) {
    const engines = await loadWorkEngines(familyId);
    if (!engines.length) return null;
    const entry = (engineId && engines.find(e => e.id === engineId)) || engines[0];

    let canvas;
    try {
        canvas = typeof OffscreenCanvas === 'function'
            ? new OffscreenCanvas(width, height)
            : Object.assign(document.createElement('canvas'), { width, height });
    } catch {
        return null;
    }

    try {
        const engine = new entry.engineClass();
        engine.generate?.({}, `${familyId}-${entry.id}-page`);
        // Wind it forward. Engines integrate, so the state at t is not
        // recoverable by assigning t — it has to be walked to.
        const target = Math.max(0, atSeconds) * timeScale;
        for (let t = 0; t < target; t += SAMPLE_STEP_SECONDS) {
            engine.step?.(Math.min(SAMPLE_STEP_SECONDS, target - t), {});
        }
        if (engine.render(canvas, { width, height }) === false) return null;

        if (typeof canvas.toDataURL === 'function') {
            return canvas.toDataURL('image/webp', 0.9);
        }
        // OffscreenCanvas has no toDataURL; convert its blob instead.
        const blob = await canvas.convertToBlob?.({ type: 'image/webp', quality: 0.9 });
        if (!blob) return null;
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.warn(`[WorkEngines] ${familyId}/${entry.id} would not sample:`,
            error?.message || error);
        return null;
    }
}
