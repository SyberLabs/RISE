import { describe, expect, it } from 'vitest';
import {
    GALLERY_CADENCE_DEFAULT,
    VISUAL_PRESENCE_DEFAULT_MS,
    VISUAL_PRESENCE_STEPS_MS,
    formatVisualPresence,
    galleryCadenceTimings,
    galleryCadenceValueText,
    minimumVisualPresenceRest,
    nearestVisualPresenceStep,
    normalizeGalleryCadence,
    normalizeVisualPresence,
    responsiveVisualPresence,
    visualPresenceTransition,
    visualPresenceValueText
} from './visual-presence.js';

describe('Visual Presence policy', () => {
    it('maps one normalized Gallery cadence from contemplative to lively', () => {
        expect(normalizeGalleryCadence(undefined)).toBe(GALLERY_CADENCE_DEFAULT);
        expect(normalizeGalleryCadence(-4)).toBe(0);
        expect(normalizeGalleryCadence(4)).toBe(1);

        expect(galleryCadenceTimings(0)).toEqual({
            cadence: 0,
            dwellMs: 30000,
            crossfadeMs: 2500
        });
        expect(galleryCadenceTimings(0.5)).toMatchObject({
            cadence: 0.5,
            dwellMs: 15492,
            crossfadeMs: 2500
        });
        expect(galleryCadenceTimings(1)).toEqual({
            cadence: 1,
            dwellMs: 8000,
            crossfadeMs: 1440
        });
        expect(galleryCadenceValueText(0.5))
            .toBe('balanced, about 15 seconds per work, 2.5 second dissolve');
    });

    it('normalizes missing, legacy, and oversized values', () => {
        expect(normalizeVisualPresence(undefined)).toBe(VISUAL_PRESENCE_DEFAULT_MS);
        expect(normalizeVisualPresence(80)).toBe(150);
        expect(normalizeVisualPresence(2000)).toBe(2000);
        expect(normalizeVisualPresence(9000)).toBe(2000);
        expect(normalizeVisualPresence(normalizeVisualPresence(451))).toBe(451);
    });

    it('uses curated perceptual steps without rejecting runtime values between them', () => {
        expect(VISUAL_PRESENCE_STEPS_MS).toEqual([150, 200, 300, 450, 700, 1000, 1400, 2000]);
        expect(nearestVisualPresenceStep(451)).toBe(450);
        expect(normalizeVisualPresence(451)).toBe(451);
    });

    it('formats concise visual and accessible values', () => {
        expect(formatVisualPresence(450)).toBe('450 ms');
        expect(formatVisualPresence(1400)).toBe('1.4 s');
        expect(visualPresenceValueText(700)).toBe('700 milliseconds, exposure');
        expect(visualPresenceValueText(2000)).toBe('2.0 seconds, tableau');
    });

    it('contracts responsive presence from its selected ceiling toward 75 percent', () => {
        expect(responsiveVisualPresence(200, 0)).toBe(200);
        expect(responsiveVisualPresence(200, 0.5)).toBe(175);
        expect(responsiveVisualPresence(200, 1)).toBe(150);
        expect(responsiveVisualPresence(2000, 0)).toBe(2000);
        expect(responsiveVisualPresence(2000, 0.5)).toBe(1750);
        expect(responsiveVisualPresence(2000, 1)).toBe(1500);
    });

    it('assigns tiered transitions inside the requested total duration', () => {
        expect(visualPresenceTransition(200)).toEqual({ enterMs: 0, exitMs: 0 });
        expect(visualPresenceTransition(300)).toEqual({ enterMs: 32, exitMs: 32 });
        expect(visualPresenceTransition(700)).toEqual({ enterMs: 64, exitMs: 64 });
        expect(visualPresenceTransition(2000)).toEqual({ enterMs: 96, exitMs: 96 });
    });

    it('scales minimum rest with the preceding successful presence', () => {
        expect(minimumVisualPresenceRest(150)).toBe(250);
        expect(minimumVisualPresenceRest(200)).toBe(250);
        expect(minimumVisualPresenceRest(2000)).toBe(2500);
    });
});
