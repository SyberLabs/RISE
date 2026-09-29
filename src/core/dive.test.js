import { describe, expect, it } from 'vitest';
import { GLANCE_HOLD_MS, createDive } from './dive.js';

/**
 * Diving is looking under the passage the reading is at. It never moves the
 * reading, so it is a small state and nothing more: the surface, a glance the
 * reader is holding open, or a dive they have anchored.
 *
 *   press and hold  → a glance: open while held, surfaced on release
 *   press and let go quickly → an anchor: stays open until asked to close
 *   press while anchored → surfaces on release
 */
describe('a dive', () => {
    it('begins at the surface', () => {
        expect(createDive().state).toBe('surface');
    });

    it('opens the moment it is pressed, as a glance', () => {
        const dive = createDive();
        expect(dive.press(0)).toEqual({ from: 'surface', to: 'glance' });
        expect(dive.state).toBe('glance');
    });

    it('surfaces on release after a hold, because it was only a glance', () => {
        const dive = createDive();
        dive.press(1000);
        expect(dive.release(1000 + GLANCE_HOLD_MS)).toEqual({ from: 'glance', to: 'surface' });
    });

    it('stays open on a quick release, because that was an anchor', () => {
        const dive = createDive();
        dive.press(1000);
        expect(dive.release(1000 + GLANCE_HOLD_MS - 1)).toEqual({ from: 'glance', to: 'anchored' });
        expect(dive.state).toBe('anchored');
    });

    it('surfaces when pressed again while anchored, however briefly', () => {
        const dive = createDive();
        dive.press(0);
        dive.release(50);
        expect(dive.press(5000)).toBeNull();
        expect(dive.state).toBe('anchored');
        expect(dive.release(5010)).toEqual({ from: 'anchored', to: 'surface' });
    });

    it('treats a click that had no press before it as a tap', () => {
        const dive = createDive();
        expect(dive.tap()).toEqual({ from: 'surface', to: 'anchored' });
        expect(dive.tap()).toEqual({ from: 'anchored', to: 'surface' });
    });

    it('surfaces from anywhere on request, and says nothing when already there', () => {
        const dive = createDive();
        expect(dive.surface()).toBeNull();
        dive.press(0);
        expect(dive.surface()).toEqual({ from: 'glance', to: 'surface' });
        dive.tap();
        expect(dive.surface()).toEqual({ from: 'anchored', to: 'surface' });
        expect(dive.state).toBe('surface');
    });

    it('ignores a release that has no press', () => {
        const dive = createDive();
        expect(dive.release(100)).toBeNull();
        expect(dive.state).toBe('surface');
    });

    it('ignores a second press while one is held', () => {
        const dive = createDive();
        dive.press(0);
        expect(dive.press(10)).toBeNull();
        expect(dive.release(20)).toEqual({ from: 'glance', to: 'anchored' });
    });
});
