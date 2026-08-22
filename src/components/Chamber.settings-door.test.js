import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';
import { Settings } from './Settings.js';
import { resolveChamberStreamFace } from '../core/chamber-stream-face.js';

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

function mount(player = fakePlayer()) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const chamber = new Chamber(container, {
    session: {
      title: 'Settings door',
      atoms: [{ content: 'hello', duration: 500 }],
      totalDuration: 500,
      atomCount: 1,
      visualConfig: { visualMode: 'off' }
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
    expect(container.querySelector('#display-heading')).toBeTruthy();

    const labels = [...container.querySelectorAll('input[name="chamber-face"]')]
      .map((input) => input.closest('label')?.textContent.replace(/\s+/g, ' ').trim());
    expect(labels).toEqual(['Literary', 'Display', 'Thick', 'Japanese']);

    chamber.destroy();
  });

  it('applies an allowlisted face on the paused frame and ignores an unknown face', async () => {
    const { chamber, container, player } = mount();
    globalThis.rise = {
      settings: { chamberFace: 'literary' },
      handleSettingsChange(key, value) {
        this.settings[key] = key === 'chamberFace'
          ? resolveChamberStreamFace(value)
          : value;
        chamber.applyChamberStreamFace();
        chamber.applyChamberMask();
      }
    };
    chamber.applyChamberStreamFace();

    await chamber.openSettings();
    expect(player.state).toBe('paused');

    container.querySelector('input[name="chamber-face"][value="jp"]').click();
    expect(container.querySelector('#atom-display').dataset.chamberFace).toBe('jp');
    expect(player.state).toBe('paused');

    const thick = container.querySelector('input[name="chamber-face"][value="thick"]');
    thick.value = 'comic-sans';
    thick.checked = true;
    thick.dispatchEvent(new Event('change'));
    expect(container.querySelector('#atom-display').dataset.chamberFace).toBe('jp');
    expect(globalThis.rise.settings.chamberFace).toBe('jp');

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

  it('keeps overlay Face radios out of a Portal Settings group already in the document', async () => {
    const portal = document.createElement('div');
    document.body.appendChild(portal);
    const portalSettings = new Settings(portal, { settings: { chamberFace: 'literary' } });
    const { chamber, container } = mount();

    await chamber.openSettings();
    container.querySelector('input[name="chamber-face"][value="jp"]').click();

    expect(portal.querySelector('input[name="chamber-face"][value="literary"]').checked).toBe(true);
    expect(container.querySelector('input[name="chamber-face"][value="jp"]').checked).toBe(true);

    portalSettings.destroy();
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
