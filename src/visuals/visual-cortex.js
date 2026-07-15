/**
 * Visual Cortex
 * 
 * Manages subliminal visual interrupts (interlocution).
 * "Between streams of text, flash a single frame..."
 */

import './visuals.css';
import { KleeEngine, KLEE_PRESET_NAMES } from './klee-enhanced.js';
import { KleeFlashes } from './klee-flashes.js';
import { Turrell } from './turrell.js';
import { FractalFlame } from './fractal.js';
import { RockGarden } from './rockgarden.js';
import { NeuralNetwork } from './neural.js';
import { Harmonograph } from './harmonograph.js';
import { MemoryCore } from '../core/memory.js';
import { abortableDelay, createAbortError, isAbortError } from '../sources/visual/request.js';
import { hasVisualInterlocutionConsent, VisualFlashGate } from '../core/visual-safety.js';

// External imagery is globally bounded because HTMLImageElements may retain
// decoded pixels, not merely compressed network bytes. One image per selected
// category gates session readiness; a slow single-concurrency task grows the
// rotation afterward without ever entering the flash hot path.
const INITIAL_POOL_TARGET = 1;
const BACKGROUND_CATEGORY_TARGET = 3;
const GLOBAL_ASSET_LIMIT = 18;
const IMAGE_LOAD_TIMEOUT_MS = 8000;
const BACKGROUND_RETRY_BASE_MS = 1000;
const BACKGROUND_RETRY_MAX_MS = 30000;
const WARM_LOAD_SPACING_MS = 100;
// Pool key for bare 'diagram' flashes (no concrete category): a
// Wikimedia grab-bag, one pool like any other
const ANY_POOL = '__any__';

export class VisualCortex {
    constructor() {
        this.container = null;
        this.klee = null;
        this.turrell = null;
        this.fractal = null;
        this.rockgarden = null;
        this.neural = null;
        this.harmonograph = null;
        this.diagramEl = null;
        this.initialized = false;
        this._destroyed = false;

        // External providers (lazy loaded)
        this._wikimediaProvider = null;
        this._museumProvider = null;
        // Retained per-category asset pools: images are sampled with
        // rotation, never consumed, so a warm pool serves any flash
        // frequency without touching the network (the old consume-once
        // queue starved at high frequency and fell back to procedural)
        this._assetPools = new Map(); // categoryId -> { images, cursor }
        // One versioned warm task owns all provider I/O. Flash calls only read
        // retained assets; they never await this task or touch the network.
        this._poolWarmTask = null; // { version, target, promise }
        this._assetLoadPromises = new Map();
        this._configVersion = 0;
        this._assetAbortController = new AbortController();
        this._backgroundWarmTimer = null;
        this._backgroundFailureStreak = 0;
        this._externalStatus = {
            state: 'idle',
            version: 0,
            retained: 0,
            categories: {},
            failures: 0,
            skippedFlashes: 0,
            lastError: null
        };
        // Klee queue/episode machinery lives in the KleeFlashes wrapper
        // (mirroring the FractalFlame pattern) — the cortex stays a dispatcher
        this.kleeFlashes = null;
        this._kleeResizeObserver = null;
        this._boundKleeResize = null;
        this._kleeResizeTimer = null;
        this._flashGate = new VisualFlashGate();

        // Configuration state
        this.config = {
            enabled: false,
            frequency: 0.3, // 30%
            duration: 33,   // ms
            activeTypes: ['klee', 'turrell'],
            kleePreset: 'random', // 'random' | 'architectural' | 'chaotic' | 'harmonic' | 'gravitational' | 'twittering'
            harmonographClimate: 'auto', // 'auto' | a climate palette name (explicit = veto)
            customVisuals: []
        };
    }

    init() {
        if (this.initialized) return;
        this._destroyed = false;
        if (this._assetAbortController.signal.aborted) {
            this._assetAbortController = new AbortController();
        }

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
            this.kleeFlashes = new KleeFlashes(this.klee);
            this._setupKleeResizeObserver();
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

        // Initialize Harmonograph (shares klee canvas)
        if (kleeCanvas) {
            this.harmonograph = new Harmonograph();
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

    _setupKleeResizeObserver() {
        if (!this._kleeCanvas || !this.container) return;
        // Debounced: interactive window drags fire the observer per layout
        // frame; artwork snapshots rescale on restore so nothing is lost by
        // waiting for the size to settle.
        const requestResize = () => {
            clearTimeout(this._kleeResizeTimer);
            this._kleeResizeTimer = setTimeout(() => this._resizeKleeCanvas(), 150);
        };
        if (typeof ResizeObserver !== 'undefined') {
            this._kleeResizeObserver = new ResizeObserver(requestResize);
            this._kleeResizeObserver.observe(this.container);
        } else if (typeof window !== 'undefined') {
            this._boundKleeResize = requestResize;
            window.addEventListener('resize', requestResize, { passive: true });
        }
        this._resizeKleeCanvas();
    }

    _resizeKleeCanvas() {
        if (!this._kleeCanvas || !this.klee) return false;
        const rect = this.container?.getBoundingClientRect?.() || {};
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
        const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
        const cssWidth = Math.max(1, Math.round(rect.width || viewportWidth || this._kleeCanvas.clientWidth || 1920));
        const cssHeight = Math.max(1, Math.round(rect.height || viewportHeight || this._kleeCanvas.clientHeight || 1080));
        const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
        const requestedDpr = Math.min(2, Math.max(1, devicePixelRatio || 1));
        const maxPixels = 4_000_000;
        const fit = Math.min(1, Math.sqrt(maxPixels / (cssWidth * cssHeight * requestedDpr * requestedDpr)));
        const pixelRatio = requestedDpr * fit;
        const width = Math.max(1, Math.round(cssWidth * pixelRatio));
        const height = Math.max(1, Math.round(cssHeight * pixelRatio));
        if (this._kleeCanvas.width === width && this._kleeCanvas.height === height) return false;

        this._kleeCanvas.width = width;
        this._kleeCanvas.height = height;
        // The queue and preload engine survive: snapshots rescale on restore
        this.kleeFlashes?.resize(width, height);
        return true;
    }

    queueKleePreset(preset) {
        this.kleeFlashes?.queuePresetOverride(preset);
    }

    /**
     * Update the visual cortex configuration.
     * @param {Object} newConfig - Partial config object
     */
    updateConfig(newConfig) {
        const nextConfig = { ...newConfig };
        if ('activeTypes' in nextConfig) {
            nextConfig.activeTypes = this._normalizeActiveTypes(nextConfig.activeTypes);
        }
        let assetGenerationRotated = false;
        // Detect if active external categories changed
        if ('activeTypes' in nextConfig) {
            const oldExternal = this._poolCategoriesForTypes(this.config.activeTypes || []);
            const newExternal = this._poolCategoriesForTypes(nextConfig.activeTypes);
            
            // A category generation owns its own abort signal. Preserve pools
            // shared by both configurations, release removed categories, and
            // cancel obsolete provider/image work immediately.
            const changed = oldExternal.length !== newExternal.length || 
                          !oldExternal.every(t => newExternal.includes(t));
            
            if (changed) {
                console.log('[Visual Cortex] Category change detected, rotating asset generation.');
                this._rotateAssetGeneration(nextConfig.activeTypes);
                assetGenerationRotated = true;
            }
        }

        // Leaving an interlocution session cancels background/provider work
        // while preserving already-retained pools for a possible return.
        if (nextConfig.enabled === false && this.config.enabled !== false && !assetGenerationRotated) {
            this._rotateAssetGeneration(nextConfig.activeTypes || this.config.activeTypes || []);
        }

        this.config = { ...this.config, ...nextConfig };

        // Forward klee session config — the wrapper value-compares (preset
        // string, signal contents) and only flushes on real changes, so
        // identical arrays arriving under new references keep the queue.
        if (('kleePreset' in nextConfig || 'semanticSignals' in nextConfig) && this.kleeFlashes) {
            this.kleeFlashes.configure({
                preset: this.config.kleePreset ?? 'random',
                signals: this.config.semanticSignals
            });
        }

        // Forward the semantic signal pool to the flame queue (responsive
        // sessions); explicitly passing null clears it for raw sessions.
        if ('semanticSignals' in nextConfig && this.fractal) {
            this.fractal.setSignalPool(nextConfig.semanticSignals);
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
     * Route a category to its correct provider
     * @private
     */
    async _getProviderForCategory(categoryId) {
        // No category (a bare 'diagram' flash) draws from Wikimedia
        if (!categoryId) {
            return this._getWikimediaProvider();
        }
        // Art Institute of Chicago — prefixed with 'aic-' (panel-issued ids)
        if (categoryId.startsWith('aic-')) {
            return this._getMuseumProvider();
        }
        // Defense in depth for direct provider calls. Normal configuration
        // paths migrate retired Met ids before hydration reaches this method.
        if (categoryId.startsWith('met-')) {
            return null;
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
     * Translate a UI category id into the provider's own key. AIC ids
     * are namespaced in the UI ('aic-renaissance') but the provider's
     * category table uses bare keys ('renaissance').
     * @private
     */
    _providerCategory(categoryId) {
        if (!categoryId) return categoryId;
        return categoryId.startsWith('aic-') ? categoryId.slice(4) : categoryId;
    }

    /**
     * Helper to load an image into an Image element
     * @private
     */
    _loadImage(url, name, categoryId, signal = this._assetAbortController.signal) {
        return new Promise((resolve, reject) => {
            if (signal?.aborted) {
                reject(createAbortError());
                return;
            }
            const img = new Image();
            img.decoding = 'async';
            img.fetchPriority = 'low';
            // Do NOT set crossOrigin = 'anonymous' — that forces CORS mode and will
            // fail for any CDN that doesn't send Access-Control-Allow-Origin headers
            // (Met, and others). Images displayed in <img> elements load fine without it.

            let settled = false;
            const cleanup = () => {
                clearTimeout(timeout);
                signal?.removeEventListener('abort', onAbort);
                img.onload = null;
                img.onerror = null;
            };
            const fail = (error) => {
                if (settled) return;
                settled = true;
                cleanup();
                img.src = '';
                reject(error);
            };
            const succeed = (asset) => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(asset);
            };
            const onAbort = () => fail(createAbortError(`Image load aborted for ${categoryId}`));

            const timeout = setTimeout(() => {
                const error = new Error(`Image load timed out after ${IMAGE_LOAD_TIMEOUT_MS}ms`);
                error.name = 'TimeoutError';
                fail(error);
            }, IMAGE_LOAD_TIMEOUT_MS);

            img.onload = async () => {
                try {
                    // onload means bytes are available; decode() guarantees the
                    // first 33-200ms exposure never pays a surprise decode cost.
                    await img.decode?.();
                } catch {
                    // Some browsers reject decode() after a successful onload;
                    // the loaded element remains safe to display.
                }
                if (signal?.aborted) {
                    fail(createAbortError(`Image load aborted for ${categoryId}`));
                    return;
                }
                const now = Date.now();
                succeed({
                    img,
                    name: name,
                    category: categoryId,
                    url,
                    loadedAt: now,
                    lastUsedAt: now
                });
            };
            img.onerror = () => {
                fail(new Error(`Image request failed for ${categoryId}: ${url}`));
            };
            signal?.addEventListener('abort', onAbort, { once: true });
            img.src = url;
        });
    }

    _poolFor(categoryId) {
        if (!this._assetPools.has(categoryId)) {
            this._assetPools.set(categoryId, { images: [], cursor: -1 });
        }
        return this._assetPools.get(categoryId);
    }

    _poolCategoriesForTypes(types = []) {
        const categories = types.filter(t => this._isExternalCategory(t));
        if (categories.length === 0 && types.includes('diagram')) return [ANY_POOL];
        return [...new Set(categories)];
    }

    _isRetiredExternalType(type) {
        return typeof type === 'string' && type.startsWith('met-');
    }

    _normalizeActiveTypes(types) {
        if (!Array.isArray(types)) return [];
        const hadRetiredMet = types.some(type => this._isRetiredExternalType(type));
        const supported = [...new Set(types.filter(type =>
            typeof type === 'string' && !this._isRetiredExternalType(type)
        ))];

        // Preserve the retirement contract for a legacy Met-only preset.
        // Mixed presets simply drop the invisible stale entry so a currently
        // selected source such as Old Masters remains the sole visual intent.
        if (supported.length === 0 && hadRetiredMet) return ['klee'];
        return supported;
    }

    _activePoolCategories() {
        return this._poolCategoriesForTypes(this.config.activeTypes || []);
    }

    _rotateAssetGeneration(nextActiveTypes) {
        this._assetAbortController.abort(createAbortError('External asset configuration changed'));
        this._assetAbortController = new AbortController();
        this._configVersion++;
        clearTimeout(this._backgroundWarmTimer);
        this._backgroundWarmTimer = null;
        // Detach obsolete ownership immediately. Its abort-aware work will
        // unwind independently, while the new generation can begin without
        // waiting on an old dynamic import or browser image callback.
        this._poolWarmTask = null;
        this._assetLoadPromises.clear();
        this._backgroundFailureStreak = 0;

        const retainedCategories = new Set(this._poolCategoriesForTypes(nextActiveTypes));
        for (const [categoryId, pool] of this._assetPools) {
            if (!retainedCategories.has(categoryId)) {
                pool.images.forEach(asset => this._disposeAsset(asset));
                this._assetPools.delete(categoryId);
            }
        }
        this._externalStatus.failures = 0;
        this._externalStatus.skippedFlashes = 0;
        this._externalStatus.lastError = null;
        this._refreshExternalStatus(
            'idle', INITIAL_POOL_TARGET, undefined, [...retainedCategories]);
    }

    _backgroundTarget() {
        const categoryCount = Math.max(1, this._activePoolCategories().length);
        return Math.max(1, Math.min(
            BACKGROUND_CATEGORY_TARGET,
            Math.floor(GLOBAL_ASSET_LIMIT / categoryCount)
        ));
    }

    _refreshExternalStatus(
        state,
        target = INITIAL_POOL_TARGET,
        lastError = undefined,
        categories = this._activePoolCategories()
    ) {
        const categoryStatus = {};
        let retained = 0;
        for (const categoryId of categories) {
            const count = this._poolFor(categoryId).images.length;
            retained += count;
            categoryStatus[categoryId] = { retained: count, target };
        }

        const minimumReady = categories.length === 0
            || categories.every(categoryId => this._poolFor(categoryId).images.length >= INITIAL_POOL_TARGET);
        const targetSatisfied = categories.length === 0
            || categories.every(categoryId => this._poolFor(categoryId).images.length >= target);

        this._externalStatus = {
            ...this._externalStatus,
            state,
            version: this._configVersion,
            retained,
            categories: categoryStatus,
            minimumReady,
            targetSatisfied,
            ...(lastError !== undefined ? { lastError } : {})
        };
        return this.getExternalAssetStatus();
    }

    getExternalAssetStatus() {
        return {
            ...this._externalStatus,
            lastError: this._externalStatus.lastError
                ? { ...this._externalStatus.lastError }
                : null,
            categories: Object.fromEntries(
                Object.entries(this._externalStatus.categories || {})
                    .map(([key, value]) => [key, { ...value }])
            )
        };
    }

    _recordExternalFailure(categoryId, phase, error, url = null) {
        if (isAbortError(error)) return;
        const detail = {
            category: categoryId,
            phase,
            url,
            name: error?.name || 'Error',
            message: error?.message || String(error || 'Unknown external asset error')
        };
        this._externalStatus.failures++;
        this._externalStatus.lastError = detail;
        console.warn('[Visual Cortex] External asset load failed:', detail);
    }

    _touchAsset(asset) {
        asset.lastUsedAt = Date.now();
        return asset;
    }

    _disposeAsset(asset) {
        if (!asset?.img) return;
        asset.img.onload = null;
        asset.img.onerror = null;
        // The visible diagram element owns its own URL. Releasing this
        // off-DOM preload element lets the browser reclaim decoded pixels.
        asset.img.src = '';
    }

    _retainAsset(categoryId, asset) {
        const pool = this._poolFor(categoryId);
        this._touchAsset(asset);
        pool.images.push(asset);
        this._enforceGlobalAssetLimit();
        return asset;
    }

    _enforceGlobalAssetLimit() {
        let retained = [...this._assetPools.values()]
            .reduce((total, pool) => total + pool.images.length, 0);
        while (retained > GLOBAL_ASSET_LIMIT) {
            let oldest = null;
            for (const [categoryId, pool] of this._assetPools) {
                // Preserve the minimum-ready image for every category.
                if (pool.images.length <= INITIAL_POOL_TARGET) continue;
                for (let index = 0; index < pool.images.length; index++) {
                    const asset = pool.images[index];
                    if (!oldest || (asset.lastUsedAt || asset.loadedAt || 0) < oldest.time) {
                        oldest = {
                            categoryId,
                            index,
                            time: asset.lastUsedAt || asset.loadedAt || 0
                        };
                    }
                }
            }
            // More selected categories than the global cap is an impossible
            // minimum-ready set; remain globally bounded and report degraded.
            if (!oldest) {
                for (const [categoryId, pool] of this._assetPools) {
                    for (let index = 0; index < pool.images.length; index++) {
                        const asset = pool.images[index];
                        if (!oldest || (asset.lastUsedAt || asset.loadedAt || 0) < oldest.time) {
                            oldest = {
                                categoryId,
                                index,
                                time: asset.lastUsedAt || asset.loadedAt || 0
                            };
                        }
                    }
                }
            }
            if (!oldest) break;
            const pool = this._poolFor(oldest.categoryId);
            const [evicted] = pool.images.splice(oldest.index, 1);
            this._disposeAsset(evicted);
            if (pool.cursor >= pool.images.length) pool.cursor = pool.images.length - 1;
            retained--;
        }
    }

    _takeFromPool(pool) {
        if (!pool || pool.images.length === 0) return null;
        pool.cursor = (pool.cursor + 1) % pool.images.length;
        return this._touchAsset(pool.images[pool.cursor]);
    }

    /**
     * Fetch one artwork into a category's retained pool. A duplicate URL
     * reuses its already-decoded asset; unique URLs grow the rotation.
     * @private
     */
    async _loadIntoPool(categoryId, options = {}) {
        const version = options.version ?? this._configVersion;
        const signal = options.signal ?? this._assetAbortController.signal;
        const requestKey = `${version}:${categoryId}`;
        const existingLoad = this._assetLoadPromises.get(requestKey);
        if (existingLoad) return existingLoad;

        const pool = this._poolFor(categoryId);
        const loadPromise = (async () => {
            let requestedUrl = null;
            try {
                if (signal.aborted || version !== this._configVersion) throw createAbortError();
                const provider = categoryId === ANY_POOL
                    ? await this._getWikimediaProvider()
                    : await this._getProviderForCategory(categoryId);
                if (!provider) throw new Error(`No provider for category ${categoryId}`);

                const image = await provider.getRandom(
                    categoryId === ANY_POOL
                        ? { signal, timeoutMs: 8000 }
                        : {
                            category: this._providerCategory(categoryId),
                            signal,
                            timeoutMs: 8000
                        });
                if (!image?.data?.url) throw new Error(`Provider returned no image URL for ${categoryId}`);
                requestedUrl = image.data.url;
                if (signal.aborted || version !== this._configVersion) throw createAbortError();

                // Random selection can legitimately return an artwork that is
                // already retained. It remains usable content, not a failed
                // hydration attempt.
                const duplicate = pool.images.find(a => a.img?.src === image.data.url);
                if (duplicate) return this._touchAsset(duplicate);

                const asset = await this._loadImage(image.data.url, image.name, categoryId, signal);
                if (signal.aborted || version !== this._configVersion) throw createAbortError();
                return this._retainAsset(categoryId, asset);
            } catch (e) {
                this._recordExternalFailure(categoryId, 'hydrate', e, requestedUrl);
                return null;
            }
        })();

        this._assetLoadPromises.set(requestKey, loadPromise);
        try {
            return await loadPromise;
        } finally {
            if (this._assetLoadPromises.get(requestKey) === loadPromise) {
                this._assetLoadPromises.delete(requestKey);
            }
        }
    }

    async _runPoolWarmPass(categories, target, version, signal) {
        this._refreshExternalStatus('warming', target);
        const maxAttempts = Math.max(2, target * 2);

        try {
            for (let round = 0; round < maxAttempts; round++) {
                let attempted = false;
                for (const categoryId of categories) {
                    if (signal.aborted || version !== this._configVersion) throw createAbortError();
                    if (this._poolFor(categoryId).images.length >= target) continue;

                    attempted = true;
                    await this._loadIntoPool(categoryId, { version, signal });
                    await abortableDelay(WARM_LOAD_SPACING_MS, signal);
                }
                if (!attempted) break;
            }
        } catch (error) {
            if (!isAbortError(error)) this._recordExternalFailure('pool', 'warm', error);
        }

        if (signal.aborted || version !== this._configVersion) {
            return { ...this.getExternalAssetStatus(), aborted: true };
        }

        const minimumReady = categories.every(
            categoryId => this._poolFor(categoryId).images.length >= INITIAL_POOL_TARGET);
        const targetSatisfied = categories.every(
            categoryId => this._poolFor(categoryId).images.length >= target);
        const retained = categories.reduce(
            (total, categoryId) => total + this._poolFor(categoryId).images.length, 0);
        const state = targetSatisfied ? 'ready'
            : retained > 0 ? 'degraded'
                : 'failed';
        const status = this._refreshExternalStatus(state, target);
        console.log('[Visual Cortex] External asset readiness:', status);
        return { ...status, minimumReady, targetSatisfied, aborted: false };
    }

    /**
     * Join or start the one versioned pool-warming task. Every joined caller
     * accepts the same bounded result; none can form a follow-on retry convoy.
     */
    async _preloadDiagrams(perCategory = INITIAL_POOL_TARGET) {
        if (this._destroyed) return this.getExternalAssetStatus();
        const requestedVersion = this._configVersion;
        const target = Math.max(
            INITIAL_POOL_TARGET,
            Math.min(this._backgroundTarget(), perCategory)
        );

        while (true) {
            if (this._destroyed) return this.getExternalAssetStatus();
            // A caller belongs to the generation it started in. It must never
            // resurrect itself against a replacement configuration; the new
            // session/preload call owns that generation.
            if (requestedVersion !== this._configVersion) {
                return { ...this.getExternalAssetStatus(), aborted: true };
            }
            const version = this._configVersion;
            const categories = this._activePoolCategories();
            if (categories.length === 0) return this._refreshExternalStatus('idle', target);
            if (categories.every(categoryId => this._poolFor(categoryId).images.length >= target)) {
                return this._refreshExternalStatus('ready', target);
            }

            const activeTask = this._poolWarmTask;
            if (activeTask) {
                const result = await activeTask.promise;
                if (version !== this._configVersion) continue;
                // A pass at this target (or higher) made its bounded attempts.
                // All joiners share that result; retry scheduling has one owner.
                if (activeTask.version === version && activeTask.target >= target) return result;
                continue;
            }

            const signal = this._assetAbortController.signal;
            const task = { version, target, promise: null };
            task.promise = this._runPoolWarmPass(categories, target, version, signal);
            this._poolWarmTask = task;
            try {
                const result = await task.promise;
                if (version !== this._configVersion) continue;
                return result;
            } finally {
                if (this._poolWarmTask === task) this._poolWarmTask = null;
            }
        }
    }

    _scheduleBackgroundWarm(immediate = false) {
        if (this._destroyed || !this.config.enabled) return;
        const categories = this._activePoolCategories();
        if (categories.length === 0 || this._backgroundWarmTimer) return;
        const target = this._backgroundTarget();
        if (categories.every(categoryId => this._poolFor(categoryId).images.length >= target)) {
            this._backgroundFailureStreak = 0;
            this._refreshExternalStatus('ready', target);
            return;
        }

        const delay = immediate ? 0 : Math.min(
            BACKGROUND_RETRY_MAX_MS,
            BACKGROUND_RETRY_BASE_MS * (2 ** this._backgroundFailureStreak)
        );
        const scheduledVersion = this._configVersion;
        this._backgroundWarmTimer = setTimeout(async () => {
            this._backgroundWarmTimer = null;
            if (scheduledVersion !== this._configVersion) return;

            const status = await this._preloadDiagrams(target);
            if (scheduledVersion !== this._configVersion || status.aborted) return;
            if (status.targetSatisfied) {
                this._backgroundFailureStreak = 0;
                return;
            }

            this._backgroundFailureStreak++;
            this._scheduleBackgroundWarm(false);
        }, delay);
    }

    /**
     * Check if a type is a known Wikimedia category
     * @private
     */
    _isExternalCategory(type) {
        if (typeof type !== 'string' || this._isRetiredExternalType(type)) return false;
        // Core types are internal or handled elsewhere
        const coreTypes = ['klee', 'turrell', 'fractal', 'neural', 'global', 'custom', 'rockgarden', 'harmonograph', 'diagram', 'global-pool'];
        if (coreTypes.includes(type) || type.startsWith('personal:')) return false;

        // Otherwise assume it's a category for one of our external providers
        return true;
    }

    /**
     * Cache-only flash selection. This method deliberately contains no await
     * and no provider access: a 33-200ms exposure can never stall the reading
     * clock on network or decode work.
     */
    _getNextDiagram(category = null) {
        const activeExternal = this.config.activeTypes.filter(t => this._isExternalCategory(t));
        const candidates = category
            ? [category] // explicit category is a veto: never substitute it
            : activeExternal.length > 0 ? activeExternal : [ANY_POOL];
        const stockedPools = candidates
            .map(categoryId => this._poolFor(categoryId))
            .filter(pool => pool.images.length > 0);

        const target = this._backgroundTarget();
        const needsWarmth = this._activePoolCategories()
            .some(categoryId => this._poolFor(categoryId).images.length < target);
        if (needsWarmth) this._scheduleBackgroundWarm(false);
        if (stockedPools.length === 0) return null;

        const pool = stockedPools[Math.floor(Math.random() * stockedPools.length)];
        return this._takeFromPool(pool);
    }

    /**
     * Preload visuals for a session.
     * This is now async and should be awaited before starting playback.
     * @param {number} estimatedFlashCount 
     */
    async preload(estimatedFlashCount) {
        if (!this.initialized) this.init();
        this._flashGate.reset();

        const flashCount = Number.isFinite(Number(estimatedFlashCount))
            ? Math.max(0, Number(estimatedFlashCount))
            : 0;

        const preloadPromises = [];
        let externalPreload = null;

        // Preload fractals
        if (this.fractal && this.config.activeTypes.includes('fractal')) {
            this.fractal.beginSession(this.config.semanticSignals);
            const fractalShare = 1 / Math.max(1, this.config.activeTypes.length);
            const count = Math.ceil(flashCount * fractalShare * 1.5);
            preloadPromises.push(this.fractal.preload(count));
        }

        // Klee artworks are prepared as complete geometry/style snapshots.
        // One snapshot supports several static short flashes, so preload by
        // episode rather than by raw flash count.
        if (this.kleeFlashes && this.config.activeTypes.includes('klee')) {
            this.kleeFlashes.beginSession({
                preset: this.config.kleePreset ?? 'random',
                signals: this.config.semanticSignals
            });
            const kleeShare = 1 / Math.max(1, this.config.activeTypes.length);
            const estimatedKleeFlashes = Math.ceil(flashCount * kleeShare * 1.5);
            const episodeCount = Math.max(
                this.config.kleePreset === 'random' ? KLEE_PRESET_NAMES.length : 1,
                Math.ceil(estimatedKleeFlashes / 4)
            );
            preloadPromises.push(this.kleeFlashes.preload(episodeCount));
        }

        // Preload external assets. Sessions usually carry concrete category
        // ids, while legacy configs may still use the bare 'diagram' flag.
        // Both paths enter with a decoded retained asset when available.
        const externalCategories = this._activePoolCategories();
        if (externalCategories.length > 0) {
            // Session entry gates on one decoded image per selected category.
            // The rotation grows afterward under one globally capped task.
            externalPreload = this._preloadDiagrams(INITIAL_POOL_TARGET);
            preloadPromises.push(externalPreload);
        }

        await Promise.all(preloadPromises);
        const externalStatus = this.getExternalAssetStatus();
        if (externalPreload) this._scheduleBackgroundWarm(externalStatus.minimumReady);
        return externalStatus;
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
        if (!hasVisualInterlocutionConsent()) return;
        if (!this._flashGate.allow()) return;

        if (!this.initialized) this.init();
        if (!this.container) return;

        // Use config or override
        const duration = durationOverride ?? this.config.duration;
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
        // A stale plan/type override can bypass updateConfig. Honor the Met
        // retirement promise without attempting a provider or showing a blank
        // frame: use procedural Klee when it is available.
        if (this._isRetiredExternalType(selectedType)) {
            if (!this.kleeFlashes || !this._kleeCanvas) return;
            selectedType = 'klee';
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

        if (selectedType === 'klee' && this.kleeFlashes && this._kleeCanvas) {
            // Subliminal flashes are still frames — the artwork's episode
            // evolves between appearances, never during a cut. (In-flash
            // animation was removed: durations are capped at 200ms, below
            // any threshold where nested motion reads as anything but flicker.)
            this._resizeKleeCanvas();
            await this.kleeFlashes.renderFlash(this._kleeCanvas, duration, signal);
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
                const requestedCategory = selectedType !== 'diagram' ? selectedType : null;
                const diagram = this._getNextDiagram(requestedCategory);
                if (!diagram || !diagram.img) {
                    // Explicit source choices are a veto. An unavailable frame
                    // becomes intentional stillness; it never injects Klee or
                    // blocks the reading clock on a network request.
                    this._externalStatus.skippedFlashes++;
                    this._scheduleBackgroundWarm(false);
                    return;
                }
                this.diagramEl.src = diagram.img.src;
                this.diagramEl.alt = diagram.name || 'External Asset';
                this.diagramEl.hidden = false;
            } catch (err) {
                this._externalStatus.skippedFlashes++;
                this._recordExternalFailure(selectedType, 'flash-select', err);
                this._scheduleBackgroundWarm(false);
                return;
            }
        } else if (selectedType === 'harmonograph' && this.harmonograph && this._kleeCanvas) {
            // The conductor's instrument: the signal picks a musical
            // interval, the pendulums draw it (still frame, shares the
            // klee canvas like the rock garden)
            this._resizeKleeCanvas();
            this.harmonograph.generate(signal, undefined, {
                climate: this.config.harmonographClimate
            });
            this.harmonograph.render(this._kleeCanvas);
            if (kleeEl) kleeEl.hidden = false;
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

    destroy() {
        this._destroyed = true;
        this._assetAbortController.abort(createAbortError('Visual Cortex destroyed'));
        this._configVersion++;
        clearTimeout(this._backgroundWarmTimer);
        this._backgroundWarmTimer = null;
        this._poolWarmTask = null;
        this._assetLoadPromises.clear();
        for (const pool of this._assetPools.values()) {
            pool.images.forEach(asset => this._disposeAsset(asset));
        }
        this._assetPools.clear();
        this._externalStatus = {
            ...this._externalStatus,
            state: 'destroyed',
            version: this._configVersion,
            retained: 0,
            categories: {},
            minimumReady: false,
            targetSatisfied: false
        };
        this._kleeResizeObserver?.disconnect();
        if (this._boundKleeResize && typeof window !== 'undefined') {
            window.removeEventListener('resize', this._boundKleeResize);
        }
        clearTimeout(this._kleeResizeTimer);
        this.kleeFlashes?.destroy();
        this.kleeFlashes = null;
        this.fractal?.destroy?.();
        this.fractal = null;
        this.klee?.destroy?.();
        this.initialized = false;
    }
}

// Singleton instance
export const visualCortex = new VisualCortex();

