/**
 * The SyberLabs Atlas in RISE's chrome: the ambient atmosphere behind Home
 * and the entry gate, and the RISE sigil as the brand and loading mark.
 *
 * This file is tiny on purpose. The engines are the vendored kit files in
 * src/vendor/syber/, and both are reached by `import()` only, so neither is
 * part of what a first visit downloads before the Portal paints. Nothing here
 * runs on a reading route: the Portal destroys its atmosphere when the router
 * deactivates it, and the gate destroys its own when the reader enters.
 */

export const RISE_SIGIL = Object.freeze({ name: 'RISE', color: '#F2D9A6' });

/**
 * ONLY ON A REAL GPU. The plate is a full-screen long exposure; on a
 * software rasteriser (SwiftShader, llvmpipe — a blocklisted GPU, a VM,
 * a headless browser) it measured about one frame a second, and every
 * click on the page behind it waited on that frame. The CSS nebula is the
 * designed fallback, so a machine that cannot afford the plate gets that.
 */
function hardwareWebGL2() {
  try {
    const gl = document.createElement('canvas')
      .getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Mount the ambient plate behind `host`'s content: a fixed layer at the
 * lowest z-index (CSS nebula fallback, the canvas, then a heavy scrim so the
 * words in front keep their contrast). Returns `{ destroy() }`.
 */
export function mountAtmosphere(host) {
  const layer = document.createElement('div');
  layer.className = 'sy-atmosphere-layer';
  layer.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  canvas.className = 'sy-atmosphere';
  const scrim = document.createElement('div');
  scrim.className = 'sy-atmosphere-scrim';
  layer.append(canvas, scrim);
  host.prepend(layer);

  let plate = null;
  let destroyed = false;
  if (hardwareWebGL2()) {
    import('../vendor/syber/syber-atmosphere.js')
      .then(({ mount }) => {
        if (!destroyed) plate = mount(canvas, { mode: 'ambient' });
      })
      .catch(() => { /* Progressive enhancement: the CSS nebula stays. */ });
  } else {
    canvas.hidden = true;
  }

  return {
    destroy() {
      destroyed = true;
      plate?.destroy();
      plate = null;
      layer.remove();
    }
  };
}

/**
 * Draw the RISE sigil into `canvas` (drawing in is the loading state).
 * Marks the canvas `is-drawn` once the draw has started, so a static fallback
 * beside it can step aside. Resolves to the kit's `{ caption, cancel() }`, or
 * null when the kit could not load or this browser has no 2D canvas.
 */
export async function drawRiseSigil(canvas, { animate = true } = {}) {
  if (!canvas?.isConnected) return null;
  try {
    const { draw } = await import('../vendor/syber/syber-sigil.js');
    if (!canvas.isConnected) return null;
    const result = draw(canvas, RISE_SIGIL.name, { color: RISE_SIGIL.color, animate });
    canvas.classList.add('is-drawn');
    return result;
  } catch {
    return null;
  }
}
