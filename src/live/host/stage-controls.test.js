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
import { ATTRACTOR_VISUAL_MANIFEST } from '../../core/visual-control-contract.js';
import { manifestFor } from '../../scenes/manifests.js';

const snapshot = (status, extra = {}) => ({
    status, error: null, main: { voiceDegraded: false, speaking: null, segmentId: 's1', ...extra.main }, side: null, ...(extra.error ? { error: extra.error } : {}),
    pace: extra.pace ?? 1, paceFrom: extra.paceFrom ?? null, position: extra.position ?? null
});

const SEGMENTS = [{ text: 'first line', ended: true }, { text: 'second line', ended: true }, { text: 'still being written', ended: false }];

const ATTRACTOR_DISCOVERY = { manifest: ATTRACTOR_VISUAL_MANIFEST, current: { intensity: 0.65 }, target: { intensity: 0.65 } };

function fakeRuntime(initial = 'live', { visual = true, discovery = ATTRACTOR_DISCOVERY } = {}) {
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
        discoverVisual: vi.fn(() => (visual ? discovery : null)),
        controlVisual: vi.fn(command => { calls.push(['controlVisual', command]); return { status: 'accepted', surface: 'attractor', parameter: 'intensity', requested: command.value, effective: command.value }; }),
        seek: vi.fn(target => { calls.push(['seek', target]); }),
        replay: vi.fn(() => { calls.push(['replay']); }),
        setPace: vi.fn(rate => { calls.push(['setPace', rate]); runtime.set(state.status, { position: state.position, pace: rate }); }),
        passages: vi.fn(() => []),
        set(status, extra) { state = snapshot(status, extra); for (const fn of [...listeners]) fn(state); },
        calls
    };
    return runtime;
}

/** The Chamber the stage reaches for colour and the two saved settings; it records what it was told. */
function fakeChamber(saved = {}) {
    return {
        setColourTheme: vi.fn(() => true),
        onSettingsChange: vi.fn(),
        getSettings: () => ({ reducedMotion: false, fontSize: 'medium', ...saved })
    };
}

let stage;
const $ = selector => document.querySelector(selector);
const play = () => $('#rise-stage-controls [data-stage="play"]');
const settings = () => $('#rise-stage-controls [data-stage="settings"]');
const status = () => $('#rise-stage-controls .rise-stage__status');
const sheet = () => $('#rise-settings');
const intensity = () => $('#rise-settings input[type="range"]');
const theme = () => $('#rise-settings select');
const still = () => $('#rise-settings [role="switch"]');
const chips = () => [...$('#rise-settings [role="radiogroup"]').querySelectorAll('input[type="radio"]')];
const change = control => control.dispatchEvent(new Event('change', { bubbles: true }));

afterEach(() => {
    stage?.destroy();
    stage = null;
    document.body.replaceChildren();
    vi.restoreAllMocks();
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

    // jsdom says a document has the focus only while one of its elements has it; a browser's frame has it with
    // the focus on its body too, which is where it is once the pressed control is gone.
    const frameHasFocus = has => vi.spyOn(document, 'hasFocus').mockReturnValue(has);

    it('takes the focus when asked, once it can be pressed, so a keyboard reader who pressed Play is on Pause', () => {
        frameHasFocus(true);
        const runtime = fakeRuntime('starting');
        stage = createStageControls({ runtime, onPlayAgain: () => {}, takeFocus: true });
        expect(document.activeElement).not.toBe(play());
        runtime.set('live');
        expect(document.activeElement).toBe(play());
    });

    it('never takes the focus from where the reader has put it, from a frame that has lost it, nor unless asked', () => {
        const left = frameHasFocus(false);
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, takeFocus: true });
        expect(document.activeElement).not.toBe(play());
        stage.destroy();
        left.mockRestore();

        const elsewhere = document.createElement('button');
        document.body.append(elsewhere);
        const runtime = fakeRuntime('starting');
        stage = createStageControls({ runtime, onPlayAgain: () => {}, takeFocus: true });
        elsewhere.focus();
        runtime.set('live');
        expect(document.activeElement).toBe(elsewhere);
        stage.destroy();

        elsewhere.blur();
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {} });
        expect(document.activeElement).not.toBe(play());
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

    it('looks finished at the end: Play again is drawn apart from the Play of a paused reading', () => {
        const runtime = fakeRuntime('interrupted');
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        const paused = play().innerHTML;
        runtime.set('ended');
        expect(play().innerHTML).not.toBe(paused);
        runtime.set('interrupted');
        expect(play().innerHTML).toBe(paused);
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

    it('carries the no-voice mark while the voice is given up on, says Play tries it again, and clears once it speaks', () => {
        const runtime = fakeRuntime('live');
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        expect(play().dataset.voice).toBeUndefined();
        runtime.set('live', { main: { voiceDegraded: true } });
        expect(play().dataset.voice).toBe('none');
        expect(play().querySelector('.rise-stage__novoice')).not.toBeNull();
        expect(play().getAttribute('aria-label')).toBe('Pause (silent, the voice did not start; Play tries it again)');
        runtime.set('interrupted', { main: { voiceDegraded: true } });
        expect(play().getAttribute('aria-label')).toBe('Play (silent, the voice did not start; Play tries it again)');
        runtime.set('live', { main: { voiceDegraded: false, speaking: 's1' } });
        expect(play().dataset.voice).toBeUndefined();
        expect(play().querySelector('.rise-stage__novoice')).toBeNull();
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
    it('is a dialog inside the stage with four rows, opened and closed by the object without pausing', () => {
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
        expect([...sheet().querySelectorAll('.rise-settings__row')].map(row => row.firstElementChild.textContent)).toEqual(['Intensity', 'Theme', 'Still imagery', 'Text size']);
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

    it('hides its row on a passage with no adjustable visual, as most looks draw (SCR-003)', () => {
        stage = createStageControls({ runtime: fakeRuntime('live', { visual: false }), onPlayAgain: () => {} });
        settings().click();
        expect(intensity().disabled).toBe(true);
        expect(intensity().closest('.rise-settings__row').hidden).toBe(true);
        expect(intensity().getAttribute('title')).toBeNull();
        // The sheet still opened with its first enabled control focused, never a list: a list focused in the
        // press that opened the sheet opens its picker on iOS.
        expect(document.activeElement).not.toBe(theme());
        expect(document.activeElement).toBe(still());
    });

    it('never opens with a list focused, whatever is enabled: the first control that is not a list takes it', () => {
        stage = createStageControls({ runtime: fakeRuntime('live', { visual: false }), onPlayAgain: () => {}, audible: false });
        still().disabled = true;
        settings().click();
        expect(document.activeElement?.tagName).not.toBe('SELECT');
        expect(sheet().contains(document.activeElement)).toBe(true);
    });

    it('shows its row only for a field whose intensity changes while it runs: the attractor, not the flame', () => {
        const row = () => intensity().closest('.rise-settings__row');
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {} });
        settings().click();
        expect(row().hidden).toBe(false);
        expect(intensity().disabled).toBe(false);
        stage.destroy();

        const flame = { manifest: manifestFor('living-flame'), current: { energy: 0.35, intensity: 0.35 }, target: { energy: 0.35, intensity: 0.35 } };
        stage = createStageControls({ runtime: fakeRuntime('live', { discovery: flame }), onPlayAgain: () => {} });
        settings().click();
        expect(row().hidden).toBe(true);
        expect(intensity().disabled).toBe(true);
        stage.destroy();

        stage = createStageControls({ runtime: fakeRuntime('live', { visual: false }), onPlayAgain: () => {} });
        settings().click();
        expect(row().hidden).toBe(true);
        expect(intensity().disabled).toBe(true);
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

describe('the other three rows', () => {
    const THEMES = [['classic', 'Classic'], ['amethyst', 'Amethyst'], ['prism', 'Prism'], ['ember', 'Ember'], ['cobalt', 'Cobalt'], ['jade', 'Jade'], ['rose', 'Rose'], ['citrine', 'Citrine'], ['silver', 'Silver']];

    it('Theme offers As written then the nine themes in their order, and drives the frame and the Chamber at once', () => {
        const chamber = fakeChamber();
        const paintTheme = vi.fn();
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, chamber: () => chamber, paintTheme });
        settings().click();
        expect(theme().labels[0].textContent).toBe('Theme');
        expect([...theme().options].map(option => [option.value, option.textContent])).toEqual([['', 'As written'], ...THEMES]);
        expect(theme().value).toBe('');
        theme().value = 'jade';
        change(theme());
        expect(paintTheme).toHaveBeenCalledWith('jade');
        expect(chamber.setColourTheme).toHaveBeenCalledWith('jade');
        theme().value = '';
        change(theme());
        expect(paintTheme).toHaveBeenLastCalledWith(null);
        expect(chamber.setColourTheme).toHaveBeenLastCalledWith(null);
    });

    it('Still imagery is a switch, off until the reader turns it on, saved through the Chamber, and said in the status', () => {
        const chamber = fakeChamber();
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, chamber: () => chamber });
        settings().click();
        expect(still().labels[0].textContent).toBe('Still imagery');
        expect(still().type).toBe('checkbox');
        expect(still().checked).toBe(false);
        expect(still().disabled).toBe(false);
        expect(still().getAttribute('aria-describedby')).toBeNull();
        expect(status().textContent).not.toContain('stays still');
        still().click();
        expect(chamber.onSettingsChange).toHaveBeenCalledWith('reducedMotion', true);
        expect(status().textContent).toContain('Imagery stays still.');
        still().click();
        expect(chamber.onSettingsChange).toHaveBeenLastCalledWith('reducedMotion', false);
        expect(status().textContent).not.toContain('stays still');
    });

    it('Still imagery opens on when the reader saved it, and the status says so before the sheet is ever opened', () => {
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, chamber: () => fakeChamber({ reducedMotion: true }) });
        expect(status().textContent).toContain('Imagery stays still.');
        settings().click();
        expect(still().checked).toBe(true);
        expect(still().disabled).toBe(false);
    });

    it('Still imagery is on and disabled, with a hidden reason, while the system asks for reduced motion', () => {
        const chamber = fakeChamber();
        stage = createStageControls({
            runtime: fakeRuntime('live'), onPlayAgain: () => {}, chamber: () => chamber,
            degradations: [{ capability: 'reducedMotion', effect: 'Reduced motion is on. Imagery stays still.' }]
        });
        settings().click();
        expect(still().checked).toBe(true);
        expect(still().disabled).toBe(true);
        const note = document.getElementById(still().getAttribute('aria-describedby'));
        expect(note.textContent).toBe('Your system asks for reduced motion.');
        expect(note.hidden).toBe(true);
        expect(still().getAttribute('title')).toBeNull();
        expect(chamber.onSettingsChange).not.toHaveBeenCalled();
        expect(status().textContent.match(/stays still/gu)).toHaveLength(1);
    });

    it('Text size is a radiogroup of four chips, M unless a size was saved, applied through the Chamber', () => {
        const chamber = fakeChamber();
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, chamber: () => chamber });
        settings().click();
        const group = $('#rise-settings [role="radiogroup"]');
        expect(document.getElementById(group.getAttribute('aria-labelledby')).textContent).toBe('Text size');
        expect(chips().map(chip => chip.value)).toEqual(['small', 'medium', 'large', 'xlarge']);
        expect(chips().map(chip => chip.labels[0].textContent)).toEqual(['S', 'M', 'L', 'XL']);
        expect(chips().find(chip => chip.checked).value).toBe('medium');
        chips()[3].click();
        expect(chamber.onSettingsChange).toHaveBeenCalledWith('fontSize', 'xlarge');

        stage.destroy();
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, chamber: () => fakeChamber({ fontSize: 'large' }) });
        settings().click();
        expect(chips().find(chip => chip.checked).value).toBe('large');
    });

    it('every row is a native control the keyboard reaches', () => {
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, chamber: () => fakeChamber() });
        settings().click();
        for (const control of [intensity(), theme(), still(), chips()[0]]) {
            control.focus();
            expect(document.activeElement, control.id || control.value).toBe(control);
        }
        expect(sheet().querySelectorAll('[tabindex], div[role="radio"], div[role="switch"]')).toHaveLength(0);
    });

    it('choices made before the Chamber is on screen reach it once it is', () => {
        const runtime = fakeRuntime('starting');
        let chamber = null;
        const paintTheme = vi.fn();
        stage = createStageControls({ runtime, onPlayAgain: () => {}, chamber: () => chamber, paintTheme });
        settings().click();
        theme().value = 'rose';
        change(theme());
        still().click();
        chips()[0].click();
        expect(paintTheme).toHaveBeenCalledWith('rose');
        chamber = fakeChamber();
        runtime.set('live');
        expect(chamber.setColourTheme).toHaveBeenCalledWith('rose');
        expect(chamber.onSettingsChange.mock.calls).toEqual([['reducedMotion', true], ['fontSize', 'small']]);
        runtime.set('live', { main: { speaking: 'x' } });
        expect(chamber.setColourTheme).toHaveBeenCalledTimes(1);
    });
});

describe('About this reading', () => {
    const ABOUT = 'voice: browser "Samantha" en-US local=true\nspeech starts: 3';
    const panel = () => sheet().querySelector('details.rise-settings__about');
    const copy = () => panel().querySelector('.rise-settings__copy');

    it('is not in the sheet when the host has nothing to say about the reading', () => {
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {} });
        expect(panel()).toBeNull();
    });

    it('is collapsed at the foot of the sheet, and shows what the host says as plain text, fresh at each opening', () => {
        let said = ABOUT;
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, about: () => said });
        expect(panel().open).toBe(false);
        expect(sheet().lastElementChild).toBe(panel());
        expect(panel().querySelector('summary').textContent).toBe('About this reading');
        settings().click();
        expect(panel().querySelector('pre').textContent).toBe(ABOUT);
        settings().click();
        said = `${ABOUT}\nspeech starts: 4`;
        settings().click();
        expect(panel().querySelector('pre').textContent).toBe(said);
        // Not one of the setting rows, and not a stop of its own beyond its summary and Copy.
        expect([...sheet().querySelectorAll('.rise-settings__row')]).toHaveLength(4);
    });

    it('Copy puts the text on the clipboard, or selects it where the clipboard is refused', async () => {
        const writeText = vi.fn(async () => {});
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        try {
            stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, about: () => ABOUT });
            settings().click();
            copy().click();
            await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(ABOUT));
            await vi.waitFor(() => expect(copy().textContent).toBe('Copied'));
            writeText.mockRejectedValueOnce(new Error('denied'));
            copy().click();
            await vi.waitFor(() => expect(document.getSelection().toString()).toBe(ABOUT));
            expect(copy().textContent).toBe('Selected');
        } finally {
            delete navigator.clipboard;
        }
    });
});

describe('the stage as a card', () => {
    it('nothing in it scrolls in a frame of the height it asks for: no stage rule sets an overflow that can scroll', () => {
        // A clip (the three-line title) is not a scroll; `auto` and `scroll` are what "No nested scrolling" forbids.
        // The one exception is a frame the host made shorter than the card's 481 px, where the sheet would leave the top.
        const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'LiveHost.css'), 'utf8');
        const squeezed = css.match(/@media \(max-height: 480px\) \{([\s\S]*?)\n\}/u)?.[1] ?? '';
        expect(squeezed.match(/[^{}]*\{[^}]*\}/gu)).toEqual([expect.stringMatching(/^\s*\.rise-settings\s*\{[^}]*max-height:[^}]*overflow:\s*auto/u)]);
        const rules = css.replace(squeezed, '').match(/[^{}]*\{[^}]*\}/gu).filter(rule => /rise-stage|rise-settings|live-host--poster|live-host--embedded/u.test(rule.split('{')[0]));
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

// ─── the transport (Playback as a real instrument, PLY-001) ─────────────

const PASSAGES = [
    { segmentId: 'beat-0', spoken: true },
    { segmentId: 'beat-1', spoken: false },
    { segmentId: 'beat-2', spoken: true },
    { segmentId: 'beat-3', spoken: true },
    { segmentId: 'beat-4', spoken: false }
];
const at = index => ({ segmentId: PASSAGES[index].segmentId, segmentIndex: index, segmentCount: PASSAGES.length, atomIndex: index * 2, atomCount: 10, spoken: PASSAGES[index].spoken });

/** A runtime with a reading of five passages, at `index`. */
function reading(status = 'live', index = 1, extra = {}) {
    const runtime = fakeRuntime(status);
    runtime.passages.mockReturnValue(PASSAGES);
    runtime.set(status, { position: at(index), ...extra });
    return runtime;
}

const object = name => $(`#rise-stage-controls [data-stage="${name}"]`);
const objects = () => [...document.querySelectorAll('#rise-stage-controls .rise-stage__object')].filter(node => !node.hidden).map(node => node.dataset.stage);
const ticks = () => [...document.querySelectorAll('#rise-stage-controls .rise-stage__beat')];
const press = (key, target = play()) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

describe('the transport', () => {
    it('sets back, forward, replay and pace beside Play/Pause, Settings at the right, each named and showing no words but the pace', () => {
        stage = createStageControls({ runtime: reading(), onPlayAgain: () => {} });
        expect(objects()).toEqual(['back', 'play', 'forward', 'replay', 'pace', 'settings']);
        expect(object('back').getAttribute('aria-label')).toBe('Back a passage');
        expect(object('forward').getAttribute('aria-label')).toBe('Forward a passage');
        expect(object('replay').getAttribute('aria-label')).toBe('Say this passage again');
        expect(object('pace').getAttribute('aria-label')).toBe('Pace, 1 times');
        for (const name of ['back', 'forward', 'replay']) expect(object(name).textContent, name).toBe('');
        expect(object('pace').textContent).toBe('1×');
        for (const name of ['back', 'play', 'forward', 'replay', 'pace', 'settings']) expect(object(name).getAttribute('type'), name).toBe('button');
    });

    it('goes back and forward a passage, and says this one again, through the runtime', () => {
        const runtime = reading();
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        object('back').click();
        object('forward').click();
        object('replay').click();
        expect(runtime.calls).toEqual([['seek', { delta: -1 }], ['seek', { delta: 1 }], ['replay']]);
    });

    it('cannot go back from the first passage nor on from the last, and says so without hiding the object', () => {
        const runtime = reading('live', 0);
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        expect(object('back').getAttribute('aria-disabled')).toBe('true');
        expect(object('forward').getAttribute('aria-disabled')).toBe('false');
        object('back').click();
        expect(runtime.seek).not.toHaveBeenCalled();
        runtime.set('live', { position: at(4) });
        expect(object('back').getAttribute('aria-disabled')).toBe('false');
        expect(object('forward').getAttribute('aria-disabled')).toBe('true');
        object('forward').click();
        expect(runtime.seek).not.toHaveBeenCalled();
    });

    it('cannot say a passage again, or move, before the reading has begun', () => {
        const runtime = fakeRuntime('starting');
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        for (const name of ['back', 'forward', 'replay']) expect(object(name).getAttribute('aria-disabled'), name).toBe('true');
        object('replay').click();
        expect(runtime.replay).not.toHaveBeenCalled();
        runtime.passages.mockReturnValue(PASSAGES);
        runtime.set('live', { position: at(2) });
        expect(object('replay').getAttribute('aria-disabled')).toBe('false');
    });

    it('cycles the pace 0.8, 1, 1.25, 1.5 and round again, each press setting the voice’s rate and the object showing it', () => {
        const runtime = reading();
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        const shown = [];
        for (let i = 0; i < 4; i += 1) {
            object('pace').click();
            shown.push([object('pace').textContent, object('pace').getAttribute('aria-label')]);
        }
        expect(runtime.setPace.mock.calls.map(([rate]) => rate)).toEqual([1.25, 1.5, 0.8, 1]);
        expect(shown).toEqual([['1.25×', 'Pace, 1.25 times'], ['1.5×', 'Pace, 1.5 times'], ['0.8×', 'Pace, 0.8 times'], ['1×', 'Pace, 1 times']]);
    });

    it('draws one tick per passage above the objects, the current lit, those before it passed, the unspoken dimmer, and a tap goes there', () => {
        const runtime = reading('live', 2);
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        expect(ticks()).toHaveLength(5);
        expect(ticks().map(tick => tick.dataset.spoken)).toEqual(['true', 'false', 'true', 'true', 'false']);
        expect(ticks().map(tick => tick.dataset.state)).toEqual(['passed', 'passed', 'current', 'ahead', 'ahead']);
        // A pointer's way to a passage: the keyboard has the arrows, so the line is not in the tab order.
        expect($('.rise-stage__beats').getAttribute('aria-hidden')).toBe('true');
        for (const tick of ticks()) expect(tick.tabIndex).toBe(-1);
        ticks()[3].click();
        expect(runtime.seek).toHaveBeenLastCalledWith({ segmentId: 'beat-3' });
        runtime.set('live', { position: at(3) });
        expect(ticks().map(tick => tick.dataset.state)).toEqual(['passed', 'passed', 'passed', 'current', 'ahead']);
    });

    it('says in the hidden status which passage it is, of how many, as it changes', () => {
        const runtime = reading('interrupted', 1);
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        expect(status().textContent).toBe('Paused. Passage 2 of 5.');
        runtime.set('interrupted', { position: at(4) });
        expect(status().textContent).toBe('Paused. Passage 5 of 5.');
    });
});

describe('a change of pace, heard', () => {
    const note = () => $('#rise-stage-controls .rise-stage__pace-note');

    it('says in a hidden live region where a new pace lands, and again once it has; the object shows it at once', () => {
        const runtime = reading();
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        expect(note().getAttribute('aria-live')).toBe('polite');
        expect(note().classList.contains('rise-stage__sr')).toBe(true);
        expect(note().textContent).toBe('');
        runtime.set('live', { position: at(1), pace: 1.25, paceFrom: 'passage' });
        expect(object('pace').textContent).toBe('1.25×');
        expect(note().textContent).toBe('Pace 1.25×, from the next passage.');
        // A render for anything else says nothing new.
        runtime.set('live', { position: at(2), pace: 1.25, paceFrom: 'passage' });
        expect(note().textContent).toBe('Pace 1.25×, from the next passage.');
        runtime.set('live', { position: at(2), pace: 1.25, paceFrom: null });
        expect(note().textContent).toBe('Pace 1.25×.');
        runtime.set('live', { position: at(2), pace: 1.5, paceFrom: 'sentence' });
        expect(note().textContent).toBe('Pace 1.5×, from the next sentence.');
    });

    it('says a pace taken at once as it is', () => {
        const runtime = reading();
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        object('pace').click();
        expect(note().textContent).toBe('Pace 1.25×.');
    });
});

describe('the bar while the reading plays', () => {
    const bar = () => $('#rise-stage-controls').dataset.bar;
    const pointer = (type, pointerType, target = document) => {
        const event = new MouseEvent(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'pointerType', { value: pointerType });
        target.dispatchEvent(event);
    };

    afterEach(() => { vi.useRealTimers(); });

    it('hides itself after 2.5 s with no pointer movement while the reading plays', () => {
        vi.useFakeTimers();
        stage = createStageControls({ runtime: reading('live'), onPlayAgain: () => {} });
        expect(bar()).toBe('shown');
        vi.advanceTimersByTime(2_499);
        expect(bar()).toBe('shown');
        vi.advanceTimersByTime(1);
        expect(bar()).toBe('hidden');
    });

    it('shows again on pointer movement, a touch, a key on the stage, or focus entering it, and hides 2.5 s after', () => {
        vi.useFakeTimers();
        stage = createStageControls({ runtime: reading('live'), onPlayAgain: () => {} });
        const wakes = {
            pointermove: () => pointer('pointermove', 'mouse'),
            touch: () => pointer('pointerdown', 'touch'),
            key: () => play().dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true })),
            focus: () => { play().blur(); play().focus(); }
        };
        for (const [name, wake] of Object.entries(wakes)) {
            vi.advanceTimersByTime(2_500);
            expect(bar(), name).toBe('hidden');
            wake();
            expect(bar(), name).toBe('shown');
            vi.advanceTimersByTime(2_499);
            expect(bar(), name).toBe('shown');
        }
        vi.advanceTimersByTime(1);
        expect(bar()).toBe('hidden');
    });

    it('never hides while paused, ended or with the Settings sheet open, and shows at once when the reading stops playing', () => {
        vi.useFakeTimers();
        const runtime = reading('interrupted');
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        vi.advanceTimersByTime(10_000);
        expect(bar()).toBe('shown');
        runtime.set('live', { position: at(1) });
        vi.advanceTimersByTime(2_500);
        expect(bar()).toBe('hidden');
        runtime.set('interrupted', { position: at(1) });
        expect(bar()).toBe('shown');
        runtime.set('ended', { position: at(4) });
        vi.advanceTimersByTime(10_000);
        expect(bar()).toBe('shown');
        runtime.set('live', { position: at(1) });
        settings().click();
        vi.advanceTimersByTime(10_000);
        expect(bar()).toBe('shown');
        $('.rise-settings__close').click();
        vi.advanceTimersByTime(2_500);
        expect(bar()).toBe('hidden');
    });

    it('takes a first touch on the hidden bar only to show it; a mouse press acts', () => {
        vi.useFakeTimers();
        const runtime = reading('live');
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        vi.advanceTimersByTime(2_500);
        pointer('pointerdown', 'touch', play());
        play().click();
        expect(runtime.interrupt).not.toHaveBeenCalled();
        expect(bar()).toBe('shown');
        play().click();
        expect(runtime.interrupt).toHaveBeenCalledTimes(1);
        runtime.set('live', { position: at(1) });
        vi.advanceTimersByTime(2_500);
        pointer('pointerdown', 'mouse', play());
        play().click();
        expect(runtime.interrupt).toHaveBeenCalledTimes(2);
    });

    it('fades in 180 ms, at once under reduced motion, keeps the beat line faint as progress, and gives the words the room back', () => {
        const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'LiveHost.css'), 'utf8');
        expect(css).toMatch(/\.rise-stage\[data-bar="hidden"\] \.rise-stage__object\s*\{[^}]*opacity:\s*0/u);
        expect(css).toMatch(/\.rise-stage__object\s*\{[^}]*transition:[^}]*opacity 180ms/u);
        expect(css).toMatch(/\.rise-stage\[data-bar="hidden"\] \.rise-stage__beats\s*\{[^}]*opacity:\s*0\.\d+/u);
        // The field is the box every visual's canvas is sized to: the bar never changes it. The words move by the band's transform.
        const hidden = [...css.matchAll(/\[data-bar="hidden"\]\)[^{]*\.chamber-field\s*\{([^}]*)\}/gu)].map(match => match[1]);
        expect(hidden.length).toBe(2);
        for (const rule of hidden) expect(rule).toMatch(/^\s*--bar-offset:\s*\d+px;\s*$/u);
        expect(css).toMatch(/@property --bar-offset\s*\{[^}]*syntax:\s*'<length>'/u);
        expect(css).toMatch(/html\[data-embed="mcp"\] \.chamber-field\s*\{\s*transition:\s*--bar-offset 180ms/u);
        expect(css).not.toMatch(/transition:[^;]*padding/u);
        const chamber = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../components/read/Chamber.css'), 'utf8');
        const bands = chamber.match(/transform: translateY\([^;]*--band-offset[^;]*;/gu);
        expect(bands.length).toBe(2);
        for (const band of bands) expect(band).toContain('var(--bar-offset, 0px)');
        const still = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/gu)].map(match => match[1]).join('\n');
        expect(still).toMatch(/\.rise-stage__beats[^{]*\{[^}]*transition:\s*none/u);
        expect(still).toMatch(/\.chamber-field[^{]*\{[^}]*transition:\s*none/u);
        expect(still).toMatch(/\.rise-stage__object[^{]*\{[^}]*transition:\s*none/u);
    });
});

describe('the keys, heard on the stage', () => {
    it('ArrowLeft and ArrowRight move a passage, R says it again, minus and equals (and the brackets) step the pace', () => {
        const runtime = reading('live', 2);
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        for (const key of ['ArrowLeft', 'ArrowRight', 'r', 'R', '=', '+', ']', '-', '[']) expect(press(key), key).toBe(false);
        expect(runtime.calls).toEqual([
            ['seek', { delta: -1 }], ['seek', { delta: 1 }], ['replay'], ['replay'],
            ['setPace', 1.25], ['setPace', 1.5], ['setPace', 1.25], ['setPace', 1]
        ]);
        expect(object('back').getAttribute('aria-keyshortcuts')).toBe('ArrowLeft');
        expect(object('forward').getAttribute('aria-keyshortcuts')).toBe('ArrowRight');
        expect(object('replay').getAttribute('aria-keyshortcuts')).toBe('R');
    });

    it('steps the pace no further than its ends', () => {
        const runtime = reading('live', 2, { pace: 0.8 });
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        press('-');
        expect(runtime.setPace).not.toHaveBeenCalled();
        runtime.set('live', { position: at(2), pace: 1.5 });
        press('=');
        expect(runtime.setPace).not.toHaveBeenCalled();
    });

    it('Space plays and pauses from the stage itself; on a focused object it is that object’s own press', () => {
        const runtime = reading('live', 2);
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        expect(press(' ', stage.element)).toBe(false);
        expect(runtime.interrupt).toHaveBeenCalledTimes(1);
        expect(press(' ', object('forward'))).toBe(true);
        expect(runtime.interrupt).toHaveBeenCalledTimes(1);
    });

    it('is not heard from inside the Settings sheet or a field for words, nor with a modifier held', () => {
        const runtime = reading('live', 2);
        stage = createStageControls({ runtime, onPlayAgain: () => {} });
        settings().click();
        press('ArrowRight', intensity());
        press('r', theme());
        const field = document.createElement('textarea');
        stage.element.appendChild(field);
        press('ArrowLeft', field);
        play().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true, cancelable: true }));
        expect(runtime.calls).toEqual([]);
    });

    it('is described, hidden, to assistive technology in the Settings sheet', () => {
        stage = createStageControls({ runtime: reading(), onPlayAgain: () => {} });
        const described = document.getElementById(sheet().getAttribute('aria-describedby'));
        expect(described.classList.contains('rise-stage__sr')).toBe(true);
        expect(described.textContent).toMatch(/Left and Right arrows/u);
        expect(described.textContent).toMatch(/F/u);
    });
});

describe('filling the screen', () => {
    /** A host card's port whose host offers `modes`, and answers a request with the mode it is asked for. */
    function fakePort(modes, displayMode = 'inline') {
        const context = { availableDisplayModes: modes, displayMode };
        return {
            hostContext: () => context,
            onHostContext: () => () => {},
            requestDisplayMode: vi.fn(async mode => { context.displayMode = mode; return mode; })
        };
    }

    it('is not offered by a host card that shows the app inline only', () => {
        stage = createStageControls({ runtime: reading(), onPlayAgain: () => {}, port: fakePort(['inline']) });
        expect(object('fullscreen').hidden).toBe(true);
    });

    it('asks a host card that offers it for the full screen, and for inline on the second press', async () => {
        const port = fakePort(['inline', 'fullscreen']);
        stage = createStageControls({ runtime: reading(), onPlayAgain: () => {}, port });
        expect(objects()).toEqual(['back', 'play', 'forward', 'replay', 'pace', 'fullscreen', 'settings']);
        expect(object('fullscreen').getAttribute('aria-label')).toBe('Full screen');
        expect(object('fullscreen').getAttribute('aria-pressed')).toBe('false');
        object('fullscreen').click();
        await vi.waitFor(() => expect(object('fullscreen').getAttribute('aria-pressed')).toBe('true'));
        expect(port.requestDisplayMode).toHaveBeenLastCalledWith('fullscreen');
        press('f');
        await vi.waitFor(() => expect(object('fullscreen').getAttribute('aria-pressed')).toBe('false'));
        expect(port.requestDisplayMode).toHaveBeenLastCalledWith('inline');
    });

    it('pops out where the host floats the app instead', () => {
        const port = fakePort(['inline', 'pip']);
        stage = createStageControls({ runtime: reading(), onPlayAgain: () => {}, port });
        expect(object('fullscreen').getAttribute('aria-label')).toBe('Pop out');
        object('fullscreen').click();
        expect(port.requestDisplayMode).toHaveBeenCalledWith('pip');
    });

    it('outside a host card, fills the screen with the page where the browser allows it, and is not offered where it does not', () => {
        const enabled = Object.getOwnPropertyDescriptor(Document.prototype, 'fullscreenEnabled');
        try {
            Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true });
            stage = createStageControls({ runtime: reading(), onPlayAgain: () => {} });
            expect(object('fullscreen').hidden).toBe(true);
            stage.destroy();

            Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
            document.documentElement.requestFullscreen = vi.fn(async () => {});
            stage = createStageControls({ runtime: reading(), onPlayAgain: () => {} });
            expect(object('fullscreen').hidden).toBe(false);
            object('fullscreen').click();
            expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
        } finally {
            delete document.fullscreenEnabled;
            delete document.documentElement.requestFullscreen;
            if (enabled) Object.defineProperty(Document.prototype, 'fullscreenEnabled', enabled);
        }
    });
});

describe('the two transports', () => {
    it('minimal is the two objects of the 2026-10-05 decision and nothing more: no line, no passage sentence, no keys but their own', () => {
        const runtime = reading('interrupted', 1);
        stage = createStageControls({ runtime, onPlayAgain: () => {}, transport: 'minimal' });
        expect(objects()).toEqual(['play', 'settings']);
        expect([...document.querySelectorAll('#rise-stage-controls button[data-stage]')].map(node => node.dataset.stage)).toEqual(['play', 'settings']);
        expect($('.rise-stage__beats')).toBeNull();
        expect(status().textContent).toBe('Paused.');
        press('ArrowRight');
        press('r');
        expect(runtime.calls).toEqual([]);
        expect(sheet().hasAttribute('aria-describedby')).toBe(false);
    });

    it('full is the default', () => {
        stage = createStageControls({ runtime: reading(), onPlayAgain: () => {} });
        expect(stage.element.dataset.transport).toBe('full');
    });
});

describe('the row on a phone', () => {
    it('shrinks its objects to 36 px below 400 px, so seven fit in 320 without wrapping', () => {
        const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'LiveHost.css'), 'utf8');
        const narrow = css.match(/@media \(max-width: 399px\) \{([\s\S]*?)\n\}/u)?.[1] ?? '';
        expect(narrow).toMatch(/\.rise-stage__object\s*\{[^}]*width:\s*36px/u);
        expect(css).toMatch(/\.rise-stage__row\s*\{[^}]*flex-wrap:\s*nowrap/u);
    });

    it('keeps a 44 px press around each 36 px glass, which takes no room in the row', () => {
        const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'LiveHost.css'), 'utf8');
        const narrow = css.match(/@media \(max-width: 399px\) \{([\s\S]*?)\n\}/u)?.[1] ?? '';
        expect(narrow).toMatch(/\.rise-stage__object::before\s*\{[^}]*content:\s*''[^}]*position:\s*absolute[^}]*inset:\s*-4px/u);
        // The last object's press stays inside the row, so the row reaches no further than its box.
        expect(narrow).toMatch(/\.rise-stage__settings::before\s*\{\s*right:\s*0;?\s*\}/u);
    });

    it('takes a tap as a tap: no double-tap zoom on an object, no grey flash over the stage', () => {
        const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'LiveHost.css'), 'utf8');
        expect(css).toMatch(/\.rise-stage\s*\{[^}]*-webkit-tap-highlight-color:\s*transparent/u);
        expect(css).toMatch(/\.rise-stage__object\s*\{[^}]*touch-action:\s*manipulation/u);
    });
});

describe('the reading in the card, under a thumb', () => {
    const read = path => readFileSync(join(dirname(fileURLToPath(import.meta.url)), path), 'utf8');
    const rules = css => css.replace(/\/\*[\s\S]*?\*\//gu, '').match(/[^{}]*\{[^{}]*\}/gu) ?? [];
    const selectors = rule => rule.split('{')[0].split(',').map(selector => selector.trim());
    /** The bodies of every `@media <query> {…}` block, each to its closing brace at column 0. */
    const blocks = (css, query) => css.split(`@media ${query} {`).slice(1).map(part => part.split('\n}')[0]);

    it('a drag on selected words moves them and not the host; unselected words still let the host scroll', () => {
        const chamber = read('../../components/read/Chamber.css');
        expect(chamber).toMatch(/\.atom-display\.is-band-movable\s*\{[^}]*touch-action:\s*none/u);
        for (const rule of rules(chamber).filter(rule => /touch-action:\s*none/u.test(rule))) {
            for (const selector of selectors(rule)) expect(selector).toContain('.is-band-movable');
        }
    });

    it('the phone band paints its scrim only over words it holds, and keeps its height when it holds none', () => {
        const css = read('../../components/read/Chamber.css') + read('../../visuals/visuals.css');
        const guard = ':where(:not(:has(.atom-display:empty)):not(:has(.atom-display[data-place])))';
        const painting = rules(css).filter(rule => /\.atom-band:has\(\.atom-display\.glass-tile/u.test(rule.split('{')[0])
            && /background:\s*(?!transparent)|backdrop-filter:\s*blur/u.test(rule.split('{')[1]));
        expect(painting.length).toBe(2);
        for (const rule of painting) for (const selector of selectors(rule)) expect(selector.endsWith(guard), selector).toBe(true);
        // The box that holds the band's height and its move is not guarded: an empty band keeps its place.
        const layout = rules(css).find(rule => /\.atom-band:has\(\.atom-display\.glass-tile\)\s*\{/u.test(rule) && /display:\s*block/u.test(rule));
        expect(layout).toMatch(/translateY/u);
        expect(layout).not.toMatch(/background|backdrop-filter/u);
        expect(css).toMatch(/\.atom-display\.glass-tile:empty::before\s*\{\s*content:\s*"\\00a0"/u);
    });

    it('in the card the band keeps its scrim and drops its blur, which repaints with every frame of the picture', () => {
        const host = read('LiveHost.css');
        const phone = blocks(host, '(max-width: 640px)').join('\n');
        const unblurred = rules(phone).find(rule => /backdrop-filter:\s*none/u.test(rule));
        expect(unblurred).toBeDefined();
        for (const selector of selectors(unblurred)) expect(selector).toMatch(/^html\[data-embed="mcp"\] \.chamber \.chamber-field-(?:stream|genesis|night) \.atom-band:has\(\.atom-display\.glass-tile:not\(\.is-mask\)\)/u);
        expect(unblurred).toMatch(/-webkit-backdrop-filter:\s*none/u);
        expect(unblurred).not.toMatch(/background/u);
    });

    it('a short card keeps the phone face and the reader’s text size: the landscape type is the Reader’s alone', () => {
        const chamber = read('../../components/read/Chamber.css');
        const [landscape] = blocks(chamber, '(max-width: 900px) and (max-height: 480px) and (orientation: landscape)');
        expect(landscape).toBeDefined();
        for (const rule of rules(landscape)) {
            for (const selector of selectors(rule)) expect(selector.startsWith(':where(html:not([data-embed="mcp"])) '), selector).toBe(true);
        }
    });

    it('a placed caption on a phone takes a phone size and the reader’s text size, not the desktop scale', () => {
        const chamber = read('../../components/read/Chamber.css');
        const phone = blocks(chamber, '(max-width: 640px)').join('\n');
        const caption = rules(phone).find(rule => selectors(rule).includes('.atom-display[data-place="caption"]'));
        expect(caption).toMatch(/font-size:\s*calc\(clamp\(18px, 5\.4vw, 24px\) \* var\(--font-size-intent, 1\)\)/u);
        // After the desktop caption size, so it wins at the same specificity.
        expect(chamber.lastIndexOf('clamp(18px, 5.4vw, 24px)')).toBeGreaterThan(chamber.indexOf('font-size: calc(72px * var(--atom-scale, 1) * var(--font-size-intent, 1) * 0.7)'));
    });

    it('a top-placed beat on a picture card moves by the band offset like a caption', () => {
        const host = read('LiveHost.css');
        expect(host).toMatch(/\.atom-display:is\([^)]*\[data-place="top"\][^)]*\) \{\s*transform: translateY\(var\(--band-offset/u);
    });

    it('a long press on the words selects nothing and raises no callout in the card; the Reader keeps its selection', () => {
        const host = read('LiveHost.css');
        const rule = rules(host).find(candidate => selectors(candidate).includes('html[data-embed="mcp"] #atom-display'));
        expect(rule).toMatch(/-webkit-user-select:\s*none/u);
        expect(rule).toMatch(/[^-]user-select:\s*none/u);
        expect(rule).toMatch(/-webkit-touch-callout:\s*none/u);
        expect(read('../../components/read/Chamber.css')).not.toMatch(/(?:^|\n)#atom-display\s*\{[^}]*user-select:\s*none/u);
    });
});

// The stage serves only a host's card, and the connector needs no account (the directory's review): no sign-in in it.
describe('no account in the card', () => {
    it('offers no sign-in: the sheet’s head is its title and its close, and the sheet links nowhere', () => {
        const port = { hostContext: () => ({}), onHostContext: () => () => {}, openLink: vi.fn(async () => true) };
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, about: () => 'about', port });
        settings().click();
        const head = $('#rise-settings .rise-settings__head');
        expect([...head.children].map(node => node.textContent || node.getAttribute('aria-label'))).toEqual(['Settings', 'Close settings']);
        expect(sheet().querySelector('a[href]')).toBeNull();
        expect(sheet().textContent).not.toMatch(/sign in|SyberLabs/iu);
        expect(port.openLink).not.toHaveBeenCalled();
    });
});

describe('the Sound row', () => {
    const sound = () => $('#rise-settings-sound');
    /** A Chamber that also takes the sound choice through its look, as a reader's sound pick does. */
    const soundChamber = saved => Object.assign(fakeChamber(saved), { changeJevLook: vi.fn() });

    it('is offered only where there is an engine to play sound on', () => {
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, chamber: () => soundChamber() });
        expect(sound()).toBeNull();
        stage.destroy();
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, chamber: () => soundChamber(), sound: true });
        settings().click();
        expect([...sheet().querySelectorAll('.rise-settings__row')].map(row => row.firstElementChild.textContent)).toEqual(['Intensity', 'Theme', 'Still imagery', 'Sound', 'Text size']);
    });

    it('is a switch, on until the reader turns it off; off silences the reading’s sound through the Chamber and is remembered, on gives it back', () => {
        const chamber = soundChamber();
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, chamber: () => chamber, sound: true });
        settings().click();
        expect(sound().getAttribute('role')).toBe('switch');
        expect(sound().labels[0].textContent).toBe('Sound');
        expect(sound().checked).toBe(true);
        expect(chamber.changeJevLook).not.toHaveBeenCalled();
        sound().click();
        expect(chamber.changeJevLook).toHaveBeenLastCalledWith('jev-soundscape', 'none');
        expect(chamber.onSettingsChange).toHaveBeenLastCalledWith('cardSound', false);
        sound().click();
        expect(chamber.changeJevLook).toHaveBeenLastCalledWith('jev-soundscape', 'authored');
        expect(chamber.onSettingsChange).toHaveBeenLastCalledWith('cardSound', true);
    });

    it('opens off when the reader turned it off before, and the reading starts silent', () => {
        const chamber = soundChamber({ cardSound: false });
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, chamber: () => chamber, sound: true });
        expect(chamber.changeJevLook).toHaveBeenCalledWith('jev-soundscape', 'none');
        settings().click();
        expect(sound().checked).toBe(false);
    });

    it('a choice made before the Chamber is on screen reaches it when it arrives', () => {
        let mounted = null;
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, chamber: () => mounted, sound: true });
        settings().click();
        sound().click();
        mounted = soundChamber();
        settings().click();
        settings().click();
        expect(mounted.changeJevLook).toHaveBeenCalledWith('jev-soundscape', 'none');
    });
});

describe('the Voice row', () => {
    const select = () => $('#rise-settings-voice');
    const note = () => $('#rise-stage-controls .rise-stage__voice-note');
    const VOICES = [{ name: 'Samantha', local: true }, { name: 'Ava (Premium)', local: true }, { name: 'Google US English', local: false }];

    it('lists the installed voices after Automatic, marks a network one, and shows the reader’s own as chosen', () => {
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, voice: { voices: VOICES, selected: 'Ava (Premium)', choose: () => {} } });
        settings().click();
        expect([...sheet().querySelectorAll('.rise-settings__row')].map(row => row.firstElementChild.textContent)).toEqual(['Intensity', 'Theme', 'Still imagery', 'Voice', 'Text size']);
        expect([...select().options].map(option => [option.value, option.textContent])).toEqual([
            ['', 'Automatic'], ['Samantha', 'Samantha'], ['Ava (Premium)', 'Ava (Premium)'], ['Google US English', 'Google US English (network)']
        ]);
        expect(select().value).toBe('Ava (Premium)');
        expect(select().labels[0].textContent).toBe('Voice');
    });

    it('shares Sound’s row when the reading has sound too, so the sheet is no taller: the switch, then the voice', () => {
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, sound: true, voice: { voices: VOICES, selected: '', choose: () => {} } });
        settings().click();
        expect([...sheet().querySelectorAll('.rise-settings__row')].map(row => row.firstElementChild.textContent)).toEqual(['Intensity', 'Theme', 'Still imagery', 'Sound & voice', 'Text size']);
        const row = $('#rise-settings-sound').closest('.rise-settings__row');
        expect([...row.querySelectorAll('input, select')].map(control => control.id)).toEqual(['rise-settings-sound', 'rise-settings-voice']);
        expect($('#rise-settings-sound').getAttribute('aria-label')).toBe('Sound');
        expect(select().getAttribute('aria-label')).toBe('Voice');
    });

    it('is not offered without voices, or without a voice to choose', () => {
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, voice: { voices: [], selected: '', choose: () => {} } });
        expect(select()).toBeNull();
        stage.destroy();
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {} });
        expect(select()).toBeNull();
    });

    it('gives the choice to the host and says it lands with the next passage; Automatic says so too', () => {
        const choose = vi.fn();
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, voice: { voices: VOICES, selected: '', choose } });
        settings().click();
        expect(note().getAttribute('aria-live')).toBe('polite');
        expect(note().textContent).toBe('');
        select().value = 'Ava (Premium)';
        change(select());
        expect(choose).toHaveBeenLastCalledWith('Ava (Premium)');
        expect(note().textContent).toBe('Voice: Ava (Premium), from the next passage.');
        select().value = '';
        change(select());
        expect(choose).toHaveBeenLastCalledWith('');
        expect(note().textContent).toBe('Voice: Automatic, from the next passage.');
    });

    it('escapes a voice’s name: it is the device’s text, not markup', () => {
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, voice: { voices: [{ name: '<b>x</b>', local: true }], selected: '', choose: () => {} } });
        expect(select().options[1].textContent).toBe('<b>x</b>');
        expect(select().querySelector('b')).toBeNull();
    });
});

describe('a room of many readings (the venue)', () => {
    it('carries the reader’s theme and intensity to the next reading’s stage and Chamber, and paints the frame at once', () => {
        const room = {};
        const first = fakeChamber();
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, chamber: () => first, room });
        settings().click();
        theme().value = 'ember';
        change(theme());
        intensity().value = '0.5';
        intensity().dispatchEvent(new Event('input', { bubbles: true }));
        stage.destroy();

        const next = fakeChamber();
        const paintTheme = vi.fn();
        const runtime = fakeRuntime('live');
        stage = createStageControls({ runtime, onPlayAgain: () => {}, chamber: () => next, paintTheme, room });
        expect(paintTheme).toHaveBeenCalledWith('ember');
        expect(next.setColourTheme).toHaveBeenCalledWith('ember');
        expect(runtime.controlVisual).toHaveBeenCalledWith({ surface: 'attractor', parameter: 'intensity', value: 0.5 });
        settings().click();
        expect(theme().value).toBe('ember');
    });

    it('keeps nothing between two stages without a room, as in a card', () => {
        const chamber = fakeChamber();
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, chamber: () => chamber });
        settings().click();
        theme().value = 'ember';
        change(theme());
        stage.destroy();
        const next = fakeChamber();
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, chamber: () => next });
        expect(next.setColourTheme).not.toHaveBeenCalled();
        settings().click();
        expect(theme().value).toBe('');
    });
});

describe('the reader’s Settings choices, kept for perception (the RISE Live design, §4)', () => {
    it('notes each choice in the runtime’s journal once it is made, and the intensity once the slider is let go', () => {
        const runtime = Object.assign(fakeRuntime('live'), { noteSetting: vi.fn() });
        const chamber = Object.assign(fakeChamber(), { changeJevLook: vi.fn() });
        stage = createStageControls({
            runtime, onPlayAgain: () => {}, chamber: () => chamber, sound: true,
            voice: { voices: [{ name: 'Samantha', local: true }], selected: '', choose: () => {} }
        });
        settings().click();
        intensity().value = '0.55';
        intensity().dispatchEvent(new Event('input', { bubbles: true }));
        expect(runtime.noteSetting).not.toHaveBeenCalled();
        change(intensity());
        theme().value = 'jade';
        change(theme());
        theme().value = '';
        change(theme());
        still().click();
        $('#rise-settings-sound').click();
        $('#rise-settings-voice').value = 'Samantha';
        change($('#rise-settings-voice'));
        chips()[3].click();
        expect(runtime.noteSetting.mock.calls).toEqual([
            ['intensity', 0.55], ['theme', 'jade'], ['theme', null], ['still', true], ['sound', false], ['voice', 'Samantha'], ['textSize', 'xlarge']
        ]);
    });

    it('works with a runtime that keeps no such journal', () => {
        stage = createStageControls({ runtime: fakeRuntime('live'), onPlayAgain: () => {}, chamber: () => fakeChamber() });
        settings().click();
        theme().value = 'jade';
        expect(() => change(theme())).not.toThrow();
    });
});
