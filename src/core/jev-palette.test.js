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

it('keeps every offered text and background pairing readable', () => {
  expect(new Set(Object.values(JEV_INKS)).size).toBe(JEV_COLOR_THEMES.length);
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
  for (const table of [JEV_PALETTES, JEV_INKS, JEV_COLOR_NAMES]) expect(Object.keys(table)).toEqual([...JEV_COLOR_THEMES]);
  for (const id of JEV_COLOR_THEMES) expect(isJevColorTheme(id)).toBe(true);
  for (const id of ['', 'neon', 'toString', '__proto__', undefined, null, 7]) expect(isJevColorTheme(id)).toBe(false);
});

it('keeps every theme\'s own text and its accent readable on every ground', () => {
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  for (const [id, theme] of Object.entries(JEV_PALETTES)) {
    for (const [groundId, ground] of Object.entries(JEV_PALETTES)) {
      expect(contrast(theme.text, ground.background), `${id} text on ${groundId}`).toBeGreaterThanOrEqual(7);
      expect(contrast(theme.accent, ground.background), `${id} accent on ${groundId}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

it('keeps every ink and every theme text readable on the plate behind words over imagery', () => {
  // --reading-scrim (src/visuals/visuals.css) is the ground at 80% over the picture; pure white is the worst picture.
  const plate = hex => '#' + [1, 3, 5].map(index => Math.round(0.8 * Number.parseInt(hex.slice(index, index + 2), 16) + 0.2 * 255)
    .toString(16).padStart(2, '0')).join('');
  for (const [groundId, ground] of Object.entries(JEV_PALETTES)) {
    const behind = plate(ground.background);
    for (const [id, ink] of Object.entries(JEV_INKS)) {
      expect((luminance(ink) + 0.05) / (luminance(behind) + 0.05), `${id} ink on ${groundId}`).toBeGreaterThanOrEqual(4.5);
      expect((luminance(JEV_PALETTES[id].text) + 0.05) / (luminance(behind) + 0.05), `${id} text on ${groundId}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

it('gives every theme an ink name and a ground name of its own', () => {
  const names = Object.values(JEV_COLOR_NAMES);
  for (const key of ['ink', 'ground']) {
    for (const name of names) expect(name[key]).toMatch(/^\S(.*\S)?$/u);
    expect(new Set(names.map(name => name[key])).size).toBe(names.length);
  }
});
