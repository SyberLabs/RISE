/**
 * The theme-to-engine map: nine themes, every cell an engine's own id or
 * dial, the Composer columns held by identity to RISE_CURRENT_THEMES.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  THEME_ENGINE_MAP,
  rockGardenInk,
  themeEngine,
  themedFlameLookup,
  themedFlameRecipe
} from './theme-engine-map.js';
import { JEV_COLOR_THEMES } from './jev-color-themes.js';
import { JEV_INKS, JEV_PALETTES } from './jev-palette.js';
import { RISE_CURRENT_THEMES } from './rise-current.js';
import { APPARITIO_PALETTES, OSTENSORIA_PALETTES } from './visual-style-definitions.js';
import { flameStructureKey } from './flame-recipe.js';
import { Turrell } from '../visuals/turrell.js';
import { NeuralNetwork } from '../visuals/neural.js';
import { FLAME_PRESETS, FLAME_PRESET_IDS, flamePreset } from '../visuals/living-flame/flame-presets.js';
import { paletteLut, probeRecipe } from '../visuals/living-flame/flame-math.js';

const IDS = [...JEV_COLOR_THEMES];
const ENGINES = ['attractor', 'genesis', 'turrell', 'neural', 'ostensoria', 'apparitio', 'livingFlame'];

const leaves = value => (value && typeof value === 'object'
  ? Object.values(value).flatMap(leaves)
  : [value]);

const frozenDeep = value => !value || typeof value !== 'object'
  || (Object.isFrozen(value) && Object.values(value).every(frozenDeep));

/** HSV hue and saturation of one RGB triple. */
function hueSat([r, g, b]) {
  const max = Math.max(r, g, b);
  const chroma = max - Math.min(r, g, b);
  if (!chroma) return { hue: 0, sat: 0 };
  const raw = max === r ? ((g - b) / chroma) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
  return { hue: (raw * 60 + 360) % 360, sat: chroma / max };
}

/** Saturation-weighted circular mean hue of RGB triples, in degrees. */
function meanHue(triples) {
  let x = 0;
  let y = 0;
  for (const rgb of triples) {
    const { hue, sat } = hueSat(rgb);
    x += sat * Math.cos(hue * Math.PI / 180);
    y += sat * Math.sin(hue * Math.PI / 180);
  }
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

const hexRgb = hex => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16));
const degreesApart = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const lutTriples = recipe => {
  const lut = paletteLut(recipe);
  return Array.from({ length: 256 }, (_, i) => [lut[i * 4], lut[i * 4 + 1], lut[i * 4 + 2]]);
};

describe('THEME_ENGINE_MAP', () => {
  it('is keyed by the nine themes in their shipped order', () => {
    expect(Object.keys(THEME_ENGINE_MAP)).toEqual(IDS);
  });

  it.each(IDS)('%s names exactly the seven engines a theme reaches', id => {
    expect(Object.keys(THEME_ENGINE_MAP[id])).toEqual(ENGINES);
  });

  it.each(IDS)('%s draws the attractor and Genesis from the Composer rows themselves', id => {
    expect(THEME_ENGINE_MAP[id].attractor).toBe(RISE_CURRENT_THEMES[id].attractor);
    expect(THEME_ENGINE_MAP[id].genesis).toBe(RISE_CURRENT_THEMES[id].genesis);
  });

  it.each(IDS)('%s names only what each engine already accepts', id => {
    const row = THEME_ENGINE_MAP[id];
    expect(Object.keys(new Turrell(document.createElement('div')).palettes)).toContain(row.turrell);
    expect(Object.keys(new NeuralNetwork(null).palettes)).toContain(row.neural);
    const plateIds = list => list.map(entry => entry.id).filter(entry => entry !== 'auto');
    expect(plateIds(OSTENSORIA_PALETTES)).toContain(row.ostensoria.palette);
    expect(plateIds(APPARITIO_PALETTES)).toContain(row.apparitio.palette);
    for (const plate of [row.ostensoria, row.apparitio]) {
      expect(Object.keys(plate).every(key => key === 'palette' || key === 'sat')).toBe(true);
      if (plate.sat !== undefined) {
        expect(plate.sat).toBeGreaterThan(0);
        expect(plate.sat).toBeLessThanOrEqual(1);
      }
    }
    expect(Object.keys(row.livingFlame)).toEqual(['composition']);
    expect(FLAME_PRESET_IDS).toContain(row.livingFlame.composition);
  });

  it('never names an engine\'s "no choice" value', () => {
    for (const leaf of leaves(THEME_ENGINE_MAP)) {
      expect(['auto', 'random', 'white']).not.toContain(leaf);
    }
  });

  it('holds no colour of its own', () => {
    const source = readFileSync(join(import.meta.dirname, 'theme-engine-map.js'), 'utf8');
    expect(source).not.toMatch(/#[0-9a-f]{6}\b/iu);
  });

  it('is frozen at every level', () => {
    expect(frozenDeep(THEME_ENGINE_MAP)).toBe(true);
  });
});

describe('themeEngine', () => {
  it('answers the cell for a theme and engine', () => {
    expect(themeEngine('jade', 'turrell')).toBe('ethereal');
    expect(themeEngine('jade', 'attractor')).toBe(RISE_CURRENT_THEMES.jade.attractor);
    expect(themeEngine('silver', 'apparitio')).toEqual({ palette: 'prism', sat: 0.25 });
    expect(themeEngine('rose', 'ostensoria')).toEqual({ palette: 'rose' });
  });

  it('answers null for an unknown theme or engine, own keys only', () => {
    expect(themeEngine('mint', 'turrell')).toBeNull();
    expect(themeEngine(null, 'turrell')).toBeNull();
    expect(themeEngine('jade', 'harmonograph')).toBeNull();
    expect(themeEngine('jade', 'toString')).toBeNull();
    expect(themeEngine('constructor', 'turrell')).toBeNull();
  });
});

describe('rockGardenInk', () => {
  it('draws the ground and the ink at 0.8', () => {
    expect(rockGardenInk(JEV_PALETTES.classic))
      .toEqual({ backgroundColor: '#08090F', strokeColor: 'rgba(244, 238, 228, 0.8)' });
    expect(rockGardenInk(JEV_PALETTES.silver))
      .toEqual({ backgroundColor: '#111215', strokeColor: 'rgba(245, 246, 248, 0.8)' });
  });

  it('takes the ink a roll chose, not the theme\'s own', () => {
    const colors = { background: JEV_PALETTES.ember.background, text: JEV_INKS.jade, accent: JEV_PALETTES.ember.accent };
    expect(rockGardenInk(colors).strokeColor).toBe('rgba(175, 255, 206, 0.8)');
  });

  it('is null without a reading\'s colours', () => {
    expect(rockGardenInk(null)).toBeNull();
    expect(rockGardenInk({ background: 'red', text: '#FFFFFF' })).toBeNull();
  });
});

describe('themedFlameRecipe', () => {
  const plain = FLAME_PRESETS.filter(recipe => recipe.id !== 'prismatic-knot');

  it.each(IDS)('turns every plain composition to the %s accent', id => {
    const colors = JEV_PALETTES[id];
    const accentHue = hueSat(hexRgb(colors.accent)).hue;
    for (const recipe of plain) {
      const result = themedFlameRecipe(recipe, colors);
      expect(degreesApart(meanHue(lutTriples(result)), accentHue), recipe.id).toBeLessThanOrEqual(15);
      expect(flameStructureKey(result), recipe.id).toBe(flameStructureKey(recipe));
      expect(result.id).toBe(recipe.id);
      expect(result.name).toBe(recipe.name);
      expect(probeRecipe(result).visible, recipe.id).toBe(true);
    }
  });

  it.each(IDS)('leaves the spectrum alone under %s', id => {
    const knot = flamePreset('prismatic-knot');
    expect(themedFlameRecipe(knot, JEV_PALETTES[id]).macros.hue).toBe(0);
  });

  it('returns the input when there is no theme', () => {
    const recipe = flamePreset('glacial-silk');
    expect(themedFlameRecipe(recipe, null)).toBe(recipe);
  });
});

describe('themedFlameLookup', () => {
  it('is the lookup itself when there is no theme', () => {
    expect(themedFlameLookup(flamePreset, null)).toBe(flamePreset);
  });

  it('themes what the lookup finds and passes on what it does not', () => {
    const lookup = themedFlameLookup(flamePreset, JEV_PALETTES.jade);
    expect(lookup('verdant-current')).toEqual(themedFlameRecipe(flamePreset('verdant-current'), JEV_PALETTES.jade));
    expect(lookup('verdant-current').macros.hue).not.toBe(0);
    expect(lookup('nothing')).toBeNull();
  });
});
