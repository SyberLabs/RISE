/**
 * RISE Home, a home with a window: the day's poem is named in the slot, its
 * opening's first line set still in its own face, under its own engine.
 * Begin opens it; Another reading rolls a vivid one in its place. Every
 * room is one Menu away.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Home } from './Home.js';
import { createRouteManifest } from '../app/route-manifest.js';
import { ROUTE_ALIASES } from '../core/route-url.js';
import { openingLines, validateJevRecommendation } from '../app/jev-reading.js';
import { composeRoll, rollReading, TEMPERS } from '../core/roll.js';
import { summarizeJevPlan } from '../core/jev-describe.js';
import { poemTitle, todayPoem } from '../core/today-poem.js';
import { todayDecision } from '../core/today-reading.js';
import OPENINGS from '../content/archive/today-openings.json' with { type: 'json' };

// The stage is stood in for; Home codes against its contract
// (reading-backdrop.js), and the stage's own tests hold it to its fades,
// stale mounts and pauses. Each records what Home asks of it.
const stages = vi.hoisted(() => ({ made: [], refuse: false }));
vi.mock('./reading-backdrop.js', () => ({
    ReadingStage: class {
        constructor(host) {
            if (stages.refuse) throw new Error('the engine module did not load');
            // A mount stays pending, as a slow engine's would.
            Object.assign(this, { host, show: vi.fn(() => new Promise(() => {})), pause: vi.fn(), resume: vi.fn(), destroy: vi.fn() });
            stages.made.push(this);
        }
    }
}));
const shown = () => stages.made[0].show.mock.calls.map(([decision]) => decision);
// roll.js and the day's pick are real. Home is held to the call it makes
// (rollReading's vivid roll) and to the passage and session it is handed.
vi.mock('../core/roll.js', async importOriginal => {
    const actual = await importOriginal();
    return { ...actual, rollReading: vi.fn(actual.rollReading) };
});
// A prose opening longer than the epigraph's 90 characters, and its cut.
const LINES = 'My children, latest born to Cadmus old, why sit ye here as suppliants, in your hands branches of olive filleted with wool?';
const EPIGRAPH = 'My children, latest born to Cadmus old, why sit ye here as suppliants, in your hands…';
const WORDS = 450;
vi.mock('../app/jev-reading.js', async importOriginal => ({
    ...(await importOriginal()),
    openingLines: vi.fn(async () => ({ text: LINES, verse: false, words: WORDS }))
}));

const portalCss = ['Home.css', 'portal-home.css']
    .map(file => readFileSync(join(dirname(fileURLToPath(import.meta.url)), file), 'utf8'))
    .join('\n');

beforeEach(() => {
    sessionStorage.clear();
    stages.made.length = 0;
    stages.refuse = false;
    vi.mocked(rollReading).mockClear();
    vi.mocked(openingLines).mockClear();
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
    const portal = new Home(container, { onNavigate, ...options });
    return { portal, container, onNavigate };
}

const hook = (container, name) => container.querySelector(`[data-home="${name}"]`);
const words = node => node.textContent.replace(/\s+/gu, ' ').trim();
const actions = container => [...container.querySelectorAll('.home-actions button')].map(words);
/** The slot: eyebrow, name, meta line, epigraph. */
const slot = container => ['.home-label', 'h1', '.home-meta', '.home-epigraph'].map(sel => words(container.querySelector(sel)));
const epigraph = container => container.querySelector('.home-epigraph');
const status = container => container.querySelector('[data-home-status]').textContent;
const capital = text => text[0].toUpperCase() + text.slice(1);
const minutes = (count, wpm) => Math.max(1, Math.round(count / wpm));

/** Today's poem, as Home names it. */
function today(date = new Date()) {
    const pick = todayPoem(date);
    const decision = todayDecision(pick);
    const { title: work, author } = OPENINGS.works[pick.workId];
    const passage = OPENINGS.openings[pick.workId][pick.entryId];
    return {
        pick, decision, author, work, passage,
        title: poemTitle(pick.label),
        firstLine: passage.split('\n').map(line => line.trim()).find(Boolean),
        minutes: minutes(pick.words, decision.config.wpm),
        look: capital(decision.temper)
    };
}

/** Show Home and wait for today's poem to arrive in the slot. */
async function arrive(portal, container) {
    portal.activate();
    await vi.waitFor(() => expect(words(container.querySelector('h1'))).toBe(today().title));
    await vi.waitFor(() => expect(words(epigraph(container))).not.toBe(''));
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

/** What Home rolls from: the reading showing, by its temper and decision. */
const from = reading => ({ temper: reading.temper, decision: reading.decision });

describe('Home on arrival', () => {
    it('names today\'s poem in the slot, with one solid key, before anything loads', () => {
        const { portal, container } = makePortal();
        expect(slot(container)).toEqual(['Today’s poem', '', '', '']);
        expect(actions(container)).toEqual(['Begin', 'Another reading', 'Library']);
        expect([...container.querySelectorAll('.home .btn-primary')]).toEqual([hook(container, 'enter')]);
        expect(hook(container, 'roll').classList.contains('btn-secondary')).toBe(true);
        expect(hook(container, 'library').classList.contains('home-link')).toBe(true);
        // The window holds the engine, never words; the opening is real text beside the slot.
        expect(container.querySelector('.home-window')).not.toBeNull();
        expect(container.querySelector('.home-engine').getAttribute('aria-hidden')).toBe('true');
        expect(container.querySelector('.home-stream, [class*="reading-stream"]')).toBeNull();
        // Nothing loads until Home shows.
        expect(stages.made).toHaveLength(0);
        portal.destroy();
    });

    it('shows today\'s poem still: its engine behind, its opening\'s first line as an epigraph in its face', async () => {
        const { portal, container } = makePortal();
        await arrive(portal, container);
        const { pick, decision, title, author, work, passage, firstLine, minutes, look } = today();
        expect(slot(container)).toEqual(['Today’s poem', title, `${author} · ${work} · ${minutes} min · ${look}`, firstLine]);
        // A phone hides the work, with its separator.
        expect(container.querySelector('.home-meta .home-meta-work').textContent).toBe(` · ${work}`);
        expect(status(container)).toBe(`Today’s poem: ${title}, by ${author}. ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}. ${look}.`);
        // A name too long for the slot's one line is whole as a tooltip.
        expect(container.querySelector('h1').title).toBe(title);
        expect(epigraph(container).dataset.face).toBe(decision.config.presentation.chamberFace);
        expect(container.querySelector('[data-home-opening]').textContent).toBe(passage);
        expect(container.querySelector('[data-home-opening]').classList.contains('sr-only')).toBe(true);

        // The same reading launchToday opens: the day's work, mood and engine.
        await vi.waitFor(() => expect(stages.made).toHaveLength(1));
        expect(stages.made[0].host).toBe(container.querySelector('.home-engine'));
        const [engine] = shown();
        expect(engine.workId).toBe(pick.workId);
        expect(engine.temper).toBe(decision.temper);
        expect(engine.config).toEqual(decision.config);
        portal.destroy();
    });

    it('sets nothing in motion and sounds nothing before a press', async () => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
        const getAudioEngine = vi.fn(() => null);
        const { portal, container } = makePortal({ getAudioEngine });
        await arrive(portal, container);
        const still = words(epigraph(container));
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
        expect(words(epigraph(container))).toBe(still);
        expect(container.querySelector('.home [class*="stream"], .home [class*="progress"]')).toBeNull();
        // Only the day's watch waits, for midnight.
        expect(vi.getTimerCount()).toBe(1);
        expect(stages.made[0].show).toHaveBeenCalledOnce();
        expect(getAudioEngine).not.toHaveBeenCalled();
        portal.destroy();
    });

    it('keeps the header, then Begin, Another reading and the link, in that order', async () => {
        const { portal, container } = makePortal();
        await arrive(portal, container);
        const order = [...container.querySelectorAll('button:not([hidden]), a[href]')]
            .filter(node => !node.closest('.portal-nav, dialog'));
        expect(order.map(node => node.dataset.home || node.className)).toEqual(
            ['portal-menu-toggle', 'enter', 'roll', 'library', 'portal-footer-link portal-legal-link', 'portal-footer-link portal-legal-link']);
        portal.destroy();
    });

    it('still works on ink with the text when the engine cannot load', async () => {
        stages.refuse = true;
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { portal, container } = makePortal();
        await arrive(portal, container);
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(container.querySelector('.home-alert').hidden).toBe(true);
        expect(hook(container, 'enter').disabled).toBe(false);
        await another(container, portal);
        expect(hook(container, 'adjust')).not.toBeNull();
        portal.destroy();
        vi.mocked(console.warn).mockRestore();
    });

    it('runs nothing behind a reading: leaving Home pauses the engine; returning resumes it', async () => {
        const { portal, container } = makePortal();
        await arrive(portal, container);
        await vi.waitFor(() => expect(stages.made).toHaveLength(1));
        const [stage] = stages.made;
        const title = words(container.querySelector('h1'));
        // Left while its engine is still mounting: the stage holds it still.
        portal.deactivate();
        expect(stage.pause).toHaveBeenCalledOnce();
        portal.update();
        portal.activate();
        expect(stage.resume).toHaveBeenCalledOnce();
        // The same reading's engine: the stage shows it again without mounting it.
        expect(stages.made).toHaveLength(1);
        expect(new Set(shown()).size).toBe(1);
        expect(words(container.querySelector('h1'))).toBe(title);
        portal.destroy();
        expect(stage.destroy).toHaveBeenCalledOnce();
    });

    it('loads today\'s poem once, even when Home is left and shown again before it arrives', async () => {
        const { portal, container } = makePortal();
        portal.activate();
        portal.deactivate();
        portal.activate();
        await vi.waitFor(() => expect(words(container.querySelector('h1'))).toBe(today().title));
        await new Promise(resolve => setTimeout(resolve, 50));
        await vi.waitFor(() => expect(stages.made).toHaveLength(1));
        expect(new Set(shown()).size).toBe(1);
        portal.destroy();
    });

    it('keeps a reading rolled before today\'s poem arrived', async () => {
        vi.mocked(rollReading).mockImplementationOnce(() => classic('oedipus-rex'));
        const { portal, container } = makePortal();
        await another(container, portal);
        expect(rollReading).toHaveBeenCalledWith({ previous: null, vivid: true });
        portal.activate();
        await vi.waitFor(() => expect(words(epigraph(container))).toBe(EPIGRAPH));
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(words(container.querySelector('h1'))).toBe('Oedipus Rex');
        expect(hook(container, 'adjust')).not.toBeNull();
        portal.destroy();
    });

    it('turns to the next day\'s poem at midnight while it is showing', async () => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
        vi.setSystemTime(new Date(2026, 9, 3, 23, 59, 30));
        const { portal, container } = makePortal();
        await arrive(portal, container);
        expect(words(container.querySelector('h1'))).toBe(today(new Date(2026, 9, 3)).title);
        vi.advanceTimersByTime(60_000);
        await vi.waitFor(() => expect(words(container.querySelector('h1'))).toBe(today(new Date(2026, 9, 4)).title));
        portal.destroy();
    });

    it('shows the new day\'s poem when Home comes back after midnight', async () => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
        vi.setSystemTime(new Date(2026, 9, 3, 23, 50));
        const { portal, container } = makePortal();
        await arrive(portal, container);
        // Away in another room across midnight: the day's watcher is stopped meanwhile.
        portal.deactivate();
        vi.setSystemTime(new Date(2026, 9, 4, 0, 10));
        portal.activate();
        vi.advanceTimersByTime(50);
        await vi.waitFor(() => expect(words(container.querySelector('h1'))).toBe(today(new Date(2026, 9, 4)).title));
        portal.destroy();
    });
});

describe('Another reading', () => {
    it('rolls a vivid reading, cross-fades to its engine and sets its opening still', async () => {
        vi.mocked(rollReading).mockImplementationOnce(() => classic('oedipus-rex'));
        const { portal, container } = makePortal();
        await arrive(portal, container);
        const first = portal.reading;
        await another(container, portal);
        expect(rollReading).toHaveBeenCalledWith({ previous: from(first), vivid: true });
        const { decision } = portal.reading;
        expect(() => validateJevRecommendation(decision)).not.toThrow();
        const plan = summarizeJevPlan(decision.config).join(', ');
        expect(openingLines).toHaveBeenCalledWith(decision);
        // Its length and opening come with its division: the slot names it as the title alone,
        // the author, its minutes and its look; the work is not repeated under its own name.
        await vi.waitFor(() => expect(words(epigraph(container))).toBe(EPIGRAPH));
        expect(slot(container)).toEqual(['By chance', 'Oedipus Rex', `Sophocles · ${minutes(WORDS, decision.config.wpm)} min · Revel`, EPIGRAPH]);
        expect(container.querySelector('h1').title).toBe('Oedipus Rex');
        expect(epigraph(container).dataset.face).toBe(decision.config.presentation.chamberFace);
        // The plan stays in the spoken status.
        expect(status(container)).toBe(`Revel. Oedipus Rex, by Sophocles. ${capital(plan)}.`);
        // The link is Adjust now, and the reader stays on the key they pressed.
        expect(actions(container)).toEqual(['Begin', 'Another reading', 'Adjust']);
        expect(document.activeElement).toBe(hook(container, 'roll'));
        expect(container.querySelector('[data-home-opening]').textContent).toBe(LINES);

        // The stage cross-fades to the new reading's engine.
        await vi.waitFor(() => expect(shown().at(-1)).toBe(decision));
        expect(stages.made).toHaveLength(1);
        portal.destroy();
    });

    it('sets a rolled verse division\'s first line as the epigraph', async () => {
        vi.mocked(rollReading).mockImplementationOnce(() => classic('spoon-river-anthology', 'signal'));
        vi.mocked(openingLines).mockImplementationOnce(async () => ({ text: '\nI went to the dances at Chandlerville,\nAnd played snap-out at Winchester.', verse: true, words: 60 }));
        const { portal, container } = makePortal();
        await arrive(portal, container);
        await another(container, portal);
        await vi.waitFor(() => expect(words(epigraph(container))).toBe('I went to the dances at Chandlerville,'));
        portal.destroy();
    });

    it('shows the last of several quick rolls, while the engines still mount', async () => {
        const { portal, container } = makePortal();
        await arrive(portal, container);
        await another(container, portal);
        await another(container, portal);
        await another(container, portal);
        await vi.waitFor(() => expect(shown().at(-1)).toBe(portal.reading.decision));
        expect(stages.made).toHaveLength(1);
        portal.destroy();
        expect(stages.made[0].destroy).toHaveBeenCalledOnce();
    });

    it('rolls again from the reading it replaced', async () => {
        const { portal, container } = makePortal();
        await arrive(portal, container);
        await another(container, portal);
        const first = portal.reading;
        await another(container, portal);
        expect(rollReading).toHaveBeenLastCalledWith({ previous: from(first), vivid: true });
        expect(portal.reading.decision.workId).not.toBe(first.decision.workId);
        portal.destroy();
    });

    it('leaves the epigraph empty while the opening loads, and empty if it cannot be read', async () => {
        vi.mocked(openingLines).mockImplementationOnce(async () => { throw new Error('edition unavailable'); });
        const { portal, container } = makePortal();
        await arrive(portal, container);
        await another(container, portal);
        expect(words(epigraph(container))).toBe('');
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(words(epigraph(container))).toBe('');
        expect(words(container.querySelector('.home-meta'))).not.toContain('min');
        expect(container.querySelector('.home-alert').hidden).toBe(true);
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

// On a slow phone the first press waited most of a second for the roll's
// code; Home fetches it in idle time once the epigraph is showing.
describe('Another reading, warmed while Home reads', () => {
    let idle;
    beforeEach(() => {
        idle = vi.fn();
        vi.stubGlobal('requestIdleCallback', idle);
    });
    afterEach(() => vi.unstubAllGlobals());
    const runIdle = () => idle.mock.calls.forEach(([run]) => run());

    it('loads the roll\'s code once in idle time after the epigraph shows, and the press reuses it', async () => {
        const { portal, container } = makePortal();
        const loadTools = vi.spyOn(portal, 'loadTools');
        await arrive(portal, container);
        // Home's text and engine come first: nothing is fetched until the browser is idle.
        expect(loadTools).not.toHaveBeenCalled();
        expect(idle).toHaveBeenCalledOnce();
        runIdle();
        expect(loadTools).toHaveBeenCalledOnce();
        const warmed = portal.tools;
        await warmed;
        await another(container, portal);
        expect(portal.tools).toBe(warmed);
        // Warm already: the rolled reading's epigraph asks for no second warm-up.
        await vi.waitFor(() => expect(words(epigraph(container))).toBe(EPIGRAPH));
        expect(idle).toHaveBeenCalledOnce();
        portal.destroy();
    });

    it('fetches nothing when Home is left before the browser is idle', async () => {
        const { portal, container } = makePortal();
        const loadTools = vi.spyOn(portal, 'loadTools');
        await arrive(portal, container);
        portal.deactivate();
        runIdle();
        expect(loadTools).not.toHaveBeenCalled();
        portal.destroy();
    });

    it('fetches nothing ahead when the reader asked to save data', async () => {
        vi.stubGlobal('navigator', { ...navigator, connection: { saveData: true } });
        const { portal, container } = makePortal();
        const loadTools = vi.spyOn(portal, 'loadTools');
        await arrive(portal, container);
        runIdle();
        expect(idle).not.toHaveBeenCalled();
        expect(loadTools).not.toHaveBeenCalled();
        portal.destroy();
    });

    it('fetches nothing in the scene demo', async () => {
        const { portal } = makePortal({ demoMode: true });
        const loadTools = vi.spyOn(portal, 'loadTools');
        portal.activate();
        await new Promise(resolve => setTimeout(resolve, 50));
        runIdle();
        expect(loadTools).not.toHaveBeenCalled();
        portal.destroy();
    });

    it('fails silently, and the press loads it again', async () => {
        const { portal, container } = makePortal();
        await arrive(portal, container);
        vi.doMock('../content/library.js', () => { throw new Error('chunk failed'); });
        runIdle();
        expect(portal.tools).not.toBeNull();
        await vi.waitFor(() => expect(portal.tools).toBeNull());
        expect(container.querySelector('.home-alert').hidden).toBe(true);
        vi.doUnmock('../content/library.js');
        await another(container, portal);
        expect(container.querySelector('.home-alert').hidden).toBe(true);
        portal.destroy();
    });
});

describe('Begin', () => {
    it('opens today\'s exact poem through the app\'s launchToday, and comes back to Home', async () => {
        const onLaunchToday = vi.fn().mockResolvedValue(undefined);
        const onLaunchJevReading = vi.fn().mockResolvedValue(undefined);
        const { portal, container } = makePortal({ onLaunchToday, onLaunchJevReading });
        await arrive(portal, container);
        hook(container, 'enter').click();
        await vi.waitFor(() => expect(onLaunchToday).toHaveBeenCalledOnce());
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
        // The first-read preview is offered once.
        hook(container, 'enter').click();
        await vi.waitFor(() => expect(onLaunchJevReading).toHaveBeenLastCalledWith(portal.reading.decision, { firstReadPreview: false }));
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
        expect(stages.made).toHaveLength(0);
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

        // The five rooms, then Ask, Guide and the Wormhole.
        const items = [...container.querySelectorAll('.portal-nav button, .portal-nav a')];
        expect(items.map(words))
            .toEqual(['Home', 'Read', 'Library', 'Make', 'Settings', 'Ask for a reading', 'Guide', 'Wormhole']);
        expect(items[0].getAttribute('aria-current')).toBe('page');
        expect(document.activeElement).toBe(items[0]);
        expect([...container.querySelectorAll('.portal-nav [data-nav]')].map(item => item.dataset.nav))
            .toEqual(['read', 'library', 'make']);
        // Every room the Menu names is a route the app has, directly or as an old id's alias,
        // so no Menu button goes nowhere.
        const routes = new Set(createRouteManifest({}).map(route => route.id));
        for (const item of container.querySelectorAll('.portal-nav [data-nav]')) {
            expect(routes, item.dataset.nav).toContain(ROUTE_ALIASES[item.dataset.nav] ?? item.dataset.nav);
        }

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
        container.querySelector('.portal-nav [data-nav="make"]').click();
        expect(onNavigate).toHaveBeenCalledWith('make');
        expect(header.classList.contains('is-open')).toBe(false);
        portal.destroy();
    });

    it('offers the wormhole, a page of its own, as another way in', () => {
        const { portal, container } = makePortal();
        const link = container.querySelector('.portal-nav a[href="/wormhole.html"]');
        expect(link.textContent.trim()).toBe('Wormhole');
        expect(link.classList.contains('portal-nav-minor')).toBe(true);
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

    it('offers no Menu door to realtime Live, which is out of current scope', () => {
        // docs/product/discussions/2026-10-04-composer-decision.md. /live still routes,
        // for the Composer embed and the catalog.
        const { portal, container } = makePortal();
        expect(container.querySelector('.portal-nav [data-nav="live"]')).toBeNull();
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
        // The scrim lies in parts, under what it keeps legible; every gradient is its ink.
        const gradients = portalCss.match(/^ *[a-z-]+:[^;\n]*gradient\([^;\n]*;/gmu) ?? [];
        expect(gradients.length).toBeGreaterThan(0);
        for (const rule of gradients) {
            expect(rule.trim(), rule).toMatch(/^background: linear-gradient\(/u);
            expect(rule.replace(/color-mix\(in srgb, var\(--sy-bg\) \d+%, transparent\)|var\(--home-ink-bar\)/gu, ''), rule)
                .not.toMatch(/#[0-9a-f]{3,8}|rgb|hsl|var\(--sy-/iu);
        }
        expect(portalCss).toMatch(/--home-ink-bar: color-mix\(in srgb, var\(--sy-bg\) 92%, transparent\);/u);
        expect(portalCss).toMatch(/var\(--sy-accent-rise\)/);
        expect(portalCss).not.toMatch(/font-size:\s*(?:[0-9]|1[01])px/);
        // The epigraph takes its face from the design system's tokens, never a family name.
        const faces = portalCss.match(/\.home-epigraph\[data-face="[a-z]+"\][^}]*\}/gu) ?? [];
        expect(faces.map(rule => rule.match(/data-face="([a-z]+)"/u)[1]).sort()).toEqual(['book', 'display', 'jp', 'mono', 'sans', 'thick']);
        for (const rule of faces) expect(rule, rule).not.toMatch(/'|"[A-Z]/u);
    });
});
