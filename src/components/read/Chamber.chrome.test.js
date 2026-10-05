/**
 * A Chamber under a host that draws its own controls.
 *
 * With `chrome: 'none'` the Chamber is the field, the words and the progress
 * hairline, and nothing else: no hover bar, no key handler, no exit dialog,
 * and when the reading completes no closing screen, since the host shows
 * what comes next. The host also sets the colour theme over the reading,
 * through `setColourTheme`, and that must reach the container's variables,
 * the filament already turning, and every field mounted after it, without
 * recolouring the reading's own data.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';
import { Player } from '../../core/player.js';
import { compileRiseCurrent } from '../../core/rise-current.js';
import { JEV_PALETTES } from '../../core/jev-palette.js';

// Two attractor passages either side of a genesis one: the director keeps a
// field whose cue has not changed, so the third passage mounts a new filament
// only because the second replaced the first.
const SEGMENTS = [
    { id: 'a', text: 'A black hole is a region where gravity is strong.', visual: 'attractor' },
    { id: 'b', text: 'Its boundary is called the event horizon.', visual: 'genesis' },
    { id: 'c', text: 'Nothing that crosses it can return.', visual: 'attractor' }
];

const current = () => compileRiseCurrent({
    schema: 'rise.current.v1',
    id: 'chamber-chrome',
    title: 'Chamber chrome',
    theme: 'classic',
    origin: { kind: 'human', name: 'Tester' },
    segments: SEGMENTS
});

const mounted = [];

function mount(options = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const session = current();
    const player = new Player(session);
    const chamber = new Chamber(container, { session, player, hostPlays: true, ...options });
    chamber.activate();
    mounted.push(chamber);
    return { chamber, player, container, session };
}

/** Cue the passage whose source is `sourceId`, and hand back the filament it put up. */
function showPassage(chamber, sourceId) {
    const atom = chamber.session.atoms.find(candidate => candidate.sourceId === sourceId);
    chamber._visualSchedule.observe(atom);
    return chamber.attractorField;
}

const variable = (container, name) => container.style.getPropertyValue(name);

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
});

afterEach(() => {
    mounted.splice(0).forEach(chamber => chamber.destroy());
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("chrome: 'none'", () => {
    it('builds the reading surface and nothing of its own around it', () => {
        const { container } = mount({ chrome: 'none' });
        expect(container.querySelector('#chamber-display')).not.toBeNull();
        expect(container.querySelector('#atom-display')).not.toBeNull();
        expect(container.querySelector('.chamber-progress')).not.toBeNull();
        expect(container.querySelector('#chamber-controls')).toBeNull();
        expect(container.querySelector('#chamber-post')).toBeNull();
        expect(container.querySelector('#exit-confirm-overlay')).toBeNull();
    });

    it('keeps today\'s chrome when the option is absent', () => {
        const { container } = mount();
        expect(container.querySelector('#chamber-controls')).not.toBeNull();
        expect(container.querySelector('#chamber-post')).not.toBeNull();
        expect(container.querySelector('#exit-confirm-overlay')).not.toBeNull();
    });

    it('binds no key handler, so Space on the document reaches nothing', () => {
        const space = () => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));

        const bare = mount({ chrome: 'none' });
        const bareToggle = vi.spyOn(bare.chamber, 'togglePlayPause');
        space();
        expect(bareToggle).not.toHaveBeenCalled();
        bare.chamber.destroy();

        // The same key still drives a Chamber with its chrome, so the check can see a handler.
        const dressed = mount();
        const dressedToggle = vi.spyOn(dressed.chamber, 'togglePlayPause');
        space();
        expect(dressedToggle).toHaveBeenCalledTimes(1);
    });

    it('answers Escape without asking to end the reading, and without leaving it', () => {
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const { chamber, player } = mount({ chrome: 'none' });
        const stop = vi.spyOn(player, 'stop');
        expect(chamber.handleEscape()).toBe(true);
        expect(confirm).not.toHaveBeenCalled();
        expect(stop).not.toHaveBeenCalled();
    });

    it('holds the last frame when the reading completes, and shows no closing screen', () => {
        const { chamber, player, container } = mount({ chrome: 'none' });
        const field = showPassage(chamber, 'a');
        expect(field.rafId).not.toBeNull();

        player.emit('complete', {});
        vi.advanceTimersByTime(2_000);

        expect(field.paused).toBe(true);
        expect(field.destroyed).toBeFalsy();
        expect(chamber._visualFieldDirector.paused).toBe(true);
        const display = container.querySelector('#chamber-display');
        expect(display.style.display).not.toBe('none');
        expect(display.style.opacity).not.toBe('0');
        expect(container.querySelector('#chamber-post')).toBeNull();
    });
});

describe('setColourTheme', () => {
    it('paints the container in the theme and recolours the filament already turning', () => {
        const { chamber, container } = mount({ chrome: 'none' });
        const field = showPassage(chamber, 'a');
        expect(field.palette).toBe('gold');
        const setPalette = vi.spyOn(field, 'setPalette');

        expect(chamber.setColourTheme('jade')).toBe(true);

        expect(variable(container, '--color-void')).toBe(JEV_PALETTES.jade.background);
        expect(variable(container, '--color-light')).toBe(JEV_PALETTES.jade.text);
        expect(variable(container, '--color-accent')).toBe(JEV_PALETTES.jade.accent);
        expect(setPalette).toHaveBeenCalledWith('jade');
        expect(field.palette).toBe('jade');
    });

    it('refuses anything but the nine themes and changes nothing', () => {
        const { chamber, container } = mount({ chrome: 'none' });
        const field = showPassage(chamber, 'a');
        for (const theme of ['neon', 'JADE', '', undefined, 7]) {
            expect(chamber.setColourTheme(theme)).toBe(false);
        }
        expect(variable(container, '--color-void')).toBe(JEV_PALETTES.classic.background);
        expect(field.palette).toBe('gold');
    });

    it('mounts a later field in the chosen theme and leaves the cue as written', () => {
        const { chamber } = mount({ chrome: 'none' });
        const cues = [];
        const apply = chamber.applyScheduledVisualCue.bind(chamber);
        chamber.applyScheduledVisualCue = (cue, meta) => { cues.push(cue); return apply(cue, meta); };
        const first = showPassage(chamber, 'a');
        chamber.setColourTheme('jade');
        showPassage(chamber, 'b');
        const third = showPassage(chamber, 'c');

        expect(third).not.toBe(first);
        expect(third.palette).toBe('jade');
        expect(cues.at(-1).config.palette).toBe('gold');
    });

    it('restores the reading\'s own colours and palette for null', () => {
        const { chamber, container } = mount({ chrome: 'none' });
        const field = showPassage(chamber, 'a');
        chamber.setColourTheme('jade');

        expect(chamber.setColourTheme(null)).toBe(true);

        expect(variable(container, '--color-void')).toBe(JEV_PALETTES.classic.background);
        expect(variable(container, '--color-light')).toBe(JEV_PALETTES.classic.text);
        expect(field.palette).toBe('gold');
    });
});
