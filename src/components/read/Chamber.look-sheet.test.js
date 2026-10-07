/**
 * The reading bar and its one Look sheet (RDR-022, part A).
 *
 * A reader-origin reading carries at most seven buttons in its bar, plus Dive
 * when the text has threads. Everything that changes the picture lives in one
 * Look sheet: a modal dialog that takes focus, keeps Tab inside, closes on
 * Escape and hands focus back to Look. A host that draws its own controls
 * (`chrome: 'none'`) gets neither.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';
import { compileSession } from '../../core/session-compiler.js';
import { buildJevVisualProgram } from '../../core/jev-sequence.js';
import { JEV_INKS, JEV_PALETTES } from '../../core/jev-palette.js';
import { JEV_COLOR_THEMES } from '../../core/jev-color-themes.js';
import { applyLook } from '../../core/looks.js';
import { SOUND_GROUPS } from '../../audio/sound-list.js';
import { flamePreset, FLAME_PRESET_IDS } from '../../visuals/living-flame/flame-presets.js';
import { visualCortex } from '../../visuals/visual-cortex.js';

const atoms = [
  { content: 'First', duration: 1000, sourceId: 'primary', sourceProgress: 0 },
  { content: 'Second', duration: 1000, sourceId: 'primary', sourceProgress: 0.2 },
  { content: 'Third', duration: 1000, sourceId: 'primary', sourceProgress: 0.8 }
];

const gallery = { visualMode: 'interlocution', interlocution: { presentation: 'continuous', procedural: ['turrell'] } };

const streamReading = (overrides = {}) => ({
  title: 'A stream', atoms, totalDuration: 3000, wpm: 200, visualConfig: gallery, ...overrides
});

const jevReading = () => streamReading({
  origin: { view: 'home', experience: 'jev' },
  visualConfig: { visualMode: 'interlocution', interlocution: { presentation: 'continuous' } },
  visualProgram: buildJevVisualProgram({
    visualArc: 'dual', arcSplit: '70', visualEngine: 'klee',
    middleEngine: 'turrell', finaleEngine: 'fractal',
    colorTheme: 'classic', middleTheme: 'amethyst', finaleTheme: 'prism'
  })
});

// A Library division whose shelf draws the attractor among flashing engines:
// before this sheet its bar carried Visuals, Visual direction and Kaleidoscope.
const libraryReading = () => streamReading({
  origin: { view: 'library' },
  continuation: { noun: 'chapter', next: { id: 'middlemarch:2' } },
  visualConfig: {
    visualMode: 'interlocution',
    interlocution: { presentation: 'full-frame', procedural: ['turrell', 'attractor'], attractor: { form: 'flow' } }
  }
});

const threaded = () => compileSession({
  title: 'Under', text: 'The first division says one thing. It says it plainly.',
  chunkMode: 'word', wpm: 600, visualConfig: { visualMode: 'off' },
  experienceProgram: {
    schema: 'rise.experience-program.v1', id: 'under', authority: 'user', editable: true,
    tracks: [{
      id: 'movements', kind: 'movement',
      clips: [{ id: 'm1', anchor: { sourceIds: ['primary'] }, data: { index: 0, title: 'One' } }]
    }, {
      id: 'threads', kind: 'thread',
      clips: [{
        id: 'g1',
        anchor: { sourceIds: ['primary'], fromToken: 0, toToken: 3, quoteStart: 'The first', quoteEnd: 'first division' },
        cue: { kind: 'gloss', text: 'The plain sense of the opening.' }
      }]
    }]
  }
});

/** The session a look hands the Chamber: the Orbital's config, with the visual orbit renamed. */
function lookReading(id) {
  const { visualInterlocution, ...config } = applyLook({}, id);
  return streamReading({ ...config, visualConfig: visualInterlocution });
}

function fakePlayer() {
  const player = {
    state: 'playing',
    sessionState: { currentIndex: 0 },
    pause: vi.fn(() => { player.state = 'paused'; }),
    play: vi.fn(() => { player.state = 'playing'; }),
    stop: vi.fn(),
    on: vi.fn(),
    setInterlocutionHandler: vi.fn(),
    setSpeedFactor: vi.fn(),
    shuttleAvailable: false
  };
  return player;
}

function mount(session, options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const chamber = new Chamber(container, {
    session,
    player: fakePlayer(),
    getSettings: () => ({ fontSize: 'medium', masterVolume: 0.75 }),
    ...options
  });
  chamber.activate();
  return { chamber, container, sheet: container.querySelector('#look-sheet') };
}

/** Every bar button a reader can see: not hidden, and not inside something hidden. */
const barButtons = container => [...container.querySelectorAll('#chamber-controls button')]
  .filter(button => !button.hidden && !button.closest('[hidden]'))
  .map(button => button.id);

const open = container => container.querySelector('#look-btn').click();

function stubFullscreen() {
  document.documentElement.requestFullscreen = () => Promise.resolve();
}

function canvasStubs() {
  window.matchMedia = () => ({ matches: false });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    setTransform() {}, clearRect() {}, save() {}, restore() {}, translate() {},
    rotate() {}, scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    fill() {}, arc() {}, drawImage() {}, createRadialGradient: () => ({ addColorStop() {} })
  });
  vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
}

const input = (element, value) => {
  element.value = String(value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
};

afterEach(() => {
  delete document.documentElement.requestFullscreen;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('the reading bar', () => {
  const SIX = ['play-pause-btn', 'look-btn', 'page-mode-btn', 'fullscreen-btn', 'chamber-settings-btn', 'exit-btn'];

  it.each([
    ['a Stream reading', streamReading],
    ['a Jev reading', jevReading],
    ['a Library reading', libraryReading]
  ])('carries the same six buttons for %s', (_name, reading) => {
    stubFullscreen();
    const { chamber, container } = mount(reading());
    expect(barButtons(container)).toEqual(SIX);
    for (const id of ['visuals-toggle-btn', 'visual-direction-btn', 'kaleidoscope-btn', 'jev-next-scene', 'jev-look-btn']) {
      expect(container.querySelector(`#chamber-controls #${id}`)).toBeNull();
    }
    chamber.destroy();
  });

  it('adds Dive beyond the six only when the text has threads', () => {
    stubFullscreen();
    const { chamber, container } = mount(threaded());
    const buttons = barButtons(container);
    expect(buttons).toHaveLength(7);
    expect(buttons).toContain('dive-btn');
    chamber.destroy();
  });

  it('keeps Page view’s own turn and Elongate out of the Stream bar', () => {
    const { chamber, container } = mount(streamReading());
    for (const id of ['page-prev', 'page-next', 'page-elongate']) {
      expect(barButtons(container)).not.toContain(id);
    }
    chamber.destroy();
  });
});

describe('the Look sheet', () => {
  it('opens from Look as a modal dialog that takes focus', () => {
    const { chamber, container, sheet } = mount(streamReading());
    const look = container.querySelector('#look-btn');
    expect(look.getAttribute('aria-controls')).toBe('look-sheet');
    expect(sheet.hidden).toBe(true);
    open(container);
    expect(sheet.hidden).toBe(false);
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(look.getAttribute('aria-expanded')).toBe('true');
    expect(sheet.contains(document.activeElement)).toBe(true);
    // A look is not a pause: Next scene, for one, asks for a playing reading.
    expect(chamber.player.pause).not.toHaveBeenCalled();
    chamber.destroy();
  });

  it('names the look the reading is in, and Custom when it is in none', () => {
    const signal = mount(lookReading('signal'));
    open(signal.container);
    expect(signal.container.querySelector('#look-sheet-name').textContent).toBe('Signal');
    signal.chamber.destroy();

    const custom = mount(streamReading());
    open(custom.container);
    expect(custom.container.querySelector('#look-sheet-name').textContent).toBe('Custom');
    custom.chamber.destroy();
  });

  it('closes on Escape and hands focus back to Look', () => {
    const { chamber, container, sheet } = mount(streamReading());
    open(container);
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(sheet.hidden).toBe(true);
    expect(document.activeElement).toBe(container.querySelector('#look-btn'));
    expect(container.querySelector('#look-btn').getAttribute('aria-expanded')).toBe('false');
    chamber.destroy();
  });

  it('marks the Chamber while the sheet is open, so the reading can make room beside it', () => {
    const { chamber, container } = mount(streamReading());
    expect(container.classList.contains('is-look-open')).toBe(false);
    open(container);
    expect(container.classList.contains('is-look-open')).toBe(true);
    container.querySelector('#look-sheet-close').click();
    expect(container.classList.contains('is-look-open')).toBe(false);
    open(container);
    expect(container.classList.contains('is-look-open')).toBe(true);
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(container.classList.contains('is-look-open')).toBe(false);
    chamber.destroy();
  });

  it('lays the reading out beside the side sheet on a desk, and never on a phone', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Chamber.css'), 'utf8');
    const desk = css.match(/@media \(min-width: 641px\) \{\s*\.is-look-open \.chamber-field \{[^}]*padding-right:[^}]*\}/);
    expect(desk).not.toBeNull();
    expect(css).toMatch(/:root\.reduced-motion \.chamber-field[^{]*\{[^}]*transition: none/);
  });

  it('lets an Escape that reaches a closed sheet go on to the router', () => {
    const { chamber, container, sheet } = mount(streamReading());
    open(container);
    const close = container.querySelector('#look-sheet-close');
    close.click();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    let reached = false;
    const listen = () => { reached = true; };
    document.addEventListener('keydown', listen);
    close.dispatchEvent(escape);
    document.removeEventListener('keydown', listen);
    expect(sheet.hidden).toBe(true);
    expect(reached).toBe(true);
    expect(escape.defaultPrevented).toBe(false);
    chamber.destroy();
  });

  it('closes through the router’s Escape without asking to end the reading', () => {
    const { chamber, container, sheet } = mount(streamReading());
    open(container);
    expect(chamber.handleEscape()).toBe(true);
    expect(sheet.hidden).toBe(true);
    expect(container.querySelector('#exit-confirm-overlay').style.display).toBe('none');
    chamber.destroy();
  });

  it('keeps Tab and Shift+Tab inside the sheet', () => {
    const { chamber, container, sheet } = mount(streamReading());
    open(container);
    const reachable = [...sheet.querySelectorAll('button, input, select')]
      .filter(element => !element.disabled && !element.closest('[hidden]'));
    const last = reachable.at(-1);
    last.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    last.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(reachable[0]);
    const back = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    reachable[0].dispatchEvent(back);
    expect(document.activeElement).toBe(last);
    chamber.destroy();
  });

  it('leaves the bar’s arrow keys alone while the sheet is open', () => {
    const { chamber, container } = mount(streamReading());
    open(container);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(chamber.player.setSpeedFactor).not.toHaveBeenCalled();
    chamber.destroy();
    const closed = mount(streamReading());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(closed.chamber.player.setSpeedFactor).toHaveBeenCalledOnce();
    closed.chamber.destroy();
  });

  it('offers the nine colours and applies one live: ink, ground and accent together', () => {
    const { chamber, container } = mount(streamReading());
    open(container);
    const swatches = [...container.querySelectorAll('[data-look-colour]')];
    expect(swatches.map(swatch => swatch.dataset.lookColour)).toEqual(JEV_COLOR_THEMES);
    container.querySelector('[data-look-colour="jade"]').click();
    expect(container.style.getPropertyValue('--color-void')).toBe(JEV_PALETTES.jade.background);
    expect(container.style.getPropertyValue('--color-light')).toBe(JEV_INKS.jade);
    expect(container.style.getPropertyValue('--color-accent')).toBe(JEV_PALETTES.jade.accent);
    expect(container.querySelector('[data-look-colour="jade"]').getAttribute('aria-pressed')).toBe('true');
    chamber.destroy();
  });

  it('applies a size live, and offers Fit only to word-by-word readings', () => {
    const { chamber, container } = mount(streamReading());
    open(container);
    expect(container.querySelector('[data-look-size="fit"]')).toBeNull();
    container.querySelector('[data-look-size="xlarge"]').click();
    expect(container.querySelector('#atom-display').dataset.fontSize).toBe('xlarge');
    expect(container.querySelector('[data-look-size="xlarge"]').getAttribute('aria-pressed')).toBe('true');
    chamber.destroy();

    const word = mount(streamReading({ chunkMode: 'word' }));
    expect(word.container.querySelector('[data-look-size="fit"]')).not.toBeNull();
    word.chamber.destroy();
  });

  it('changes the sound and the volume through the reading’s audio engine', () => {
    const calls = [];
    const audioEngine = {
      stopSoundscape: () => calls.push('stop'),
      applyPreset: id => calls.push(`preset:${id}`),
      startSoundscape: id => calls.push(`soundscape:${id}`),
      setVolume: value => calls.push(value)
    };
    const { chamber, container } = mount(streamReading(), {
      audioEngine, onSettingsChange: (key, value) => calls.push(`${key}:${value}`)
    });
    open(container);
    const sound = container.querySelector('[name="look-sound"]');
    sound.value = 'soft-rain';
    sound.dispatchEvent(new Event('change', { bubbles: true }));
    expect(calls).toEqual(['stop', 'preset:silent', 'soundscape:soft-rain']);
    const volume = container.querySelector('[name="look-volume"]');
    expect(volume.value).toBe('75');
    input(volume, 30);
    expect(calls.slice(-2)).toEqual([0.3, 'masterVolume:0.3']);
    expect(container.querySelector('#look-volume-value').textContent).toBe('30%');
    chamber.destroy();
  });

  it('offers the one sound list, grouped, and plays a tone through the reading’s audio engine', () => {
    const calls = [];
    const audioEngine = {
      stopSoundscape: () => calls.push('stop'),
      applyPreset: id => calls.push(`preset:${id}`),
      startSoundscape: id => calls.push(`soundscape:${id}`)
    };
    const { chamber, container } = mount(streamReading(), { audioEngine });
    open(container);
    const sound = container.querySelector('[name="look-sound"]');
    expect([...sound.querySelectorAll(':scope > option')].map(option => option.value)).toEqual(['authored', 'none']);
    expect([...sound.querySelectorAll('optgroup')].map(group => [group.label, [...group.children].map(option => option.value)]))
      .toEqual(SOUND_GROUPS.filter(group => group.id !== 'silence')
        .map(group => [group.label, group.entries.map(entry => entry.id)]));
    expect(sound.querySelectorAll('optgroup option')).toHaveLength(27);

    sound.value = 'deep';
    sound.dispatchEvent(new Event('change', { bubbles: true }));
    expect(calls).toEqual(['stop', 'preset:silent', 'preset:deep']);
    expect(sound.value).toBe('deep');
    chamber.destroy();
  });

  it('turns the attractor calmer or more vivid through the visual control contract', () => {
    canvasStubs();
    const { chamber, container } = mount(streamReading({
      visualConfig: { visualMode: 'attractor', attractor: { intensity: 0.65 } }
    }));
    open(container);
    const vivid = container.querySelector('[name="look-vivid"]');
    expect(vivid.closest('[hidden]')).toBeNull();
    input(vivid, 0);
    expect(chamber.attractorField.targetIntensity).toBe(0.4);
    input(vivid, 100);
    expect(chamber.attractorField.targetIntensity).toBe(0.75);
    expect(vivid.getAttribute('aria-valuetext')).toBe('100 percent vivid');
    chamber.destroy();
  });

  it('maps Calmer ↔ Vivid onto the flame’s energy and the Gallery’s cadence', () => {
    const flame = mount(streamReading());
    flame.chamber._currentVisualCue = {
      kind: 'field', renderer: 'living-flame',
      config: { recipe: flamePreset(FLAME_PRESET_IDS[0]), intensity: 0.35 }
    };
    open(flame.container);
    input(flame.container.querySelector('[name="look-vivid"]'), 80);
    expect(flame.chamber._visualEnergy).toBe(0.8);
    flame.chamber.destroy();

    const update = vi.spyOn(visualCortex, 'updateConfig');
    const room = mount(streamReading());
    open(room.container);
    input(room.container.querySelector('[name="look-vivid"]'), 15);
    expect(update).toHaveBeenLastCalledWith({ galleryCadence: 0.15 }, { preservePresentation: true });
    room.chamber.destroy();
  });

  it('hides Calmer ↔ Vivid where no engine has a live setting', () => {
    const { chamber, container } = mount(streamReading({
      visualConfig: { visualMode: 'focals', focals: { type: 'standard' } }
    }));
    open(container);
    expect(container.querySelector('[name="look-vivid"]').closest('[hidden]')).not.toBeNull();
    chamber.destroy();
  });

  it('holds this scene, turns visuals off, and turns them back on', () => {
    // A chosen engine can follow the text, and opens holding its own visuals.
    const { chamber, container } = mount(streamReading({
      sourceTexts: new Map([['primary', 'First. Second. Third.']]),
      visualConfig: { visualMode: 'interlocution', interlocution: { presentation: 'continuous', procedural: ['harmonograph'] } }
    }));
    chamber._direction.mode = 'follow';
    chamber._currentVisualCue = { kind: 'still' };
    open(container);
    const hold = container.querySelector('[data-look-visuals="hold"]');
    const off = container.querySelector('[data-look-visuals="off"]');
    expect(hold.hidden).toBe(false);
    expect(hold.getAttribute('aria-pressed')).toBe('false');
    hold.click();
    expect(chamber._direction.mode).toBe('hold');
    expect(hold.getAttribute('aria-pressed')).toBe('true');
    off.click();
    expect(chamber._direction.mode).toBe('off');
    expect(off.getAttribute('aria-pressed')).toBe('true');
    expect(hold.getAttribute('aria-pressed')).toBe('false');
    off.click();
    expect(chamber._direction.mode).toBe('hold');
    expect(off.getAttribute('aria-pressed')).toBe('false');
    chamber.destroy();
  });

  it('stops a flashing reading’s visuals with Visuals off, session-locally', async () => {
    const cancel = vi.spyOn(visualCortex, 'cancelPresentation').mockReturnValue(true);
    const { chamber, container } = mount(libraryReading());
    open(container);
    const off = container.querySelector('[data-look-visuals="off"]');
    off.click();
    expect(cancel).toHaveBeenCalledWith('user-disabled');
    expect(chamber.session.visualConfig.visualMode).toBe('off');
    expect(off.getAttribute('aria-pressed')).toBe('true');
    off.click();
    expect(chamber.session.visualConfig.visualMode).toBe('interlocution');
    expect(off.getAttribute('aria-pressed')).toBe('false');
    chamber.destroy();
  });

  it('offers Kaleidoscope only when the field is the attractor, and K still folds it', () => {
    const plain = mount(streamReading());
    expect(plain.container.querySelector('#kaleidoscope-btn')).toBeNull();
    plain.chamber.destroy();

    const { chamber, container, sheet } = mount(libraryReading());
    const button = container.querySelector('#kaleidoscope-btn');
    expect(sheet.contains(button)).toBe(true);
    const toggle = vi.spyOn(chamber, 'toggleKaleidoscope').mockReturnValue(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
    expect(toggle).toHaveBeenCalledOnce();
    chamber.destroy();
  });

  it('keeps Next scene where it applies today, inside the sheet', () => {
    const { chamber, container, sheet } = mount(jevReading());
    expect(sheet.contains(container.querySelector('#jev-next-scene'))).toBe(true);
    chamber.destroy();
  });

  it('offers Edit in Visual Lab only in Flame', () => {
    const flame = mount(lookReading('flame'));
    open(flame.container);
    expect(flame.container.querySelector('[data-vd="lab"]').hidden).toBe(false);
    flame.chamber.destroy();

    const room = mount(lookReading('gallery'));
    open(room.container);
    expect(room.container.querySelector('[data-vd="lab"]').hidden).toBe(true);
    room.chamber.destroy();
  });
});

describe('a host that draws its own controls', () => {
  it('gets no bar and no Look sheet', () => {
    const { chamber, container } = mount(lookReading('signal'), { chrome: 'none', hostPlays: true });
    expect(container.querySelector('#chamber-controls')).toBeNull();
    expect(container.querySelector('#look-btn')).toBeNull();
    expect(container.querySelector('#look-sheet')).toBeNull();
    chamber.destroy();
  });
});
