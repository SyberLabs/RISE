/**
 * PARADISE LOST (John Milton) — Visual Pattern Engines Catalog
 * 
 * Specialized Procedural Generation Engines interpreting cosmic rebellion, celestial light,
 * 4D tesseract abyssal falls, and Ezekiel's divine chariot wheels of thunder.
 */

import { ParadiseFallHypercubeEngine } from './ParadiseFallHypercubeEngine.js';
import { ParadiseChariotDeityEngine } from './ParadiseChariotDeityEngine.js';

export {
    ParadiseFallHypercubeEngine,
    ParadiseChariotDeityEngine
};

export const PARADISE_LOST_ENGINES = [
    { id: 'fall_hypercube', name: '1. Fall of the Rebel Angels (4D Tesseract)', engineClass: ParadiseFallHypercubeEngine, category: 'DIMENSIONAL / SPATIAL' },
    { id: 'chariot_deity', name: '2. Chariot of Paternal Deity (Ezekiel Wheels)', engineClass: ParadiseChariotDeityEngine, category: 'DIMENSIONAL / SPATIAL' }
];

export function createParadiseEngine(engineId) {
    const entry = PARADISE_LOST_ENGINES.find(e => e.id === engineId) || PARADISE_LOST_ENGINES[0];
    return new entry.engineClass();
}
