/**
 * Klee flash architecture tests — the KleeFlashes wrapper owns the queue
 * and episode lifecycle; the cortex delegates. Includes regressions for the
 * review findings: queue survival across resizes and identical configs,
 * refill-on-low, preload failure recovery, and one-shot preset overrides.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisualCortex } from './visual-cortex.js';
import { KleeFlashes } from './klee-flashes.js';

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
