import { describe, expect, it } from 'vitest';
import { flameStructureKey, validateFlameRecipe } from '../../core/flame-recipe.js';
import {
  RecipeHistory,
  createRng,
  effectiveVariations,
  mutateRecipe,
  paletteLut,
  probeRecipe,
  resolveFlameFrame
} from './flame-math.js';
import { FLAME_PRESETS, FLAME_PRESET_IDS, flamePreset } from './flame-presets.js';

describe('flame presets', () => {
  it('ships the six named compositions as valid recipes', () => {
    expect(FLAME_PRESET_IDS).toEqual([
      'ember-cathedral', 'violet-nebula', 'glacial-silk',
      'solar-bloom', 'verdant-current', 'prismatic-knot'
    ]);
    for (const recipe of FLAME_PRESETS) {
      expect(validateFlameRecipe(recipe)).toEqual(recipe);
      expect(probeRecipe(recipe).visible).toBe(true);
    }
  });

  it('differs in geometry and motion, not only palette', () => {
    const structures = new Set(FLAME_PRESETS.map(flameStructureKey));
    const motions = new Set(FLAME_PRESETS.map(recipe => JSON.stringify(recipe.motion)));
    const cameras = new Set(FLAME_PRESETS.map(recipe => JSON.stringify(recipe.camera)));
    expect(structures.size).toBe(6);
    expect(motions.size).toBe(6);
    expect(cameras.size).toBeGreaterThanOrEqual(5);
  });

  it('looks presets up by id', () => {
    expect(flamePreset('solar-bloom').name).toBe('Solar Bloom');
    expect(flamePreset('unknown')).toBeNull();
  });
});

describe('flame frame resolution', () => {
  const recipe = flamePreset('glacial-silk');

  it('is a pure function of logical time, so seeking needs no history', () => {
    expect(resolveFlameFrame(recipe, 37.5, 0.35)).toEqual(resolveFlameFrame(recipe, 37.5, 0.35));
    expect(resolveFlameFrame(recipe, 37.5, 0.35)).not.toEqual(resolveFlameFrame(recipe, 12, 0.35));
  });

  it('keeps structure fixed while it moves', () => {
    const a = resolveFlameFrame(recipe, 0, 0.35);
    const b = resolveFlameFrame(recipe, 90, 0.35);
    expect(a.transforms.length).toBe(b.transforms.length);
    expect(a.symmetry).toBe(b.symmetry);
    for (let i = 0; i < a.transforms.length; i += 1) {
      a.transforms[i].affine.forEach((value, k) => {
        expect(Math.abs(value - b.transforms[i].affine[k])).toBeLessThan(0.35);
      });
    }
  });

  it('bounds exposure by energy', () => {
    const quiet = resolveFlameFrame(recipe, 0, 0).tone.exposure;
    const intense = resolveFlameFrame(recipe, 0, 1).tone.exposure;
    expect(quiet).toBeCloseTo(recipe.tone.exposure * 0.8);
    expect(intense).toBeCloseTo(recipe.tone.exposure * 1.25);
    expect(resolveFlameFrame(recipe, 0, 9).tone.exposure).toBeCloseTo(intense);
  });

  it('ends cumulative transform weights at exactly one', () => {
    for (const preset of FLAME_PRESETS) {
      const frame = resolveFlameFrame(preset, 3, 0.5);
      expect(frame.transforms.at(-1).cumulative).toBe(1);
      frame.transforms.forEach(item => {
        const sum = Object.values(item.variations).reduce((total, value) => total + value, 0);
        expect(sum).toBeCloseTo(1, 6);
      });
    }
  });

  it('moves complexity weight between linear and nonlinear smoothly', () => {
    const low = effectiveVariations({ linear: 0.5, swirl: 0.5 }, 0);
    const high = effectiveVariations({ linear: 0.5, swirl: 0.5 }, 1);
    expect(low.swirl).toBeLessThan(high.swirl);
    expect(low.linear + low.swirl).toBeCloseTo(1);
  });
});

describe('palette macro', () => {
  it('builds a 256-entry opaque lookup and rotates hue', () => {
    const recipe = flamePreset('solar-bloom');
    const lut = paletteLut(recipe);
    expect(lut).toHaveLength(1024);
    expect(lut[3]).toBe(255);
    const shifted = paletteLut(validateFlameRecipe({ ...recipe, macros: { ...recipe.macros, hue: 120 } }));
    expect(Array.from(shifted.slice(512, 515))).not.toEqual(Array.from(lut.slice(512, 515)));
  });
});

describe('seeded mutation', () => {
  const recipe = flamePreset('ember-cathedral');

  it('is reproducible for a seed and preserves palette, tone, camera, motion, and macros', () => {
    const a = mutateRecipe(recipe, 99);
    const b = mutateRecipe(recipe, 99);
    expect(a).toEqual(b);
    expect(a).not.toEqual(recipe);
    expect(a.palette).toEqual(recipe.palette);
    expect(a.tone).toEqual(recipe.tone);
    expect(a.camera).toEqual(recipe.camera);
    expect(a.motion).toEqual(recipe.motion);
    expect(a.macros).toEqual(recipe.macros);
    expect(a.transforms).toHaveLength(recipe.transforms.length);
    expect(validateFlameRecipe(a)).toEqual(a);
    expect(a.name).toBe('Ember Cathedral · variant');
    expect(mutateRecipe(a, 7).name).toBe('Ember Cathedral · variant');
  });

  it('stays bounded across many generations', () => {
    let current = recipe;
    for (let generation = 0; generation < 40; generation += 1) {
      current = mutateRecipe(current, 1000 + generation) || current;
      current.transforms.forEach(item => item.affine.forEach(value => {
        expect(Math.abs(value)).toBeLessThanOrEqual(2);
      }));
    }
    expect(probeRecipe(current).visible).toBe(true);
  });

  it('returns null rather than an empty scene when no candidate is visible', () => {
    expect(mutateRecipe(recipe, 5, { attempts: 0 })).toBeNull();
  });
});

describe('emptiness probe', () => {
  it('rejects a recipe that collapses to a point', () => {
    const point = validateFlameRecipe({
      ...flamePreset('violet-nebula'),
      transforms: [{ weight: 1, affine: [0.01, 0, 0, 0, 0.01, 0], color: 0.5, variations: { linear: 1 } }]
    });
    expect(probeRecipe(point).visible).toBe(false);
  });

  it('is deterministic', () => {
    expect(probeRecipe(flamePreset('prismatic-knot'))).toEqual(probeRecipe(flamePreset('prismatic-knot')));
  });
});

describe('undo history', () => {
  it('keeps the latest twenty recipes', () => {
    const history = new RecipeHistory(20);
    for (let i = 0; i < 25; i += 1) history.push({ id: String(i) });
    expect(history.size).toBe(20);
    expect(history.pop().id).toBe('24');
    expect(history.entries[0].id).toBe('5');
  });
});

describe('rng', () => {
  it('reproduces a sequence from a seed', () => {
    const a = createRng(5);
    const b = createRng(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
