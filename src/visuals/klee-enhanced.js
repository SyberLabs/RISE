import { createSeededRandom, analyzeDensityGrid, buildTextureBytes } from './lib/klee-core.js';
import { planKleeModulation, kleeStrokePalette } from '../core/conductor.js';

// Shared implementations live in klee-core.js (also used by the module
// worker) and conductor.js (which owns all signal→parameter semantics).
export { createSeededRandom } from './lib/klee-core.js';
export { planKleeModulation } from '../core/conductor.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (from, to, amount) => from + (to - from) * amount;

export const KLEE_CHAMBER_BACKGROUND = '#0A0A0C';

export const KLEE_PRESET_NAMES = [
  'architectural', 'chaotic', 'harmonic', 'gravitational', 'twittering'
];

export const KLEE_PRESET_PROFILES = Object.freeze({
  // Palettes derive from the conductor's climate anchors (FLAME_PALETTES),
  // so Klee marks and fractal flames inhabit the same mood weather.
  architectural: {
    variations: { architectural: 0.8, angular: 0.2 },
    palette: kleeStrokePalette('architectural'),
    style: { lineWidth: 1.05, alpha: 0.76, glow: 1.2, ghostAlpha: 0.11, texture: 0.016 },
    generation: { steps: 220, minLines: 2, maxLines: 3, maxTotalLines: 18, branchProbability: 0.002, maxBranches: 1, densityStop: 10 }
  },
  chaotic: {
    variations: { chaotic: 0.5, explosive: 0.3, trembling: 0.2 },
    palette: kleeStrokePalette('chaotic'),
    style: { lineWidth: 0.9, alpha: 0.61, glow: 2.3, ghostAlpha: 0.16, texture: 0.024 },
    generation: { steps: 170, minLines: 2, maxLines: 3, maxTotalLines: 32, branchProbability: 0.005, maxBranches: 2, densityStop: 12 }
  },
  harmonic: {
    variations: { harmonic: 0.7, rhythmic: 0.3 },
    palette: kleeStrokePalette('harmonic'),
    style: { lineWidth: 1.15, alpha: 0.74, glow: 3.2, ghostAlpha: 0.13, texture: 0.014 },
    generation: { steps: 150, minLines: 1, maxLines: 2, maxTotalLines: 12, branchProbability: 0, maxBranches: 0, densityStop: 8 }
  },
  gravitational: {
    variations: { gravitational: 0.8, flowing: 0.2 },
    palette: kleeStrokePalette('gravitational'),
    style: { lineWidth: 0.92, alpha: 0.57, glow: 4.2, ghostAlpha: 0.18, texture: 0.02 },
    generation: { steps: 180, minLines: 2, maxLines: 2, maxTotalLines: 20, branchProbability: 0, maxBranches: 0, densityStop: 7 }
  },
  twittering: {
    variations: { twittering: 0.7, trembling: 0.3 },
    palette: kleeStrokePalette('twittering'),
    style: { lineWidth: 0.82, alpha: 0.66, glow: 1.8, ghostAlpha: 0.14, texture: 0.019 },
    generation: { steps: 180, minLines: 2, maxLines: 3, maxTotalLines: 30, branchProbability: 0.002, maxBranches: 2, densityStop: 9 }
  }
});

function colorToRgb(color) {
  if (color.startsWith('#')) {
    const value = parseInt(color.replace('#', ''), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  return channels?.length === 3 ? channels : [255, 255, 255];
}

function mixColor(from, to, amount) {
  const a = colorToRgb(from);
  const b = colorToRgb(to);
  return `rgb(${Math.round(lerp(a[0], b[0], amount))},${Math.round(lerp(a[1], b[1], amount))},${Math.round(lerp(a[2], b[2], amount))})`;
}

export function interpolatePresetProfiles(fromName, toName, amount) {
  const from = KLEE_PRESET_PROFILES[fromName] || KLEE_PRESET_PROFILES.harmonic;
  const to = KLEE_PRESET_PROFILES[toName] || KLEE_PRESET_PROFILES.harmonic;
  const t = clamp(amount, 0, 1);
  const variations = {};
  const names = new Set([...Object.keys(from.variations), ...Object.keys(to.variations)]);
  for (const name of names) {
    variations[name] = lerp(from.variations[name] || 0, to.variations[name] || 0, t);
  }
  const style = {};
  for (const key of Object.keys(to.style)) style[key] = lerp(from.style[key], to.style[key], t);
  return {
    variations,
    palette: to.palette.map((color, index) => mixColor(from.palette[index], color, t)),
    style
  };
}

/**
 * KLEE ENGINE - ENHANCED VERSION
 * With multi-octave 2D Simplex noise and marching squares for smooth organic forms
 *
 * Improvements over base version:
 * - 2D Simplex noise (no external dependencies - implemented from scratch)
 * - Multi-octave noise for richer textures
 * - Marching squares algorithm for smooth contours
 * - Bezier curve fitting for elegant form boundaries
 * - Resolves the "blocky sleeve" aesthetic issue
 *
 * @author Klee Engine Team
 * @version 2.0.0 - Enhanced
 */

class KleeEngine {
  constructor(options = {}) {
    // Core state
    this.seeds = [];
    this.lines = [];
    this.forms = [];
    this.palette = [];
    this.densityGrid = null;
    this.gridResolution = 100; // Increased for smoother contours

    // Generation parameters
    this.width = 1024;
    this.height = 1024;
    this.stepLength = 5;
    this.maxSteps = 500;
    this.preset = 'harmonic';
    this.basePalette = [];
    this.renderStyle = { ...KLEE_PRESET_PROFILES.harmonic.style };
    this.generationStyle = { ...KLEE_PRESET_PROFILES.harmonic.generation };
    this.semantic = planKleeModulation(null);
    this.textureTile = null;

    // A seeded stream makes an artwork reproducible while subsequent calls
    // naturally advance to new stochastic siblings.
    const autoSeed = `${Date.now()}-${Math.random()}`;
    this.setSeed(options.seed ?? autoSeed, options.rng);

    this._worker = null;
    this._workerRequests = new Map();
    this._workerRequestId = 0;
    this._generationEpoch = 0;
    this._enhancementPromise = null;
    this._generationLineBudget = this.generationStyle.maxTotalLines;

    // Initialize default palette
    this._generateDefaultPalette();
  }

  setSeed(seed, rng) {
    this.seed = seed;
    this._rng = rng || createSeededRandom(seed);
    this.simplexPermutation = this._initializeSimplex();
    return this;
  }

  random() {
    return this._rng();
  }

  _ensureWorker() {
    if (this._worker) return this._worker;
    if (typeof Worker === 'undefined') return null;
    try {
      // Module worker bundled from src — shares klee-core.js with the
      // engine's sync fallbacks, so worker and non-worker output never drift.
      this._worker = new Worker(
        new URL('./lib/klee-worker-entry.js', import.meta.url),
        { type: 'module' }
      );
      this._worker.onmessage = ({ data }) => {
        const request = this._workerRequests.get(data.id);
        if (!request) return;
        this._workerRequests.delete(data.id);
        if (data.error) request.reject(new Error(data.error));
        else request.resolve(data.result);
      };
      this._worker.onerror = () => {
        for (const request of this._workerRequests.values()) {
          request.reject(new Error('Klee worker failed'));
        }
        this._workerRequests.clear();
        this._worker?.terminate();
        this._worker = null;
      };
      return this._worker;
    } catch (_error) {
      this._worker = null;
      return null;
    }
  }

  _requestWorker(task, payload, transfer = []) {
    const worker = this._ensureWorker();
    if (!worker) return Promise.reject(new Error('Klee worker unavailable'));
    const id = ++this._workerRequestId;
    return new Promise((resolve, reject) => {
      this._workerRequests.set(id, { resolve, reject });
      worker.postMessage({ id, task, ...payload }, transfer);
    });
  }

  async _detectFormsAsync(epoch = this._generationEpoch) {
    if (!this.densityGrid) return;
    const density = this.densityGrid.slice();
    try {
      const result = await this._requestWorker('analyze-density', {
        density: density.buffer,
        gridResolution: this.gridResolution,
        width: this.width,
        height: this.height,
        threshold: 3
      }, [density.buffer]);
      if (epoch === this._generationEpoch) this.forms = result.forms || [];
    } catch (_error) {
      // Contours are decorative. If the worker is unavailable, preserve a
      // responsive flash rather than running marching squares on the UI thread.
      if (epoch === this._generationEpoch) this.forms = [];
    }
  }

  async _prepareTextureAsync(intensity, epoch = this._generationEpoch) {
    try {
      const result = await this._requestWorker('build-texture', {
        seed: `${this.seed}:${this.preset}:texture`,
        size: 48,
        intensity
      });
      if (epoch === this._generationEpoch) {
        this.textureTile = this._textureTileFromBytes(result.size, new Uint8ClampedArray(result.pixels));
      }
    } catch (_error) {
      if (epoch === this._generationEpoch) this.textureTile = this._buildTextureTileSync(48, intensity);
    }
  }

  _textureTileFromBytes(size, pixels) {
    if (typeof document === 'undefined') return null;
    const tile = document.createElement('canvas');
    tile.width = size;
    tile.height = size;
    const tileCtx = tile.getContext('2d');
    if (!tileCtx) return null;
    const image = tileCtx.createImageData(size, size);
    image.data.set(pixels);
    tileCtx.putImageData(image, 0, 0);
    return tile;
  }

  /**
   * Initialize 2D Simplex noise with permutation table
   * Based on Ken Perlin's improved noise
   */
  _initializeSimplex() {
    const p = Array.from({ length: 256 }, (_, index) => index);
    for (let i = p.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }

    // Duplicate for easy wrapping
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      perm[i] = p[i & 255];
    }

    return perm;
  }

  /**
   * 2D Simplex Noise
   * Returns value in [-1, 1]
   */
  noise2D(x, y) {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

    // Skew input space
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);

    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    // Determine simplex
    let i1, j1;
    if (x0 > y0) {
      i1 = 1; j1 = 0;
    } else {
      i1 = 0; j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    // Gradients
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.simplexPermutation[ii + this.simplexPermutation[jj]] % 12;
    const gi1 = this.simplexPermutation[ii + i1 + this.simplexPermutation[jj + j1]] % 12;
    const gi2 = this.simplexPermutation[ii + 1 + this.simplexPermutation[jj + 1]] % 12;

    // Gradient vectors
    const grad3 = [
      [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
      [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
      [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
    ];

    // Calculate contributions
    let n0, n1, n2;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) n0 = 0.0;
    else {
      t0 *= t0;
      n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) n1 = 0.0;
    else {
      t1 *= t1;
      n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) n2 = 0.0;
    else {
      t2 *= t2;
      n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2);
    }

    // Sum and scale to [-1, 1]
    return 70.0 * (n0 + n1 + n2);
  }

  /**
   * Multi-octave 2D noise (fractal Brownian motion)
   * This is the secret sauce for rich, natural textures
   */
  multiOctaveNoise2D(x, y, octaves = 4, persistence = 0.5) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return total / maxValue;
  }

  /**
   * Generate a Klee-inspired color palette
   */
  _generateDefaultPalette() {
    this.palette = [];
    const baseHues = [0, 30, 60, 120, 180, 210, 240, 270, 300, 330];

    for (let hue of baseHues) {
      this.palette.push(this._hslToRgb(hue, 0.7, 0.5));
      this.palette.push(this._hslToRgb(hue, 0.5, 0.7));
      this.palette.push(this._hslToRgb(hue, 0.8, 0.3));
    }

    this.palette.push(this._hslToRgb(0, 0, 0.9));
    this.palette.push(this._hslToRgb(0, 0, 0.2));
    this.palette.push(this._hslToRgb(40, 0.2, 0.8));
  }

  setPalette(colors) {
    this.palette = colors.map(c => {
      if (typeof c === 'string') return c;
      if (c.h !== undefined) return this._hslToRgb(c.h, c.s, c.l);
      return `rgb(${c.r},${c.g},${c.b})`;
    });
  }

  configurePresetStyle(name, options = {}) {
    const resolved = KLEE_PRESET_PROFILES[name] ? name : 'harmonic';
    const blendFrom = KLEE_PRESET_PROFILES[options.blendFrom] ? options.blendFrom : resolved;
    const blend = options.blendFrom ? clamp(options.blend ?? 1, 0, 1) : 1;
    const profile = interpolatePresetProfiles(blendFrom, resolved, blend);
    this.preset = resolved;
    this.basePalette = [...profile.palette];
    this.renderStyle = { ...profile.style };
    this.generationStyle = { ...KLEE_PRESET_PROFILES[resolved].generation };
    this.applySemanticSignal(options.signal, 1);
    return profile;
  }

  applySemanticSignal(signal, amount = 1) {
    const target = planKleeModulation(signal);
    const t = clamp(amount, 0, 1);
    const current = this.semantic || target;
    this.semantic = Object.fromEntries(
      Object.keys(target).map(key => [key, lerp(current[key], target[key], t)])
    );

    // Valence gently warms or cools the selected mode palette without
    // replacing its identity. The 18% ceiling keeps the palette recognizable.
    const tint = this.semantic.valence >= 0 ? '#ffd19a' : '#86b9e8';
    const tintAmount = Math.abs(this.semantic.valence) * 0.18;
    this.palette = (this.basePalette.length ? this.basePalette : KLEE_PRESET_PROFILES.harmonic.palette)
      .map(color => mixColor(color, tint, tintAmount));
    return this.semantic;
  }

  _modulateSeed(seed) {
    const modulation = this.semantic;
    seed.branchProbability = clamp(seed.branchProbability * modulation.branching, 0, 0.08);
    seed.params = {
      ...seed.params,
      stepLength: (seed.params.stepLength ?? this.stepLength) * modulation.motion
    };
    if (seed.params.gravity !== undefined) seed.params.gravity *= modulation.gravity;
    if (seed.params.chaos !== undefined) seed.params.chaos *= modulation.chaos;
    if (seed.params.tremble !== undefined) seed.params.tremble *= modulation.chaos;
    return seed;
  }

  _blendSeedVariations(seed, profile, amount) {
    if (!profile || amount >= 1) return seed;
    const t = clamp(amount, 0, 1);
    const blended = {};
    const names = new Set([...Object.keys(profile.variations), ...Object.keys(seed.variations)]);
    for (const name of names) {
      blended[name] = lerp(profile.variations[name] || 0, seed.variations[name] || 0, t);
    }
    seed.variations = blended;
    return seed;
  }

  _hslToRgb(h, s, l) {
    h = h / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
    const g = Math.round(hue2rgb(p, q, h) * 255);
    const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

    return `rgb(${r},${g},${b})`;
  }

  addSeed(config) {
    const seed = {
      x: config.x ?? this.width * this.random(),
      y: config.y ?? this.height * this.random(),
      angle: config.angle !== undefined ? config.angle : this.random() * Math.PI * 2,
      variations: config.variations || { straight: 1.0 },
      colorIndex: config.colorIndex !== undefined ? config.colorIndex : this.random(),
      branchProbability: config.branchProbability ?? 0.02,
      symmetry: config.symmetry ?? 0,
      maxBranches: config.maxBranches ?? 3,
      params: config.params || {}
    };

    this.seeds.push(seed);
    return this.seeds.length - 1;
  }

  /**
   * ENHANCED LINE VARIATIONS
   * Now with proper 2D noise
   */

  _varStraight(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    return [x + r * Math.cos(theta), y + r * Math.sin(theta), theta];
  }

  _varWavy(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const amplitude = params.amplitude || 0.3;
    const frequency = params.frequency || 0.1;
    const progress = step / total;
    const offset = Math.sin(progress * frequency * Math.PI * 20) * amplitude;

    return [
      x + r * Math.cos(theta + offset),
      y + r * Math.sin(theta + offset),
      theta
    ];
  }

  _varCurved(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const curveRate = params.curveRate || 0.05;
    const newTheta = theta + curveRate;

    return [x + r * Math.cos(newTheta), y + r * Math.sin(newTheta), newTheta];
  }

  _varZigzag(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const zigzagAngle = params.zigzagAngle || Math.PI / 4;
    const newTheta = theta + (this.random() < 0.5 ? zigzagAngle : -zigzagAngle);

    return [x + r * Math.cos(newTheta), y + r * Math.sin(newTheta), newTheta];
  }

  /**
   * ENHANCED: Organic variation with rich 2D multi-octave noise
   * This is the big improvement - much more natural movement
   */
  _varOrganic(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const noiseScale = params.noiseScale || 0.01;
    const noiseAmount = params.noiseAmount || 0.5;
    const octaves = params.octaves || 3;

    // Use actual position for 2D noise (not just step)
    const noiseX = this.multiOctaveNoise2D(x * noiseScale, y * noiseScale, octaves);
    const noiseY = this.multiOctaveNoise2D(x * noiseScale + 100, y * noiseScale + 100, octaves);

    // Apply noise to both angle and distance
    const thetaPerturbation = theta + noiseX * noiseAmount;
    const rPerturbation = r * (1 + noiseY * noiseAmount * 0.3);

    return [
      x + rPerturbation * Math.cos(thetaPerturbation),
      y + rPerturbation * Math.sin(thetaPerturbation),
      theta + noiseX * 0.1
    ];
  }

  _varRhythmic(x, y, theta, step, total, params) {
    const baseR = params.stepLength || this.stepLength;
    const frequency = params.frequency || 0.2;
    const progress = step / total;
    const r = baseR * (1 + 0.5 * Math.sin(progress * frequency * Math.PI * 30));

    return [x + r * Math.cos(theta), y + r * Math.sin(theta), theta];
  }

  _varCircular(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const circleRate = params.circleRate || 0.2;
    const newTheta = theta + circleRate;

    return [x + r * Math.cos(newTheta), y + r * Math.sin(newTheta), newTheta];
  }

  _varDotted(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    return [x + r * Math.cos(theta), y + r * Math.sin(theta), theta];
  }

  _varLooping(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const progress = step / total;
    const loopFreq = params.loopFrequency || 0.5;
    const offset = Math.sin(progress * loopFreq * Math.PI * 10) * Math.PI / 3;

    return [
      x + r * Math.cos(theta + offset),
      y + r * Math.sin(theta + offset),
      theta + offset * 0.1
    ];
  }

  _varAngular(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const angleSteps = params.angleSteps || 8;
    const angleIncrement = (Math.PI * 2) / angleSteps;

    if (step % 5 === 0) {
      theta = Math.round(theta / angleIncrement) * angleIncrement;
      theta += (this.random() < 0.5 ? angleIncrement : -angleIncrement);
    }

    return [x + r * Math.cos(theta), y + r * Math.sin(theta), theta];
  }

  _varGravitational(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const centerX = params.centerX || this.width / 2;
    const centerY = params.centerY || this.height / 2;
    const gravity = params.gravity || 0.05;

    const dx = centerX - x;
    const dy = centerY - y;
    const angleToCenter = Math.atan2(dy, dx);
    const newTheta = theta + (angleToCenter - theta) * gravity;

    return [x + r * Math.cos(newTheta), y + r * Math.sin(newTheta), newTheta];
  }

  _varRepelling(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const centerX = params.centerX || this.width / 2;
    const centerY = params.centerY || this.height / 2;
    const repulsion = params.repulsion || 0.1;

    const dx = x - centerX;
    const dy = y - centerY;
    const angleFromCenter = Math.atan2(dy, dx);
    const newTheta = theta + (angleFromCenter - theta) * repulsion;

    return [x + r * Math.cos(newTheta), y + r * Math.sin(newTheta), newTheta];
  }

  _varTrembling(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const tremble = params.tremble || 0.5;
    const offset = (this.random() - 0.5) * tremble;

    return [
      x + r * Math.cos(theta + offset),
      y + r * Math.sin(theta + offset),
      theta + offset * 0.5
    ];
  }

  _varBranching(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    return [x + r * Math.cos(theta), y + r * Math.sin(theta), theta];
  }

  _varExplosive(x, y, theta, step, total, params) {
    let r = params.stepLength || this.stepLength;
    const acceleration = params.acceleration || 1.05;
    r *= Math.pow(acceleration, step / 5);

    return [x + r * Math.cos(theta), y + r * Math.sin(theta), theta];
  }

  _varMeandering(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const meander = params.meander || 0.02;
    const newTheta = theta + Math.sin(step * 0.1) * meander;

    return [x + r * Math.cos(newTheta), y + r * Math.sin(newTheta), newTheta];
  }

  _varChaotic(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const chaos = params.chaos || 0.5;
    const newTheta = theta + (this.random() - 0.5) * Math.PI * chaos;
    const newR = r * (0.5 + this.random());

    return [x + newR * Math.cos(newTheta), y + newR * Math.sin(newTheta), newTheta];
  }

  _varHarmonic(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const progress = step / total;
    const wave1 = Math.sin(progress * Math.PI * 10) * 0.2;
    const wave2 = Math.sin(progress * Math.PI * 30) * 0.1;
    const wave3 = Math.sin(progress * Math.PI * 50) * 0.05;
    const offset = wave1 + wave2 + wave3;

    return [
      x + r * Math.cos(theta + offset),
      y + r * Math.sin(theta + offset),
      theta
    ];
  }

  _varCrystalline(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const latticeAngle = params.latticeAngle || Math.PI / 3;

    if (step % 3 === 0) {
      const options = [-latticeAngle, 0, latticeAngle];
      theta += options[Math.floor(this.random() * options.length)];
    }

    return [x + r * Math.cos(theta), y + r * Math.sin(theta), theta];
  }

  _varTwittering(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const twitter = Math.sin(step * 0.5) * 0.3 + Math.cos(step * 0.3) * 0.2;
    const jitter = (this.random() - 0.5) * 0.2;

    return [
      x + r * Math.cos(theta + twitter + jitter),
      y + r * Math.sin(theta + twitter + jitter),
      theta + twitter * 0.1
    ];
  }

  _varCorporeal(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const progress = step / total;

    if (progress > 0.7) {
      const pullback = (progress - 0.7) * 3;
      theta += pullback * 0.5;
    }

    const wobble = Math.sin(step * 0.2) * 0.15;

    return [
      x + r * Math.cos(theta + wobble),
      y + r * Math.sin(theta + wobble),
      theta + wobble * 0.1
    ];
  }

  _varArchitectural(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength * 2;

    if (step % 5 === 0) {
      const cardinal = Math.round(theta / (Math.PI / 2)) * (Math.PI / 2);
      theta = cardinal;

      if (this.random() < 0.3) {
        theta += Math.PI / 2 * (this.random() < 0.5 ? 1 : -1);
      }
    }

    return [x + r * Math.cos(theta), y + r * Math.sin(theta), theta];
  }

  _varFlowing(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const flow = params.flow || 0.03;
    const newTheta = theta + Math.sin(step * 0.2) * flow;

    return [x + r * Math.cos(newTheta), y + r * Math.sin(newTheta), newTheta];
  }

  _varMechanical(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const gearSteps = params.gearSteps || 12;

    if (step % gearSteps === 0) {
      theta += Math.PI / 6;
    }

    return [x + r * Math.cos(theta), y + r * Math.sin(theta), theta];
  }

  _varMythical(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const dragon = Math.sin(step * 0.15) * 0.4 * Math.cos(step * 0.08);
    const scale = 1 + Math.sin(step * 0.05) * 0.3;

    return [
      x + r * scale * Math.cos(theta + dragon),
      y + r * scale * Math.sin(theta + dragon),
      theta + dragon * 0.15
    ];
  }

  _getVariationFunction(name) {
    const variations = {
      straight: this._varStraight,
      wavy: this._varWavy,
      curved: this._varCurved,
      zigzag: this._varZigzag,
      organic: this._varOrganic,
      rhythmic: this._varRhythmic,
      circular: this._varCircular,
      dotted: this._varDotted,
      looping: this._varLooping,
      angular: this._varAngular,
      gravitational: this._varGravitational,
      repelling: this._varRepelling,
      trembling: this._varTrembling,
      branching: this._varBranching,
      explosive: this._varExplosive,
      meandering: this._varMeandering,
      chaotic: this._varChaotic,
      harmonic: this._varHarmonic,
      crystalline: this._varCrystalline,
      twittering: this._varTwittering,
      corporeal: this._varCorporeal,
      architectural: this._varArchitectural,
      flowing: this._varFlowing,
      mechanical: this._varMechanical,
      mythical: this._varMythical
    };

    return variations[name] || this._varStraight;
  }

  _selectVariation(variations) {
    const total = Object.values(variations).reduce((sum, w) => sum + w, 0);
    let rand = this.random() * total;

    for (let [name, weight] of Object.entries(variations)) {
      rand -= weight;
      if (rand <= 0) return name;
    }

    return Object.keys(variations)[0];
  }

  _growLine(seed, lineIndex, totalLines) {
    const points = [];
    let x = seed.x;
    let y = seed.y;
    let theta = seed.angle;

    const variance = Math.max(8, Math.min(60, Math.round(this.maxSteps * 0.2)));
    const steps = this.maxSteps + Math.floor(this.random() * (variance * 2 + 1) - variance);
    const settleSteps = 5;
    const densityStop = seed.params.densityStop ?? this.generationStyle.densityStop;

    for (let step = 0; step < steps; step++) {
      const varName = this._selectVariation(seed.variations);
      const varFunc = this._getVariationFunction(varName);

      const [newX, newY, newTheta] = varFunc.call(
        this, x, y, theta, step, steps, seed.params
      );

      if (step >= settleSteps) {
        if (newX >= 0 && newX < this.width && newY >= 0 && newY < this.height) {
          const cellX = Math.floor(newX / this.width * this.gridResolution);
          const cellY = Math.floor(newY / this.height * this.gridResolution);
          const densityIndex = cellY * this.gridResolution + cellX;
          if (points.length > 24 && densityStop && this.densityGrid[densityIndex] >= densityStop) break;
          points.push([newX, newY]);
          this._updateDensityGrid(newX, newY);
          if (seed.params.stopRadius) {
            const dx = newX - (seed.params.centerX ?? this.width / 2);
            const dy = newY - (seed.params.centerY ?? this.height / 2);
            if (points.length > 24 && Math.hypot(dx, dy) <= seed.params.stopRadius) break;
          }
        } else {
          if (seed.params.bounce) {
            theta += Math.PI;
            continue;
          } else {
            break;
          }
        }
      }

      x = newX;
      y = newY;
      theta = newTheta;

      if (varName === 'branching' || this.random() < seed.branchProbability) {
        if (this.lines.length < this._generationLineBudget) {
          this._createBranch(x, y, theta, seed, step / steps);
        }
      }
    }

    return {
      points,
      colorIndex: seed.colorIndex,
      variation: Object.keys(seed.variations)[0],
      seedIndex: this.lines.length,
      weight: this.random() < 0.16 ? 1.55 : (this.random() < 0.48 ? 1 : 0.68),
      alpha: 0.82 + this.random() * 0.18
    };
  }

  _createBranch(x, y, theta, parentSeed, progress) {
    const branchAngles = [Math.PI / 4, -Math.PI / 4, Math.PI / 3, -Math.PI / 3];
    const branchAngle = branchAngles[Math.floor(this.random() * branchAngles.length)];

    const branchSeed = {
      x,
      y,
      angle: theta + branchAngle,
      variations: parentSeed.variations,
      colorIndex: parentSeed.colorIndex,
      branchProbability: parentSeed.branchProbability * 0.5,
      symmetry: 0,
      maxBranches: parentSeed.maxBranches - 1,
      params: { ...parentSeed.params, stepLength: this.stepLength * 0.8 }
    };

    if (branchSeed.maxBranches > 0 && this.lines.length < this._generationLineBudget) {
      const branchLine = this._growLine(branchSeed, this.lines.length, this.seeds.length * 10);
      if (branchLine.points.length > 10) {
        this.lines.push(branchLine);
      }
    }
  }

  _updateDensityGrid(x, y) {
    if (!this.densityGrid) return;

    const cellX = Math.floor(x / this.width * this.gridResolution);
    const cellY = Math.floor(y / this.height * this.gridResolution);

    if (cellX >= 0 && cellX < this.gridResolution && cellY >= 0 && cellY < this.gridResolution) {
      const index = cellY * this.gridResolution + cellX;
      this.densityGrid[index]++;
    }
  }

  _applySymmetry(line, symmetry, centerX, centerY) {
    if (symmetry === 0) return [line];

    const symmetricLines = [line];

    if (symmetry === 2) {
      const mirrored = {
        ...line,
        points: line.points.map(([x, y]) => [centerX + (centerX - x), y])
      };
      symmetricLines.push(mirrored);
    } else if (symmetry > 2) {
      for (let i = 1; i < symmetry; i++) {
        const angle = (Math.PI * 2 * i) / symmetry;
        const rotated = {
          ...line,
          points: line.points.map(([x, y]) => {
            const dx = x - centerX;
            const dy = y - centerY;
            return [
              centerX + dx * Math.cos(angle) - dy * Math.sin(angle),
              centerY + dx * Math.sin(angle) + dy * Math.cos(angle)
            ];
          })
        };
        symmetricLines.push(rotated);
      }
    }

    return symmetricLines;
  }

  /**
   * ENHANCED: Detect forms with smooth boundaries.
   * Sync fallback — same shared implementation the worker runs.
   */
  _detectForms() {
    if (!this.densityGrid) return;
    const result = analyzeDensityGrid(
      this.densityGrid, this.gridResolution, this.width, this.height, 3
    );
    this.forms.push(...result.forms);
  }

  generateArtwork(options = {}) {
    this.width = options.width ?? this.width;
    this.height = options.height ?? this.height;
    this.maxSteps = options.steps ?? this.maxSteps;
    this.stepLength = options.stepLength ?? this.stepLength;

    this.densityGrid = new Float32Array(this.gridResolution * this.gridResolution);
    this.lines = [];
    this.forms = [];
    this._generationLineBudget = this.generationStyle.maxTotalLines;

    const totalLines = this._generationLineBudget;

    for (let seed of this.seeds) {
      if (this.lines.length >= this._generationLineBudget) break;
      const span = this.generationStyle.maxLines - this.generationStyle.minLines + 1;
      const baseCount = this.generationStyle.minLines + Math.floor(this.random() * span);
      const linesForSeed = clamp(
        Math.round(baseCount * this.semantic.density),
        1,
        this.generationStyle.maxLines + 1
      );

      for (let i = 0; i < linesForSeed; i++) {
        const line = this._growLine(seed, this.lines.length, totalLines);

        if (line.points.length > 10) {
          const symmetricLines = this._applySymmetry(
            line,
            seed.symmetry,
            this.width / 2,
            this.height / 2
          );

          const remaining = this._generationLineBudget - this.lines.length;
          this.lines.push(...symmetricLines.slice(0, remaining));
        }
      }
    }

    if (options.detectForms !== false) this._detectForms();

    return {
      lines: this.lines,
      forms: this.forms,
      width: this.width,
      height: this.height
    };
  }

  /**
   * ENHANCED: Render smooth organic forms
   */
  render(canvasElement, options = {}) {
    const ctx = canvasElement.getContext('2d');
    if (!ctx) return;

    if (canvasElement.width !== this.width) canvasElement.width = this.width;
    if (canvasElement.height !== this.height) canvasElement.height = this.height;

    const bgColor = options.background || KLEE_CHAMBER_BACKGROUND;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, this.width, this.height);

    if (options.showForms !== false) {
      this._renderSmoothForms(ctx, options);
    }

    this._renderLines(ctx, options);

    if (options.texture) {
      this._applyTexture(ctx, options.texture);
    }
  }

  /**
   * Render forms with smooth Bezier curves
   */
  _renderSmoothForms(ctx, options) {
    const progress = clamp(options.progress ?? 1, 0, 1);
    for (let form of this.forms) {
      if (!form.contour || form.contour.length < 3) continue;

      ctx.globalAlpha = 0.12 * progress;

      const colorIndex = Math.floor(form.centerX / this.width * this.palette.length);
      ctx.fillStyle = this.palette[colorIndex % this.palette.length];

      // Draw smooth curve through contour points
      ctx.beginPath();

      const smoothness = 0.3;
      const points = form.contour;

      ctx.moveTo(points[0][0], points[0][1]);

      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const p2 = points[(i + 2) % points.length];

        // Calculate control points for smooth curve
        const cp1x = p1[0] - (p2[0] - p0[0]) * smoothness;
        const cp1y = p1[1] - (p2[1] - p0[1]) * smoothness;

        ctx.quadraticCurveTo(cp1x, cp1y, p1[0], p1[1]);
      }

      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 1;
    }
  }

  _renderLines(ctx, options) {
    const style = { ...this.renderStyle, ...(options.style || {}) };
    const displayScale = clamp(Math.min(this.width, this.height) / 720, 0.7, 2.5);
    const lineWidth = options.lineWidth ?? style.lineWidth * displayScale;
    const alpha = (options.lineAlpha ?? style.alpha) * this.semantic.alpha;
    const progress = clamp(options.progress ?? 1, 0, 1);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let lineIndex = 0; lineIndex < this.lines.length; lineIndex++) {
      const line = this.lines[lineIndex];
      if (line.points.length < 2) continue;

      // Stagger the line families slightly so progressive growth reads as a
      // composition unfolding, rather than every path advancing in lockstep.
      const delay = (lineIndex / Math.max(1, this.lines.length - 1)) * 0.16;
      const localProgress = clamp((progress - delay) / (1 - delay), 0, 1);
      const pointCount = Math.min(line.points.length, Math.max(1, Math.ceil(line.points.length * localProgress)));
      if (pointCount < 2) continue;

      ctx.beginPath();
      ctx.moveTo(line.points[0][0], line.points[0][1]);

      for (let i = 1; i < pointCount; i++) {
        const [x, y] = line.points[i];

        if (line.variation === 'dotted' && i % 3 === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      const colorIndex = Math.floor(line.colorIndex * this.palette.length);
      ctx.strokeStyle = this.palette[colorIndex % this.palette.length];

      // Glow via a wide, faint under-stroke instead of ctx.shadowBlur:
      // canvas shadows Gaussian-blur every stroke through an intermediate
      // surface (~32 full-canvas composites per render at 4M px), which is
      // far too heavy for the flash path. Two plain strokes read the same.
      const glowWidth = 1 + (style.glow * this.semantic.glow) / 2.4;
      ctx.globalAlpha = alpha * line.alpha * 0.28;
      ctx.lineWidth = lineWidth * line.weight * (2.2 + glowWidth);
      ctx.stroke();

      if (style.ghostAlpha > 0) {
        ctx.globalAlpha = style.ghostAlpha * localProgress;
        ctx.lineWidth = lineWidth * line.weight * 2.2;
        ctx.stroke();
      }

      // Bright core on top
      ctx.globalAlpha = alpha * line.alpha;
      ctx.lineWidth = lineWidth * line.weight;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  _applyTexture(ctx, intensity = 0.05) {
    if (!this.textureTile) this.textureTile = this._buildTextureTileSync(48, intensity);
    if (!this.textureTile || typeof ctx.createPattern !== 'function') return;
    const pattern = ctx.createPattern(this.textureTile, 'repeat');
    if (!pattern) return;
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = clamp(intensity * 2.2, 0, 0.16);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  _buildTextureTileSync(size, intensity) {
    // Same seeded stream the worker uses, so sync-built grain is identical
    const pixels = buildTextureBytes(`${this.seed}:${this.preset}:texture`, size, intensity);
    return this._textureTileFromBytes(size, pixels);
  }

  captureArtwork() {
    return {
      preset: this.preset,
      seed: this.seed,
      width: this.width,
      height: this.height,
      stepLength: this.stepLength,
      maxSteps: this.maxSteps,
      seeds: this.seeds,
      lines: this.lines,
      forms: this.forms,
      palette: [...this.palette],
      basePalette: [...this.basePalette],
      renderStyle: { ...this.renderStyle },
      generationStyle: { ...this.generationStyle },
      semantic: { ...this.semantic },
      textureTile: this.textureTile
    };
  }

  restoreArtwork(artwork) {
    if (!artwork) return false;

    // Geometry is resolution-independent: when the canvas has been resized
    // since capture, rescale points instead of rejecting the snapshot. This
    // keeps the preload queue valid across window resizes.
    let lines = artwork.lines;
    let forms = artwork.forms;
    if (artwork.width !== this.width || artwork.height !== this.height) {
      const sx = this.width / artwork.width;
      const sy = this.height / artwork.height;
      lines = artwork.lines.map(line => ({
        ...line,
        points: line.points.map(([x, y]) => [x * sx, y * sy])
      }));
      forms = (artwork.forms || []).map(form => ({
        ...form,
        centerX: form.centerX * sx,
        centerY: form.centerY * sy,
        contour: (form.contour || []).map(([x, y]) => [x * sx, y * sy])
      }));
    }

    this.preset = artwork.preset;
    this.seed = artwork.seed;
    this.stepLength = artwork.stepLength;
    this.maxSteps = artwork.maxSteps;
    this.seeds = artwork.seeds;
    this.lines = lines;
    this.forms = forms;
    this.palette = [...artwork.palette];
    this.basePalette = [...artwork.basePalette];
    this.renderStyle = { ...artwork.renderStyle };
    this.generationStyle = { ...artwork.generationStyle };
    this.semantic = { ...artwork.semantic };
    this.textureTile = artwork.textureTile;
    return true;
  }

  export(canvasElement, format = 'image/png') {
    return canvasElement.toDataURL(format);
  }

  saveConfig() {
    return JSON.stringify({
      seeds: this.seeds,
      palette: this.palette,
      width: this.width,
      height: this.height,
      stepLength: this.stepLength,
      maxSteps: this.maxSteps
    }, null, 2);
  }

  loadConfig(jsonString) {
    const config = JSON.parse(jsonString);
    this.seeds = config.seeds || [];
    this.palette = config.palette || [];
    this.width = config.width || 1024;
    this.height = config.height || 1024;
    this.stepLength = config.stepLength || 5;
    this.maxSteps = config.maxSteps || 500;
  }

  generateRandom(theme = 'harmonic', options = {}) {
    this._generationEpoch += 1;
    this.seeds = [];
    if (options.seed !== undefined) this.setSeed(options.seed, options.rng);
    this.textureTile = null;

    // These five recipes intentionally mirror the canonical compositions in
    // klee/examples.html. A named preset is a visual contract, not a loose
    // theme: selecting Harmonic should always produce Harmonic Resonance,
    // Gravitational should always begin on an orbital ring, and so on.
    const LEGACY_ALIASES = {
      corporeal: 'harmonic',
      structural: 'architectural',
      mythic: 'twittering',
      volatile: 'chaotic',
      centered: 'gravitational',
      'gravitational-pull': 'gravitational',
      wireframe: 'architectural'
    };

    const resolved = KLEE_PRESET_NAMES.includes(theme) ? theme : (LEGACY_ALIASES[theme] || 'harmonic');
    const blendFrom = KLEE_PRESET_PROFILES[options.blendFrom] ? options.blendFrom : resolved;
    const blend = options.blendFrom ? clamp(options.blend ?? 0.35, 0, 1) : 1;
    const sourceProfile = KLEE_PRESET_PROFILES[blendFrom];
    this.configurePresetStyle(resolved, { ...options, blendFrom, blend });
    const generation = this.generationStyle;
    const scale = Math.min(this.width, this.height) / 512;
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const addPresetSeed = (config) => {
      const index = this.addSeed({
        branchProbability: generation.branchProbability,
        maxBranches: generation.maxBranches,
        ...config
      });
      this._blendSeedVariations(this.seeds[index], sourceProfile, blend);
      this._modulateSeed(this.seeds[index]);
      return index;
    };

    if (resolved === 'architectural') {
      addPresetSeed({
        x: centerX,
        y: this.height * (100 / 512),
        angle: Math.PI / 2,
        variations: { architectural: 0.8, angular: 0.2 },
        symmetry: 2,
        params: { stepLength: 10 * scale }
      });
    } else if (resolved === 'chaotic') {
      for (let i = 0; i < 4; i++) {
        addPresetSeed({
          x: centerX + (this.random() - 0.5) * 200 * scale,
          y: centerY + (this.random() - 0.5) * 200 * scale,
          variations: { chaotic: 0.5, explosive: 0.3, trembling: 0.2 },
          colorIndex: i / 4,
          params: { chaos: 0.42 + this.random() * 0.2, tremble: 0.38 + this.random() * 0.24 }
        });
      }
    } else if (resolved === 'harmonic') {
      addPresetSeed({
        x: centerX,
        y: centerY,
        variations: { harmonic: 0.7, rhythmic: 0.3 },
        colorIndex: 0.5,
        symmetry: 6
      });
    } else if (resolved === 'gravitational') {
      const seedCount = 3 + Math.floor(this.random() * 3);
      const radius = 190 * scale;
      const phase = this.random() * Math.PI * 2;
      const attractorX = centerX + (this.random() - 0.5) * this.width * 0.1;
      const attractorY = centerY + (this.random() - 0.5) * this.height * 0.1;
      for (let i = 0; i < seedCount; i++) {
        const angle = phase + (i / seedCount) * Math.PI * 2 + (this.random() - 0.5) * 0.55;
        const seedRadius = radius * (0.72 + this.random() * 0.5);
        const gravityWeight = 0.72 + this.random() * 0.16;
        const targetX = attractorX + (this.random() - 0.5) * 28 * scale;
        const targetY = attractorY + (this.random() - 0.5) * 28 * scale;
        addPresetSeed({
          x: centerX + Math.cos(angle) * seedRadius * (0.85 + this.random() * 0.3),
          y: centerY + Math.sin(angle) * seedRadius * (0.65 + this.random() * 0.45),
          variations: { gravitational: gravityWeight, flowing: 1 - gravityWeight },
          colorIndex: i / seedCount,
          params: {
            gravity: 0.055 + this.random() * 0.045,
            flow: (this.random() < 0.5 ? -1 : 1) * (0.015 + this.random() * 0.03),
            centerX: targetX,
            centerY: targetY,
            stopRadius: (18 + this.random() * 18) * scale
          }
        });
      }
    } else {
      for (let i = 0; i < 5; i++) {
        addPresetSeed({
          x: this.width * ((100 + i * 80) / 512) + (this.random() - 0.5) * 12 * scale,
          y: this.height * (150 / 512) + (this.random() - 0.5) * 14 * scale,
          variations: { twittering: 0.7, trembling: 0.3 },
          colorIndex: i / 5,
          params: { stepLength: 3 * scale }
        });
      }
    }

    // Preserve the active canvas dimensions. The previous no-argument call
    // silently reset every fullscreen render to 1024×1024, stretching it on
    // non-square displays and weakening all position-based compositions.
    return this.generateArtwork({
      width: this.width,
      height: this.height,
      steps: generation.steps,
      stepLength: this.stepLength,
      detectForms: options.detectForms
    });
  }

  async generateRandomAsync(theme = 'harmonic', options = {}) {
    this.generateRandom(theme, { ...options, detectForms: false });
    const epoch = this._generationEpoch;
    const enhancements = Promise.all([
      options.detectForms === false ? Promise.resolve() : this._detectFormsAsync(epoch),
      this._prepareTextureAsync(options.texture ?? this.renderStyle.texture, epoch)
    ]);
    this._enhancementPromise = enhancements.catch(() => undefined);
    if (options.awaitEnhancements !== false) await this._enhancementPromise;
    return {
      lines: this.lines,
      forms: this.forms,
      width: this.width,
      height: this.height,
      seed: this.seed,
      preset: this.preset
    };
  }

  destroy() {
    this._worker?.terminate();
    this._worker = null;
    // terminate() kills the worker silently — no message will ever arrive
    // for in-flight requests, so reject them or their awaiters hang forever
    // (which previously deadlocked the preload loop after a mid-flight resize).
    for (const request of this._workerRequests.values()) {
      request.reject(new Error('Klee worker destroyed'));
    }
    this._workerRequests.clear();
  }
}

// ES Module export
export { KleeEngine };
