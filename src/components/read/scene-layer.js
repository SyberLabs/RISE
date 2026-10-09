/**
 * The canvas a generated scene draws on, behind the reading
 * (docs/superpowers/specs/2026-10-08-creative-control-design.md §4, §7).
 *
 * DOM only. The canvas is transferred to the scene's worker, after which its
 * pixel size belongs to the worker; this layer only measures the canvas's
 * own box and says so, and the runtime passes the size on. The box is the
 * field's, less any room the page keeps along its edges (a host's bar).
 */
export function mountSceneLayer({ field, insertBehindReading, onResize = () => {} }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'chamber-scene';
  canvas.setAttribute('aria-hidden', 'true');
  insertBehindReading(field, canvas);

  const resize = () => {
    const size = { width: canvas.clientWidth, height: canvas.clientHeight };
    onResize(size);
    return size;
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;
  observer?.observe(canvas);

  return {
    canvas,
    node: canvas,
    resize,
    destroy() {
      observer?.disconnect();
      canvas.remove();
    }
  };
}
