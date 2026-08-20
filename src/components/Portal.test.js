/**
 * The Portal, after two rooms were removed.
 *
 * This file tested the SOL strip — the hour, the current window, the Earth
 * turning in its arch. The Solarium is deleted and so are those; what is left
 * is the nav, and one assertion that outlived both rooms and now covers them
 * together, because each of them left its door standing.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Portal } from './Portal.js';

// jsdom's media elements can't play; the portal defers video start anyway
beforeEach(() => {
    localStorage.removeItem('rise_sol_plan_v1');
    localStorage.removeItem('rise_workshop_v1');
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});

function makePortal(options = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onNavigate = vi.fn();
    const portal = new Portal(container, { onNavigate, ...options });
    return { portal, container, onNavigate };
}

describe('Portal', () => {
    it('nav holds the core tools', () => {
        const { portal, container } = makePortal();

        // The nav row is tools operating on the reader's own material;
        // curated experiences get their own doorways below it
        const secondary = container.querySelectorAll('.nav-secondary .nav-item');
        expect(secondary).toHaveLength(3);
        expect([...secondary].map(el => el.dataset.nav)).toEqual(['vault', 'library', 'workshop']);

        portal.destroy();
        container.remove();
    });

    it('offers no door to a room that is gone', () => {
        // Both rooms left their door standing — the Atrium's for as long as it
        // took to run the tests, the Solarium's alongside it. A button whose
        // only job is to navigate somewhere the router no longer registers.
        // Asserted rather than remembered: the next room will do it again.
        const { portal, container } = makePortal();
        for (const gone of ['atrium', 'sol']) {
            expect(container.querySelector(`[data-nav="${gone}"]`),
                `a door still opens onto ${gone}`).toBeNull();
        }
        expect(container.querySelector('.portal-arch-atrium')).toBeNull();
        expect(container.querySelector('.portal-arch-sol')).toBeNull();
        portal.destroy();
        container.remove();
    });

});
