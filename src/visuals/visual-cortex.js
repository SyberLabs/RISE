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
import { Blueprint } from './blueprint.js';
import { Freedom } from './freedom.js';
import {
    AsciiCanvasRenderer,
    AsciiFrameCompiler,
    ASCII_BACKGROUND,
    compileFieldPlanToAscii,
    compilePolylinesToAscii,
    resolveAsciiGrid
} from './ascii-engine.js';
import { MemoryCore } from '../core/memory.js';
import { abortableDelay, createAbortError, isAbortError } from '../sources/visual/request.js';
import { ShuffleBag } from '../sources/visual/shuffle-bag.js';
import { hasVisualInterlocutionConsent, VisualFlashGate } from '../core/visual-safety.js';
import {
    VISUAL_PRESENCE_DEFAULT_MS,
    normalizeVisualPresence,
    visualPresenceTransition
} from '../core/visual-presence.js';

// External imagery is globally bounded because HTMLImageElements may retain
// decoded pixels, not merely compressed network bytes. One image per selected
// category gates session readiness; a slow single-concurrency task grows the
// rotation afterward without ever entering the flash hot path.
const INITIAL_POOL_TARGET = 1;
const BACKGROUND_CATEGORY_TARGET = 6;
const MAX_CATEGORY_TARGET = 12;
const GLOBAL_ASSET_LIMIT = 18;
const RECENT_EXTERNAL_WINDOW = 6;
const IMAGE_LOAD_TIMEOUT_MS = 8000;
const BACKGROUND_RETRY_BASE_MS = 1000;
const BACKGROUND_RETRY_MAX_MS = 30000;
const WARM_LOAD_SPACING_MS = 100;
// CSS opacity starts on the next animation frame. Waiting one additional frame
// after enterMs ensures the overlay is truly opaque before concealed text is
// replaced behind it.
const COVER_SETTLE_FRAME_MS = 17;
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
        this.blueprint = null;
        this.freedom = null;
        this.diagramEl = null;
        this.asciiRenderer = null;
        this.asciiCompiler = null;
        this._asciiCanvas = null;
        this._asciiScratchCanvas = null;
        this._localAsciiAssets = new Map();
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
        // Blend ledger: positive means procedural is ahead of sourced in
        // flashes the reader actually SAW (see _selectBlendType).
        this._blendDebt = 0;
        this._externalPoolBag = new ShuffleBag();
        this._recentExternalUrls = [];
        this._sessionAssetTarget = BACKGROUND_CATEGORY_TARGET;
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
        this._pendingKleeResize = false;
        this._flashGate = new VisualFlashGate();
        this._activePresentation = null;
        // Invalidates work that was already rendering when a stop request
        // arrived. The public cancellation method remains the single kill
        // path for both committed and not-yet-committed presentations.
        this._presentationEpoch = 0;
        this._lastCancellationReason = 'aborted';

        // Configuration state
        this.config = {
            enabled: false,
            frequency: 0.3, // 30%
            duration: VISUAL_PRESENCE_DEFAULT_MS,
            renderLanguage: 'native', // 'native' | 'ascii'
            activeTypes: ['klee', 'turrell'],
            kleePreset: 'random', // 'random' | 'architectural' | 'chaotic' | 'harmonic' | 'gravitational' | 'twittering'
            harmonographClimate: 'auto', // 'auto' | a climate palette name (explicit = veto)
            blueprintClimate: 'auto',    // 'auto' | cyanotype | graphite | sepia | verdigris
            blueprintMechanism: null,    // pinned by an Atrium mechanism sequence
            freedomRelation: null,       // colonial pairing, set by an Atrium launch
            // Presentation surface: 'full-frame' cuts to an opaque overlay;
            // 'behind-stream' keeps the reading text visible and presents the
            // imagery beneath it. Behind-stream never conceals text, so it
            // has no covered phase and no concealed-swap handoff at all.
            presentation: 'full-frame',
            customVisuals: [],
            // null preserves legacy direct callers; App session entry always
            // supplies an exact resolved array (including an intentional []).
            globalVisuals: null
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

        // ASCII is an orthogonal display language. It shares the same
        // responsive, DPR-aware backing dimensions as every native source,
        // while its compiler works on a bounded cell grid.
        let asciiCanvas = document.getElementById('ascii-canvas');
        if (!asciiCanvas) {
            asciiCanvas = document.createElement('canvas');
            asciiCanvas.id = 'ascii-canvas';
            asciiCanvas.className = 'visual-canvas ascii-canvas';
            asciiCanvas.hidden = true;
            asciiCanvas.setAttribute('aria-hidden', 'true');
            this.container.appendChild(asciiCanvas);
        }
        this._asciiCanvas = asciiCanvas;
        this.asciiRenderer = new AsciiCanvasRenderer(asciiCanvas);
        this.asciiCompiler = new AsciiFrameCompiler();
        this._asciiScratchCanvas = document.createElement('canvas');
        this._resizeKleeCanvas();

        // Initialize Rock Garden (shares klee canvas)
        if (kleeCanvas) {
            this.rockgarden = new RockGarden();
        }

        // Initialize Harmonograph (shares klee canvas)
        if (kleeCanvas) {
            this.harmonograph = new Harmonograph();
            this.blueprint = new Blueprint();
            this.freedom = new Freedom();
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
        if (this._activePresentation) {
            this._pendingKleeResize = true;
            return false;
        }
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
        const kleeChanged = this._kleeCanvas.width !== width || this._kleeCanvas.height !== height;
        const asciiChanged = this.asciiRenderer?.resize(width, height) || false;
        if (!kleeChanged) return asciiChanged;

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
        if (this._activePresentation && Object.keys(nextConfig).length > 0) {
            this.cancelPresentation('aborted');
        }
        if ('duration' in nextConfig) {
            nextConfig.duration = normalizeVisualPresence(nextConfig.duration);
        }
        if ('renderLanguage' in nextConfig) {
            nextConfig.renderLanguage = nextConfig.renderLanguage === 'ascii' ? 'ascii' : 'native';
        }
        if ('activeTypes' in nextConfig) {
            nextConfig.activeTypes = this._normalizeActiveTypes(nextConfig.activeTypes);
            // The Blend ledger belongs to ONE reading, not to the tab.
            // The cortex is a singleton, so without this a pure
            // procedural session would drive the debt to its ceiling and
            // the next Blend reading would open biased toward sourced
            // imagery it had no reason to owe.
            this._blendDebt = 0;
        }
        if ('globalVisuals' in nextConfig) {
            nextConfig.globalVisuals = Array.isArray(nextConfig.globalVisuals)
                ? [...new Set(nextConfig.globalVisuals.filter(uri =>
                    typeof uri === 'string' && uri.startsWith('data:image/')))].slice(0, 20)
                : [];
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
            this.cancelPresentation('aborted');
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

        console.log('[Visual Cortex] Config updated:', {
            ...this.config,
            customVisuals: `${this.config.customVisuals?.length || 0} local assets`,
            globalVisuals: Array.isArray(this.config.globalVisuals)
                ? `${this.config.globalVisuals.length} resolved global assets`
                : 'legacy resolution'
        });
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
        // Atrium-scoped subject categories (atr-*) resolve through the
        // Wikimedia provider once the Atrium content module has
        // registered its resolver. A restored session can carry atr-
        // ids without the Atrium ever loading this visit — import
        // lazily so registration precedes resolution.
        if (categoryId.startsWith('atr-')) {
            // A pinned collection wins: specific museum works, chosen and
            // reviewed, rather than whatever a keyword returned today.
            try {
                const pinned = await import('../content/atrium/imagery/provider.js');
                if (pinned.hasPinnedCollection(categoryId)) {
                    return pinned.getPinnedWorksProvider();
                }
            } catch (e) {
                console.warn('[Visual Cortex] Pinned works unavailable:', e);
            }
            try {
                await import('../content/atrium/atrium-categories.js');
            } catch (e) {
                console.warn('[Visual Cortex] Atrium categories unavailable:', e);
            }
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
                const asset = {
                    img,
                    name: name,
                    category: categoryId,
                    url,
                    loadedAt: now,
                    lastUsedAt: now
                };
                if (this.config.renderLanguage === 'ascii') {
                    asset.asciiPromise = this._prepareAssetAscii(asset, signal);
                }
                succeed(asset);
            };
            img.onerror = () => {
                fail(new Error(`Image request failed for ${categoryId}: ${url}`));
            };
            signal?.addEventListener('abort', onAbort, { once: true });
            img.src = url;
        });
    }

    _loadReadableImage(url, signal = this._assetAbortController.signal) {
        return new Promise((resolve, reject) => {
            if (!url || signal?.aborted) {
                reject(signal?.aborted ? createAbortError() : new Error('Readable image URL is empty'));
                return;
            }
            const img = new Image();
            img.decoding = 'async';
            img.fetchPriority = 'low';
            // A second, CORS-enabled element protects the native hydration
            // contract: providers that cannot be sampled may still display in
            // Native, while ASCII intentionally skips an unreadable frame.
            if (/^https?:/i.test(url)) img.crossOrigin = 'anonymous';

            let settled = false;
            const cleanup = () => {
                clearTimeout(timeout);
                signal?.removeEventListener('abort', onAbort);
                img.onload = null;
                img.onerror = null;
            };
            const fail = error => {
                if (settled) return;
                settled = true;
                cleanup();
                img.src = '';
                reject(error);
            };
            const onAbort = () => fail(createAbortError('ASCII image load aborted'));
            const timeout = setTimeout(() => {
                const error = new Error(`ASCII image load timed out after ${IMAGE_LOAD_TIMEOUT_MS}ms`);
                error.name = 'TimeoutError';
                fail(error);
            }, IMAGE_LOAD_TIMEOUT_MS);

            img.onload = async () => {
                try { await img.decode?.(); } catch { /* onload remains sufficient */ }
                if (signal?.aborted) {
                    fail(createAbortError('ASCII image load aborted'));
                    return;
                }
                if (settled) return;
                settled = true;
                cleanup();
                resolve(img);
            };
            img.onerror = () => fail(new Error(`Image is not CORS-readable for ASCII: ${url}`));
            signal?.addEventListener('abort', onAbort, { once: true });
            img.src = url;
        });
    }

    _asciiOptions(signal, metadata = {}, fit = 'contain') {
        return {
            displayWidth: this._asciiCanvas?.width || this._kleeCanvas?.width || 1920,
            displayHeight: this._asciiCanvas?.height || this._kleeCanvas?.height || 1080,
            scratchCanvas: this._asciiScratchCanvas,
            signal,
            fit,
            metadata
        };
    }

    async _prepareAssetAscii(asset, signal = this._assetAbortController.signal) {
        if (!asset?.url) return null;
        try {
            const readable = asset.asciiImg || await this._loadReadableImage(asset.url, signal);
            asset.asciiImg = readable;
            asset.asciiFrame = await this.asciiCompiler.compileDrawable(
                readable,
                this._asciiOptions(null, { source: 'external', category: asset.category })
            );
            return asset.asciiFrame;
        } catch (error) {
            // Sampling capability is separate from provider hydration. Do not
            // count it as an external content failure, log expected CORS
            // refusal, or trigger a fallback that violates source intent.
            return null;
        }
    }

    async _prepareExternalAsciiAssets(signal = this._assetAbortController.signal) {
        const tasks = [];
        for (const pool of this._assetPools.values()) {
            for (const asset of pool.images) {
                if (asset.asciiFrame) continue;
                if (!asset.asciiPromise) asset.asciiPromise = this._prepareAssetAscii(asset, signal);
                tasks.push(asset.asciiPromise);
            }
        }
        await Promise.all(tasks);
    }

    _globalVisualUris() {
        const visuals = Array.isArray(this.config.globalVisuals)
            ? this.config.globalVisuals
            : (MemoryCore.getGlobalImages?.() || []);
        return [...new Set(visuals.filter(Boolean))].slice(0, 20);
    }

    _localVisualUris() {
        const types = this.config.activeTypes || [];
        const uris = [];
        if (types.includes('custom')) uris.push(...(this.config.customVisuals || []));
        if (types.includes('global') || types.includes('global-pool')) {
            uris.push(...this._globalVisualUris());
        }
        for (const type of types) {
            if (!type.startsWith?.('personal:')) continue;
            const blueprintId = type.slice('personal:'.length);
            const blueprint = (MemoryCore.getWorkshopBlueprints?.() || [])
                .find(item => item.id === blueprintId);
            uris.push(...(blueprint?.customVisuals || []));
        }
        return [...new Set(uris.filter(Boolean))].slice(0, 24);
    }

    async _prepareLocalAsciiAssets(signal = this._assetAbortController.signal) {
        this._localAsciiAssets.clear();
        for (const uri of this._localVisualUris()) {
            if (signal?.aborted) throw createAbortError();
            let img = null;
            try {
                img = await this._loadReadableImage(uri, signal);
                const frame = await this.asciiCompiler.compileDrawable(
                    img,
                    this._asciiOptions(null, { source: 'local' }, 'cover')
                );
                if (frame) this._localAsciiAssets.set(uri, frame);
            } catch (error) {
                if (isAbortError(error)) throw error;
            } finally {
                if (img) img.src = '';
            }
        }
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
            this._sessionAssetTarget,
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
        if (!asset) return;
        if (asset.img) {
            asset.img.onload = null;
            asset.img.onerror = null;
        }
        if (asset.asciiImg) {
            asset.asciiImg.onload = null;
            asset.asciiImg.onerror = null;
            asset.asciiImg.src = '';
        }
        asset.asciiFrame = null;
        asset.asciiPromise = null;
        // The visible diagram element owns its own URL. Releasing this
        // off-DOM preload element lets the browser reclaim decoded pixels.
        if (asset.img) asset.img.src = '';
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
        let asset = null;
        let recentFallback = null;
        for (let attempt = 0; attempt < pool.images.length; attempt++) {
            pool.cursor = (pool.cursor + 1) % pool.images.length;
            const candidate = pool.images[pool.cursor];
            if (this.config.renderLanguage === 'ascii' && !candidate?.asciiFrame) continue;
            const url = candidate?.url || candidate?.img?.src || '';
            if (!url || !this._recentExternalUrls.includes(url)) {
                asset = candidate;
                break;
            }
            recentFallback ||= candidate;
        }
        asset ||= recentFallback;
        if (!asset) return null;

        const url = asset.url || asset.img?.src || '';
        if (url) {
            this._recentExternalUrls = this._recentExternalUrls.filter(item => item !== url);
            this._recentExternalUrls.push(url);
            if (this._recentExternalUrls.length > RECENT_EXTERNAL_WINDOW) {
                this._recentExternalUrls.splice(
                    0,
                    this._recentExternalUrls.length - RECENT_EXTERNAL_WINDOW
                );
            }
        }
        return this._touchAsset(asset);
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
        // The provider decks no longer roll duplicates with replacement, so a
        // small spare budget is sufficient for decode/filter failures. This
        // bounds offline retry pressure as the diversity target grows.
        const maxAttempts = Math.max(2, Math.min(target * 2, target + 2));

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
        const coreTypes = ['klee', 'turrell', 'fractal', 'neural', 'global', 'custom', 'rockgarden', 'harmonograph', 'blueprint', 'freedom', 'diagram', 'global-pool'];
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
            .map(categoryId => ({ id: categoryId, pool: this._poolFor(categoryId) }))
            .filter(entry => entry.pool.images.some(asset =>
                this.config.renderLanguage !== 'ascii' || asset.asciiFrame
            ));

        const target = this._backgroundTarget();
        const needsWarmth = this._activePoolCategories()
            .some(categoryId => this._poolFor(categoryId).images.length < target);
        if (needsWarmth) this._scheduleBackgroundWarm(false);
        if (stockedPools.length === 0) return null;

        const selected = this._externalPoolBag.draw(
            `pools:${candidates.join('|')}`,
            stockedPools
        );
        return this._takeFromPool(selected?.pool);
    }

    /**
     * Preload visuals for a session.
     * This is now async and should be awaited before starting playback.
     * @param {number} estimatedFlashCount 
     */
    async preload(estimatedFlashCount) {
        if (!this.initialized) this.init();
        this.cancelPresentation('aborted');
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
            // Adapt the background rotation to this session's likely demand.
            // Entry still gates on one asset. Growth is sequential, capped by
            // the existing global decoded-image budget, and advances by two
            // candidates on repeat sessions so a retained pool does not freeze.
            const fairCapacity = Math.max(
                1,
                Math.floor(GLOBAL_ASSET_LIMIT / externalCategories.length)
            );
            const retainedFloor = Math.min(...externalCategories.map(
                categoryId => this._poolFor(categoryId).images.length
            ));
            const expectedPerCategory = flashCount > 0
                ? Math.ceil(flashCount / Math.max(1, this.config.activeTypes.length))
                : INITIAL_POOL_TARGET;
            this._sessionAssetTarget = Math.min(
                fairCapacity,
                MAX_CATEGORY_TARGET,
                Math.max(
                    flashCount > 0 ? BACKGROUND_CATEGORY_TARGET : INITIAL_POOL_TARGET,
                    Math.ceil(expectedPerCategory * 1.25),
                    Math.min(fairCapacity, retainedFloor + 2)
                )
            );

            // Session entry gates on one decoded image per selected category.
            // The rotation grows afterward under one globally capped task.
            externalPreload = this._preloadDiagrams(INITIAL_POOL_TARGET);
            preloadPromises.push(externalPreload);
        }

        await Promise.all(preloadPromises);
        if (this.config.renderLanguage === 'ascii') {
            // Precompile raster sources before the reading clock begins. The
            // flash path only selects and paints a small immutable frame.
            if (this.fractal && this.config.activeTypes.includes('fractal')) {
                await Promise.all((this.fractal.queue || []).map(async item => {
                    if (!item.asciiFrame) {
                        item.asciiFrame = await this.asciiCompiler.compileImageData(
                            item.imageData,
                            this._asciiOptions(item.signal, { source: 'fractal' })
                        );
                    }
                }));
            }
            await this._prepareExternalAsciiAssets();
            await this._prepareLocalAsciiAssets();
        } else {
            this._localAsciiAssets.clear();
        }
        const externalStatus = this.getExternalAssetStatus();
        if (externalPreload) this._scheduleBackgroundWarm(externalStatus.minimumReady);
        return externalStatus;
    }

    _harmonographAsciiFrame(signal) {
        const trace = this.harmonograph?.trace;
        const plan = this.harmonograph?.plan;
        if (!trace || !plan || !this._asciiCanvas) return null;
        const width = this._asciiCanvas.width;
        const height = this._asciiCanvas.height;
        const scale = Math.min(width, height) * 0.5 * plan.amplitude * 1.7;
        const points = [];
        const pointCount = trace.length / 2;
        const stride = Math.max(1, Math.ceil(pointCount / 1800));
        for (let index = 0; index < pointCount; index += stride) {
            points.push([
                width / 2 + trace[index * 2] * scale,
                height / 2 + trace[index * 2 + 1] * scale
            ]);
        }
        return compilePolylinesToAscii({
            width,
            height,
            palette: plan.anchors,
            polylines: [{ points, color: plan.anchors?.[2] || '#e5e3df', delay: 0 }]
        }, {
            ...resolveAsciiGrid(this._asciiCanvas.width, this._asciiCanvas.height),
            signal,
            background: ASCII_BACKGROUND,
            metadata: {
                source: 'harmonograph',
                ratio: [...plan.ratio],
                paletteName: plan.paletteName
            }
        });
    }

    _neuralAsciiFrame(signal) {
        if (!this.neural || !this._asciiCanvas) return null;
        const palette = this.neural.currentPalette || {};
        const connections = (this.neural.connections || []).map(connection => {
            const from = this.neural.nodes?.[connection.from];
            const to = this.neural.nodes?.[connection.to];
            return {
                points: from && to ? [[from.x, from.y], [to.x, to.y]] : [],
                color: connection.active
                    ? (palette.activationPulse || [220, 210, 255])
                    : (palette.connectionBase || [80, 80, 90]),
                delay: 0
            };
        });
        const nodes = (this.neural.nodes || []).flatMap(node => {
            const radius = Math.max(3, Number(node.radius) || 4);
            const color = node.activation > 0.65
                ? (palette.activationPulse || [255, 255, 255])
                : (palette.nodeCore || [180, 180, 190]);
            return [
                { points: [[node.x - radius, node.y], [node.x + radius, node.y]], color, delay: 0 },
                { points: [[node.x, node.y - radius], [node.x, node.y + radius]], color, delay: 0 }
            ];
        });
        return compilePolylinesToAscii({
            width: this._neuralCanvas?.width || this._asciiCanvas.width,
            height: this._neuralCanvas?.height || this._asciiCanvas.height,
            palette: [
                palette.connectionBase || [80, 80, 90],
                palette.nodeCore || [180, 180, 190],
                palette.activationPulse || [255, 255, 255]
            ],
            polylines: [...connections, ...nodes]
        }, {
            ...resolveAsciiGrid(this._asciiCanvas.width, this._asciiCanvas.height),
            signal,
            background: ASCII_BACKGROUND,
            metadata: { source: 'neural' }
        });
    }

    _rockGardenAsciiFrame(signal) {
        if (!this.rockgarden || !this._asciiCanvas) return null;
        return compilePolylinesToAscii({
            width: this._asciiCanvas.width,
            height: this._asciiCanvas.height,
            palette: ['#e8e8ec', '#a8a8ae'],
            polylines: (this.rockgarden.shapes || []).map((shape, index) => ({
                points: shape.points,
                color: index % 3 === 0 ? '#e8e8ec' : '#a8a8ae',
                delay: Math.min(0.12, index * 0.018)
            }))
        }, {
            signal,
            background: ASCII_BACKGROUND,
            metadata: { source: 'rockgarden' }
        });
    }

    _blueprintAsciiFrame(signal) {
        if (!this.blueprint || !this._asciiCanvas) return null;
        const w = this._asciiCanvas.width;
        const h = this._asciiCanvas.height;
        return compilePolylinesToAscii({
            width: w,
            height: h,
            palette: ['#e8e8ec', '#a8a8ae'],
            polylines: this.blueprint.asciiPolylines(w, h).map((line, index) => ({
                points: line.points,
                color: index === 0 ? '#a8a8ae' : '#e8e8ec',
                delay: Math.min(0.12, index * 0.02)
            }))
        }, {
            signal,
            background: ASCII_BACKGROUND,
            metadata: { source: 'blueprint' }
        });
    }

    _freedomAsciiFrame(signal) {
        if (!this.freedom || !this._asciiCanvas) return null;
        const w = this._asciiCanvas.width;
        const h = this._asciiCanvas.height;
        return compilePolylinesToAscii({
            width: w, height: h,
            palette: ['#e8e8ec', '#a8a8ae'],
            polylines: this.freedom.asciiPolylines(w, h).map((line, index) => ({
                points: line.points,
                color: index % 2 === 0 ? '#e8e8ec' : '#a8a8ae',
                delay: Math.min(0.12, index * 0.02)
            }))
        }, {
            signal,
            background: ASCII_BACKGROUND,
            metadata: { source: 'freedom' }
        });
    }

    /**
     * Choose a Blend family, keeping the ratio the reader actually SEES
     * near even.
     *
     * A fair coin is not enough, because the two families fail
     * differently. A procedural type always renders — the generator
     * draws on demand. A sourced type whose image has not loaded yet
     * becomes intentional stillness (`source-unavailable`), which is
     * correct as a policy but invisible as an outcome. So a fair 50/50
     * SELECTION produces a lopsided EXPERIENCE: at 60% pool readiness
     * the reader sees roughly 63% procedural, and early in a session,
     * before the museum pool has warmed, worse.
     *
     * Two corrections, both bounded:
     *   1. Prefer a family whose pool can actually deliver. A sourced
     *      pick is only offered when at least one of its categories has
     *      a retained asset.
     *   2. Carry the debt. Every silent skip and every shown flash
     *      moves a counter, and the counter biases the next draw toward
     *      whichever family is behind. Randomness is preserved (the
     *      bias is a nudge, never a rule), so the field never becomes
     *      a metronome of alternating families.
     */
    _selectBlendType(procedural, sourced) {
        const ready = sourced.filter(type => this._categoryHasAsset(type));
        const pool = ready.length > 0 ? ready : null;

        // Nothing sourced can render yet: procedural carries the reading
        // rather than the reader watching nothing happen.
        if (!pool) return procedural[Math.floor(Math.random() * procedural.length)];

        // Debt in favour of whichever family is behind on SHOWN flashes.
        // Clamped so a long outage cannot mortgage the whole session.
        const debt = Math.max(-3, Math.min(3, this._blendDebt || 0));
        const proceduralChance = 0.5 - debt * 0.12;

        const useProcedural = Math.random() < proceduralChance;
        const family = useProcedural ? procedural : pool;
        return family[Math.floor(Math.random() * family.length)];
    }

    /** Has this sourced category got at least one asset ready to show? */
    _categoryHasAsset(type) {
        if (type === 'diagram') {
            // The unfiltered pool: ready if any external asset is retained
            return [...(this._assetPools?.values?.() || [])]
                .some(pool => pool?.images?.length > 0);
        }
        const pool = this._assetPools?.get?.(type);
        return !!pool && pool.images.length > 0;
    }

    /**
     * Record what the reader actually saw, so the next Blend draw can
     * repay whichever family is behind. Positive debt means procedural
     * is ahead.
     */
    _recordBlendOutcome(type, shown) {
        if (!type) return;
        const isSourced = this._isExternalCategory(type) || type === 'diagram';
        if (shown) {
            this._blendDebt = (this._blendDebt || 0) + (isSourced ? -1 : 1);
        } else if (isSourced) {
            // A skipped sourced flash is exactly the invisible loss this
            // mechanism exists to repay.
            this._blendDebt = (this._blendDebt || 0) + 1;
        }
        this._blendDebt = Math.max(-4, Math.min(4, this._blendDebt));
    }

    _showAsciiFrame(frame) {
        if (!frame || !this.asciiRenderer?.render(frame)) return false;
        this._asciiCanvas.hidden = false;
        return true;
    }

    _presentationResult(requestedDurationMs, reason, {
        presented = false,
        presentedDurationMs = 0
    } = {}) {
        return {
            presented,
            requestedDurationMs: normalizeVisualPresence(requestedDurationMs),
            presentedDurationMs: Math.max(0, Math.round(presentedDurationMs)),
            reason
        };
    }

    _hidePresentationOverlay() {
        if (!this.container) return;
        this.container.hidden = true;
        this.container.classList?.remove('presentation-behind-stream');
        this.container.style.display = '';
        this.container.style.opacity = '';
        this.container.style.transition = '';
        this.container.style.zIndex = '';
    }

    _settlePresentation(active, result) {
        if (!active || active.settled) return;
        active.settled = true;
        active.cleanupCover?.();
        active.cleanupCover = null;
        active.frameIds.forEach(frameId => cancelAnimationFrame(frameId));
        active.frameIds.clear();
        if (this._activePresentation === active) this._activePresentation = null;
        this._hidePresentationOverlay();
        active.resolve(result);
        if (this._pendingKleeResize) {
            this._pendingKleeResize = false;
            this._resizeKleeCanvas();
        }
    }

    cancelPresentation(reason = 'aborted') {
        this._presentationEpoch++;
        this._lastCancellationReason = reason;
        const active = this._activePresentation;
        if (!active) {
            this._hidePresentationOverlay();
            return false;
        }
        // startedAt is null when cancelled before the commit frame —
        // nothing was ever visible
        const visibleDuration = active.startedAt === null
            ? 0
            : Math.max(0, performance.now() - active.startedAt);
        this._settlePresentation(
            active,
            this._presentationResult(active.requestedDurationMs, reason, {
                presented: false,
                presentedDurationMs: visibleDuration
            })
        );
        return true;
    }

    _presentRenderedVisual(duration, lifecycle = {}) {
        const requestedDurationMs = normalizeVisualPresence(duration);
        const reducedMotion = (typeof document !== 'undefined'
            && document.documentElement.classList.contains('reduced-motion'))
            || (typeof window !== 'undefined'
                && typeof window.matchMedia === 'function'
                && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        const transition = reducedMotion
            ? { enterMs: 0, exitMs: 0 }
            : visualPresenceTransition(requestedDurationMs);

        // Behind-stream presents beneath the reading text: the text is
        // never concealed, so there is no covered phase to await and no
        // concealed swap to protect. The overlay drops below the atom
        // stream and the opaque wash is removed by the surface class.
        const behindStream = this.config.presentation === 'behind-stream';

        this.cancelPresentation('aborted');
        this.container.hidden = false;
        this.container.classList?.toggle('presentation-behind-stream', behindStream);
        this.container.style.display = 'flex';
        this.container.style.zIndex = behindStream ? '' : '9999';
        this.container.style.transition = transition.enterMs > 0
            ? `opacity ${transition.enterMs}ms ease-out`
            : 'none';
        this.container.style.opacity = transition.enterMs > 0 ? '0' : '1';

        return new Promise(resolve => {
            // PRESENTATION CLOCK CONTRACT: every timing anchor is set on
            // the COMMIT frame — the animation frame that actually starts
            // the enter transition — never at Promise construction. A
            // delayed first frame therefore delays the whole schedule
            // instead of letting "covered" lap the fade and expose the
            // concealed text swap this machinery exists to hide.
            const active = {
                requestedDurationMs,
                startedAt: null,
                targetAt: Infinity,
                exitAt: Infinity,
                coveredAt: Infinity,
                transition,
                // Behind-stream never covers the text, so the caller's
                // covered hook must never fire: it exists to swap text
                // behind an opaque overlay, and firing it here would
                // perform that swap in full view mid-presence. The
                // completed atom holds on screen; the player commits
                // the next atom when the presence resolves.
                onCovered: !behindStream && typeof lifecycle.onCovered === 'function'
                    ? lifecycle.onCovered
                    : null,
                covered: false,
                exiting: false,
                frameIds: new Set(),
                cleanupCover: null,
                resolve,
                settled: false
            };
            this._activePresentation = active;

            const anchor = timestamp => {
                active.startedAt = timestamp;
                active.targetAt = timestamp + requestedDurationMs;
                active.exitAt = timestamp + requestedDurationMs - transition.exitMs;
                active.coveredAt = timestamp + (transition.enterMs > 0
                    ? transition.enterMs + COVER_SETTLE_FRAME_MS
                    : 0);
            };

            const schedule = callback => {
                let frameId;
                let firedSynchronously = false;
                frameId = requestAnimationFrame(timestamp => {
                    firedSynchronously = true;
                    if (frameId !== undefined) active.frameIds.delete(frameId);
                    callback(timestamp);
                });
                // Some test and embedded runtimes execute RAF callbacks inline.
                // Do not retain an already-fired id in the cancellation set.
                if (!firedSynchronously) active.frameIds.add(frameId);
            };

            const notifyCovered = () => {
                if (active.covered || active.settled) return;
                active.covered = true;
                try {
                    active.onCovered?.();
                } catch (error) {
                    console.warn('[Visual Cortex] Covered-phase hook failed:', error);
                }
            };

            // The overlay is only trustably opaque when the browser says
            // so: computed opacity is the ground truth the fallback path
            // must consult before declaring cover.
            const overlayOpaque = () => {
                try {
                    const opacity = parseFloat(
                        getComputedStyle(this.container).opacity);
                    return !Number.isFinite(opacity) || opacity >= 0.99;
                } catch (e) {
                    return true; // headless environments have no cascade
                }
            };

            const check = timestamp => {
                if (active.settled || this._activePresentation !== active) return;
                // Fallback cover (transitionend can be lost to a hidden
                // tab or an interrupted transition): time elapsed AND the
                // overlay is verifiably opaque.
                if (!active.covered && timestamp >= active.coveredAt && overlayOpaque()) {
                    notifyCovered();
                }
                if (!active.exiting && transition.exitMs > 0 && timestamp >= active.exitAt) {
                    active.exiting = true;
                    this.container.style.transition = `opacity ${transition.exitMs}ms ease-in`;
                    this.container.style.opacity = '0';
                }
                if (timestamp >= active.targetAt) {
                    this._settlePresentation(
                        active,
                        this._presentationResult(requestedDurationMs, 'presented', {
                            presented: true,
                            presentedDurationMs: requestedDurationMs
                        })
                    );
                    return;
                }
                schedule(check);
            };

            if (behindStream) {
                // Nothing is ever concealed, so there is no covered
                // phase at all (onCovered was nulled above): the reader
                // keeps the completed atom while the visual plays
                // beneath it. The full-frame cover machinery is
                // deliberately skipped, but the clock still starts on
                // the commit frame so the presence duration stays honest.
                schedule(timestamp => {
                    if (active.settled || this._activePresentation !== active) return;
                    anchor(timestamp);
                    this.container.style.opacity = '1';
                    notifyCovered();
                    schedule(check);
                });
            } else if (transition.enterMs > 0) {
                // Primary cover signal: the enter transition finishing.
                // (Optional-chained: headless containers have no events.)
                const onTransitionEnd = event => {
                    if (event.target === this.container
                        && event.propertyName === 'opacity'
                        && !active.exiting) {
                        notifyCovered();
                    }
                };
                this.container.addEventListener?.('transitionend', onTransitionEnd);
                active.cleanupCover = () => this.container.removeEventListener?.(
                    'transitionend', onTransitionEnd);

                schedule(timestamp => {
                    if (active.settled || this._activePresentation !== active) return;
                    // The commit frame: the transition begins here, and so
                    // does the presentation clock.
                    anchor(timestamp);
                    this.container.style.opacity = '1';
                    schedule(check);
                });
            } else {
                // The overlay is already opaque; concealed text can be prepared
                // in the same task before the browser paints either layer.
                anchor(performance.now());
                notifyCovered();
                schedule(check);
            }
        });
    }

    /**
     * Flash a visual interrupt based on current config or overrides.
     * @param {number} [durationOverride] - Optional duration override
     * @param {string} [typeOverride] - Optional type override ('klee', 'turrell', 'fractal', 'diagram')
     * @param {Object} [signal] - Optional semantic signal ({valence, arousal});
     *                            lets the flame queue pick its closest match
     * @param {Object} [lifecycle] - Presentation lifecycle hooks
     * @param {Function} [lifecycle.onCovered] - Runs once the overlay is fully
     *   opaque so the next text atom can be prepared behind it
    */
    async flash(durationOverride, typeOverride, signal, lifecycle = {}) {
        const duration = normalizeVisualPresence(durationOverride ?? this.config.duration);
        // Photosensitivity mode is a global safety override: no visual
        // interrupts, regardless of session config or prior consent.
        if (typeof document !== 'undefined'
            && document.documentElement.classList.contains('photosensitivity-mode')) {
            return this._presentationResult(duration, 'photosensitivity');
        }
        if (!hasVisualInterlocutionConsent()) {
            return this._presentationResult(duration, 'consent');
        }
        // Preflight the safety envelope without spending a slot. A missing or
        // unrenderable asset must not suppress the next valid visual frame.
        if (!this._flashGate.canAllow(performance.now(), duration)) {
            return this._presentationResult(duration, 'cadence');
        }
        const presentationEpoch = this._presentationEpoch;

        if (!this.initialized) this.init();
        if (!this.container) return this._presentationResult(duration, 'render-failed');

        let selectedType = typeOverride;

        // If no type specified, pick randomly from active types
        if (!selectedType) {
            const types = this.config.activeTypes;
            if (types.length === 0) {
                return this._presentationResult(duration, 'source-unavailable');
            }
            // Two-stage Blend selection: first choose the FAMILY
            // (procedural vs sourced), then uniformly within it. A flat
            // pick over the combined list let richer curation silently
            // suppress the procedural signature (one procedural + four
            // categories = 80% imagery).
            const procedural = types.filter(t => !this._isExternalCategory(t) && t !== 'diagram');
            const sourced = types.filter(t => this._isExternalCategory(t) || t === 'diagram');
            if (procedural.length > 0 && sourced.length > 0) {
                selectedType = this._selectBlendType(procedural, sourced);
            } else {
                selectedType = types[Math.floor(Math.random() * types.length)];
            }
        }
        
        // Map global-pool to custom logic
        if (selectedType === 'global-pool') {
            selectedType = 'global';
        }
        // A stale plan/type override can bypass updateConfig. Honor the Met
        // retirement promise without attempting a provider or showing a blank
        // frame: use procedural Klee when it is available.
        if (this._isRetiredExternalType(selectedType)) {
            if (!this.kleeFlashes || !this._kleeCanvas) {
                return this._presentationResult(duration, 'source-unavailable');
            }
            selectedType = 'klee';
        }

        // Generate content
        const kleeEl = document.getElementById('klee-canvas');
        const turrellEl = document.getElementById('turrell-field');
        const fractalEl = document.getElementById('fractal-canvas');
        const neuralEl = document.getElementById('neural-canvas');
        const asciiMode = this.config.renderLanguage === 'ascii';

        // Reset visibility
        if (kleeEl) kleeEl.hidden = true;
        if (turrellEl) turrellEl.hidden = true;
        if (fractalEl) fractalEl.hidden = true;
        if (neuralEl) neuralEl.hidden = true;
        if (this._asciiCanvas) this._asciiCanvas.hidden = true;
        if (this.diagramEl) this.diagramEl.hidden = true;
        if (this.customImageEl) this.customImageEl.hidden = true;

        let asciiFrame = null;
        let rendered = false;

        if (selectedType === 'klee' && this.kleeFlashes && this._kleeCanvas) {
            // Subliminal flashes are still frames — the artwork's episode
            // evolves between appearances, never during a cut. (In-flash
            // animation was removed: durations are capped at 200ms, below
            // any threshold where nested motion reads as anything but flicker.)
            this._resizeKleeCanvas();
            if (asciiMode) {
                asciiFrame = await this.kleeFlashes.createAsciiFlash(duration, signal, {
                    displayWidth: this._asciiCanvas?.width,
                    displayHeight: this._asciiCanvas?.height
                });
            } else {
                rendered = await this.kleeFlashes.renderFlash(this._kleeCanvas, duration, signal);
                if (rendered && kleeEl) kleeEl.hidden = false;
            }
        } else if (selectedType === 'turrell' && this.turrell) {
            const fieldPlan = this.turrell.generate();
            if (asciiMode) {
                asciiFrame = compileFieldPlanToAscii(
                    fieldPlan,
                    this._asciiOptions(signal, { source: 'turrell' })
                );
            } else {
                rendered = true;
                if (turrellEl) turrellEl.hidden = false;
            }
        } else if (selectedType === 'fractal' && this.fractal) {
            if (asciiMode) {
                const item = this.fractal.takeFrame(signal);
                if (item) {
                    item.asciiFrame ||= await this.asciiCompiler.compileImageData(
                        item.imageData,
                        this._asciiOptions(signal, { source: 'fractal' })
                    );
                    asciiFrame = item.asciiFrame;
                }
            } else {
                rendered = this.fractal.generate(signal);
            }
            if (!asciiFrame && !rendered) {
                console.warn('[Visual Cortex] Fractal not ready, skipping flash.');
                return this._presentationResult(duration, 'render-failed');
            }
            if (!asciiMode && fractalEl) fractalEl.hidden = false;
        } else if (selectedType === 'neural' && this.neural) {
            const success = this.neural.generate();
            if (!success) {
                console.warn('[Visual Cortex] Neural not ready, skipping flash.');
                return this._presentationResult(duration, 'render-failed');
            }
            if (asciiMode) {
                asciiFrame = this._neuralAsciiFrame(signal);
            } else {
                rendered = true;
                if (neuralEl) neuralEl.hidden = false;
            }
        } else if (this.diagramEl && (selectedType === 'diagram' || this._isExternalCategory(selectedType))) {
            try {
                const requestedCategory = selectedType !== 'diagram' ? selectedType : null;
                const diagram = this._getNextDiagram(requestedCategory);
                if (!diagram || !diagram.img) {
                    // Explicit source choices are a veto. An unavailable frame
                    // becomes intentional stillness; it never injects Klee or
                    // blocks the reading clock on a network request.
                    // The Blend ledger records the silent loss so the next
                    // draw can repay it (see _selectBlendType).
                    this._recordBlendOutcome(selectedType, false);
                    this._externalStatus.skippedFlashes++;
                    this._scheduleBackgroundWarm(false);
                    return this._presentationResult(duration, 'source-unavailable');
                }
                if (asciiMode) {
                    asciiFrame = diagram.asciiFrame;
                    if (!asciiFrame) {
                        this._externalStatus.skippedFlashes++;
                        return this._presentationResult(duration, 'source-unavailable');
                    }
                } else {
                    this.diagramEl.src = diagram.img.src;
                    this.diagramEl.alt = diagram.name || 'External Asset';
                    this.diagramEl.hidden = false;
                    rendered = true;
                }
            } catch (err) {
                this._externalStatus.skippedFlashes++;
                this._recordExternalFailure(selectedType, 'flash-select', err);
                this._scheduleBackgroundWarm(false);
                return this._presentationResult(duration, 'render-failed');
            }
        } else if (selectedType === 'harmonograph' && this.harmonograph && this._kleeCanvas) {
            // The conductor's instrument: the signal picks a musical
            // interval, the pendulums draw it (still frame, shares the
            // klee canvas like the rock garden)
            this._resizeKleeCanvas();
            this.harmonograph.generate(signal, undefined, {
                climate: this.config.harmonographClimate
            });
            if (asciiMode) {
                asciiFrame = this._harmonographAsciiFrame(signal);
            } else {
                rendered = this.harmonograph.render(this._kleeCanvas);
                if (rendered && kleeEl) kleeEl.hidden = false;
            }
        } else if (selectedType === 'blueprint' && this.blueprint && this._kleeCanvas) {
            // The drafting plate: for passages about mechanism, where a
            // museum holds portraits of inventors rather than pictures
            // of inventions (see ATRIUM-IMAGERY-CLASSIFICATION.md).
            // Still frame, shares the klee canvas like the harmonograph.
            this._resizeKleeCanvas();
            this.blueprint.generate(signal, undefined, {
                climate: this.config.blueprintClimate,
                mechanism: this.config.blueprintMechanism
            });
            if (asciiMode) {
                asciiFrame = this._blueprintAsciiFrame(signal);
            } else {
                rendered = this.blueprint.render(this._kleeCanvas);
                if (rendered && kleeEl) kleeEl.hidden = false;
            }
        } else if (selectedType === 'freedom' && this.freedom && this._kleeCanvas) {
            // The liberation field: the imperial wash stripped back to
            // the freed flag beneath. The relation comes from the Atrium
            // launch that curated it (see freedom.js).
            this._resizeKleeCanvas();
            this.freedom.generate(signal, undefined, {
                relation: this.config.freedomRelation
            });
            if (asciiMode) {
                asciiFrame = this._freedomAsciiFrame(signal);
            } else {
                rendered = this.freedom.render(this._kleeCanvas);
                if (rendered && kleeEl) kleeEl.hidden = false;
            }
        } else if (selectedType === 'rockgarden' && this.rockgarden && this._kleeCanvas) {
            // Generate Rock Garden (uses same canvas as Klee)
            this.rockgarden.generateRockGarden({
                width: this._kleeCanvas.width,
                height: this._kleeCanvas.height
            });
            if (asciiMode) {
                asciiFrame = this._rockGardenAsciiFrame(signal);
            } else {
                rendered = this.rockgarden.renderRockGarden(this._kleeCanvas, {
                    backgroundColor: ASCII_BACKGROUND,
                    strokeColor: 'rgba(232, 232, 236, 0.8)',
                    brushStroke: true
                });
                if (rendered !== false && kleeEl) kleeEl.hidden = false;
                rendered = rendered !== false;
            }
        } else if (selectedType === 'custom' && this.customImageEl && this.config.customVisuals.length > 0) {
            const visuals = this.config.customVisuals;
            const customUri = visuals[Math.floor(Math.random() * visuals.length)];
            if (asciiMode) {
                asciiFrame = this._localAsciiAssets.get(customUri) || null;
            } else {
                this.customImageEl.src = customUri;
                this.customImageEl.alt = 'Custom Sequence Frame';
                this.customImageEl.hidden = false;
                rendered = true;
            }
        } else if (selectedType === 'global' && this.customImageEl) {
            const globals = this._globalVisualUris();
            if (globals.length > 0) {
                const globalUri = globals[Math.floor(Math.random() * globals.length)];
                if (asciiMode) {
                    asciiFrame = this._localAsciiAssets.get(globalUri) || null;
                } else {
                    this.customImageEl.src = globalUri;
                    this.customImageEl.alt = 'Global Pool Frame';
                    this.customImageEl.hidden = false;
                    rendered = true;
                }
            }
        } else if (selectedType.startsWith('personal:') && this.customImageEl) {
            // Personal Sequence Images mapping
            const blueprintId = selectedType.split(':')[1];
            if (blueprintId) {
                const blueprints = MemoryCore.getWorkshopBlueprints();
                const bp = blueprints.find(b => b.id === blueprintId);
                if (bp && bp.customVisuals && bp.customVisuals.length > 0) {
                    const personalUri = bp.customVisuals[Math.floor(Math.random() * bp.customVisuals.length)];
                    if (asciiMode) {
                        asciiFrame = this._localAsciiAssets.get(personalUri) || null;
                    } else {
                        this.customImageEl.src = personalUri;
                        this.customImageEl.alt = 'Personal Sequence Frame';
                        this.customImageEl.hidden = false;
                        rendered = true;
                    }
                }
            }
        }

        // Rendering Klee/ASCII can cross an asynchronous boundary. A user
        // kill, pause, or safety-mode change during that work must not let
        // the completed render rebound onto the screen afterward.
        if (presentationEpoch !== this._presentationEpoch) {
            return this._presentationResult(
                duration,
                this._lastCancellationReason || 'aborted'
            );
        }

        if (asciiMode) rendered = this._showAsciiFrame(asciiFrame);
        if (!rendered) return this._presentationResult(duration, 'render-failed');
        if (!this._flashGate.commit(performance.now(), duration)) {
            return this._presentationResult(duration, 'cadence');
        }

        // Past the gate the flash genuinely reaches the reader, so this
        // is the only honest place to record what they saw.
        this._recordBlendOutcome(selectedType, true);

        return this._presentRenderedVisual(duration, lifecycle);
    }

    destroy() {
        this.cancelPresentation('aborted');
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
        this._externalPoolBag.clear();
        this._recentExternalUrls = [];
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
        this.asciiCompiler?.destroy?.();
        this.asciiCompiler = null;
        this.asciiRenderer = null;
        this._asciiScratchCanvas = null;
        this._localAsciiAssets.clear();
        this.klee?.destroy?.();
        this.initialized = false;
    }
}

// Singleton instance
export const visualCortex = new VisualCortex();
