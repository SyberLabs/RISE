import { describe, expect, it } from 'vitest';
import {
  FLAME_RECIPE_SCHEMA,
  FLAME_VARIATIONS,
  FlameRecipeError,
  flameStructureKey,
  parseFlameRecipeJson,
  validateFlameRecipe
} from './flame-recipe.js';

function recipe(overrides = {}) {
  return {
    schema: FLAME_RECIPE_SCHEMA,
    engine: 1,
    id: 'test-flame',
    name: 'Test Flame',
    seed: 42,
    symmetry: 2,
    transforms: [
      { weight: 0.6, affine: [0.5, 0.1, 0, -0.1, 0.5, 0.2], color: 0.1, variations: { linear: 0.7, swirl: 0.3 } },
      { weight: 0.4, affine: [0.4, -0.3, 0.3, 0.3, 0.4, -0.1], color: 0.8, variations: { sinusoidal: 1 } }
    ],
    palette: ['#1a0602', '#8a2c08', '#f0a030', '#fff2d0'],
    tone: { exposure: 1, gamma: 2.2, vibrancy: 0.6 },
    camera: { zoom: 0.8, x: 0, y: 0, rotation: 0 },
    motion: { drift: 0.2, breathe: 0.3, period: 40 },
    macros: { energy: 0.35, complexity: 0.5, hue: 0 },
    ...overrides
  };
}

function refusal(value) {
  try {
    validateFlameRecipe(value);
  } catch (error) {
    return error;
  }
  throw new Error('Expected the recipe to be refused');
}

describe('flame recipe validation', () => {
  it('accepts a complete recipe and returns a frozen canonical copy', () => {
    const input = recipe();
    const result = validateFlameRecipe(input);
    expect(result).not.toBe(input);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.transforms[0].affine)).toBe(true);
    expect(result.transforms[0].variations).toEqual({ linear: 0.7, swirl: 0.3 });
    expect(validateFlameRecipe(result)).toEqual(result);
  });

  it('orders variations by the fixed vocabulary and drops zero weights', () => {
    const result = validateFlameRecipe(recipe({
      transforms: [{ weight: 1, affine: [0.5, 0, 0, 0, 0.5, 0], color: 0.5,
        variations: { polar: 0.2, linear: 0.8, swirl: 0 } }]
    }));
    expect(Object.keys(result.transforms[0].variations)).toEqual(['linear', 'polar']);
    expect(FLAME_VARIATIONS).toEqual(['linear', 'sinusoidal', 'spherical', 'swirl', 'horseshoe', 'polar']);
  });

  it('rounds numbers to a stable precision so equal intent compares equal', () => {
    const result = validateFlameRecipe(recipe({ tone: { exposure: 1.000004, gamma: 2.2, vibrancy: 0.6 } }));
    expect(result.tone.exposure).toBe(1);
  });

  it.each([
    ['an unknown top-level field', recipe({ shader: 'void main(){}' }), 'FLAME_UNKNOWN_FIELD'],
    ['an unknown schema', recipe({ schema: 'rise.flame-recipe.v2' }), 'FLAME_VERSION'],
    ['an unknown engine version', recipe({ engine: 2 }), 'FLAME_VERSION'],
    ['a non-integer seed', recipe({ seed: 1.5 }), 'FLAME_NUMBER'],
    ['a negative seed', recipe({ seed: -1 }), 'FLAME_NUMBER'],
    ['symmetry above eight', recipe({ symmetry: 9 }), 'FLAME_NUMBER'],
    ['no transforms', recipe({ transforms: [] }), 'FLAME_TRANSFORMS'],
    ['nine transforms', recipe({ transforms: Array.from({ length: 9 }, () => recipe().transforms[0]) }), 'FLAME_TRANSFORMS'],
    ['an unknown variation', recipe({ transforms: [{ ...recipe().transforms[0], variations: { julia: 1 } }] }), 'FLAME_VARIATION'],
    ['only zero variation weight', recipe({ transforms: [{ ...recipe().transforms[0], variations: { linear: 0 } }] }), 'FLAME_VARIATION'],
    ['a non-finite affine value', recipe({ transforms: [{ ...recipe().transforms[0], affine: [NaN, 0, 0, 0, 1, 0] }] }), 'FLAME_NUMBER'],
    ['an oversized affine value', recipe({ transforms: [{ ...recipe().transforms[0], affine: [3, 0, 0, 0, 1, 0] }] }), 'FLAME_NUMBER'],
    ['a five-value affine', recipe({ transforms: [{ ...recipe().transforms[0], affine: [1, 0, 0, 0, 1] }] }), 'FLAME_AFFINE'],
    ['a string weight', recipe({ transforms: [{ ...recipe().transforms[0], weight: '1' }] }), 'FLAME_NUMBER'],
    ['a zero weight', recipe({ transforms: [{ ...recipe().transforms[0], weight: 0 }] }), 'FLAME_NUMBER'],
    ['a code-bearing palette entry', recipe({ palette: ['#000000', 'url(javascript:alert(1))'] }), 'FLAME_PALETTE'],
    ['a single palette stop', recipe({ palette: ['#000000'] }), 'FLAME_PALETTE'],
    ['an exposure beyond its bound', recipe({ tone: { exposure: 5, gamma: 2.2, vibrancy: 0.6 } }), 'FLAME_NUMBER'],
    ['a missing tone field', recipe({ tone: { exposure: 1, gamma: 2.2 } }), 'FLAME_NUMBER'],
    ['a function value', recipe({ macros: { energy: () => 1, complexity: 0.5, hue: 0 } }), 'FLAME_NUMBER'],
    ['an empty name', recipe({ name: '   ' }), 'FLAME_TEXT'],
    ['a markup name', recipe({ name: '<img src=x onerror=alert(1)>' }), 'FLAME_TEXT'],
    ['an uppercase id', recipe({ id: 'Test' }), 'FLAME_TEXT'],
    ['an array recipe', [], 'FLAME_EXPECTED_OBJECT'],
    ['a prototype key', JSON.parse('{"__proto__":{"x":1}}'), 'FLAME_UNKNOWN_FIELD']
  ])('refuses %s', (_label, value, code) => {
    const error = refusal(value);
    expect(error).toBeInstanceOf(FlameRecipeError);
    expect(error.code).toBe(code);
    expect(error.message.length).toBeGreaterThan(10);
  });

  it('names the transform and variation a reader must fix', () => {
    const error = refusal(recipe({
      transforms: [recipe().transforms[0], { ...recipe().transforms[1], variations: { bubble: 1 } }]
    }));
    expect(error.message).toContain('Transform 2');
    expect(error.message).toContain('bubble');
  });

  it('keys structure by transform count, symmetry, and variation set', () => {
    const base = validateFlameRecipe(recipe());
    const moved = validateFlameRecipe(recipe({ tone: { exposure: 1.4, gamma: 2, vibrancy: 0.2 } }));
    const restructured = validateFlameRecipe(recipe({ symmetry: 3 }));
    expect(flameStructureKey(base)).toBe(flameStructureKey(moved));
    expect(flameStructureKey(base)).not.toBe(flameStructureKey(restructured));
  });
});

describe('flame recipe JSON import', () => {
  it('parses and validates exported JSON', () => {
    const text = JSON.stringify(recipe());
    expect(parseFlameRecipeJson(text).id).toBe('test-flame');
  });

  it('refuses files above 64 KiB before parsing', () => {
    const text = JSON.stringify({ ...recipe(), padding: 'x'.repeat(70 * 1024) });
    const error = (() => { try { parseFlameRecipeJson(text); } catch (e) { return e; } })();
    expect(error.code).toBe('FLAME_IMPORT_TOO_LARGE');
  });

  it('explains malformed JSON', () => {
    const error = (() => { try { parseFlameRecipeJson('{"schema":'); } catch (e) { return e; } })();
    expect(error.code).toBe('FLAME_IMPORT_JSON');
    expect(error.message).toMatch(/not valid JSON/i);
  });
});
