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
 * Registry of work-specific engine families (not cortex-general).
 * Shared render(canvas, options); new work adds a loader line here.
 * Stills held behind the reading.
 */

/** family id → () => Promise<{id, name, engineClass}[]> */
const FAMILIES = Object.freeze({
    'paradise-lost': () => import('./paradise_lost/index.js')
        .then(m => m.PARADISE_LOST_ENGINES),
    'storm-of-steel': () => import('./storm/index.js')
        .then(m => m.STORM_OF_STEEL_ENGINES)
});

/**
 * Ids, names and categories WITHOUT the classes.
 *
 * A second copy of what FAMILIES loads, and it exists because the two
 * cannot be one: the engine arrays interleave `engineClass` references,
 * so importing them synchronously would pull every generator into the
 * main bundle and undo the laziness above. Anything needing to NAME an
 * engine — the curator context, diagnostics — reads this.
 *
 * work-engines.manifest.test.js asserts this matches what each family
 * actually loads, id for id and name for name.
 */
export const WORK_ENGINE_MANIFEST = Object.freeze([
    { id: 'heaven_in_order', family: 'paradise-lost', name: '0. Heaven in Order (The Perpetual Round)', category: 'DIMENSIONAL / SPATIAL',
          description: 'Concentric rings and gates of light turning as rigid bodies — everything rotates or translates, nothing scatters, spawns or decays. The ordered state the rest of Book VI is measured against.' },
    { id: 'fall_hypercube', family: 'paradise-lost', name: '1. Fall of the Rebel Angels (Mandelbrot Abyss)', category: 'DIMENSIONAL / SPATIAL',
          description: 'A kaleidoscopic attractor above a falling red region textured with Mandelbrot and Julia sets, the divine bloom melting into the abyss with no horizon between them.' },
    { id: 'chariot_deity', family: 'paradise-lost', name: '2. Chariot of Paternal Deity (Ezekiel Wheels)', category: 'DIMENSIONAL / SPATIAL',
          description: 'Multi-ringed 3D strange attractors, wheel within wheel after Ezekiel, pulsing in sapphire and gold with lightning across them.' },
    { id: 'flaming_sword', family: 'paradise-lost', name: '3. St. Michael\'s Flaming Sword (3D Inscribed)', category: 'DIMENSIONAL / SPATIAL',
          description: 'A shaded 3D sword — winged crossguard, central fuller, tapered double edge — carrying Latin inscriptions along the blade. The most figurative of these surfaces.' },
    { id: 'sulfur_magma', family: 'paradise-lost', name: '4. Sulfur & Brimstone Magma Network (Voronoi)', category: 'DIMENSIONAL / SPATIAL',
          description: 'Branching rivers of magma creeping through cracked basalt crust, deep crimson underglow beneath lava-orange streams. Slow, viscous, and dark rather than bright.' },
    { id: 'dark_ocean_chaos', family: 'paradise-lost', name: '5. The Dark Ocean of Chaos (Cosmic Flow Fields)', category: 'DIMENSIONAL / SPATIAL',
          description: 'Divergence-free curl-noise flow: incompressible streams wandering an unbounded dark field, primordial and directionless. Continuous motion with no figure in it.' },
    { id: 'voronoi', family: 'storm-of-steel', name: '1. Voronoi Trench Network', category: 'GEOMETRIC / STRUCTURAL',
          description: 'Space divided into cell-like trench perimeters — mud fractures, barbed wire and shell craters as a hard tessellation. Angular and graphic.' },
    { id: 'flowfield', family: 'storm-of-steel', name: '2. Steel Shrapnel Flow Field', category: 'ORGANIC / NATURAL',
          description: 'Thousands of high-velocity particles following curl-noise vectors: tracer sparks, ricochets and iron dust drawn across open ground. Fast and directional.' },
    { id: 'attractor', family: 'storm-of-steel', name: '3. Drumfire Strange Attractor', category: 'DIMENSIONAL / SPATIAL',
          description: 'Lorenz, Clifford, De Jong and Aizawa attractors traced as fine continuous line — sustained drumfire as mathematics rather than as picture.' },
    { id: 'flare_phosphene', family: 'storm-of-steel', name: '5. Magnesium Flare & Phosphenes', category: 'PERCEPTUAL / PHENOMENOLOGICAL',
          description: 'A magnesium star-shell hanging over the parapet, with the lattices, spirals and tunnels the eye makes under that light. Blinding centre, afterimage at the edges.' },
    { id: 'spirograph', family: 'storm-of-steel', name: '6. Ballistic Trajectory Spirograph', category: 'GEOMETRIC / STRUCTURAL',
          description: 'Lissajous and harmonograph arcs plotting shell flight paths and counter-battery geometry. Thin, precise, almost diagrammatic.' },
    { id: 'incendiary_blast', family: 'storm-of-steel', name: '7. Incendiary Shell Blast', category: 'DIMENSIONAL / SPATIAL',
          description: 'A lit 3D terrain heightfield deformed in real time by impacts — craters with raised ejecta rims, molten cores, shrapnel streaks and smoke. The heaviest and most three-dimensional of the set.' },
    { id: 'ascii_soldier', family: 'storm-of-steel', name: '8. ASCII Trench & Soldier Art', category: 'SYMBOLIC / NOTATIONAL',
          description: 'A front-line soldier and the wire, trees and sandbags around him, drawn entirely from ASCII and Unicode characters. Typographic; reads as text before it reads as picture.' }
].map(Object.freeze));

/** The work a named engine was authored for, or null if it is general. */
export function workEngineFamilyOf(engineId) {
    return WORK_ENGINE_MANIFEST.find(entry => entry.id === engineId)?.family || null;
}

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
 * The Page resolves imagery by opaque collection id; Journey figures name
 * engines. Use these helpers at both ends — do not hand-format the id.
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
