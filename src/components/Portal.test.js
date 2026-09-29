/**
 * RISE Home: the Oracle. One object, one key (ROLL); a reading rises with
 * ENTER · ROLL AGAIN · ADJUST; every room is one Menu away.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Portal } from './Portal.js';
import { validateJevRecommendation } from '../app/jev-reading.js';

const portalCss = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'Portal.css'),
    'utf8'
);

beforeEach(() => {
    // Home keeps its result for the tab's session; each test starts clean.
    sessionStorage.clear();
    vi.restoreAllMocks();
    // Reduced motion: the sink and rise are short fades, so tests run fast.
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
});

afterEach(() => {
    delete window.matchMedia;
    document.body.innerHTML = '';
});

function makePortal(options = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onNavigate = vi.fn();
    const portal = new Portal(container, { onNavigate, ...options });
    return { portal, container, onNavigate };
}

const keys = container => [...container.querySelectorAll('.oracle-keys button')].map(key => key.textContent.trim());

async function roll(container) {
    container.querySelector('[data-oracle="roll"]').click();
    await vi.waitFor(() => expect(container.querySelector('[data-oracle="enter"]')).not.toBeNull(), { timeout: 3000 });
}

describe('Home, waiting', () => {
    it('asks what you will encounter and offers one key', () => {
        const { portal, container } = makePortal();
        expect(container.querySelector('h1').textContent).toBe('What will you encounter?');
        expect(keys(container)).toEqual(['Roll']);
        expect(container.querySelector('.oracle-intent').hidden).toBe(true);
        expect(container.querySelector('[data-oracle="ask-open"]').hidden).toBe(true);
        expect(container.querySelector('.oracle-answer').hidden).toBe(true);
        portal.destroy();
    });

    it('draws only while Home is the room shown', () => {
        const { portal } = makePortal();
        const start = vi.spyOn(portal.object, 'start');
        const stop = vi.spyOn(portal.object, 'stop');
        portal.activate();
        expect(start).toHaveBeenCalledOnce();
        portal.deactivate();
        expect(stop).toHaveBeenCalledOnce();
        portal.destroy();
    });
});

describe('a roll', () => {
    it('rises in the window with its title, author and section, and one plan line', async () => {
        const { portal, container } = makePortal();
        await roll(container);
        const { decision } = portal.result;
        expect(() => validateJevRecommendation(decision)).not.toThrow();
        expect(decision.model).toBe('rise/roll-1');
        expect(container.querySelector('.oracle-answer').hidden).toBe(false);
        expect(container.querySelector('.oracle-answer-title').textContent).toBe(portal.result.title);
        expect(container.querySelector('.oracle-answer-meta').textContent).toMatch(/ section$/u);
        expect(container.querySelector('.oracle-answer-plan').textContent.split(' · ')).toHaveLength(4);
        expect(keys(container)).toEqual(['Enter', 'Roll again', 'Adjust']);
        expect(container.querySelector('[data-oracle-status]').textContent).toContain(portal.result.title);
        portal.destroy();
    });

    it('opens the way to asking only after a first roll', async () => {
        const { portal, container } = makePortal();
        const link = container.querySelector('[data-oracle="ask-open"]');
        expect(link.hidden).toBe(true);
        await roll(container);
        expect(link.hidden).toBe(false);
        expect(link.textContent).toBe('or ask for something specific');
        portal.destroy();
    });

    it('rolls again to a different work and temper', async () => {
        const { portal, container } = makePortal();
        await roll(container);
        const first = portal.result;
        container.querySelector('[data-oracle="roll"]').click();
        await vi.waitFor(() => expect(portal.result).not.toBe(first), { timeout: 3000 });
        await vi.waitFor(() => expect(portal.state).toBe('result'), { timeout: 3000 });
        expect(portal.result.decision.workId).not.toBe(first.decision.workId);
        expect(portal.result.temper).not.toBe(first.temper);
        portal.destroy();
    });

    it('ENTER plays the rolled reading, and ADJUST opens it to change', async () => {
        const onLaunchJevReading = vi.fn().mockResolvedValue(undefined);
        const onAdjustReading = vi.fn().mockResolvedValue(undefined);
        const { portal, container } = makePortal({ onLaunchJevReading, onAdjustReading });
        await roll(container);
        container.querySelector('[data-oracle="enter"]').click();
        await vi.waitFor(() => expect(onLaunchJevReading).toHaveBeenCalledWith(portal.result.decision));
        await vi.waitFor(() => expect(container.querySelector('[data-oracle="adjust"]').disabled).toBe(false));
        container.querySelector('[data-oracle="adjust"]').click();
        await vi.waitFor(() => expect(onAdjustReading).toHaveBeenCalledWith(portal.result.decision));
        portal.destroy();
    });

    it('holds its keys while a reading opens, and says so if it cannot', async () => {
        let fail;
        const onLaunchJevReading = vi.fn(() => new Promise((_, reject) => { fail = reject; }));
        const { portal, container } = makePortal({ onLaunchJevReading });
        await roll(container);
        container.querySelector('[data-oracle="enter"]').click();
        await vi.waitFor(() => expect(container.querySelector('[data-oracle="enter"]').getAttribute('aria-busy')).toBe('true'));
        container.querySelector('[data-oracle="enter"]').click();
        expect(onLaunchJevReading).toHaveBeenCalledOnce();
        fail(new Error('edition missing'));
        await vi.waitFor(() => expect(container.querySelector('.oracle-alert').hidden).toBe(false));
        expect(container.querySelector('.portal-alert-message').textContent).toBe('edition missing');
        expect(container.querySelector('[data-oracle="enter"]').disabled).toBe(false);
        portal.destroy();
    });

    it('recovers when the roll cannot load, and keeps what was showing', async () => {
        const { portal, container } = makePortal();
        await roll(container);
        const shown = portal.result;
        portal.tools = null;
        vi.spyOn(portal, 'loadTools').mockRejectedValueOnce(new Error('chunk failed'));
        container.querySelector('[data-oracle="roll"]').click();
        await vi.waitFor(() => expect(container.querySelector('.oracle-alert').hidden).toBe(false));
        expect(portal.state).toBe('result');
        expect(portal.result).toBe(shown);
        expect(container.querySelector('[data-oracle="roll"]').disabled).toBe(false);
        expect(container.querySelector('.portal-alert-message').textContent).toBe('chunk failed');
        portal.destroy();
    });

    it('is still there after navigating away and back, or a reload', async () => {
        const first = makePortal();
        await roll(first.container);
        const { title, decision } = first.portal.result;
        first.portal.destroy();

        const second = makePortal();
        await vi.waitFor(() => expect(second.portal.state).toBe('result'));
        expect(second.portal.result.decision).toEqual(decision);
        expect(second.container.querySelector('.oracle-answer-title').textContent).toBe(title);
        expect(second.container.querySelector('[data-oracle="ask-open"]').hidden).toBe(false);
        second.portal.destroy();
    });

    it('drops a stored result that no longer passes admission', async () => {
        sessionStorage.setItem('rise-oracle-v1', JSON.stringify({ rolled: true, result: { decision: { model: 'forged' }, source: 'roll' } }));
        const { portal, container } = makePortal();
        await vi.waitFor(() => expect(JSON.parse(sessionStorage.getItem('rise-oracle-v1')).result).toBeUndefined());
        expect(portal.state).toBe('idle');
        expect(keys(container)).toEqual(['Roll']);
        portal.destroy();
    });
});

describe('the rest of Home', () => {
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
    });

    it('offers a disclosed preset scene sample and a separate live RISE link', async () => {
        const onLaunchJevSample = vi.fn().mockResolvedValue(undefined);
        const { portal, container } = makePortal({ demoMode: true, onLaunchJevSample });
        expect(container.textContent).toContain('preset');
        expect(container.textContent).toContain('No live RISE request');
        expect(container.querySelector('#oracle-form')).toBeNull();
        expect(portal.object).toBeNull();
        expect(container.querySelector('#portal-jev-demo').textContent).toContain('George Eliot');
        expect(container.querySelector('#portal-jev-demo a[href="https://standardebooks.org/ebooks/george-eliot/middlemarch"]')).not.toBeNull();
        container.querySelector('#jev-scene-demo-start').click();
        await vi.waitFor(() => expect(onLaunchJevSample).toHaveBeenCalledOnce());
        portal.destroy();
    });

    it('the Menu holds every room, starts at Home, keeps focus and closes on Escape', () => {
        const { portal, container, onNavigate } = makePortal();
        const header = container.querySelector('.sl-header');
        const toggle = container.querySelector('.portal-menu-toggle');
        toggle.click();
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(container.querySelector('.portal').classList.contains('is-menu-open')).toBe(true);

        const items = [...container.querySelectorAll('.portal-nav button')];
        expect(items[0].textContent.trim()).toBe('Home');
        expect(items[0].getAttribute('aria-current')).toBe('page');
        expect(document.activeElement).toBe(items[0]);
        expect([...container.querySelectorAll('.portal-nav [data-nav]')].map(item => item.dataset.nav))
            .toEqual(['create', 'library', 'vault', 'workshop', 'chamber', 'chapel', 'scriptorium', 'visual-lab', 'curia']);

        const last = items[items.length - 1];
        last.focus();
        last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(toggle);
        toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(last);
        last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(header.classList.contains('is-open')).toBe(false);
        expect(document.activeElement).toBe(toggle);

        toggle.click();
        container.querySelector('.portal-nav [data-nav="curia"]').click();
        expect(onNavigate).toHaveBeenCalledWith('curia');
        expect(header.classList.contains('is-open')).toBe(false);
        portal.destroy();
    });

    it('opens Guide and Settings from the Menu', () => {
        const { portal, container } = makePortal();
        for (const [action, event] of [['guide', 'rise-open-guide'], ['settings', 'rise-open-settings']]) {
            const opened = vi.fn();
            window.addEventListener(event, opened, { once: true });
            container.querySelector(`.portal-nav [data-action="${action}"]`).click();
            expect(opened, action).toHaveBeenCalledOnce();
        }
        expect(container.querySelector('.portal-nav [data-action="settings"]').getAttribute('aria-label')).toBe('Settings');
        portal.destroy();
    });

    it('keeps Privacy and Terms posted, and nothing else in the footer', () => {
        const { portal, container } = makePortal();
        const footer = container.querySelector('.portal-footer');
        expect([...footer.querySelectorAll('a, button')].map(link => link.textContent.trim())).toEqual(['Privacy', 'Terms']);
        expect(footer.querySelector('a[href="/privacy.html"]')).not.toBeNull();
        expect(footer.querySelector('a[href="/terms.html"]')).not.toBeNull();
        portal.destroy();
    });

    it('names the lockup as one image and keeps one main landmark', () => {
        const { portal, container } = makePortal();
        const lockup = container.querySelector('.sl-lockup');
        expect(lockup.getAttribute('role')).toBe('img');
        expect(lockup.getAttribute('aria-label')).toBe('SyberLabs RISE');
        expect(container.querySelector('main .sl-header, main .portal-footer')).toBeNull();
        expect(container.querySelectorAll('main')).toHaveLength(1);
        portal.destroy();
    });

    it('names every control and uses no glyph or emoji text', async () => {
        const { portal, container } = makePortal();
        await roll(container);
        expect(container.querySelector('.sl-wordmark').textContent).toBe('SYBERLABS / RISE');
        expect(container.textContent).not.toMatch(/[←-⯿\u{1F300}-\u{1FAFF}]/u);
        for (const button of container.querySelectorAll('button')) {
            const named = button.getAttribute('aria-label') || button.textContent.trim();
            expect(named, button.outerHTML).not.toBe('');
        }
        portal.destroy();
    });

    it('offers no door to a room that is gone', () => {
        const { portal, container } = makePortal();
        for (const gone of ['atrium', 'sol']) {
            expect(container.querySelector(`[data-nav="${gone}"]`), `a door still opens onto ${gone}`).toBeNull();
        }
        portal.destroy();
    });

    it('styles the page around the object from the SyberLabs tokens only', () => {
        expect(portalCss).not.toMatch(/gradient/);
        expect(portalCss).toMatch(/var\(--sy-accent-rise\)/);
        expect(portalCss).not.toMatch(/font-size:\s*(?:[0-9]|1[01])px/);
    });
});
