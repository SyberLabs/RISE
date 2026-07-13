/**
 * Visual Cortex
 * 
 * Manages subliminal visual interrupts (interlocution).
 * "Between streams of text, flash a single frame..."
 */

import './visuals.css';
import { KleeEngine } from './klee-enhanced.js';
import { Turrell } from './turrell.js';
import { FractalFlame } from './fractal.js';
import { RockGarden } from './rockgarden.js';
import { NeuralNetwork } from './neural.js';
import { MemoryCore } from '../core/memory.js';

export class VisualCortex {
    constructor() {
        this.container = null;
        this.klee = null;
        this.turrell = null;
        this.fractal = null;
        this.rockgarden = null;
        this.neural = null;
        this.diagramEl = null;
        this.initialized = false;

        // External providers (lazy loaded)
        this._wikimediaProvider = null;
        this._museumProvider = null;
        this._metProvider = null;
        this._diagramQueue = [];
        this._diagramPreloading = false;
        this._configVersion = 0;

        // Configuration state
        this.config = {
            enabled: false,
            frequency: 0.3, // 30%
            duration: 33,   // ms
            activeTypes: ['klee', 'turrell'],
            kleePreset: 'random', // 'random' | 'corporeal' | 'structural' | 'mythic' | 'volatile' | 'centered'
            customVisuals: []
        };
    }

    init() {
        if (this.initialized) return;

        this.container = document.getElementById('visual-cortex');
        if (!this.container) {
            console.warn('Visual Cortex container not found in DOM.');
            return;
        }

        const kleeCanvas = document.getElementById('klee-canvas');
        if (kleeCanvas) {
            this.klee = new KleeEngine();
            this.klee.width = kleeCanvas.width;
            this.klee.height = kleeCanvas.height;
            this._kleeCanvas = kleeCanvas;
        }

        const turrellField = document.getElementById('turrell-field');
        if (turrellField) {
            this.turrell = new Turrell(turrellField);
        }

        const fractalCanvas = document.getElementById('fractal-canvas');
        if (fractalCanvas) {
            this.fractal = new FractalFlame(fractalCanvas);
            console.log('[Visual Cortex] Fractal canvas bound:', fractalCanvas);
        } else {
            console.warn('[Visual Cortex] #fractal-canvas not found in DOM!');
        }

        // Initialize Neural Network canvas
        let neuralCanvas = document.getElementById('neural-canvas');
        if (!neuralCanvas) {
            // Create neural canvas dynamically
            neuralCanvas = document.createElement('canvas');
            neuralCanvas.id = 'neural-canvas';
            neuralCanvas.className = 'visual-canvas';
            neuralCanvas.width = 1024;
            neuralCanvas.height = 1024;
            neuralCanvas.hidden = true;
            this.container.appendChild(neuralCanvas);
        }
        this.neural = new NeuralNetwork(neuralCanvas);
        this._neuralCanvas = neuralCanvas;
        console.log('[Visual Cortex] Neural canvas bound:', neuralCanvas);

        // Initialize Rock Garden (shares klee canvas)
        if (kleeCanvas) {
            this.rockgarden = new RockGarden();
        }

        // Create diagram element if it doesn't exist
        this.diagramEl = document.getElementById('diagram-display');
        if (!this.diagramEl) {
            this.diagramEl = document.createElement('img');
            this.diagramEl.id = 'diagram-display';
            this.diagramEl.className = 'diagram-display';
            this.diagramEl.hidden = true;
            this.container.appendChild(this.diagramEl);
            // console.log('[Visual Cortex] Created diagram display element');
        }

        // Create custom visual display element if it doesn't exist
        this.customImageEl = document.getElementById('custom-visual-display');
        if (!this.customImageEl) {
            this.customImageEl = document.createElement('img');
            this.customImageEl.id = 'custom-visual-display';
            this.customImageEl.className = 'diagram-display'; // Reuse diagram styles for fullscreen
            this.customImageEl.style.objectFit = 'cover';
            this.customImageEl.hidden = true;
            this.container.appendChild(this.customImageEl);
            // console.log('[Visual Cortex] Created custom visual display element');
        }

        this.initialized = true;
        console.log('[Visual Cortex] Online.');
    }

    /**
     * Update the visual cortex configuration.
     * @param {Object} newConfig - Partial config object
     */
    updateConfig(newConfig) {
        // Detect if active external categories changed
        if (newConfig.activeTypes) {
            const oldExternal = (this.config.activeTypes || []).filter(t => this._isExternalCategory(t));
            const newExternal = newConfig.activeTypes.filter(t => this._isExternalCategory(t));
            
            // If the set of external categories changed, flush the queue to prevent "bleed"
            const changed = oldExternal.length !== newExternal.length || 
                          !oldExternal.every(t => newExternal.includes(t));
            
            if (changed) {
                console.log('[Visual Cortex] Category change detected, flushing image queue.');
                this._diagramQueue = [];
                this._configVersion++; // Force preloads to restart
            }
        }

        this.config = { ...this.config, ...newConfig };

        // Forward the semantic signal pool to the flame queue (responsive
        // sessions); explicitly passing null clears it for raw sessions.
        if ('semanticSignals' in newConfig && this.fractal) {
            this.fractal.setSignalPool(newConfig.semanticSignals);
        }

        console.log('[Visual Cortex] Config updated:', this.config);
    }

    /**
     * Get or initialize the Wikimedia provider
     * @private
     */
    async _getWikimediaProvider() {
        if (this._wikimediaProvider) return this._wikimediaProvider;

        try {
            const { WikimediaProvider } = await import('../sources/visual/wikimedia.js');
            this._wikimediaProvider = new WikimediaProvider();
            await this._wikimediaProvider.init();
            return this._wikimediaProvider;
        } catch (error) {
            console.error('[Visual Cortex] Failed to load WikimediaProvider:', error);
            return null;
        }
    }

    /**
     * Get or initialize the Museum provider (Art Institute)
     * @private
     */
    async _getMuseumProvider() {
        if (this._museumProvider) return this._museumProvider;

        try {
            const { MuseumProvider } = await import('../sources/visual/museum.js');
            this._museumProvider = new MuseumProvider();
            await this._museumProvider.init();
            return this._museumProvider;
        } catch (error) {
            console.error('[Visual Cortex] Failed to load MuseumProvider:', error);
            return null;
        }
    }

    /**
     * Get or initialize the Met Museum provider
     * @private
     */
    async _getMetProvider() {
        if (this._metProvider) return this._metProvider;
        try {
            const { MetMuseumProvider } = await import('../sources/visual/met.js');
            this._metProvider = new MetMuseumProvider();
            await this._metProvider.init();
            return this._metProvider;
        } catch (error) {
            console.error('[Visual Cortex] Failed to load MetMuseumProvider:', error);
            return null;
        }
    }

    /**
     * Route a category to its correct provider
     * @private
     */
    async _getProviderForCategory(categoryId) {
        // Art Institute of Chicago — prefixed with 'aic-' (panel-issued ids)
        if (categoryId.startsWith('aic-')) {
            return this._getMuseumProvider();
        }
        // Met Museum — prefixed with 'met-'
        if (categoryId && categoryId.startsWith('met-')) {
            return this._getMetProvider();
        }
        // High-aesthetic Art and Photography categories for AIC Museum
        const museumCategories = ['renaissance', 'romantic', 'impressionism', 'photography', 'surrealism', 'landscapes'];
        if (museumCategories.includes(categoryId)) {
            return this._getMuseumProvider();
        }
        // Default to Wikimedia for diagrams and others
        return this._getWikimediaProvider();
    }

    /**
     * Helper to load an image into an Image element
     * @private
     */
    _loadImage(url, name, categoryId) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            // Do NOT set crossOrigin = 'anonymous' — that forces CORS mode and will
            // fail for any CDN that doesn't send Access-Control-Allow-Origin headers
            // (Met, and others). Images displayed in <img> elements load fine without it.

            // 10s timeout to prevent hanging the queue
            const timeout = setTimeout(() => {
                img.src = ''; // Cancel loading
                reject(new Error(`Timeout loading image: ${url}`));
            }, 10000);

            img.onload = () => {
                clearTimeout(timeout);
                resolve({
                    img,
                    name: name,
                    category: categoryId,
                    loadedAt: Date.now()
                });
            };
            img.onerror = (err) => {
                clearTimeout(timeout);
                reject(err);
            };
            img.src = url;
        });
    }

    /**
     * Preload diagrams for the session
     * @private
     */
    async _preloadDiagrams(count = 10) {
        if (this._diagramPreloading) return;
        this._diagramPreloading = true;
        const currentVersion = this._configVersion;

        try {
            console.log(`[Visual Cortex] Preloading ${count} external assets...`);

            // Filter active external types
            const categories = this.config.activeTypes.filter(t => this._isExternalCategory(t));
            if (categories.length === 0) return;

            let attempts = 0;
            const maxAttempts = count * 2; // Don't loop forever

            while (this._diagramQueue.length < count && attempts < maxAttempts) {
                // Abort if config changed since we started
                if (this._configVersion !== currentVersion) {
                    console.log('[Visual Cortex] Preload aborted: config changed.');
                    break;
                }
                attempts++;
                const categoryId = categories[attempts % categories.length];
                
                try {
                    const provider = await this._getProviderForCategory(categoryId);
                    if (!provider) continue;

                    // AIC ids are namespaced in the UI ('aic-renaissance') but the
                    // provider's category table uses bare keys ('renaissance')
                    const providerCategory = categoryId.startsWith('aic-') ? categoryId.slice(4) : categoryId;
                    const image = await provider.getRandom({ category: providerCategory });
                    if (image && image.data && image.data.url) {
                        this._diagramQueue.push(this._loadImage(image.data.url, image.name, categoryId).catch(err => {
                            console.warn('[Visual Cortex] Failed to load external asset, skipping.', err);
                            return null;
                        }));
                    }
                } catch (e) {
                    console.warn('[Visual Cortex] Preload attempt failed:', e.message);
                    if (e.message === '429') break;
                }

                // Yield to main thread
                await new Promise(resolve => setTimeout(resolve, 100)); // Increase yield time
            }

            console.log(`[Visual Cortex] Preloaded ${this._diagramQueue.length} diagrams`);
        } catch (error) {
            console.error('[Visual Cortex] Diagram preload failed:', error);
        } finally {
            this._diagramPreloading = false;
        }
    }

    /**
     * Get next diagram from queue or fetch new
     * @private
     */
    /**
     * Check if a type is a known Wikimedia category
     * @private
     */
    _isExternalCategory(type) {
        // Core types are internal or handled elsewhere
        const coreTypes = ['klee', 'turrell', 'fractal', 'neural', 'global', 'custom', 'rockgarden', 'diagram', 'global-pool'];
        if (coreTypes.includes(type) || type.startsWith('personal:')) return false;

        // Otherwise assume it's a category for one of our external providers
        return true;
    }

    /**
     * Get next diagram from queue or fetch new
     * @param {string} [category] - Optional specific category to prefer
     * @private
     */
    async _getNextDiagram(category = null) {
        // If queue is low, trigger background preload
        if (this._diagramQueue.length < 3 && !this._diagramPreloading) {
            this._preloadDiagrams(5); // Don't await, run in background
        }

        // 1. Try to find a valid diagram in the queue iteratively
        // If category is specified, we MUST match it.
        if (category) {
            for (let i = 0; i < this._diagramQueue.length; i++) {
                try {
                    const p = this._diagramQueue[i];
                    const resolved = await Promise.race([
                        p,
                        new Promise(resolve => setTimeout(() => resolve('pending'), 10))
                    ]);

                    if (resolved !== 'pending' && resolved && resolved.category === category) {
                        return this._diagramQueue.splice(i, 1)[0];
                    }
                    
                    // If definitely loaded but wrong category, leave it for later (or remove if no longer in config?)
                    // For safety, we just keep looking.
                } catch (err) {
                    // Remove failed promises
                    this._diagramQueue.splice(i, 1);
                    i--;
                }
            }
            // If we are here, no match found in queue. We DON'T fallback to shifting a random one.
        } else {
            // No category specified, just take the first valid one
            while (this._diagramQueue.length > 0) {
                try {
                    const diagram = await this._diagramQueue.shift();
                    if (diagram && diagram.img) return diagram;
                } catch (err) { }
            }
        }

        // 2. Fetch one directly if queue is empty or exhausted
        let fetchAttempts = 0;
        while (fetchAttempts < 2) {
            fetchAttempts++;
            try {
                const provider = await this._getProviderForCategory(category);
                if (!provider) return null;

                const image = await provider.getRandom({ category: category });
                if (image && image.data && image.data.url) {
                    return await this._loadImage(image.data.url, image.name, image.metadata?.categoryId);
                }
            } catch (error) {
                console.error('[Visual Cortex] Direct fetch failed:', error.message);
                if (error.message === '429') break;
            }
        }

        return null;
    }

    /**
     * Preload visuals for a session.
     * This is now async and should be awaited before starting playback.
     * @param {number} estimatedFlashCount 
     */
    async preload(estimatedFlashCount) {
        if (!this.initialized) this.init();

        const preloadPromises = [];

        // Preload fractals
        if (this.fractal && this.config.activeTypes.includes('fractal')) {
            const fractalShare = 1 / Math.max(1, this.config.activeTypes.length);
            const count = Math.ceil(estimatedFlashCount * fractalShare * 1.5);
            preloadPromises.push(this.fractal.preload(count));
        }

        // Preload diagrams
        if (this.config.activeTypes.includes('diagram')) {
            const diagramShare = 1 / Math.max(1, this.config.activeTypes.length);
            const count = Math.ceil(estimatedFlashCount * diagramShare * 1.5);
            preloadPromises.push(this._preloadDiagrams(Math.min(count, 10)));
        }

        await Promise.all(preloadPromises);
    }

    /**
     * Flash a visual interrupt based on current config or overrides.
     * @param {number} [durationOverride] - Optional duration override
     * @param {string} [typeOverride] - Optional type override ('klee', 'turrell', 'fractal', 'diagram')
     * @param {Object} [signal] - Optional semantic signal ({valence, arousal});
     *                            lets the flame queue pick its closest match
     */
    async flash(durationOverride, typeOverride, signal) {
        // Photosensitivity mode is a global safety override: no visual
        // interrupts, regardless of session config or prior consent.
        if (typeof document !== 'undefined'
            && document.documentElement.classList.contains('photosensitivity-mode')) {
            return;
        }

        if (!this.initialized) this.init();
        if (!this.container) return;

        // Use config or override
        const duration = durationOverride || this.config.duration;
        let selectedType = typeOverride;

        // If no type specified, pick randomly from active types
        if (!selectedType) {
            const types = this.config.activeTypes;
            if (types.length === 0) return; // No types enabled
            selectedType = types[Math.floor(Math.random() * types.length)];
        }
        
        // Map global-pool to custom logic
        if (selectedType === 'global-pool') {
            selectedType = 'global';
        }

        // Generate content
        const kleeEl = document.getElementById('klee-canvas');
        const turrellEl = document.getElementById('turrell-field');
        const fractalEl = document.getElementById('fractal-canvas');
        const neuralEl = document.getElementById('neural-canvas');

        // Reset visibility
        if (kleeEl) kleeEl.hidden = true;
        if (turrellEl) turrellEl.hidden = true;
        if (fractalEl) fractalEl.hidden = true;
        if (neuralEl) neuralEl.hidden = true;
        if (this.diagramEl) this.diagramEl.hidden = true;
        if (this.customImageEl) this.customImageEl.hidden = true;

        if (selectedType === 'klee' && this.klee && this._kleeCanvas) {
            // Determine preset: one-shot override (fallback path) wins once,
            // then random selects from all, otherwise use configured
            const presets = ['corporeal', 'structural', 'mythic', 'volatile', 'centered'];
            const preset = this._presetOverride
                ? this._presetOverride
                : (this.config.kleePreset === 'random'
                    ? presets[Math.floor(Math.random() * presets.length)]
                    : this.config.kleePreset);
            this._presetOverride = null;

            this.klee.generateRandom(preset);
            const ctx = this._kleeCanvas.getContext('2d');
            this.klee.render(this._kleeCanvas, { background: 'black' });
            if (kleeEl) kleeEl.hidden = false;
        } else if (selectedType === 'turrell' && this.turrell) {
            this.turrell.generate();
            if (turrellEl) turrellEl.hidden = false;
        } else if (selectedType === 'fractal' && this.fractal) {
            const success = this.fractal.generate(signal);
            if (!success) {
                console.warn('[Visual Cortex] Fractal not ready, skipping flash.');
                return;
            }
            if (fractalEl) {
                fractalEl.hidden = false;
            }
        } else if (selectedType === 'neural' && this.neural) {
            const success = this.neural.generate();
            if (!success) {
                console.warn('[Visual Cortex] Neural not ready, skipping flash.');
                return;
            }
            if (neuralEl) {
                neuralEl.hidden = false;
            }
        } else if (this.diagramEl && (selectedType === 'diagram' || this._isExternalCategory(selectedType))) {
            try {
                const diagram = await this._getNextDiagram(selectedType !== 'diagram' ? selectedType : null);
                if (!diagram || !diagram.img) {
                    throw new Error('No asset content');
                }
                this.diagramEl.src = diagram.img.src;
                this.diagramEl.alt = diagram.name || 'External Asset';
                this.diagramEl.hidden = false;
            } catch (err) {
                console.warn('[Visual Cortex] External flash failed, falling back to procedural:', err.message);
                // Fallback: pick a procedural type from the active list if available
                const procedural = this.config.activeTypes.filter(t => !this._isExternalCategory(t) && t !== 'diagram');
                const fallbackType = procedural.length > 0 
                    ? procedural[Math.floor(Math.random() * procedural.length)]
                    : 'klee';
                
                // If falling back to Klee due to error, use the high-intent
                // gravitational preset — for this flash only, never persisted
                // into config (that would hijack every later Klee flash)
                if (fallbackType === 'klee') {
                    this._presetOverride = 'gravitational-pull';
                }

                return this.flash(duration, fallbackType);
            }
        } else if (selectedType === 'rockgarden' && this.rockgarden && this._kleeCanvas) {
            // Generate Rock Garden (uses same canvas as Klee)
            this.rockgarden.generateRockGarden({
                width: this._kleeCanvas.width,
                height: this._kleeCanvas.height
            });
            this.rockgarden.renderRockGarden(this._kleeCanvas, {
                backgroundColor: '#0c0c0e', // Match void palette
                strokeColor: 'rgba(232, 232, 236, 0.8)',
                brushStroke: true
            });
            if (kleeEl) kleeEl.hidden = false;
        } else if (selectedType === 'custom' && this.customImageEl && this.config.customVisuals.length > 0) {
            const visuals = this.config.customVisuals;
            const customUri = visuals[Math.floor(Math.random() * visuals.length)];
            this.customImageEl.src = customUri;
            this.customImageEl.alt = 'Custom Sequence Frame';
            this.customImageEl.hidden = false;
        } else if (selectedType === 'global' && this.customImageEl) {
            const globals = MemoryCore.getGlobalImages();
            if (globals.length > 0) {
                const globalUri = globals[Math.floor(Math.random() * globals.length)];
                this.customImageEl.src = globalUri;
                this.customImageEl.alt = 'Global Pool Frame';
                this.customImageEl.hidden = false;
            }
        } else if (selectedType.startsWith('personal:') && this.customImageEl) {
            // Personal Sequence Images mapping
            const blueprintId = selectedType.split(':')[1];
            if (blueprintId) {
                const blueprints = MemoryCore.getWorkshopBlueprints();
                const bp = blueprints.find(b => b.id === blueprintId);
                if (bp && bp.customVisuals && bp.customVisuals.length > 0) {
                    const personalUri = bp.customVisuals[Math.floor(Math.random() * bp.customVisuals.length)];
                    this.customImageEl.src = personalUri;
                    this.customImageEl.alt = 'Personal Sequence Frame';
                    this.customImageEl.hidden = false;
                }
            }
        }

        // Show Cortex
        this.container.hidden = false;
        this.container.style.display = 'flex';
        this.container.style.zIndex = '9999';

        // Schedule hide using deterministic timing
        return new Promise((resolve) => {
            const targetTime = performance.now() + duration;
            const checkHide = (timestamp) => {
                if (timestamp >= targetTime) {
                    this.container.hidden = true;
                    this.container.style.display = ''; // Reset
                    resolve();
                } else {
                    requestAnimationFrame(checkHide);
                }
            };
            requestAnimationFrame(checkHide);
        });
    }
}

// Singleton instance
export const visualCortex = new VisualCortex();

