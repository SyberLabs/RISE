import { describe, expect, it } from 'vitest';
import { flameStructureKey } from '../flame-recipe.js';
import { jevColors } from '../jev-palette.js';
import { compileSession } from '../session-compiler.js';
import { themedFlameRecipe } from '../theme-engine-map.js';
import { flamePreset } from '../../visuals/living-flame/flame-presets.js';
import { directionEligibility, ensureDirector, permittedSourceDigests } from './reading-state.js';

describe('the director\'s flame recipes', () => {
  const gallery = { visualMode: 'interlocution', interlocution: { sourceFamily: 'procedural', procedural: [], sourced: [], presentation: 'continuous' } };
  const text = Array.from({ length: 12 }, () => 'The quiet garden rests in gentle peace and the still water holds the soft light of evening.').join(' ');
  const reading = presentation => compileSession({ title: 'Directed', text, wpm: 300, chunkMode: 'phrase', visualConfig: gallery, presentation });

  it('are turned to the reading\'s theme where the cue is built', () => {
    const colors = jevColors('jade');
    const director = ensureDirector(reading({ colorTheme: 'jade', colors }));
    const preset = flamePreset('verdant-current');
    const recipe = director.flameRecipe('verdant-current');
    expect(recipe.macros.hue).toBe(themedFlameRecipe(preset, colors).macros.hue);
    expect(recipe.macros.hue).not.toBe(preset.macros.hue);
    expect(flameStructureKey(recipe)).toBe(flameStructureKey(preset));
    expect([recipe.id, recipe.name]).toEqual([preset.id, preset.name]);
  });

  it('are turned to the classic theme when the reading names none, so every passage keeps one colour', () => {
    const director = ensureDirector(reading(undefined));
    const classic = jevColors('classic');
    for (const id of ['ember-cathedral', 'violet-nebula', 'glacial-silk', 'solar-bloom', 'verdant-current']) {
      expect(director.flameRecipe(id).macros.hue, id).toBe(themedFlameRecipe(flamePreset(id), classic).macros.hue);
    }
  });
});

describe('a Living Flame reading', () => {
  const text = Array.from({ length: 12 }, () => 'The quiet garden rests in gentle peace and the still water holds the soft light of evening.').join(' ');

  it('keeps its mode and follows the text by default, so the flame changes composition by passage', () => {
    const session = compileSession({ title: 'Flame', text, wpm: 300, chunkMode: 'phrase', visualConfig: { visualMode: 'living-flame' } });
    expect(session.visualConfig.visualMode).toBe('living-flame');
    expect(directionEligibility(session)).toMatchObject({ canFollow: true, defaultMode: 'follow' });
  });
});

describe('which choices Follow text draws', () => {
  const text = Array.from({ length: 12 }, () => 'The quiet garden rests in gentle peace and the still water holds the soft light of evening.').join(' ');
  const shelf = (procedural, sourced = []) => ({ visualMode: 'interlocution', interlocution: { sourceFamily: sourced.length ? 'collections' : 'procedural', procedural, sourced, presentation: 'continuous' } });
  const family = visualConfig => {
    const session = compileSession({ title: 'Family', text, wpm: 300, chunkMode: 'phrase', visualConfig });
    return [directionEligibility(session).family, ensureDirector(session)?.family];
  };

  it('draws museum works for the Gallery look and for a shelf of museum collections', () => {
    expect(family(shelf(['turrell']))).toEqual(['gallery', 'gallery']);
    expect(family(shelf([], ['aic-landscapes', 'aic-oldmasters']))).toEqual(['gallery', 'gallery']);
  });

  it('never puts paintings into a science shelf: photographs of the sky are not a gallery of paintings', () => {
    expect(family(shelf([], ['sci-astronomy']))).toEqual(['flame', 'flame']);
    expect(family(shelf([], ['aic-landscapes', 'sci-astronomy']))).toEqual(['flame', 'flame']);
  });

  it('draws flames where the words draw from the room, so Follow never changes what fills them', () => {
    const filled = shelf(['turrell']);
    filled.interlocution = { ...filled.interlocution, wordFill: { mode: 'pick', sourceFamily: 'procedural', procedural: ['fractal'], sourced: [] }, wordFillDeclared: true };
    expect(family(filled)).toEqual(['flame', 'flame']);
  });

  it('draws flames for a Living Flame reading and an empty shelf, as before', () => {
    expect(family({ visualMode: 'living-flame' })).toEqual(['flame', 'flame']);
    expect(family(shelf([]))).toEqual(['flame', 'flame']);
  });
});

describe('which sources may be sent to Jev', () => {
  const digests = ['a1', 'b2', 'c3'];

  it('sends nothing without consent or catalog verification', () => {
    expect(permittedSourceDigests({ digests })).toEqual([]);
    expect(permittedSourceDigests({ digests, consent: {} })).toEqual([]);
  });

  it('covers every source of a multi-source reading the reader consented to', () => {
    // Only the first source was permitted when consent kept one digest.
    expect(permittedSourceDigests({ digests, consent: { sourceDigests: [...digests] } })).toEqual(digests);
  });

  it('never extends consent to a source whose text changed', () => {
    expect(permittedSourceDigests({ digests: ['a1', 'zz'], consent: { sourceDigests: ['a1', 'b2'] } }))
      .toEqual(['a1']);
  });

  it('permits every source of a verified catalog reading', () => {
    expect(permittedSourceDigests({ digests, catalogVerified: true })).toEqual(digests);
  });
});
