/**
 * What each colour theme means to every engine that can take one.
 *
 * Cells are engine ids, plus an engine's own dial where it has no neutral
 * native, never a colour: a reading's colours come from its Jev palette
 * through sessionColorTheme. The attractor and Genesis columns are the
 * RISE_CURRENT_THEMES rows themselves, so Composer cannot drift from a
 * themed reading. This lives beside rise-current.js, not in it: the Worker
 * imports that file to admit Currents and must learn nothing about engines.
 */
import { RISE_CURRENT_THEMES } from './rise-current.js';
import { validateFlameRecipe } from './flame-recipe.js';

const row = (theme, turrell, neural, ostensoria, apparitio, composition) => Object.freeze({
  attractor: RISE_CURRENT_THEMES[theme].attractor,
  genesis: RISE_CURRENT_THEMES[theme].genesis,
  turrell,
  neural,
  ostensoria: Object.freeze(ostensoria),
  apparitio: Object.freeze(apparitio),
  livingFlame: Object.freeze({ composition })
});

export const THEME_ENGINE_MAP = Object.freeze({
  classic: row('classic', 'dawn', 'organic', { palette: 'sepia' }, { palette: 'ember', sat: 0.6 }, 'ember-cathedral'),
  amethyst: row('amethyst', 'chamber', 'consciousness', { palette: 'lilac' }, { palette: 'holo' }, 'violet-nebula'),
  prism: row('prism', 'ganzfeld', 'consciousness', { palette: 'iris' }, { palette: 'prism' }, 'prismatic-knot'),
  ember: row('ember', 'ember', 'organic', { palette: 'ember' }, { palette: 'ember' }, 'ember-cathedral'),
  cobalt: row('cobalt', 'twilight', 'digital', { palette: 'ice' }, { palette: 'marian' }, 'glacial-silk'),
  jade: row('jade', 'ethereal', 'growth', { palette: 'teal' }, { palette: 'holo' }, 'verdant-current'),
  rose: row('rose', 'ganzfeld', 'organic', { palette: 'rose' }, { palette: 'marian' }, 'solar-bloom'),
  citrine: row('citrine', 'dawn', 'organic', { palette: 'verdant' }, { palette: 'ember' }, 'solar-bloom'),
  silver: row('silver', 'void', 'minimal', { palette: 'ice', sat: 0.35 }, { palette: 'prism', sat: 0.25 }, 'glacial-silk')
});

/** The cell for a theme and engine, or null for an unknown theme or engine. */
export function themeEngine(themeId, engine) {
  const entry = Object.hasOwn(THEME_ENGINE_MAP, themeId) ? THEME_ENGINE_MAP[themeId] : null;
  return entry && Object.hasOwn(entry, engine) ? entry[engine] : null;
}

function hexRgb(value) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(value || ''));
  if (!match) return null;
  const n = Number.parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Rock Garden's ground and stroke from a reading's colours, or null without them. */
export function rockGardenInk(colors) {
  const ink = hexRgb(colors?.text);
  if (!ink || !hexRgb(colors?.background)) return null;
  return { backgroundColor: colors.background, strokeColor: `rgba(${ink.join(', ')}, 0.8)` };
}

function hueSat([r, g, b]) {
  const max = Math.max(r, g, b);
  const chroma = max - Math.min(r, g, b);
  if (!chroma) return { hue: 0, sat: 0 };
  const raw = max === r ? ((g - b) / chroma) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
  return { hue: (raw * 60 + 360) % 360, sat: chroma / max };
}

/** Saturation-weighted circular mean hue of RGB triples, or null when none has colour. */
function meanHue(triples) {
  let x = 0;
  let y = 0;
  for (const rgb of triples) {
    const { hue, sat } = hueSat(rgb);
    x += sat * Math.cos(hue * Math.PI / 180);
    y += sat * Math.sin(hue * Math.PI / 180);
  }
  return Math.hypot(x, y) < 1e-6 ? null : (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/** The arc the saturated stops span. A spectrum spans more than this and has no one hue to turn. */
const SPECTRAL_SPREAD = 150;

function hueSpread(triples) {
  const hues = triples.map(hueSat).filter(stop => stop.sat > 0).map(stop => stop.hue).sort((a, b) => a - b);
  if (hues.length < 2) return 0;
  let widestGap = hues[0] + 360 - hues[hues.length - 1];
  for (let i = 1; i < hues.length; i += 1) widestGap = Math.max(widestGap, hues[i] - hues[i - 1]);
  return 360 - widestGap;
}

/**
 * The recipe with its hue macro turned so the palette's mean hue lands on
 * the accent. The input comes back when there is no theme, and a spectral
 * palette is left as it is: rotating a spectrum does not make it rose.
 */
export function themedFlameRecipe(recipe, colors) {
  const accent = hexRgb(colors?.accent);
  if (!recipe || !accent) return recipe;
  const clean = validateFlameRecipe(recipe);
  const stops = clean.palette.map(hexRgb);
  const current = meanHue(stops);
  if (current === null || hueSpread(stops) > SPECTRAL_SPREAD) return clean;
  const hue = ((hueSat(accent).hue - current + 540) % 360) - 180;
  return validateFlameRecipe({ ...clean, macros: { ...clean.macros, hue } });
}

/** A recipe lookup whose answers carry the theme; the lookup itself when there is none. */
export function themedFlameLookup(lookup, colors) {
  if (!hexRgb(colors?.accent)) return lookup;
  return id => {
    const recipe = lookup(id);
    return recipe ? themedFlameRecipe(recipe, colors) : null;
  };
}
