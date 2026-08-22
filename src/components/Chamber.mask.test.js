import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';
import { visualCortex } from '../visuals/visual-cortex.js';
import { ContinuousField } from '../visuals/continuous-field.js';

const STILL = { id: 'still-1', kind: 'image', uri: 'https://example.test/still.jpg', name: 'Still' };
const VIDEO = { id: 'vid-1', kind: 'video', uri: 'https://example.test/clip.mp4', name: 'Clip' };

function makeChamber(sessionExtra = {}, settings = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    globalThis.rise = { settings };
    const session = {
        title: 'Mask',
        atoms: [{ content: 'hello', duration: 500 }],
        totalDuration: 500,
        atomCount: 1,
        visualConfig: { visualMode: 'off' },
        ...sessionExtra
    };
    const chamber = new Chamber(container, { session, player: null, autoStart: false });
    return { chamber, container };
}

function fillHost(container) {
    return container.querySelector('.chamber-fill-field');
}

function installFillMaskEnv({ fontsReady = Promise.resolve() } = {}) {
    const previousFonts = document.fonts;
    const previousSupports = globalThis.CSS?.supports;
    if (!globalThis.CSS) globalThis.CSS = {};
    globalThis.CSS.supports = () => true;
    document.fonts = { ready: fontsReady };

    const proto = globalThis.HTMLElement?.prototype;
    const previousRect = proto?.getBoundingClientRect;
    const previousWidth = Object.getOwnPropertyDescriptor(proto, 'clientWidth');
    const previousHeight = Object.getOwnPropertyDescriptor(proto, 'clientHeight');
    proto.getBoundingClientRect = function getBoundingClientRect() {
        if (this.id === 'chamber-field' || this.classList?.contains('chamber-field')) {
            return { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 };
        }
        if (this.id === 'atom-display' || this.classList?.contains('atom-display')) {
            return { left: 220, top: 260, width: 180, height: 90, right: 400, bottom: 350 };
        }
        return { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 };
    };
    Object.defineProperty(proto, 'clientWidth', { configurable: true, get() { return 800; } });
    Object.defineProperty(proto, 'clientHeight', { configurable: true, get() { return 600; } });

    return () => {
        if (previousFonts === undefined) delete document.fonts;
        else document.fonts = previousFonts;
        if (typeof previousSupports === 'function') globalThis.CSS.supports = previousSupports;
        if (previousRect) proto.getBoundingClientRect = previousRect;
        if (previousWidth) Object.defineProperty(proto, 'clientWidth', previousWidth);
        else delete proto.clientWidth;
        if (previousHeight) Object.defineProperty(proto, 'clientHeight', previousHeight);
        else delete proto.clientHeight;
    };
}

async function flushFillMask() {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
}

function atomDisplay(container) {
    return container.querySelector('#atom-display');
}

describe('Chamber Mask', () => {
    afterEach(() => {
        delete globalThis.rise;
        document.body.replaceChildren();
    });

    it('does not add is-mask when Mask is on and the session is phrase', () => {
        const { chamber, container } = makeChamber(
            { chunkMode: 'phrase' },
            { chamberMask: true }
        );
        const el = atomDisplay(container);
        expect(el.classList.contains('is-mask')).toBe(false);
        chamber.destroy();
    });

    it('does not add is-mask when Mask is on and the session is sentence or paragraph', () => {
        for (const chunkMode of ['sentence', 'paragraph']) {
            const { chamber, container } = makeChamber(
                { chunkMode },
                { chamberMask: true }
            );
            expect(atomDisplay(container).classList.contains('is-mask'), chunkMode).toBe(false);
            chamber.destroy();
        }
    });

    it('does not add is-mask when chunkMode is missing, even if Mask is on', () => {
        const { chamber, container } = makeChamber({}, { chamberMask: true });
        expect(atomDisplay(container).classList.contains('is-mask')).toBe(false);
        chamber.destroy();
    });

    it('adds is-mask and keeps glass-tile off when Mask is on and the session is Word', () => {
        const { chamber, container } = makeChamber(
            {
                chunkMode: 'word',
                visualConfig: {
                    visualMode: 'interlocution',
                    interlocution: { presentation: 'behind-stream' }
                }
            },
            { chamberMask: true }
        );
        const el = atomDisplay(container);
        expect(el.classList.contains('is-mask')).toBe(true);
        expect(el.classList.contains('glass-tile')).toBe(false);
        chamber.destroy();
    });

    it('does not add is-mask when Mask is off, even if the session is Word', () => {
        const { chamber, container } = makeChamber(
            { chunkMode: 'word' },
            { chamberMask: false }
        );
        expect(atomDisplay(container).classList.contains('is-mask')).toBe(false);
        chamber.destroy();
    });

    it('leaves the saved chamberFace on the atom when Mask is on', () => {
        const { chamber, container } = makeChamber(
            { chunkMode: 'word' },
            { chamberMask: true, chamberFace: 'jp' }
        );
        expect(atomDisplay(container).dataset.chamberFace).toBe('jp');
        chamber.destroy();
    });
});

describe('Chamber Mask fill (slice 3)', () => {
    let restoreEnv;

    beforeEach(() => {
        restoreEnv = installFillMaskEnv();
    });

    afterEach(() => {
        restoreEnv?.();
        delete globalThis.rise;
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    it('mounts a second VisualFieldDirector and ContinuousField fill for Mask+Word+stills', async () => {
        const cortexSpy = vi.spyOn(visualCortex, 'setContinuousFieldHost');
        const { chamber, container } = makeChamber(
            { chunkMode: 'word', sequenceVisualAssets: [STILL, VIDEO] },
            { chamberMask: true }
        );
        chamber.displayAtom({ content: 'O', duration: 500 }, 0);
        await flushFillMask();

        const host = fillHost(container);
        expect(host).toBeTruthy();
        expect(chamber._fillFieldDirector).toBeTruthy();
        expect(chamber._visualFieldDirector).toBeTruthy();
        expect(chamber._fillFieldDirector).not.toBe(chamber._visualFieldDirector);
        expect(chamber.fillField).toBeInstanceOf(ContinuousField);
        expect(chamber.fillField.showArtworkLabels).toBe(false);
        expect(host.querySelector('video')).toBeNull();
        expect(host.querySelector('.sequence-video-field')).toBeNull();
        expect(cortexSpy).not.toHaveBeenCalledWith(host);
        chamber.destroy();
    });

    it('clips fill to glyph ink, not a bounding-box rectangle', async () => {
        const { chamber, container } = makeChamber(
            { chunkMode: 'word', sequenceVisualAssets: [STILL] },
            { chamberMask: true }
        );
        chamber.displayAtom({ content: 'O', duration: 500 }, 0);
        await flushFillMask();

        const host = fillHost(container);
        const mask = `${host.style.maskImage} ${host.style.webkitMaskImage}`;
        expect(mask).toMatch(/text/i);
        expect(mask).not.toMatch(/rect/i);
        expect(atomDisplay(container).classList.contains('is-mask-ink')).toBe(true);
        chamber.destroy();
    });

    it('does not mount fill when Mask is on and the session is phrase', async () => {
        const { chamber, container } = makeChamber(
            { chunkMode: 'phrase', sequenceVisualAssets: [STILL] },
            { chamberMask: true }
        );
        await flushFillMask();
        expect(fillHost(container)).toBeNull();
        expect(chamber._fillFieldDirector).toBeFalsy();
        chamber.destroy();
    });

    it('does not mount fill when Mask is off', async () => {
        const { chamber, container } = makeChamber(
            { chunkMode: 'word', sequenceVisualAssets: [STILL] },
            { chamberMask: false }
        );
        await flushFillMask();
        expect(fillHost(container)).toBeNull();
        chamber.destroy();
    });

    it('does not mount fill when the session has no stills', async () => {
        const { chamber, container } = makeChamber(
            { chunkMode: 'word', sequenceVisualAssets: [VIDEO] },
            { chamberMask: true }
        );
        await flushFillMask();
        expect(fillHost(container)).toBeNull();
        expect(atomDisplay(container).classList.contains('is-mask')).toBe(true);
        expect(atomDisplay(container).classList.contains('is-mask-ink')).toBe(false);
        chamber.destroy();
    });

    it('destroys the fill when Mask is turned off', async () => {
        const { chamber, container } = makeChamber(
            { chunkMode: 'word', sequenceVisualAssets: [STILL] },
            { chamberMask: true }
        );
        chamber.displayAtom({ content: 'Word', duration: 500 }, 0);
        await flushFillMask();
        expect(fillHost(container)).toBeTruthy();

        globalThis.rise.settings.chamberMask = false;
        chamber.applyChamberMask();
        await flushFillMask();
        expect(fillHost(container)).toBeNull();
        expect(chamber._fillFieldDirector).toBeFalsy();
        expect(atomDisplay(container).classList.contains('is-mask-ink')).toBe(false);
        chamber.destroy();
    });

    it('destroys the fill when Page Mode suspends temporal visuals', async () => {
        const { chamber, container } = makeChamber(
            { chunkMode: 'word', sequenceVisualAssets: [STILL] },
            { chamberMask: true }
        );
        chamber.displayAtom({ content: 'Word', duration: 500 }, 0);
        await flushFillMask();
        expect(fillHost(container)).toBeTruthy();

        chamber._suspendTemporalVisuals();
        expect(fillHost(container)).toBeNull();
        expect(chamber._fillFieldDirector).toBeFalsy();
        chamber.destroy();
    });

    it('destroys the fill when the session ends', async () => {
        const { chamber, container } = makeChamber(
            { chunkMode: 'word', sequenceVisualAssets: [STILL] },
            { chamberMask: true }
        );
        chamber.displayAtom({ content: 'Word', duration: 500 }, 0);
        await flushFillMask();
        expect(fillHost(container)).toBeTruthy();

        chamber.destroy();
        expect(fillHost(container)).toBeNull();
        expect(chamber._fillFieldDirector).toBeFalsy();
    });

    it('keeps Word opaque and clears ink when the atom is empty or a seam', async () => {
        const { chamber, container } = makeChamber(
            { chunkMode: 'word', sequenceVisualAssets: [STILL] },
            { chamberMask: true }
        );
        chamber.displayAtom({ content: 'O', duration: 500 }, 0);
        await flushFillMask();
        expect(atomDisplay(container).classList.contains('is-mask-ink')).toBe(true);

        chamber.displayAtom({ content: '   ', duration: 200 }, 1);
        await flushFillMask();
        expect(atomDisplay(container).classList.contains('is-mask-ink')).toBe(false);
        expect(fillHost(container)?.classList.contains('is-hidden')).toBe(true);

        chamber.displayAtom({
            content: '',
            duration: 200,
            seam: { depth: 'piece', label: 'II', name: 'Second' }
        }, 2);
        await flushFillMask();
        expect(atomDisplay(container).classList.contains('is-mask-ink')).toBe(false);
        expect(fillHost(container)?.classList.contains('is-hidden')).toBe(true);
        chamber.destroy();
    });

    it('awaits document.fonts.ready before applying the glyph mask', async () => {
        restoreEnv?.();
        let releaseFonts;
        const fontsReady = new Promise((resolve) => { releaseFonts = resolve; });
        restoreEnv = installFillMaskEnv({ fontsReady });

        const { chamber, container } = makeChamber(
            { chunkMode: 'word', sequenceVisualAssets: [STILL] },
            { chamberMask: true }
        );
        chamber.displayAtom({ content: 'O', duration: 500 }, 0);
        await Promise.resolve();
        expect(atomDisplay(container).classList.contains('is-mask-ink')).toBe(false);

        releaseFonts();
        await flushFillMask();
        expect(atomDisplay(container).classList.contains('is-mask-ink')).toBe(true);
        chamber.destroy();
    });

    it('falls back to opaque thick Word when the mask cannot be built', async () => {
        restoreEnv?.();
        restoreEnv = installFillMaskEnv();
        globalThis.CSS.supports = () => false;

        const { chamber, container } = makeChamber(
            { chunkMode: 'word', sequenceVisualAssets: [STILL] },
            { chamberMask: true }
        );
        chamber.displayAtom({ content: 'O', duration: 500 }, 0);
        await flushFillMask();

        const el = atomDisplay(container);
        expect(el.classList.contains('is-mask')).toBe(true);
        expect(el.classList.contains('is-mask-ink')).toBe(false);
        expect(el.style.color).not.toBe('transparent');
        expect(fillHost(container)).toBeNull();
        chamber.destroy();
    });
});
