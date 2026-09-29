/**
 * Diving from the Chamber.
 *
 * A dive looks under the passage the reading is at. It holds the reading the
 * way pausing does and never moves it, so surfacing returns to the same atom
 * and nothing that was scheduled is skipped (LATERAL-TRAVERSAL-SPEC: there is
 * no seeking). It is buttons and keys only, and keeps clear of the two axes
 * the arrow keys own.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';
import { compileSession } from '../core/session-compiler.js';
import { Player } from '../core/player.js';
import { GLANCE_HOLD_MS } from '../core/dive.js';

const TEXT = 'The first division says one thing. It says it plainly. The last division says it again.';

const anchor = extra => ({ sourceIds: ['primary'], ...extra });

function reading({ threads = true } = {}) {
    return compileSession({
        title: 'Under',
        text: TEXT,
        chunkMode: 'word',
        wpm: 600,
        visualConfig: { visualMode: 'off' },
        experienceProgram: threads ? {
            schema: 'rise.experience-program.v1',
            id: 'under',
            authority: 'user',
            editable: true,
            tracks: [
                {
                    id: 'movements', kind: 'movement',
                    clips: [{ id: 'm1', anchor: anchor(), data: { index: 0, title: 'One' } }]
                },
                {
                    id: 'threads', kind: 'thread',
                    clips: [{
                        id: 'g1',
                        anchor: anchor({ fromToken: 0, toToken: 3, quoteStart: 'The first', quoteEnd: 'first division' }),
                        cue: { kind: 'gloss', text: 'The plain sense of the opening.' }
                    }]
                }
            ]
        } : undefined
    });
}

function fakePlayer(head = 1, state = 'playing') {
    const player = {
        state,
        sessionState: { currentIndex: head },
        pause: vi.fn(() => { player.state = 'paused'; }),
        play: vi.fn(() => { player.state = 'playing'; }),
        stop: vi.fn(),
        on: vi.fn(),
        setInterlocutionHandler: vi.fn()
    };
    return player;
}

function mount({ session = reading(), player = fakePlayer() } = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const chamber = new Chamber(container, { session, player });
    chamber.activate();
    return {
        chamber, container, player,
        button: container.querySelector('#dive-btn'),
        panel: container.querySelector('#chamber-undercurrent')
    };
}

// jsdom has no PointerEvent, and the handlers read only `button`.
const pointer = (type, target = document.body) =>
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }));

let now;

beforeEach(() => {
    now = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
});

describe('the dive control', () => {
    it('is offered on a reading that has something under it, and only there', () => {
        const withThreads = mount();
        expect(withThreads.button).not.toBeNull();
        expect(withThreads.panel).not.toBeNull();
        withThreads.chamber.destroy();

        const ordinary = mount({ session: reading({ threads: false }) });
        expect(ordinary.button).toBeNull();
        expect(ordinary.panel).toBeNull();
        ordinary.chamber.destroy();
    });

    it('is a real button, named, and says what it controls', () => {
        const { chamber, button, panel } = mount();
        expect(button.tagName).toBe('BUTTON');
        expect(button.getAttribute('aria-label')).toMatch(/under this passage/i);
        expect(button.getAttribute('aria-controls')).toBe(panel.id);
        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(panel.getAttribute('role')).toBe('region');
        expect(panel.getAttribute('aria-live')).toBe('polite');
        expect(panel.hidden).toBe(true);
        chamber.destroy();
    });
});

describe('touch', () => {
    it('refuses the browser\'s own long-press menu, so that a hold can be a glance', () => {
        const { chamber, button } = mount();
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        button.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        chamber.destroy();
    });
});

describe('a glance stays with its control', () => {
    it('captures the pointer on press, so the release comes back to the button', () => {
        const { chamber, button } = mount();
        button.setPointerCapture = vi.fn();
        pointer('pointerdown', button);
        expect(button.setPointerCapture).toHaveBeenCalledTimes(1);
        chamber.destroy();
    });

    it('opens just above the bar wherever the bar is, and never over it', () => {
        const { chamber, button, container, panel } = mount();
        vi.spyOn(container.querySelector('#chamber-controls'), 'getBoundingClientRect')
            .mockReturnValue({ top: 640, bottom: 780, left: 0, right: 390, width: 390, height: 140 });
        const height = vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(844);
        button.click();
        // 844 - 640 = 204 clear of the viewport foot, plus a 12px gap.
        expect(panel.style.bottom).toBe('216px');
        height.mockRestore();
        chamber.destroy();
    });
});

describe('reduced motion', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Chamber.css'), 'utf8');

    it('gives the panel its one animation only to a reader who has not asked for less', () => {
        expect(css.match(/animation:\s*under-arrive/g)).toHaveLength(1);
        expect(css).toMatch(
            /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*\.chamber-undercurrent:not\(\[hidden\]\)\s*\{[^}]*animation:\s*under-arrive/u
        );
    });

    it('animates nothing else about it', () => {
        const block = css.slice(css.indexOf('.chamber-undercurrent {'), css.indexOf('@media (prefers-reduced-motion: no-preference)'));
        expect(block).not.toMatch(/transition|animation/u);
    });
});

describe('a glance: press and hold', () => {
    it('opens on the press and holds the reading', () => {
        const { chamber, button, panel, player } = mount();
        pointer('pointerdown', button);
        expect(panel.hidden).toBe(false);
        expect(panel.textContent).toContain('The plain sense of the opening.');
        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect(player.pause).toHaveBeenCalledTimes(1);
        chamber.destroy();
    });

    it('surfaces on release after a hold, and the reading carries on', () => {
        const { chamber, button, panel, player } = mount();
        pointer('pointerdown', button);
        now += GLANCE_HOLD_MS + 50;
        pointer('pointerup', button);
        expect(panel.hidden).toBe(true);
        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(player.play).toHaveBeenCalledTimes(1);
        chamber.destroy();
    });
});

describe('an anchor: a quick press', () => {
    it('stays open, and a second press surfaces', () => {
        const { chamber, button, panel, player } = mount();
        pointer('pointerdown', button);
        now += 60;
        pointer('pointerup', button);
        expect(panel.hidden).toBe(false);
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(player.play).not.toHaveBeenCalled();

        pointer('pointerdown', button);
        pointer('pointerup', button);
        expect(panel.hidden).toBe(true);
        expect(button.getAttribute('aria-pressed')).toBe('false');
        expect(player.play).toHaveBeenCalledTimes(1);
        chamber.destroy();
    });

    it('does not count the click a press is followed by as a second press', () => {
        const { chamber, button, panel } = mount();
        pointer('pointerdown', button);
        now += 60;
        pointer('pointerup', button);
        button.click();
        expect(panel.hidden).toBe(false);
        chamber.destroy();
    });
});

describe('without a pointer or a hold: a screen reader, or a plain click', () => {
    it('a click anchors, and the next click surfaces', () => {
        const { chamber, button, panel } = mount();
        button.click();
        expect(panel.hidden).toBe(false);
        expect(button.getAttribute('aria-expanded')).toBe('true');
        button.click();
        expect(panel.hidden).toBe(true);
        chamber.destroy();
    });
});

describe('the keyboard', () => {
    const key = (type, init) => document.dispatchEvent(new KeyboardEvent(type, { bubbles: true, ...init }));

    it('holding D is a glance and tapping it is an anchor', () => {
        const { chamber, panel } = mount();
        key('keydown', { key: 'd', code: 'KeyD' });
        expect(panel.hidden).toBe(false);
        now += GLANCE_HOLD_MS + 10;
        key('keyup', { key: 'd', code: 'KeyD' });
        expect(panel.hidden).toBe(true);

        key('keydown', { key: 'd', code: 'KeyD' });
        now += 40;
        key('keyup', { key: 'd', code: 'KeyD' });
        expect(panel.hidden).toBe(false);
        chamber.destroy();
    });

    it('does not treat auto-repeat as another press', () => {
        const { chamber, player } = mount();
        key('keydown', { key: 'd', code: 'KeyD' });
        key('keydown', { key: 'd', code: 'KeyD', repeat: true });
        key('keydown', { key: 'd', code: 'KeyD', repeat: true });
        expect(player.pause).toHaveBeenCalledTimes(1);
        chamber.destroy();
    });

    it('leaves the arrow keys to pace and the shuttle', () => {
        const { chamber, panel } = mount();
        for (const name of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
            key('keydown', { key: name, code: name });
            key('keyup', { key: name, code: name });
        }
        expect(panel.hidden).toBe(true);
        chamber.destroy();
    });

    it('does not dive while the reader is typing', () => {
        const { chamber, container, panel } = mount();
        const field = document.createElement('input');
        container.appendChild(field);
        field.focus();
        field.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', code: 'KeyD', bubbles: true }));
        expect(panel.hidden).toBe(true);
        chamber.destroy();
    });

    it('Enter and Space on the button behave as a press and a release', () => {
        const { chamber, button, panel } = mount();
        button.focus();
        button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
        expect(panel.hidden).toBe(false);
        now += 40;
        button.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
        expect(panel.hidden).toBe(false);
        chamber.destroy();
    });
});

describe('leaving a dive', () => {
    it('Escape surfaces, and is not taken for the exit prompt', () => {
        const { chamber, button, container, panel } = mount();
        button.click();
        expect(chamber.handleEscape()).toBe(true);
        expect(panel.hidden).toBe(true);
        expect(container.querySelector('#exit-confirm-overlay')?.style.display || 'none').not.toBe('flex');
        chamber.destroy();
    });

    it('pressing play while diving surfaces and reads on', () => {
        const { chamber, button, panel, player } = mount();
        button.click();
        player.play.mockClear();
        chamber.togglePlayPause(true);
        expect(panel.hidden).toBe(true);
        expect(player.play).toHaveBeenCalledTimes(1);
        chamber.destroy();
    });

    it('resumes only what the dive paused: a reading already paused stays paused', () => {
        const { chamber, button, player } = mount({ player: fakePlayer(1, 'paused') });
        button.click();
        button.click();
        expect(player.pause).not.toHaveBeenCalled();
        expect(player.play).not.toHaveBeenCalled();
        chamber.destroy();
    });

    it('surfaces before the Page opens, and hides the control while it is open', async () => {
        const { chamber, button, panel } = mount();
        button.click();
        await chamber.togglePageMode(true);
        expect(panel.hidden).toBe(true);
        expect(button.hidden).toBe(true);
        await chamber.togglePageMode(false);
        expect(button.hidden).toBe(false);
        chamber.destroy();
    });
});

describe('what lies under the passage the reading is at', () => {
    it('is read from the head, so a passage with nothing under it says so', () => {
        const { chamber, button, panel } = mount({ player: fakePlayer(14) });
        button.click();
        expect(panel.textContent).toBe('Nothing lies under this passage.');
        chamber.destroy();
    });

    it('never moves the head', () => {
        const { chamber, button, player } = mount({ player: fakePlayer(1) });
        button.click();
        button.click();
        expect(player.sessionState.currentIndex).toBe(1);
        chamber.destroy();
    });
});

describe('with the real Player: same atom, nothing skipped', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.useFakeTimers({
            toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
                'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame']
        });
    });
    afterEach(() => vi.useRealTimers());

    async function run({ dive }) {
        const session = reading();
        const player = new Player(session);
        const seen = [];
        player.on('atom', ({ index }) => seen.push(index));
        let complete = false;
        player.on('complete', () => { complete = true; });
        const { chamber, button } = mount({ session, player });

        player.play();
        await vi.advanceTimersByTimeAsync(260);
        const before = player.sessionState.currentIndex;

        if (dive) {
            button.click();
            expect(player.state).toBe('paused');
            const held = player.sessionState.currentIndex;
            await vi.advanceTimersByTimeAsync(30_000);
            expect(player.sessionState.currentIndex).toBe(held);
            button.click();
            expect(player.state).toBe('playing');
            expect(player.sessionState.currentIndex).toBe(held);
        }

        await vi.advanceTimersByTimeAsync(60_000);
        chamber.destroy();
        return { seen, before, complete, count: session.atoms.length };
    }

    it('presents every atom once, in order, whether or not the reader dived', async () => {
        const straight = await run({ dive: false });
        const dived = await run({ dive: true });

        expect(dived.seen).toEqual(straight.seen);
        expect(dived.seen).toEqual(Array.from({ length: dived.count }, (_, i) => i));
        expect(dived.complete).toBe(true);
    });

    it('holds the reading at the atom it was on for as long as the reader looks', async () => {
        const { before } = await run({ dive: true });
        expect(before).toBeGreaterThan(0);
    });
});
