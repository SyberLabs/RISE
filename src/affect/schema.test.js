import { describe, expect, it } from 'vitest';
import { experienceState, slot, unavailableState } from './schema.js';

describe('experience state', () => {
    it('omits nothing it was not given and freezes what it stores', () => {
        const state = experienceState({
            modality: 'text',
            dimensions: { valence: slot(-0.4, 0.3, 'inferred') },
            provenance: { method: 'test' }
        });
        expect(state.version).toBe(1);
        expect(state.dimensions.arousal).toBeUndefined();
        expect(state.dimensions.valence.value).toBeCloseTo(-0.4);
        expect(Object.isFrozen(state)).toBe(true);
    });

    it('rejects an unknown axis', () => {
        expect(() => experienceState({
            modality: 'text',
            dimensions: { sadness: slot(1, 1, 'inferred') },
            provenance: { method: 'test' }
        })).toThrow(/Unknown experience dimension/);
    });

    it('keeps auxiliary emotions from becoming the state', () => {
        const state = experienceState({
            modality: 'text',
            dimensions: { valence: slot(-0.2, 0.2, 'inferred') },
            emotions: {
                role: 'auxiliary',
                source: 'inferred',
                confidence: 0.2,
                labels: { sadness: 0.6 }
            },
            provenance: { method: 'test' }
        });
        expect(state.emotions.role).toBe('auxiliary');
        expect(state.dimensions.valence.value).toBeCloseTo(-0.2);
    });

    it('names an unavailable modality instead of inventing calm', () => {
        const state = unavailableState('audio', 'audio-features-absent');
        expect(state.dimensions).toEqual({});
        expect(state.provenance.status).toBe('unavailable');
        expect(state.provenance.reason).toBe('audio-features-absent');
    });
});
