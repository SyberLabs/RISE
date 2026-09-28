import { describe, expect, it } from 'vitest';
import { createSpeakerKey } from './speaker-key.js';

describe('hold a key to mark audience speech', () => {
    it('labels nothing as audience while the key is up', () => {
        const key = createSpeakerKey();
        expect(key.audience(false)).toBe(false);
        expect(key.audience(true)).toBe(false);
    });

    it('labels an utterance audience while the key is held', () => {
        const key = createSpeakerKey();
        key.press();
        expect(key.audience(false)).toBe(true);
        expect(key.audience(true)).toBe(true);
    });

    it('keeps the utterance audience when the key is released before the final', () => {
        const key = createSpeakerKey();
        expect(key.audience(false)).toBe(false);
        key.press();
        expect(key.audience(false)).toBe(true);
        key.release();
        expect(key.audience(false)).toBe(true);
        expect(key.audience(true)).toBe(true);
        // The next utterance starts unmarked.
        expect(key.audience(false)).toBe(false);
        expect(key.audience(true)).toBe(false);
    });

    it('marks the next utterance too while the key stays down across a final', () => {
        const key = createSpeakerKey();
        key.press();
        expect(key.audience(true)).toBe(true);
        expect(key.audience(true)).toBe(true);
        key.release();
        expect(key.audience(true)).toBe(true);
        expect(key.audience(true)).toBe(false);
    });
});
