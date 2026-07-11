/**
 * Living Text integration test — verifies the full in-component path:
 * session.visualConfig.livingText → conductor scoring in the Chamber
 * constructor → per-atom color/glow application in displayAtom.
 */
import { describe, it, expect } from 'vitest';
import { Chamber } from './Chamber.js';

function makeSession(contents, livingText) {
    return {
        title: 'Living Text Test',
        atoms: contents.map(c => ({ content: c, duration: 500 })),
        totalDuration: contents.length * 500,
        atomCount: contents.length,
        visualConfig: { visualMode: 'off', livingText }
    };
}

function makeChamber(session) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const chamber = new Chamber(container, { session, player: null, autoStart: false });
    return { chamber, container };
}

const parseRgb = (str) => str.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/).slice(1, 4).map(Number);

describe('Chamber Living Text integration', () => {
    it('builds a semantic track when enabled and cools dark text', () => {
        const dark = Array(8).fill('grief death terror sorrow');
        const { chamber, container } = makeChamber(makeSession(dark, { enabled: true }));

        expect(chamber.semanticTrack).toHaveLength(8);

        chamber.displayAtom(chamber.session.atoms[4], 4);
        const el = container.querySelector('#atom-display');
        expect(el.style.color).not.toBe('');
        const [r, , b] = parseRgb(el.style.color);
        expect(b).toBeGreaterThan(r + 30); // clearly cool, not a subtle tint
        expect(el.style.textShadow).toContain('px');

        chamber.destroy();
        container.remove();
    });

    it('warms bright text', () => {
        const brightAtoms = Array(8).fill('love joy light beautiful');
        const { chamber, container } = makeChamber(makeSession(brightAtoms, { enabled: true }));

        chamber.displayAtom(chamber.session.atoms[4], 4);
        const [r, , b] = parseRgb(container.querySelector('#atom-display').style.color);
        expect(r).toBeGreaterThan(b + 30); // clearly warm

        chamber.destroy();
        container.remove();
    });

    it('leaves the raw platform untouched when disabled', () => {
        const { chamber, container } = makeChamber(
            makeSession(Array(8).fill('grief death terror'), { enabled: false })
        );

        expect(chamber.semanticTrack).toBeNull();
        chamber.displayAtom(chamber.session.atoms[4], 4);
        const el = container.querySelector('#atom-display');
        expect(el.style.color).toBe('');
        expect(el.style.textShadow).toBe('');

        chamber.destroy();
        container.remove();
    });

    it('leaves the raw platform untouched when livingText is absent entirely (legacy sessions)', () => {
        const session = makeSession(Array(4).fill('grief death'), undefined);
        delete session.visualConfig.livingText;
        const { chamber, container } = makeChamber(session);

        expect(chamber.semanticTrack).toBeNull();
        chamber.displayAtom(chamber.session.atoms[2], 2);
        expect(container.querySelector('#atom-display').style.color).toBe('');

        chamber.destroy();
        container.remove();
    });

    it('respects the intensity knob', () => {
        const dark = Array(8).fill('grief death terror sorrow');
        const full = makeChamber(makeSession(dark, { enabled: true, intensity: 1 }));
        const half = makeChamber(makeSession(dark, { enabled: true, intensity: 0.3 }));

        full.chamber.displayAtom(full.chamber.session.atoms[4], 4);
        half.chamber.displayAtom(half.chamber.session.atoms[4], 4);

        const [rFull, , bFull] = parseRgb(full.container.querySelector('#atom-display').style.color);
        const [rHalf, , bHalf] = parseRgb(half.container.querySelector('#atom-display').style.color);
        expect(bFull - rFull).toBeGreaterThan(bHalf - rHalf); // lower intensity → weaker tint

        full.chamber.destroy(); full.container.remove();
        half.chamber.destroy(); half.container.remove();
    });
});
