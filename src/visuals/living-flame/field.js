/**
 * Living Flame field: one scene on one dedicated canvas.
 *
 * Owns the render loop, logical clock, quality adaptation, compatible-recipe
 * interpolation, context-loss recovery, and fallback. Incompatible scene
 * changes are the Visual Field Director's job (it crossfades two fields and
 * disposes the outgoing one); this field only morphs within one structure.
 */

import { flameStructureKey } from '../../core/flame-recipe.js';
import { paletteLut, resolveFlameFrame } from './flame-math.js';
import { FlameGpuRenderer } from './gl-flame.js';

export const LIVING_FLAME_TIERS = Object.freeze([
  Object.freeze({ particles: 32768, dpr: 0.75 }),
  Object.freeze({ particles: 65536, dpr: 1 }),
  Object.freeze({ particles: 131072, dpr: 1.25 }),
  Object.freeze({ particles: 262144, dpr: 1.5 })
]);
export const LIVING_FLAME_DEFAULT_TIER = 1;
export const LIVING_FLAME_MAX_PIXELS = 2_000_000;
const SEEK_THRESHOLD_S = 1.5;
const WINDOW_FRAMES = 90;
const WARMUP_FRAMES = 30;
const COOLDOWN_MS = 3000;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;

/** Pure quality policy: returns the next tier and ceiling. Exported for tests. */
export function nextQualityTier({ tier, ceiling, p95, steadyWindows }) {
  if (p95 > 20 && tier > 0) {
    // A tier that could not hold becomes the ceiling, so quality never
    // oscillates between two tiers.
    return { tier: tier - 1, ceiling: tier - 1, steadyWindows: 0 };
  }
  if (p95 <= 18 && tier < ceiling) {
    if (steadyWindows + 1 >= 3) return { tier: tier + 1, ceiling, steadyWindows: 0 };
    return { tier, ceiling, steadyWindows: steadyWindows + 1 };
  }
  return { tier, ceiling, steadyWindows: 0 };
}

/** Pure sizing policy honoring the DPR and pixel ceilings. Exported for tests. */
export function fieldBackingSize(cssWidth, cssHeight, devicePixelRatio, tierDpr) {
  const dpr = Math.min(devicePixelRatio || 1, tierDpr, 1.5);
  let width = Math.max(1, Math.round(cssWidth * dpr));
  let height = Math.max(1, Math.round(cssHeight * dpr));
  const pixels = width * height;
  if (pixels > LIVING_FLAME_MAX_PIXELS) {
    const scale = Math.sqrt(LIVING_FLAME_MAX_PIXELS / pixels);
    width = Math.max(1, Math.floor(width * scale));
    height = Math.max(1, Math.floor(height * scale));
  }
  return { width, height };
}

function blendFrames(a, b, t) {
  if (t >= 1) return b;
  const mix = (x, y) => lerp(x, y, t);
  return {
    symmetry: b.symmetry,
    transforms: b.transforms.map((item, index) => {
      const from = a.transforms[index];
      return {
        affine: item.affine.map((value, k) => mix(from.affine[k], value)),
        cumulative: index === b.transforms.length - 1 ? 1 : mix(from.cumulative, item.cumulative),
        color: mix(from.color, item.color),
        variations: Object.fromEntries(Object.entries(item.variations)
          .map(([name, value]) => [name, mix(from.variations[name] || 0, value)]))
      };
    }),
    camera: Object.fromEntries(Object.entries(b.camera).map(([key, value]) => [key, mix(a.camera[key], value)])),
    tone: Object.fromEntries(Object.entries(b.tone).map(([key, value]) => [key, mix(a.tone[key], value)]))
  };
}

function blendLut(a, b, t) {
  if (t >= 1) return b;
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i += 1) out[i] = Math.round(lerp(a[i], b[i], t));
  return out;
}

export class LivingFlameField {
  /**
   * @param {HTMLElement} host element the field fills
   * @param {object} options
   * @param {object} options.recipe validated recipe
   * @param {number} [options.energy] effective energy 0..1
   * @param {() => number} [options.clock] logical reading time in ms
   * @param {boolean} [options.reducedMotion] draw one static sample
   * @param {(status: object) => void} [options.onStatus]
   * @param {(recipe: object, t: number) => Promise<void>} [options.cpuFallback]
   */
  constructor(host, {
    recipe, energy = 0.35, clock = null, reducedMotion = false, onStatus = null,
    cpuFallback = null, initialTier = LIVING_FLAME_DEFAULT_TIER, window: win = globalThis.window
  } = {}) {
    this.host = host;
    this.window = win;
    this.recipe = recipe;
    this.energy = clamp(energy, 0, 1);
    this.targetEnergy = this.energy;
    this.clock = typeof clock === 'function' ? clock : null;
    this.reducedMotion = reducedMotion === true;
    this.onStatus = typeof onStatus === 'function' ? onStatus : () => {};
    this.cpuFallback = cpuFallback;
    this.paused = false;
    this.destroyed = false;
    this.renderer = 'none';
    this.tier = clamp(initialTier, 0, LIVING_FLAME_TIERS.length - 1);
    this.ceiling = LIVING_FLAME_TIERS.length - 1;
    this.steadyWindows = 0;
    this.intervals = [];
    this.framesSinceChange = 0;
    this.lastQualityChange = 0;
    this.lastFrameTime = null;
    this.internalTime = 0;
    this.lastLogicalSeconds = null;
    this.morph = null;
    this.raf = null;
    this.ready = Promise.resolve();
    this.lut = paletteLut(recipe);
    this.stats = { renderer: 'none', tier: this.tier, particles: 0, width: 0, height: 0, p95: null, float: false };

    this.canvas = host.ownerDocument.createElement('canvas');
    this.canvas.className = 'living-flame-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(this.canvas);

    this._onLost = (event) => {
      event.preventDefault();
      this._cancelFrame();
      this.stats.contextLost = true;
      this.onStatus({ ...this.stats });
    };
    this._onRestored = () => {
      if (this.destroyed || !this.gpu) return;
      try {
        this.gpu.restore();
        this.stats.contextLost = false;
        this._applyQuality(true);
        this._schedule();
      } catch {
        this._fallBack('context-restore-failed');
      }
    };
    this._onVisibility = () => {
      if (host.ownerDocument.hidden) this._cancelFrame();
      else this._schedule();
    };
    this._resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => this._applyQuality(false))
      : null;

    try {
      this.gpu = new FlameGpuRenderer(this.canvas);
      this.renderer = 'webgl2';
      this.canvas.addEventListener('webglcontextlost', this._onLost);
      this.canvas.addEventListener('webglcontextrestored', this._onRestored);
      this.gpu.setPalette(this.lut);
      this._applyQuality(true);
    } catch (error) {
      this.gpu?.dispose?.();
      this.gpu = null;
      this._fallBack(error?.code || 'gpu-unavailable');
    }
    this._resizeObserver?.observe(host);
    host.ownerDocument.addEventListener('visibilitychange', this._onVisibility);
    this._report();
    if (this.gpu) this._schedule();
  }

  _report() {
    this.stats = {
      ...this.stats,
      renderer: this.renderer,
      tier: this.tier,
      particles: this.gpu?.particles || 0,
      width: this.gpu?.width || this.canvas.width,
      height: this.gpu?.height || this.canvas.height,
      float: this.gpu?.float === true,
      floatReason: this.gpu?.floatReason || null
    };
    this.onStatus({ ...this.stats });
  }

  _fallBack(reason) {
    // A canvas that acquired (even a failed) WebGL context cannot become 2D:
    // the fallback always gets a fresh canvas.
    this.canvas.removeEventListener('webglcontextlost', this._onLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onRestored);
    this.canvas.remove();
    this.canvas = this.host.ownerDocument.createElement('canvas');
    this.canvas.className = 'living-flame-canvas living-flame-still';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.host.appendChild(this.canvas);
    this.renderer = 'cpu';
    this.stats.fallbackReason = reason;
    this.ready = this._drawCpu();
  }

  async _drawCpu() {
    if (!this.cpuFallback || this.destroyed) {
      this.renderer = 'none';
      this._report();
      return;
    }
    const token = (this._cpuToken || 0) + 1;
    this._cpuToken = token;
    try {
      await this.cpuFallback(this.canvas, this.recipe, this._logicalSeconds(), this.energy,
        () => this.destroyed || this._cpuToken !== token);
      if (!this.destroyed && this._cpuToken === token) this.renderer = 'cpu';
    } catch {
      // A still that will not draw leaves a stable background and readable
      // text, never a broken frame.
      if (!this.destroyed) this.renderer = 'none';
    }
    if (!this.destroyed) this._report();
  }

  _applyQuality(reset) {
    if (!this.gpu || this.destroyed || this.gpu.contextLost) return;
    const rect = this.host.getBoundingClientRect?.() || { width: 0, height: 0 };
    const cssWidth = Math.max(1, Math.round(rect.width || this.host.clientWidth || 1));
    const cssHeight = Math.max(1, Math.round(rect.height || this.host.clientHeight || 1));
    const tier = LIVING_FLAME_TIERS[this.tier];
    const { width, height } = fieldBackingSize(cssWidth, cssHeight,
      this.window?.devicePixelRatio || 1, tier.dpr);
    try {
      this.gpu.setParticleCount(tier.particles);
      this.gpu.setSize(width, height);
    } catch {
      this.gpu.dispose();
      this.gpu = null;
      this._fallBack('gpu-resource-failure');
      return;
    }
    if (reset) this.gpu.reset();
    this.framesSinceChange = 0;
    this.intervals = [];
    this._report();
    if (this.paused || this.reducedMotion) this._renderStill();
  }

  _logicalSeconds() {
    return this.clock ? Math.max(0, Number(this.clock()) || 0) / 1000 : this.internalTime;
  }

  _frameAt(seconds) {
    const target = resolveFlameFrame(this.recipe, seconds, this.energy);
    if (!this.morph) return { frame: target, lut: this.lut };
    const progress = clamp((performance.now() - this.morph.start) / this.morph.duration, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    const from = resolveFlameFrame(this.morph.from, seconds, this.energy);
    const lut = blendLut(this.morph.fromLut, this.lut, eased);
    if (progress >= 1) this.morph = null;
    return { frame: blendFrames(from, target, eased), lut };
  }

  _renderStill() {
    if (!this.gpu || this.gpu.contextLost) return;
    const { frame, lut } = this._frameAt(this._logicalSeconds());
    this.gpu.setPalette(lut);
    this.gpu.reset();
    // A static sample: enough undecayed passes for a settled image.
    for (let i = 0; i < 24; i += 1) this.gpu.render(frame, { passes: 2, decay: 1, draw: false });
    this.gpu.present(frame, { passes: 48, decay: 0 });
  }

  _cancelFrame() {
    if (this.raf !== null) this.window?.cancelAnimationFrame?.(this.raf);
    this.raf = null;
    this.lastFrameTime = null;
  }

  _schedule() {
    if (this.raf !== null || this.paused || this.destroyed || !this.gpu || this.reducedMotion
      || this.gpu.contextLost || this.host.ownerDocument.hidden) {
      if (this.reducedMotion && this.gpu && !this.destroyed) this._renderStill();
      return;
    }
    this.raf = this.window.requestAnimationFrame(now => this._tick(now));
  }

  _tick(now) {
    this.raf = null;
    if (this.destroyed || this.paused || !this.gpu) return;
    const delta = this.lastFrameTime === null ? 16.7 : now - this.lastFrameTime;
    this.lastFrameTime = now;
    if (!this.clock) this.internalTime += Math.min(delta, 100) / 1000;
    this.energy += (this.targetEnergy - this.energy) * Math.min(1, delta / 400);
    const seconds = this._logicalSeconds();
    if (this.lastLogicalSeconds !== null && Math.abs(seconds - this.lastLogicalSeconds) > SEEK_THRESHOLD_S) {
      // A seek evaluates the destination time and rebuilds a bounded sample;
      // it never replays history.
      this.gpu.reset();
    }
    this.lastLogicalSeconds = seconds;
    const { frame, lut } = this._frameAt(seconds);
    if (this.morph || lut !== this.lut) this.gpu.setPalette(lut);
    else if (this._paletteDirty) {
      this.gpu.setPalette(this.lut);
      this._paletteDirty = false;
    }
    this.gpu.render(frame);
    this._measure(delta, now);
    this._schedule();
  }

  _measure(delta, now) {
    this.framesSinceChange += 1;
    if (this.framesSinceChange <= WARMUP_FRAMES) return;
    this.intervals.push(delta);
    if (this.intervals.length < WINDOW_FRAMES) return;
    const sorted = [...this.intervals].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95) - 1];
    this.stats.p95 = Math.round(p95 * 10) / 10;
    this.intervals = [];
    if (now - this.lastQualityChange < COOLDOWN_MS) return;
    const next = nextQualityTier({ tier: this.tier, ceiling: this.ceiling, p95, steadyWindows: this.steadyWindows });
    this.steadyWindows = next.steadyWindows;
    this.ceiling = next.ceiling;
    if (next.tier !== this.tier) {
      // Quality changes resolution and sample workload only: never recipe
      // identity, never text timing.
      this.tier = next.tier;
      this.lastQualityChange = now;
      this._applyQuality(true);
    } else {
      this._report();
    }
  }

  /** True when `recipe` can be reached by interpolation. */
  canMorphTo(recipe) {
    return this.renderer === 'webgl2' && flameStructureKey(recipe) === flameStructureKey(this.recipe);
  }

  /** Interpolate to a structurally compatible recipe. */
  setRecipe(recipe, { transitionMs = 1200 } = {}) {
    if (this.destroyed || !recipe) return false;
    const compatible = flameStructureKey(recipe) === flameStructureKey(this.recipe);
    const duration = this.reducedMotion ? 0 : Math.max(0, transitionMs);
    if (compatible && duration > 0 && this.gpu) {
      this.morph = { from: this.recipe, fromLut: this.lut, start: performance.now(), duration };
    } else {
      this.morph = null;
      if (this.gpu && !compatible) this.gpu.reset();
    }
    this.recipe = recipe;
    this.lut = paletteLut(recipe);
    this._paletteDirty = true;
    if (this.renderer === 'cpu' || this.renderer === 'none') {
      if (!this.gpu) this.ready = this._drawCpu();
    } else if (this.paused || this.reducedMotion) {
      this._renderStill();
    }
    return true;
  }

  setEnergy(energy) {
    this.targetEnergy = clamp(Number(energy) || 0, 0, 1);
    if (this.reducedMotion || this.paused) {
      this.energy = this.targetEnergy;
      if (this.gpu) this._renderStill();
    }
  }

  pause() {
    this.paused = true;
    this._cancelFrame();
  }

  resume() {
    if (this.destroyed) return;
    this.paused = false;
    this._schedule();
  }

  /** Explicit still capture for Page, export, and Lab. */
  capture() {
    if (this.gpu && !this.gpu.contextLost) {
      this._renderStill();
      return this.gpu.capture();
    }
    try {
      return this.renderer === 'cpu' ? this.canvas.toDataURL('image/png') : null;
    } catch {
      return null;
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this._cancelFrame();
    this._resizeObserver?.disconnect();
    this.host.ownerDocument.removeEventListener('visibilitychange', this._onVisibility);
    this.canvas.removeEventListener('webglcontextlost', this._onLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onRestored);
    this.gpu?.dispose();
    this.gpu = null;
    this.canvas.remove();
  }
}
