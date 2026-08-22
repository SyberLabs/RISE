import { afterEach, describe, expect, it } from 'vitest';
import { Chamber } from './Chamber.js';

function makeChamber() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const session = {
        title: 'Stream face',
        atoms: [{ content: 'hello', duration: 500 }],
        totalDuration: 500,
        atomCount: 1,
        visualConfig: { visualMode: 'off' }
    };
    const chamber = new Chamber(container, { session, player: null, autoStart: false });
    return { chamber, container };
}

describe('Chamber stream face', () => {
    afterEach(() => {
        delete globalThis.rise;
        document.body.replaceChildren();
    });

    it('applies the selected allowlisted face to the live atom display', () => {
        globalThis.rise = { settings: { chamberFace: 'jp' } };
        const { chamber, container } = makeChamber();
        const el = container.querySelector('#atom-display');
        expect(el.dataset.chamberFace).toBe('jp');
        chamber.destroy();
    });

    it('falls back to literary when the stored face is unknown', () => {
        globalThis.rise = { settings: { chamberFace: 'papyrus' } };
        const { chamber, container } = makeChamber();
        expect(container.querySelector('#atom-display').dataset.chamberFace).toBe('literary');
        chamber.destroy();
    });
});
