import { afterEach, describe, expect, it } from 'vitest';
import { USER_DATA_KEYS } from './user-data-keys.js';
import {
    deleteSequencePilotFeedback,
    exportSequencePilotFeedback,
    listSequencePilotFeedback,
    saveSequencePilotFeedback
} from './sequence-pilot-feedback.js';

const answer = { sequenceId: 'pilot-1', version: 1, value: 'yes', returnIntent: 'maybe' };

describe('sequence pilot feedback', () => {
    afterEach(() => localStorage.clear());

    it('does not store an answer without explicit consent', () => {
        expect(() => saveSequencePilotFeedback(answer)).toThrow(/consent/i);
        expect(localStorage.length).toBe(0);
        expect(listSequencePilotFeedback()).toEqual([]);
    });

    it('stores only bounded answer fields after consent', () => {
        saveSequencePilotFeedback({ ...answer, consent: true, passageText: 'private passage', rawIntent: 'private intent' });

        expect(listSequencePilotFeedback()).toEqual([answer]);
        expect(localStorage.getItem(USER_DATA_KEYS.sequencePilotFeedback)).not.toMatch(/private/);
    });

    it('rejects free text and invalid choices before storage', () => {
        expect(() => saveSequencePilotFeedback({ ...answer, value: 'I felt moved', consent: true })).toThrow();
        expect(() => saveSequencePilotFeedback({ ...answer, sequenceId: 'private passage with spaces', consent: true })).toThrow();
        expect(() => saveSequencePilotFeedback({ ...answer, version: 0, consent: true })).toThrow();
        expect(() => saveSequencePilotFeedback({ ...answer, version: 1.5, consent: true })).toThrow();
        expect(() => saveSequencePilotFeedback({
            ...answer,
            sequenceId: { toString: () => 'pilot-1', privateText: 'private passage' },
            consent: true
        })).toThrow();
        expect(localStorage.length).toBe(0);
    });

    it('replaces an answer for the same sequence version and bounds records', () => {
        for (let i = 0; i < 30; i += 1) {
            saveSequencePilotFeedback({ sequenceId: `pilot-${i}`, version: 1, value: 'no', consent: true });
        }
        saveSequencePilotFeedback({ sequenceId: 'pilot-29', version: 1, value: 'yes', consent: true });

        const records = listSequencePilotFeedback();
        expect(records).toHaveLength(24);
        expect(records[0].sequenceId).toBe('pilot-6');
        expect(records.filter(record => record.sequenceId === 'pilot-29')).toEqual([
            { sequenceId: 'pilot-29', version: 1, value: 'yes' }
        ]);
    });

    it('exports only by explicit choice and deletes locally on opt out', () => {
        saveSequencePilotFeedback({ ...answer, consent: true });
        expect(() => exportSequencePilotFeedback()).toThrow(/consent/i);
        expect(exportSequencePilotFeedback({ consent: true })).toEqual([answer]);

        deleteSequencePilotFeedback();
        expect(listSequencePilotFeedback()).toEqual([]);
        expect(localStorage.getItem(USER_DATA_KEYS.sequencePilotFeedback)).toBeNull();
    });
});
