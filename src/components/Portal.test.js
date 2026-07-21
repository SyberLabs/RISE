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

        const door = container.querySelector('.portal-atrium-door');
        expect(door).not.toBeNull();
        expect(door.dataset.nav).toBe('atrium');
        expect(door.querySelector('.atrium-door-name').textContent).toBe('Atrium');
        // The door renders complete before any lazy detail arrives
        expect(door.querySelector('.atrium-door-detail').textContent.length).toBeGreaterThan(0);

        const strip = container.querySelector('.portal-sol-strip');
        expect(strip).not.toBeNull();
        expect(strip.dataset.nav).toBe('sol');

        portal.destroy();
        container.remove();
    });

    it('clicking the Atrium door navigates to the Atrium', () => {
        const { portal, container, onNavigate } = makePortal();
        container.querySelector('.portal-atrium-door').click();
        expect(onNavigate).toHaveBeenCalledWith('atrium');
        portal.destroy();
        container.remove();
    });

    it('deepens the Atrium door with today\'s featured sequence at idle', async () => {
        const { portal, container } = makePortal();

        // The populate hook is what idle scheduling invokes; call it
        // directly so the test does not depend on rIC timing
        await portal._populateAtriumDoor();

        const detail = container.querySelector('.atrium-door-detail').textContent;
        expect(detail).toMatch(/^today · .+/);
        expect(container.querySelector('.portal-atrium-door').getAttribute('aria-label'))
            .toContain("today's sequence");

        portal.destroy();
        container.remove();
    });

    it('shows the current window and its context, live', () => {
        const { portal, container } = makePortal();
        const window_ = getWindowAt(new Date());

        expect(container.querySelector('.sol-strip-window').textContent).toBe(window_.name);
        expect(container.querySelector('.sol-strip-detail').textContent).toContain(window_.context);
        expect(container.querySelector('.sol-strip-time').textContent).toMatch(/\d/);

        portal.destroy();
        container.remove();
    });

    it('reflects the My Day plan for the current window', () => {
        const window_ = getWindowAt(new Date());
        MemoryCore.setSolPlanEntry(window_.key, { kind: 'sol', id: 'sol-arch-cosmological' });

        const { portal, container } = makePortal();
        expect(container.querySelector('.sol-strip-detail').textContent)
            .toContain('from your plan · Cosmological Motivation');

        portal.destroy();
        container.remove();
    });

    it('clicking the strip navigates to SOL', () => {
        const { portal, container, onNavigate } = makePortal();
        container.querySelector('.portal-sol-strip').click();
        expect(onNavigate).toHaveBeenCalledWith('sol');
        portal.destroy();
        container.remove();
    });
});
