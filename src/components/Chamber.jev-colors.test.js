import { expect, it } from 'vitest';
import { jevPalette } from '../core/jev-palette.js';
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
