/**
 * RISE Home, already reading: the day's poem plays silently, full-screen,
 * under its own engine. Read it with sound opens it; Another reading rolls a
 * vivid one in its place. Every room is one Menu away.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Portal } from './Portal.js';
import { openingLines, resolveJevReading, validateJevRecommendation } from '../app/jev-reading.js';
import { composeRoll, rollReading, TEMPERS } from '../core/roll.js';
import { summarizeJevPlan } from '../core/jev-describe.js';
import { poemTitle, todayPoem } from '../core/today-poem.js';
import { todayDecision } from '../core/today-reading.js';
import OPENINGS from '../content/archive/today-openings.json' with { type: 'json' };

// The engine and the stream are stood in for; Home codes against their
// contracts (reading-backdrop.js, reading-stream.js). Each records what Home asks of it.
const engines = vi.hoisted(() => ({ mounted: [], answer: 'engine' }));
vi.mock('./reading-backdrop.js', () => ({
    mountReadingBackdrop: vi.fn(async (host, decision) => {
        if (engines.answer === 'throw') throw new Error('no WebGL2 here');
        if (engines.answer === 'null') return null;
        const engine = { host, decision, pause: vi.fn(), resume: vi.fn(), destroy: vi.fn() };
        engines.mounted.push(engine);
        return engine;
    })
}));
const streams = vi.hoisted(() => []);
vi.mock('./reading-stream.js', () => ({
    ReadingStream: class {
        constructor(host, options) {
            Object.assign(this, { host, options, play: vi.fn(), stop: vi.fn(), destroy: vi.fn() });
            streams.push(this);
        }
    }
}));
// roll.js and the day's pick are real. Home is held to the call it makes
// (rollReading's vivid roll) and to the passage and session it is handed.
vi.mock('../core/roll.js', async importOriginal => {
    const actual = await importOriginal();
    return { ...actual, rollReading: vi.fn(actual.rollReading) };
});
const LINES = 'My children, latest born to Cadmus old,\nWhy sit ye here as suppliants, in your hands';
const SESSION = vi.hoisted(() => ({
    text: 'Out of me unworthy and unknown',
    origin: { view: 'portal', icon: '✧', name: 'Home', experience: 'jev' },
    continuation: { kind: 'library-division', workId: 'spoon-river-anthology', entryId: '1', noun: 'entry' }
}));
vi.mock('../app/jev-reading.js', async importOriginal => ({
    ...(await importOriginal()),
    openingLines: vi.fn(async () => LINES),
    resolveJevReading: vi.fn(async () => SESSION)
}));

const portalCss = ['Portal.css', 'portal-home.css']
    .map(file => readFileSync(join(dirname(fileURLToPath(import.meta.url)), file), 'utf8'))
    .join('\n');

beforeEach(() => {
    sessionStorage.clear();
    engines.mounted.length = 0;
    engines.answer = 'engine';
    streams.length = 0;
    vi.mocked(rollReading).mockClear();
    vi.mocked(openingLines).mockClear();
    vi.mocked(resolveJevReading).mockClear();
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});

afterEach(() => {
    vi.doUnmock('../content/library.js');
    vi.useRealTimers();
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
const caption = container => [words(container.querySelector('.home-label')), words(container.querySelector('h1'))];
const status = container => container.querySelector('[data-home-status]').textContent;
const capital = text => text[0].toUpperCase() + text.slice(1);

/** Today's poem, as Home names it. */
function today(date = new Date()) {
    const pick = todayPoem(date);
    const decision = todayDecision(pick);
    const heading = `${poemTitle(pick.label)}, by ${OPENINGS.works[pick.workId].author}`;
    return { pick, decision, heading, passage: OPENINGS.openings[pick.workId][pick.entryId] };
}

/** Show Home and wait for today's poem to arrive under the stream. */
async function arrive(portal, container) {
    portal.activate();
    await vi.waitFor(() => expect(words(container.querySelector('h1'))).toBe(today().heading));
    await vi.waitFor(() => expect(streams[0]?.play).toHaveBeenCalled());
}

/** A rolled classic. */
const classic = (workId, temper = 'revel') => ({
    temper,
    decision: composeRoll({ temper: TEMPERS.find(t => t.id === temper), workId, section: 'first' })
});

async function another(container, portal) {
    const before = portal.reading;
    hook(container, 'roll').click();
    await vi.waitFor(() => expect(portal.reading).not.toBe(before), { timeout: 3000 });
}

describe('Home on arrival', () => {
    it('names today\'s poem under the stream, with one solid key, before anything loads', () => {
        const { portal, container } = makePortal();
        expect(words(container.querySelector('.home-label'))).toBe('Today’s poem');
        expect(actions(container)).toEqual(['Read it with sound', 'Another reading', 'Library']);
        expect([...container.querySelectorAll('.home .btn-primary')]).toEqual([hook(container, 'enter')]);
        expect(hook(container, 'roll').classList.contains('btn-secondary')).toBe(true);
        expect(hook(container, 'library').classList.contains('home-link')).toBe(true);
        // The stream is decoration; the opening is real text beside it.
        expect(container.querySelector('.home-stream').getAttribute('aria-hidden')).toBe('true');
        expect(container.querySelector('.home-engine').getAttribute('aria-hidden')).toBe('true');
        // Nothing loads until Home shows.
        expect(engines.mounted).toHaveLength(0);
        expect(streams).toHaveLength(0);
        portal.destroy();
    });

    it('plays today\'s poem silently: its engine behind, its opening streaming phrase by phrase', async () => {
        const { portal, container } = makePortal();
        await arrive(portal, container);
        const { pick, decision, heading, passage } = today();
        expect(caption(container)).toEqual(['Today’s poem', heading]);
        expect(status(container)).toBe(`Today’s poem: ${heading}`);
        expect(container.querySelector('[data-home-opening]').textContent).toBe(passage);
        expect(container.querySelector('[data-home-opening]').classList.contains('sr-only')).toBe(true);

        const [stream] = streams;
        expect(stream.host).toBe(container.querySelector('.home-stream'));
        expect(stream.play).toHaveBeenCalledWith(passage, { chunkMode: 'phrase', wpm: decision.config.wpm, curve: decision.config.curve, verse: true });
        // The same reading the Today page plays: the day's work, mood and engine.
        await vi.waitFor(() => expect(engines.mounted).toHaveLength(1));
        expect(engines.mounted[0].decision.workId).toBe(pick.workId);
        expect(engines.mounted[0].decision.temper).toBe(decision.temper);
        expect(engines.mounted[0].decision.config).toEqual(decision.config);
        expect(container.querySelector('.home-engine').contains(engines.mounted[0].host)).toBe(true);

        // The hairline follows the stream.
        stream.options.onProgress(0.25);
        expect(container.querySelector('.home-progress-fill').style.transform).toBe('scaleX(0.25)');
        portal.destroy();
    });

    it('keeps the header, then Read it with sound, Another reading and the link, in that order', async () => {
        const { portal, container } = makePortal();
        await arrive(portal, container);
        const order = [...container.querySelectorAll('button:not([hidden]), a[href]')]
            .filter(node => !node.closest('.portal-nav, dialog'));
        expect(order.map(node => node.dataset.home || node.className)).toEqual(
            ['portal-menu-toggle', 'enter', 'roll', 'library', 'portal-footer-link portal-legal-link', 'portal-footer-link portal-legal-link']);
        portal.destroy();
    });

    for (const answer of ['null', 'throw']) {
        it(`still works on ink with the text when the engine is ${answer === 'null' ? 'absent' : 'refused'}`, async () => {
            engines.answer = answer;
            const { portal, container } = makePortal();
            await arrive(portal, container);
            await new Promise(resolve => setTimeout(resolve, 20));
            expect(container.querySelector('.home-alert').hidden).toBe(true);
            expect(hook(container, 'enter').disabled).toBe(false);
            await another(container, portal);
            expect(words(container.querySelector('h1'))).toContain(', by ');
            portal.destroy();
        });
    }

    it('runs nothing behind a reading: leaving Home pauses the engine and stops the stream; returning resumes', async () => {
        const { portal, container } = makePortal();
        await arrive(portal, container);
        await vi.waitFor(() => expect(engines.mounted).toHaveLength(1));
        const [engine] = engines.mounted;
        const [stream] = streams;
        const heading = words(container.querySelector('h1'));
        portal.deactivate();
        expect(engine.pause).toHaveBeenCalledOnce();
        expect(stream.stop).toHaveBeenCalled();
        portal.update();
        portal.activate();
        expect(engine.resume).toHaveBeenCalledOnce();
        await vi.waitFor(() => expect(stream.play).toHaveBeenCalledTimes(2));
        expect(engines.mounted).toHaveLength(1);
        expect(words(container.querySelector('h1'))).toBe(heading);
        portal.destroy();
        expect(engine.destroy).toHaveBeenCalledOnce();
        expect(stream.destroy).toHaveBeenCalledOnce();
    });

    it('turns to the next day\'s poem at midnight while it is showing', async () => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
        vi.setSystemTime(new Date(2026, 9, 3, 23, 59, 30));
        const { portal, container } = makePortal();
        await arrive(portal, container);
        expect(words(container.querySelector('h1'))).toBe(today(new Date(2026, 9, 3)).heading);
        vi.advanceTimersByTime(60_000);
        await vi.waitFor(() => expect(words(container.querySelector('h1'))).toBe(today(new Date(2026, 9, 4)).heading));
        portal.destroy();
    });
});

describe('Another reading', () => {
    it('rolls a vivid reading, cross-fades to its engine and streams its opening', async () => {
        vi.mocked(rollReading).mockImplementationOnce(() => classic('oedipus-rex'));
        const { portal, container } = makePortal();
        await arrive(portal, container);
        await vi.waitFor(() => expect(engines.mounted).toHaveLength(1));
        const first = portal.reading;
        await another(container, portal);
        expect(rollReading).toHaveBeenCalledWith({ previous: first, vivid: true });
        const { decision } = portal.reading;
        expect(() => validateJevRecommendation(decision)).not.toThrow();
        const plan = summarizeJevPlan(decision.config).join(', ');
        expect(caption(container)).toEqual([`Revel: ${plan}`, 'Oedipus Rex, by Sophocles']);
        expect(status(container)).toBe(`Revel. Oedipus Rex, by Sophocles. ${capital(plan)}.`);
        // The link is Adjust now, and the reader stays on the key they pressed.
        expect(actions(container)).toEqual(['Read it with sound', 'Another reading', 'Adjust']);
        expect(document.activeElement).toBe(hook(container, 'roll'));

        expect(openingLines).toHaveBeenCalledWith(decision);
        await vi.waitFor(() => expect(streams[0].play).toHaveBeenLastCalledWith(LINES,
            { chunkMode: decision.config.chunkMode, wpm: decision.config.wpm, curve: decision.config.curve, verse: false }));
        expect(container.querySelector('[data-home-opening]').textContent).toBe(LINES);

        // The new engine mounts beside the old, and the old goes only after.
        await vi.waitFor(() => expect(engines.mounted).toHaveLength(2));
        const [old, next] = engines.mounted;
        expect(next.decision).toBe(decision);
        expect(next.host).not.toBe(old.host);
        await vi.waitFor(() => expect(old.destroy).toHaveBeenCalledOnce(), { timeout: 3000 });
        expect(old.host.isConnected).toBe(false);
        expect(next.destroy).not.toHaveBeenCalled();
        portal.destroy();
    });

    it('rolls again from the reading it replaced', async () => {
        const { portal, container } = makePortal();
        await arrive(portal, container);
        await another(container, portal);
        const first = portal.reading;
        await another(container, portal);
        expect(rollReading).toHaveBeenLastCalledWith({ previous: first, vivid: true });
        expect(portal.reading.decision.workId).not.toBe(first.decision.workId);
        portal.destroy();
    });

    it('holds the stream on ink while the opening loads, and leaves it out if it cannot be read', async () => {
        vi.mocked(openingLines).mockImplementationOnce(async () => { throw new Error('edition unavailable'); });
        const { portal, container } = makePortal();
        await arrive(portal, container);
        await another(container, portal);
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(streams[0].play).toHaveBeenCalledOnce();
        expect(container.querySelector('.home-stream').children).toHaveLength(0);
        expect(container.querySelector('.home-alert').hidden).toBe(true);
        portal.destroy();
    });

    it('says so when a roll is refused, and keeps what was showing', async () => {
        const { portal, container } = makePortal();
        await arrive(portal, container);
        const kept = portal.reading;
        vi.mocked(rollReading).mockImplementationOnce(() => { throw new TypeError('middle-ish is not a section.'); });
        hook(container, 'roll').click();
        await vi.waitFor(() => expect(container.querySelector('.home-alert').hidden).toBe(false));
        expect(container.querySelector('.portal-alert-title').textContent).toBe('Couldn’t roll just now. Try again.');
        expect(portal.reading).toBe(kept);
        expect(hook(container, 'roll').disabled).toBe(false);
        portal.destroy();
    });

    it('recovers when the roll cannot load, and loads it on the next press', async () => {
        vi.doMock('../content/library.js', () => { throw new Error('chunk failed'); });
        const { portal, container } = makePortal();
        hook(container, 'roll').click();
        await vi.waitFor(() => expect(container.querySelector('.home-alert').hidden).toBe(false));
        expect(hook(container, 'roll').disabled).toBe(false);
        vi.doUnmock('../content/library.js');
        await another(container, portal);
        expect(container.querySelector('.home-alert').hidden).toBe(true);
        portal.destroy();
    });
});

describe('Read it with sound', () => {
    it('opens today\'s exact poem the way the Today page does, and comes back to Home', async () => {
        const onBeginSession = vi.fn().mockResolvedValue(true);
        const onLaunchJevReading = vi.fn();
        const { portal, container } = makePortal({ onBeginSession, onLaunchJevReading });
        await arrive(portal, container);
        hook(container, 'enter').click();
        await vi.waitFor(() => expect(onBeginSession).toHaveBeenCalledOnce());
        const { pick } = today();
        expect(resolveJevReading).toHaveBeenCalledWith(portal.reading.decision, { entryId: pick.entryId, label: pick.label });
        expect(onBeginSession).toHaveBeenCalledWith({ ...SESSION, continuation: { ...SESSION.continuation, noun: 'poem' } });
        // Leaving the reading returns to Home (chamber-exit.js reads this origin).
        expect(onBeginSession.mock.calls[0][0].origin).toEqual({ view: 'portal', icon: '✧', name: 'Home', experience: 'jev' });
        expect(onLaunchJevReading).not.toHaveBeenCalled();
        await vi.waitFor(() => expect(hook(container, 'enter').disabled).toBe(false));
        portal.destroy();
    });

    it('plays a rolled reading, and Adjust opens it to change', async () => {
        const onLaunchJevReading = vi.fn().mockResolvedValue(undefined);
        const onAdjustReading = vi.fn().mockResolvedValue(undefined);
        const { portal, container } = makePortal({ onLaunchJevReading, onAdjustReading });
        await arrive(portal, container);
        await another(container, portal);
        hook(container, 'enter').click();
        await vi.waitFor(() => expect(onLaunchJevReading).toHaveBeenCalledWith(portal.reading.decision, { firstReadPreview: true }));
        await vi.waitFor(() => expect(hook(container, 'adjust').disabled).toBe(false));
        hook(container, 'adjust').click();
        await vi.waitFor(() => expect(onAdjustReading).toHaveBeenCalledWith(portal.reading.decision));
        portal.destroy();
    });

    it('holds its controls while a reading opens, and says so if it cannot', async () => {
        let fail;
        const onLaunchJevReading = vi.fn(() => new Promise((_, reject) => { fail = reject; }));
        const { portal, container } = makePortal({ onLaunchJevReading });
        await arrive(portal, container);
        await another(container, portal);
        hook(container, 'enter').click();
        await vi.waitFor(() => expect(hook(container, 'enter').getAttribute('aria-busy')).toBe('true'));
        expect(hook(container, 'roll').disabled).toBe(true);
        hook(container, 'enter').click();
        expect(onLaunchJevReading).toHaveBeenCalledOnce();
        fail(new Error('edition missing'));
        await vi.waitFor(() => expect(container.querySelector('.home-alert').hidden).toBe(false));
        expect(container.querySelector('.portal-alert-message').textContent).toBe('edition missing');
        expect(hook(container, 'enter').disabled).toBe(false);
        portal.destroy();
    });

    it('waits for today\'s poem before it can be pressed', () => {
        const { portal, container } = makePortal();
        expect(hook(container, 'enter').disabled).toBe(true);
        expect(hook(container, 'roll').disabled).toBe(false);
        portal.destroy();
    });
});

describe('the rest of Home', () => {
    it('the Library link opens the Library', async () => {
        const { portal, container, onNavigate } = makePortal();
        hook(container, 'library').click();
        expect(onNavigate).toHaveBeenCalledWith('library');
        portal.destroy();
    });

    it('offers Continue reading as a pill when there is a session, and reads audio from its owner', () => {
        const audio = { playClick: vi.fn() };
        const { portal, container, onNavigate } = makePortal({
            getAudioEngine: () => audio,
            getCurrentSession: () => ({ title: 'Meditations' })
        });
        const continuation = container.querySelector('.portal-continue');
        expect(continuation.hidden).toBe(false);
        expect(continuation.textContent).toContain('Meditations');
        continuation.click();
        expect(onNavigate).toHaveBeenCalledWith('chamber-session', { title: 'Meditations' });
        container.querySelector('[data-nav="library"]').click();
        expect(audio.playClick).toHaveBeenCalledTimes(2);
        portal.destroy();
        expect(makePortal().container.querySelector('.portal-continue').hidden).toBe(true);
    });

    it('offers a disclosed preset scene sample and a separate live RISE link', async () => {
        const onLaunchJevSample = vi.fn().mockResolvedValue(undefined);
        const { portal, container } = makePortal({ demoMode: true, onLaunchJevSample });
        expect(container.textContent).toContain('preset');
        expect(container.textContent).toContain('No live RISE request');
        expect(container.querySelector('.home-ask, .home-engine, [data-home="ask-open"]')).toBeNull();
        portal.activate();
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(engines.mounted).toHaveLength(0);
        expect(streams).toHaveLength(0);
        expect(container.querySelector('#portal-jev-demo').textContent).toContain('George Eliot');
        expect(container.querySelector('#portal-jev-demo a[href="https://standardebooks.org/ebooks/george-eliot/middlemarch"]')).not.toBeNull();
        container.querySelector('#jev-scene-demo-start').click();
        await vi.waitFor(() => expect(onLaunchJevSample).toHaveBeenCalledOnce());
        portal.destroy();
    });

    it('the Menu holds every room and Ask for a reading, starts at Home, keeps focus and closes on Escape', () => {
        const { portal, container, onNavigate } = makePortal();
        const header = container.querySelector('.sl-header');
        const toggle = container.querySelector('.portal-menu-toggle');
        toggle.click();
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(container.querySelector('.portal').classList.contains('is-menu-open')).toBe(true);

        const items = [...container.querySelectorAll('.portal-nav button')];
        expect(items.slice(0, 3).map(words)).toEqual(['Home', 'Ask for a reading', 'Today\'s poem']);
        expect(items[0].getAttribute('aria-current')).toBe('page');
        expect(document.activeElement).toBe(items[0]);
        expect([...container.querySelectorAll('.portal-nav [data-nav]')].map(item => item.dataset.nav))
            .toEqual(['today', 'library', 'vault', 'workshop', 'chamber', 'live', 'chapel', 'scriptorium', 'visual-lab', 'emotions', 'curia']);

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

    it('keeps Privacy and Terms posted on Home itself', () => {
        const { portal, container } = makePortal();
        const footer = container.querySelector('.portal-footer');
        expect(footer.closest('.portal-nav, dialog')).toBeNull();
        expect([...footer.querySelectorAll('.portal-legal a')].map(link => link.textContent.trim())).toEqual(['Privacy', 'Terms']);
        expect(footer.querySelector('a[href="/privacy.html"]')).not.toBeNull();
        expect(footer.querySelector('a[href="/terms.html"]')).not.toBeNull();
        portal.destroy();
    });

    it('names the lockup as one image and keeps one main landmark and one h1', () => {
        const { portal, container } = makePortal();
        const lockup = container.querySelector('.sl-lockup');
        expect(lockup.getAttribute('role')).toBe('img');
        expect(lockup.getAttribute('aria-label')).toBe('SyberLabs RISE');
        expect(container.querySelector('main .sl-header, main .portal-footer')).toBeNull();
        expect(container.querySelectorAll('main')).toHaveLength(1);
        expect(container.querySelectorAll('h1')).toHaveLength(1);
        expect(container.querySelector('[role="status"] [data-home-status]')).not.toBeNull();
        portal.destroy();
    });

    it('names every control and uses no glyph or emoji text', async () => {
        const { portal, container } = makePortal();
        await arrive(portal, container);
        await another(container, portal);
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

    it('styles Home from the SyberLabs tokens, with one ink scrim as its only gradient, and nothing under 12px', () => {
        const gradients = portalCss.match(/[a-z-]*gradient\(/gu) ?? [];
        expect(gradients).toEqual(['radial-gradient(', 'linear-gradient(']);
        expect(portalCss).toMatch(/\.home-scrim \{[^}]*radial-gradient\([^}]*linear-gradient\(/u);
        expect(portalCss).toMatch(/var\(--sy-accent-rise\)/);
        expect(portalCss).not.toMatch(/font-size:\s*(?:[0-9]|1[01])px/);
        // Under reduced motion the engine swaps without a fade.
        expect(portalCss).toMatch(/prefers-reduced-motion: reduce\)[^@]*\.home-engine-layer \{[^}]*transition: none/u);
    });
});
