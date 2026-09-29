import { describe, expect, it } from 'vitest';
import { encodeText, CONFIDENCE_CAP, TEXT_ENCODER_MANIFEST } from './text/encode.js';
import { encodeLexical } from './text/lexical.js';
import { linearCore } from './text/readout.js';
import { extractFeatures, FEATURE_NAMES } from './text/features.js';

describe('contextual text encoder', () => {
    it('flips a negated lexicon word and the bag-of-words baseline does not', () => {
        const contextual = encodeText('I am not happy.');
        const lexical = encodeLexical('I am not happy.');
        const plain = encodeText('I am happy.');
        expect(plain.dimensions.valence.value).toBeGreaterThan(0);
        expect(contextual.dimensions.valence.value).toBeLessThan(0);
        expect(lexical.dimensions.valence.value).toBeGreaterThan(0);
        expect(contextual.provenance.contentHash).not.toBe(plain.provenance.contentHash);
    });

    it('caps confidence and says the readout was not trained', () => {
        const state = encodeText('I celebrate myself and sing of the vast universe.');
        for (const slot of Object.values(state.dimensions)) {
            expect(slot.confidence).toBeLessThanOrEqual(CONFIDENCE_CAP);
        }
        expect(state.caveats).toContain('unfitted-linear-prior');
        expect(state.provenance.trained).toBe('false');
        expect(TEXT_ENCODER_MANIFEST.trained).toBe(false);
        expect(state.emotions == null || state.emotions.role === 'auxiliary').toBe(true);
    });

    it('leaves solemnity unset when the window finds no solemn cue', () => {
        const state = encodeText('I am happy.');
        expect(state.dimensions.solemnity.value).toBeNull();
        expect(state.dimensions.perceptualDensity.value).not.toBeNull();
        expect(state.dimensions.perceptualDensity.source).toBe('derived');
    });

    it('matches the unclamped linear core on a one-feature vector', () => {
        const values = FEATURE_NAMES.map(name => (name === 'valenceLex' ? 0.5 : 0));
        const raw = linearCore(values);
        expect(raw.valence).toBeCloseTo(0.4);
        const features = extractFeatures('I am happy.');
        expect(features.values).toHaveLength(FEATURE_NAMES.length);
        expect(features.hits).toBeGreaterThan(0);
    });

    it('refuses a non-string and returns an empty text as unavailable', () => {
        expect(() => encodeText(12)).toThrow(TypeError);
        expect(encodeText('   ').provenance.reason).toBe('empty-text');
    });
});
