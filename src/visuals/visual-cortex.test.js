/**
 * Klee flash architecture tests — the KleeFlashes wrapper owns the queue
 * and episode lifecycle; the cortex delegates. Includes regressions for the
 * review findings: queue survival across resizes and identical configs,
 * refill-on-low, preload failure recovery, and one-shot preset overrides.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisualCortex } from './visual-cortex.js';
import { KleeFlashes } from './klee-flashes.js';
import { grantVisualInterlocutionConsent } from '../core/visual-safety.js';

function mockEngine(width = 800, height = 400) {
    return {
        width,
        height,
        renderStyle: { texture: 0.02 },
        generateRandomAsync: vi.fn().mockResolvedValue(undefined),
        captureArtwork: vi.fn(() => ({ width, height, lines: [], forms: [], marker: Math.random() })),
        restoreArtwork: vi.fn(() => true),
        configurePresetStyle: vi.fn(),
        applySemanticSignal: vi.fn(),
        render: vi.fn(),
        destroy: vi.fn()
    };
}

function makeFlashes() {
    const engine = mockEngine();
    const flashes = new KleeFlashes(engine);
    flashes._preloadEngine = mockEngine(); // inject mock before preload
    return { flashes, engine, preloadEngine: flashes._preloadEngine };
}

describe('KleeFlashes', () => {
    afterEach(() => vi.restoreAllMocks());

    it('preloads snapshots and consumes them by preset', async () => {
        const { flashes, preloadEngine } = makeFlashes();
        flashes.configure({ preset: 'harmonic' });

        await flashes.preload(2);
        expect(preloadEngine.generateRandomAsync).toHaveBeenCalledTimes(2);
        expect(flashes.queue).toHaveLength(2);

        const taken = flashes._takeArtwork('harmonic', null);
        expect(taken.preset).toBe('harmonic');
    });

    it('refills in the background when the pool runs low', async () => {
        const { flashes } = makeFlashes();
        flashes.configure({ preset: 'harmonic' });
        await flashes.preload(4);
        expect(flashes.queue).toHaveLength(4);

        flashes._takeArtwork('harmonic', null);
        flashes._takeArtwork('harmonic', null);
        flashes._takeArtwork('harmonic', null); // below half target → refill armed
        expect(flashes._preloadPromise).not.toBeNull();
        await flashes._preloadPromise;
        expect(flashes.queue.length).toBeGreaterThanOrEqual(4);
    });

    it('keeps the queue when identical signal contents arrive under a new array reference', async () => {
        const { flashes } = makeFlashes();
        const signals = [{ valence: 0.2, arousal: 0.4 }, { valence: -0.5, arousal: 0.7 }];
        flashes.configure({ preset: 'random', signals });
        await flashes.preload(3);
        expect(flashes.queue).toHaveLength(3);

        // Same contents, fresh array (what app.js produces on re-apply)
        flashes.configure({ preset: 'random', signals: signals.map(s => ({ ...s })) });
        expect(flashes.queue).toHaveLength(3);

        // A real change flushes
        flashes.configure({ preset: 'random', signals: [{ valence: 0.9, arousal: 0.1 }] });
        expect(flashes.queue).toHaveLength(0);
    });

    it('keeps the queue across resizes (snapshots rescale on restore)', async () => {
        const { flashes } = makeFlashes();
        flashes.configure({ preset: 'harmonic' });
        await flashes.preload(3);

        flashes.resize(1920, 1080);
        expect(flashes.queue).toHaveLength(3);
        expect(flashes._preloadEngine.width).toBe(1920);
        const taken = flashes._takeArtwork('harmonic', null);
        expect(taken).not.toBeNull();
    });

    it('recovers when preload generation fails (no permanent deadlock)', async () => {
        const { flashes, preloadEngine } = makeFlashes();
        flashes.configure({ preset: 'harmonic' });
        preloadEngine.generateRandomAsync.mockRejectedValueOnce(new Error('worker destroyed'));

        await flashes.preload(2);          // aborts on the failure
        expect(flashes._preloadPromise).toBeNull(); // not stuck

        await flashes.preload(2);          // re-arms cleanly
        expect(flashes.queue.length).toBeGreaterThan(0);
    });

    it('continues an episode across flashes, then starts a seeded sibling', async () => {
        const { flashes, engine } = makeFlashes();
        flashes._sessionSeed = 'continuity-test';
        flashes.configure({ preset: 'gravitational' });

        const first = await flashes._prepareArtwork('gravitational', null);
        const continuation = await flashes._prepareArtwork('harmonic', { valence: 0, arousal: 0.5 });
        expect(continuation).toBe(first);   // running episode keeps its identity
        expect(engine.applySemanticSignal).toHaveBeenCalled();

        first.progress = 1;
        const sibling = await flashes._prepareArtwork('gravitational', null);
        expect(sibling).not.toBe(first);
        expect(engine.generateRandomAsync.mock.calls[0][1].seed).toBe('continuity-test:0:gravitational');
        expect(engine.generateRandomAsync.mock.calls[0][1].awaitEnhancements).toBe(false);
    });

    it('gives gravitational sessions a fresh seed on every run', () => {
        const { flashes } = makeFlashes();
        flashes.beginSession({ preset: 'gravitational' });
        const first = flashes._nextSeed('gravitational');

        flashes.beginSession({ preset: 'gravitational' });
        const second = flashes._nextSeed('gravitational');

        expect(second).not.toBe(first);
        expect(second).toMatch(/:0:gravitational$/);
    });

    it('applies a one-shot preset override without persisting it', async () => {
        const { flashes } = makeFlashes();
        flashes.configure({ preset: 'random' });
        flashes.queuePresetOverride('gravitational');
        flashes.queuePresetOverride('not-a-preset'); // ignored

        expect(flashes._choosePreset()).toBe('gravitational');
        expect(flashes.presetOverride).toBeNull(); // consumed
    });

    it('renders still frames whose progress advances between flashes, never during', async () => {
        const { flashes, engine } = makeFlashes();
        flashes.configure({ preset: 'harmonic' });
        const canvas = {};

        await flashes.renderFlash(canvas, 80, null);
        const progressAfterFirst = flashes.episode.progress;
        expect(progressAfterFirst).toBeGreaterThan(0);
        expect(engine.render).toHaveBeenCalledTimes(1);
        expect(engine.render.mock.calls[0][1].progress).toBe(progressAfterFirst);

        await flashes.renderFlash(canvas, 80, null);
        expect(flashes.episode.progress).toBeGreaterThan(progressAfterFirst);
    });
});

describe('VisualCortex Klee delegation', () => {
    it('queueKleePreset delegates to the wrapper', () => {
        const cortex = new VisualCortex();
        cortex.kleeFlashes = new KleeFlashes(mockEngine());
        cortex.queueKleePreset('harmonic');
        expect(cortex.kleeFlashes.presetOverride).toBe('harmonic');
    });

    it('sizes the backing canvas for DPR and forwards dimensions to the wrapper', () => {
        const cortex = new VisualCortex();
        Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
        cortex.container = { getBoundingClientRect: () => ({ width: 500, height: 300 }) };
        cortex._kleeCanvas = { width: 0, height: 0, clientWidth: 500, clientHeight: 300 };
        cortex.klee = mockEngine(0, 0);
        cortex.kleeFlashes = new KleeFlashes(cortex.klee);

        expect(cortex._resizeKleeCanvas()).toBe(true);
        expect(cortex._kleeCanvas.width).toBe(1000);
        expect(cortex._kleeCanvas.height).toBe(600);
        expect(cortex.klee.width).toBe(1000);
    });

    it('updateConfig forwards preset/signals to the wrapper via value comparison', () => {
        const cortex = new VisualCortex();
        cortex.kleeFlashes = new KleeFlashes(mockEngine());
        const spy = vi.spyOn(cortex.kleeFlashes, 'configure');

        cortex.updateConfig({ kleePreset: 'chaotic', semanticSignals: null });
        expect(spy).toHaveBeenCalledWith({ preset: 'chaotic', signals: null });
    });
});

describe('VisualCortex external asset hydration', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('removes retired Met ids before mixed-source hydration', async () => {
        const cortex = new VisualCortex();
        cortex.updateConfig({
            enabled: true,
            activeTypes: ['aic-oldmasters', 'met-egyptian']
        });
        const load = vi.spyOn(cortex, '_loadIntoPool').mockImplementation(async categoryId => {
            const asset = { img: { src: `${categoryId}.jpg` } };
            cortex._poolFor(categoryId).images.push(asset);
            return asset;
        });

        await cortex._preloadDiagrams(1);

        expect(cortex.config.activeTypes).toEqual(['aic-oldmasters']);
        expect(cortex._activePoolCategories()).toEqual(['aic-oldmasters']);
        expect(load).toHaveBeenCalledTimes(1);
        expect(load).toHaveBeenCalledWith('aic-oldmasters', expect.any(Object));
        expect(load).not.toHaveBeenCalledWith('met-egyptian', expect.anything());
    });

    it('migrates a retired Met-only preset to procedural Klee', () => {
        const cortex = new VisualCortex();

        cortex.updateConfig({ activeTypes: ['met-egyptian'] });

        expect(cortex.config.activeTypes).toEqual(['klee']);
        expect(cortex._activePoolCategories()).toEqual([]);
        expect(cortex._isExternalCategory('met-egyptian')).toBe(false);
    });

    it('retains warm artwork across near-max-frequency sampling', async () => {
        const cortex = new VisualCortex();
        cortex.config.activeTypes = ['aic-oldmasters'];
        const pool = cortex._poolFor('aic-oldmasters');
        pool.images.push(
            { img: { src: 'old-master-1.jpg' }, name: 'One' },
            { img: { src: 'old-master-2.jpg' }, name: 'Two' }
        );
        const load = vi.spyOn(cortex, '_loadIntoPool');
        vi.spyOn(cortex, '_scheduleBackgroundWarm').mockImplementation(() => {});

        const samples = [];
        for (let i = 0; i < 100; i++) {
            samples.push(await cortex._getNextDiagram('aic-oldmasters'));
        }

        expect(samples.every(Boolean)).toBe(true);
        expect(pool.images).toHaveLength(2); // sampled, never consumed
        expect(new Set(samples.map(asset => asset.img.src))).toEqual(
            new Set(['old-master-1.jpg', 'old-master-2.jpg'])
        );
        expect(load).not.toHaveBeenCalled();
    });

    it('coalesces concurrent cold requests for the same category', async () => {
        const cortex = new VisualCortex();
        const provider = {
            getRandom: vi.fn().mockResolvedValue({
                name: 'The retained image',
                data: { url: 'retained.jpg' }
            })
        };
        vi.spyOn(cortex, '_getProviderForCategory').mockResolvedValue(provider);
        const loadImage = vi.spyOn(cortex, '_loadImage').mockResolvedValue({
            img: { src: 'retained.jpg' },
            name: 'The retained image',
            category: 'aic-oldmasters'
        });

        const assets = await Promise.all(
            Array.from({ length: 12 }, () => cortex._loadIntoPool('aic-oldmasters'))
        );

        expect(assets.every(asset => asset?.img?.src === 'retained.jpg')).toBe(true);
        expect(provider.getRandom).toHaveBeenCalledTimes(1);
        expect(loadImage).toHaveBeenCalledTimes(1);
        expect(cortex._poolFor('aic-oldmasters').images).toHaveLength(1);
    });

    it('joins an active warm-up instead of reporting preload complete early', async () => {
        const cortex = new VisualCortex();
        cortex.config.activeTypes = ['aic-oldmasters'];
        let releaseFirst;
        const firstGate = new Promise(resolve => { releaseFirst = resolve; });
        let loadCount = 0;
        vi.spyOn(cortex, '_loadIntoPool').mockImplementation(async categoryId => {
            const pool = cortex._poolFor(categoryId);
            loadCount++;
            if (loadCount === 1) await firstGate;
            const asset = { img: { src: `${categoryId}-${loadCount}.jpg` } };
            pool.images.push(asset);
            return asset;
        });

        const warming = cortex._preloadDiagrams(2);
        await Promise.resolve();
        let joinedResolved = false;
        const joined = cortex._preloadDiagrams(2).then(() => { joinedResolved = true; });
        await Promise.resolve();

        expect(joinedResolved).toBe(false);
        releaseFirst();
        await Promise.all([warming, joined]);
        expect(cortex._poolFor('aic-oldmasters').images).toHaveLength(2);
    });

    it('re-arms hydration for a configuration that invalidates an active warm-up', async () => {
        const cortex = new VisualCortex();
        cortex.config.activeTypes = ['aic-oldmasters'];
        let releaseOldLoad;
        const oldGate = new Promise(resolve => { releaseOldLoad = resolve; });
        let firstLoad = true;
        vi.spyOn(cortex, '_loadIntoPool').mockImplementation(async categoryId => {
            // Capture the pool before awaiting, matching the production loader:
            // a config clear detaches obsolete work from the new map.
            const pool = cortex._poolFor(categoryId);
            if (firstLoad) {
                firstLoad = false;
                await oldGate;
            }
            const asset = { img: { src: `${categoryId}-${pool.images.length}.jpg` } };
            pool.images.push(asset);
            return asset;
        });

        const obsoleteWarm = cortex._preloadDiagrams(2);
        await Promise.resolve();
        cortex.updateConfig({ activeTypes: ['aic-landscapes'] });
        const sessionWarm = cortex._preloadDiagrams(2);
        releaseOldLoad();

        const [obsoleteStatus] = await Promise.all([obsoleteWarm, sessionWarm]);
        expect(obsoleteStatus.aborted).toBe(true);
        expect(cortex._assetPools.has('aic-oldmasters')).toBe(false);
        expect(cortex._poolFor('aic-landscapes').images).toHaveLength(2);
    });

    it('warms the grab-bag pool for a bare diagram selection', async () => {
        const cortex = new VisualCortex();
        cortex.config.activeTypes = ['diagram'];
        vi.spyOn(cortex, '_loadIntoPool').mockImplementation(async categoryId => {
            const pool = cortex._poolFor(categoryId);
            const asset = { img: { src: `${categoryId}-${pool.images.length}.jpg` } };
            pool.images.push(asset);
            return asset;
        });

        await cortex._preloadDiagrams(2);
        expect(cortex._poolFor('__any__').images).toHaveLength(2);
    });

    it('keeps an explicit category as a veto but lets auto selection use a retained sibling', () => {
        const cortex = new VisualCortex();
        cortex.config.activeTypes = ['aic-oldmasters', 'aic-landscapes'];
        const sibling = { img: { src: 'landscape.jpg' }, name: 'Landscape' };
        cortex._poolFor('aic-landscapes').images.push(sibling);
        const load = vi.spyOn(cortex, '_loadIntoPool');
        vi.spyOn(cortex, '_scheduleBackgroundWarm').mockImplementation(() => {});

        expect(cortex._getNextDiagram('aic-oldmasters')).toBeNull();
        expect(cortex._getNextDiagram(null)).toBe(sibling);
        expect(load).not.toHaveBeenCalled();
    });

    it('shares one bounded offline pass across many joined callers', async () => {
        const cortex = new VisualCortex();
        cortex.config.activeTypes = ['aic-oldmasters'];
        const load = vi.spyOn(cortex, '_loadIntoPool').mockResolvedValue(null);

        const statuses = await Promise.all(
            Array.from({ length: 20 }, () => cortex._preloadDiagrams(2))
        );

        // target 2 gets a bounded 2x attempt budget once — not once per caller.
        expect(load).toHaveBeenCalledTimes(4);
        expect(statuses.every(status => status.state === 'failed')).toBe(true);
        expect(statuses.every(status => status.minimumReady === false)).toBe(true);
    });

    it('reports zero-asset hydration honestly instead of treating it as ready', async () => {
        const cortex = new VisualCortex();
        cortex.config.activeTypes = ['aic-oldmasters', 'aic-landscapes'];
        vi.spyOn(cortex, '_loadIntoPool').mockResolvedValue(null);

        const status = await cortex._preloadDiagrams(1);

        expect(status).toMatchObject({
            state: 'failed',
            retained: 0,
            minimumReady: false,
            targetSatisfied: false
        });
        expect(status.categories['aic-oldmasters'].retained).toBe(0);
        expect(status.categories['aic-landscapes'].retained).toBe(0);
    });

    it('uses one decoded image per category as the launch gate regardless of flash count', async () => {
        const cortex = new VisualCortex();
        cortex.initialized = true;
        cortex.config.activeTypes = ['aic-oldmasters', 'aic-landscapes'];
        cortex._poolFor('aic-oldmasters').images.push({ img: { src: 'one.jpg' } });
        cortex._poolFor('aic-landscapes').images.push({ img: { src: 'two.jpg' } });
        cortex._refreshExternalStatus('ready', 1);
        const preload = vi.spyOn(cortex, '_preloadDiagrams').mockResolvedValue({
            state: 'ready', targetSatisfied: true
        });
        const background = vi.spyOn(cortex, '_scheduleBackgroundWarm').mockImplementation(() => {});

        await cortex.preload(10000);

        expect(preload).toHaveBeenCalledTimes(1);
        expect(preload).toHaveBeenCalledWith(1);
        expect(background).toHaveBeenCalledWith(true);
    });

    it('caps retained decoded images globally while preserving one per category', () => {
        const cortex = new VisualCortex();
        cortex.config.activeTypes = ['aic-oldmasters', 'aic-landscapes'];
        const assets = [];
        for (let i = 0; i < 30; i++) {
            const category = i % 2 ? 'aic-oldmasters' : 'aic-landscapes';
            const asset = {
                img: { src: `${i}.jpg` }, loadedAt: i, lastUsedAt: i
            };
            assets.push(asset);
            cortex._retainAsset(category, asset);
        }

        const total = [...cortex._assetPools.values()]
            .reduce((count, pool) => count + pool.images.length, 0);
        expect(total).toBe(18);
        expect(cortex._poolFor('aic-oldmasters').images.length).toBeGreaterThan(0);
        expect(cortex._poolFor('aic-landscapes').images.length).toBeGreaterThan(0);
        expect(assets.filter(asset => asset.img.src === '')).toHaveLength(12);
    });

    it('owns exactly one background retry chain and suspends it outside a session', async () => {
        vi.useFakeTimers();
        try {
            const cortex = new VisualCortex();
            cortex.config = {
                ...cortex.config,
                enabled: true,
                activeTypes: ['aic-oldmasters']
            };
            const preload = vi.spyOn(cortex, '_preloadDiagrams').mockResolvedValue({
                state: 'failed',
                targetSatisfied: false,
                aborted: false
            });

            cortex._scheduleBackgroundWarm(true);
            cortex._scheduleBackgroundWarm(true);
            await vi.advanceTimersByTimeAsync(0);

            expect(preload).toHaveBeenCalledTimes(1);
            expect(vi.getTimerCount()).toBe(1); // the one backoff retry

            cortex.updateConfig({ enabled: false });
            expect(vi.getTimerCount()).toBe(0);
            cortex._scheduleBackgroundWarm(true);
            expect(vi.getTimerCount()).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it('returns defensive external-status snapshots', () => {
        const cortex = new VisualCortex();
        cortex.config.activeTypes = ['aic-oldmasters'];
        cortex._recordExternalFailure(
            'aic-oldmasters',
            'hydrate',
            new Error('offline'),
            'art.jpg'
        );
        const snapshot = cortex._refreshExternalStatus('failed', 1);

        snapshot.lastError.message = 'mutated';
        snapshot.categories['aic-oldmasters'].retained = 99;

        expect(cortex.getExternalAssetStatus()).toMatchObject({
            lastError: { message: 'offline' },
            categories: { 'aic-oldmasters': { retained: 0 } }
        });
    });

    it('destroy aborts a stalled hydration task and prevents rearming', async () => {
        const cortex = new VisualCortex();
        cortex.config.activeTypes = ['aic-oldmasters'];
        let observedAbort = false;
        vi.spyOn(cortex, '_loadIntoPool').mockImplementation((categoryId, { signal }) =>
            new Promise(resolve => {
                const finish = () => {
                    observedAbort = true;
                    resolve(null);
                };
                if (signal.aborted) finish();
                else signal.addEventListener('abort', finish, { once: true });
            }));

        const warming = cortex._preloadDiagrams(1);
        await Promise.resolve();
        cortex.destroy();
        const status = await warming;

        expect(observedAbort).toBe(true);
        expect(status.state).toBe('destroyed');
        expect(cortex._poolWarmTask).toBeNull();
    });

    it('skips an unavailable explicit exposure without injecting procedural art', async () => {
        grantVisualInterlocutionConsent();
        const cortex = new VisualCortex();
        cortex.initialized = true;
        cortex.container = { hidden: true, style: {} };
        cortex.diagramEl = { hidden: false, src: '', alt: '' };
        cortex.config.activeTypes = ['aic-oldmasters'];
        vi.spyOn(cortex, '_getNextDiagram').mockReturnValue(null);
        vi.spyOn(cortex, '_scheduleBackgroundWarm').mockImplementation(() => {});
        const queueOverride = vi.fn();
        cortex.kleeFlashes = { queuePresetOverride: queueOverride };

        await cortex.flash(80, 'aic-oldmasters');

        expect(queueOverride).not.toHaveBeenCalled();
        expect(cortex._externalStatus.skippedFlashes).toBe(1);
        expect(cortex.container.hidden).toBe(true);
    });

    it('aborts detached image work and decodes successful images before retention', async () => {
        let pendingImage;
        class FakeImage {
            constructor() {
                pendingImage = this;
                this.decode = vi.fn().mockResolvedValue(undefined);
                this._src = '';
            }
            set src(value) { this._src = value; }
            get src() { return this._src; }
        }
        vi.stubGlobal('Image', FakeImage);
        const cortex = new VisualCortex();
        const controller = new AbortController();
        const aborted = cortex._loadImage('aborted.jpg', 'Aborted', 'aic-oldmasters', controller.signal);
        controller.abort();
        await expect(aborted).rejects.toMatchObject({ name: 'AbortError' });

        const loaded = cortex._loadImage('loaded.jpg', 'Loaded', 'aic-oldmasters');
        await pendingImage.onload();
        const asset = await loaded;

        expect(pendingImage.decode).toHaveBeenCalledTimes(1);
        expect(asset).toMatchObject({
            name: 'Loaded',
            category: 'aic-oldmasters',
            url: 'loaded.jpg'
        });
    });
});
