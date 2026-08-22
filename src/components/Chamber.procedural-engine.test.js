import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';
import { visualCortex } from '../visuals/visual-cortex.js';
import {
    PROCEDURAL_PATTERN_IDS,
    SNAPSHOT_PROCEDURAL_IDS
} from '../core/visual-registry.js';
import {
    beginNonFlashingVisualSession,
    endVisualInterlocutionSession
} from '../core/visual-safety.js';
import { FractalFlame } from '../visuals/fractal.js';
import { Turrell } from '../visuals/turrell.js';
import { NeuralNetwork } from '../visuals/neural.js';
import { RockGarden } from '../visuals/rockgarden.js';
import { KleeEngine } from '../visuals/klee-enhanced.js';
import { Harmonograph } from '../visuals/harmonograph.js';
import { Ostensoria } from '../visuals/ostensoria.js';
import { Apparitio } from '../visuals/apparitio.js';

function stubSnapshotPaints() {
    vi.spyOn(FractalFlame.prototype, 'isReady').mockReturnValue(true);
    vi.spyOn(FractalFlame.prototype, 'fillQueue').mockResolvedValue(undefined);
    vi.spyOn(FractalFlame.prototype, 'generate').mockReturnValue(true);
    vi.spyOn(Turrell.prototype, 'generate').mockImplementation(function generate() {
        this.lastPlan = {
            center: [0.5, 0.5],
            radius: [0.25, 0.25],
            stops: [{ color: { h: 220, s: 20, l: 10 } }]
        };
        return this.lastPlan;
    });
    vi.spyOn(Turrell.prototype, 'render').mockReturnValue(true);
    vi.spyOn(NeuralNetwork.prototype, 'generate').mockReturnValue(true);
    vi.spyOn(RockGarden.prototype, 'generateRockGarden').mockReturnValue(undefined);
    vi.spyOn(RockGarden.prototype, 'renderRockGarden').mockReturnValue(true);
    vi.spyOn(KleeEngine.prototype, 'generateRandom').mockReturnValue({ lines: [], forms: [] });
    vi.spyOn(KleeEngine.prototype, 'render').mockReturnValue(undefined);
    vi.spyOn(Harmonograph.prototype, 'generate').mockReturnValue(true);
    vi.spyOn(Harmonograph.prototype, 'render').mockReturnValue(true);
    vi.spyOn(Ostensoria.prototype, 'generate').mockImplementation(function generate() {
        this.ready = true;
        return true;
    });
    vi.spyOn(Ostensoria.prototype, 'render').mockReturnValue(true);
    vi.spyOn(Apparitio.prototype, 'generate').mockReturnValue(true);
    vi.spyOn(Apparitio.prototype, 'render').mockReturnValue(true);
}

function makeChamber(sessionExtra = {}, settings = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    globalThis.rise = { settings };
    const session = {
        title: 'Procedural engines',
        atoms: [{ content: 'hello', duration: 500 }],
        totalDuration: 500,
        atomCount: 1,
        chunkMode: 'word',
        visualConfig: {
            visualMode: 'interlocution',
            interlocution: {
                presentation: 'continuous',
                sourceFamily: 'procedural',
                procedural: ['fractal'],
                sourced: [],
                streamGlass: false
            }
        },
        ...sessionExtra
    };
    const chamber = new Chamber(container, { session, player: null, autoStart: false });
    return { chamber, container };
}

function armGallery(activeTypes) {
    beginNonFlashingVisualSession();
    visualCortex.updateConfig({
        enabled: true,
        presentation: 'continuous',
        activeTypes
    });
}

function releaseGallery() {
    visualCortex.setContinuousFieldProjectionHost?.(null);
    visualCortex.setContinuousFieldHost(null);
    visualCortex.updateConfig({ enabled: false, presentation: 'full-frame' });
    endVisualInterlocutionSession();
}

function liveEngineMounted(container, id) {
    const host = container.querySelector('#chamber-continuous-field');
    if (!host) return false;
    if (id === 'harmonograph') {
        return visualCortex._harmonographField?.running === true
            && host.querySelectorAll('.harmonograph-plane').length > 0;
    }
    if (id === 'ostensoria' || id === 'apparitio') {
        return visualCortex._plateField?.running === true
            && host.querySelectorAll('.plate-plane').length > 0;
    }
    return visualCortex._galleryEngineField?.running === true
        && host.querySelectorAll('.gallery-engine-plane').length > 0;
}

describe('Chamber procedural engine hook', () => {
    afterEach(() => {
        releaseGallery();
        delete globalThis.rise;
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        stubSnapshotPaints();
    });

    it('selecting Fractal Flames mounts a live engine field, not glass-tile', () => {
        armGallery(['procedural:fractal']);
        const { chamber, container } = makeChamber();
        const atom = container.querySelector('#atom-display');
        const host = container.querySelector('#chamber-continuous-field');

        expect(host).toBeTruthy();
        expect(visualCortex.hasContinuousFieldHost()).toBe(true);
        expect(visualCortex.config.activeTypes).toEqual(['fractal']);
        expect(visualCortex._isExternalCategory('fractal')).toBe(false);
        expect(visualCortex._continuousHasWorks()).toBe(true);
        expect(visualCortex._continuousSnapshotFamilies()).toEqual(['fractal']);
        expect(visualCortex._continuousProceduralTypes()).toEqual([]);
        expect(visualCortex._activePoolCategories()).toEqual([]);
        expect(liveEngineMounted(container, 'fractal')).toBe(true);
        expect(atom.classList.contains('glass-tile')).toBe(false);

        chamber.destroy();
    });

    it('Mask still forces glass off while the procedural engine remains mounted', () => {
        armGallery(['fractal']);
        const { chamber, container } = makeChamber({}, { chamberMask: true });
        const atom = container.querySelector('#atom-display');

        expect(atom.classList.contains('is-mask')).toBe(true);
        expect(atom.classList.contains('glass-tile')).toBe(false);
        expect(liveEngineMounted(container, 'fractal')).toBe(true);
        expect(visualCortex._continuousHasWorks()).toBe(true);
        expect(visualCortex._continuousSnapshotFamilies()).toEqual(['fractal']);

        chamber.destroy();
    });

    it('each live sibling procedural is an engine field, not an empty gallery source', () => {
        for (const id of PROCEDURAL_PATTERN_IDS) {
            releaseGallery();
            armGallery([`procedural:${id}`]);
            const { chamber, container } = makeChamber({
                visualConfig: {
                    visualMode: 'interlocution',
                    interlocution: {
                        presentation: 'continuous',
                        sourceFamily: 'procedural',
                        procedural: [id],
                        sourced: [],
                        streamGlass: false
                    }
                }
            });

            expect(visualCortex.config.activeTypes, id).toEqual([id]);
            expect(visualCortex._isExternalCategory(id), id).toBe(false);
            expect(visualCortex._activePoolCategories(), id).toEqual([]);
            expect(visualCortex._continuousHasWorks(), id).toBe(true);
            expect(liveEngineMounted(container, id), id).toBe(true);
            expect(container.querySelector('#atom-display').classList.contains('glass-tile'), id)
                .toBe(false);
            if (SNAPSHOT_PROCEDURAL_IDS.includes(id)) {
                expect(visualCortex._continuousProceduralTypes(), id).toEqual([]);
            }

            chamber.destroy();
        }
    });
});
