/**
 * PARADISE LOST (John Milton) — Visual Pattern Engines Catalog
 * 
 * Specialized Procedural Generation Engines interpreting cosmic rebellion, celestial light,
 * 4D tesseract abyssal falls, Ezekiel's divine chariot wheels, St. Michael's 3D Flaming Sword,
 * infernal sulfur magma Voronoi networks, and cosmic curl noise flow fields.
 */

import { ParadiseFallHypercubeEngine } from './ParadiseFallHypercubeEngine.js';
import { ParadiseChariotDeityEngine } from './ParadiseChariotDeityEngine.js';
import { ParadiseFlamingSwordEngine } from './ParadiseFlamingSwordEngine.js';
import { ParadiseSulfurMagmaEngine } from './ParadiseSulfurMagmaEngine.js';
import { ParadiseDarkOceanChaosEngine } from './ParadiseDarkOceanChaosEngine.js';

export {
    ParadiseFallHypercubeEngine,
    ParadiseChariotDeityEngine,
    ParadiseFlamingSwordEngine,
    ParadiseSulfurMagmaEngine,
    ParadiseDarkOceanChaosEngine
};

export const PARADISE_LOST_ENGINES = [
    { id: 'fall_hypercube', name: '1. Fall of the Rebel Angels (Mandelbrot Abyss)', engineClass: ParadiseFallHypercubeEngine, category: 'DIMENSIONAL / SPATIAL' },
    { id: 'chariot_deity', name: '2. Chariot of Paternal Deity (Ezekiel Wheels)', engineClass: ParadiseChariotDeityEngine, category: 'DIMENSIONAL / SPATIAL' },
    { id: 'flaming_sword', name: '3. St. Michael\'s Flaming Sword (3D Inscribed)', engineClass: ParadiseFlamingSwordEngine, category: 'DIMENSIONAL / SPATIAL' },
    { id: 'sulfur_magma', name: '4. Sulfur & Brimstone Magma Network (Voronoi)', engineClass: ParadiseSulfurMagmaEngine, category: 'DIMENSIONAL / SPATIAL' },
    { id: 'dark_ocean_chaos', name: '5. The Dark Ocean of Chaos (Cosmic Flow Fields)', engineClass: ParadiseDarkOceanChaosEngine, category: 'DIMENSIONAL / SPATIAL' }
];

export function createParadiseEngine(engineId) {
    const entry = PARADISE_LOST_ENGINES.find(e => e.id === engineId) || PARADISE_LOST_ENGINES[0];
    return new entry.engineClass();
}
