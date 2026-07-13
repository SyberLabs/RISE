/**
 * Preset trim regression tests — the curated five keep their identity
 * (namesake variation always leads) and retired names alias safely.
 */
import { describe, it, expect } from 'vitest';
import { KleeEngine } from './klee-enhanced.js';

const CURATED = ['architectural', 'chaotic', 'harmonic', 'gravitational', 'twittering'];

describe('KleeEngine curated presets', () => {
    it('every curated preset leads each seed with its namesake variation', () => {
        for (const theme of CURATED) {
            const engine = new KleeEngine();
            engine.generateRandom(theme);
            expect(engine.seeds.length).toBeGreaterThan(0);
            for (const seed of engine.seeds) {
                expect(seed.variations[theme]).toBe(0.7);
            }
        }
    });

    it('never combines spiral/circular leads with rotational symmetry (the tangle recipe)', () => {
        for (const theme of CURATED) {
            const engine = new KleeEngine();
            engine.generateRandom(theme);
            for (const seed of engine.seeds) {
                const leads = Object.keys(seed.variations);
                expect(leads).not.toContain('spiral');
                expect(leads).not.toContain('circular');
                expect(seed.symmetry).toBeLessThanOrEqual(4);
            }
        }
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
        for (const [legacy, target] of Object.entries(aliased)) {
            const engine = new KleeEngine();
            engine.generateRandom(legacy);
            expect(engine.seeds.length).toBeGreaterThan(0);
            for (const seed of engine.seeds) {
                expect(seed.variations[target]).toBe(0.7);
            }
        }
    });

    it('unknown names fall back to harmonic', () => {
        const engine = new KleeEngine();
        engine.generateRandom('does-not-exist');
        for (const seed of engine.seeds) {
            expect(seed.variations.harmonic).toBe(0.7);
        }
    });
});
