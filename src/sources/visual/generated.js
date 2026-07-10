/**
 * R.I.S.E. Source System
 * Generated Visual Provider
 *
 * Wraps the existing procedural generators (Klee, Turrell, Fractal)
 * as a SourceProvider for visual content.
 */

import { SourceProvider } from '../provider.js';

/**
 * Visual generator types available
 */
export const VISUAL_TYPES = {
    klee: {
        id: 'klee',
        name: 'Klee Lines',
        description: 'Procedural line-art inspired by Paul Klee\'s pedagogical diagrams',
        style: 'geometric',
        // Static preview gradient representing the style
        previewGradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        previewIcon: '╱'
    },
    turrell: {
        id: 'turrell',
        name: 'Turrell Fields',
        description: 'Luminous color gradient fields inspired by James Turrell',
        style: 'color-field',
        previewGradient: 'linear-gradient(180deg, #ff6b6b 0%, #c44569 50%, #6a0572 100%)',
        previewIcon: '◈'
    },
    fractal: {
        id: 'fractal',
        name: 'Fractal Flames',
        description: 'Algorithmic fractal flame visualizations',
        style: 'fractal',
        previewGradient: 'linear-gradient(45deg, #0c0c0c 0%, #1a0a2e 50%, #3d1a5c 100%)',
        previewIcon: '✧'
    }
};

/**
 * Provider for procedurally generated visual content.
 * Unlike other providers, this one generates content on-demand
 * rather than retrieving from a catalog.
 */
export class GeneratedVisualProvider extends SourceProvider {
    constructor() {
        super({
            id: 'generated-visuals',
            name: 'Procedural Visuals',
            contentType: 'image',
            tier: 1,
            description: 'Algorithmically generated visual patterns for interlocution',
            supportsSearch: false,
            supportsPreload: true
        });

        // Generator instances will be lazy-loaded
        this._generators = new Map();
        this._generatorModules = {
            klee: () => import('../../visuals/klee.js'),
            turrell: () => import('../../visuals/turrell.js'),
            fractal: () => import('../../visuals/fractal.js')
        };
    }

    /**
     * @override
     */
    async _doInit() {
        console.log(`[GeneratedVisualProvider] Available types: ${Object.keys(VISUAL_TYPES).join(', ')}`);
    }

    /**
     * @override
     * Lists available generator types (not instances)
     */
    async list(filter = {}) {
        const items = Object.values(VISUAL_TYPES).map(type => ({
            id: type.id,
            type: 'image',
            name: type.name,
            data: {
                isGenerative: true,
                generatorType: type.id,
                previewGradient: type.previewGradient,
                previewIcon: type.previewIcon
            },
            providerId: this.id,
            tier: this.tier,
            metadata: {
                description: type.description,
                style: type.style,
                generative: true,
                category: 'Procedural',
                previewGradient: type.previewGradient,
                previewIcon: type.previewIcon
            }
        }));

        return items;
    }

    /**
     * @override
     * Get a generator type's metadata with preview info
     */
    async get(typeId) {
        const type = VISUAL_TYPES[typeId];
        if (!type) return null;

        return {
            id: type.id,
            type: 'image',
            name: type.name,
            data: {
                isGenerative: true,
                generatorType: type.id,
                previewGradient: type.previewGradient,
                previewIcon: type.previewIcon
            },
            providerId: this.id,
            tier: this.tier,
            metadata: {
                description: type.description,
                style: type.style,
                generative: true,
                category: 'Procedural',
                previewGradient: type.previewGradient,
                previewIcon: type.previewIcon
            }
        };
    }

    /**
     * Get or create a generator instance by type
     * @param {string} typeId - Generator type (klee, turrell, fractal)
     * @param {HTMLCanvasElement} [canvas] - Canvas element for the generator
     * @returns {Promise<Object|null>} Generator instance
     */
    async getGenerator(typeId, canvas) {
        if (!VISUAL_TYPES[typeId]) {
            console.warn(`[GeneratedVisualProvider] Unknown type: ${typeId}`);
            return null;
        }

        // Check if we have a module loader for this type
        const moduleLoader = this._generatorModules[typeId];
        if (!moduleLoader) {
            console.warn(`[GeneratedVisualProvider] No module for type: ${typeId}`);
            return null;
        }

        try {
            const module = await moduleLoader();

            // Each module exports its main class
            // Klee exports Klee, Turrell exports Turrell, Fractal exports FractalFlame
            if (typeId === 'klee' && module.Klee) {
                return new module.Klee(canvas);
            } else if (typeId === 'turrell' && module.Turrell) {
                return new module.Turrell(canvas);
            } else if (typeId === 'fractal' && module.FractalFlame) {
                return new module.FractalFlame(canvas);
            }

            console.warn(`[GeneratedVisualProvider] Module loaded but class not found: ${typeId}`);
            return null;
        } catch (error) {
            console.error(`[GeneratedVisualProvider] Failed to load ${typeId}:`, error);
            return null;
        }
    }

    /**
     * Check if a generator type is available
     * @param {string} typeId
     * @returns {boolean}
     */
    hasType(typeId) {
        return typeId in VISUAL_TYPES;
    }

    /**
     * Get all available type IDs
     * @returns {string[]}
     */
    getTypeIds() {
        return Object.keys(VISUAL_TYPES);
    }

    /**
     * @override
     * Get random visual type
     */
    async getRandom(filter = {}) {
        const types = Object.keys(VISUAL_TYPES);
        const randomType = types[Math.floor(Math.random() * types.length)];
        return this.get(randomType);
    }
}
