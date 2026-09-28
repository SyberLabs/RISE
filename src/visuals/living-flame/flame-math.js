/**
 * Pure Living Flame mathematics shared by the WebGL2 renderer, the CPU
 * fallback, the Lab, and tests.
 *
 * Seed, structural identity, and motion envelope stay separate: the recipe
 * fixes structure; `resolveFlameFrame(recipe, t, energy)` is a pure function
 * of logical time, so pausing freezes it and seeking is an evaluation at the
 * destination time rather than a replay of history.
 */

import { FLAME_VARIATIONS, validateFlameRecipe } from '../../core/flame-recipe.js';

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Small, fast, well-distributed 32-bit generator. */
export function createRng(seed) {
  let state = (Number(seed) >>> 0) || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashUnit(seed, index) {
  return createRng((Number(seed) ^ Math.imul(index + 1, 0x85ebca6b)) >>> 0)();
}

/**
 * Complexity blends nonlinear variation weight toward linear. It is a
 * continuous control, so two frames of the same recipe interpolate cleanly.
 */
export function effectiveVariations(variations, complexity) {
  const keep = 0.3 + 0.7 * clamp(complexity, 0, 1);
  const out = Object.fromEntries(FLAME_VARIATIONS.map(name => [name, 0]));
  let moved = 0;
  for (const [name, weight] of Object.entries(variations)) {
    if (name === 'linear') out.linear += weight;
    else {
      out[name] += weight * keep;
      moved += weight * (1 - keep);
    }
  }
  out.linear += moved;
  const total = FLAME_VARIATIONS.reduce((sum, name) => sum + out[name], 0) || 1;
  for (const name of FLAME_VARIATIONS) out[name] /= total;
  return out;
}

/**
 * Evaluate the animated composition at logical time `seconds`.
 * `energy` (0..1) scales motion speed, breath amplitude, and exposure within
 * fixed bounds; it never changes structure.
 */
export function resolveFlameFrame(recipe, seconds = 0, energy = 0.35) {
  const e = clamp(Number(energy) || 0, 0, 1);
  const t = (Number.isFinite(seconds) ? seconds : 0) * (0.25 + 1.5 * e);
  const breathe = recipe.motion.breathe * (0.4 + 1.2 * e);
  const period = recipe.motion.period;
  const totalWeight = recipe.transforms.reduce((sum, item) => sum + item.weight, 0);
  let cumulative = 0;
  const transforms = recipe.transforms.map((item, index) => {
    const phase = hashUnit(recipe.seed, index) * TAU;
    const angle = breathe * 0.18 * Math.sin(TAU * t / period + phase);
    const scale = 1 + breathe * 0.06 * Math.sin(TAU * t / (period * 1.37) + phase * 1.3);
    const [a, b, c, d, ee, f] = item.affine;
    const cos = Math.cos(angle) * scale;
    const sin = Math.sin(angle) * scale;
    cumulative += item.weight / totalWeight;
    return {
      affine: [
        cos * a - sin * d, cos * b - sin * ee, c + breathe * 0.05 * Math.cos(TAU * t / period + phase),
        sin * a + cos * d, sin * b + cos * ee, f + breathe * 0.05 * Math.sin(TAU * t / period + phase)
      ],
      cumulative: Math.min(1, cumulative),
      color: item.color,
      variations: effectiveVariations(item.variations, recipe.macros.complexity)
    };
  });
  transforms[transforms.length - 1].cumulative = 1;
  return {
    transforms,
    symmetry: recipe.symmetry,
    camera: {
      zoom: recipe.camera.zoom,
      x: recipe.camera.x,
      y: recipe.camera.y,
      rotation: recipe.camera.rotation + recipe.motion.drift * 0.035 * t
    },
    tone: {
      exposure: recipe.tone.exposure * (0.8 + 0.45 * e),
      gamma: recipe.tone.gamma,
      vibrancy: recipe.tone.vibrancy
    }
  };
}

/** The six-variation vocabulary, matching the CPU generator's conventions. */
export function applyVariations(x, y, weights, out = [0, 0]) {
  const r2 = x * x + y * y;
  const r = Math.sqrt(r2);
  let ox = weights.linear * x;
  let oy = weights.linear * y;
  if (weights.sinusoidal) { ox += weights.sinusoidal * Math.sin(x); oy += weights.sinusoidal * Math.sin(y); }
  if (weights.spherical) { const inv = 1 / Math.max(r2, 1e-6); ox += weights.spherical * x * inv; oy += weights.spherical * y * inv; }
  if (weights.swirl) {
    const s = Math.sin(r2); const c = Math.cos(r2);
    ox += weights.swirl * (x * s - y * c); oy += weights.swirl * (x * c + y * s);
  }
  if (weights.horseshoe) {
    const inv = 1 / Math.max(r, 1e-6);
    ox += weights.horseshoe * (x - y) * (x + y) * inv; oy += weights.horseshoe * 2 * x * y * inv;
  }
  if (weights.polar) { ox += weights.polar * Math.atan2(y, x) / Math.PI; oy += weights.polar * (r - 1); }
  out[0] = ox;
  out[1] = oy;
  return out;
}

/** Iterate one point through a resolved frame (CPU mirror of the shader). */
export function iteratePoint(frame, state, rng) {
  const pick = rng();
  const transform = frame.transforms.find(item => pick <= item.cumulative) || frame.transforms[0];
  const [a, b, c, d, e, f] = transform.affine;
  const ax = a * state.x + b * state.y + c;
  const ay = d * state.x + e * state.y + f;
  const out = applyVariations(ax, ay, transform.variations);
  const x = out[0];
  const y = out[1];
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e4 || Math.abs(y) > 1e4) {
    state.x = rng() * 2 - 1;
    state.y = rng() * 2 - 1;
    state.age = 0;
    return false;
  }
  state.x = x;
  state.y = y;
  state.color = (state.color + transform.color) * 0.5;
  state.age += 1;
  return true;
}

/**
 * World point to normalized view coordinates (-1..1 inside the view).
 * Rotational symmetry is applied here, at plot time, as the CPU generator
 * does: copies are drawn but never fed back into the iteration, so a
 * k-fold recipe shows k rotations of one attractor instead of filling in.
 */
export function projectPoint(frame, x, y, aspect = 1, turn = 0) {
  const angle = frame.camera.rotation + (frame.symmetry > 1 ? turn * Math.PI * 2 / frame.symmetry : 0);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const wx = x - frame.camera.x;
  const wy = y - frame.camera.y;
  const px = (wx * cos - wy * sin) * frame.camera.zoom;
  const py = (wx * sin + wy * cos) * frame.camera.zoom;
  return aspect >= 1 ? [px / aspect, py] : [px, py * aspect];
}

/**
 * A cheap CPU check that a recipe draws a visible structure: enough finite
 * points land in view and they spread across many cells instead of
 * collapsing to a dot or escaping.
 */
export function probeRecipe(recipe, { iterations = 6000, grid = 48 } = {}) {
  const frame = resolveFlameFrame(recipe, 0, recipe.macros.energy);
  const rng = createRng(recipe.seed ^ 0x51ed270b);
  const state = { x: rng() * 2 - 1, y: rng() * 2 - 1, color: 0.5, age: 0 };
  const cells = new Set();
  let finite = 0;
  for (let i = 0; i < iterations; i += 1) {
    if (!iteratePoint(frame, state, rng)) continue;
    finite += 1;
    if (state.age < 12) continue;
    const [px, py] = projectPoint(frame, state.x, state.y, 1, Math.floor(rng() * frame.symmetry));
    if (Math.abs(px) < 1 && Math.abs(py) < 1) {
      cells.add(Math.floor((px + 1) * 0.5 * grid) * grid + Math.floor((py + 1) * 0.5 * grid));
    }
  }
  const occupied = cells.size;
  return { occupied, finiteRatio: finite / iterations, visible: occupied >= 60 && finite / iterations > 0.9 };
}

function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rotateHue([r, g, b], degrees) {
  if (!degrees) return [r, g, b];
  // Rodrigues rotation around the grey axis keeps luminance close.
  const angle = degrees * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const k = (1 - cos) / 3;
  const s = sin / Math.sqrt(3);
  const m = [cos + k, k - s, k + s, k + s, cos + k, k - s, k - s, k + s, cos + k];
  return [
    clamp(m[0] * r + m[1] * g + m[2] * b, 0, 255),
    clamp(m[3] * r + m[4] * g + m[5] * b, 0, 255),
    clamp(m[6] * r + m[7] * g + m[8] * b, 0, 255)
  ];
}

/** 256-entry RGBA palette from evenly spaced stops with a hue macro. */
export function paletteLut(recipe) {
  const stops = recipe.palette.map(hex => rotateHue(hexToRgb(hex), recipe.macros.hue));
  const lut = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i += 1) {
    const position = (i / 255) * (stops.length - 1);
    const left = Math.min(stops.length - 2, Math.floor(position));
    const mix = position - left;
    for (let channel = 0; channel < 3; channel += 1) {
      lut[i * 4 + channel] = Math.round(stops[left][channel] * (1 - mix) + stops[left + 1][channel] * mix);
    }
    lut[i * 4 + 3] = 255;
  }
  return lut;
}

function contractive(affine) {
  const [a, b, c, d, e, f] = affine;
  const norm = Math.sqrt(a * a + b * b + d * d + e * e);
  const scale = norm > 1.25 ? 1.25 / norm : 1;
  return [a * scale, b * scale, clamp(c, -1.5, 1.5), d * scale, e * scale, clamp(f, -1.5, 1.5)];
}

function mutateOnce(recipe, rng, strength) {
  const transforms = recipe.transforms.map(item => ({
    ...item, affine: [...item.affine], variations: { ...item.variations }
  }));
  const touched = new Set([Math.floor(rng() * transforms.length)]);
  if (transforms.length > 1 && rng() < 0.5) touched.add(Math.floor(rng() * transforms.length));
  for (const index of touched) {
    const item = transforms[index];
    item.affine = contractive(item.affine.map(value => value + (rng() - 0.5) * 0.3 * strength));
    item.weight = clamp(item.weight * (0.7 + rng() * 0.7), 0.05, 1);
    item.color = (item.color + (rng() - 0.5) * 0.3 + 1) % 1;
    if (rng() < 0.4) {
      const name = FLAME_VARIATIONS[1 + Math.floor(rng() * (FLAME_VARIATIONS.length - 1))];
      item.variations[name] = (item.variations[name] || 0) + 0.15 + rng() * 0.35;
    }
    const total = Object.values(item.variations).reduce((sum, value) => sum + value, 0);
    for (const name of Object.keys(item.variations)) {
      item.variations[name] = Math.min(1, item.variations[name] / total);
    }
  }
  const seed = Math.floor(rng() * 0xffffffff) >>> 0;
  const baseName = recipe.name.replace(/ · variant$/u, '');
  return validateFlameRecipe({
    ...recipe,
    id: `variant-${seed.toString(36)}`,
    name: `${baseName.slice(0, 52)} · variant`,
    seed,
    transforms
  });
}

/**
 * A seeded, bounded mutation that keeps palette, tone, camera, motion, and
 * macros. Returns null when no visible candidate appears within the attempt
 * budget, so the caller keeps the last working scene.
 */
export function mutateRecipe(recipe, seed, { attempts = 6, strength = 1 } = {}) {
  const rng = createRng(seed);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let candidate;
    try {
      candidate = mutateOnce(recipe, rng, strength * (1 - attempt * 0.12));
    } catch {
      continue;
    }
    if (probeRecipe(candidate).visible) return candidate;
  }
  return null;
}

/** A bounded undo history of whole recipes. */
export class RecipeHistory {
  constructor(limit = 20) {
    this.limit = limit;
    this.entries = [];
  }

  push(recipe) {
    if (!recipe) return;
    this.entries.push(recipe);
    if (this.entries.length > this.limit) this.entries.shift();
  }

  pop() {
    return this.entries.pop() || null;
  }

  get size() {
    return this.entries.length;
  }
}
