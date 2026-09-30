/**
 * STORM OF STEEL (Ernst Jünger) — Visual Pattern Engines Catalog
 * 
 * 7 procedural engines interpreting high-intensity mechanical warfare,
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
 * The numbering gap at 4 is deliberate: Mustard Gas Turing Patterns was
 * withheld and its engine deleted.
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
