/**
 * The canvas a generated scene draws on, behind the reading
 * (docs/superpowers/specs/2026-10-08-creative-control-design.md §4, §7).
 *
 * DOM only. The canvas is transferred to the scene's worker, after which its
 * pixel size belongs to the worker; this layer only measures the field and
 * says so, and the runtime passes the size on.
 */
export function mountSceneLayer({ field, insertBehindReading, onResize = () => {} }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'chamber-scene';
  canvas.setAttribute('aria-hidden', 'true');
  insertBehindReading(field, canvas);

  const resize = () => {
    const size = { width: field.clientWidth, height: field.clientHeight };
    onResize(size);
    return size;
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;
  observer?.observe(field);

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
