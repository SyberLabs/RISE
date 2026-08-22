import { afterEach, describe, expect, it } from 'vitest';
import { Chamber } from './Chamber.js';

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
