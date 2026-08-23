/**
 * STORM OF STEEL (Ernst Jünger) — Visual Pattern Engines Catalog
 * 
 * 7 published procedural engines (of 8 authored) interpreting high-intensity mechanical warfare,
 * trench geometry, ballistic vectors, chemical clouds, entoptic flare phenomena, and ASCII soldier art.
 */

import { STORM_OF_STEEL_ENGINE_META } from './engines.meta.js';
import { StormVoronoiEngine } from './StormVoronoiEngine.js';
import { StormFlowFieldEngine } from './StormFlowFieldEngine.js';
import { StormAttractorEngine } from './StormAttractorEngine.js';
import { StormFlarePhospheneEngine } from './StormFlarePhospheneEngine.js';
import { StormBallisticSpirographEngine } from './StormBallisticSpirographEngine.js';
import { StormIncendiaryBlastEngine } from './StormIncendiaryBlastEngine.js';
import { StormAsciiEngine } from './StormAsciiEngine.js';

export {
    StormVoronoiEngine,
    StormFlowFieldEngine,
    StormAttractorEngine,
    StormFlarePhospheneEngine,
    StormBallisticSpirographEngine,
    StormIncendiaryBlastEngine,
    StormAsciiEngine
};

/**
 * The engines, named by engines.meta.js and drawn by the classes above.
 *
 * 4. MUSTARD GAS TURING PATTERNS — WITHHELD, not deleted.
 *
 * StormReactionDiffusionEngine still exists on disk. Reaction-diffusion
 * resolves at the grid it simulates on, and behind a full-bleed reading at
 * DPR 2 that grid reads as pixellation rather than as gas.
 *
 * IT IS NO LONGER IMPORTED. Withholding it from the array alone withheld
 * it from the field, the gallery, the Page, the Journey and the
 * Demonstration — but the import still pulled its 190 lines into the
 * family chunk, so every reader who opened Under Steel downloaded 2,562
 * bytes (684 gzipped) of an engine nothing could select. A runtime filter
 * cannot remove a build-time dependency; the import was the dependency.
 *
 * The gap in numbering is deliberate. To restore: add the import back, add
 * its entry to engines.meta.js, and add the class here.
 */
const CLASSES = {
    voronoi: StormVoronoiEngine,
    flowfield: StormFlowFieldEngine,
    attractor: StormAttractorEngine,
    flare_phosphene: StormFlarePhospheneEngine,
    spirograph: StormBallisticSpirographEngine,
    incendiary_blast: StormIncendiaryBlastEngine,
    ascii_soldier: StormAsciiEngine
};

export const STORM_OF_STEEL_ENGINES = STORM_OF_STEEL_ENGINE_META.map(entry => ({
    ...entry,
    engineClass: CLASSES[entry.id]
}));

export function createStormEngine(engineId) {
    const entry = STORM_OF_STEEL_ENGINES.find(e => e.id === engineId) || STORM_OF_STEEL_ENGINES[0];
    return new entry.engineClass();
}
