import { describe, expect, it } from 'vitest';
import { affectEnabled } from './flags.js';
import { experienceState, slot, unavailableState, validateExperienceState } from './schema.js';

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
        expect(validateExperienceState(state).ok).toBe(true);
    });

    it('rejects an unknown axis and a version drift', () => {
        expect(() => experienceState({
            modality: 'text',
            dimensions: { sadness: slot(1, 1, 'inferred') },
            provenance: { method: 'test' }
        })).toThrow(/Unknown experience dimension/);
        const state = experienceState({
            modality: 'text',
            provenance: { method: 'test' }
        });
        expect(validateExperienceState({ ...state, version: 99 }).ok).toBe(false);
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

describe('affect flag', () => {
    it('stays off unless the caller turns it on', () => {
        expect(affectEnabled({})).toBe(false);
        expect(affectEnabled({ RISE_AFFECT: '0' })).toBe(false);
        expect(affectEnabled({ RISE_AFFECT: '1' })).toBe(true);
        expect(affectEnabled({ VITE_RISE_AFFECT: 'true' })).toBe(true);
    });
});
