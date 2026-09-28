/**
 * The six shipped Living Flame compositions.
 *
 * Names describe abstract compositions, not objects. Each differs in
 * geometry (transform structure, variations, symmetry, framing) and in
 * motion (drift, breath, period), not only in palette.
 */

import { FLAME_ENGINE_VERSION, FLAME_RECIPE_SCHEMA, validateFlameRecipe } from '../../core/flame-recipe.js';

const base = (fields) => validateFlameRecipe({
  schema: FLAME_RECIPE_SCHEMA,
  engine: FLAME_ENGINE_VERSION,
  macros: { energy: 0.35, complexity: 0.55, hue: 0 },
  ...fields
});

export const FLAME_PRESETS = Object.freeze([
  base({
    id: 'ember-cathedral',
    name: 'Ember Cathedral',
    seed: 1207,
    symmetry: 1,
    // Four maps build an arcade: two side vaults, a polar-bent apex, and a
    // tall narrow column that raises spires between them. Ordered and
    // bilaterally balanced without literal symbols.
    transforms: [
      { weight: 0.25, affine: [0.5, 0, -0.5, 0, 0.5, 0.3], color: 0.1,
        variations: { linear: 0.8, sinusoidal: 0.2 } },
      { weight: 0.25, affine: [0.5, 0, 0.5, 0, 0.5, 0.3], color: 0.35,
        variations: { linear: 0.8, sinusoidal: 0.2 } },
      { weight: 0.25, affine: [0.42, 0, 0, 0, 0.42, -0.55], color: 0.7,
        variations: { linear: 0.6, polar: 0.4 } },
      { weight: 0.25, affine: [0.3, 0, 0, 0, 0.9, 0.1], color: 0.95,
        variations: { linear: 1 } }
    ],
    palette: ['#1a0500', '#6b1d04', '#c25a0e', '#f5a53a', '#ffe7b8'],
    tone: { exposure: 1.05, gamma: 2.2, vibrancy: 0.65 },
    camera: { zoom: 1.1, x: 0, y: -0.05, rotation: 0 },
    motion: { drift: 0.04, breathe: 0.28, period: 48 }
  }),
  base({
    id: 'violet-nebula',
    name: 'Violet Nebula',
    seed: 2311,
    symmetry: 1,
    // Inversions and swirls throw diffuse ribbons outward; a small framing
    // zoom leaves deep negative space around them.
    transforms: [
      { weight: 0.45, affine: [0.6, -0.3, 0.2, 0.3, 0.6, -0.1], color: 0.2,
        variations: { spherical: 0.5, swirl: 0.5 } },
      { weight: 0.4, affine: [-0.4, 0.5, -0.3, -0.5, -0.4, 0.2], color: 0.65,
        variations: { linear: 0.4, sinusoidal: 0.6 } },
      { weight: 0.15, affine: [0.3, 0, 0.6, 0, 0.3, 0], color: 0.95,
        variations: { spherical: 1 } }
    ],
    palette: ['#07021a', '#2a0e5c', '#6a2fb0', '#c07ae8', '#f3d4ff'],
    tone: { exposure: 0.85, gamma: 2.4, vibrancy: 0.7 },
    camera: { zoom: 0.48, x: 0, y: 0, rotation: 0.3 },
    motion: { drift: 0.3, breathe: 0.2, period: 70 }
  }),
  base({
    id: 'glacial-silk',
    name: 'Glacial Silk',
    seed: 3517,
    symmetry: 2,
    // Sinusoidal folds laid over one another like drawn silk, with a
    // horseshoe crease; the slowest drift of the set.
    transforms: [
      { weight: 0.45, affine: [0.8, 0.2, 0, -0.2, 0.6, 0.1], color: 0.15,
        variations: { sinusoidal: 0.8, horseshoe: 0.2 } },
      { weight: 0.35, affine: [0.5, -0.4, 0.4, 0.4, 0.5, -0.3], color: 0.6,
        variations: { linear: 0.5, sinusoidal: 0.5 } },
      { weight: 0.2, affine: [-0.6, 0.1, -0.2, 0.2, 0.5, 0.4], color: 0.95,
        variations: { linear: 0.4, horseshoe: 0.6 } }
    ],
    palette: ['#02121c', '#0b4a63', '#39a7c4', '#bfeefa', '#ffffff'],
    tone: { exposure: 0.95, gamma: 2.3, vibrancy: 0.5 },
    camera: { zoom: 1.35, x: 0.1, y: 0, rotation: 0.2 },
    motion: { drift: 0.1, breathe: 0.15, period: 96 }
  }),
  base({
    id: 'solar-bloom',
    name: 'Solar Bloom',
    seed: 4721,
    symmetry: 6,
    // Radial sixfold structure; a deep, fast breath reads as expansion.
    transforms: [
      { weight: 0.55, affine: [0.55, 0.2, 0.3, -0.2, 0.55, 0], color: 0.3,
        variations: { linear: 0.3, spherical: 0.4, polar: 0.3 } },
      { weight: 0.45, affine: [0.3, -0.6, 0, 0.6, 0.3, 0.4], color: 0.85,
        variations: { linear: 0.7, swirl: 0.3 } }
    ],
    palette: ['#200800', '#8a3a00', '#e08a10', '#ffd24a', '#fff6c8'],
    tone: { exposure: 1.05, gamma: 2.1, vibrancy: 0.7 },
    camera: { zoom: 0.8, x: 0, y: 0, rotation: 0 },
    motion: { drift: 0.15, breathe: 0.55, period: 30 }
  }),
  base({
    id: 'verdant-current',
    name: 'Verdant Current',
    seed: 5903,
    symmetry: 2,
    // A binary branching system — two rotated, shrinking limbs above a short
    // stem, bent by a sinusoidal current — drawn twice in point symmetry so
    // it reads as an S-shaped flow rather than a single plant.
    transforms: [
      { weight: 0.18, affine: [0.05, 0, 0, 0, 0.6, 0.35], color: 0.1,
        variations: { linear: 0.8, sinusoidal: 0.2 } },
      { weight: 0.41, affine: [0.52, -0.36, 0, 0.36, 0.52, -0.5], color: 0.5,
        variations: { linear: 0.7, swirl: 0.3 } },
      { weight: 0.41, affine: [0.5, 0.4, 0, -0.4, 0.5, -0.5], color: 0.9,
        variations: { linear: 0.65, sinusoidal: 0.35 } }
    ],
    palette: ['#010d05', '#0b3d1a', '#1f8a3c', '#7fdc6a', '#e6ffd0'],
    tone: { exposure: 1.1, gamma: 2.2, vibrancy: 0.55 },
    camera: { zoom: 0.75, x: 0, y: -0.3, rotation: 0.35 },
    motion: { drift: 0.08, breathe: 0.35, period: 36 }
  }),
  base({
    id: 'prismatic-knot',
    name: 'Prismatic Knot',
    seed: 6151,
    symmetry: 3,
    macros: { energy: 0.35, complexity: 0.7, hue: 0 },
    // Three skewed rotations with nonlinear bends trace long strands that
    // cross over and under one another in threefold rotation, under a
    // cyclic spectrum. Bred from seeded candidates and chosen by eye.
    transforms: [
      { weight: 0.279, affine: [0.344, 0.217, -0.429, -0.592, 0.126, 0.432], color: 0,
        variations: { linear: 0.152, swirl: 0.617, horseshoe: 0.23 } },
      { weight: 0.478, affine: [0.659, -0.034, -0.387, 0.192, 0.118, 0.556], color: 0.4,
        variations: { linear: 0.235, spherical: 0.433, sinusoidal: 0.332 } },
      { weight: 0.225, affine: [0.613, 0.464, 0.1, -0.516, 0.551, 0.059], color: 0.8,
        variations: { linear: 0.145, spherical: 0.544, polar: 0.311 } }
    ],
    palette: ['#ff2e88', '#7a2cff', '#1ad0ff', '#ffd23a', '#ff2e88'],
    tone: { exposure: 0.9, gamma: 2.2, vibrancy: 0.75 },
    camera: { zoom: 0.75, x: 0, y: 0, rotation: 0 },
    motion: { drift: 0.25, breathe: 0.3, period: 42 }
  })
]);

export const FLAME_PRESET_IDS = Object.freeze(FLAME_PRESETS.map(recipe => recipe.id));

export function flamePreset(id) {
  return FLAME_PRESETS.find(recipe => recipe.id === id) || null;
}
