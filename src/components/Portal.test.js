/**
 * Portal SOL strip tests — the nav exposes the four core destinations and SOL lives
 * as the portal's living strip: hour, current window, and what plays
 * (following the My Day plan when set).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Portal } from './Portal.js';
import { MemoryCore } from '../core/memory.js';
import { getWindowAt } from './Sol.js';

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

describe('Portal SOL strip', () => {
    it('nav holds the core tools; SOL lives as a specialized entry', () => {
        const { portal, container } = makePortal();

        // The nav row is tools operating on the reader's own material;
        // curated experiences get their own doorways below it
        const secondary = container.querySelectorAll('.nav-secondary .nav-item');
        expect(secondary).toHaveLength(3);
        expect([...secondary].map(el => el.dataset.nav)).toEqual(['vault', 'library', 'workshop']);

        const strip = container.querySelector('.portal-arch-sol');
        expect(strip).not.toBeNull();
        expect(strip.dataset.nav).toBe('sol');

        portal.destroy();
        container.remove();
    });

    it('offers no door to a room that is gone', () => {
        // The Atrium was deleted and its door was not, for exactly as long as
        // it took to run the tests — a button whose only job is to navigate
        // somewhere the router no longer registers. Asserted rather than
        // remembered, because the next room to go will leave the same door.
        const { portal, container } = makePortal();
        expect(container.querySelector('[data-nav="atrium"]')).toBeNull();
        expect(container.querySelector('.portal-arch-atrium')).toBeNull();
        portal.destroy();
        container.remove();
    });

    it('shows the current window, live, on the SOL arch plinth', () => {
        const { portal, container } = makePortal();
        const window_ = getWindowAt(new Date());

        // The window name is carried in a hidden field (still written by
        // updateSolStrip); the plinth detail names the window; the time ticks.
        expect(container.querySelector('.sol-strip-window').textContent).toBe(window_.name);
        expect(container.querySelector('.sol-strip-detail').textContent).toBe(window_.name);
        expect(container.querySelector('.sol-strip-time').textContent).toMatch(/\d/);

        portal.destroy();
        container.remove();
    });

    it('reflects the My Day plan for the current window', () => {
        const window_ = getWindowAt(new Date());
        MemoryCore.setSolPlanEntry(window_.key, { kind: 'sol', id: 'sol-sit-resolution' });

        const { portal, container } = makePortal();
        expect(container.querySelector('.sol-strip-detail').textContent)
            .toContain('from your plan · Resolution');

        portal.destroy();
        container.remove();
    });

    it('clicking the SOL arch navigates to SOL', () => {
        const { portal, container, onNavigate } = makePortal();
        container.querySelector('.portal-arch-sol').click();
        expect(onNavigate).toHaveBeenCalledWith('sol');
        portal.destroy();
        container.remove();
    });
});
