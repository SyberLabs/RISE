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

    it('renders Klee ASCII from the same seeded progressive episode geometry', async () => {
        const { flashes, engine } = makeFlashes();
        engine.palette = ['#ffaa66'];
        engine.lines = [{
            colorIndex: 0,
            alpha: 1,
            weight: 1,
            points: [[0, 0], [400, 200], [800, 0]]
        }];
        engine.forms = [];
        flashes.configure({ preset: 'harmonic' });

        const first = await flashes.createAsciiFlash(80, null, { columns: 48, rows: 24 });
        const seed = flashes.episode.seed;
        const second = await flashes.createAsciiFlash(80, null, { columns: 48, rows: 24 });

        expect(first.metadata.source).toBe('klee');
        expect(second.metadata.seed).toBe(seed);
        expect(second.metadata.progress).toBeGreaterThan(first.metadata.progress);
        expect(second.glyphs).toMatch(/^[\x20-\x7e]+$/);
        expect(engine.render).not.toHaveBeenCalled();
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

    it('normalizes render language independently of the active source set', () => {
        const cortex = new VisualCortex();
        cortex.updateConfig({ renderLanguage: 'ascii', activeTypes: ['klee'] });
        expect(cortex.config.renderLanguage).toBe('ascii');
        expect(cortex.config.activeTypes).toEqual(['klee']);

        cortex.updateConfig({ renderLanguage: 'ansi' });
        expect(cortex.config.renderLanguage).toBe('native');
    });

    it('treats a configured Global Pool subset, including empty, as authoritative', () => {
        const cortex = new VisualCortex();
        const selected = 'data:image/png;base64,SELECTED';

        cortex.updateConfig({ globalVisuals: [selected, selected, 'https://not-local.test/image.jpg'] });
        expect(cortex._globalVisualUris()).toEqual([selected]);

        cortex.updateConfig({ globalVisuals: [] });
        expect(cortex._globalVisualUris()).toEqual([]);
    });

    it('routes a Klee flash through the structural ASCII adapter, not native canvas render', async () => {
        grantVisualInterlocutionConsent();
        const cortex = new VisualCortex();
        const createAsciiFlash = vi.fn().mockResolvedValue({ layers: [['x']], palette: ['white'] });
        const renderFlash = vi.fn();
        cortex.initialized = true;
        cortex.container = { hidden: true, style: {} };
        cortex._kleeCanvas = {};
        cortex.kleeFlashes = { createAsciiFlash, renderFlash };
        cortex._asciiCanvas = { hidden: true, width: 800, height: 400 };
        cortex.asciiRenderer = { render: vi.fn(() => true) };
        cortex._flashGate = { canAllow: () => true, commit: () => true };
        cortex._resizeKleeCanvas = vi.fn();
        cortex.updateConfig({ renderLanguage: 'ascii', activeTypes: ['klee'] });
        // Inline RAF whose clock keeps advancing: under commit-frame
        // anchoring the presentation clock starts at the first frame,
        // so each subsequent frame must move time forward to settle.
        let inlineFrameClock = performance.now();
        const raf = vi.spyOn(globalThis, 'requestAnimationFrame')
            .mockImplementation(callback => callback(inlineFrameClock += 1000));

        const result = await cortex.flash(33, 'klee', { valence: 0.2, arousal: 0.7 });

        expect(createAsciiFlash).toHaveBeenCalledOnce();
        expect(renderFlash).not.toHaveBeenCalled();
        expect(cortex.asciiRenderer.render).toHaveBeenCalledOnce();
        expect(cortex._asciiCanvas.hidden).toBe(false);
        expect(result).toMatchObject({
            presented: true,
            requestedDurationMs: 150,
            presentedDurationMs: 150,
            reason: 'presented'
        });
        raf.mockRestore();
    });
});

describe('VisualCortex flash timing', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        delete window.matchMedia;
        document.documentElement.classList.remove('reduced-motion');
    });

    it('keeps a rendered 200ms flash visible for the full configured duration', async () => {
        grantVisualInterlocutionConsent();
        const cortex = new VisualCortex();
        cortex.initialized = true;
        cortex.container = { hidden: true, style: {} };
        cortex._kleeCanvas = {};
        cortex._resizeKleeCanvas = vi.fn();
        cortex.kleeFlashes = { renderFlash: vi.fn().mockResolvedValue(true) };

        let now = 1000;
        const frames = [];
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
            frames.push(callback);
            return frames.length;
        });

        const onCovered = vi.fn();
        const flashing = cortex.flash(200, 'klee', undefined, { onCovered });
        await Promise.resolve();
        await Promise.resolve();

        expect(cortex.container.hidden).toBe(false);
        expect(onCovered).toHaveBeenCalledTimes(1);
        expect(frames).toHaveLength(1);

        now = 1199;
        frames.shift()(now);
        expect(cortex.container.hidden).toBe(false);
        expect(frames).toHaveLength(1);

        now = 1200;
        frames.shift()(now);
        await expect(flashing).resolves.toMatchObject({
            presented: true,
            requestedDurationMs: 200,
            presentedDurationMs: 200,
            reason: 'presented'
        });
        expect(cortex.container.hidden).toBe(true);
    });

    it('prepares concealed content only after a fading overlay is fully opaque', async () => {
        const cortex = new VisualCortex();
        cortex.container = { hidden: true, style: {} };
        let now = 1000;
        const frames = [];
        const onCovered = vi.fn();
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
            frames.push(callback);
            return frames.length;
        });

        const presenting = cortex._presentRenderedVisual(700, { onCovered });

        now = 1016;
        frames.shift()(now); // Commit frame: the 64ms transition AND the clock begin here.
        expect(onCovered).not.toHaveBeenCalled();

        now = 1070;
        frames.shift()(now);
        expect(onCovered).not.toHaveBeenCalled();

        // Old absolute anchoring would have declared cover at 1080
        // (call time + enter + settle); the commit-frame contract says
        // 1016 + 64 + settle = 1096
        now = 1090;
        frames.shift()(now);
        expect(onCovered).not.toHaveBeenCalled();

        now = 1100;
        frames.shift()(now);
        expect(onCovered).toHaveBeenCalledTimes(1);

        now = 1800;
        while (frames.length > 0) frames.shift()(now);
        await presenting;

        expect(onCovered).toHaveBeenCalledTimes(1);
        expect(cortex.container.hidden).toBe(true);
    });

    it('a delayed first frame delays cover — never lapping the fade (P1-3)', async () => {
        const cortex = new VisualCortex();
        cortex.container = { hidden: true, style: {} };
        let now = 1000;
        const frames = [];
        const onCovered = vi.fn();
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
            frames.push(callback);
            return frames.length;
        });

        const presenting = cortex._presentRenderedVisual(700, { onCovered });

        // The audit's race: the main thread stalls and the FIRST frame
        // arrives long after call-time + enterMs. Under absolute
        // anchoring, this frame both began the fade and declared cover.
        now = 1500;
        frames.shift()(now); // commit frame, transition starts NOW
        expect(onCovered).not.toHaveBeenCalled();

        now = 1519; // past the old absolute coveredAt — still fading
        frames.shift()(now);
        expect(onCovered).not.toHaveBeenCalled();

        now = 1600; // 1500 + 64 + settle < 1600 — genuinely opaque
        frames.shift()(now);
        expect(onCovered).toHaveBeenCalledTimes(1);

        now = 2400;
        while (frames.length > 0) frames.shift()(now);
        await presenting;
        expect(onCovered).toHaveBeenCalledTimes(1);
    });

    it('cancels a long presence synchronously with an aborted result', async () => {
        grantVisualInterlocutionConsent();
        const cortex = new VisualCortex();
        cortex.initialized = true;
        cortex.container = { hidden: true, style: {} };
        cortex._kleeCanvas = {};
        cortex._resizeKleeCanvas = vi.fn();
        cortex.kleeFlashes = { renderFlash: vi.fn().mockResolvedValue(true) };

        let now = 1000;
        const frames = [];
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
            frames.push(callback);
            return frames.length;
        });
        vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});

        const flashing = cortex.flash(2000, 'klee');
        await Promise.resolve();
        await Promise.resolve();
        // Commit frame fires — the presentation clock (and visible
        // time) begins here, not at call time
        frames.shift()(1000);
        now = 1450;
        expect(cortex.cancelPresentation()).toBe(true);

        await expect(flashing).resolves.toMatchObject({
            presented: false,
            requestedDurationMs: 2000,
            presentedDurationMs: 450,
            reason: 'aborted'
        });
        expect(cortex.container.hidden).toBe(true);
    });

    it('does not present a render that finishes after a safety cancellation', async () => {
        grantVisualInterlocutionConsent();
        const cortex = new VisualCortex();
        cortex.initialized = true;
        cortex.container = { hidden: true, style: {} };
        cortex._kleeCanvas = {};
        cortex._resizeKleeCanvas = vi.fn();
        let finishRender;
        cortex.kleeFlashes = {
            renderFlash: vi.fn(() => new Promise(resolve => { finishRender = resolve; }))
        };
        cortex._flashGate = { canAllow: () => true, commit: vi.fn(() => true) };

        const flashing = cortex.flash(700, 'klee');
        await Promise.resolve();
        expect(cortex.cancelPresentation('user-disabled')).toBe(false);
        finishRender(true);

        await expect(flashing).resolves.toMatchObject({
            presented: false,
            presentedDurationMs: 0,
            reason: 'user-disabled'
        });
        expect(cortex._flashGate.commit).not.toHaveBeenCalled();
        expect(cortex.container.hidden).toBe(true);
    });

    it('cancelling before any frame committed reports zero visible time', async () => {
        const cortex = new VisualCortex();
        cortex.container = { hidden: true, style: {} };
        let now = 1000;
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1);
        vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});

        const presenting = cortex._presentRenderedVisual(2000);
        now = 1450; // wall time passed, but no frame ever painted
        expect(cortex.cancelPresentation()).toBe(true);

        await expect(presenting).resolves.toMatchObject({
            presented: false,
            presentedDurationMs: 0,
            reason: 'aborted'
        });
    });

    it.each([150, 700, 2000])(
        'includes transitions inside a %dms total presence',
        async duration => {
            const cortex = new VisualCortex();
            cortex.container = { hidden: true, style: {} };
            let now = 1000;
            const frames = [];
            vi.spyOn(performance, 'now').mockImplementation(() => now);
            vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
                frames.push(callback);
                return frames.length;
            });

            const presenting = cortex._presentRenderedVisual(duration);
            expect(cortex.container.hidden).toBe(false);
            // The commit frame starts the presentation clock; each
            // subsequent frame advances beyond the full presence
            while (frames.length > 0) {
                frames.shift()(now);
                now += duration;
            }

            await expect(presenting).resolves.toMatchObject({
                presented: true,
                requestedDurationMs: duration,
                presentedDurationMs: duration,
                reason: 'presented'
            });
            expect(cortex.container.hidden).toBe(true);
        }
    );

    it('removes fades under reduced motion without shortening presence', async () => {
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: vi.fn(() => ({ matches: true }))
        });
        const cortex = new VisualCortex();
        cortex.container = { hidden: true, style: {} };
        let now = 1000;
        const frames = [];
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
            frames.push(callback);
            return frames.length;
        });

        const presenting = cortex._presentRenderedVisual(700);
        expect(cortex.container.style.transition).toBe('none');
        expect(cortex.container.style.opacity).toBe('1');
        now = 1700;
        frames.shift()(now);

        await expect(presenting).resolves.toMatchObject({
            presented: true,
            presentedDurationMs: 700
        });
    });

    it('honors the app-level reduced-motion class as well as the OS preference', async () => {
        document.documentElement.classList.add('reduced-motion');
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: vi.fn(() => ({ matches: false }))
        });
        const cortex = new VisualCortex();
        cortex.container = { hidden: true, style: {} };
        let now = 1000;
        const frames = [];
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
            frames.push(callback);
            return frames.length;
        });

        const presenting = cortex._presentRenderedVisual(700);
        expect(cortex.container.style.transition).toBe('none');
        expect(cortex.container.style.opacity).toBe('1');

        now = 1700;
        frames.shift()(now);
        await expect(presenting).resolves.toMatchObject({
            presented: true,
            presentedDurationMs: 700
        });
    });

    it('aborts an active presence when the visual configuration changes', async () => {
        const cortex = new VisualCortex();
        cortex.container = { hidden: true, style: {} };
        let now = 1000;
        const frames = [];
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
            frames.push(callback);
            return frames.length;
        });
        vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});

        const presenting = cortex._presentRenderedVisual(2000);
        frames.shift()(1000); // commit frame — visible time begins
        now = 1250;
        cortex.updateConfig({ duration: 700 });

        await expect(presenting).resolves.toMatchObject({
            presented: false,
            presentedDurationMs: 250,
            reason: 'aborted'
        });
        expect(cortex.container.hidden).toBe(true);
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

    it('balances automatic exposure across stocked categories before repeating one', () => {
        const cortex = new VisualCortex();
        cortex.config.activeTypes = ['aic-oldmasters', 'aic-landscapes'];
        cortex._poolFor('aic-oldmasters').images.push({
            img: { src: 'master.jpg' }, category: 'aic-oldmasters'
        });
        cortex._poolFor('aic-landscapes').images.push({
            img: { src: 'landscape.jpg' }, category: 'aic-landscapes'
        });
        vi.spyOn(cortex, '_scheduleBackgroundWarm').mockImplementation(() => {});

        const first = cortex._getNextDiagram();
        const second = cortex._getNextDiagram();

        expect(new Set([first.category, second.category])).toEqual(
            new Set(['aic-oldmasters', 'aic-landscapes'])
        );
    });

    it('scales background variety to session demand without changing the one-image launch gate', async () => {
        const cortex = new VisualCortex();
        cortex.initialized = true;
        cortex.config.activeTypes = ['aic-oldmasters'];
        const preload = vi.spyOn(cortex, '_preloadDiagrams').mockResolvedValue({
            state: 'ready', minimumReady: true, targetSatisfied: true
        });
        vi.spyOn(cortex, '_scheduleBackgroundWarm').mockImplementation(() => {});

        await cortex.preload(12);

        expect(preload).toHaveBeenCalledWith(1);
        expect(cortex._sessionAssetTarget).toBe(12);
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

        const rendered = await cortex.flash(80, 'aic-oldmasters');

        expect(rendered).toMatchObject({
            presented: false,
            requestedDurationMs: 150,
            presentedDurationMs: 0,
            reason: 'source-unavailable'
        });
        expect(queueOverride).not.toHaveBeenCalled();
        expect(cortex._externalStatus.skippedFlashes).toBe(1);
        expect(cortex._flashGate.history).toHaveLength(0);
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

describe('VisualCortex behind-stream presentation', () => {
    afterEach(() => vi.restoreAllMocks());

    it('keeps the reading text visible: no opaque wash, below the stream', async () => {
        const classes = new Set();
        const cortex = new VisualCortex();
        cortex.container = {
            hidden: true,
            style: {},
            classList: {
                toggle: (name, on) => on ? classes.add(name) : classes.delete(name),
                remove: name => classes.delete(name)
            }
        };
        cortex.updateConfig({ presentation: 'behind-stream' });

        let now = 1000;
        const frames = [];
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(cb => {
            frames.push(cb);
            return frames.length;
        });

        const presenting = cortex._presentRenderedVisual(700);
        expect(classes.has('presentation-behind-stream')).toBe(true);
        // The full-frame overlay sits at 9999; behind-stream defers to CSS
        expect(cortex.container.style.zIndex).toBe('');

        now = 1016;
        while (frames.length > 0) {
            frames.shift()(now);
            now += 700;
        }
        await presenting;
        // Surface class is cleared on hide so a later full-frame flash
        // cannot inherit the behind-stream stacking
        expect(classes.has('presentation-behind-stream')).toBe(false);
    });

    it('never fires the covered hook — the text is never concealed', async () => {
        // The covered hook exists to swap text behind an opaque overlay.
        // Behind-stream has no overlay over the text: firing the hook
        // would perform that swap in full view, mid-presence. The
        // completed atom must hold until the presence resolves.
        const onCovered = vi.fn();
        const cortex = new VisualCortex();
        cortex.container = { hidden: true, style: {} };
        cortex.updateConfig({ presentation: 'behind-stream' });

        let now = 1000;
        const frames = [];
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(cb => {
            frames.push(cb);
            return frames.length;
        });

        const presenting = cortex._presentRenderedVisual(700, { onCovered });

        // Commit frame starts the clock but declares no cover
        now = 1016;
        frames.shift()(now);
        expect(onCovered).not.toHaveBeenCalled();

        now = 1800;
        while (frames.length > 0) frames.shift()(now);
        await expect(presenting).resolves.toMatchObject({
            presented: true,
            requestedDurationMs: 700
        });
        // Through the entire presence — including the fallback cover
        // check — the hook never fired
        expect(onCovered).not.toHaveBeenCalled();
    });
});
