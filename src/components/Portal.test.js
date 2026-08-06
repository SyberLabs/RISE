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
    it('nav holds the four core tools; Atrium and SOL live as specialized entries', () => {
        const { portal, container } = makePortal();

        // The nav row is tools operating on the reader's own material;
        // curated experiences get their own doorways below it
        const secondary = container.querySelectorAll('.nav-secondary .nav-item');
        expect(secondary).toHaveLength(3);
        expect([...secondary].map(el => el.dataset.nav)).toEqual(['vault', 'library', 'workshop']);

        // The Atrium is now a marble pavilion in the side margin, not a
        // stacked door — but the same nav hook and living detail hold. The
        // name is carved on the pavilion's entablature frieze.
        const door = container.querySelector('.portal-arch-atrium');
        expect(door).not.toBeNull();
        expect(door.dataset.nav).toBe('atrium');
        expect(door.querySelector('.gz-name').textContent).toBe('Atrium');
        // The pavilion renders complete before any lazy detail arrives
        expect(door.querySelector('.atrium-door-detail').textContent.length).toBeGreaterThan(0);

        const strip = container.querySelector('.portal-arch-sol');
        expect(strip).not.toBeNull();
        expect(strip.dataset.nav).toBe('sol');

        portal.destroy();
        container.remove();
    });

    it('clicking the Atrium arch navigates to the Atrium', () => {
        const { portal, container, onNavigate } = makePortal();
        container.querySelector('.portal-arch-atrium').click();
        expect(onNavigate).toHaveBeenCalledWith('atrium');
        portal.destroy();
        container.remove();
    });

    it('keeps a simple, timeless Atrium caption across re-entries', async () => {
        const { portal, container } = makePortal();

        const before = container.querySelector('.atrium-door-detail').textContent;
        expect(before).toBe('philosophy & history');

        // The populate hook is invoked at idle and on router re-entry; it
        // must NOT deepen the caption into today's featured sequence.
        await portal._populateAtriumDoor();
        expect(container.querySelector('.atrium-door-detail').textContent)
            .toBe('philosophy & history');

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
