/**
 * Lazy entry for Living Flame. The Chamber, Visual Lab, and Page samplers
 * import this module on demand so the renderer stays out of first load.
 */

import { LivingFlameField } from './field.js';
import { drawCpuFlame } from './cpu-fallback.js';

export { FLAME_PRESETS, FLAME_PRESET_IDS, flamePreset } from './flame-presets.js';
export { mutateRecipe, probeRecipe, RecipeHistory, resolveFlameFrame } from './flame-math.js';
export { LivingFlameField, LIVING_FLAME_TIERS } from './field.js';

export function createLivingFlameField(host, options = {}) {
  return new LivingFlameField(host, { cpuFallback: drawCpuFlame, ...options });
}

/**
 * Draw one still of a recipe off-screen and return a PNG data URL, or null.
 * Used by Page mode and export, where no animation loop may run.
 */
export async function sampleLivingFlame(recipe, {
  seconds = 0, energy = 0.35, width = 960, height = 600, document: doc = globalThis.document
} = {}) {
  const host = doc.createElement('div');
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;`;
  doc.body.appendChild(host);
  let field = null;
  try {
    field = new LivingFlameField(host, {
      recipe, energy, reducedMotion: true, clock: () => seconds * 1000, cpuFallback: drawCpuFlame
    });
    await field.ready;
    return field.capture();
  } catch {
    return null;
  } finally {
    field?.destroy();
    host.remove();
  }
}
