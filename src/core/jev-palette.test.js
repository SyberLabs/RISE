import { expect, it } from 'vitest';
import { JEV_COLOR_NAMES, JEV_INKS, JEV_PALETTES, jevColors } from './jev-palette.js';
import { JEV_COLOR_THEMES, isJevColorTheme } from './jev-color-themes.js';

function luminance(hex) {
  const [red, green, blue] = [1, 3, 5].map(index => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

it('keeps palette names on exactly the same closed theme vocabulary', () => {
  expect(Object.keys(JEV_COLOR_NAMES)).toEqual(Object.keys(JEV_PALETTES));
  for (const [id, names] of Object.entries(JEV_COLOR_NAMES)) {
    expect(names).toEqual({
      ink: `${id[0].toUpperCase() + id.slice(1)} text`,
      ground: `${id[0].toUpperCase() + id.slice(1)} backdrop`
    });
  }
});

it('keeps every offered text and background pairing readable', () => {
  expect(new Set(Object.values(JEV_INKS)).size).toBe(6);
  expect(JEV_INKS.prism).not.toBe(JEV_PALETTES.prism.text);
  for (const textColor of Object.keys(JEV_PALETTES)) {
    for (const backgroundColor of Object.keys(JEV_PALETTES)) {
      const colors = jevColors('classic', textColor, backgroundColor);
      const contrast = (luminance(colors.text) + 0.05) / (luminance(colors.background) + 0.05);
      expect(contrast, `${textColor} text on ${backgroundColor}`).toBeGreaterThanOrEqual(7);
    }
  }
  expect(jevColors('classic', 'unknown', 'classic')).toBeNull();
  expect(jevColors('prism')).toEqual(JEV_PALETTES.prism);
});

it('names exactly the themes the palettes and inks define, so the light copy of the names cannot drift', () => {
  expect([...JEV_COLOR_THEMES].sort()).toEqual(Object.keys(JEV_PALETTES).sort());
  expect([...JEV_COLOR_THEMES].sort()).toEqual(Object.keys(JEV_INKS).sort());
  for (const id of JEV_COLOR_THEMES) expect(isJevColorTheme(id)).toBe(true);
  for (const id of ['', 'neon', 'toString', '__proto__', undefined, null, 7]) expect(isJevColorTheme(id)).toBe(false);
});
