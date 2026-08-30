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

// The material now projects into a glyph-local viewport child; the mask stays
// on the stage-aligned .chamber-fill-field.
function fillViewport(container) {
    return container.querySelector('.chamber-fill-viewport');
}

function galleryHost(container) {
    return container.querySelector('#chamber-continuous-field');
}

// The glyph mask is now an inline SVG <mask> referenced by url(#id) (a
// serialized data: URL was font-isolated). Resolve the referenced element
// so tests can assert its shape — a glyph <text>, never a bbox <rect>.
function fitMask(host) {
    if (!host) return null;
    const ref = `${host.style.maskImage || ''} ${host.style.webkitMaskImage || ''}`;
    const id = ref.match(/#([\w-]+)/)?.[1];
    if (!id) return null;
    const root = host.closest('#chamber-field') || host.ownerDocument;
    return root.querySelector(`mask[id="${id}"]`);
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
    });
    return { promise, resolve, reject };
}

function installFillMaskEnv({
    fontLoad = async () => [{}],
    projectionReady = async () => {}
} = {}) {
    const previousFonts = document.fonts;
    const previousSupports = globalThis.CSS?.supports;
    const previousRequestFrame = globalThis.requestAnimationFrame;
    if (!globalThis.CSS) globalThis.CSS = {};
    globalThis.CSS.supports = () => true;
    document.fonts = { load: vi.fn(fontLoad) };
    const projectionReadySpy = vi.spyOn(visualCortex, 'whenContinuousFieldProjectionReady')
        .mockImplementation(projectionReady);

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
        globalThis.requestAnimationFrame = previousRequestFrame;
        projectionReadySpy.mockRestore();
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
    await new Promise(resolve => requestAnimationFrame(() => resolve()));
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
        expect(el.dataset.maskState).toBe('inactive');
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
        vi.useRealTimers();
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
        const viewport = fillViewport(container);
        const field = visualCortex._continuousField;
        expect(gallery).toBeTruthy();
        expect(fill).toBeTruthy();
        expect(viewport).toBeTruthy();
        expect(fill).not.toBe(gallery);
        expect(field).toBeInstanceOf(ContinuousField);
        expect(field.host).toBe(gallery);
        // The material projects into the glyph-local viewport; the mask stays
        // on the stage-aligned field.
        expect(field.projectionHost).toBe(viewport);
        expect(viewport.parentElement).toBe(fill);
        expect(chamber.fillField).toBeFalsy();
        expect(chamber._fillFieldDirector).toBeFalsy();
        expect(chamber.fillVideoField).toBeFalsy();

        field._ensureLayers();
        field.setProjectionHost(viewport);
        field._crossfadeTo({ url: 'https://example.test/a.jpg' }, true);
        field._currentUrl = 'https://example.test/a.jpg';
        field._crossfadeTo({ url: 'https://example.test/b.jpg' }, false);
        field._currentUrl = 'https://example.test/b.jpg';

        const gallerySrcs = [...gallery.querySelectorAll('.continuous-field-artwork')]
            .map(img => img.getAttribute('src'))
            .filter(Boolean)
            .sort();
        const fillSrcs = [...viewport.querySelectorAll('.continuous-field-artwork')]
            .map(img => img.getAttribute('src'))
            .filter(Boolean)
            .sort();
        expect(fillSrcs).toEqual(gallerySrcs);
        expect(fillSrcs.some(src => src.includes('b.jpg'))).toBe(true);
        expect(field.currentUrl).toBe('https://example.test/b.jpg');
        expect(fitMask(fill)?.querySelector('text')).toBeTruthy();
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

    it('keeps opaque fallback until Thick font and current projection are ready, then activates both mask classes in one RAF', async () => {
        restoreEnv?.();
        const font = deferred();
        const projection = deferred();
        const frames = [];
        restoreEnv = installFillMaskEnv({
            fontLoad: () => font.promise,
            projectionReady: () => projection.promise
        });

        const { chamber, container } = makeChamber(
            wordGallerySession(),
            { chamberMask: true }
        );
        const pending = atomDisplay(container);
        pending.textContent = 'O';
        visualCortex._continuousField?.stop();
        globalThis.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
        const activation = chamber.syncFillGlyphMask();

        expect(pending.dataset.maskState).toBe('preparing');
        expect(pending.classList.contains('is-mask-ink')).toBe(false);
        expect(pending.classList.contains('is-mask-ready')).toBe(false);
        expect(pending.style.color).not.toBe('transparent');

        font.resolve([{}]);
        await Promise.resolve();
        expect(pending.dataset.maskState).toBe('preparing');
        expect(pending.classList.contains('is-mask-ink')).toBe(false);
        expect(frames).toHaveLength(0);

        projection.resolve();
        await Promise.resolve();
        await Promise.resolve();
        expect(pending.dataset.maskState).toBe('preparing');
        expect(pending.classList.contains('is-mask-ink')).toBe(false);
        expect(pending.classList.contains('is-mask-ready')).toBe(false);
        expect(frames).toHaveLength(1);

        frames[0](16);
        await activation;
        const host = fillHost(container);
        expect(pending.dataset.maskState).toBe('ready');
        expect(pending.classList.contains('is-mask-ink')).toBe(true);
        expect(pending.classList.contains('is-mask-ready')).toBe(true);
        const readyMask = fitMask(host);
        expect(readyMask?.querySelector('text')?.textContent).toBe('O');
        expect(readyMask?.querySelector('rect')).toBeFalsy();
        expect(galleryHost(container).style.maskImage).toBeFalsy();
        expect(document.fonts.load).toHaveBeenCalledWith('700 1em "Space Grotesk"', 'O');
        chamber.destroy();
    });

    it('keeps opaque fallback while projection is ready but the Thick font is pending', async () => {
        restoreEnv?.();
        const font = deferred();
        restoreEnv = installFillMaskEnv({ fontLoad: () => font.promise });

        const { chamber, container } = makeChamber(
            wordGallerySession(),
            { chamberMask: true }
        );
        chamber.displayAtom({ content: 'O', duration: 500 }, 0);

        const el = atomDisplay(container);
        expect(el.classList.contains('is-mask')).toBe(true);
        expect(el.dataset.maskState).toBe('preparing');
        expect(el.classList.contains('is-mask-ink')).toBe(false);
        expect(el.style.color).not.toBe('transparent');
        expect(fillHost(container)?.classList.contains('is-hidden')).toBe(true);

        font.resolve([{}]);
        await flushFillMask();
        expect(el.classList.contains('is-mask-ink')).toBe(true);
        expect(el.classList.contains('is-mask-ready')).toBe(true);
        expect(el.dataset.maskState).toBe('ready');
        expect(fillHost(container)?.classList.contains('is-hidden')).toBe(false);
        chamber.destroy();
    });

    for (const [change, applyChange] of [
        ['atom', ({ atom }) => { atom.textContent = 'Changed'; }],
        ['material', ({ chamber }) => {
            chamber.session.visualConfig.interlocution.wordFill = { mode: 'accent' };
        }],
        ['projection host', ({ chamber, container }) => {
            const replacement = document.createElement('div');
            container.querySelector('#chamber-field').appendChild(replacement);
            chamber.fillFieldHost = replacement;
        }]
    ]) {
        it(`does not activate a stale generation after the ${change} changes`, async () => {
            restoreEnv?.();
            const projection = deferred();
            const frames = [];
            restoreEnv = installFillMaskEnv({
                projectionReady: () => projection.promise
            });
            const { chamber, container } = makeChamber(
                wordGallerySession(),
                { chamberMask: true }
            );
            const atom = atomDisplay(container);
            atom.textContent = 'O';
            visualCortex._continuousField?.stop();
            globalThis.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
            const activation = chamber.syncFillGlyphMask();

            applyChange({ chamber, container, atom });
            projection.resolve();
            await activation;

            expect(frames).toHaveLength(0);
            expect(atom.classList.contains('is-mask-ink')).toBe(false);
            expect(atom.classList.contains('is-mask-ready')).toBe(false);
            expect(atom.style.color).not.toBe('transparent');
            chamber.destroy();
        });
    }

    it('returns to readable fallback after projection rejection and never retries by timer', async () => {
        restoreEnv?.();
        const rejection = new Error('first projection failed');
        const projectionReady = vi.fn().mockRejectedValue(rejection);
        restoreEnv = installFillMaskEnv({ projectionReady });
        const { chamber, container } = makeChamber(
            wordGallerySession(),
            { chamberMask: true }
        );
        const atom = atomDisplay(container);
        atom.textContent = 'O';
        const timer = vi.spyOn(globalThis, 'setTimeout');

        await chamber.syncFillGlyphMask();
        expect(atom.dataset.maskState).toBe('fallback');
        expect(atom.classList.contains('is-mask-ink')).toBe(false);
        expect(atom.classList.contains('is-mask-ready')).toBe(false);
        expect(atom.style.color).not.toBe('transparent');
        expect(timer).not.toHaveBeenCalled();
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
        expect(el.classList.contains('is-mask-ready')).toBe(false);
        expect(el.dataset.maskState).toBe('fallback');
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
        expect(atomDisplay(container).classList.contains('is-mask-ready')).toBe(false);
        expect(atomDisplay(container).dataset.maskState).toBe('inactive');
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
        expect(fitMask(wrapper)?.querySelector('text')).toBeTruthy();
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

    it('leaves a masked Word to the mask, and washes nothing', async () => {
        // Living Text used to lay a flat mood colour over the whole fill —
        // measured at 33-41% on real readings, against a 13.7% shift in plain
        // ink. One control, two magnitudes, and applied only to procedural
        // fills so the same setting did a great deal or nothing depending on a
        // choice made in another pane. Living Text colours the text now; a
        // generated field is tinted through its engine's palette, not covered.
        const { chamber, container } = makeChamber(
            semanticSession({ mode: 'pick', sourced: [], procedural: ['fractal'] }),
            { fontSize: 'fit' }
        );

        chamber.displayAtom(chamber.session.atoms[4], 4);
        await flushFillMask();

        // What survives: the mask carries the Word, so the ink steps aside.
        expect(atomDisplay(container).style.color).toBe('transparent');
        expect(atomDisplay(container).style.textShadow).toBe('');

        // What must not come back.
        const field = container.querySelector('#chamber-field');
        expect(field.classList.contains('is-living-fit')).toBe(false);
        for (const prop of ['--living-fit-color', '--living-fit-mix',
            '--living-fit-saturation', '--living-fit-brightness']) {
            expect(field.style.getPropertyValue(prop), prop).toBe('');
        }

        chamber.destroy();
    });

    // A NEW NAME FOR A NEW GLYPH.
    //
    // The mask id was minted once per Chamber, so `mask-image: url("#id")`
    // was one unchanging string for a whole reading while the <mask> under it
    // was rewritten every word. Chromium re-rasterises regardless; WebKit is
    // not obliged to, and iOS Safari was reported holding the reading's FIRST
    // glyph — a giant "A", at that word's size — while the atom had moved on
    // to "sent" and showed only its border.
    //
    // This cannot assert what Safari rasterises. It asserts the thing that
    // gave Safari permission to cache: that the reference is now different
    // for a different glyph, on every engine.
    it('gives each glyph its own mask reference', async () => {
        const { chamber, container } = makeChamber(
            semanticSession({ mode: 'same', border: 'cream' }),
            { fontSize: 'fit' }
        );

        const seen = [];
        for (const [index, word] of [[1, 'love'], [4, 'beautiful'], [6, 'light']].entries()) {
            chamber.displayAtom({ content: word[1], duration: 500 }, word[0]);
            await flushFillMask();
            const host = container.querySelector('.chamber-fill-field');
            const mask = container.querySelector('.chamber-fit-mask-defs mask');
            const glyph = container.querySelector('.chamber-fit-mask-defs text');
            seen.push({
                index,
                word: word[1],
                glyph: (glyph?.textContent || '').trim(),
                id: mask?.getAttribute('id'),
                url: host?.style.maskImage || host?.style.webkitMaskImage || ''
            });
        }

        for (const row of seen) {
            expect(row.glyph, `${row.word} is the glyph`).toBe(row.word);
            // The rule points at the mask that holds THIS word.
            expect(row.url, `${row.word} references its own mask`).toContain(row.id);
        }
        // And no two words share a reference, which is what a cached raster
        // needs in order to survive the word that replaced it.
        expect(new Set(seen.map(row => row.id)).size, 'one reference per glyph')
            .toBe(seen.length);

        chamber.destroy();
        container.remove();
    });

    it('maps Fit contour borders directly from the visual-mask material', async () => {
        for (const [border, color] of [
            ['off', ''],
            ['cream', 'var(--color-light)'],
            ['accent', 'var(--color-accent)']
        ]) {
            const { chamber, container } = makeChamber(
                semanticSession({ mode: 'same', border }),
                { fontSize: 'fit' }
            );

            chamber.displayAtom(chamber.session.atoms[4], 4);
            await flushFillMask();
            expect(atomDisplay(container).style.getPropertyValue('--fit-border-color')).toBe(color);

            chamber.destroy();
            container.remove();
        }
    });

    // THE BORDER IS THE FIT WORD'S EDGE, NOT THE MASK'S. It used to be set
    // inside applyChamberMask, so it existed only while imagery was painted
    // through the letters: a reader choosing Fit with a flat Accent ink got
    // no edge, and the panel did not even offer one. Its job is to let a word
    // that fills the chamber read against the field, which a flat fill needs
    // as much as a Rembrandt does.
    it('edges a Fit word whatever fills it, and edges nothing at a fixed scale', async () => {
        for (const mode of ['accent', 'plain', 'same']) {
            const { chamber, container } = makeChamber(
                semanticSession({ mode, border: 'cream' }),
                { fontSize: 'fit' }
            );
            chamber.displayAtom(chamber.session.atoms[4], 4);
            await flushFillMask();
            expect(atomDisplay(container).style.getPropertyValue('--fit-border-color'),
                `${mode} ink`).toBe('var(--color-light)');
            chamber.destroy();
            container.remove();
        }

        // No Fit, no word to edge.
        const { chamber, container } = makeChamber(
            semanticSession({ mode: 'same', border: 'cream' }),
            { fontSize: 'large' }
        );
        chamber.displayAtom(chamber.session.atoms[4], 4);
        await flushFillMask();
        expect(atomDisplay(container).style.getPropertyValue('--fit-border-color')).toBe('');
        chamber.destroy();
        container.remove();
    });

    // Glass is a tile behind the text, and a Fit word leaves no behind.
    it('withdraws glass once the word holds the frame', () => {
        const { chamber, container } = makeChamber(
            semanticSession({ mode: 'accent' }), { fontSize: 'fit' }
        );
        expect(chamber.wordHoldsTheFrame()).toBe(true);
        expect(chamber.glassCanApply()).toBe(false);
        chamber.destroy();
        container.remove();

        const fixed = makeChamber(semanticSession({ mode: 'accent' }), { fontSize: 'large' });
        expect(fixed.chamber.wordHoldsTheFrame()).toBe(false);
        expect(fixed.chamber.glassCanApply()).toBe(true);
        fixed.chamber.destroy();
        fixed.container.remove();
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

    it('gives the Word its ink back when the mask falls to opaque text', async () => {
        const { chamber, container } = makeChamber(
            semanticSession({ mode: 'pick', sourced: [], procedural: ['fractal'] }),
            { fontSize: 'fit' }
        );
        chamber.displayAtom(chamber.session.atoms[4], 4);
        await flushFillMask();
        expect(container.querySelector('#atom-display').style.color).toBe('transparent');

        // The mask can no longer carry the Word, so the Word carries itself.
        chamber._revertFillToOpaqueWord();
        expect(container.querySelector('#atom-display').style.color).not.toBe('transparent');
        chamber.destroy();
    });
});

describe('Chamber Fit hydration threshold', () => {
    it('waits for the material, not for a word that does not exist yet', async () => {
        // THE GATE USED TO HOLD NOTHING. It read the first word's text to
        // decide what to wait for and returned early when it found none —
        // and there IS none at that moment: the player writes the first word
        // as it starts, one millisecond after this gate runs. So the reading
        // always opened before its material, and the fill arrived seconds in.
        // It only looked correct when the imagery happened to be warm, which
        // is precisely when the gate is not needed.
        const projection = deferred();
        const restore = installFillMaskEnv({ projectionReady: () => projection.promise });
        try {
            const { chamber, container } = makeChamber(
                wordGallerySession(),
                { chamberMask: true }
            );
            visualCortex._continuousField?.stop();
            // The player has not written a word yet — the real cold-start state.
            atomDisplay(container).textContent = '';
            expect(chamber.fillViewport).toBeTruthy();

            let opened = false;
            const threshold = chamber._awaitFitHydration(5000).then(() => { opened = true; });
            await Promise.resolve();
            await Promise.resolve();
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(opened, 'the threshold opened before the material was ready').toBe(false);

            projection.resolve();
            await threshold;
            expect(opened).toBe(true);
            chamber.destroy();
        } finally {
            restore();
        }
    });

    it('opens the threshold anyway when the material will not arrive', async () => {
        // Reverent degradation: a pool that never resolves must not lock a
        // reader out of their own reading.
        const restore = installFillMaskEnv({ projectionReady: () => new Promise(() => {}) });
        try {
            const { chamber, container } = makeChamber(
                wordGallerySession(),
                { chamberMask: true }
            );
            visualCortex._continuousField?.stop();
            atomDisplay(container).textContent = '';

            const started = Date.now();
            await chamber._awaitFitHydration(60);
            expect(Date.now() - started).toBeLessThan(3000);
            chamber.destroy();
        } finally {
            restore();
        }
    });
});
