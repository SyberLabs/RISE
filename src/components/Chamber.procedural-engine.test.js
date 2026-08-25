import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';
import { visualCortex } from '../visuals/visual-cortex.js';
import { PROCEDURAL_PATTERN_IDS } from '../core/visual-registry.js';
import {
    beginNonFlashingVisualSession,
    endVisualInterlocutionSession
} from '../core/visual-safety.js';

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
                streamGlass: true
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

describe('Chamber procedural engine hook', () => {
    afterEach(() => {
        releaseGallery();
        delete globalThis.rise;
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    it('selecting Fractal Flames mounts the Gallery engine host, not a sourced glass fallback', () => {
        armGallery(['procedural:fractal']);
        const { chamber, container } = makeChamber();
        const atom = container.querySelector('#atom-display');
        const host = container.querySelector('#chamber-continuous-field');

        expect(host).toBeTruthy();
        expect(visualCortex.hasContinuousFieldHost()).toBe(true);
        expect(visualCortex.config.activeTypes).toEqual(['fractal']);
        expect(visualCortex._isExternalCategory('fractal')).toBe(false);
        expect(visualCortex._continuousHasWorks()).toBe(true);
        expect(visualCortex._continuousProceduralTypes()).toEqual(['fractal']);
        expect(visualCortex._activePoolCategories()).toEqual([]);
        expect(atom.classList.contains('glass-tile')).toBe(true);

        chamber.destroy();
    });

    it('Mask still forces glass off while the procedural engine remains mounted', () => {
        armGallery(['fractal']);
        const { chamber, container } = makeChamber({
            visualConfig: {
                visualMode: 'interlocution',
                interlocution: {
                    presentation: 'continuous',
                    sourceFamily: 'procedural',
                    procedural: ['fractal'],
                    sourced: [],
                    streamGlass: true,
                    wordFill: { mode: 'same' }
                }
            }
        }, { chamberMask: true, chamberFace: 'thick', fontSize: 'fit' });
        const atom = container.querySelector('#atom-display');

        expect(atom.classList.contains('is-mask')).toBe(true);
        expect(atom.classList.contains('glass-tile')).toBe(false);
        expect(container.querySelector('#chamber-continuous-field')).toBeTruthy();
        expect(visualCortex._continuousHasWorks()).toBe(true);
        expect(visualCortex._continuousProceduralTypes()).toEqual(['fractal']);

        chamber.destroy();
    });

    it('each live sibling procedural is an engine field, not an empty gallery source', () => {
        const liveFields = {
            harmonograph: () => visualCortex._harmonographField?.running === true,
            ostensoria: () => visualCortex._plateField?.running === true,
            apparitio: () => visualCortex._plateField?.running === true,
        };

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
            expect(container.querySelector('#chamber-continuous-field'), id).toBeTruthy();
            expect(container.querySelector('#atom-display').classList.contains('glass-tile'), id)
                .toBe(false);
            if (liveFields[id]) {
                expect(liveFields[id](), id).toBe(true);
            } else {
                expect(visualCortex._continuousProceduralTypes(), id).toEqual([id]);
            }

            chamber.destroy();
        }
    });

    it('Attractor is a listed procedural that mounts the existing Chamber engine', () => {
        armGallery(['procedural:attractor']);
        const { chamber, container } = makeChamber({
            visualConfig: {
                visualMode: 'interlocution',
                interlocution: {
                    presentation: 'continuous',
                    sourceFamily: 'procedural',
                    procedural: ['attractor'],
                    sourced: [],
                    streamGlass: false
                }
            }
        });

        expect(visualCortex.config.activeTypes).toEqual(['attractor']);
        expect(visualCortex._isExternalCategory('attractor')).toBe(false);
        expect(visualCortex._activePoolCategories()).toEqual([]);
        expect(visualCortex._continuousHasWorks()).toBe(true);
        expect(visualCortex._continuousProceduralTypes()).toEqual([]);
        expect(visualCortex._attractorField).toBeTruthy();
        expect(container.querySelector('#chamber-continuous-field')).toBeTruthy();
        expect(container.querySelector('.attractor-canvas')).toBeTruthy();
        expect(container.querySelector('#atom-display').classList.contains('glass-tile'))
            .toBe(false);

        chamber.destroy();
    });
});
