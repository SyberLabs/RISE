/**
 * STORM OF STEEL (Ernst Jünger) — Visual Pattern Engines Catalog
 * 
 * 8 Specialized Procedural Generation Engines interpreting high-intensity mechanical warfare,
 * trench geometry, ballistic vectors, chemical clouds, entoptic flare phenomena, and ASCII soldier art.
 */

import { StormVoronoiEngine } from './StormVoronoiEngine.js';
import { StormFlowFieldEngine } from './StormFlowFieldEngine.js';
import { StormAttractorEngine } from './StormAttractorEngine.js';
import { StormReactionDiffusionEngine } from './StormReactionDiffusionEngine.js';
import { StormFlarePhospheneEngine } from './StormFlarePhospheneEngine.js';
import { StormBallisticSpirographEngine } from './StormBallisticSpirographEngine.js';
import { StormIncendiaryBlastEngine } from './StormIncendiaryBlastEngine.js';
import { StormAsciiEngine } from './StormAsciiEngine.js';

export {
    StormVoronoiEngine,
    StormFlowFieldEngine,
    StormAttractorEngine,
    StormReactionDiffusionEngine,
    StormFlarePhospheneEngine,
    StormBallisticSpirographEngine,
    StormIncendiaryBlastEngine,
    StormAsciiEngine
};

export const STORM_OF_STEEL_ENGINES = [
    { id: 'voronoi', name: '1. Voronoi Trench Network', engineClass: StormVoronoiEngine, category: 'GEOMETRIC / STRUCTURAL' },
    { id: 'flowfield', name: '2. Steel Shrapnel Flow Field', engineClass: StormFlowFieldEngine, category: 'ORGANIC / NATURAL' },
    { id: 'attractor', name: '3. Drumfire Strange Attractor', engineClass: StormAttractorEngine, category: 'DIMENSIONAL / SPATIAL' },

    // 4. MUSTARD GAS TURING PATTERNS — WITHHELD, not deleted.
    //
    // StormReactionDiffusionEngine still exists and is still exported
    // above; it simply is not published. Reaction-diffusion resolves at
    // the grid it simulates on, and behind a full-bleed reading at DPR 2
    // that grid is visible as pixellation rather than as gas.
    //
    // Withheld HERE, in the registry, and nowhere else. The living
    // field, the gallery, Page mode, the Journey compiler and the
    // Demonstration all draw their vocabulary from this array, so
    // removing the line removes the engine everywhere by construction.
    // An exclusion list kept beside the registry would be a seventh copy
    // of a vocabulary this codebase has already been bitten by six
    // times, and every one of those failures was silent.
    //
    // The gap in the numbering is deliberate: it records that a fourth
    // engine exists and is being held back. Restoring it is this line.

    { id: 'flare_phosphene', name: '5. Magnesium Flare & Phosphenes', engineClass: StormFlarePhospheneEngine, category: 'PERCEPTUAL / PHENOMENOLOGICAL' },
    { id: 'spirograph', name: '6. Ballistic Trajectory Spirograph', engineClass: StormBallisticSpirographEngine, category: 'GEOMETRIC / STRUCTURAL' },
    { id: 'incendiary_blast', name: '7. Incendiary Shell Blast', engineClass: StormIncendiaryBlastEngine, category: 'DIMENSIONAL / SPATIAL' },
    { id: 'ascii_soldier', name: '8. ASCII Trench & Soldier Art', engineClass: StormAsciiEngine, category: 'SYMBOLIC / NOTATIONAL' }
];

export function createStormEngine(engineId) {
    const entry = STORM_OF_STEEL_ENGINES.find(e => e.id === engineId) || STORM_OF_STEEL_ENGINES[0];
    return new entry.engineClass();
}
