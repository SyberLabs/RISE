import { afterEach, describe, expect, it } from 'vitest';
import { Chamber } from './Chamber.js';

function makeChamber(settings = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const session = {
        title: 'Stream face',
        atoms: [{ content: 'hello', duration: 500 }],
        totalDuration: 500,
        atomCount: 1,
        visualConfig: { visualMode: 'off' }
    };
    const chamber = new Chamber(container, {
        session,
        player: null,
        autoStart: false,
        getSettings: () => settings
    });
    return { chamber, container, settings };
}

describe('Chamber stream face', () => {
    afterEach(() => {
        document.body.replaceChildren();
    });

    it('applies the selected allowlisted face to the live atom display', () => {
        const { chamber, container } = makeChamber({ chamberFace: 'jp' });
        const el = container.querySelector('#atom-display');
        expect(el.dataset.chamberFace).toBe('jp');
        chamber.destroy();
    });

    it('falls back to literary when the stored face is unknown', () => {
        const { chamber, container } = makeChamber({ chamberFace: 'papyrus' });
        expect(container.querySelector('#atom-display').dataset.chamberFace).toBe('literary');
        chamber.destroy();
    });

    it('re-reads the latest persisted chamberFace when the session starts', () => {
        const { chamber, container, settings } = makeChamber({ chamberFace: 'literary' });
        expect(container.querySelector('#atom-display').dataset.chamberFace).toBe('literary');

        settings.chamberFace = 'thick';
        chamber.beginSession();
        expect(container.querySelector('#atom-display').dataset.chamberFace).toBe('thick');
        chamber.destroy();
    });
});
