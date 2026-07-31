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
