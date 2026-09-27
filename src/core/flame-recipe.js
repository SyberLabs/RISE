/**
 * The one strict boundary for Living Flame recipes.
 *
 * A recipe is plain bounded data: a seed, up to eight weighted affine
 * transforms over a fixed variation vocabulary, a palette, tone, camera,
 * motion, and macro controls. Every entry point — canonical programs,
 * runtime normalization, Lab import, Workshop, persistence — calls this
 * validator, so a recipe accepted in one place is accepted everywhere and
 * nothing executable can ride along. Out-of-range data refuses with a path;
 * legal values are rounded to one stable precision.
 */

export const FLAME_RECIPE_SCHEMA = 'rise.flame-recipe.v1';
export const FLAME_ENGINE_VERSION = 1;
export const FLAME_VARIATIONS = Object.freeze([
  'linear', 'sinusoidal', 'spherical', 'swirl', 'horseshoe', 'polar'
]);
export const FLAME_LIMITS = Object.freeze({
  maxTransforms: 8,
  maxSymmetry: 8,
  maxPaletteStops: 6,
  maxImportBytes: 64 * 1024
});

const KEYS = {
  recipe: ['schema', 'engine', 'id', 'name', 'seed', 'symmetry', 'transforms',
    'palette', 'tone', 'camera', 'motion', 'macros'],
  transform: ['weight', 'affine', 'color', 'variations'],
  tone: ['exposure', 'gamma', 'vibrancy'],
  camera: ['zoom', 'x', 'y', 'rotation'],
  motion: ['drift', 'breathe', 'period'],
  macros: ['energy', 'complexity', 'hue']
};
const RANGES = {
  weight: [0.01, 1], affine: [-2, 2], color: [0, 1], variation: [0, 1],
  exposure: [0.2, 2.5], gamma: [1.2, 3.2], vibrancy: [0, 1],
  zoom: [0.2, 3], x: [-2, 2], y: [-2, 2], rotation: [-Math.PI, Math.PI],
  drift: [0, 1], breathe: [0, 1], period: [8, 120],
  energy: [0, 1], complexity: [0, 1], hue: [-180, 180]
};
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const HEX = /^#[0-9a-f]{6}$/;

export class FlameRecipeError extends Error {
  constructor(code, message, path = '$') {
    super(message);
    this.name = 'FlameRecipeError';
    this.code = code;
    this.path = path;
  }
}

const fail = (code, message, path) => { throw new FlameRecipeError(code, message, path); };
const round = value => Math.round(value * 1e4) / 1e4 + 0;

function object(value, path, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('FLAME_EXPECTED_OBJECT', `${label} must be an object.`, path);
  }
  const allowed = KEYS[path === '$' ? 'recipe' : label.toLowerCase()] || [];
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail('FLAME_UNKNOWN_FIELD', `${label} has an unsupported field “${key}”.`, `${path}.${key}`);
  }
  return value;
}

function number(value, key, path, label) {
  const [min, max] = RANGES[key];
  const ok = typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
  if (!ok) fail('FLAME_NUMBER', `${label} must be a number from ${min} to ${max}.`, path);
  return round(value);
}

function integer(value, min, max, path, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail('FLAME_NUMBER', `${label} must be a whole number from ${min} to ${max}.`, path);
  }
  return value;
}

function text(value, path, label, pattern = null) {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (!clean || clean.length > 64 || /[<>\u0000-\u001f\u007f]/u.test(clean)
    || (pattern && !pattern.test(clean))) {
    fail('FLAME_TEXT', `${label} must be 1 to 64 plain characters${pattern ? ' (lowercase letters, digits, and hyphens)' : ''}.`, path);
  }
  return clean;
}

function group(value, name, path) {
  const label = name[0].toUpperCase() + name.slice(1);
  object(value, path, label);
  return Object.freeze(Object.fromEntries(KEYS[name].map(key =>
    [key, number(value[key], key, `${path}.${key}`, `${label} ${key}`)])));
}

function transform(value, index) {
  const path = `$.transforms[${index}]`;
  const label = `Transform ${index + 1}`;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('FLAME_EXPECTED_OBJECT', `${label} must be an object.`, path);
  }
  for (const key of Object.keys(value)) {
    if (!KEYS.transform.includes(key)) fail('FLAME_UNKNOWN_FIELD', `${label} has an unsupported field “${key}”.`, `${path}.${key}`);
  }
  if (!Array.isArray(value.affine) || value.affine.length !== 6) {
    fail('FLAME_AFFINE', `${label} needs exactly six affine coefficients.`, `${path}.affine`);
  }
  const variations = value.variations;
  if (!variations || typeof variations !== 'object' || Array.isArray(variations)) {
    fail('FLAME_VARIATION', `${label} needs a variations object.`, `${path}.variations`);
  }
  for (const key of Object.keys(variations)) {
    if (!FLAME_VARIATIONS.includes(key)) {
      fail('FLAME_VARIATION', `${label} uses an unknown variation “${key}”.`, `${path}.variations.${key}`);
    }
  }
  const weights = {};
  for (const key of FLAME_VARIATIONS) {
    if (variations[key] === undefined) continue;
    const weight = number(variations[key], 'variation', `${path}.variations.${key}`, `${label} ${key}`);
    if (weight > 0) weights[key] = weight;
  }
  if (!Object.keys(weights).length) {
    fail('FLAME_VARIATION', `${label} needs at least one variation with weight above zero.`, `${path}.variations`);
  }
  return Object.freeze({
    weight: number(value.weight, 'weight', `${path}.weight`, `${label} weight`),
    affine: Object.freeze(value.affine.map((entry, i) =>
      number(entry, 'affine', `${path}.affine[${i}]`, `${label} affine coefficient ${i + 1}`))),
    color: number(value.color, 'color', `${path}.color`, `${label} color`),
    variations: Object.freeze(weights)
  });
}

/** Validate and canonicalize a recipe, or throw a FlameRecipeError. */
export function validateFlameRecipe(value) {
  const source = object(value, '$', 'Recipe');
  if (source.schema !== FLAME_RECIPE_SCHEMA || source.engine !== FLAME_ENGINE_VERSION) {
    fail('FLAME_VERSION', 'This recipe comes from an unsupported Living Flame version.', '$.schema');
  }
  const transforms = source.transforms;
  if (!Array.isArray(transforms) || transforms.length < 1
    || transforms.length > FLAME_LIMITS.maxTransforms) {
    fail('FLAME_TRANSFORMS', `A recipe needs 1 to ${FLAME_LIMITS.maxTransforms} transforms.`, '$.transforms');
  }
  const palette = source.palette;
  if (!Array.isArray(palette) || palette.length < 2 || palette.length > FLAME_LIMITS.maxPaletteStops
    || palette.some(stop => typeof stop !== 'string' || !HEX.test(stop.toLowerCase()))) {
    fail('FLAME_PALETTE', `A palette needs 2 to ${FLAME_LIMITS.maxPaletteStops} colors written as #rrggbb.`, '$.palette');
  }
  return Object.freeze({
    schema: FLAME_RECIPE_SCHEMA,
    engine: FLAME_ENGINE_VERSION,
    id: text(source.id, '$.id', 'Recipe id', ID),
    name: text(source.name, '$.name', 'Recipe name'),
    seed: integer(source.seed, 0, 0xffffffff, '$.seed', 'Seed'),
    symmetry: integer(source.symmetry, 1, FLAME_LIMITS.maxSymmetry, '$.symmetry', 'Symmetry'),
    transforms: Object.freeze(transforms.map(transform)),
    palette: Object.freeze(palette.map(stop => stop.toLowerCase())),
    tone: group(source.tone, 'tone', '$.tone'),
    camera: group(source.camera, 'camera', '$.camera'),
    motion: group(source.motion, 'motion', '$.motion'),
    macros: group(source.macros, 'macros', '$.macros')
  });
}

/** Non-throwing form for runtime normalization. */
export function normalizeFlameRecipe(value) {
  try {
    return validateFlameRecipe(value);
  } catch {
    return null;
  }
}

/** Recipes sharing a key can interpolate; others crossfade. */
export function flameStructureKey(recipe) {
  return [recipe.transforms.length, recipe.symmetry,
    ...recipe.transforms.map(item => Object.keys(item.variations).join('+'))].join('|');
}

/** Parse an imported JSON file under the 64 KiB ceiling. */
export function parseFlameRecipeJson(textValue) {
  const raw = typeof textValue === 'string' ? textValue : '';
  if (new TextEncoder().encode(raw).length > FLAME_LIMITS.maxImportBytes) {
    fail('FLAME_IMPORT_TOO_LARGE', 'That file is larger than 64 KB, so it is not a Living Flame recipe.', '$');
  }
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    fail('FLAME_IMPORT_JSON', 'That file is not valid JSON.', '$');
  }
  return validateFlameRecipe(value);
}

/**
 * A living-flame field cue's config: the full recipe (never only a preset
 * id, so a later preset edit cannot alter a saved creation) and an optional
 * intensity from 0 to 1.
 */
export function validateLivingFlameConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('FLAME_EXPECTED_OBJECT', 'A Living Flame cue needs a config with a recipe.', '$.config');
  }
  for (const key of Object.keys(value)) {
    if (key !== 'recipe' && key !== 'intensity') {
      fail('FLAME_UNKNOWN_FIELD', `A Living Flame cue has an unsupported field “${key}”.`, `$.config.${key}`);
    }
  }
  let recipe;
  try {
    recipe = validateFlameRecipe(value.recipe);
  } catch (error) {
    fail(error.code, error.message, `$.config.recipe${String(error.path || '$').slice(1)}`);
  }
  const config = { recipe };
  if (value.intensity !== undefined) {
    if (typeof value.intensity !== 'number' || !Number.isFinite(value.intensity)
      || value.intensity < 0 || value.intensity > 1) {
      fail('FLAME_NUMBER', 'Living Flame intensity must be a number from 0 to 1.', '$.config.intensity');
    }
    config.intensity = round(value.intensity);
  }
  return Object.freeze(config);
}

export function normalizeLivingFlameConfig(value) {
  try {
    return validateLivingFlameConfig(value);
  } catch {
    return null;
  }
}

/**
 * A stable key for one exact Living Flame configuration: the recipe id for
 * reading, plus a digest of the full recipe and intensity, so two passages
 * that share a composition at different intensities (or two edits that
 * share an id) never share a sample.
 */
export function livingFlameConfigKey(config) {
  const text = JSON.stringify({ recipe: config?.recipe ?? null, intensity: config?.intensity ?? null });
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${config?.recipe?.id ?? 'flame'}~${hash.toString(16).padStart(8, '0')}`;
}
