import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';
import { sizeAtomScale } from '../core/recitation.js';
import { fitWordAtomPx } from '../core/chamber-type-size.js';

function makeChamber(sessionExtra = {}, settings = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const session = {
        title: 'Type size',
        atoms: [{ content: 'Word', duration: 500 }],
        totalDuration: 500,
        atomCount: 1,
        visualConfig: { visualMode: 'off' },
        ...sessionExtra
    };
    const chamber = new Chamber(container, {
        session,
        player: null,
        autoStart: false,
        getSettings: () => settings
    });
    return { chamber, container, settings };
}

function installField(width = 390, height = 720, {
    fieldWidth = width,
    fieldHeight = height,
    viewportWidth = width,
    viewportHeight = height,
    documentWidth = width,
    documentHeight = height
} = {}) {
    const proto = globalThis.HTMLElement?.prototype;
    const previousRect = proto?.getBoundingClientRect;
    const previousWidth = Object.getOwnPropertyDescriptor(proto, 'clientWidth');
    const previousHeight = Object.getOwnPropertyDescriptor(proto, 'clientHeight');
    const previousViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const root = document.documentElement;
    const previousDocumentWidth = Object.getOwnPropertyDescriptor(root, 'clientWidth');
    const previousDocumentHeight = Object.getOwnPropertyDescriptor(root, 'clientHeight');
    Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        value: {
            width: viewportWidth,
            height: viewportHeight,
            addEventListener() {},
            removeEventListener() {}
        }
    });
    Object.defineProperty(root, 'clientWidth', { configurable: true, value: documentWidth });
    Object.defineProperty(root, 'clientHeight', { configurable: true, value: documentHeight });
    proto.getBoundingClientRect = function getBoundingClientRect() {
        if (this.id === 'chamber-display') {
            return { left: 0, top: 0, width, height, right: width, bottom: height };
        }
        if (this.id === 'chamber-field' || this.classList?.contains('chamber-field')) {
            return {
                left: 0, top: 0, width: fieldWidth, height: fieldHeight,
                right: fieldWidth, bottom: fieldHeight
            };
        }
        if (this.id === 'atom-band') {
            return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
        }
        return { left: 0, top: 0, width: 180, height: 90, right: 180, bottom: 90 };
    };
    Object.defineProperty(proto, 'clientWidth', {
        configurable: true,
        get() {
            if (this.id === 'chamber-display') return width;
            if (this.id === 'chamber-field' || this.classList?.contains('chamber-field')) return fieldWidth;
            if (this.id === 'atom-band') return 0;
            return 180;
        }
    });
    Object.defineProperty(proto, 'clientHeight', {
        configurable: true,
        get() {
            if (this.id === 'chamber-display') return height;
            if (this.id === 'chamber-field' || this.classList?.contains('chamber-field')) return fieldHeight;
            if (this.id === 'atom-band') return 0;
            return 90;
        }
    });
    return () => {
        if (previousRect) proto.getBoundingClientRect = previousRect;
        if (previousWidth) Object.defineProperty(proto, 'clientWidth', previousWidth);
        else delete proto.clientWidth;
        if (previousHeight) Object.defineProperty(proto, 'clientHeight', previousHeight);
        else delete proto.clientHeight;
        if (previousViewport) Object.defineProperty(window, 'visualViewport', previousViewport);
        else delete window.visualViewport;
        if (previousDocumentWidth) Object.defineProperty(root, 'clientWidth', previousDocumentWidth);
        else delete root.clientWidth;
        if (previousDocumentHeight) Object.defineProperty(root, 'clientHeight', previousDocumentHeight);
        else delete root.clientHeight;
    };
}

describe('Chamber type size (FM-RISE-36)', () => {
    let restoreField;

    beforeEach(() => {
        restoreField = installField();
    });

    afterEach(() => {
        restoreField?.();
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    it('applies the persisted fontSize on construct and again when the session starts', () => {
        const { chamber, container, settings } = makeChamber(
            { chunkMode: 'word' },
            { fontSize: 'small' }
        );
        const el = container.querySelector('#atom-display');
        expect(el.dataset.fontSize).toBe('small');

        settings.fontSize = 'fit';
        chamber.beginSession();
        expect(container.querySelector('#atom-display').dataset.fontSize).toBe('fit');
        chamber.destroy();
    });

    it('does not stretch L to fill the chamber', () => {
        const { chamber, container } = makeChamber(
            { chunkMode: 'word' },
            { fontSize: 'large' }
        );
        chamber.displayAtom({ content: 'Word', duration: 500 }, 0);
        const el = container.querySelector('#atom-display');
        expect(el.dataset.fontSize).toBe('large');
        expect(el.classList.contains('is-word-fit')).toBe(false);
        expect(el.style.getPropertyValue('--atom-fit-px')).toBe('');
        expect(Number(el.style.getPropertyValue('--font-size-intent'))).toBeCloseTo(1.18, 5);
        expect(Number(el.style.getPropertyValue('--atom-scale'))).toBe(1);
        chamber.destroy();
    });

    it('fits a short Word only when Fit is selected', () => {
        const { chamber, container } = makeChamber(
            { chunkMode: 'word' },
            { fontSize: 'fit' }
        );
        vi.spyOn(chamber, '_measureWordGlyph').mockReturnValue({
            width: 240,
            height: 115,
            at: 100
        });
        chamber.displayAtom({ content: 'Word', duration: 500 }, 0);
        const el = container.querySelector('#atom-display');
        const px = parseFloat(el.style.getPropertyValue('--atom-fit-px'));
        expect(el.classList.contains('is-word-fit')).toBe(true);
        expect(px).toBeGreaterThan(72 * 1.5);
        expect(px).toBe(fitWordAtomPx({
            fieldWidth: 390,
            fieldHeight: 720,
            padX: 0,
            padY: 0,
            measuredWidth: 240,
            measuredHeight: 115,
            measuredAt: 100
        }));
        chamber.destroy();
    });

    it('fits against the bounded stage and ignores content-driven field growth', () => {
        restoreField?.();
        restoreField = installField(960, 640, {
            fieldWidth: 9000,
            fieldHeight: 7000,
            viewportWidth: 900,
            viewportHeight: 600,
            documentWidth: 920,
            documentHeight: 610
        });
        const { chamber, container } = makeChamber(
            { chunkMode: 'word' },
            { fontSize: 'fit' }
        );

        const before = chamber._wordFitBox();
        const atom = container.querySelector('#atom-display');
        atom.getBoundingClientRect = () => ({
            left: -4000, top: -3000, width: 9000, height: 7000,
            right: 5000, bottom: 4000
        });
        const after = chamber._wordFitBox();

        expect(before).toEqual({ width: 900, height: 600, source: 'chamber-stage' });
        expect(after).toEqual(before);
        chamber.destroy();
    });

    it('does not give phrase the Word-fill-the-chamber treatment even if Fit is selected', () => {
        const content = 'Prepared next phrase.';
        const { chamber, container } = makeChamber(
            { chunkMode: 'phrase', atoms: [{ content, duration: 1200 }] },
            { fontSize: 'fit' }
        );
        chamber.displayAtom({ content, duration: 1200 }, 0);
        const el = container.querySelector('#atom-display');
        expect(el.classList.contains('is-word-fit')).toBe(false);
        expect(el.style.getPropertyValue('--atom-fit-px')).toBe('');
        expect(Number(el.style.getPropertyValue('--atom-scale'))).toBeCloseTo(sizeAtomScale(content), 5);
        expect(Number(el.style.getPropertyValue('--font-size-intent'))).toBe(1);
        expect(el.style.fontSize).toBe('');
        chamber.destroy();
    });

    it('rebuilds the glyph mask after a fit size change is reconciled', async () => {
        const { chamber, container, settings } = makeChamber(
            {
                chunkMode: 'word',
                visualConfig: {
                    visualMode: 'interlocution',
                    interlocution: { presentation: 'continuous', wordFill: { mode: 'same' } }
                }
            },
            { fontSize: 'medium', chamberMask: true, chamberFace: 'thick' }
        );
        const el = container.querySelector('#atom-display');
        chamber.displayAtom({ content: 'Word', duration: 500 }, 0);
        expect(el.classList.contains('is-mask')).toBe(false);
        expect(el.dataset.chamberFace).toBe('thick');

        const sync = vi.spyOn(chamber, 'syncFillGlyphMask');
        settings.fontSize = 'fit';
        chamber.applyChamberTypeSize();
        chamber.applyChamberMask();

        expect(el.dataset.fontSize).toBe('fit');
        expect(el.classList.contains('is-mask')).toBe(true);
        expect(el.dataset.chamberFace).toBe('thick');
        expect(sync).toHaveBeenCalled();
        chamber.destroy();
    });

    it('loads only Thick 700 for the current mask text', async () => {
        const previousFonts = document.fonts;
        const load = vi.fn().mockResolvedValue([{}]);
        document.fonts = { load };
        const { chamber } = makeChamber();

        await expect(chamber._waitThickFontReady('Word')).resolves.toBe(true);
        expect(load).toHaveBeenCalledOnce();
        expect(load).toHaveBeenCalledWith('700 1em "Space Grotesk"', 'Word');

        chamber.destroy();
        if (previousFonts === undefined) delete document.fonts;
        else document.fonts = previousFonts;
    });
});
