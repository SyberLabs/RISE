import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chamber } from './Chamber.js';
import { JEV_INKS, JEV_PALETTES } from '../core/jev-palette.js';
import { JEV_AUDIO_IDS } from '../core/jev-config.js';

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

describe('Jev in-session look control', () => {
  it('offers a Jev-only look panel without replacing the Settings door', () => {
    const { chamber, container } = mount();
    const look = container.querySelector('#jev-look-btn');
    expect(look).toBeTruthy();
    expect(container.querySelector('#chamber-settings-btn')).toBeTruthy();
    look.click();
    expect(look.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('#jev-look-panel').hidden).toBe(false);
    chamber.destroy();

    const ordinary = mount('library');
    expect(ordinary.container.querySelector('#jev-look-btn')).toBeNull();
    ordinary.chamber.destroy();
  });

  it('lets the reader change face and colors without mutating Jev generated defaults', () => {
    const { chamber, container } = mount();
    const original = structuredClone(chamber.session.presentation);
    container.querySelector('#jev-look-btn').click();
    const choose = (name, value) => {
      const select = container.querySelector(`[name="${name}"]`);
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    };
    choose('jev-face', 'mono');
    choose('jev-text-color', 'jade');
    choose('jev-background-color', 'ember');
    expect(container.querySelector('#atom-display').dataset.chamberFace).toBe('mono');
    expect(container.style.getPropertyValue('--color-light')).toBe(JEV_INKS.jade);
    expect(container.style.getPropertyValue('--color-void')).toBe(JEV_PALETTES.ember.background);
    expect(chamber.session.presentation).toEqual(original);
    chamber.destroy();
  });

  it('changes the live stream size and restores Jev generated size', () => {
    const { chamber, container } = mount();
    const size = container.querySelector('[name="jev-font-size"]');
    expect(size).toBeTruthy();
    size.value = 'xlarge';
    size.dispatchEvent(new Event('change', { bubbles: true }));
    expect(container.querySelector('#atom-display').dataset.fontSize).toBe('xlarge');
    expect(chamber.session.presentation.fontSize).toBe('large');
    size.value = 'authored';
    size.dispatchEvent(new Event('change', { bubbles: true }));
    expect(container.querySelector('#atom-display').dataset.fontSize).toBe('large');
    chamber.destroy();
  });

  it('adjusts listening volume in the Jev panel', () => {
    const calls = [];
    const engine = { setVolume: value => calls.push(value) };
    const { chamber, container } = mount('jev', engine, {
      getSettings: () => ({ chamberFace: 'display', fontSize: 'large', masterVolume: 0.75 }),
      onSettingsChange: (key, value) => calls.push(`${key}:${value}`)
    });
    const volume = container.querySelector('[name="jev-volume"]');
    expect(volume.value).toBe('75');
    volume.value = '30';
    volume.dispatchEvent(new Event('input', { bubbles: true }));
    expect(calls).toEqual([0.3, 'masterVolume:0.3']);
    expect(container.querySelector('#jev-volume-value').textContent).toBe('30%');
    chamber.destroy();
  });

  it('changes the visual field strength and can restore the authored level', () => {
    const { chamber, container } = mount();
    container.querySelector('#jev-look-btn').click();
    const strength = container.querySelector('[name="jev-visual-strength"]');
    strength.value = 'soft';
    strength.dispatchEvent(new Event('change', { bubbles: true }));
    expect(container.dataset.jevVisualStrength).toBe('soft');
    strength.value = 'authored';
    strength.dispatchEvent(new Event('change', { bubbles: true }));
    expect(container.hasAttribute('data-jev-visual-strength')).toBe(false);
    chamber.destroy();
  });

  it('dims gallery artwork without dimming its required credit', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Chamber.css'), 'utf8');
    const rule = css.match(/\[data-jev-visual-strength="soft"\] \.chamber \.chamber-continuous-field \.continuous-field-layer > :not\(\.continuous-field-label\)\s*\{[^}]+\}/)?.[0];
    expect(rule).toBeTruthy();
    const style = document.createElement('style');
    style.textContent = rule;
    document.head.appendChild(style);
    const host = document.createElement('div');
    host.dataset.jevVisualStrength = 'soft';
    host.innerHTML = '<div class="chamber"><div class="chamber-continuous-field"><div class="continuous-field-layer"><img class="continuous-field-artwork"><div class="continuous-field-label">Credit</div></div></div></div>';
    document.body.appendChild(host);
    expect(getComputedStyle(host.querySelector('.continuous-field-artwork')).opacity).toBe('0.45');
    expect(getComputedStyle(host.querySelector('.continuous-field-label')).opacity).not.toBe('0.45');
    style.remove();
    host.remove();
  });

  it('offers every Jev soundscape ID in the live sound choice', () => {
    const { chamber, container } = mount();
    const ids = [...container.querySelectorAll('[name="jev-soundscape"] option')]
      .map(option => option.value);
    expect(ids).toEqual(['authored', 'none', ...JEV_AUDIO_IDS]);
    chamber.destroy();
  });

  it('disables the Stream face choice while Page is visible', async () => {
    const { chamber, container } = mount();
    const face = container.querySelector('[name="jev-face"]');
    expect(face.disabled).toBe(false);
    const entering = chamber.togglePageMode(true);
    expect(face.disabled).toBe(true);
    await entering;
    await chamber.togglePageMode(false);
    expect(face.disabled).toBe(false);
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
    container.querySelector('#jev-look-btn').click();
    const select = container.querySelector('[name="jev-soundscape"]');
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
    container.querySelector('#jev-look-btn').click();
    const select = container.querySelector('[name="jev-soundscape"]');
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
    container.querySelector('[name="jev-soundscape"]').value = 'aurora';
    container.querySelector('[name="jev-soundscape"]')
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
    container.querySelector('#jev-look-btn').click();
    const select = container.querySelector('[name="jev-soundscape"]');
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
    const select = container.querySelector('[name="jev-soundscape"]');
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
