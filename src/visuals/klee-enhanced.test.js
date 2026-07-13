/** Preset integration regressions for the five canonical Klee compositions. */
import { describe, it, expect, vi } from 'vitest';
import {
    KleeEngine,
    KLEE_CHAMBER_BACKGROUND,
    KLEE_PRESET_PROFILES,
    createSeededRandom,
    interpolatePresetProfiles,
    planKleeModulation
} from './klee-enhanced.js';

describe('KleeEngine curated presets', () => {
    it('recreates the canonical Architectural Grid recipe', () => {
        const engine = new KleeEngine();
        engine.generateRandom('architectural');
        expect(engine.seeds).toHaveLength(1);
        expect(engine.seeds[0]).toMatchObject({
            angle: Math.PI / 2,
            variations: { architectural: 0.8, angular: 0.2 },
            symmetry: 2,
            params: { stepLength: 20 }
        });
    });

    it('recreates the canonical Chaotic Explosion recipe', () => {
        const engine = new KleeEngine();
        engine.generateRandom('chaotic');
        expect(engine.seeds).toHaveLength(4);
        for (const seed of engine.seeds) {
            expect(seed.variations).toEqual({ chaotic: 0.5, explosive: 0.3, trembling: 0.2 });
            expect(seed.symmetry).toBe(0);
        }
    });

    it('recreates Harmonic Resonance, including its six-fold symmetry', () => {
        const engine = new KleeEngine();
        engine.generateRandom('harmonic');
        expect(engine.seeds).toHaveLength(1);
        expect(engine.seeds[0]).toMatchObject({
            x: 512,
            y: 512,
            variations: { harmonic: 0.7, rhythmic: 0.3 },
            symmetry: 6
        });
    });

    it('recreates the canonical Gravitational orbital topology (parametric, capture guaranteed)', () => {
        const engine = new KleeEngine({ seed: 'gravity-topology' });
        engine.generateRandom('gravitational', { seed: 'gravity-topology' });
        // protagonist + echo + chorus(3-5) + whisper
        expect(engine.seeds.length).toBeGreaterThanOrEqual(6);
        expect(engine.seeds.length).toBeLessThanOrEqual(8);
        for (const seed of engine.seeds) {
            // Constructed geometry, not tuned steering feedback
            expect(seed.params.decay).toBeLessThan(1);
            expect(seed.params.decay).toBeGreaterThan(0.95);
            expect(seed.params.angularStep).toBeGreaterThan(0);
            expect(seed.params.coilRadius).toBeGreaterThan(0);
            expect(Math.abs(seed.params.direction)).toBe(1);
            expect(seed.branchProbability).toBe(0);
            expect(seed.variations.orbital + seed.variations.flowing).toBeCloseTo(1);
        }
        // All orbits share one attractor
        const centers = new Set(engine.seeds.map(s => `${s.params.centerX},${s.params.centerY}`));
        expect(centers.size).toBe(1);

        // Stroke hierarchy: one heavy protagonist, one faint whisper frame
        expect(engine.seeds[0].params.lineWeight).toBe(1.55);
        expect(engine.seeds[0].params.lineAlpha).toBe(1);
        const whisper = engine.seeds[engine.seeds.length - 1];
        expect(whisper.params.lineAlpha).toBeLessThan(0.5);
        expect(whisper.params.decay).toBeGreaterThan(0.999); // framing orbit barely falls

        expect(engine.lines.length).toBeLessThanOrEqual(10);
    });

    it('gravitational responds to the signal compositionally, not dynamically', () => {
        const calm = new KleeEngine({ seed: 'semantic-orbit' });
        calm.generateRandom('gravitational', { seed: 'semantic-orbit', signal: { valence: 0.5, arousal: 0 } });
        const intense = new KleeEngine({ seed: 'semantic-orbit' });
        intense.generateRandom('gravitational', { seed: 'semantic-orbit', signal: { valence: -0.5, arousal: 1 } });

        // Arousal densifies the system with more chorus orbits (3 vs 5)
        expect(intense.seeds.length - calm.seeds.length).toBe(2);
        // But never destabilizes capture: decay stays in the guaranteed band
        for (const seed of intense.seeds) {
            expect(seed.params.decay).toBeLessThan(1);
            expect(seed.params.decay).toBeGreaterThan(0.95);
        }
    });

    it('the gravitational protagonist winds into its terminal coil (the mass renders itself)', () => {
        const engine = new KleeEngine({ seed: 'gravity-coil' });
        engine.generateRandom('gravitational', { seed: 'gravity-coil', detectForms: false });

        const protagonist = engine.seeds[0];
        const line = engine.lines[0];
        expect(line.points.length).toBeGreaterThan(100);

        const { centerX, centerY, coilRadius } = protagonist.params;
        const endRadii = line.points.slice(-10).map(([x, y]) => Math.hypot(x - centerX, y - centerY));
        // Capture by construction: the line ends circling at ~coil radius
        for (const r of endRadii) {
            expect(r).toBeLessThanOrEqual(coilRadius * 1.6);
        }
        // And it decayed monotonically-ish: start radius far exceeds end radius
        const [sx, sy] = line.points[0];
        expect(Math.hypot(sx - centerX, sy - centerY)).toBeGreaterThan(coilRadius * 5);
    });

    it('recreates the canonical Twittering Machine five-line topology', () => {
        const engine = new KleeEngine();
        engine.generateRandom('twittering');
        expect(engine.seeds).toHaveLength(5);
        expect(engine.seeds[0].variations).toEqual({ twittering: 0.7, trembling: 0.3 });
        expect(engine.seeds[0].params.stepLength).toBe(6);
        const expected = [200, 360, 520, 680, 840];
        engine.seeds.forEach((seed, index) => expect(Math.abs(seed.x - expected[index])).toBeLessThanOrEqual(12));
    });

    it('preserves the active non-square canvas dimensions during generation', () => {
        const engine = new KleeEngine();
        engine.width = 1920;
        engine.height = 1080;
        const result = engine.generateRandom('harmonic');
        expect(result).toMatchObject({ width: 1920, height: 1080 });
        expect(engine.seeds[0]).toMatchObject({ x: 960, y: 540 });
    });

    it('legacy preset names alias onto curated themes (saved blueprints keep rendering)', () => {
        const aliased = {
            corporeal: 'harmonic',
            structural: 'architectural',
            mythic: 'twittering',
            volatile: 'chaotic',
            centered: 'gravitational',
            'gravitational-pull': 'gravitational',
            wireframe: 'architectural'
        };
        // Each curated preset's lead variation ('gravitational' leads with
        // the parametric 'orbital' walk)
        const leadVariation = {
            harmonic: 'harmonic',
            architectural: 'architectural',
            twittering: 'twittering',
            chaotic: 'chaotic',
            gravitational: 'orbital'
        };
        for (const [legacy, target] of Object.entries(aliased)) {
            const engine = new KleeEngine();
            engine.generateRandom(legacy);
            expect(engine.seeds.length).toBeGreaterThan(0);
            expect(engine.preset).toBe(target);
            expect(engine.seeds.every(seed => leadVariation[target] in seed.variations)).toBe(true);
        }
    });

    it('unknown names fall back to harmonic', () => {
        const engine = new KleeEngine();
        engine.generateRandom('does-not-exist');
        expect(engine.seeds).toHaveLength(1);
        expect(engine.seeds[0].variations).toEqual({ harmonic: 0.7, rhythmic: 0.3 });
    });

    it('replays the same artwork exactly from the same seed', () => {
        const a = new KleeEngine({ seed: 'same' });
        const b = new KleeEngine({ seed: 'same' });
        a.generateRandom('gravitational', { seed: 'orbit-42' });
        b.generateRandom('gravitational', { seed: 'orbit-42' });
        expect(a.seeds).toEqual(b.seeds);
        expect(a.lines).toEqual(b.lines);
    });

    it('gives Gravitational stochastic siblings while retaining its orbital identity', () => {
        const engine = new KleeEngine({ seed: 'sequence' });
        engine.generateRandom('gravitational');
        const first = engine.seeds.map(({ x, y, params }) => [x, y, params.angularStep]);
        engine.generateRandom('gravitational');
        const second = engine.seeds.map(({ x, y, params }) => [x, y, params.angularStep]);
        expect(second).not.toEqual(first);
        expect(engine.seeds.length).toBeGreaterThanOrEqual(6);
        expect(engine.seeds.length).toBeLessThanOrEqual(8);
    });

    it('provides deterministic random streams and smooth profile interpolation', () => {
        const a = createSeededRandom('walk');
        const b = createSeededRandom('walk');
        expect([a(), a(), a()]).toEqual([b(), b(), b()]);

        const blend = interpolatePresetProfiles('architectural', 'harmonic', 0.5);
        expect(blend.variations.architectural).toBeCloseTo(0.4);
        expect(blend.variations.harmonic).toBeCloseTo(0.35);
        expect(blend.style.glow).toBeCloseTo(
            (KLEE_PRESET_PROFILES.architectural.style.glow + KLEE_PRESET_PROFILES.harmonic.style.glow) / 2
        );
    });

    it('keeps raw rendering neutral and semantic modulation bounded', () => {
        expect(planKleeModulation(null)).toMatchObject({ density: 1, branching: 1, motion: 1 });
        const intense = planKleeModulation({ valence: 4, arousal: 4 });
        expect(intense.valence).toBe(1);
        expect(intense.arousal).toBe(1);
        expect(intense.density).toBeGreaterThan(1);
        expect(intense.density).toBeLessThanOrEqual(1.22);

        const engine = new KleeEngine({ seed: 'semantic' });
        engine.generateRandom('architectural', { seed: 'semantic', signal: { valence: -1, arousal: 1 } });
        expect(engine.preset).toBe('architectural');
        expect(engine.seeds[0].params.stepLength).toBeGreaterThan(20);
        expect(engine.seeds[0].branchProbability).toBeLessThanOrEqual(0.08);
    });

    it('renders progressively with deterministic stroke hierarchy', () => {
        const engine = new KleeEngine({ seed: 'progress' });
        engine.generateRandom('harmonic', { seed: 'progress', detectForms: false });
        const makeCanvas = () => {
            const ctx = {
                fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
                stroke: vi.fn(), save: vi.fn(), restore: vi.fn(), createPattern: vi.fn()
            };
            return { width: engine.width, height: engine.height, getContext: () => ctx, ctx };
        };
        const early = makeCanvas();
        const complete = makeCanvas();
        engine.render(early, { progress: 0.2, showForms: false, texture: 0 });
        engine.render(complete, { progress: 1, showForms: false, texture: 0 });
        expect(early.ctx.lineTo.mock.calls.length).toBeGreaterThan(0);
        expect(complete.ctx.lineTo.mock.calls.length).toBeGreaterThan(early.ctx.lineTo.mock.calls.length);
        expect(engine.lines.every(line => [0.68, 1, 1.55].includes(line.weight))).toBe(true);
        expect(early.ctx.fillStyle).toBe(KLEE_CHAMBER_BACKGROUND);
    });

    it('keeps spiral outside the Klee variation vocabulary', () => {
        const engine = new KleeEngine();
        expect(engine._getVariationFunction('spiral')).toBe(engine._varStraight);
        expect(Object.values(KLEE_PRESET_PROFILES).every(profile => !('spiral' in profile.variations))).toBe(true);
    });

    it('enforces a hard composition budget for every preset', () => {
        for (const [preset, profile] of Object.entries(KLEE_PRESET_PROFILES)) {
            const engine = new KleeEngine({ seed: `budget-${preset}` });
            engine.generateRandom(preset, { seed: `budget-${preset}`, detectForms: false });
            expect(engine.lines.length).toBeLessThanOrEqual(profile.generation.maxTotalLines);
            expect(engine.maxSteps).toBe(profile.generation.steps);
        }
    });

    it('captures and restores a preloaded artwork without regenerating it', () => {
        const engine = new KleeEngine({ seed: 'snapshot' });
        engine.generateRandom('harmonic', { seed: 'snapshot', detectForms: false });
        const snapshot = engine.captureArtwork();
        const originalLines = engine.lines;
        engine.generateRandom('chaotic', { seed: 'replacement', detectForms: false });

        expect(engine.restoreArtwork(snapshot)).toBe(true);
        expect(engine.preset).toBe('harmonic');
        expect(engine.lines).toBe(originalLines);
        expect(engine.seed).toBe('snapshot');
    });

    it('restoreArtwork rescales geometry captured at a different canvas size', () => {
        const engine = new KleeEngine({ seed: 'rescale' });
        engine.width = 1000;
        engine.height = 500;
        engine.generateRandom('harmonic', { seed: 'rescale', detectForms: false });
        const snapshot = engine.captureArtwork();
        const originalFirstPoint = snapshot.lines[0].points[0];

        engine.width = 2000;
        engine.height = 1000;
        expect(engine.restoreArtwork(snapshot)).toBe(true);
        const restoredFirstPoint = engine.lines[0].points[0];
        expect(restoredFirstPoint[0]).toBeCloseTo(originalFirstPoint[0] * 2);
        expect(restoredFirstPoint[1]).toBeCloseTo(originalFirstPoint[1] * 2);
        // snapshot itself is untouched (queue items stay reusable)
        expect(snapshot.lines[0].points[0]).toBe(originalFirstPoint);
    });

    it('destroy() rejects in-flight worker requests instead of leaving them pending', async () => {
        const engine = new KleeEngine({ seed: 'teardown' });
        let settled = false;
        const pending = new Promise((resolve, reject) => {
            engine._workerRequests.set(1, { resolve, reject });
        }).catch(err => {
            settled = true;
            expect(err.message).toContain('destroyed');
        });

        engine.destroy();
        await pending;
        expect(settled).toBe(true); // previously hung forever → preload deadlock
    });

    it('starts rendering without waiting for worker enhancements', async () => {
        const engine = new KleeEngine({ seed: 'responsive-worker' });
        let releaseTexture;
        engine._requestWorker = vi.fn(() => new Promise(resolve => {
            releaseTexture = () => resolve({ size: 2, pixels: new ArrayBuffer(16) });
        }));
        engine._textureTileFromBytes = vi.fn(() => ({ ready: true }));

        const artwork = await engine.generateRandomAsync('harmonic', {
            detectForms: false,
            awaitEnhancements: false
        });

        expect(artwork.lines.length).toBeGreaterThan(0);
        expect(engine.textureTile).toBeNull();
        releaseTexture();
        await engine._enhancementPromise;
        expect(engine.textureTile).toEqual({ ready: true });
    });
});
