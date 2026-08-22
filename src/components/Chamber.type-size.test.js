import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';
import { sizeAtomScale } from '../core/recitation.js';
import { TODAY_WORD_LARGE_PX, fitWordAtomPx } from '../core/chamber-type-size.js';

function makeChamber(sessionExtra = {}, settings = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    globalThis.rise = { settings };
    const session = {
        title: 'Type size',
        atoms: [{ content: 'Word', duration: 500 }],
        totalDuration: 500,
        atomCount: 1,
        visualConfig: { visualMode: 'off' },
        ...sessionExtra
    };
    const chamber = new Chamber(container, { session, player: null, autoStart: false });
    return { chamber, container };
}

function installField(width = 390, height = 720) {
    const proto = globalThis.HTMLElement?.prototype;
    const previousRect = proto?.getBoundingClientRect;
    const previousWidth = Object.getOwnPropertyDescriptor(proto, 'clientWidth');
    const previousHeight = Object.getOwnPropertyDescriptor(proto, 'clientHeight');
    proto.getBoundingClientRect = function getBoundingClientRect() {
        if (this.id === 'chamber-field' || this.classList?.contains('chamber-field')) {
            return { left: 0, top: 0, width, height, right: width, bottom: height };
        }
        if (this.id === 'atom-band') {
            return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
        }
        return { left: 0, top: 0, width: 180, height: 90, right: 180, bottom: 90 };
    };
    Object.defineProperty(proto, 'clientWidth', {
        configurable: true,
        get() {
            if (this.id === 'chamber-field' || this.classList?.contains('chamber-field')) return width;
            if (this.id === 'atom-band') return 0;
            return 180;
        }
    });
    Object.defineProperty(proto, 'clientHeight', {
        configurable: true,
        get() {
            if (this.id === 'chamber-field' || this.classList?.contains('chamber-field')) return height;
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
    };
}

describe('Chamber type size (FM-RISE-36)', () => {
    let restoreField;

    beforeEach(() => {
        restoreField = installField();
    });

    afterEach(() => {
        restoreField?.();
        delete globalThis.rise;
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    it('applies the persisted fontSize on construct and again when the session starts', () => {
        globalThis.rise = { settings: { fontSize: 'small' } };
        const { chamber, container } = makeChamber({ chunkMode: 'word' }, { fontSize: 'small' });
        const el = container.querySelector('#atom-display');
        expect(el.dataset.fontSize).toBe('small');

        globalThis.rise.settings.fontSize = 'fit';
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
        expect(px).toBeGreaterThan(TODAY_WORD_LARGE_PX * 1.5);
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

    it('rebuilds the glyph mask after a size change and keeps Mask thick-face override', async () => {
        const { chamber, container } = makeChamber(
            { chunkMode: 'word' },
            { fontSize: 'medium', chamberMask: true, chamberFace: 'jp' }
        );
        const el = container.querySelector('#atom-display');
        chamber.displayAtom({ content: 'Word', duration: 500 }, 0);
        expect(el.classList.contains('is-mask')).toBe(true);
        expect(el.dataset.chamberFace).toBe('jp');

        const sync = vi.spyOn(chamber, 'syncFillGlyphMask');
        globalThis.rise.settings.fontSize = 'fit';
        chamber.applyChamberTypeSize();

        expect(el.dataset.fontSize).toBe('fit');
        expect(el.classList.contains('is-mask')).toBe(true);
        expect(el.dataset.chamberFace).toBe('jp');
        expect(sync).toHaveBeenCalled();
        chamber.destroy();
    });
});
