/**
 * PARADISE LOST (John Milton) — Visual Pattern Engines Catalog
 * 
 * Specialized Procedural Generation Engines interpreting cosmic rebellion, celestial light,
 * 4D tesseract abyssal falls, Ezekiel's divine chariot wheels, St. Michael's 3D Flaming Sword,
 * infernal sulfur magma Voronoi networks, and cosmic curl noise flow fields.
 */

import { PARADISE_LOST_ENGINE_META } from './engines.meta.js';
import { ParadiseFallHypercubeEngine } from './ParadiseFallHypercubeEngine.js';
import { ParadiseChariotDeityEngine } from './ParadiseChariotDeityEngine.js';
import { ParadiseFlamingSwordEngine } from './ParadiseFlamingSwordEngine.js';
import { ParadiseSulfurMagmaEngine } from './ParadiseSulfurMagmaEngine.js';
import { ParadiseDarkOceanChaosEngine } from './ParadiseDarkOceanChaosEngine.js';
import { ParadiseHeavenInOrderEngine } from './ParadiseHeavenInOrderEngine.js';

export {
    ParadiseFallHypercubeEngine,
    ParadiseChariotDeityEngine,
    ParadiseFlamingSwordEngine,
    ParadiseSulfurMagmaEngine,
    ParadiseDarkOceanChaosEngine,
    ParadiseHeavenInOrderEngine
};

/**
 * The engines, named by engines.meta.js and drawn by the classes above.
 * Ordering and identity come from the metadata, so this file cannot
 * introduce an engine the manifest has never heard of, or vice versa.
 */
const CLASSES = {
    heaven_in_order: ParadiseHeavenInOrderEngine,
    fall_hypercube: ParadiseFallHypercubeEngine,
    chariot_deity: ParadiseChariotDeityEngine,
    flaming_sword: ParadiseFlamingSwordEngine,
    sulfur_magma: ParadiseSulfurMagmaEngine,
    dark_ocean_chaos: ParadiseDarkOceanChaosEngine
};

export const PARADISE_LOST_ENGINES = PARADISE_LOST_ENGINE_META.map(entry => ({
    ...entry,
    engineClass: CLASSES[entry.id]
}));

export function createParadiseEngine(engineId) {
    const entry = PARADISE_LOST_ENGINES.find(e => e.id === engineId) || PARADISE_LOST_ENGINES[0];
    return new entry.engineClass();
}
