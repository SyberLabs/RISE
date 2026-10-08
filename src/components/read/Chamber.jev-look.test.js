import { afterEach, describe, expect, it } from 'vitest';
import { Chamber } from './Chamber.js';
import { JEV_PALETTES } from '../../core/jev-palette.js';
import { JEV_AUDIO_IDS } from '../../core/jev-config.js';

function mount(experience = 'jev', audioEngine = null, overrides = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const chamber = new Chamber(container, {
    session: {
      title: 'A Jev reading',
      atoms: [{ content: 'hello', duration: 500 }],
      totalDuration: 500,
      atomCount: 1,
      origin: { experience },
      presentation: {
        chamberFace: 'display', fontSize: 'large', colorTheme: 'prism',
        colors: JEV_PALETTES.prism
      },
      visualConfig: { visualMode: 'off' }
    },
    getSettings: () => ({ chamberFace: 'display', fontSize: 'large' }),
    audioEngine,
    ...overrides
  });
  return { chamber, container };
}

afterEach(() => document.body.replaceChildren());

describe('the Look sheet in a Jev reading', () => {
  it('opens the Look sheet for a Jev reading and for an ordinary one, beside the Settings door', () => {
    for (const experience of ['jev', 'library']) {
      const { chamber, container } = mount(experience);
      const look = container.querySelector('#look-btn');
      expect(container.querySelector('#chamber-settings-btn')).toBeTruthy();
      expect(container.querySelector('#jev-look-btn')).toBeNull();
      look.click();
      expect(look.getAttribute('aria-expanded')).toBe('true');
      expect(container.querySelector('#look-sheet').hidden).toBe(false);
      chamber.destroy();
    }
  });

  it('adjusts listening volume in the Look sheet', () => {
    const calls = [];
    const engine = { setVolume: value => calls.push(value) };
    const { chamber, container } = mount('jev', engine, {
      getSettings: () => ({ chamberFace: 'display', fontSize: 'large', masterVolume: 0.75 }),
      onSettingsChange: (key, value) => calls.push(`${key}:${value}`)
    });
    const volume = container.querySelector('[name="look-volume"]');
    expect(volume.value).toBe('75');
    volume.value = '30';
    volume.dispatchEvent(new Event('input', { bubbles: true }));
    expect(calls).toEqual([0.3, 'masterVolume:0.3']);
    expect(container.querySelector('#look-volume-value').textContent).toBe('30%');
    chamber.destroy();
  });

  it('offers every Jev soundscape ID in the live sound choice', () => {
    const { chamber, container } = mount();
    const ids = [...container.querySelectorAll('[name="look-sound"] option')]
      .map(option => option.value);
    expect(ids.slice(0, 2)).toEqual(['authored', 'none']);
    expect(ids).toEqual(expect.arrayContaining(JEV_AUDIO_IDS));
    chamber.destroy();
  });

  it('disables the size choice while Page is visible', async () => {
    const { chamber, container } = mount();
    const size = container.querySelector('[data-look-size="xlarge"]');
    expect(size.disabled).toBe(false);
    const entering = chamber.togglePageMode(true);
    expect(size.disabled).toBe(true);
    await entering;
    await chamber.togglePageMode(false);
    expect(size.disabled).toBe(false);
    chamber.destroy();
  });

  it('switches soundscape and silence using the active audio engine', () => {
    const calls = [];
    const engine = {
      stopSoundscape: () => calls.push('stop'),
      applyPreset: id => calls.push(`preset:${id}`),
      startSoundscape: id => calls.push(`soundscape:${id}`)
    };
    const { chamber, container } = mount('jev', engine);
    container.querySelector('#look-btn').click();
    const select = container.querySelector('[name="look-sound"]');
    select.value = 'soft-rain';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(calls).toEqual(['stop', 'preset:silent', 'soundscape:soft-rain']);
    select.value = 'none';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(calls.slice(-2)).toEqual(['stop', 'preset:silent']);
    chamber.destroy();
  });

  it('starts the audio bus when a silent Jev reading chooses a soundscape', async () => {
    const calls = [];
    const engine = {
      sessionActive: false,
      startSession: async options => { calls.push(options); engine.sessionActive = true; },
      fadeInSession: seconds => calls.push(`fade:${seconds}`),
      stopSoundscape: () => {},
      applyPreset: () => {}
    };
    const { chamber, container } = mount('jev', engine);
    container.querySelector('#look-btn').click();
    const select = container.querySelector('[name="look-sound"]');
    select.value = 'aurora';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
    expect(calls).toEqual([
      { soundscape: 'aurora', entrySwell: false }, 'fade:0.6'
    ]);
    chamber.destroy();
  });

  it('initializes a silent session marked active but with no Web Audio context', async () => {
    const calls = [];
    const engine = {
      sessionActive: true,
      isInitialized: false,
      startSession: async options => { calls.push(options); engine.isInitialized = true; },
      fadeInSession: () => {},
      stopSoundscape: () => {},
      applyPreset: () => {},
      startSoundscape: () => calls.push('premature-start')
    };
    const { chamber, container } = mount('jev', engine);
    container.querySelector('[name="look-sound"]').value = 'aurora';
    container.querySelector('[name="look-sound"]')
      .dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
    expect(calls).toEqual([{ soundscape: 'aurora', entrySwell: false }]);
    chamber.destroy();
  });

  it('holds a new sound choice while paused and starts it on resume', () => {
    const calls = [];
    const engine = {
      stopSoundscape: () => calls.push('stop'),
      applyPreset: id => calls.push(`preset:${id}`),
      startSoundscape: id => calls.push(`soundscape:${id}`)
    };
    const { chamber, container } = mount('jev', engine);
    chamber.player = { state: 'paused' };
    container.querySelector('#look-btn').click();
    const select = container.querySelector('[name="look-sound"]');
    select.value = 'aurora';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(calls).not.toContain('soundscape:aurora');
    chamber.player.state = 'playing';
    chamber.onStateChange({ state: 'playing' });
    expect(calls).toContain('soundscape:aurora');
    chamber.destroy();
  });

  it('restores Generated silence if a pending sound start finishes later', async () => {
    let complete;
    const calls = [];
    const engine = {
      sessionActive: false,
      startSession: () => new Promise(resolve => { complete = resolve; }),
      stopSoundscape: () => calls.push('stop'),
      applyPreset: id => calls.push(`preset:${id}`),
      fadeInSession: () => calls.push('fade')
    };
    const { chamber, container } = mount('jev', engine);
    const select = container.querySelector('[name="look-sound"]');
    select.value = 'aurora';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    select.value = 'authored';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    engine.sessionActive = true;
    complete({ cancelled: false });
    await Promise.resolve();
    expect(calls).toEqual([
      'stop', 'preset:silent', 'stop', 'preset:silent', 'stop', 'preset:silent'
    ]);
    expect(calls).not.toContain('fade');
    chamber.destroy();
  });

});
