/**
 * Klee flash architecture tests — the KleeFlashes wrapper owns the queue
 * and episode lifecycle; the cortex delegates. Includes regressions for the
 * review findings: queue survival across resizes and identical configs,
 * refill-on-low, preload failure recovery, and one-shot preset overrides.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisualCortex } from './visual-cortex.js';
import { KleeFlashes } from './klee-flashes.js';
import { ContinuousField } from './continuous-field.js';
import { Ostensoria } from './ostensoria.js';
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

    it('applyCue renders a generic sourced cue as the active pool (Chapel-agnostic)', () => {
        const cortex = new VisualCortex();
        cortex.applyCue({ kind: 'sourced', collections: ['chapel-gospel-crucifixion'] });
        expect(cortex.config.activeTypes).toEqual(['chapel-gospel-crucifixion']);
        // a still cue suspends the sourced pool
        cortex.applyCue({ kind: 'still' });
        expect(cortex.config.activeTypes).toEqual([]);
        // a focal cue also stills the rhythmic pool (the focal is the
        // Chamber's concern, not the cortex's flash pool)
        cortex.applyCue({ kind: 'focal', focal: { type: 'rose' } });
        expect(cortex.config.activeTypes).toEqual([]);
        cortex.applyCue({ kind: 'field', renderer: 'attractor', config: { system: 'thomas' } });
        expect(cortex.config.activeTypes).toEqual([]);
    });

    it('applies authored procedural styles independently at cue boundaries', () => {
        const cortex = new VisualCortex();
        cortex.kleeFlashes = new KleeFlashes(mockEngine());
        const configure = vi.spyOn(cortex.kleeFlashes, 'configure');

        cortex.applyCue({
            kind: 'procedural', collections: ['klee'], config: { preset: 'harmonic' }
        });
        expect(cortex.config).toMatchObject({ activeTypes: ['klee'], kleePreset: 'harmonic' });
        expect(configure).toHaveBeenCalledWith({ preset: 'harmonic', signals: undefined });

        cortex.applyCue({
            kind: 'procedural', collections: ['harmonograph'], config: { climate: 'jadeVeil' }
        });
        expect(cortex.config).toMatchObject({
            activeTypes: ['harmonograph'], harmonographClimate: 'jadeVeil'
        });
    });

    it('re-arms current-pool hydration on every sourced cue activation', async () => {
        const cortex = new VisualCortex();
        cortex.config.enabled = true;
        const warm = vi.spyOn(cortex, '_preloadDiagrams').mockResolvedValue({
            aborted: false,
            minimumReady: true,
            targetSatisfied: true
        });
        vi.spyOn(cortex, '_scheduleBackgroundWarm').mockImplementation(() => {});

        cortex.applyCue({ kind: 'sourced', collections: ['chapel-gospel-before-pilate'] });
        cortex.applyCue({ kind: 'sourced', collections: ['chapel-gospel-flagellation'] });
        await Promise.resolve();

        expect(warm).toHaveBeenCalledTimes(2);
        expect(cortex.config.activeTypes).toEqual(['chapel-gospel-flagellation']);
    });

    it('wakes Gallery as soon as a newly activated cue pool becomes ready', async () => {
        const cortex = new VisualCortex();
        cortex.config.enabled = true;
        cortex.config.presentation = 'continuous';
        cortex.config.activeTypes = ['chapel-gospel-before-pilate'];
        vi.spyOn(cortex, '_preloadDiagrams').mockResolvedValue({
            aborted: false,
            minimumReady: true,
            targetSatisfied: false
        });
        vi.spyOn(cortex, '_scheduleBackgroundWarm').mockImplementation(() => {});
        const notify = vi.spyOn(cortex, '_notifyContinuousPoolChanged');

        cortex.applyCue({
            kind: 'sourced',
            collections: ['chapel-gospel-flagellation']
        }, { cueId: 'flagellation' });
        await Promise.resolve();
        await Promise.resolve();

        expect(notify).toHaveBeenCalledOnce();
        expect(cortex.config.activeTypes).toEqual(['chapel-gospel-flagellation']);
    });

    it('a cue swap preserves a visual that has already committed', () => {
        const cortex = new VisualCortex();
        cortex._activePresentation = { settled: false };
        const cancel = vi.spyOn(cortex, 'cancelPresentation');
        const epoch = cortex._presentationEpoch;

        cortex.applyCue({ kind: 'sourced', collections: ['chapel-gospel-crucifixion'] });

        expect(cancel).not.toHaveBeenCalled();
        expect(cortex._presentationEpoch).toBe(epoch);
        expect(cortex.config.activeTypes).toEqual(['chapel-gospel-crucifixion']);
    });

    it('installs an authoritative empty identity for a non-Rhythmic reading', () => {
        const cortex = new VisualCortex();
        cortex.config.enabled = true;
        cortex.config.activeTypes = ['dore:numbers'];
        const staleAsset = { img: { src: 'dore-numbers.jpg' } };
        cortex._poolFor('dore:numbers').images.push(staleAsset);
        const dispose = vi.spyOn(cortex, '_disposeAsset');

        cortex.resetSessionVisualIdentity();

        expect(cortex.config.enabled).toBe(false);
        expect(cortex.config.activeTypes).toEqual([]);
        expect(cortex.config.sourced).toEqual([]);
        expect(cortex._assetPools.has('dore:numbers')).toBe(false);
        expect(dispose).toHaveBeenCalledWith(staleAsset);
    });

    it('installs every Rhythmic reading as a fresh generation without discarding a reusable pool', () => {
        const cortex = new VisualCortex();
        cortex.config.enabled = false;
        cortex.config.activeTypes = ['aic-oldmasters'];
        cortex.config.sourced = ['aic-oldmasters'];
        cortex.config.customVisuals = [{ id: 'prior-reading' }];
        const retainedAsset = { img: { src: 'old-master.jpg' } };
        cortex._poolFor('aic-oldmasters').images.push(retainedAsset);
        const rotate = vi.spyOn(cortex, '_rotateAssetGeneration');
        const dispose = vi.spyOn(cortex, '_disposeAsset');

        cortex.beginSessionVisualIdentity({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['aic-oldmasters'],
            sourced: ['aic-oldmasters']
        });

        // Equal category arrays must not suppress a new reading boundary.
        expect(rotate).toHaveBeenCalledOnce();
        expect(cortex.config.activeTypes).toEqual(['aic-oldmasters']);
        expect(cortex.config.customVisuals).toEqual([]);
        // A legitimate return to the same reading reuses decoded works.
        expect(cortex._poolFor('aic-oldmasters').images).toContain(retainedAsset);
        expect(dispose).not.toHaveBeenCalled();
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

    it('preserves normalized artwork metadata on the decoded asset', async () => {
        const cortex = new VisualCortex();
        vi.spyOn(cortex, '_getProviderForCategory').mockResolvedValue({
            getRandom: vi.fn().mockResolvedValue({
                name: 'The Work',
                data: {
                    url: 'work.jpg',
                    artist: '<b>The Artist</b>',
                    rights: 'PUBLIC_DOMAIN',
                    sourceName: 'The Museum',
                    sourceUrl: 'https://example.org/work'
                }
            })
        });
        vi.spyOn(cortex, '_loadImage').mockImplementation(
            async (url, name, category, signal, artworkLabel) => ({
                img: { src: url },
                url,
                name,
                category,
                artworkLabel
            })
        );

        const asset = await cortex._loadIntoPool('aic-oldmasters');

        expect(asset.artworkLabel).toMatchObject({
            title: 'The Work',
            artist: 'The Artist',
            labelText: 'The Work · The Artist',
            sourceName: 'The Museum',
            creditRequired: false
        });
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
        // 12 flashes × 1.25 headroom = 15, inside the raised MAX_CATEGORY_TARGET (20)
        expect(cortex._sessionAssetTarget).toBe(15);
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
        for (let i = 0; i < 40; i++) {
            const category = i % 2 ? 'aic-oldmasters' : 'aic-landscapes';
            const asset = {
                img: { src: `${i}.jpg` }, loadedAt: i, lastUsedAt: i
            };
            assets.push(asset);
            cortex._retainAsset(category, asset);
        }

        const total = [...cortex._assetPools.values()]
            .reduce((count, pool) => count + pool.images.length, 0);
        // GLOBAL_ASSET_LIMIT is 30 in the sliding-window era: 40 retains
        // leave 30 held and the 10 oldest disposed
        expect(total).toBe(30);
        expect(cortex._poolFor('aic-oldmasters').images.length).toBeGreaterThan(0);
        expect(cortex._poolFor('aic-landscapes').images.length).toBeGreaterThan(0);
        expect(assets.filter(asset => asset.img.src === '')).toHaveLength(10);
    });

    it('the GLOBAL evictor also spares the unseen: flashed veterans die first under pressure', () => {
        const cortex = new VisualCortex();
        cortex.config.activeTypes = ['aic-oldmasters'];
        const pool = cortex._poolFor('aic-oldmasters');
        // fill to the limit with flashed veterans, then retain unseen
        // newcomers past it — the veterans must be the ones evicted
        for (let i = 0; i < 30; i++) {
            pool.images.push({ img: { src: `vet-${i}.jpg` }, loadedAt: i, lastUsedAt: i, flashedAt: i + 1 });
        }
        const unseen = { img: { src: 'unseen.jpg' }, loadedAt: 100, lastUsedAt: 100 };
        cortex._retainAsset('aic-oldmasters', unseen);
        expect(pool.images).toContain(unseen);           // the unseen survived
        expect(pool.images.find(a => a.img.src === 'vet-0.jpg')).toBeUndefined(); // earliest-flashed died
        expect(pool.images.length).toBe(30);             // limit holds
    });

    it('rolling refresh slides the window: evicts the earliest-FLASHED veteran, never the unseen', async () => {
        const cortex = new VisualCortex();
        cortex.config.activeTypes = ['aic-oldmasters'];
        const pool = cortex._poolFor('aic-oldmasters');
        // two flashed veterans (old-0 earliest) and one never-flashed work
        pool.images.push({ img: { src: 'old-0.jpg' }, loadedAt: 0, lastUsedAt: 0, flashedAt: 10 });
        pool.images.push({ img: { src: 'old-1.jpg' }, loadedAt: 1, lastUsedAt: 1, flashedAt: 20 });
        pool.images.push({ img: { src: 'unseen.jpg' }, loadedAt: 2, lastUsedAt: 2 });
        pool.cursor = 1;
        const fresh = { img: { src: 'fresh.jpg' }, loadedAt: 100, lastUsedAt: 100 };
        vi.spyOn(cortex, '_loadIntoPool').mockImplementation(async () => {
            pool.images.push(fresh);
            return fresh;
        });

        cortex._scheduleRollingRefresh();
        await new Promise(resolve => setTimeout(resolve, 10));

        // size holds at 3: the earliest-FLASHED (old-0) is out; the
        // never-flashed work survives (nothing dies unseen)
        expect(pool.images.length).toBe(3);
        expect(pool.images).toContain(fresh);
        expect(pool.images.find(a => a.img.src === 'old-0.jpg')).toBeUndefined();
        expect(pool.images.find(a => a.img.src === 'unseen.jpg')).toBeDefined();
        // the newcomer sits just ahead of the cursor so it flashes soon
        const cursorNext = pool.images[(pool.cursor + 1) % pool.images.length];
        expect(cursorNext).toBe(fresh);
        // interval gate: an immediate second call is a no-op
        cortex._scheduleRollingRefresh();
        expect(cortex._loadIntoPool).toHaveBeenCalledTimes(1);
    });

    it('the take path stamps flashedAt so the refresh can tell seen from unseen', () => {
        const cortex = new VisualCortex();
        const pool = cortex._poolFor('aic-oldmasters');
        pool.images.push({ img: { src: 'a.jpg' }, loadedAt: 1, lastUsedAt: 1 });
        const taken = cortex._takeFromPool(pool);
        expect(taken.flashedAt).toBeGreaterThan(0);
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

    it('applies the label preference live while retaining required credits', () => {
        const cortex = new VisualCortex();
        cortex.artworkLabelEl = document.createElement('div');
        cortex._setFlashArtworkLabel({
            labelText: 'Optional · Artist',
            requiredText: 'Optional · Artist',
            creditRequired: false
        });
        expect(cortex.artworkLabelEl.hidden).toBe(false);

        cortex.setArtworkLabelsVisible(false);
        expect(cortex.artworkLabelEl.hidden).toBe(true);

        cortex._setFlashArtworkLabel({
            labelText: 'Required · Artist',
            requiredText: 'Required · Artist · CC BY 4.0',
            creditRequired: true
        });
        expect(cortex.artworkLabelEl.hidden).toBe(false);
        expect(cortex.artworkLabelEl.textContent)
            .toBe('Required · Artist · CC BY 4.0');
    });

    it('presents the selected sourced work and its label as one flash', async () => {
        grantVisualInterlocutionConsent();
        const cortex = new VisualCortex();
        cortex.initialized = true;
        cortex.container = {
            hidden: true,
            style: {},
            classList: { toggle: vi.fn() },
            getBoundingClientRect: () => ({ width: 1200, height: 800 })
        };
        cortex.imageWashEl = document.createElement('img');
        cortex.diagramEl = document.createElement('img');
        Object.defineProperties(cortex.diagramEl, {
            complete: { configurable: true, value: true },
            naturalWidth: { configurable: true, value: 600 },
            naturalHeight: { configurable: true, value: 1200 }
        });
        cortex.artworkLabelEl = document.createElement('div');
        cortex.config.activeTypes = ['aic-oldmasters'];
        vi.spyOn(cortex, '_scheduleBackgroundWarm').mockImplementation(() => {});
        vi.spyOn(cortex, '_getNextDiagram').mockReturnValue({
            img: { src: 'work.jpg' },
            name: 'The Work',
            artworkLabel: {
                labelText: 'The Work · The Artist',
                requiredText: 'The Work · The Artist',
                creditRequired: false
            }
        });
        vi.spyOn(cortex, '_presentRenderedVisual').mockResolvedValue({
            presented: true,
            requestedDurationMs: 200,
            presentedDurationMs: 200,
            reason: 'complete'
        });

        await cortex.flash(200, 'aic-oldmasters');

        expect(cortex.diagramEl.src).toContain('work.jpg');
        expect(cortex.diagramEl.style.objectFit).toBe('contain');
        expect(cortex.imageWashEl.src).toContain('work.jpg');
        expect(cortex.imageWashEl.hidden).toBe(false);
        expect(cortex.artworkLabelEl.hidden).toBe(false);
        expect(cortex.artworkLabelEl.textContent).toBe('The Work · The Artist');
    });
});

describe('VisualCortex sequence score assets', () => {
    afterEach(() => vi.restoreAllMocks());

    it('renders the exact stable asset named by a sequence-asset cue', async () => {
        grantVisualInterlocutionConsent();
        const cortex = new VisualCortex();
        cortex.initialized = true;
        cortex.container = { hidden: true, style: {} };
        cortex.customImageEl = { hidden: true, src: '', alt: '' };
        cortex.config.sequenceVisualAssets = [
            { id: 'moon', uri: 'data:image/png;base64,bW9vbg==', name: 'Moon' },
            { id: 'reeds', uri: 'data:image/png;base64,cmVlZHM=', name: 'Reeds' }
        ];
        const show = vi.spyOn(cortex, '_showAdaptiveImage').mockReturnValue(true);
        vi.spyOn(cortex, '_presentRenderedVisual').mockResolvedValue({
            presented: true,
            requestedDurationMs: 150,
            presentedDurationMs: 150,
            reason: 'presented'
        });

        const result = await cortex.flash(150, 'sequence-asset:reeds');

        expect(show).toHaveBeenCalledWith(
            cortex.customImageEl,
            'data:image/png;base64,cmVlZHM=',
            'Reeds'
        );
        expect(result).toMatchObject({ presented: true, reason: 'presented' });
    });

    it('exposes only the active stable asset to the continuous Gallery', () => {
        const cortex = new VisualCortex();
        cortex.config.activeTypes = ['sequence-asset:reeds'];
        cortex.config.sequenceVisualAssets = [
            { id: 'moon', uri: 'data:image/png;base64,bW9vbg==', name: 'Moon' },
            { id: 'reeds', uri: 'data:image/png;base64,cmVlZHM=', name: 'Reeds' }
        ];

        expect(cortex._continuousHasWorks()).toBe(true);
        expect(cortex._continuousPool()).toEqual([{
            url: 'data:image/png;base64,cmVlZHM=',
            title: 'Reeds',
            artworkLabel: null
        }]);
        expect(cortex._continuousPoolKey()).toContain('sequence-asset:reeds');
    });
});

describe('VisualCortex adaptive image wash', () => {
    it('uses the same uncropped foreground and ambient wash in Behind Stream', () => {
        const cortex = new VisualCortex();
        cortex.config.presentation = 'behind-stream';
        cortex.container = {
            getBoundingClientRect: () => ({ width: 1200, height: 800 })
        };
        cortex.imageWashEl = document.createElement('img');
        const foreground = document.createElement('img');
        Object.defineProperties(foreground, {
            complete: { configurable: true, value: true },
            naturalWidth: { configurable: true, value: 600 },
            naturalHeight: { configurable: true, value: 1200 }
        });

        expect(cortex._showAdaptiveImage(
            foreground,
            'portrait.jpg',
            'Portrait'
        )).toBe(true);

        expect(foreground.hidden).toBe(false);
        expect(foreground.src).toContain('portrait.jpg');
        expect(foreground.alt).toBe('Portrait');
        expect(foreground.style.objectFit).toBe('contain');
        expect(cortex.imageWashEl.hidden).toBe(false);
        expect(cortex.imageWashEl.src).toContain('portrait.jpg');
    });

    it('does not allocate a wash for a full-frame image', () => {
        const cortex = new VisualCortex();
        cortex.container = {
            getBoundingClientRect: () => ({ width: 1200, height: 800 })
        };
        cortex.imageWashEl = document.createElement('img');
        const foreground = document.createElement('img');
        Object.defineProperties(foreground, {
            complete: { configurable: true, value: true },
            naturalWidth: { configurable: true, value: 1200 },
            naturalHeight: { configurable: true, value: 800 }
        });

        cortex._showAdaptiveImage(foreground, 'full-frame.jpg', 'Full frame');

        expect(foreground.hidden).toBe(false);
        expect(cortex.imageWashEl.hidden).toBe(true);
        expect(cortex.imageWashEl.hasAttribute('src')).toBe(false);
    });

    it('hides the wash before a procedural or ASCII frame presents', () => {
        const cortex = new VisualCortex();
        cortex.imageWashEl = document.createElement('img');
        cortex.imageWashEl.hidden = false;
        cortex.imageWashEl.src = 'previous-work.jpg';

        cortex._hideAdaptiveImageWash();

        expect(cortex.imageWashEl.hidden).toBe(true);
        expect(cortex.imageWashEl.hasAttribute('src')).toBe(false);
    });

    it('wires wash clearing into the flash reset before procedural dispatch', async () => {
        grantVisualInterlocutionConsent();
        const cortex = new VisualCortex();
        cortex.initialized = true;
        cortex.container = { hidden: true, style: {} };
        cortex.imageWashEl = document.createElement('img');
        cortex.imageWashEl.hidden = false;
        cortex.imageWashEl.src = 'previous-work.jpg';

        const result = await cortex.flash(200, 'klee');

        expect(result.reason).toBe('render-failed');
        expect(cortex.imageWashEl.hidden).toBe(true);
        expect(cortex.imageWashEl.hasAttribute('src')).toBe(false);
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

describe('Blend family balance', () => {
    // A fair coin is not enough: a procedural type always renders, while a
    // sourced type whose image has not loaded becomes intentional
    // stillness. So a fair SELECTION produced a lopsided EXPERIENCE —
    // measured at 60% pool readiness, the reader saw ~63% procedural.

    const cortexWithPools = (readyCategories = []) => {
        const cortex = new VisualCortex();
        cortex._assetPools = new Map();
        for (const id of readyCategories) {
            cortex._assetPools.set(id, { images: [{ img: { src: 'x' } }], cursor: -1 });
        }
        return cortex;
    };

    it('never offers a sourced category whose pool is empty', () => {
        // Picking an unloaded category spends the opportunity on silence
        const cortex = cortexWithPools([]);
        for (let i = 0; i < 200; i++) {
            const pick = cortex._selectBlendType(['klee', 'turrell'], ['aic-oldmasters']);
            expect(pick).not.toBe('aic-oldmasters');
        }
        cortex.destroy?.();
    });

    it('offers sourced categories once their pool has an asset', () => {
        const cortex = cortexWithPools(['aic-oldmasters']);
        const seen = new Set();
        for (let i = 0; i < 300; i++) {
            seen.add(cortex._selectBlendType(['klee'], ['aic-oldmasters']));
            // Feed the ledger as the real path would, alternating outcomes
            cortex._recordBlendOutcome('klee', true);
        }
        expect(seen.has('aic-oldmasters')).toBe(true);
        expect(seen.has('klee')).toBe(true);
        cortex.destroy?.();
    });

    it('repays the family that is behind on flashes actually SEEN', () => {
        const cortex = cortexWithPools(['aic-oldmasters']);
        // Procedural runs far ahead — the ledger should lean sourced
        for (let i = 0; i < 10; i++) cortex._recordBlendOutcome('klee', true);
        expect(cortex._blendDebt).toBeGreaterThan(0);

        let sourcedPicks = 0;
        for (let i = 0; i < 400; i++) {
            if (cortex._selectBlendType(['klee'], ['aic-oldmasters']) === 'aic-oldmasters') {
                sourcedPicks++;
            }
        }
        // Biased toward the debtor, but still random — never a metronome
        expect(sourcedPicks).toBeGreaterThan(200);
        expect(sourcedPicks).toBeLessThan(400);
        cortex.destroy?.();
    });

    it('counts a skipped sourced flash as a debt, not as nothing', () => {
        // The invisible loss this whole mechanism exists to repay
        const cortex = cortexWithPools(['aic-oldmasters']);
        const before = cortex._blendDebt;
        cortex._recordBlendOutcome('aic-oldmasters', false);
        expect(cortex._blendDebt).toBeGreaterThan(before);
        cortex.destroy?.();
    });

    it('bounds the ledger so one outage cannot mortgage the session', () => {
        const cortex = cortexWithPools(['aic-oldmasters']);
        for (let i = 0; i < 100; i++) cortex._recordBlendOutcome('klee', true);
        expect(cortex._blendDebt).toBeLessThanOrEqual(4);
        for (let i = 0; i < 200; i++) cortex._recordBlendOutcome('aic-oldmasters', true);
        expect(cortex._blendDebt).toBeGreaterThanOrEqual(-4);
        cortex.destroy?.();
    });

    it('keeps the reader near an even split at partial pool readiness', () => {
        // The regression this fixes, measured end to end.
        const cortex = cortexWithPools(['aic-oldmasters']);
        let procedural = 0;
        let sourced = 0;
        for (let i = 0; i < 3000; i++) {
            const pick = cortex._selectBlendType(['klee'], ['aic-oldmasters']);
            const isSourced = pick === 'aic-oldmasters';
            // Model a 60%-ready pool: a sourced pick sometimes shows nothing
            const shown = !isSourced || Math.random() < 0.6;
            cortex._recordBlendOutcome(pick, shown);
            if (shown) isSourced ? sourced++ : procedural++;
        }
        const share = sourced / (sourced + procedural);
        expect(share).toBeGreaterThan(0.33);
        cortex.destroy?.();
    });
});

describe('Blend selection is wired into the flash path', () => {
    it('routes Blend picks through the balancing selector, not a raw coin', async () => {
        // The unit tests above call _selectBlendType directly, so they
        // pass even if flash() never uses it. This asserts the wiring.
        grantVisualInterlocutionConsent();
        const cortex = new VisualCortex();
        cortex.initialized = true;
        cortex.container = { hidden: true, style: {}, classList: { toggle() {}, remove() {} } };
        cortex.config.activeTypes = ['klee', 'aic-oldmasters'];
        cortex._assetPools = new Map([
            ['aic-oldmasters', { images: [{ img: { src: 'x' } }], cursor: -1 }]
        ]);

        const spy = vi.spyOn(cortex, '_selectBlendType');
        // The render will fail for want of canvases; selection happens first.
        await cortex.flash(80).catch(() => {});

        expect(spy, 'flash() must use the balancing selector').toHaveBeenCalled();
        const [procedural, sourced] = spy.mock.calls[0];
        expect(procedural).toContain('klee');
        expect(sourced).toContain('aic-oldmasters');
        cortex.destroy?.();
    });
});

describe('Blend ledger is per-reading', () => {
    it('resets when a new visual configuration is installed', () => {
        // The cortex is a singleton for the tab's lifetime. Without a
        // reset, a pure procedural sequence drives the debt to its
        // ceiling and the NEXT reading opens biased toward sourced
        // imagery it never owed — a balance inherited from a different
        // text entirely.
        const cortex = new VisualCortex();
        for (let i = 0; i < 20; i++) cortex._recordBlendOutcome('klee', true);
        expect(cortex._blendDebt).toBeGreaterThan(0);

        cortex.updateConfig({ activeTypes: ['klee', 'aic-oldmasters'] });
        expect(cortex._blendDebt).toBe(0);
        cortex.destroy?.();
    });

    it('survives ordinary mid-session config changes', () => {
        // Changing presentation or duration is not a new reading; the
        // ledger should keep its memory across those.
        const cortex = new VisualCortex();
        cortex.updateConfig({ activeTypes: ['klee', 'aic-oldmasters'] });
        for (let i = 0; i < 5; i++) cortex._recordBlendOutcome('klee', true);
        const carried = cortex._blendDebt;
        expect(carried).toBeGreaterThan(0);

        cortex.updateConfig({ duration: 400 });
        expect(cortex._blendDebt).toBe(carried);
        cortex.destroy?.();
    });
});

describe('Continuous Field (Gallery) wiring', () => {
    let decodeSpy;
    beforeEach(() => {
        // jsdom has no image pipeline; resolve the presenter's decode
        // instantly so start()'s reveal does not spawn a rejecting
        // Image().decode(). Wiring tests care about lifecycle, not pixels.
        decodeSpy = vi.spyOn(ContinuousField.prototype, '_defaultDecode')
            .mockResolvedValue(true);
    });
    afterEach(() => {
        decodeSpy?.mockRestore();
        document.documentElement.classList.remove('photosensitivity-mode');
        document.body.replaceChildren();
    });

    // Seed a category's resolved pool without a provider round-trip.
    function seedPool(cortex, categoryId, urls) {
        const pool = cortex._poolFor(categoryId);
        pool.images = urls.map((url, i) => ({ url, name: `w${i}` }));
        return pool;
    }

    function hostedContinuousCortex() {
        grantVisualInterlocutionConsent();
        const cortex = new VisualCortex();
        // never touch the network in these tests
        cortex._scheduleBackgroundWarm = () => {};
        cortex._scheduleRollingRefresh = () => {};
        const host = document.createElement('div');
        document.body.appendChild(host);
        cortex.setContinuousFieldHost(host);
        return { cortex, host };
    }

    it('does NOT start the field until mode, host, and consent all hold', () => {
        const { cortex, host } = hostedContinuousCortex();
        // host present + consent, but not in continuous mode
        expect(cortex._continuousField?.running).toBeFalsy();
        // enter continuous mode with a pool
        seedPool(cortex, 'aic-oldmasters', ['a.jpg', 'b.jpg']);
        cortex.updateConfig({ enabled: true, presentation: 'continuous', activeTypes: ['aic-oldmasters'] });
        expect(cortex._continuousField?.running).toBe(true);
        cortex.destroy();
    });

    it('the field pool is every resolved work across the active categories', () => {
        const { cortex } = hostedContinuousCortex();
        seedPool(cortex, 'aic-oldmasters', ['a.jpg', 'b.jpg']);
        seedPool(cortex, 'chapel-gospel-before-pilate', ['p.jpg']);
        cortex.updateConfig({ enabled: true, presentation: 'continuous',
            activeTypes: ['aic-oldmasters', 'chapel-gospel-before-pilate'] });
        const urls = cortex._continuousPool().map(w => w.url).sort();
        expect(urls).toEqual(['a.jpg', 'b.jpg', 'p.jpg']);
        cortex.destroy();
    });

    it('materializes a Fractal Flame as an immutable Gallery work', async () => {
        const cortex = new VisualCortex();
        cortex.initialized = true;
        cortex.config.renderLanguage = 'native';
        cortex.fractal = {
            isReady: vi.fn(() => false),
            fillQueue: vi.fn().mockResolvedValue(undefined),
            generate: vi.fn(() => true)
        };
        cortex._fractalCanvas = {
            toDataURL: vi.fn(() => 'data:image/webp;base64,flame')
        };

        const work = await cortex._renderContinuousProceduralWork('fractal');

        expect(cortex.fractal.fillQueue).toHaveBeenCalledWith(1);
        expect(cortex.fractal.generate).toHaveBeenCalledWith(null);
        expect(work).toEqual({
            url: 'data:image/webp;base64,flame',
            title: 'Fractal Flame',
            sourceType: 'fractal'
        });
        cortex.destroy();
    });

    it('adapts every Rhythmic procedural into the common Gallery work contract', async () => {
        const cortex = new VisualCortex();
        cortex.initialized = true;
        cortex.config.renderLanguage = 'native';
        cortex._resizeKleeCanvas = vi.fn();
        const canvas = {
            width: 1200,
            height: 800,
            toDataURL: vi.fn(() => 'data:image/webp;base64,procedural')
        };
        cortex._kleeCanvas = canvas;
        cortex._fractalCanvas = canvas;
        cortex._neuralCanvas = canvas;
        cortex.kleeFlashes = {
            renderFlash: vi.fn().mockResolvedValue(true),
            destroy: vi.fn()
        };
        cortex.turrell = {
            generate: vi.fn(() => ({ center: [0.5, 0.5] })),
            render: vi.fn(() => true)
        };
        cortex.fractal = {
            isReady: vi.fn(() => true),
            fillQueue: vi.fn(),
            generate: vi.fn(() => true)
        };
        cortex.neural = { generate: vi.fn(() => true) };
        cortex.harmonograph = {
            generate: vi.fn(() => true),
            render: vi.fn(() => true)
        };
        cortex.ostensoria = {
            generate: vi.fn(() => true),
            render: vi.fn(() => true)
        };
        cortex.apparitio = {
            generate: vi.fn(() => true),
            render: vi.fn(() => true)
        };
        cortex.blueprint = {
            generate: vi.fn(() => true),
            render: vi.fn(() => true)
        };
        cortex.freedom = {
            generate: vi.fn(() => true),
            render: vi.fn(() => true)
        };
        cortex.rockgarden = {
            generateRockGarden: vi.fn(),
            renderRockGarden: vi.fn(() => true)
        };

        const types = [
            'klee', 'turrell', 'fractal', 'neural',
            'rockgarden', 'harmonograph', 'ostensoria', 'apparitio', 'blueprint', 'freedom'
        ];
        const works = await Promise.all(
            types.map(type => cortex._renderContinuousProceduralWork(type))
        );

        expect(works.map(work => work.sourceType)).toEqual(types);
        expect(works.every(work => work.url.startsWith('data:image/'))).toBe(true);
        cortex.destroy();
    });

    it('renders a Fractal Flame Gallery through the selected ASCII language', async () => {
        const cortex = new VisualCortex();
        cortex.initialized = true;
        cortex.config.renderLanguage = 'ascii';
        const asciiFrame = { layers: [['#']], rows: 1, columns: 1 };
        const item = { imageData: {}, asciiFrame };
        cortex.fractal = {
            isReady: vi.fn(() => true),
            takeFrame: vi.fn(() => item)
        };
        cortex._fractalCanvas = {};
        cortex.asciiCompiler = { compileImageData: vi.fn() };
        cortex.asciiRenderer = { render: vi.fn(() => true) };
        cortex._asciiCanvas = {
            toDataURL: vi.fn(() => 'data:image/webp;base64,ascii-flame')
        };

        const work = await cortex._renderContinuousProceduralWork('fractal');

        expect(cortex.fractal.takeFrame).toHaveBeenCalledWith(null);
        expect(cortex.asciiRenderer.render).toHaveBeenCalledWith(asciiFrame);
        expect(work.sourceType).toBe('fractal');
        expect(work.url).toContain('ascii-flame');
        cortex.destroy();
    });

    it('runs a procedural-only Gallery without requiring an external pool', async () => {
        const { cortex } = hostedContinuousCortex();
        vi.spyOn(cortex, '_renderContinuousProceduralWork')
            .mockResolvedValue({
                url: 'data:image/webp;base64,flame',
                title: 'Fractal Flame',
                sourceType: 'fractal'
            });

        cortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['fractal']
        });
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

        expect(cortex._continuousField.currentUrl)
            .toBe('data:image/webp;base64,flame');
        expect(cortex._continuousField.running).toBe(true);
        cortex.destroy();
    });

    it('admits and decodes an authored first frame before activating its cue', async () => {
        const { cortex } = hostedContinuousCortex();
        const originalDecode = HTMLImageElement.prototype.decode;
        HTMLImageElement.prototype.decode = vi.fn().mockResolvedValue(true);
        vi.spyOn(cortex, 'resolveCollectionWorks').mockResolvedValue([{
            name: 'Prepared work',
            data: { url: 'prepared.jpg' }
        }]);
        const cue = { kind: 'sourced', collections: ['prepared-collection'] };
        const program = {
            segments: [{ id: 'prepared', cue }],
            fallback: { kind: 'still' }
        };

        const admission = await cortex.preloadProgram(program);
        expect(admission).toEqual({ requested: 1, ready: 1 });
        expect(cortex.isCuePrepared(cue)).toBe(true);

        cortex.config.activeTypes = ['prepared-collection'];
        cortex.applyCue(cue, { transitionMs: 140 });
        const work = await cortex._nextContinuousWork();
        expect(work).toMatchObject({ url: 'prepared.jpg', title: 'Prepared work' });

        if (originalDecode) HTMLImageElement.prototype.decode = originalDecode;
        else delete HTMLImageElement.prototype.decode;
        cortex.destroy();
    });

    it('keeps procedural and sourced families equally present in Blend', async () => {
        const { cortex } = hostedContinuousCortex();
        seedPool(cortex, 'aic-oldmasters', ['painting.jpg']);
        cortex.config.activeTypes = ['fractal', 'aic-oldmasters'];
        vi.spyOn(cortex, '_renderContinuousProceduralWork')
            .mockResolvedValue({
                url: 'data:image/webp;base64,flame',
                sourceType: 'fractal'
            });

        const first = await cortex._nextContinuousWork();
        const second = await cortex._nextContinuousWork({ currentUrl: first.url });
        const urls = new Set([first.url, second.url]);

        expect(urls).toEqual(new Set([
            'painting.jpg',
            'data:image/webp;base64,flame'
        ]));
        cortex.destroy();
    });

    it('includes procedural identity and render language in the Gallery pool key', () => {
        const { cortex } = hostedContinuousCortex();
        vi.spyOn(cortex, '_renderContinuousProceduralWork')
            .mockResolvedValue({ url: 'data:image/webp;base64,flame' });
        cortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['fractal'],
            renderLanguage: 'native'
        });
        const nativeKey = cortex._continuousPoolKey();
        cortex.updateConfig({ renderLanguage: 'ascii' });

        expect(nativeKey).toContain('fractal');
        expect(cortex._continuousPoolKey()).not.toBe(nativeKey);
        cortex.destroy();
    });

    it('maps Gallery cadence into dwell and dissolve, including live changes', () => {
        const { cortex } = hostedContinuousCortex();
        seedPool(cortex, 'aic-oldmasters', ['a.jpg', 'b.jpg']);
        cortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['aic-oldmasters'],
            galleryCadence: 1
        });
        expect(cortex._continuousField.dwellMs).toBe(8000);
        expect(cortex._continuousField.crossfadeMs).toBe(1440);

        cortex.updateConfig({ galleryCadence: 0 });
        expect(cortex._continuousField.dwellMs).toBe(30000);
        expect(cortex._continuousField.crossfadeMs).toBe(2500);
        cortex.destroy();
    });

    it('Gallery Harmonograph draws on a living layer; full-frame does not', () => {
        const { cortex, host } = hostedContinuousCortex();
        const snapshot = vi.spyOn(cortex, '_renderContinuousProceduralWork');
        cortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['harmonograph']
        });
        expect(cortex._harmonographField?.running).toBe(true);
        expect(host.querySelectorAll('.harmonograph-plane').length).toBe(2);
        expect(snapshot).not.toHaveBeenCalled();

        cortex.updateConfig({ presentation: 'full-frame' });
        expect(cortex._harmonographField?.running).toBe(false);
        cortex.destroy();
    });

    it('Gallery plates draw on a living layer; full-frame does not', () => {
        vi.spyOn(Ostensoria.prototype, 'generate').mockImplementation(function generate() {
            this.ready = true;
            return true;
        });
        vi.spyOn(Ostensoria.prototype, 'beginBake').mockImplementation(function beginBake() {
            this.ready = false;
        });
        vi.spyOn(Ostensoria.prototype, 'stepBake').mockImplementation(function stepBake() {
            this.ready = true;
            return true;
        });
        vi.spyOn(Ostensoria.prototype, 'render').mockReturnValue(true);
        const { cortex, host } = hostedContinuousCortex();
        const snapshot = vi.spyOn(cortex, '_renderContinuousProceduralWork');
        cortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['ostensoria']
        });
        expect(cortex._plateField?.running).toBe(true);
        expect(host.querySelectorAll('.plate-plane').length).toBe(2);
        expect(snapshot).not.toHaveBeenCalled();

        cortex.updateConfig({ presentation: 'full-frame' });
        expect(cortex._plateField?.running).toBe(false);
        cortex.destroy();
    });

    it('mounts the presenter in the second Chamber host on later Gallery readings', () => {
        const { cortex, host: firstHost } = hostedContinuousCortex();
        seedPool(cortex, 'aic-oldmasters', ['first.jpg']);
        cortex.beginSessionVisualIdentity({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['aic-oldmasters']
        });
        expect(firstHost.querySelectorAll('.continuous-field-layer')).toHaveLength(2);

        cortex.updateConfig({ enabled: false });
        cortex.setContinuousFieldHost(null);
        expect(firstHost.querySelectorAll('.continuous-field-layer')).toHaveLength(0);

        const secondHost = document.createElement('div');
        document.body.appendChild(secondHost);
        seedPool(cortex, 'aic-knights', ['second.jpg']);
        cortex.beginSessionVisualIdentity({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['aic-knights']
        });
        cortex.setContinuousFieldHost(secondHost);

        expect(secondHost.querySelectorAll('.continuous-field-layer')).toHaveLength(2);
        expect(cortex._continuousField?.host).toBe(secondHost);
        expect(firstHost.querySelectorAll('.continuous-field-layer')).toHaveLength(0);
        cortex.destroy();
    });

    it('the pool key follows the active categories (a pericope boundary decks a new cycle)', () => {
        const { cortex } = hostedContinuousCortex();
        cortex.updateConfig({ enabled: true, presentation: 'continuous', activeTypes: ['chapel-gospel-before-pilate'] });
        const k1 = cortex._continuousPoolKey();
        cortex.updateConfig({ activeTypes: ['chapel-gospel-flagellation'] });
        const k2 = cortex._continuousPoolKey();
        expect(k1).not.toBe(k2);
        cortex.destroy();
    });

    it('flash() stands down in continuous mode', async () => {
        const { cortex } = hostedContinuousCortex();
        seedPool(cortex, 'aic-oldmasters', ['a.jpg']);
        cortex.updateConfig({ enabled: true, presentation: 'continuous', activeTypes: ['aic-oldmasters'] });
        const result = await cortex.flash();
        expect(result.reason).toBe('continuous-field');
        cortex.destroy();
    });

    it('photosensitivity suspends the field; clearing it resumes', () => {
        const { cortex } = hostedContinuousCortex();
        seedPool(cortex, 'aic-oldmasters', ['a.jpg']);
        cortex.updateConfig({ enabled: true, presentation: 'continuous', activeTypes: ['aic-oldmasters'] });
        expect(cortex._continuousField.running).toBe(true);
        document.documentElement.classList.add('photosensitivity-mode');
        cortex.syncSafety();
        expect(cortex._continuousField.running).toBe(false);
        document.documentElement.classList.remove('photosensitivity-mode');
        cortex.syncSafety();
        expect(cortex._continuousField.running).toBe(true);
        cortex.destroy();
    });

    it('leaving continuous mode stops the field', () => {
        const { cortex } = hostedContinuousCortex();
        seedPool(cortex, 'aic-oldmasters', ['a.jpg']);
        cortex.updateConfig({ enabled: true, presentation: 'continuous', activeTypes: ['aic-oldmasters'] });
        expect(cortex._continuousField.running).toBe(true);
        cortex.updateConfig({ presentation: 'behind-stream' });
        expect(cortex._continuousField.running).toBe(false);
        cortex.destroy();
    });

    it('wordFill same leaves the projection as identical pixels (no second bag)', async () => {
        const { cortex, host } = hostedContinuousCortex();
        seedPool(cortex, 'aic-landscapes', ['room-a.jpg', 'room-b.jpg']);
        const projection = document.createElement('div');
        document.body.appendChild(projection);
        cortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['aic-landscapes'],
            wordFill: { mode: 'same' }
        });
        cortex.setContinuousFieldProjectionHost(projection);
        await Promise.resolve();
        await Promise.resolve();

        const field = cortex._continuousField;
        expect(field).toBeInstanceOf(ContinuousField);
        expect(cortex._continuousProjectionPool?.() ?? null).toBeNull();
        expect(field.currentProjectionUrl).toBe(field.currentUrl);
        const draw = vi.spyOn(field._projectionBag, 'draw');
        await field._advance(false);
        expect(draw).not.toHaveBeenCalled();
        expect(field.currentProjectionUrl).toBe(field.currentUrl);
        expect(host.querySelectorAll('.continuous-field-layer')).toHaveLength(2);
        expect(projection.querySelectorAll('.continuous-field-layer')).toHaveLength(2);
        cortex.destroy();
    });

    it('wordFill pick keeps the room pool and a distinct projection playlist on one field', async () => {
        const { cortex } = hostedContinuousCortex();
        seedPool(cortex, 'aic-landscapes', ['room-a.jpg', 'room-b.jpg']);
        seedPool(cortex, 'aic-ukiyoe', ['fill-x.jpg', 'fill-y.jpg']);
        const projection = document.createElement('div');
        document.body.appendChild(projection);
        cortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['aic-landscapes'],
            wordFill: { mode: 'pick', sourced: ['aic-ukiyoe'], procedural: [] }
        });
        cortex.setContinuousFieldProjectionHost(projection);
        await Promise.resolve();
        await Promise.resolve();

        const field = cortex._continuousField;
        expect(cortex._continuousPool().map(w => w.url).sort())
            .toEqual(['room-a.jpg', 'room-b.jpg']);
        expect(cortex._continuousProjectionPool().map(w => w.url).sort())
            .toEqual(['fill-x.jpg', 'fill-y.jpg']);
        await field._advance(false);
        expect(field.currentUrl).toMatch(/room-/);
        expect(field.currentProjectionUrl).toMatch(/fill-/);
        expect(field.currentProjectionUrl).not.toBe(field.currentUrl);
        expect(document.querySelectorAll('.continuous-field-layer').length).toBeGreaterThan(0);
        expect(document.querySelectorAll('video')).toHaveLength(0);
        cortex.destroy();
    });

    it('wordFill fractal keeps Landscapes on Layer A and paints engine stills on Layer B', async () => {
        const { cortex } = hostedContinuousCortex();
        seedPool(cortex, 'aic-landscapes', ['room-a.jpg', 'room-b.jpg']);
        vi.spyOn(cortex, '_renderContinuousProceduralWork')
            .mockResolvedValue({
                url: 'data:image/webp;base64,flame-fill',
                title: 'Fractal Flame',
                sourceType: 'fractal'
            });
        const projection = document.createElement('div');
        document.body.appendChild(projection);
        cortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['aic-landscapes'],
            wordFill: { mode: 'pick', sourced: [], procedural: ['fractal'] }
        });
        cortex.setContinuousFieldProjectionHost(projection);
        await Promise.resolve();
        await Promise.resolve();

        const field = cortex._continuousField;
        expect(cortex.config.activeTypes).toEqual(['aic-landscapes']);
        expect(cortex._continuousProceduralTypes()).toEqual([]);
        expect(cortex._wordFillProceduralTypes()).toEqual(['fractal']);
        expect(cortex._continuousPool().map(w => w.url).sort())
            .toEqual(['room-a.jpg', 'room-b.jpg']);
        expect(cortex._continuousProjectionPool()).toEqual([]);
        expect(Array.isArray(cortex._continuousProjectionPool())).toBe(true);
        await field._advance(false);
        expect(field.currentUrl).toMatch(/room-/);
        expect(field.currentProjectionUrl).toBe('data:image/webp;base64,flame-fill');
        expect(field.currentProjectionUrl).not.toBe(field.currentUrl);
        expect(cortex._renderContinuousProceduralWork).toHaveBeenCalledWith('fractal');
        expect(document.querySelectorAll('video')).toHaveLength(0);
        cortex.destroy();
    });

    it('wordFill collection on a fractal room keeps engine stills on Layer A', async () => {
        const { cortex } = hostedContinuousCortex();
        seedPool(cortex, 'aic-ukiyoe', ['fill-x.jpg', 'fill-y.jpg']);
        vi.spyOn(cortex, '_renderContinuousProceduralWork')
            .mockResolvedValue({
                url: 'data:image/webp;base64,flame-room',
                title: 'Fractal Flame',
                sourceType: 'fractal'
            });
        const projection = document.createElement('div');
        document.body.appendChild(projection);
        cortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['fractal'],
            wordFill: { mode: 'pick', sourced: ['aic-ukiyoe'], procedural: [] }
        });
        cortex.setContinuousFieldProjectionHost(projection);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const field = cortex._continuousField;
        expect(cortex.config.activeTypes).toEqual(['fractal']);
        expect(cortex._continuousProceduralTypes()).toEqual(['fractal']);
        expect(cortex._wordFillProceduralTypes()).toEqual([]);
        expect(cortex._continuousProjectionPool().map(w => w.url).sort())
            .toEqual(['fill-x.jpg', 'fill-y.jpg']);
        await field._advance(false);
        expect(field.currentUrl).toBe('data:image/webp;base64,flame-room');
        expect(field.currentProjectionUrl).toMatch(/fill-/);
        expect(field.currentProjectionUrl).not.toBe(field.currentUrl);
        expect(document.querySelectorAll('video')).toHaveLength(0);
        cortex.destroy();
    });

    it('does not adopt a procedural word-fill onto a non-empty room', () => {
        const { cortex } = hostedContinuousCortex();
        seedPool(cortex, 'aic-landscapes', ['room-a.jpg']);
        cortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['aic-landscapes'],
            wordFill: { mode: 'pick', sourced: [], procedural: ['fractal'] }
        });
        expect(cortex.config.activeTypes).toEqual(['aic-landscapes']);
        expect(cortex.config.wordFill).toEqual({
            mode: 'pick',
            sourceFamily: 'procedural',
            procedural: ['fractal'],
            sourced: []
        });
        expect(cortex._continuousProceduralTypes()).toEqual([]);
        expect(cortex._wordFillProceduralTypes()).toEqual(['fractal']);
        cortex.destroy();
    });

    it('wordFill snapshots each shared engine as a projection still', async () => {
        const { cortex } = hostedContinuousCortex();
        seedPool(cortex, 'aic-landscapes', ['room-a.jpg']);
        cortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['aic-landscapes']
        });
        const engines = [
            'klee', 'turrell', 'fractal', 'neural', 'rockgarden',
            'harmonograph', 'ostensoria', 'apparitio'
        ];
        for (const id of engines) {
            cortex.updateConfig({
                wordFill: { mode: 'pick', sourced: [], procedural: [id] }
            });
            const render = vi.spyOn(cortex, '_renderContinuousProceduralWork')
                .mockResolvedValue({
                    url: `data:image/webp;base64,${id}-fill`,
                    title: id,
                    sourceType: id
                });
            const painted = await cortex._nextContinuousProjectionWork({ currentUrl: 'room-a.jpg' });
            expect(painted, id).toEqual({
                url: `data:image/webp;base64,${id}-fill`,
                title: id,
                sourceType: id
            });
            expect(render, id).toHaveBeenCalledWith(id);
            expect(cortex.config.activeTypes, id).toEqual(['aic-landscapes']);
            render.mockRestore();
        }
        cortex.destroy();
    });
});

describe('Gallery procedural engines stay engines', () => {
    afterEach(() => {
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    it('does not treat a prefixed Fractal Flames id as an empty gallery source', () => {
        const cortex = new VisualCortex();
        cortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['procedural:fractal']
        });
        expect(cortex.config.activeTypes).toEqual(['fractal']);
        expect(cortex._isExternalCategory('procedural:fractal')).toBe(false);
        expect(cortex._isExternalCategory('fractal')).toBe(false);
        expect(cortex._activePoolCategories()).toEqual([]);
        expect(cortex._continuousHasWorks()).toBe(true);
        expect(cortex._continuousProceduralTypes()).toEqual(['fractal']);
        cortex.destroy();
    });

    it('an unknown source does not become a Wikimedia shelf when a procedural id is chosen', () => {
        const cortex = new VisualCortex();
        cortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['procedural:fractal', 'missing-shelf']
        });
        expect(cortex.config.activeTypes).toEqual(['fractal', 'missing-shelf']);
        expect(cortex._isExternalCategory('fractal')).toBe(false);
        expect(cortex._continuousProceduralTypes()).toEqual(['fractal']);
        expect(cortex._continuousHasWorks()).toBe(true);
        cortex.destroy();
    });

    it('selecting Fractal Flames mounts the engine into Gallery, not an empty glass wall', async () => {
        grantVisualInterlocutionConsent();
        vi.spyOn(ContinuousField.prototype, '_defaultDecode').mockResolvedValue(true);
        const cortex = new VisualCortex();
        cortex._scheduleBackgroundWarm = () => {};
        cortex._scheduleRollingRefresh = () => {};
        vi.spyOn(cortex, '_renderContinuousProceduralWork')
            .mockResolvedValue({
                url: 'data:image/webp;base64,flame',
                title: 'Fractal Flame',
                sourceType: 'fractal'
            });
        const host = document.createElement('div');
        document.body.appendChild(host);
        cortex.setContinuousFieldHost(host);
        cortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['procedural:fractal']
        });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(cortex._continuousField?.running).toBe(true);
        expect(cortex._harmonographField?.running).toBeFalsy();
        expect(cortex._renderContinuousProceduralWork).toHaveBeenCalledWith('fractal');
        expect(cortex._continuousField.currentUrl).toBe('data:image/webp;base64,flame');
        expect(host.querySelectorAll('.continuous-field-layer').length).toBeGreaterThan(0);
        cortex.destroy();
    });
});

describe('a figure survives the crossing into the cortex', () => {
    // This exact seam — a vocabulary living in two files where only one
    // copy learns a new word — has failed four times on this feature:
    // the ingest/reader split over titled chapters, applyCue dropping
    // procedural entirely, normalizeVisualProgram rejecting the source
    // coordinate space, and the gallery's own procedural allowlist.
    // Every one was silent. This is the fifth crossing.
    it('carries the named engines onto the config', () => {
        const cortex = new VisualCortex();
        cortex.applyCue({
            kind: 'procedural',
            collections: ['paradise-lost'],
            engines: ['flaming_sword']
        });
        expect(cortex.config.activeTypes).toEqual(['paradise-lost']);
        expect(cortex.config.workEngines).toEqual(['flaming_sword']);
    });

    it('clears the engine when the next cue names none', () => {
        // Otherwise the sword would hold through a stretch that asked
        // for the family at large, and a gap would silently inherit the
        // figure before it.
        const cortex = new VisualCortex();
        cortex.applyCue({
            kind: 'procedural', collections: ['paradise-lost'], engines: ['flaming_sword']
        });
        cortex.applyCue({ kind: 'procedural', collections: ['paradise-lost'] });
        expect(cortex.config.activeTypes).toEqual(['paradise-lost']);
        expect(cortex.config.workEngines).toEqual([]);
    });

    it('clears the engine on leaving procedural entirely', () => {
        const cortex = new VisualCortex();
        cortex.applyCue({
            kind: 'procedural', collections: ['paradise-lost'], engines: ['chariot_deity']
        });
        cortex.applyCue({ kind: 'sourced', collections: ['atr-attic-vases'] });
        expect(cortex.config.workEngines).toEqual([]);
        cortex.applyCue({
            kind: 'procedural', collections: ['paradise-lost'], engines: ['chariot_deity']
        });
        cortex.applyCue({ kind: 'still' });
        expect(cortex.config.workEngines).toEqual([]);
    });
});
