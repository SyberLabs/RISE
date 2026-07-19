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

    it('stashes a shared semantic track on the session for responsive interlocutions', () => {
        const session = makeSession(Array(6).fill('war terror fire'), { enabled: false });
        session.visualConfig.visualMode = 'interlocution';
        session.visualConfig.interlocution = { frequency: 0.3, duration: 80, responsive: true, procedural: ['klee'] };
        const { chamber, container } = makeChamber(session);

        // The player reads this off the session at flash-roll time
        expect(Array.isArray(chamber.session.semanticTrack)).toBe(true);
        expect(chamber.session.semanticTrack).toHaveLength(6);
        // Living Text stays off: no local track, no text styling
        expect(chamber.semanticTrack).toBeNull();
        chamber.displayAtom(chamber.session.atoms[2], 2);
        expect(container.querySelector('#atom-display').style.color).toBe('');

        chamber.destroy();
        container.remove();
    });

    it('does not stash a track when responsive is off (raw platform)', () => {
        const session = makeSession(Array(4).fill('war terror'), { enabled: false });
        session.visualConfig.visualMode = 'interlocution';
        session.visualConfig.interlocution = { frequency: 0.3, duration: 80, responsive: false, procedural: ['klee'] };
        const { chamber, container } = makeChamber(session);

        expect(chamber.session.semanticTrack).toBeUndefined();

        chamber.destroy();
        container.remove();
    });

    it('genesis mode mounts a growing Klee field behind glass-backed text; destroy tears it down', () => {
        const session = makeSession(['calm text', 'more text'], { enabled: false });
        session.visualConfig.visualMode = 'genesis';
        session.visualConfig.genesis = { preset: 'harmonic' };
        const { chamber, container } = makeChamber(session);

        const host = container.querySelector('#chamber-genesis');
        expect(host).not.toBeNull();
        expect(container.querySelector('.klee-field-canvas')).not.toBeNull();
        expect(container.querySelector('#chamber-field').classList.contains('chamber-field-genesis')).toBe(true);
        expect(chamber.kleeField).not.toBeNull();
        expect(chamber.kleeField.preset).toBe('harmonic');

        chamber.destroy();
        expect(chamber.kleeField).toBeNull();
        container.remove();
    });

    it('empty atoms (paragraph breaks) render as invisible silence, never as a residue frame', () => {
        const { chamber, container } = makeChamber(makeSession(['word'], { enabled: false }));
        const el = container.querySelector('#atom-display');

        chamber.displayAtom({ content: 'word', duration: 500 }, 0);
        expect(el.textContent).toBe('word');

        chamber.displayAtom({ content: '', duration: 300 }, 1);
        expect(el.textContent).toBe('');
        expect(el.style.opacity).toBe('0');
        // :empty must match so the genesis glass tile dematerializes
        expect(el.childNodes.length).toBe(0);

        chamber.destroy();
        container.remove();
    });

    it('lays out a concealed next atom as a stable frame without a reveal-time fade', () => {
        const { chamber, container } = makeChamber(makeSession(['first', 'second'], { enabled: false }));
        const el = container.querySelector('#atom-display');

        chamber.displayAtom({ content: 'Prepared next phrase.', duration: 1200 }, 1, {
            concealed: true
        });

        expect(el.textContent).toBe('Prepared next phrase.');
        expect(el.style.transition).toBe('none');
        expect(el.style.opacity).toBe('1');
        expect(el.style.fontSize).toBe('56px');

        chamber.destroy();
        container.remove();
    });

    it('renders progress with a compositor transform instead of layout width', () => {
        const { chamber, container } = makeChamber(makeSession(['word'], { enabled: false }));
        const fill = container.querySelector('#progress-fill');

        chamber.updateProgress({ progress: 0.375, elapsed: 1500, total: 4000 });

        expect(fill.style.transform).toBe('scaleX(0.375)');
        expect(fill.style.width).toBe('');

        chamber.destroy();
        container.remove();
    });

    it('genesis field receives the semantic signal per atom when Living Text has a track', () => {
        const session = makeSession(Array(4).fill('grief sorrow'), { enabled: true });
        session.visualConfig.visualMode = 'genesis';
        session.visualConfig.genesis = { preset: 'random' };
        const { chamber, container } = makeChamber(session);

        expect(chamber.semanticTrack).not.toBeNull();
        chamber.displayAtom(chamber.session.atoms[2], 2);
        expect(chamber.kleeField.signal).toBe(chamber.semanticTrack[2]);

        chamber.destroy();
        container.remove();
    });

    it('handleEscape always consumes Escape: opens the exit confirmation, second press dismisses', () => {
        const { chamber, container } = makeChamber(makeSession(['calm text'], { enabled: false }));
        const overlay = container.querySelector('#exit-confirm-overlay');
        expect(overlay).not.toBeNull();

        expect(chamber.handleEscape()).toBe(true);
        expect(overlay.style.display).toBe('flex');

        expect(chamber.handleEscape()).toBe(true);
        expect(overlay.classList.contains('hidden')).toBe(true);

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
