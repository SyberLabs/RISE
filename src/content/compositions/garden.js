/**
 * Garden — the first RISE composition.
 *
 * A verdant field in which buds open into Iris Plates while the
 * wordmark resolves last. This module is the SCORE: what is on screen,
 * where, and when. It paints nothing and knows nothing about canvases,
 * so the timing can be read and tested without a browser.
 *
 * WHY IRIS PLATES ARE THE FLOWERS. `buildPlateOrder` ranks a plate's
 * pixels by ink density scaled by a radial weight — centre 1.0, edge
 * 0.62 — so a plate reveals from its dense middle outward. That is a
 * blossom opening, already, in an engine written for something else.
 * Growth here is only that reveal run against a scale ramp.
 *
 * Times are milliseconds from the first frame. Positions are fractions
 * of the frame; sizes are fractions of frame WIDTH, so the layout holds
 * if the profile changes.
 */

export const GARDEN_ID = 'garden';
export const GARDEN_TITLE = 'RISE · Garden';
export const GARDEN_SEED = 'rise-composition:garden:1';
export const GARDEN_DURATION_MS = 22_000;
export const GARDEN_VIEWPORT = Object.freeze({ width: 1080, height: 1920 });
export const GARDEN_FRAME_RATE = Object.freeze({ numerator: 30, denominator: 1 });
export const GARDEN_SOUNDSCAPE = 'aurora';

/**
 * Where Aurora's wandering harmonic arrives and departs, in seconds.
 * The live scheduler's own cycle runs twenty-five seconds, so inside a
 * twenty-two second piece the swell would arrive and never leave. Placed
 * here it rises under the opening garden, stands while the name resolves,
 * and withdraws before the last frame.
 */
export const GARDEN_HALO = Object.freeze({
  restSec: 5,
  fadeSec: 5,
  presenceSec: 5
});

/** Near-black shared by every engine's ground, so layers add cleanly. */
export const GARDEN_VOID = '#0A0A0C';

/**
 * The bed itself: a deep verdant dark lifting toward the ground line,
 * with a low glow where the garden is densest. Drawn rather than
 * generated. Turrell's aperture is a bounded opening in a wall, and it
 * read as a sun hanging over the flowers; no amount of tinting turns an
 * aperture into earth.
 */
export const GARDEN_GROUND = Object.freeze({
  topColor: '#08090C',
  earthColor: '#0A1710',
  glowColor: 'rgba(74, 138, 96, 0.20)',
  glowX: 0.5,
  glowY: 0.92,
  glowRadius: 0.85,
  horizon: 0.46,
  breathMs: 19_000,
  breathDepth: 0.08
});

/**
 * A stem per blossom, grown before its flower opens so a bud arrives at
 * the tip of something rather than materialising in mid-air. Klee drew
 * the first version and its line is lovely, but its colour comes from a
 * preset climate and it composes as a scattered figure, not as stems
 * rising from one edge.
 */
export const GARDEN_STEM = Object.freeze({
  seed: `${GARDEN_SEED}:stems`,
  leadMs: 1_800,
  rootY: 1.04,
  width: 5.5,
  color: 'rgba(122, 178, 128, 0.62)',
  sway: 0.10
});

/**
 * Ten blossoms, staggered from the back of the bed to the front so the
 * garden fills toward the viewer. Plates bake at quality 1 (760²) — none
 * is ever drawn larger than about four hundred pixels.
 *
 * `variant` is not decoration. Roughly half of any palette's seeds bake a
 * banded slab or a cross rather than a radial rosette, and no mask turns
 * a slab into a flower. Each pairing here was chosen off the contact
 * sheet that `--audit` prints, which seeds plates by this same formula so
 * that what is picked is what gets planted.
 */
export const GARDEN_BLOSSOMS = Object.freeze([
  { id: 'b1', x: 0.20, y: 0.46, size: 0.16, startMs: 1_800, openMs: 5_000, palette: 'teal', variant: 1 },
  { id: 'b2', x: 0.80, y: 0.44, size: 0.15, startMs: 2_300, openMs: 5_000, palette: 'lilac', variant: 1 },
  { id: 'b3', x: 0.50, y: 0.51, size: 0.18, startMs: 2_800, openMs: 5_000, palette: 'verdant', variant: 2 },
  { id: 'b4', x: 0.12, y: 0.60, size: 0.22, startMs: 3_300, openMs: 5_200, palette: 'peacock', variant: 0 },
  { id: 'b5', x: 0.88, y: 0.58, size: 0.21, startMs: 3_800, openMs: 5_200, palette: 'lilac', variant: 2 },
  { id: 'b6', x: 0.34, y: 0.67, size: 0.26, startMs: 4_400, openMs: 5_200, palette: 'iris', variant: 0 },
  { id: 'b7', x: 0.66, y: 0.71, size: 0.27, startMs: 5_000, openMs: 5_200, palette: 'teal', variant: 4 },
  { id: 'b8', x: 0.18, y: 0.82, size: 0.34, startMs: 5_600, openMs: 5_600, palette: 'reliquary', variant: 2 },
  { id: 'b9', x: 0.52, y: 0.89, size: 0.40, startMs: 6_200, openMs: 5_600, palette: 'iris', variant: 1 },
  { id: 'b10', x: 0.84, y: 0.80, size: 0.32, startMs: 6_800, openMs: 5_600, palette: 'peacock', variant: 4 }
].map(Object.freeze));

/** How small a bud is before it opens, as a share of its full size. */
export const GARDEN_BUD_SCALE = 0.16;

/**
 * The wordmark resolves last, and holds. The last frame is the one a
 * feed shows as the thumbnail, so it is the one that has to carry the
 * name. Marcellus is the display face; at 400 weight it needs size to
 * hold a fractal inside its strokes, which is why the cap height is a
 * fifth of the frame rather than a typographic nicety.
 */
export const GARDEN_WORDMARK = Object.freeze({
  text: 'RISE',
  seed: `${GARDEN_SEED}:wordmark`,
  fontFamily: "'Marcellus', 'Space Grotesk', Georgia, serif",
  fontWeight: 400,
  fontSize: 250,
  letterSpacing: 0.14,
  centerX: 0.5,
  centerY: 0.27,
  fromMs: 11_000,
  letterStaggerMs: 300,
  letterRevealMs: 3_800,
  settleScale: 1.05
});

function clamp01(value) {
  const n = Number(value);
  return n > 1 ? 1 : n > 0 ? n : 0;
}

export function easeOutCubic(t) {
  const x = clamp01(t);
  return 1 - ((1 - x) ** 3);
}

export function easeInOut(t) {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2;
}

/**
 * A blossom at one instant: how far its plate has been revealed, and how
 * far it has grown out of the bud. Both run on the same eased clock, so
 * the opening and the swelling are one gesture.
 */
export function blossomAt(blossom, elapsedMs) {
  const open = Math.max(1, Number(blossom?.openMs) || 1);
  const local = (Number(elapsedMs) || 0) - (Number(blossom?.startMs) || 0);
  if (local <= 0) return Object.freeze({ visible: false, progress: 0, scale: 0 });
  const eased = easeOutCubic(local / open);
  return Object.freeze({
    visible: true,
    progress: eased,
    scale: GARDEN_BUD_SCALE + (1 - GARDEN_BUD_SCALE) * eased,
    open: local >= open
  });
}

/** A stem finishes exactly as its blossom starts to open. */
export function stemAt(blossom, elapsedMs, stem = GARDEN_STEM) {
  const start = (Number(blossom?.startMs) || 0) - stem.leadMs;
  return easeOutCubic(((Number(elapsedMs) || 0) - start) / stem.leadMs);
}

/** A slow rise and fall, so the ground is never quite still. */
export function groundBreathAt(elapsedMs, ground = GARDEN_GROUND) {
  const phase = ((Number(elapsedMs) || 0) % ground.breathMs) / ground.breathMs;
  return 1 - ground.breathDepth * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2));
}

/**
 * Per-letter reveal. R, I, S and E arrive in sequence rather than as one
 * block, which reads as the name assembling rather than a title card
 * being switched on.
 */
export function wordmarkAt(elapsedMs, mark = GARDEN_WORDMARK) {
  const letters = [...mark.text].map((glyph, index) => {
    const start = mark.fromMs + index * mark.letterStaggerMs;
    const t = easeOutCubic(((Number(elapsedMs) || 0) - start) / mark.letterRevealMs);
    return Object.freeze({
      glyph,
      alpha: t,
      // Each letter settles the last few percent of its scale as it lands.
      scale: 1 + (mark.settleScale - 1) * (1 - t)
    });
  });
  return Object.freeze({
    letters,
    resolved: letters.every(letter => letter.alpha >= 1)
  });
}

export const GARDEN_SCORE = Object.freeze({
  id: GARDEN_ID,
  title: GARDEN_TITLE,
  seed: GARDEN_SEED,
  durationMs: GARDEN_DURATION_MS,
  viewport: GARDEN_VIEWPORT,
  frameRate: GARDEN_FRAME_RATE,
  soundscape: GARDEN_SOUNDSCAPE,
  halo: GARDEN_HALO,
  ground: GARDEN_GROUND,
  stem: GARDEN_STEM,
  blossoms: GARDEN_BLOSSOMS,
  wordmark: GARDEN_WORDMARK
});
