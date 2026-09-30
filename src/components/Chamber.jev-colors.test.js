import { afterEach, describe, expect, it } from 'vitest';
import { JEV_INKS, JEV_PALETTES, jevColors, jevPalette } from '../core/jev-palette.js';
import { buildAccentFlamePalette } from '../core/conductor.js';
import { sessionColorTheme } from '../core/session-presentation.js';
import { FractalFlame } from '../visuals/fractal.js';
import { visualCortex } from '../visuals/visual-cortex.js';
import { Chamber } from './Chamber.js';

it('scopes Jev palette colors to the active Chamber container', () => {
  const container = document.createElement('div');
  const colors = jevPalette('prism');
  Chamber.prototype.applySessionColors.call({
    container,
    session: { presentation: { colorTheme: 'prism', colors } }
  });

  expect(container.style.getPropertyValue('--color-void')).toBe(colors.background);
  expect(container.style.getPropertyValue('--color-light')).toBe(colors.text);
  expect(container.style.getPropertyValue('--color-accent')).toBe(colors.accent);
  expect(document.documentElement.style.getPropertyValue('--color-void')).toBe('');
});

it('keeps independent Jev ink and ground valid as a generated phase changes accent', () => {
  const container = document.createElement('div');
  const session = { presentation: {
    colorTheme: 'classic', textColor: 'jade', backgroundColor: 'ember',
    colors: jevColors('classic', 'jade', 'ember')
  } };
  const chamber = {
    container, session, _jevLook: {},
    applySessionColors() { Chamber.prototype.applySessionColors.call(this); }
  };
  expect(Chamber.prototype.applyScheduledColorTheme.call(chamber, 'prism')).toBe(true);
  expect(sessionColorTheme(session)).toEqual(jevColors('prism', 'jade', 'ember'));
  expect(container.style.getPropertyValue('--color-light')).toBe(JEV_INKS.jade);
  expect(container.style.getPropertyValue('--color-void')).toBe(JEV_PALETTES.ember.background);
  expect(container.style.getPropertyValue('--color-accent')).toBe(JEV_PALETTES.prism.accent);
});

it('continues to move the whole palette for older visual programs', () => {
  const container = document.createElement('div');
  const session = { presentation: { colorTheme: 'classic', colors: jevPalette('classic') } };
  const chamber = {
    container, session, _jevLook: {},
    applySessionColors() { Chamber.prototype.applySessionColors.call(this); }
  };
  expect(Chamber.prototype.applyScheduledColorTheme.call(chamber, 'prism')).toBe(true);
  expect(sessionColorTheme(session)).toEqual(jevPalette('prism'));
  expect(container.style.getPropertyValue('--color-void')).toBe(JEV_PALETTES.prism.background);
});

describe('the flame follows a scheduled color theme', () => {
  afterEach(() => { visualCortex.fractal = null; });

  it('repaints the flame palette when a phase changes the theme', () => {
    visualCortex.fractal = new FractalFlame(document.createElement('canvas'));
    const session = { presentation: { colorTheme: 'classic', colors: jevPalette('classic') } };
    visualCortex.fractal.setColorTheme(sessionColorTheme(session));
    const chamber = {
      container: document.createElement('div'), session, _jevLook: {},
      applySessionColors() { Chamber.prototype.applySessionColors.call(this); }
    };
    expect(Chamber.prototype.applyScheduledColorTheme.call(chamber, 'prism')).toBe(true);
    expect(visualCortex.fractal.accentPalette)
      .toEqual(buildAccentFlamePalette(jevPalette('prism')));
  });
});
