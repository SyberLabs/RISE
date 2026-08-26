import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';
import { Settings } from './Settings.js';
import { resolveChamberStreamFace } from '../core/chamber-stream-face.js';
import { resolveChamberAccent } from '../core/chamber-accent.js';

function fakePlayer(initialState = 'playing') {
  const player = {
    state: initialState,
    handlers: new Map(),
    on: vi.fn((event, listener) => {
      const listeners = player.handlers.get(event) || [];
      listeners.push(listener);
      player.handlers.set(event, listeners);
    }),
    play: vi.fn(() => { player.state = 'playing'; }),
    stop: vi.fn(() => { player.state = 'idle'; }),
    pause: vi.fn(() => { player.state = 'paused'; }),
    setInterlocutionHandler: vi.fn()
  };
  return player;
}

function mount(player = fakePlayer(), sessionExtra = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const chamber = new Chamber(container, {
    session: {
      title: 'Settings door',
      atoms: [{ content: 'hello', duration: 500 }],
      totalDuration: 500,
      atomCount: 1,
      visualConfig: { visualMode: 'off' },
      ...sessionExtra
    },
    player,
    autoStart: false
  });
  return { chamber, container, player };
}

afterEach(() => {
  delete globalThis.rise;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('Chamber Settings door', () => {
  it('places one Settings text control on the existing bar before Exit', () => {
    const { chamber, container } = mount();
    const bar = container.querySelector('.chamber-controls');
    const settings = bar.querySelector('#chamber-settings-btn');
    const exit = bar.querySelector('#exit-btn');

    expect(settings).toBeTruthy();
    expect(settings.textContent.trim()).toBe('Settings');
    expect(settings.querySelector('.icon')).toBeNull();
    expect(container.querySelector('#chamber-field #chamber-settings-btn')).toBeNull();
    expect(bar.contains(settings)).toBe(true);
    expect(settings.nextElementSibling).toBe(exit);

    chamber.destroy();
  });

  it('pauses through the play control path and overlays existing Settings without tearing down the field', async () => {
    const { chamber, container, player } = mount();
    const toggle = vi.spyOn(chamber, 'togglePlayPause');
    const field = container.querySelector('#chamber-field');
    const atom = container.querySelector('#atom-display');

    container.querySelector('#chamber-settings-btn').click();
    await vi.waitFor(() => {
      expect(container.querySelector('#chamber-settings-overlay .settings')).toBeTruthy();
    });

    expect(toggle).toHaveBeenCalled();
    expect(player.pause).toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
    expect(player.state).toBe('paused');
    expect(container.querySelector('#chamber-field')).toBe(field);
    expect(container.querySelector('#atom-display')).toBe(atom);
    expect(container.querySelector('#chamber-field .settings')).toBeNull();

    // WHAT A READING CAN SPARE, AND NOTHING ELSE. Sound, Size and the two
    // safety switches: what can rescue a reading that cannot be resumed.
    expect(container.querySelector('#master-volume'), 'Sound').toBeTruthy();
    expect(container.querySelectorAll('[data-volume]'), 'its presets').toHaveLength(3);
    expect([...container.querySelectorAll('input[name="font-size"]')].map(i => i.value))
      .toEqual(['small', 'medium', 'large']);
    expect(container.querySelector('[data-setting="photosensitivityMode"]')).toBeTruthy();
    expect(container.querySelector('[data-setting="reducedMotion"]')).toBeTruthy();

    // Face and Accent are decided before a reading, in the One Type editor
    // and the Portal; changing a typeface mid-sentence is not a rescue.
    // Fit is a projection, not a scale, and stands chunking aside with it.
    expect(container.querySelector('input[name="chamber-face"]')).toBeNull();
    expect(container.querySelector('input[name="chamber-accent"]')).toBeNull();
    expect(container.querySelector('input[name="font-size"][value="fit"]')).toBeNull();
    // And the bar sheds its own volume control rather than gaining a door
    // beside one.
    expect(container.querySelector('#volume-btn')).toBeNull();

    chamber.destroy();
  });

  it('scrolls the existing Chamber Settings overlay on a short phone', () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'Chamber.css'),
      'utf8'
    );
    const rule = css.match(/^\.chamber-settings-overlay\s*\{[^}]+\}/m)?.[0];
    expect(rule).toMatch(/overflow(?:-y)?:\s*auto/);
    expect(rule).toMatch(/-webkit-overflow-scrolling:\s*touch/);
  });

  it('applies Font Size on the paused frame and rebuilds the mask', async () => {
    const { chamber, container, player } = mount();
    globalThis.rise = {
      settings: { chamberFace: 'literary', fontSize: 'medium' },
      handleSettingsChange(key, value) {
        this.settings[key] = value;
      }
    };
    chamber.session.chunkMode = 'word';
    chamber.applyChamberTypeSize();
    const sync = vi.spyOn(chamber, 'syncFillGlyphMask');

    await chamber.openSettings();
    expect(player.state).toBe('paused');
    expect(container.querySelector('#font-size')).toBeNull();

    container.querySelector('input[name="font-size"][value="large"]').click();
    expect(globalThis.rise.settings.fontSize).toBe('large');
    expect(container.querySelector('#atom-display').dataset.fontSize).toBe('large');
    expect(sync).toHaveBeenCalled();

    // Fit is not reachable from this door: it stands recitation and phrase
    // chunking aside, so it is a projection rather than a scale and is chosen
    // before a reading. Leaving Fit still is — see the test below.
    expect(container.querySelector('input[name="font-size"][value="fit"]')).toBeNull();
    expect(player.state).toBe('paused');

    chamber.destroy();
  });

  it('removes a Thick Fit material mask when Settings changes Fit to Medium', async () => {
    globalThis.rise = {
      settings: { chamberFace: 'thick', fontSize: 'fit' },
      handleSettingsChange(key, value) { this.settings[key] = value; }
    };
    const { chamber, container } = mount(fakePlayer(), {
      chunkMode: 'word',
      visualConfig: {
        visualMode: 'interlocution',
        interlocution: { presentation: 'continuous', wordFill: { mode: 'same' } }
      }
    });
    expect(container.querySelector('#atom-display').classList.contains('is-mask')).toBe(true);

    await chamber.openSettings();
    container.querySelector('input[name="font-size"][value="medium"]').click();
    expect(container.querySelector('#atom-display').classList.contains('is-mask')).toBe(false);
    chamber.destroy();
  });

  it('closes back to the live session without resuming or navigating to Portal', async () => {
    const onNavigate = vi.fn();
    const { chamber, container, player } = mount();
    globalThis.rise = { settings: {}, handleNavigate: onNavigate };

    await chamber.openSettings();
    expect(container.querySelector('#chamber-settings-overlay .settings')).toBeTruthy();

    container.querySelector('[data-action="back"]').click();

    expect(container.querySelector('#chamber-settings-overlay').hidden).toBe(true);
    expect(container.querySelector('#chamber-settings-overlay .settings')).toBeFalsy();
    expect(player.play).not.toHaveBeenCalled();
    expect(player.state).toBe('paused');
    expect(onNavigate).not.toHaveBeenCalled();
    expect(container.querySelector('#chamber-field')).toBeTruthy();
    expect(container.querySelector('#atom-display')).toBeTruthy();

    chamber.destroy();
  });

  it('does not start playback when Settings opens on an already paused session', async () => {
    const { chamber, player } = mount(fakePlayer('paused'));

    await chamber.openSettings();

    expect(player.pause).not.toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
    expect(player.state).toBe('paused');

    chamber.destroy();
  });

  it('Escape closes Settings instead of the exit confirm and does not resume', async () => {
    const { chamber, container, player } = mount();

    await chamber.openSettings();
    expect(chamber.handleEscape()).toBe(true);

    expect(container.querySelector('#chamber-settings-overlay').hidden).toBe(true);
    expect(container.querySelector('#exit-confirm-overlay').style.display).not.toBe('flex');
    expect(player.play).not.toHaveBeenCalled();
    expect(player.state).toBe('paused');

    chamber.destroy();
  });

  it('does not resume from Space while Settings is open', async () => {
    const { chamber, player } = mount();
    await chamber.openSettings();
    player.play.mockClear();
    chamber._lastToggleTime = 0;

    chamber.handleKeyboard({
      code: 'Space',
      key: ' ',
      preventDefault() {}
    });

    expect(player.play).not.toHaveBeenCalled();
    expect(player.state).toBe('paused');

    chamber.destroy();
  });

  it('dims the door and keeps playing when Settings will not open', async () => {
    const { chamber, container, player } = mount();
    chamber.loadSettingsClass = async () => {
      throw new Error('Settings unavailable');
    };

    container.querySelector('#chamber-settings-btn').click();
    await vi.waitFor(() => {
      expect(container.querySelector('#chamber-settings-fail')?.hidden).toBe(false);
    });

    const button = container.querySelector('#chamber-settings-btn');
    expect(container.querySelector('#chamber-settings-fail').textContent.trim())
      .toBe('Settings will not open.');
    expect(button.style.opacity).toBe('0.75');
    expect(player.pause).not.toHaveBeenCalled();
    expect(player.state).toBe('playing');
    expect(container.querySelector('#chamber-settings-overlay .settings')).toBeFalsy();

    chamber.destroy();
  });
});
