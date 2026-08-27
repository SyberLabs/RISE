/**
 * A PANEL THAT CANNOT ACT SHOULD NOT LOOK LIKE ONE THAT CAN.
 *
 * With no text in the Chamber the Navigator rendered its whole browser and
 * put a sentence above it. A reader could walk the tree, open a leaf, read
 * its bench — and meet the refusal only at the end, at a "Bring into the
 * room" that was disabled and said nothing about why. The dependency was
 * announced once, at the top, and then contradicted by everything under it.
 *
 * The gate is derived, not stored: `locked` already comes from the host as
 * `!config.text`, so the reading itself remains the source of truth and
 * nothing new persists. What changes is that the panel stops offering a
 * journey it cannot complete.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisualNavigator } from './VisualNavigator.js';

let nav = null;

const mount = (options = {}) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    nav = new VisualNavigator(container, { visualConfig: {}, onChange: vi.fn(), ...options });
    return nav;
};

afterEach(() => {
    nav?.destroy();
    nav?.container.remove();
    nav = null;
    vi.restoreAllMocks();
});

describe('the Visual Navigator waits for a text', () => {
    it('shows the dependency instead of a browser it cannot finish', () => {
        mount({ locked: true });
        const gate = nav.container.querySelector('.vnav-gate');

        expect(gate, 'a gate stands where the browser was').toBeTruthy();
        expect(gate.querySelector('h3')?.textContent).toMatch(/Pick a text first/i);
        expect(gate.textContent).toMatch(/reading/i);
    });

    it('offers nothing behind the gate to walk into', () => {
        mount({ locked: true });

        // The tree, the entry, and the commit are all gone — not merely
        // disabled, which is what left an unexplained dead end at the end.
        expect(nav.container.querySelector('.vnav-body')).toBeNull();
        expect(nav.container.querySelector('.vnav-node')).toBeNull();
        expect(nav.container.querySelector('[data-action="toggle"]')).toBeNull();
        expect(nav.container.querySelector('[data-word-fill]')).toBeNull();
    });

    it('leaves nothing tabbable behind it', () => {
        mount({ locked: true });
        const focusable = nav.container.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        // Whatever remains reachable must belong to the gate itself, never to
        // the browser it replaced.
        for (const el of focusable) {
            expect(el.closest('.vnav-gate'), `${el.tagName} ${el.className} is behind the gate`)
                .toBeTruthy();
        }
    });

    it('opens the whole panel the moment a text exists', () => {
        mount({ locked: false });

        expect(nav.container.querySelector('.vnav-gate')).toBeNull();
        expect(nav.container.querySelector('.vnav-body')).toBeTruthy();
        expect(nav.container.querySelectorAll('.vnav-node').length).toBeGreaterThan(0);
    });

    it('returns to the gate when the text is taken away', () => {
        mount({ locked: false });
        expect(nav.container.querySelector('.vnav-body')).toBeTruthy();

        nav.setLocked(true);
        expect(nav.container.querySelector('.vnav-gate'), 'the gate returns').toBeTruthy();
        expect(nav.container.querySelector('.vnav-body')).toBeNull();

        nav.setLocked(false);
        expect(nav.container.querySelector('.vnav-body'), 'and lifts again').toBeTruthy();
    });

    it('discards a dialog that the departed text opened', () => {
        mount({ locked: false });
        nav.openDialog({ title: 'Something', body: 'x', primaryLabel: 'Do it', confirm: () => {} });
        expect(nav.dialog).toBeTruthy();

        nav.setLocked(true);
        expect(nav.dialog, 'a pending question about a text that is gone').toBeNull();
    });
});
