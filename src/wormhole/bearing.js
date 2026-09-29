/**
 * Where the reader is pointing, as a bearing around the gate.
 *
 * The rocket rides a fixed ring around the gate and follows this bearing; it
 * never leaves the ring, so the only thing a pointer decides is an angle.
 * Angles are the usual ones (0 to the right, a quarter turn up), with y up,
 * which is how the ship's pose is written.
 */

/** Where the gate sits in the picture, as fractions of its width and height (see the throat shader). */
export const RING_CENTER = Object.freeze({ x: 0.5, y: 0.42 });

/**
 * The bearing of a point from the gate, or null when the point is too near the
 * gate to have one worth following (an angle from a hair's breadth away is
 * noise, and following it would make the ship shudder).
 *
 * `rect` is the picture's box on the page; `dead` is the radius, as a fraction
 * of the shorter side, inside which there is no bearing.
 */
export function bearingOf(x, y, rect, dead = 0.06) {
  const cx = rect.left + rect.width * RING_CENTER.x;
  const cy = rect.top + rect.height * RING_CENTER.y;
  const dx = x - cx;
  const dy = cy - y;
  if (Math.hypot(dx, dy) < dead * Math.min(rect.width, rect.height)) return null;
  return Math.atan2(dy, dx);
}
