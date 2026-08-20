/**
 * STORM OF STEEL (Ernst Jünger) — Visual Pattern Engines Catalog
 * 
 * 7 published procedural engines (of 8 authored) interpreting high-intensity mechanical warfare,
 * trench geometry, ballistic vectors, chemical clouds, entoptic flare phenomena, and ASCII soldier art.
 */

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

export const STORM_OF_STEEL_ENGINES = [
    { id: 'voronoi', name: '1. Voronoi Trench Network', engineClass: StormVoronoiEngine, category: 'GEOMETRIC / STRUCTURAL' },
    { id: 'flowfield', name: '2. Steel Shrapnel Flow Field', engineClass: StormFlowFieldEngine, category: 'ORGANIC / NATURAL' },
    { id: 'attractor', name: '3. Drumfire Strange Attractor', engineClass: StormAttractorEngine, category: 'DIMENSIONAL / SPATIAL' },

    // 4. MUSTARD GAS TURING PATTERNS — WITHHELD, not deleted.
    //
    // StormReactionDiffusionEngine still exists on disk. Reaction-
    // diffusion resolves at the grid it simulates on, and behind a
    // full-bleed reading at DPR 2 that grid reads as pixellation rather
    // than as gas.
    //
    // IT IS NO LONGER IMPORTED. Withholding it from this array alone
    // withheld it from the field, the gallery, the Page, the Journey and
    // the Demonstration — but the import above still pulled its 190
    // lines into the family chunk, so every reader who opened Under
    // Steel downloaded 2,562 bytes (684 gzipped) of an engine nothing
    // could select. A runtime filter cannot remove a build-time
    // dependency; the import was the dependency.
    //
    // Gap in numbering is deliberate. To restore: add the import back
    // and add its entry here.

    { id: 'flare_phosphene', name: '5. Magnesium Flare & Phosphenes', engineClass: StormFlarePhospheneEngine, category: 'PERCEPTUAL / PHENOMENOLOGICAL' },
    { id: 'spirograph', name: '6. Ballistic Trajectory Spirograph', engineClass: StormBallisticSpirographEngine, category: 'GEOMETRIC / STRUCTURAL' },
    { id: 'incendiary_blast', name: '7. Incendiary Shell Blast', engineClass: StormIncendiaryBlastEngine, category: 'DIMENSIONAL / SPATIAL' },
    { id: 'ascii_soldier', name: '8. ASCII Trench & Soldier Art', engineClass: StormAsciiEngine, category: 'SYMBOLIC / NOTATIONAL' }
];

export function createStormEngine(engineId) {
    const entry = STORM_OF_STEEL_ENGINES.find(e => e.id === engineId) || STORM_OF_STEEL_ENGINES[0];
    return new entry.engineClass();
}
