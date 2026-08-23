import { describe, expect, it } from 'vitest';
import {
    GALLERY_CADENCE_DEFAULT,
    VISUAL_PRESENCE_DEFAULT_MS,
    VISUAL_PRESENCE_STEPS_MS,
    formatVisualPresence,
    galleryCadenceTimings,
    galleryCadenceValueText,
    galleryDrawProgress,
    galleryWallAt,
    harmonographDrawProgress,
    minimumVisualPresenceRest,
    nearestVisualPresenceStep,
    normalizeGalleryCadence,
    normalizePresentation,
    normalizeVisualPresence,
    isContinuousPresentation,
    isGalleryInTheWord,
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

    it('dissolves the gallery wall at explicit time, never through a cut', () => {
        const long = galleryWallAt(0, 4, { durationMs: 60_000 });
        expect(long.outgoingIndex).toBeNull();
        expect(long.incomingIndex).toBe(0);
        expect(long.mix).toBe(1);
        expect(long.dwellMs).toBe(15492);

        const held = galleryWallAt(4_000, 4, { durationMs: 60_000 });
        expect(held.outgoingIndex).toBeNull();
        expect(held.incomingIndex).toBe(0);
        expect(held.mix).toBe(1);

        const dissolving = galleryWallAt(long.dwellMs + long.crossfadeMs / 2, 4, {
            durationMs: 60_000
        });
        expect(dissolving.outgoingIndex).toBe(0);
        expect(dissolving.incomingIndex).toBe(1);
        // Half a crossfade in, the cosine ease sits exactly at the midpoint.
        expect(dissolving.mix).toBeCloseTo(0.5, 5);

        const short = galleryWallAt(0, 4, { durationMs: 9_300 });
        expect(short.dwellMs).toBeLessThan(galleryCadenceTimings(0.5).dwellMs);
        expect(short.crossfadeMs).toBeGreaterThanOrEqual(1_200);
        const mid = galleryWallAt(short.dwellMs, 4, { durationMs: 9_300 });
        expect(mid.outgoingIndex).toBe(0);
        expect(mid.incomingIndex).toBe(1);
        expect(mid.mix).toBe(0);
    });

    it('paces a Gallery Harmonograph so the figure completes with a few seconds to spare', () => {
        // An 8 s dwell draws for 5.5 s, leaving the full 2.5 s hold.
        expect(harmonographDrawProgress(0, 8_000)).toBe(0);
        expect(harmonographDrawProgress(5_499, 8_000)).toBeLessThan(1);
        expect(harmonographDrawProgress(5_500, 8_000)).toBe(1);
        expect(harmonographDrawProgress(8_000, 8_000)).toBe(1);
        const mid = harmonographDrawProgress(2_750, 8_000);
        expect(mid).toBeGreaterThan(0.5);
        expect(mid).toBeLessThan(1);
        // A 15.492 s dwell keeps the same 2.5 s hold: 12.992 s of drawing.
        expect(harmonographDrawProgress(12_991, 15_492)).toBeLessThan(1);
        expect(harmonographDrawProgress(12_992, 15_492)).toBe(1);
        expect(galleryDrawProgress(0, 8_000)).toBe(harmonographDrawProgress(0, 8_000));
    });

    it('keeps Gallery and Gallery-in-the-word as continuous presentations', () => {
        expect(normalizePresentation('continuous')).toBe('continuous');
        expect(normalizePresentation('continuous-word')).toBe('continuous-word');
        expect(normalizePresentation('gallery-in-the-word')).toBe('full-frame');
        expect(isContinuousPresentation('continuous')).toBe(true);
        expect(isContinuousPresentation('continuous-word')).toBe(true);
        expect(isContinuousPresentation('behind-stream')).toBe(false);
        expect(isGalleryInTheWord('continuous-word')).toBe(true);
        expect(isGalleryInTheWord('continuous')).toBe(false);
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
