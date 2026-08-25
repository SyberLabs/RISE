/**
 * The Portal, after two rooms were removed.
 *
 * This file tested the SOL strip — the hour, the current window, the Earth
 * turning in its arch. The Solarium is deleted and so are those; what is left
 * is the nav, and one assertion that outlived both rooms and now covers them
 * together, because each of them left its door standing.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Portal } from './Portal.js';

const portalCss = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'Portal.css'),
    'utf8'
);

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
        const { portal, container, onNavigate } = makePortal();

        const primary = [...container.querySelectorAll('.nav-primary .nav-item')]
            .map(el => el.dataset.nav);
        expect(primary).toEqual(['chamber']);

        const secondary = container.querySelectorAll('.nav-secondary .nav-item');
        expect(secondary).toHaveLength(3);
        expect([...secondary].map(el => el.dataset.nav)).toEqual(['vault', 'library', 'workshop']);
        const tryRise = container.querySelector('.nav-secondary .nav-try');
        expect(tryRise).toBeTruthy();
        expect(tryRise.dataset.nav).toBe('keystones');
        expect(container.querySelectorAll('[data-nav="keystones"]')).toHaveLength(1);
        tryRise.click();
        expect(onNavigate).toHaveBeenCalledWith('keystones');

        portal.destroy();
        container.remove();
    });

    it('places Curia and Scriptorium as orbs at the start, Chapel as an orb at the end', () => {
        const { portal, container, onNavigate } = makePortal();
        const start = container.querySelector('.portal-orbs-start');
        expect(start).toBeTruthy();
        expect([...start.querySelectorAll('[data-nav]')].map(el => el.dataset.nav))
            .toEqual(['curia', 'scriptorium']);
        const chapel = container.querySelector('.portal-orb[data-nav="chapel"]');
        expect(chapel).toBeTruthy();
        expect(start.contains(chapel)).toBe(false);
        expect(container.querySelector('.chapel-lamp-name')).toBeNull();
        chapel.click();
        expect(onNavigate).toHaveBeenCalledWith('chapel');

        const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Portal.css'), 'utf8');
        expect(css).toMatch(/\.portal-orb\s*\{[^}]*--color-accent/s);
        expect(css).toMatch(/\.portal-orbs-start\s*\{[^}]*left:/s);
        expect(css).toMatch(/\.portal-orb\.portal-chapel-lamp\s*\{[^}]*right:/s);

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

    it('scopes a token-driven layered seal to Try RISE', () => {
        expect(portalCss).toMatch(/\.portal-nav\s+\.nav-secondary\s+\.nav-try\s*\{/);
        expect(portalCss).toMatch(/\.nav-try::before/);
        expect(portalCss).toMatch(/\.nav-try::after/);
        expect(portalCss).toMatch(/pointer-events:\s*none/);
        expect(portalCss).toMatch(/var\(--color-accent-rgb\)/);
        expect(portalCss).toMatch(/radial-gradient/);
        expect(portalCss).toMatch(/inset\s+0/);
        expect(portalCss).toMatch(/\.nav-try:focus-visible/);
        // The seal's distinctive texture layer is scoped to Try RISE. (A
        // blanket `not /nav-item::before/` guard is unsound here: an
        // unrelated, pre-existing .nav-item::before sheen lives elsewhere in
        // this stylesheet and is intentionally left untouched.)
        expect(portalCss).toMatch(/\.nav-try::after[^}]*repeating-radial-gradient/s);
    });

});
