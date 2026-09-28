/**
 * Bounded static CPU samples of a recipe, drawn by the existing
 * fractal-flame generator. Used when WebGL2 is unavailable or fails, and by
 * export for a deterministic still. It is a still, not an animation, and it
 * makes no claim of pixel equivalence with the GPU renderer.
 */

import { createRng, paletteLut, resolveFlameFrame } from './flame-math.js';

const MAX_SIDE = 720;

/** Load one resolved recipe frame into a FractalFlameGenerator. */
export function configureFlameGenerator(generator, recipe, seconds = 0, energy = 0.35) {
  const frame = resolveFlameFrame(recipe, seconds, energy);
  generator.clearTransforms?.();
  generator.backgroundColor = [0, 0, 0];
  let previous = 0;
  for (const item of frame.transforms) {
    generator.addTransform({
      affine: item.affine,
      variations: Object.fromEntries(Object.entries(item.variations).filter(([, weight]) => weight > 0)),
      color: item.color,
      weight: Math.max(1e-3, item.cumulative - previous),
      symmetry: frame.symmetry
    });
    previous = item.cumulative;
  }
  generator.setCamera(frame.camera.x, frame.camera.y, frame.camera.zoom, frame.camera.rotation);
  const lut = paletteLut(recipe);
  generator.setPalette(Array.from({ length: 256 }, (_, i) => [lut[i * 4], lut[i * 4 + 1], lut[i * 4 + 2]]));
  return frame;
}

/**
 * Render a square still. With `deterministic`, the single-threaded path runs
 * from the recipe seed so the same recipe and time give the same image.
 */
export async function renderFlameImage(recipe, {
  side = 512, seconds = 0, energy = 0.35, iterations = 900_000,
  deterministic = false, transparent = true
} = {}) {
  const { FractalFlameGenerator } = await import('../lib/fractal-engine.js');
  const generator = new FractalFlameGenerator(deterministic ? { random: createRng(recipe.seed) } : {});
  try {
    const frame = configureFlameGenerator(generator, recipe, seconds, energy);
    const image = await generator.generateImage({
      width: side,
      height: side,
      iterations,
      oversample: 1,
      gamma: frame.tone.gamma,
      brightness: 1.6 * frame.tone.exposure,
      vibrancy: 1,
      useWorkers: !deterministic && typeof Worker !== 'undefined'
    });
    if (transparent) {
      // Darkness becomes transparency so a still sits on the reading's own
      // background instead of a black slab.
      const pixels = image.data;
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i + 3] = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
      }
    }
    return image;
  } finally {
    generator.dispose?.();
  }
}

/** Fallback painter for LivingFlameField. */
export async function drawCpuFlame(canvas, recipe, seconds, energy, cancelled = () => false) {
  const rect = canvas.parentElement?.getBoundingClientRect?.() || { width: MAX_SIDE, height: MAX_SIDE };
  const cssWidth = Math.max(1, rect.width || MAX_SIDE);
  const cssHeight = Math.max(1, rect.height || MAX_SIDE);
  const scale = Math.min(1, MAX_SIDE / Math.max(cssWidth, cssHeight));
  const width = Math.max(1, Math.round(cssWidth * scale));
  const height = Math.max(1, Math.round(cssHeight * scale));
  // The CPU generator maps the same world span onto each axis, so the sample
  // is square and centered to keep the composition's proportions.
  const side = Math.min(width, height);
  const image = await renderFlameImage(recipe, { side, seconds, energy });
  if (cancelled()) return;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, width, height);
  context.putImageData(image, Math.round((width - side) / 2), Math.round((height - side) / 2));
}
