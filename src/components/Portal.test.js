/**
 * RISE Home (the Portal) on the SyberLabs design system: one primary action,
 * one secondary text link, a plain-word header nav.
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

beforeEach(() => {
    localStorage.removeItem('rise_sol_plan_v1');
    localStorage.removeItem('rise_workshop_v1');
    vi.restoreAllMocks();
});

function makePortal(options = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onNavigate = vi.fn();
    const portal = new Portal(container, { onNavigate, ...options });
    return { portal, container, onNavigate };
}

describe('Portal', () => {
    it('offers a disclosed preset scene sample and a separate live Jev link', async () => {
        const onLaunchJevSample = vi.fn().mockResolvedValue(undefined);
        const { portal, container } = makePortal({ demoMode: true, onLaunchJevSample });
        expect(container.textContent).toContain('preset');
        expect(container.textContent).toContain('No live Jev request');
        expect(container.querySelector('#portal-jev-form')).toBeNull();
        expect(container.querySelector('a[href="/"]')).not.toBeNull();
        expect(container.querySelector('#portal-jev-demo').textContent).toContain('George Eliot');
        expect(container.querySelector('#portal-jev-demo a[href="https://standardebooks.org/ebooks/george-eliot/middlemarch"]')).not.toBeNull();
        container.querySelector('#jev-scene-demo-start').click();
        await vi.waitFor(() => expect(onLaunchJevSample).toHaveBeenCalledOnce());
        portal.destroy();
    });

    it('starts one first reading while the launch is pending and keeps the Jev request available', async () => {
        let finishLaunch;
        const onLaunchFirstRead = vi.fn(() => new Promise(resolve => { finishLaunch = resolve; }));
        const { portal, container } = makePortal({ onLaunchFirstRead });

        const buttons = container.querySelectorAll('button.portal-first-read');
        expect(buttons).toHaveLength(1);
        expect(buttons[0].textContent).toContain('Meditations · Marcus Aurelius');
        expect(container.querySelector('#portal-jev-form')).not.toBeNull();
        buttons[0].click();
        buttons[0].click();
        expect(onLaunchFirstRead).toHaveBeenCalledTimes(1);
        expect(buttons[0].disabled).toBe(true);

        finishLaunch();
        await vi.waitFor(() => expect(buttons[0].disabled).toBe(false));
        portal.destroy();
        container.remove();
    });

    it('asks what to read and keeps the home to one primary action', () => {
        const { portal, container, onNavigate } = makePortal();
        expect(container.querySelector('h1').textContent.trim()).toBe('What would you like to read?');
        const intent = container.querySelector('#portal-jev-intent');
        expect(intent.maxLength).toBe(240);
        expect(intent.placeholder).toBe('Something reflective and slow, with quiet visuals…');
        expect(container.querySelector('label[for="portal-jev-intent"]')).not.toBeNull();
        expect(container.querySelector('#portal-jev-help').textContent)
            .toBe('Jev chooses from the released Library and sets up the reader.');
        const primary = container.querySelectorAll('.portal-primary');
        expect(primary).toHaveLength(1);
        expect(primary[0].textContent.trim()).toBe('Ask Jev');
        expect(container.querySelector('[name="portal-jev-mode"]')).toBeNull();
        expect(onNavigate).not.toHaveBeenCalled();
        portal.destroy();
        container.remove();
    });

    it('never submits an empty intent and says why', () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('no'); });
        const { portal, container, onNavigate } = makePortal();
        const form = container.querySelector('#portal-jev-form');
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(onNavigate).not.toHaveBeenCalled();
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(container.querySelector('.portal-jev-submit').disabled).toBe(false);
        const intent = container.querySelector('#portal-jev-intent');
        expect(intent.getAttribute('aria-invalid')).toBe('true');
        expect(container.querySelector('#portal-jev-help').textContent).toContain('Tell Jev what you’d like to read.');
        intent.value = 'Something slow';
        intent.dispatchEvent(new Event('input', { bubbles: true }));
        expect(intent.getAttribute('aria-invalid')).toBe('false');
        portal.destroy();
        container.remove();
    });

    it('reads session and audio capabilities from its owner', () => {
        const audio = { playClick: vi.fn() };
        const { portal, container } = makePortal({
            getAudioEngine: () => audio,
            getCurrentSession: () => ({ title: 'Meditations' })
        });

        const continuation = container.querySelector('.portal-continue');
        expect(continuation.hidden).toBe(false);
        expect(continuation.textContent).toContain('Meditations');

        container.querySelector('[data-nav="library"]').click();
        expect(audio.playClick).toHaveBeenCalledOnce();

        portal.destroy();
        container.remove();
    });

    it('header nav is Create, Library, Sequences, Compose and a labelled Settings button', () => {
        const { portal, container, onNavigate } = makePortal();
        const nav = container.querySelector('.sl-header .portal-nav');
        const links = [...nav.querySelectorAll('[data-nav]')];
        expect(links.map(el => el.textContent.trim())).toEqual(['Create', 'Library', 'Sequences', 'Compose']);
        expect(links.map(el => el.dataset.nav)).toEqual(['create', 'library', 'vault', 'workshop']);
        const settings = nav.querySelector('[data-action="settings"]');
        expect(settings.getAttribute('aria-label')).toBe('Settings');
        const opened = vi.fn();
        window.addEventListener('rise-open-settings', opened, { once: true });
        settings.click();
        expect(opened).toHaveBeenCalledOnce();
        links[2].click();
        expect(onNavigate).toHaveBeenCalledWith('vault');
        portal.destroy();
        container.remove();
    });

    it('the phone Menu opens a sheet that starts at Home, keeps focus and closes on Escape', () => {
        const { portal, container } = makePortal();
        const header = container.querySelector('.sl-header');
        const toggle = container.querySelector('.portal-menu-toggle');
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        toggle.click();
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(header.classList.contains('is-open')).toBe(true);
        expect(container.querySelector('.portal').classList.contains('is-menu-open')).toBe(true);

        const items = [...container.querySelectorAll('.portal-nav button')];
        expect(items[0].textContent.trim()).toBe('Home');
        expect(items[0].getAttribute('aria-current')).toBe('page');
        expect(document.activeElement).toBe(items[0]);

        // Tab from the last item wraps to the toggle; Shift+Tab from the toggle wraps back.
        const last = items[items.length - 1];
        last.focus();
        last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(toggle);
        toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(last);

        last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(header.classList.contains('is-open')).toBe(false);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(toggle);
        portal.destroy();
        container.remove();
    });

    it('closes the phone Menu when a destination is chosen', () => {
        const { portal, container, onNavigate } = makePortal();
        container.querySelector('.portal-menu-toggle').click();
        container.querySelector('.portal-nav [data-nav="library"]').click();
        expect(onNavigate).toHaveBeenCalledWith('library');
        expect(container.querySelector('.sl-header').classList.contains('is-open')).toBe(false);
        portal.destroy();
        container.remove();
    });

    it('names the lockup as one image', () => {
        const { portal, container } = makePortal();
        const lockup = container.querySelector('.sl-lockup');
        expect(lockup.getAttribute('role')).toBe('img');
        expect(lockup.getAttribute('aria-label')).toBe('SyberLabs RISE');
        // Header and footer sit beside main, not inside it, so they keep their landmarks.
        expect(container.querySelector('main .sl-header, main .portal-footer')).toBeNull();
        expect(container.querySelectorAll('main')).toHaveLength(1);
        portal.destroy();
        container.remove();
    });

    it('shows the SyberLabs / RISE lockup and no glyph or emoji controls', () => {
        const { portal, container } = makePortal();
        expect(container.querySelector('.sl-wordmark').textContent).toBe('SYBERLABS / RISE');
        expect(container.querySelector('.portal-orb')).toBeNull();
        expect(container.querySelector('.portal-sigil-vessel')).toBeNull();
        expect(container.querySelector('video')).toBeNull();
        expect(container.textContent).not.toMatch(/[←-⯿\u{1F300}-\u{1FAFF}]/u);
        for (const button of container.querySelectorAll('button')) {
            const named = button.getAttribute('aria-label') || button.textContent.trim();
            expect(named, button.outerHTML).not.toBe('');
        }
        portal.destroy();
        container.remove();
    });

    it('keeps the footer plain and every room reachable from Home', () => {
        const { portal, container, onNavigate } = makePortal();
        const footer = container.querySelector('.portal-footer');
        const moreList = footer.querySelector('.portal-more-list');
        const visible = [...footer.querySelectorAll('.portal-footer-link')]
            .filter(link => !moreList.contains(link))
            .map(link => link.textContent.trim());
        expect(visible).toEqual(['Guide', 'Short readings', 'Reader setup', 'More', 'Privacy', 'Terms']);

        const more = footer.querySelector('.portal-more-toggle');
        expect(moreList.hidden).toBe(true);
        more.click();
        expect(more.getAttribute('aria-expanded')).toBe('true');
        expect(moreList.hidden).toBe(false);
        moreList.querySelector('button').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(moreList.hidden).toBe(true);
        expect(document.activeElement).toBe(more);
        more.click();

        for (const room of ['chamber', 'chapel', 'scriptorium', 'curia']) {
            const door = container.querySelector(`.portal-footer [data-nav="${room}"]`);
            expect(door, room).not.toBeNull();
            door.click();
            expect(onNavigate).toHaveBeenLastCalledWith(room);
        }
        expect(container.querySelector('a[href="/privacy.html"]')).not.toBeNull();
        expect(container.querySelector('a[href="/terms.html"]')).not.toBeNull();
        portal.destroy();
        container.remove();
    });

    it('offers no door to a room that is gone', () => {
        const { portal, container } = makePortal();
        for (const gone of ['atrium', 'sol']) {
            expect(container.querySelector(`[data-nav="${gone}"]`),
                `a door still opens onto ${gone}`).toBeNull();
        }
        portal.destroy();
        container.remove();
    });

    it('styles Home from the SyberLabs tokens only', () => {
        expect(portalCss).not.toMatch(/gradient/);
        expect(portalCss).toMatch(/var\(--sy-accent-rise\)/);
        expect(portalCss).not.toMatch(/font-size:\s*(?:[0-9]|1[01])px/);
    });

});
