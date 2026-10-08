/**
 * A look, lowered for the card (SCR-002). The Current names a look by id
 * (rise-current.js admits the id); this turns it into what the card draws:
 * the field behind every passage that names none, the Gallery shelf a Gallery
 * look keeps, the look's typeface and size, and its theme where the Current
 * names none. Sound is not lowered: a bed under the browser voice cannot be
 * ducked honestly. It lives apart from rise-current.js because the Worker
 * imports that file to admit Currents and must learn nothing about engines.
 */
import { jevColors } from './jev-palette.js';
import { LOOKS } from './looks.js';
import { RISE_CURRENT_THEMES } from './rise-current.js';
import { flameComposition, themedFlameRecipe } from './theme-engine-map.js';
import { flamePreset } from '../visuals/living-flame/flame-presets.js';

/** The glyph Reader setup holds when a reader has chosen none. */
const DEFAULT_FOCAL = Object.freeze({ type: 'standard', standardGlyph: 'breath' });

function fieldCue(look, theme) {
  const mode = look.config.visualInterlocution.visualMode;
  if (mode === 'interlocution') return { kind: 'procedural', collections: [...look.engines] };
  if (mode === 'genesis') return { kind: 'field', renderer: 'genesis', config: { ...RISE_CURRENT_THEMES[theme].genesis } };
  if (mode === 'attractor') return { kind: 'field', renderer: 'attractor', config: { ...RISE_CURRENT_THEMES[theme].attractor } };
  if (mode === 'living-flame') {
    const recipe = flamePreset(flameComposition(theme));
    return recipe ? { kind: 'field', renderer: 'living-flame', config: { recipe: themedFlameRecipe(recipe, jevColors(theme)) } } : { kind: 'still' };
  }
  if (mode === 'focals') return { kind: 'focal', focal: { ...DEFAULT_FOCAL } };
  return { kind: 'still' };
}

/**
 * The Gallery a Gallery look keeps: its engines on the shelf at its cadence.
 * Inlay's word fill is left out: the card is always spoken, sentence by
 * sentence, and Inlay's mask paints one word at a time (owner, 2026-10-07).
 */
function shelf(look) {
  const field = look.config.visualInterlocution;
  if (field.visualMode !== 'interlocution') return null;
  const { wordFill: _word, ...interlocution } = field.interlocution;
  return { ...interlocution, sourceFamily: 'procedural', procedural: [...look.engines], sourced: [] };
}

/** The theme a look paints in, or null for a look it does not know. */
export function lookTheme(id) {
  return LOOKS.find(entry => entry.id === id)?.config.presentation.colorTheme ?? null;
}

/** What the card draws for a Current's look, or null for a look it does not know. */
export function lowerCurrentLook(current) {
  const look = LOOKS.find(entry => entry.id === current?.look);
  if (!look) return null;
  const { chamberFace, fontSize, colorTheme } = look.config.presentation;
  const theme = current.theme ?? colorTheme;
  return {
    theme,
    fallbackCue: fieldCue(look, theme),
    shelf: shelf(look),
    // Inlay's Fit sizes one word to the screen; a spoken sentence takes the large size.
    type: { chamberFace, fontSize: fontSize === 'fit' ? 'large' : fontSize }
  };
}
