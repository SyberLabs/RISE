import { describe, expect, it } from 'vitest';
import { normalizeVisualConfig } from '../core/session-compiler.js';
import { audioState } from './modalities/audio.js';
import { pacingActivation, pacingState } from './modalities/pacing.js';
import { typographyState } from './modalities/typography.js';
import { visualState } from './modalities/visual.js';

describe('modality adapters', () => {
    it('reads a blue attractor as cool and does not call it sad', () => {
        const visualConfig = normalizeVisualConfig({
            visualMode: 'attractor',
            attractor: { palette: 'blue', system: 'thomas', form: 'mirror' }
        });
        const state = visualState({ visualConfig });
        expect(state.dimensions.warmth.value).toBeLessThan(0);
        expect(state.dimensions.valence).toBeUndefined();
        expect(state.caveats).toContain('hue-is-not-valence');
    });

    it('treats white as hue-unstable and an off mode as measured absence', () => {
        const white = visualState({
            visualConfig: normalizeVisualConfig({
                visualMode: 'attractor',
                attractor: { palette: 'white' }
            })
        });
        expect(white.dimensions.warmth).toBeUndefined();
        const off = visualState({ visualConfig: { visualMode: 'off' } });
        expect(off.dimensions.perceptualDensity.value).toBe(0);
        expect(off.dimensions.motionEnergy.confidence).toBeGreaterThan(0.8);
    });

    it('places 520 words per minute in high activation and refuses to invent a pace', () => {
        expect(pacingActivation(520)).toBeGreaterThan(0.9);
        expect(pacingActivation(180)).toBeLessThan(0.45);
        const fast = pacingState({ wpm: 520, chunkMode: 'word', revealMode: 'instant' });
        expect(fast.dimensions.arousal.value).toBeGreaterThan(0.9);
        expect(fast.dimensions.arousal.source).toBe('prior');
        expect(fast.measurements.wpm).toBe(520);
        expect(pacingState({}).provenance.reason).toBe('pace-not-provided');
    });

    it('keeps audio brightness out of valence and typography out of emotion', () => {
        const audio = audioState({
            tempo: 60,
            loudness: 0.2,
            spectralDensity: 0.3,
            rhythmicActivity: 0.15,
            brightness: 0.9,
            dynamics: 0.2
        });
        expect(audio.dimensions.valence).toBeUndefined();
        expect(audio.dimensions.arousal.value).toBeLessThan(0.45);
        expect(audio.measurements.brightness).toBeCloseTo(0.9);
        expect(audio.caveats).toContain('brightness-is-not-valence');
        const type = typographyState({ letterSpacing: 0.08, fontSize: 28, fontWeight: 700 });
        expect(type.dimensions.expansiveness.value).toBeGreaterThan(0.5);
        expect(type.dimensions.valence).toBeUndefined();
        expect(audioState({}).provenance.status).toBe('unavailable');
    });
});
