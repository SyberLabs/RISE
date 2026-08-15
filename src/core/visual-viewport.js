/**
 * Visible-viewport inset for chrome that must stay on the glass.
 *
 * iOS Safari's `100vh` is the LARGE viewport — the height the page would
 * have with browser chrome hidden. A bar positioned `bottom` against that
 * box sits under the URL bar / home indicator, with only its top peeking
 * into the screen. Pinch-zoom and the on-screen keyboard do the same by
 * shrinking `visualViewport` inside the layout viewport.
 *
 * The inset is how far the visual viewport's bottom sits above
 * `window.innerHeight`. Unzoomed modern Safari reports them as equal
 * (inset 0); zoom, keyboard, and older large-viewport innerHeight do not.
 */

export const CHAMBER_VV_BOTTOM_VAR = '--chamber-vv-bottom';

export function visualViewportBottomInset(view = typeof window !== 'undefined' ? window : null) {
  if (!view) return 0;
  const layoutHeight = Number(view.innerHeight) || 0;
  if (layoutHeight <= 0) return 0;
  const vv = view.visualViewport;
  if (!vv) return 0;
  const visibleBottom = (Number(vv.offsetTop) || 0) + (Number(vv.height) || 0);
  return Math.max(0, Math.round(layoutHeight - visibleBottom));
}

export function applyVisualViewportBottom(root, view) {
  if (!root?.style) return 0;
  const inset = visualViewportBottomInset(view);
  root.style.setProperty(CHAMBER_VV_BOTTOM_VAR, `${inset}px`);
  return inset;
}

export function clearVisualViewportBottom(root) {
  root?.style?.removeProperty?.(CHAMBER_VV_BOTTOM_VAR);
}
