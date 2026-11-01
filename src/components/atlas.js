/**
 * The SyberLabs Atlas in RISE's chrome: the RISE sigil as the brand and
 * loading mark.
 *
 * This file is tiny on purpose. The engine is the vendored kit file in
 * src/vendor/syber/, reached by `import()` only, so it is not part of what a
 * first visit downloads before Home paints.
 */

const RISE_SIGIL = Object.freeze({ name: 'RISE', color: '#F2D9A6' });

/**
 * Draw the RISE sigil into `canvas`, still.
 * Marks the canvas `is-drawn` once the draw has started, so a static fallback
 * beside it can step aside. Resolves to the kit's `{ caption, cancel() }`, or
 * null when the kit could not load or this browser has no 2D canvas.
 */
export async function drawRiseSigil(canvas) {
  if (!canvas?.isConnected) return null;
  try {
    const { draw } = await import('../vendor/syber/syber-sigil.js');
    if (!canvas.isConnected) return null;
    const result = draw(canvas, RISE_SIGIL.name, { color: RISE_SIGIL.color, animate: false });
    canvas.classList.add('is-drawn');
    return result;
  } catch {
    return null;
  }
}
