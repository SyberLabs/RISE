/**
 * The stage inside a ChatGPT card: two objects and what a screen reader hears.
 *
 * The stage draws no reading and keeps no time; it shows what the runtime says
 * and asks the runtime for things. So the runtime here is a fake that records
 * what it was asked, and the assertions are about names and wiring: the one
 * object is Play, Pause or Play again by state, every state has a hidden
 * sentence, the whole reading is reachable without sight or sound, and the
 * Settings sheet drives the field through the runtime's visual contract.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStageControls } from './stage-controls.js';

const snapshot = (status, extra = {}) => ({
    status, error: null, main: { voiceDegraded: false, speaking: null, segmentId: 's1', ...extra.main }, side: null, ...(extra.error ? { error: extra.error } : {})
});

const SEGMENTS = [{ text: 'first line', ended: true }, { text: 'second line', ended: true }, { text: 'still being written', ended: false }];

function fakeRuntime(initial = 'live', { visual = true } = {}) {
    const listeners = new Set();
    let state = snapshot(initial);
    const calls = [];
    const runtime = {
        get status() { return state.status; },
        snapshot: () => state,
        subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
        composed: () => ({ segments: SEGMENTS }),
        interrupt: vi.fn(async () => { calls.push(['interrupt']); runtime.set('interrupted'); }),
        resume: vi.fn(() => { calls.push(['resume']); runtime.set('live'); }),
        discoverVisual: vi.fn(() => (visual
            ? { manifest: { surface: 'attractor', parameters: { intensity: { minimum: 0.4, maximum: 0.75 } } }, current: { intensity: 0.65 }, target: { intensity: 0.65 } }
            : null)),
        controlVisual: vi.fn(command => { calls.push(['controlVisual', command]); return { status: 'accepted', surface: 'attractor', parameter: 'intensity', requested: command.value, effective: command.value }; }),
        set(status, extra) { state = snapshot(status, extra); for (const fn of [...listeners]) fn(state); },
        calls
    };
    return runtime;
}

let stage;
const $ = selector => document.querySelector(selector);
const play = () => $('#rise-stage-controls [data-stage="play"]');
const settings = () => $('#rise-stage-controls [data-stage="settings"]');
const status = () => $('#rise-stage-controls .rise-stage__status');
const sheet = () => $('#rise-settings');
const intensity = () => $('#rise-settings input[type="range"]');

afterEach(() => {
    stage?.destroy();
    stage = null;
    document.body.replaceChildren();
});

describe('the one object', () => {
    it('is Pause while playing and asks the runtime to interrupt', () => {
        const runtime = fakeRuntime('live');
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        expect(play().getAttribute('aria-label')).toBe('Pause');
        expect(play().getAttribute('type')).toBe('button');
        expect(play().textContent).toBe('');
        play().click();
        expect(runtime.interrupt).toHaveBeenCalledTimes(1);
    });

    it('is Play while paused and asks the runtime to resume', () => {
        const runtime = fakeRuntime('interrupted');
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        expect(play().getAttribute('aria-label')).toBe('Play');
        play().click();
        expect(runtime.resume).toHaveBeenCalledTimes(1);
        expect(play().getAttribute('aria-label')).toBe('Pause');
    });

    it('is disabled and named Starting until the reading is live', () => {
        const runtime = fakeRuntime('starting');
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        expect(play().disabled).toBe(true);
        expect(play().getAttribute('aria-label')).toBe('Starting');
        runtime.set('live');
        expect(play().disabled).toBe(false);
    });

    it('is Play again once the reading has ended, and asks the host, never the finished runtime', () => {
        const runtime = fakeRuntime('ended');
        const onPlayAgain = vi.fn();
        stage = createStageControls({ runtime, onPlayAgain });
        expect(play().getAttribute('aria-label')).toBe('Play again');
        play().click();
        expect(onPlayAgain).toHaveBeenCalledTimes(1);
        expect(runtime.resume).not.toHaveBeenCalled();
        expect(runtime.interrupt).not.toHaveBeenCalled();
    });

    it('is hidden, with Settings, when the reading failed or was stopped', () => {
        const runtime = fakeRuntime('live');
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        expect(settings().hidden).toBe(false);
        runtime.set('failed', { error: { message: 'the key was refused' } });
        expect(play().hidden).toBe(true);
        expect(settings().hidden).toBe(true);
        runtime.set('stopped');
        expect(play().hidden).toBe(true);
    });

    it('carries the silent names and the no-voice mark when no voice is installed', () => {
        const runtime = fakeRuntime('live');
        stage = createStageControls({ runtime, onPlayAgain: () => {}, audible: false, degradations: [{ capability: 'speechOutput', effect: 'No voice is installed for this browser.' }] });
        expect(play().dataset.voice).toBe('none');
        expect(play().getAttribute('aria-label')).toBe('Pause (silent, no voice is installed)');
        runtime.set('interrupted');
        expect(play().getAttribute('aria-label')).toBe('Play (silent, no voice is installed)');
    });

    it('names the other reason when the browser cannot speak at all', () => {
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, audible: false, degradations: [{ capability: 'speechOutput', effect: 'This browser cannot speak.' }] });
        expect(play().getAttribute('aria-label')).toBe('Pause (silent, this browser cannot speak)');
    });

    it('has no mark when the voice is merely chosen silent', () => {
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, audible: false });
        expect(play().dataset.voice).toBeUndefined();
        expect(play().getAttribute('aria-label')).toBe('Pause');
    });
});

describe('what a screen reader hears', () => {
    it('has a hidden status sentence for every state, and no visible one', () => {
        const runtime = fakeRuntime('starting');
        stage = createStageControls({ runtime, onPlayAgain: () => {}, audible: false });
        expect(status().getAttribute('role')).toBe('status');
        expect(status().getAttribute('aria-live')).toBe('polite');
        expect(status().textContent).toBe('Starting…');
        runtime.set('live', { main: { speaking: 's1' } });
        expect(status().textContent).toBe('Reading, paced as if spoken.');
        runtime.set('interrupted');
        expect(status().textContent).toBe('Paused.');
        runtime.set('ended');
        expect(status().textContent).toBe('Finished.');
    });

    it('says why the reading is silent, once, and that imagery stays still', () => {
        const runtime = fakeRuntime('live');
        stage = createStageControls({
            runtime, onPlayAgain: () => {}, audible: false,
            degradations: [{ capability: 'speechOutput', effect: 'No voice is installed for this browser.' }, { capability: 'reducedMotion', effect: 'Reduced motion is on. Imagery stays still.' }]
        });
        expect(status().textContent).toBe('Reading, paced as if spoken. No voice is installed for this browser. Reduced motion is on. Imagery stays still.');
        expect(status().textContent.match(/paced as if/gu)).toHaveLength(1);
    });

    it('shows the one failure sentence as an alert, and nothing else visible', () => {
        const runtime = fakeRuntime('live');
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        const alert = $('#rise-stage-controls [role="alert"]');
        expect(alert.hidden).toBe(true);
        runtime.set('failed', { error: { message: 'the key was refused' } });
        expect(alert.hidden).toBe(false);
        expect(alert.textContent).toBe('It could not be answered: the key was refused.');
    });

    it('holds every sentence of the reading in a hidden list from the start', () => {
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {} });
        const list = $('#rise-stage-controls ol');
        expect(list.getAttribute('aria-label')).toBe('The whole reading');
        expect([...list.children].map(item => item.textContent)).toEqual(['first line', 'second line', 'still being written']);
    });

    it('reads each committed sentence only while the reading is silent', () => {
        const runtime = fakeRuntime('live');
        stage = createStageControls({ runtime, onPlayAgain: () => {}, audible: false });
        const said = $('#rise-stage-controls .rise-stage__said');
        expect(said.getAttribute('aria-live')).toBe('polite');
        expect(said.textContent).toBe('second line');

        stage.destroy();
        const spoken = fakeRuntime('live');
        stage = createStageControls({ runtime: spoken, onPlayAgain: () => {}, audible: true });
        const quiet = $('#rise-stage-controls .rise-stage__said');
        expect(quiet.getAttribute('aria-live')).toBe('off');
        expect(quiet.textContent).toBe('');
        spoken.set('live', { main: { voiceDegraded: true } });
        expect(quiet.getAttribute('aria-live')).toBe('polite');
        expect(quiet.textContent).toBe('second line');
    });
});

describe('the Settings sheet', () => {
    it('is a dialog inside the stage with one Intensity row, opened and closed by the object without pausing', () => {
        const runtime = fakeRuntime('live');
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        expect(sheet().hidden).toBe(true);
        expect(settings().getAttribute('aria-expanded')).toBe('false');
        settings().click();
        expect(sheet().hidden).toBe(false);
        expect(sheet().closest('#rise-stage-controls')).not.toBeNull();
        expect(sheet().getAttribute('role')).toBe('dialog');
        expect(sheet().getAttribute('aria-modal')).toBe('false');
        expect(sheet().getAttribute('aria-label')).toBe('Settings');
        expect(settings().getAttribute('aria-expanded')).toBe('true');
        expect([...sheet().querySelectorAll('input, select, [role="switch"], [role="radiogroup"]')].map(control => control.type ?? control.getAttribute('role'))).toEqual(['range']);
        expect(intensity().labels[0].textContent).toBe('Intensity');
        expect(intensity()).toMatchObject({ min: '0.4', max: '0.75', step: '0.05', value: '0.65' });
        expect(runtime.interrupt).not.toHaveBeenCalled();
        settings().click();
        expect(sheet().hidden).toBe(true);
    });

    it('moves focus to the first enabled control on open and back to the object on close, and Escape closes it', () => {
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {} });
        settings().click();
        expect(document.activeElement).toBe(intensity());
        sheet().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(sheet().hidden).toBe(true);
        expect(document.activeElement).toBe(settings());
    });

    it('closes on its close target and on a press outside, and never on a press inside', () => {
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {} });
        settings().click();
        intensity().dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(sheet().hidden).toBe(false);
        document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(sheet().hidden).toBe(true);
        settings().click();
        sheet().querySelector('button').click();
        expect(sheet().hidden).toBe(true);
    });

    it('Intensity sends the runtime a bounded visual command, says how vivid, and stamps the accepted value on the stage', () => {
        const runtime = fakeRuntime('interrupted');
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        settings().click();
        intensity().value = '0.55';
        intensity().dispatchEvent(new Event('input', { bubbles: true }));
        expect(runtime.controlVisual).toHaveBeenCalledWith({ surface: 'attractor', parameter: 'intensity', value: 0.55 });
        expect(intensity().getAttribute('aria-valuetext')).toBe('43 percent vivid');
        expect($('#rise-stage-controls').dataset.intensity).toBe('0.55');
    });

    it('does not stamp a refused command', () => {
        const runtime = fakeRuntime('live');
        runtime.controlVisual = vi.fn(() => ({ status: 'refused', code: 'NO_ACTIVE_VISUAL' }));
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        settings().click();
        intensity().value = '0.5';
        intensity().dispatchEvent(new Event('input', { bubbles: true }));
        expect($('#rise-stage-controls').dataset.intensity).toBeUndefined();
    });

    it('is disabled, with a hidden reason, on a passage with no adjustable visual', () => {
        stage = createStageControls({ runtime: fakeRuntime('live', { visual: false }), onPlayAgain: () => {} });
        settings().click();
        expect(intensity().disabled).toBe(true);
        const note = document.getElementById(intensity().getAttribute('aria-describedby'));
        expect(note.textContent).toBe('Not on this passage');
        expect(note.hidden).toBe(true);
        expect(intensity().getAttribute('title')).toBeNull();
        // The sheet still opened with its first enabled control focused: the close target.
        expect(document.activeElement).toBe(sheet().querySelector('button'));
    });

    it('sends the chosen intensity again when the reading moves to a new passage', () => {
        const runtime = fakeRuntime('live');
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        settings().click();
        intensity().value = '0.5';
        intensity().dispatchEvent(new Event('input', { bubbles: true }));
        expect(runtime.controlVisual).toHaveBeenCalledTimes(1);
        runtime.set('live', { main: { segmentId: 's2' } });
        expect(runtime.controlVisual).toHaveBeenCalledTimes(2);
        expect(runtime.controlVisual).toHaveBeenLastCalledWith({ surface: 'attractor', parameter: 'intensity', value: 0.5 });
        runtime.set('live', { main: { segmentId: 's2', speaking: 'x' } });
        expect(runtime.controlVisual).toHaveBeenCalledTimes(2);
    });
});

describe('the stage as a card', () => {
    it('nothing in it scrolls: no stage rule sets an overflow that can scroll', () => {
        // A clip (the three-line title) is not a scroll; `auto` and `scroll` are what "No nested scrolling" forbids.
        const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'LiveHost.css'), 'utf8');
        const rules = css.match(/[^{}]*\{[^}]*\}/gu).filter(rule => /rise-stage|rise-settings|live-host--poster|live-host--embedded/u.test(rule.split('{')[0]));
        expect(rules.length).toBeGreaterThan(0);
        for (const rule of rules) expect(rule, rule).not.toMatch(/overflow(?:-[xy])?\s*:\s*(?:auto|scroll|overlay)/u);
    });

    it('binds no key handler on the document', () => {
        const added = vi.spyOn(document, 'addEventListener');
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {} });
        expect(added.mock.calls.filter(([type]) => type.startsWith('key'))).toEqual([]);
        added.mockRestore();
    });

    it('can be destroyed twice, and lets go of the runtime', () => {
        const runtime = fakeRuntime('live');
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        stage.destroy();
        stage.destroy();
        expect($('#rise-stage-controls')).toBeNull();
        runtime.set('interrupted');
    });
});
