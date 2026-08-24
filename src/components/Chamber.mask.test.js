import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';
import { visualCortex } from '../visuals/visual-cortex.js';
import { ContinuousField } from '../visuals/continuous-field.js';
import {
    beginNonFlashingVisualSession,
    endVisualInterlocutionSession
} from '../core/visual-safety.js';
import { compileSession } from '../core/session-compiler.js';

const STILL = { id: 'still-1', kind: 'image', uri: 'https://example.test/still.jpg', name: 'Still' };
const MP4 = {
    id: 'mp4-1',
    kind: 'video',
    mimeType: 'video/mp4',
    uri: 'blob:http://localhost/clip',
    name: 'Clip',
    width: 1280,
    height: 720,
    fps: 24
};

function makeChamber(sessionExtra = {}, settings = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    globalThis.rise = { settings: { chamberFace: 'thick', fontSize: 'fit', ...settings } };
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

function galleryHost(container) {
    return container.querySelector('#chamber-continuous-field');
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

function wordGallerySession(presentation = 'continuous-word') {
    return {
        chunkMode: 'word',
        visualConfig: {
            visualMode: 'interlocution',
            interlocution: { presentation, wordFill: { mode: 'same' } }
        }
    };
}

function armGalleryField(presentation = 'continuous-word') {
    beginNonFlashingVisualSession();
    visualCortex.updateConfig({
        enabled: true,
        presentation,
        activeTypes: []
    });
}

function releaseGalleryField() {
    visualCortex.setContinuousFieldProjectionHost?.(null);
    visualCortex.setContinuousFieldHost(null);
    visualCortex.updateConfig({ enabled: false, presentation: 'full-frame' });
    endVisualInterlocutionSession();
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
                    interlocution: { presentation: 'continuous', wordFill: { mode: 'same' } }
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

    it('does not mask an inferred material from a compiled Gallery session', () => {
        const session = compileSession({
            text: 'A word.',
            chunkMode: 'word',
            visualConfig: {
                visualMode: 'interlocution',
                interlocution: {
                    presentation: 'continuous',
                    sourced: ['sci-astronomy'],
                    procedural: ['fractal']
                }
            }
        });
        expect(session.visualConfig.interlocution.wordFillDeclared).toBe(false);

        const { chamber, container } = makeChamber(
            session,
            { chamberFace: 'thick', fontSize: 'fit', chamberMask: false }
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

    it('adds is-mask from PREP Gallery-in-the-word without requiring Settings Mask', () => {
        const { chamber, container } = makeChamber(
            wordGallerySession(),
            { chamberMask: false }
        );
        expect(atomDisplay(container).classList.contains('is-mask')).toBe(true);
        expect(atomDisplay(container).dataset.chamberFace).toBe('thick');
        chamber.destroy();
    });

    it('adds is-mask for canonical Fit Gallery without the legacy Mask setting', () => {
        const { chamber, container } = makeChamber(
            wordGallerySession('continuous'),
            { chamberMask: false, fontSize: 'fit' }
        );
        expect(atomDisplay(container).classList.contains('is-mask')).toBe(true);
        chamber.destroy();
    });

    it('does not let Fit mask a phrase', () => {
        const { chamber, container } = makeChamber(
            {
                chunkMode: 'phrase',
                visualConfig: {
                    visualMode: 'interlocution',
                    interlocution: { presentation: 'continuous' }
                }
            },
            { chamberMask: false, fontSize: 'fit' }
        );
        expect(atomDisplay(container).classList.contains('is-mask')).toBe(false);
        chamber.destroy();
    });

    it('keeps continuous Gallery mounted without a mask at Medium', () => {
        const { chamber, container } = makeChamber(
            wordGallerySession('continuous'),
            { chamberMask: false, fontSize: 'medium' }
        );
        expect(galleryHost(container)).toBeTruthy();
        expect(atomDisplay(container).classList.contains('is-mask')).toBe(false);
        chamber.destroy();
    });
});

describe('Chamber Gallery-in-the-word projection (FM-RISE-28)', () => {
    let restoreEnv;

    beforeEach(() => {
        restoreEnv = installFillMaskEnv();
        armGalleryField();
    });

    afterEach(() => {
        restoreEnv?.();
        releaseGalleryField();
        delete globalThis.rise;
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    it('uses one ContinuousField instance on two mounts with the same url after a dissolve', async () => {
        const { chamber, container } = makeChamber(
            wordGallerySession(),
            { chamberMask: true }
        );
        armGalleryField();
        chamber.displayAtom({ content: 'O', duration: 500 }, 0);
        await flushFillMask();

        const gallery = galleryHost(container);
        const fill = fillHost(container);
        const field = visualCortex._continuousField;
        expect(gallery).toBeTruthy();
        expect(fill).toBeTruthy();
        expect(fill).not.toBe(gallery);
        expect(field).toBeInstanceOf(ContinuousField);
        expect(field.host).toBe(gallery);
        expect(field.projectionHost).toBe(fill);
        expect(chamber.fillField).toBeFalsy();
        expect(chamber._fillFieldDirector).toBeFalsy();
        expect(chamber.fillVideoField).toBeFalsy();

        field._ensureLayers();
        field.setProjectionHost(fill);
        field._crossfadeTo({ url: 'https://example.test/a.jpg' }, true);
        field._currentUrl = 'https://example.test/a.jpg';
        field._crossfadeTo({ url: 'https://example.test/b.jpg' }, false);
        field._currentUrl = 'https://example.test/b.jpg';

        const gallerySrcs = [...gallery.querySelectorAll('.continuous-field-artwork')]
            .map(img => img.getAttribute('src'))
            .filter(Boolean)
            .sort();
        const fillSrcs = [...fill.querySelectorAll('.continuous-field-artwork')]
            .map(img => img.getAttribute('src'))
            .filter(Boolean)
            .sort();
        expect(fillSrcs).toEqual(gallerySrcs);
        expect(fillSrcs.some(src => src.includes('b.jpg'))).toBe(true);
        expect(field.currentUrl).toBe('https://example.test/b.jpg');
        expect(fill.style.maskImage + fill.style.webkitMaskImage).toMatch(/text/i);
        expect(atomDisplay(container).classList.contains('is-mask-ink')).toBe(true);
        expect(container.querySelectorAll('video')).toHaveLength(0);
        chamber.destroy();
    });

    it('a distinct wordFill pick yields a different projection url on the same clock', async () => {
        vi.spyOn(ContinuousField.prototype, '_defaultDecode').mockResolvedValue(true);
        beginNonFlashingVisualSession();
        visualCortex._scheduleBackgroundWarm = () => {};
        visualCortex._scheduleRollingRefresh = () => {};
        const { chamber, container } = makeChamber(
            {
                chunkMode: 'word',
                visualConfig: {
                    visualMode: 'interlocution',
                    interlocution: {
                        presentation: 'continuous',
                        wordFill: { mode: 'pick', sourced: ['aic-ukiyoe'], procedural: [] }
                    }
                }
            },
            { chamberMask: true }
        );
        visualCortex._poolFor('aic-landscapes').images = [
            { url: 'https://example.test/room-a.jpg', name: 'room-a' },
            { url: 'https://example.test/room-b.jpg', name: 'room-b' }
        ];
        visualCortex._poolFor('aic-ukiyoe').images = [
            { url: 'https://example.test/fill-x.jpg', name: 'fill-x' },
            { url: 'https://example.test/fill-y.jpg', name: 'fill-y' }
        ];
        visualCortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['aic-landscapes'],
            wordFill: { mode: 'pick', sourced: ['aic-ukiyoe'], procedural: [] }
        });
        chamber.displayAtom({ content: 'O', duration: 500 }, 0);
        await flushFillMask();

        const field = visualCortex._continuousField;
        expect(field).toBeInstanceOf(ContinuousField);
        expect(fillHost(container)).toBeTruthy();
        expect(galleryHost(container)).toBeTruthy();
        await field._advance(false);
        expect(field.currentUrl).toMatch(/room-/);
        expect(field.currentProjectionUrl).toMatch(/fill-/);
        expect(field.currentProjectionUrl).not.toBe(field.currentUrl);
        expect(chamber._fillFieldDirector).toBeFalsy();
        expect(container.querySelectorAll('video')).toHaveLength(0);
        chamber.destroy();
    });

    it('room collection + word-fill fractal paints engine stills in the glyph and forces glass off', async () => {
        vi.spyOn(ContinuousField.prototype, '_defaultDecode').mockResolvedValue(true);
        beginNonFlashingVisualSession();
        visualCortex._scheduleBackgroundWarm = () => {};
        visualCortex._scheduleRollingRefresh = () => {};
        vi.spyOn(visualCortex, '_renderContinuousProceduralWork')
            .mockResolvedValue({
                url: 'data:image/webp;base64,flame-fill',
                title: 'Fractal Flame',
                sourceType: 'fractal'
            });
        const { chamber, container } = makeChamber(
            {
                chunkMode: 'word',
                visualConfig: {
                    visualMode: 'interlocution',
                    interlocution: {
                        presentation: 'continuous',
                        streamGlass: true,
                        wordFill: { mode: 'pick', sourced: [], procedural: ['fractal'] }
                    }
                }
            },
            { chamberMask: true }
        );
        visualCortex._poolFor('aic-landscapes').images = [
            { url: 'https://example.test/room-a.jpg', name: 'room-a' },
            { url: 'https://example.test/room-b.jpg', name: 'room-b' }
        ];
        visualCortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['aic-landscapes'],
            wordFill: { mode: 'pick', sourced: [], procedural: ['fractal'] }
        });
        chamber.displayAtom({ content: 'O', duration: 500 }, 0);
        await flushFillMask();

        const field = visualCortex._continuousField;
        expect(field).toBeInstanceOf(ContinuousField);
        expect(visualCortex.config.activeTypes).toEqual(['aic-landscapes']);
        expect(atomDisplay(container).classList.contains('is-mask')).toBe(true);
        expect(atomDisplay(container).classList.contains('glass-tile')).toBe(false);
        await field._advance(false);
        expect(field.currentUrl).toMatch(/room-/);
        expect(field.currentProjectionUrl).toBe('data:image/webp;base64,flame-fill');
        expect(field.currentProjectionUrl).not.toBe(field.currentUrl);
        expect(chamber._fillFieldDirector).toBeFalsy();
        expect(container.querySelectorAll('video')).toHaveLength(0);
        chamber.destroy();
    });

    it('room fractal + word-fill collection keeps engine stills on Layer A', async () => {
        vi.spyOn(ContinuousField.prototype, '_defaultDecode').mockResolvedValue(true);
        beginNonFlashingVisualSession();
        visualCortex._scheduleBackgroundWarm = () => {};
        visualCortex._scheduleRollingRefresh = () => {};
        vi.spyOn(visualCortex, '_renderContinuousProceduralWork')
            .mockResolvedValue({
                url: 'data:image/webp;base64,flame-room',
                title: 'Fractal Flame',
                sourceType: 'fractal'
            });
        const { chamber, container } = makeChamber(
            {
                chunkMode: 'word',
                visualConfig: {
                    visualMode: 'interlocution',
                    interlocution: {
                        presentation: 'continuous',
                        wordFill: { mode: 'pick', sourced: ['aic-ukiyoe'], procedural: [] }
                    }
                }
            },
            { chamberMask: true }
        );
        visualCortex._poolFor('aic-ukiyoe').images = [
            { url: 'https://example.test/fill-x.jpg', name: 'fill-x' },
            { url: 'https://example.test/fill-y.jpg', name: 'fill-y' }
        ];
        visualCortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['fractal'],
            wordFill: { mode: 'pick', sourced: ['aic-ukiyoe'], procedural: [] }
        });
        chamber.displayAtom({ content: 'O', duration: 500 }, 0);
        await flushFillMask();

        const field = visualCortex._continuousField;
        expect(visualCortex.config.activeTypes).toEqual(['fractal']);
        expect(atomDisplay(container).classList.contains('glass-tile')).toBe(false);
        await field._advance(false);
        expect(field.currentUrl).toBe('data:image/webp;base64,flame-room');
        expect(field.currentProjectionUrl).toMatch(/fill-/);
        expect(field.currentProjectionUrl).not.toBe(field.currentUrl);
        expect(chamber._fillFieldDirector).toBeFalsy();
        expect(container.querySelectorAll('video')).toHaveLength(0);
        chamber.destroy();
    });

    it('does not mount a stencil host in phrase mode', async () => {
        const { chamber, container } = makeChamber(
            {
                chunkMode: 'phrase',
                visualConfig: {
                    visualMode: 'interlocution',
                    interlocution: { presentation: 'continuous-word' }
                }
            },
            { chamberMask: true }
        );
        chamber.displayAtom({ content: 'a phrase', duration: 500 }, 0);
        await flushFillMask();
        expect(fillHost(container)).toBeNull();
        expect(galleryHost(container)).toBeTruthy();
        expect(chamber._fillFieldDirector).toBeFalsy();
        chamber.destroy();
    });

    it('Page tears the projection host and does not clone the gallery', async () => {
        const { chamber, container } = makeChamber(
            wordGallerySession(),
            { chamberMask: true }
        );
        armGalleryField();
        chamber.displayAtom({ content: 'Word', duration: 500 }, 0);
        await flushFillMask();
        expect(fillHost(container)).toBeTruthy();
        const gallery = galleryHost(container);

        chamber._suspendTemporalVisuals();
        expect(fillHost(container)).toBeNull();
        expect(visualCortex._continuousField).toBeFalsy();
        expect(visualCortex.hasContinuousFieldHost()).toBe(false);
        expect(container.querySelector('#page-reader .chamber-continuous-field')).toBeNull();
        expect(gallery?.isConnected).toBe(true);
        chamber.destroy();
    });

    it('default path never mounts a second video in the fill host', async () => {
        const { chamber, container } = makeChamber(
            { ...wordGallerySession(), sequenceVisualAssets: [STILL, MP4] },
            { chamberMask: true }
        );
        armGalleryField();
        chamber.displayAtom({ content: 'O', duration: 500 }, 0);
        await flushFillMask();

        expect(fillHost(container)?.querySelector('video')).toBeNull();
        expect(fillHost(container)?.querySelector('.sequence-video-field')).toBeNull();
        expect(chamber.fillVideoField).toBeFalsy();
        expect(container.querySelectorAll('video')).toHaveLength(0);
        chamber.destroy();
    });

    it('clips the projection host to glyph ink after fonts.ready', async () => {
        restoreEnv?.();
        let releaseFonts;
        const fontsReady = new Promise((resolve) => { releaseFonts = resolve; });
        restoreEnv = installFillMaskEnv({ fontsReady });

        const { chamber, container } = makeChamber(
            wordGallerySession(),
            { chamberMask: true }
        );
        armGalleryField();
        chamber.displayAtom({ content: 'O', duration: 500 }, 0);
        await Promise.resolve();
        const pending = atomDisplay(container);
        // Cold first load: do not leave the atom as opaque --color-light
        // (#E8E8EC) while document.fonts.ready is still pending.
        expect(pending.classList.contains('is-mask-ink')).toBe(true);
        expect(pending.style.color).toBe('transparent');

        releaseFonts();
        await flushFillMask();
        const host = fillHost(container);
        expect(atomDisplay(container).classList.contains('is-mask-ink')).toBe(true);
        expect(`${host.style.maskImage} ${host.style.webkitMaskImage}`).toMatch(/text/i);
        expect(`${host.style.maskImage} ${host.style.webkitMaskImage}`).not.toMatch(/rect/i);
        expect(galleryHost(container).style.maskImage).toBeFalsy();
        chamber.destroy();
    });

    it('does not leave the glyph as --color-light while fonts.ready is pending', async () => {
        restoreEnv?.();
        let releaseFonts;
        const fontsReady = new Promise((resolve) => { releaseFonts = resolve; });
        restoreEnv = installFillMaskEnv({ fontsReady });

        const { chamber, container } = makeChamber(
            wordGallerySession(),
            { chamberMask: true }
        );
        armGalleryField();
        chamber.displayAtom({ content: 'O', duration: 500 }, 0);

        const el = atomDisplay(container);
        expect(el.classList.contains('is-mask')).toBe(true);
        expect(el.classList.contains('is-mask-ink')).toBe(true);
        expect(el.style.color).toBe('transparent');
        expect(fillHost(container)?.classList.contains('is-hidden')).toBe(true);

        releaseFonts();
        await flushFillMask();
        expect(el.classList.contains('is-mask-ink')).toBe(true);
        expect(fillHost(container)?.classList.contains('is-hidden')).toBe(false);
        chamber.destroy();
    });

    it('falls back to opaque Word when the mask cannot be built', async () => {
        restoreEnv?.();
        restoreEnv = installFillMaskEnv();
        globalThis.CSS.supports = () => false;

        const { chamber, container } = makeChamber(
            wordGallerySession(),
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

    it('destroys the projection when Mask is turned off', async () => {
        const session = wordGallerySession('continuous');
        delete session.visualConfig.interlocution.wordFill;
        const { chamber, container } = makeChamber(
            session,
            { chamberMask: true }
        );
        armGalleryField('continuous');
        chamber.displayAtom({ content: 'Word', duration: 500 }, 0);
        await flushFillMask();
        expect(fillHost(container)).toBeTruthy();

        globalThis.rise.settings.chamberMask = false;
        chamber.session.visualConfig.interlocution.presentation = 'continuous';
        chamber.applyChamberMask();
        await flushFillMask();
        expect(fillHost(container)).toBeNull();
        expect(visualCortex._continuousField?.projectionHost).toBeFalsy();
        expect(atomDisplay(container).classList.contains('is-mask-ink')).toBe(false);
        chamber.destroy();
    });
});

describe('Chamber mask ground plate (FM-RISE-47)', () => {
    let restoreEnv;

    beforeEach(() => {
        restoreEnv = installFillMaskEnv();
        armGalleryField();
    });

    afterEach(() => {
        restoreEnv?.();
        releaseGalleryField();
        delete globalThis.rise;
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    function plate(container) {
        return container.querySelector('.chamber-mask-ground-plate');
    }

    function assertFillUnderstudy(container, ground) {
        const layerA = galleryHost(container);
        const wrapper = fillHost(container);
        const understudy = plate(container);
        expect(layerA).toBeTruthy();
        expect(wrapper).toBeTruthy();
        expect(understudy).toBeTruthy();
        expect(understudy.dataset.ground).toBe(ground);
        expect(wrapper.contains(understudy)).toBe(true);
        expect(wrapper.firstElementChild).toBe(understudy);
        expect(layerA.contains(understudy)).toBe(false);
        expect(understudy.nextElementSibling).not.toBe(layerA);
        expect(layerA.previousElementSibling).not.toBe(understudy);
        expect(layerA.style.maskImage).toBeFalsy();
        expect(wrapper.style.background).toBeFalsy();
        expect(wrapper.style.backgroundColor).toBeFalsy();
        expect(`${wrapper.style.maskImage} ${wrapper.style.webkitMaskImage}`).toMatch(/text/i);
        return { layerA, wrapper, understudy };
    }

    it('Astronomy room + Attractor fill puts Dark plate inside the masked wrapper, behind the engine', async () => {
        const { chamber, container } = makeChamber(
            {
                chunkMode: 'word',
                visualConfig: {
                    visualMode: 'interlocution',
                    interlocution: {
                        presentation: 'continuous',
                        sourced: ['sci-astronomy'],
                        wordFill: { mode: 'pick', sourced: [], procedural: ['attractor'] }
                    }
                }
            },
            { chamberMask: true }
        );
        visualCortex._poolFor('sci-astronomy').images = [
            { url: 'https://example.test/astro-a.jpg', name: 'astro-a' },
            { url: 'https://example.test/astro-b.jpg', name: 'astro-b' }
        ];
        visualCortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['sci-astronomy'],
            wordFill: { mode: 'pick', sourced: [], procedural: ['attractor'] }
        });
        chamber.displayAtom({ content: 'O', duration: 500 }, 0);
        await flushFillMask();
        if (visualCortex._continuousField) {
            visualCortex._continuousField._currentUrl = 'https://example.test/astro-a.jpg';
        }
        chamber.syncMaskGroundPlate();

        const { wrapper, understudy } = assertFillUnderstudy(container, 'dark');
        const engine = [...wrapper.children].find(node => node !== understudy);
        expect(engine).toBeTruthy();
        expect(understudy.compareDocumentPosition(engine) & Node.DOCUMENT_POSITION_FOLLOWING)
            .toBeTruthy();
        chamber.destroy();
    });

    it('undefined wordFill on Astronomy × Fractal still yields Light cream (cold start)', async () => {
        const { chamber, container } = makeChamber(
            {
                chunkMode: 'word',
                visualConfig: {
                    visualMode: 'interlocution',
                    interlocution: {
                        presentation: 'continuous',
                        sourced: ['sci-astronomy'],
                        procedural: ['fractal']
                    }
                }
            },
            { chamberMask: true }
        );
        visualCortex._poolFor('sci-astronomy').images = [
            { url: 'https://example.test/astro-a.jpg', name: 'astro-a' }
        ];
        // Cortex leftover is `same` (or a prior Attractor pick). The
        // session pair is Astronomy × Fractal and must reach combine()
        // as a Fractal pick even when wordFill was never declared.
        visualCortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['sci-astronomy'],
            wordFill: { mode: 'same' }
        });
        chamber.displayAtom({ content: 'O', duration: 500 }, 0);
        await flushFillMask();
        chamber.syncMaskGroundPlate();

        const { wrapper, understudy } = assertFillUnderstudy(container, 'light');
        expect(understudy.dataset.ground).toBe('light');
        expect(wrapper.contains(understudy)).toBe(true);
        expect(galleryHost(container).contains(understudy)).toBe(false);
        expect(chamber.session.visualConfig.interlocution.wordFill).toBeUndefined();
        chamber.destroy();
    });

    it('Astronomy room + Fractal fill puts Light cream plate inside the glyph wrapper', async () => {
        const { chamber, container } = makeChamber(
            {
                chunkMode: 'word',
                visualConfig: {
                    visualMode: 'interlocution',
                    interlocution: {
                        presentation: 'continuous',
                        sourced: ['sci-astronomy'],
                        wordFill: { mode: 'pick', sourced: [], procedural: ['fractal'] }
                    }
                }
            },
            { chamberMask: true }
        );
        visualCortex._poolFor('sci-astronomy').images = [
            { url: 'https://example.test/astro-a.jpg', name: 'astro-a' }
        ];
        // Stale cortex fill (Astronomy+Attractor is Dark). The declared
        // session pair is Astronomy+Fractal and must reach combine().
        visualCortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['sci-astronomy'],
            wordFill: { mode: 'pick', sourced: [], procedural: ['attractor'] }
        });
        chamber.displayAtom({ content: 'O', duration: 500 }, 0);
        await flushFillMask();
        chamber.syncMaskGroundPlate();

        const { wrapper, understudy } = assertFillUnderstudy(container, 'light');
        expect(understudy.dataset.ground).toBe('light');
        expect(wrapper.contains(understudy)).toBe(true);
        expect(galleryHost(container).contains(understudy)).toBe(false);
        chamber.destroy();
    });

    it('Old Masters room + Fractal fill puts Light cream plate inside the glyph wrapper', async () => {
        const { chamber, container } = makeChamber(
            {
                chunkMode: 'word',
                visualConfig: {
                    visualMode: 'interlocution',
                    interlocution: {
                        presentation: 'continuous',
                        sourced: ['aic-oldmasters'],
                        wordFill: { mode: 'pick', sourced: [], procedural: ['fractal'] }
                    }
                }
            },
            { chamberMask: true }
        );
        visualCortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['aic-oldmasters'],
            wordFill: { mode: 'pick', sourced: [], procedural: ['fractal'] }
        });
        chamber.displayAtom({ content: 'O', duration: 500 }, 0);
        await flushFillMask();
        if (visualCortex._continuousField) {
            visualCortex._continuousField._currentUrl = 'https://example.test/masters.jpg';
        }
        chamber.syncMaskGroundPlate();

        assertFillUnderstudy(container, 'light');
        chamber.destroy();
    });

    it('two collection stills with an opaque Layer A mount no plate', async () => {
        const { chamber, container } = makeChamber(
            {
                chunkMode: 'word',
                visualConfig: {
                    visualMode: 'interlocution',
                    interlocution: {
                        presentation: 'continuous',
                        sourced: ['aic-landscapes'],
                        wordFill: { mode: 'pick', sourced: ['aic-ukiyoe'], procedural: [] }
                    }
                }
            },
            { chamberMask: true }
        );
        visualCortex._poolFor('aic-landscapes').images = [
            { url: 'https://example.test/room-a.jpg', name: 'room-a' }
        ];
        visualCortex._poolFor('aic-ukiyoe').images = [
            { url: 'https://example.test/fill-x.jpg', name: 'fill-x' }
        ];
        visualCortex.updateConfig({
            enabled: true,
            presentation: 'continuous',
            activeTypes: ['aic-landscapes'],
            wordFill: { mode: 'pick', sourced: ['aic-ukiyoe'], procedural: [] }
        });
        chamber.displayAtom({ content: 'O', duration: 500 }, 0);
        await flushFillMask();
        if (visualCortex._continuousField) {
            visualCortex._continuousField._currentUrl = 'https://example.test/room-a.jpg';
        }
        chamber.syncMaskGroundPlate();

        expect(plate(container)).toBeNull();
        expect(fillHost(container)?.style.background).toBeFalsy();
        expect(galleryHost(container)?.style.maskImage).toBeFalsy();
        chamber.destroy();
    });
});

describe('Chamber semantic Fit compositor', () => {
    let restoreEnv;

    beforeEach(() => {
        restoreEnv = installFillMaskEnv();
        armGalleryField('continuous');
    });

    afterEach(() => {
        restoreEnv?.();
        releaseGalleryField();
        delete globalThis.rise;
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    function semanticSession(wordFill) {
        const atoms = Array(8).fill(null).map(() => ({
            content: 'love joy light beautiful',
            duration: 500
        }));
        return {
            chunkMode: 'word',
            atoms,
            totalDuration: 4000,
            atomCount: atoms.length,
            visualConfig: {
                visualMode: 'interlocution',
                livingText: { enabled: true, intensity: 0.8 },
                interlocution: {
                    presentation: 'continuous',
                    procedural: ['turrell'],
                    sourced: [],
                    wordFill
                }
            }
        };
    }

    it('publishes semantic state for a procedural Fit and clears it with the fill field', async () => {
        const { chamber, container } = makeChamber(
            semanticSession({ mode: 'pick', sourced: [], procedural: ['fractal'] }),
            { fontSize: 'fit' }
        );

        chamber.displayAtom(chamber.session.atoms[4], 4);
        await flushFillMask();

        const field = container.querySelector('#chamber-field');
        expect(field.classList.contains('is-living-fit')).toBe(true);
        expect(field.style.getPropertyValue('--living-fit-color')).toMatch(/^rgb\(/);
        expect(Number(field.style.getPropertyValue('--living-fit-mix'))).toBeGreaterThan(0);
        expect(Number(field.style.getPropertyValue('--living-fit-mix'))).toBeLessThanOrEqual(0.45);
        expect(Number(field.style.getPropertyValue('--living-fit-saturation'))).toBeGreaterThanOrEqual(1);
        expect(Number(field.style.getPropertyValue('--living-fit-brightness'))).toBeGreaterThan(0);

        chamber.destroyFillField();
        expect(field.classList.contains('is-living-fit')).toBe(false);
        expect(field.style.getPropertyValue('--living-fit-color')).toBe('');
        chamber.destroy();
    });

    it('does not tint collection artwork selected as the Fit source', async () => {
        const session = semanticSession({
            mode: 'pick',
            sourced: ['aic-ukiyoe'],
            procedural: []
        });
        session.visualConfig.interlocution.sourced = ['aic-oldmasters'];
        session.visualConfig.interlocution.procedural = [];
        const { chamber, container } = makeChamber(session, { fontSize: 'fit' });

        chamber.displayAtom(chamber.session.atoms[4], 4);
        await flushFillMask();

        const field = container.querySelector('#chamber-field');
        expect(field.classList.contains('is-living-fit')).toBe(false);
        expect(field.style.getPropertyValue('--living-fit-mix')).toBe('');
        chamber.destroy();
    });

    it('clears semantic Fit state when the mask falls back to opaque text', async () => {
        const { chamber, container } = makeChamber(
            semanticSession({ mode: 'pick', sourced: [], procedural: ['fractal'] }),
            { fontSize: 'fit' }
        );
        chamber.displayAtom(chamber.session.atoms[4], 4);
        await flushFillMask();
        const field = container.querySelector('#chamber-field');
        expect(field.classList.contains('is-living-fit')).toBe(true);

        chamber._revertFillToOpaqueWord();
        expect(field.classList.contains('is-living-fit')).toBe(false);
        expect(container.querySelector('#atom-display').style.color).not.toBe('transparent');
        chamber.destroy();
    });
});
