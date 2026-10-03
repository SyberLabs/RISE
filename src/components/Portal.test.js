/**
 * RISE Home: the night library. A sky of works behind a text panel: Roll a
 * reading, or pick a star. A result names the text, the mood and the passage,
 * each with its own Redraw; Start reading plays it. Every room is one Menu away.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Portal } from './Portal.js';
import { openingLines, validateJevRecommendation } from '../app/jev-reading.js';
import { composeRoll, rollReading, TEMPERS } from '../core/roll.js';
import { SECTION_WORDS } from '../core/jev-describe.js';

// The sky and its data are built elsewhere (SKY and CORE); Home codes against
// their contracts. The stand-in records what Home asks of it.
const sky = vi.hoisted(() => ({ instances: [], fail: false }));
const SKY = vi.hoisted(() => Object.freeze({
    stars: [{ workId: 'middlemarch', title: 'Middlemarch', author: 'George Eliot', group: 'prose', x: 70, y: 50 }],
    links: [],
    groups: [{ id: 'prose', label: 'Prose and wisdom', x: 80, y: 85 }]
}));
vi.mock('./night-library/NightSky.js', () => ({
    NightSky: class {
        constructor(container, options) {
            if (sky.fail) throw new Error('no sky here');
            Object.assign(this, { container, options });
            for (const method of ['start', 'stop', 'flare', 'setBusy', 'destroy']) this[method] = vi.fn();
            sky.instances.push(this);
        }
    }
}));
vi.mock('../core/library-sky.js', () => ({ librarySky: () => SKY }));
// roll.js and jev-reading.js are real; CORE extends them. Home is held to the
// call it makes (rollReading's kept parts) and to the lines it shows.
vi.mock('../core/roll.js', async importOriginal => {
    const actual = await importOriginal();
    return { ...actual, rollReading: vi.fn(actual.rollReading) };
});
const LINES = 'My children, latest born to Cadmus old,\nWhy sit ye here as suppliants, in your hands';
vi.mock('../app/jev-reading.js', async importOriginal => ({
    ...(await importOriginal()),
    openingLines: vi.fn(async () => LINES)
}));

const portalCss = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'Portal.css'),
    'utf8'
);

beforeEach(() => {
    sessionStorage.clear();
    sky.instances.length = 0;
    sky.fail = false;
    vi.mocked(rollReading).mockClear();
    vi.mocked(openingLines).mockClear();
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

const hook = (container, name) => container.querySelector(`[data-home="${name}"]`);
const words = node => node.textContent.replace(/\s+/gu, ' ').trim();
const actions = container => [...container.querySelectorAll('.home-actions button')].map(words);

async function roll(container) {
    hook(container, 'roll').click();
    await vi.waitFor(() => expect(hook(container, 'enter')).not.toBeNull(), { timeout: 3000 });
}

/** A rolled classic: every classic has more than one division, so all three parts can be redrawn. */
const classic = (workId, temper = 'revel') => ({
    temper,
    decision: composeRoll({ temper: TEMPERS.find(t => t.id === temper), workId, section: 'first' })
});

async function withSky(portal) {
    portal.activate();
    await vi.waitFor(() => expect(sky.instances).toHaveLength(1));
    return sky.instances[0];
}

describe('Home, waiting', () => {
    it('says what the sky is, offers a roll and asking from the start, and needs no sky to do it', () => {
        const { portal, container } = makePortal();
        expect(container.querySelector('h1').textContent).toBe('Every star is a text you can read.');
        expect(words(container.querySelector('.home-lede'))).toBe(
            'Roll, and RISE picks one with a mood to read it in: its pace, imagery and sound. Or choose a star yourself.');
        expect(actions(container)).toEqual(['Roll a reading', 'Ask for one']);
        // One solid key on the screen; asking is a line button beside it.
        expect([...container.querySelectorAll('.home .btn-primary')]).toEqual([hook(container, 'roll')]);
        expect(hook(container, 'ask-open').classList.contains('btn-secondary')).toBe(true);
        for (const absent of ['enter', 'adjust', 'redraw-text']) expect(hook(container, absent)).toBeNull();
        // The orb is gone with its plate and keys.
        expect(container.querySelector('canvas.oracle-canvas, .oracle-plate, .oracle-key')).toBeNull();
        expect(sky.instances).toHaveLength(0);
        portal.destroy();
    });

    it('offers today\'s poem as a quiet link that opens the Today view', () => {
        const { portal, container, onNavigate } = makePortal();
        const link = hook(container, 'today');
        expect(words(link)).toBe('Read today\'s poem');
        expect(link.classList.contains('btn-ghost')).toBe(true);
        link.click();
        expect(onNavigate).toHaveBeenCalledWith('today');
        portal.destroy();
    });

    it('lays the sky in after Home shows, and draws it only while Home is the room shown', async () => {
        const { portal, container } = makePortal();
        const night = await withSky(portal);
        expect(night.container).toBe(container.querySelector('.home-sky'));
        expect(night.options.sky).toBe(SKY);
        expect(night.start).toHaveBeenCalledOnce();
        portal.deactivate();
        expect(night.stop).toHaveBeenCalledOnce();
        portal.activate();
        expect(night.start).toHaveBeenCalledTimes(2);
        expect(sky.instances).toHaveLength(1);
        portal.destroy();
        expect(night.destroy).toHaveBeenCalledOnce();
    });

    it('still rolls when the sky cannot load', async () => {
        // The sky's data refuses (librarySky throws on an ungrouped classic) the same way.
        sky.fail = true;
        const { portal, container } = makePortal();
        portal.activate();
        await new Promise(resolve => setTimeout(resolve, 50));
        await roll(container);
        expect(portal.state).toBe('result');
        expect(container.querySelector('.home-alert').hidden).toBe(true);
        portal.destroy();
    });
});

describe('a roll', () => {
    it('names the text, the mood and the passage, each with its own Redraw', async () => {
        vi.mocked(rollReading).mockImplementationOnce(() => classic('oedipus-rex'));
        const { portal, container } = makePortal();
        await roll(container);
        const { decision, temper } = portal.result;
        expect(() => validateJevRecommendation(decision)).not.toThrow();
        expect(decision.model).toBe('rise/roll-1');
        const Temper = temper[0].toUpperCase() + temper.slice(1);
        expect(words(container.querySelector('.home-mood'))).toBe(Temper);
        expect(container.querySelector('h1').textContent).toBe(portal.result.title);
        expect(words(container.querySelector('.home-byline')))
            .toBe(`${portal.result.author}, from the ${SECTION_WORDS[decision.config.section]}`);

        const parts = [...container.querySelectorAll('.home-part')];
        expect(parts.map(part => words(part.querySelector('.home-part-label')))).toEqual(['The text', 'The mood', 'The passage']);
        expect(words(parts[0].querySelector('.home-part-value'))).toBe(`${portal.result.title} · ${portal.result.author}`);
        const plan = portal.result.plan.join(', ');
        expect(words(parts[1].querySelector('.home-part-value'))).toBe(`${Temper} ${plan[0].toUpperCase()}${plan.slice(1)}`);
        expect(parts.map(part => part.querySelector('button').getAttribute('aria-label')))
            .toEqual(['Redraw the text', 'Redraw the mood', 'Redraw the passage']);
        expect(parts.map(part => part.querySelector('button').dataset.home)).toEqual(['redraw-text', 'redraw-mood', 'redraw-passage']);

        // The passage is the opening of the division the reading will open, verse kept as lines.
        expect(openingLines).toHaveBeenCalledWith(decision);
        await vi.waitFor(() => expect(parts[2].querySelector('blockquote')?.textContent).toBe(LINES));

        expect(actions(container)).toEqual(['Start reading', 'Roll again', 'Adjust first']);
        expect([...container.querySelectorAll('.home .btn-primary')]).toEqual([hook(container, 'enter')]);
        expect(hook(container, 'roll').classList.contains('btn-secondary')).toBe(true);
        expect(hook(container, 'adjust').classList.contains('btn-ghost')).toBe(true);
        expect(hook(container, 'ask-open').textContent.trim()).toBe('Ask for something specific instead');
        // The status line speaks it all for assistive technology.
        const spoken = container.querySelector('[data-home-status]').textContent;
        expect(spoken).toContain(portal.result.title);
        expect(spoken).toContain(portal.result.meta);
        for (const part of portal.result.plan) expect(spoken).toContain(part);
        portal.destroy();
    });

    it('holds the passage open while its lines load, and leaves them out if they cannot be read', async () => {
        let fail;
        vi.mocked(openingLines).mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
        vi.mocked(rollReading).mockImplementationOnce(() => classic('middlemarch'));
        const { portal, container } = makePortal();
        await roll(container);
        const passage = container.querySelectorAll('.home-part')[2];
        expect(passage.querySelector('.home-passage-loading')).not.toBeNull();
        fail(new Error('edition unavailable'));
        await vi.waitFor(() => expect(passage.querySelector('.home-passage-loading')).toBeNull());
        expect(passage.querySelector('blockquote')).toBeNull();
        expect(hook(container, 'redraw-passage')).not.toBeNull();
        expect(container.querySelector('.home-alert').hidden).toBe(true);
        portal.destroy();
    });

    it('marks the roll busy, quiets the sky while it rolls, and lights the chosen star', async () => {
        const { portal, container } = makePortal();
        const night = await withSky(portal);
        hook(container, 'roll').click();
        expect(portal.state).toBe('rolling');
        expect(hook(container, 'roll').getAttribute('aria-busy')).toBe('true');
        expect(night.setBusy).toHaveBeenLastCalledWith(true);
        await vi.waitFor(() => expect(portal.state).toBe('result'), { timeout: 3000 });
        expect(night.setBusy).toHaveBeenLastCalledWith(false);
        expect(night.flare).toHaveBeenLastCalledWith(portal.result.decision.workId);
        expect(document.activeElement).toBe(hook(container, 'enter'));
        portal.destroy();
    });

    it('rolls again to a different work and temper', async () => {
        const { portal, container } = makePortal();
        await roll(container);
        const first = portal.result;
        hook(container, 'roll').click();
        await vi.waitFor(() => expect(portal.result).not.toBe(first), { timeout: 3000 });
        expect(rollReading).toHaveBeenLastCalledWith({ previous: first });
        expect(portal.result.decision.workId).not.toBe(first.decision.workId);
        expect(portal.result.temper).not.toBe(first.temper);
        portal.destroy();
    });

    it('redraws one part and keeps the other two', async () => {
        for (const [workId, temper] of [['oedipus-rex', 'revel'], ['middlemarch', 'revel'], ['middlemarch', 'vigil'], ['middlemarch', 'vigil']]) {
            vi.mocked(rollReading).mockImplementationOnce(() => classic(workId, temper));
        }
        const { portal, container } = makePortal();
        await roll(container);
        const kept = previous => ({
            'redraw-text': { previous, temper: previous.temper, section: previous.decision.config.section },
            'redraw-mood': { previous, workId: previous.decision.workId, section: previous.decision.config.section },
            'redraw-passage': { previous, workId: previous.decision.workId, temper: previous.temper }
        });
        for (const redraw of ['redraw-text', 'redraw-mood', 'redraw-passage']) {
            const previous = portal.result;
            hook(container, redraw).click();
            await vi.waitFor(() => expect(portal.result).not.toBe(previous), { timeout: 3000 });
            expect(rollReading).toHaveBeenLastCalledWith(kept(previous)[redraw]);
            expect(portal.state).toBe('result');
            expect(document.activeElement, redraw).toBe(hook(container, redraw));
        }
        portal.destroy();
    });

    it('offers no passage Redraw for a RISE original, which has one division', async () => {
        vi.mocked(rollReading).mockImplementationOnce(() => ({
            temper: 'signal',
            decision: composeRoll({ temper: TEMPERS.find(t => t.id === 'signal'), workId: 'signal-from-the-moon', section: 'first' })
        }));
        const { portal, container } = makePortal();
        await roll(container);
        expect(portal.result.decision.author).toBe('RISE');
        expect(container.querySelectorAll('.home-part')).toHaveLength(3);
        expect(hook(container, 'redraw-passage')).toBeNull();
        expect(hook(container, 'redraw-text')).not.toBeNull();
        expect(hook(container, 'redraw-mood')).not.toBeNull();
        portal.destroy();
    });

    it('says so when a roll is refused, and keeps what was showing', async () => {
        const { portal, container } = makePortal();
        await roll(container);
        const shown = portal.result;
        vi.mocked(rollReading).mockImplementationOnce(() => { throw new TypeError('middle-ish is not a section.'); });
        hook(container, 'redraw-text').click();
        await vi.waitFor(() => expect(container.querySelector('.home-alert').hidden).toBe(false));
        expect(container.querySelector('.portal-alert-title').textContent).toBe('Couldn’t roll just now. Try again.');
        expect(portal.state).toBe('result');
        expect(portal.result).toBe(shown);
        portal.destroy();
    });

    it('rolls for the work of a star the reader picks, and ignores picks while busy', async () => {
        const { portal, container } = makePortal();
        const night = await withSky(portal);
        night.options.onPick('middlemarch');
        expect(portal.state).toBe('rolling');
        night.options.onPick('ulysses');
        await vi.waitFor(() => expect(portal.state).toBe('result'), { timeout: 3000 });
        expect(rollReading).toHaveBeenCalledOnce();
        expect(rollReading).toHaveBeenCalledWith({ workId: 'middlemarch' });
        expect(night.flare).toHaveBeenLastCalledWith(portal.result.decision.workId);
        portal.destroy();
    });

    it('Start reading plays the rolled reading, and Adjust first opens it to change', async () => {
        const onLaunchJevReading = vi.fn().mockResolvedValue(undefined);
        const onAdjustReading = vi.fn().mockResolvedValue(undefined);
        const { portal, container } = makePortal({ onLaunchJevReading, onAdjustReading });
        await roll(container);
        hook(container, 'enter').click();
        await vi.waitFor(() => expect(onLaunchJevReading).toHaveBeenCalledWith(portal.result.decision, { firstReadPreview: true }));
        await vi.waitFor(() => expect(hook(container, 'adjust').disabled).toBe(false));
        hook(container, 'adjust').click();
        await vi.waitFor(() => expect(onAdjustReading).toHaveBeenCalledWith(portal.result.decision));
        portal.destroy();
    });

    it('holds its controls while a reading opens, and says so if it cannot', async () => {
        let fail;
        const onLaunchJevReading = vi.fn(() => new Promise((_, reject) => { fail = reject; }));
        const { portal, container } = makePortal({ onLaunchJevReading });
        const night = await withSky(portal);
        await roll(container);
        hook(container, 'enter').click();
        await vi.waitFor(() => expect(hook(container, 'enter').getAttribute('aria-busy')).toBe('true'));
        expect(night.setBusy).toHaveBeenLastCalledWith(true);
        hook(container, 'enter').click();
        night.options.onPick('middlemarch');
        expect(onLaunchJevReading).toHaveBeenCalledOnce();
        expect(portal.state).toBe('result');
        fail(new Error('edition missing'));
        await vi.waitFor(() => expect(container.querySelector('.home-alert').hidden).toBe(false));
        expect(container.querySelector('.portal-alert-message').textContent).toBe('edition missing');
        expect(hook(container, 'enter').disabled).toBe(false);
        expect(night.setBusy).toHaveBeenLastCalledWith(false);
        portal.destroy();
    });

    it('recovers when the roll cannot load, and keeps what was showing', async () => {
        const { portal, container } = makePortal();
        await roll(container);
        const shown = portal.result;
        portal.tools = null;
        vi.spyOn(portal, 'loadTools').mockRejectedValueOnce(new Error('chunk failed'));
        hook(container, 'roll').click();
        await vi.waitFor(() => expect(container.querySelector('.home-alert').hidden).toBe(false));
        expect(portal.state).toBe('result');
        expect(portal.result).toBe(shown);
        expect(hook(container, 'roll').disabled).toBe(false);
        expect(container.querySelector('.portal-alert-message').textContent).toBe('chunk failed');
        portal.destroy();
    });

    it('is still there when the reader comes back from a reading', async () => {
        const { portal, container } = makePortal();
        await roll(container);
        const { title, decision } = portal.result;
        portal.activate();
        portal.deactivate();
        portal.update();
        portal.activate();
        expect(portal.result.decision).toEqual(decision);
        expect(container.querySelector('h1').textContent).toBe(title);
        expect(actions(container)).toEqual(['Start reading', 'Roll again', 'Adjust first']);
        portal.destroy();
    });

    it("starts empty on a fresh load, so the first roll is the reader's own", async () => {
        const first = makePortal();
        await roll(first.container);
        first.portal.destroy();
        // A tab that once held an Oracle result still loads empty.
        sessionStorage.setItem('rise-oracle-v1', JSON.stringify({ rolled: true, result: { decision: {}, source: 'roll' } }));
        const second = makePortal();
        expect(second.portal.state).toBe('idle');
        expect(second.portal.result).toBeNull();
        expect(actions(second.container)).toEqual(['Roll a reading', 'Ask for one']);
        second.portal.destroy();
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
        expect(container.querySelector('#home-form, .home-sky')).toBeNull();
        portal.activate();
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(sky.instances).toHaveLength(0);
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
            .toEqual(['library', 'vault', 'workshop', 'chamber', 'live', 'chapel', 'scriptorium', 'visual-lab', 'emotions', 'curia']);

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

    it('offers the wormhole, a page of its own, as another way in', () => {
        const { portal, container } = makePortal();
        const link = container.querySelector('.portal-nav a[href="/wormhole.html"]');
        expect(link.textContent.trim()).toBe('Wormhole');
        expect(link.closest('.portal-nav').textContent).toContain('Other ways in');
        portal.destroy();
        const demo = makePortal({ demoMode: true });
        expect(demo.container.querySelector('.portal-nav a[href="/wormhole.html"]')).not.toBeNull();
        demo.portal.destroy();
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

    it('keeps Privacy and Terms posted, beside one line on what asking needs', () => {
        const { portal, container } = makePortal();
        const footer = container.querySelector('.portal-footer');
        expect([...footer.querySelectorAll('.portal-legal a')].map(link => link.textContent.trim())).toEqual(['Privacy', 'Terms']);
        expect(footer.querySelector('a[href="/privacy.html"]')).not.toBeNull();
        expect(footer.querySelector('a[href="/terms.html"]')).not.toBeNull();
        const line = footer.querySelector('#portal-ai .portal-ai-line');
        expect(words(line)).toBe('Asking for a specific reading needs your own AI: connect OpenRouter or run RISE locally.');
        expect(line.querySelector('button[data-ai="connect"]').textContent).toBe('connect OpenRouter');
        const local = line.querySelector('a');
        expect(local.textContent).toBe('run RISE locally');
        expect(local.getAttribute('href')).toBe('https://github.com/SyberLabs/RISE/blob/main/docs/LOCAL-RISE.md');
        expect(local.getAttribute('rel')).toContain('noopener');
        portal.destroy();
    });

    it('names the lockup as one image and keeps one main landmark', () => {
        const { portal, container } = makePortal();
        const lockup = container.querySelector('.sl-lockup');
        expect(lockup.getAttribute('role')).toBe('img');
        expect(lockup.getAttribute('aria-label')).toBe('SyberLabs RISE');
        expect(container.querySelector('main .sl-header, main .portal-footer')).toBeNull();
        expect(container.querySelectorAll('main')).toHaveLength(1);
        expect(container.querySelectorAll('h1')).toHaveLength(1);
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

    it('opens a door onto the live Current, as a minor room until Stage 2 is complete', () => {
        const { portal, container, onNavigate } = makePortal();
        const door = container.querySelector('.portal-nav [data-nav="live"]');
        expect(door, 'the live Current has no door at all').not.toBeNull();
        // Reachable without a typed URL, but not promoted: the runtime is mid-build
        // (docs/VISION.md Stage 2). Promote it, and flip this, when Stage 2's shown-by holds.
        expect(door.classList.contains('portal-nav-minor'), 'the live Current is promoted before Stage 2').toBe(true);
        door.click();
        expect(onNavigate).toHaveBeenCalledWith('live');
        portal.destroy();
    });

    it('offers no door to a room that is gone', () => {
        const { portal, container } = makePortal();
        for (const gone of ['atrium', 'sol']) {
            expect(container.querySelector(`[data-nav="${gone}"]`), `a door still opens onto ${gone}`).toBeNull();
        }
        portal.destroy();
    });

    it('styles Home from the SyberLabs tokens, with one ink scrim as its only gradient', () => {
        const gradients = portalCss.match(/[a-z-]*gradient\(/gu) ?? [];
        expect(gradients).toEqual(['linear-gradient(']);
        expect(portalCss).toMatch(/linear-gradient\(90deg, color-mix\(in srgb, var\(--sy-bg\)/u);
        expect(portalCss).toMatch(/var\(--sy-accent-rise\)/);
        expect(portalCss).not.toMatch(/font-size:\s*(?:[0-9]|1[01])px/);
        // The orb and its keycaps are gone from the stylesheet too.
        expect(portalCss).not.toMatch(/oracle/u);
    });
});
