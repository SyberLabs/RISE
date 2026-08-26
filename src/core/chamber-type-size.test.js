import { describe, expect, it } from 'vitest';
import {
    SIZE_HINT_FIT,
    estimateGlyphBox,
    fitWordAtomPx,
    isChamberWordFit,
    persistFontSize,
    resolveFontSize,
    sizeFitHint,
    threeStepIntent
} from './chamber-type-size.js';
import { resolveTextMaterialCapability } from './chamber-text-material.js';

describe('resolveFontSize', () => {
    it('maps s|m|l|fit to small|medium|large|fit and defaults to medium', () => {
        expect(persistFontSize('s')).toBe('small');
        expect(persistFontSize('m')).toBe('medium');
        expect(persistFontSize('l')).toBe('large');
        expect(persistFontSize('fit')).toBe('fit');
        expect(persistFontSize('small')).toBe('small');
        expect(persistFontSize('huge')).toBeNull();
        expect(resolveFontSize('s')).toBe('small');
        expect(resolveFontSize('fit')).toBe('fit');
        expect(resolveFontSize('huge')).toBe('medium');
        expect(resolveFontSize(undefined)).toBe('medium');
        expect(isChamberWordFit('fit')).toBe(true);
        expect(isChamberWordFit('l')).toBe(false);
        expect(isChamberWordFit('large')).toBe(false);
    });
});

describe('fitWordAtomPx (Fit only)', () => {
    const band = {
        fieldWidth: 390,
        fieldHeight: 720,
        padX: 24,
        padY: 16,
        measuredWidth: 240,
        measuredHeight: 80,
        measuredAt: 100
    };

    it('sizes a short Word substantially above today’s 72px three-step cap', () => {
        const usableW = 390 - 24;
        const usableH = 720 - 16;
        const px = fitWordAtomPx(band);
        expect(px).toBeGreaterThan(72 * 1.5);
        expect(px).toBeCloseTo(100 * Math.min(
            ((390 * 0.88) - 24) / 240,
            ((720 * 0.88) - 16) / 140
        ), 5);
        expect(px).toBeLessThanOrEqual(Math.min(usableW, usableH) * 0.95);
        expect(px).toBeGreaterThanOrEqual(16);
    });

    it('returns null when the chamber box is missing so Fit can wait', () => {
        expect(fitWordAtomPx({ ...band, fieldWidth: 0 })).toBeNull();
        expect(fitWordAtomPx({ ...band, measuredWidth: 0 })).toBeNull();
    });

    it('fits the line box, not only the visible glyph', () => {
        const fieldHeight = 300;
        const padY = 20;
        const px = fitWordAtomPx({
            fieldWidth: 900,
            fieldHeight,
            padX: 0,
            padY,
            measuredWidth: 40,
            measuredHeight: 20,
            measuredAt: 100,
            lineHeightRatio: 1.4
        });

        expect(px * 1.4 + padY).toBeLessThanOrEqual(fieldHeight * 0.88);
    });
});

describe('text material mask capability', () => {
    const canonical = {
        face: 'thick',
        fontSize: 'fit',
        chunkMode: 'word',
        visualMode: 'interlocution',
        presentation: 'continuous',
        wordFill: { mode: 'same' }
    };
    const maskActive = input => resolveTextMaterialCapability(input).maskActive;

    it('recognizes canonical Fit and its legacy font-size alias', () => {
        expect(maskActive(canonical)).toBe(true);
        expect(maskActive({
            ...canonical,
            fontSize: 'continuous-word'
        })).toBe(true);
    });

    it('refuses incomplete Fit configurations', () => {
        expect(maskActive({ ...canonical, chunkMode: 'phrase' })).toBe(false);
        expect(maskActive({ ...canonical, fontSize: 'large' })).toBe(false);
        expect(maskActive({ ...canonical, visualMode: 'off' })).toBe(false);
        expect(maskActive({ ...canonical, presentation: 'full-frame' })).toBe(false);
    });

    it('keeps explicit Accent ink as ordinary text instead of opening the mask', () => {
        expect(maskActive({
            ...canonical,
            wordFill: { mode: 'accent' }
        })).toBe(false);
        expect(maskActive({
            ...canonical,
            wordFill: { mode: 'same' }
        })).toBe(true);
    });

    it('preserves legacy mask inference within the Thick Fit contract', () => {
        expect(maskActive({
            ...canonical,
            wordFill: undefined,
            legacyMask: true
        })).toBe(true);
        expect(maskActive({
            ...canonical,
            chunkMode: 'sentence',
            wordFill: undefined,
            legacyMask: true
        })).toBe(false);
    });
});

describe('three-step conservatism', () => {
    it('keeps S/M/L on the old Settings steps and ignores Fit for that path', () => {
        expect(threeStepIntent('s')).toBe(0.82);
        expect(threeStepIntent('m')).toBe(1);
        expect(threeStepIntent('l')).toBe(1.18);
        expect(threeStepIntent('large')).toBe(1.18);
        expect(threeStepIntent('fit')).toBe(1);
        expect(threeStepIntent('huge')).toBe(1);
    });

    it('names the Fit helpers', () => {
        expect(sizeFitHint(true)).toBe(SIZE_HINT_FIT);
        expect(SIZE_HINT_FIT).toBe('Words fill the chamber.');
        expect(sizeFitHint(false)).toBe('Fit waits for the chamber.');
    });

    it('estimateGlyphBox stays a measure helper, not a chamber fit', () => {
        const box = estimateGlyphBox('Word', 100);
        expect(box.width).toBeCloseTo(240, 5);
        expect(box.height).toBeCloseTo(115, 5);
    });
});
