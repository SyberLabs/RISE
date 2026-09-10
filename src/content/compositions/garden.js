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
export const GARDEN_DURATION_MS = 30_000;
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

function clamp01(value) {
  const n = Number(value);
  return n > 1 ? 1 : n > 0 ? n : 0;
}

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
 * Dither.
 *
 * The card's field spans about six 8-bit levels across seven hundred
 * pixels, so every level boundary lands as a visible contour and the
 * feathered pill reads as onion rings rather than as a seat. Nothing is
 * wrong with the gradient; eight bits simply cannot carry it. A grain
 * two levels deep breaks the boundaries up and the ramp reads smooth.
 *
 * Baked ONCE and held still for the whole clip: moving grain would cost
 * every frame its inter-frame prediction and multiply the file size for
 * an effect no one can see at this amplitude.
 */
export const GARDEN_GRAIN = Object.freeze({
  tile: 256,
  // Peak lift in 8-bit levels. Two dissolves a one-level contour; more
  // starts to be visible as texture on the flowers.
  levels: 3.6,
  seed: 0x6A17
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
  sway: 0.10,

  // Width at the base of the nearest stem. Every other stem is a share of
  // it, because a stem drawn at one width whatever its distance is a wire.
  width: 13,
  // How much thinner the tip is than the base.
  taper: 0.66,
  // THE CROSS-SECTION, from the lit edge to the far one, run across the
  // stem's width rather than along its length. A cylinder is not
  // brightest at its edge: the specular band sits a little inboard, and
  // that is the whole of why it reads as round. An earlier version laid a
  // bright stroke BESIDE the body instead, which at five pixels wide is a
  // stripe rather than shading, and was invisible at viewing scale.
  rimColor: '#3E6B48',
  sheenColor: '#DCEFD2',
  bodyColor: '#5E9A66',
  coreColor: '#1B3A24',
  sheenAt: 0.22,
  bodyAt: 0.55,
  // Which side the light comes from: -1 left, 1 right.
  lightFrom: -1
});

/**
 * Distance, read off the size of the flower a stem carries.
 *
 * The bed is planted with small blossoms at the back and large ones at the
 * front, so their size already says how far away each one is. Stems take
 * their width and their brightness from it, which is the whole of the
 * depth in this scene.
 */
export const GARDEN_DEPTH = Object.freeze({
  widthNear: 1,
  widthFar: 0.54,
  // How far a stem's colour is carried toward the ground it stands in.
  // Distance used to be drawn as transparency, which cost twice: the
  // farthest stems dimmed until their own leaves looked unattached, and
  // every overlapping line-cap composited itself into a bright band, so
  // the stems came out looking like bamboo.
  hazeNear: 0,
  hazeFar: 0.58
});

export function stemDepthOf(blossom, blossoms = GARDEN_BLOSSOMS) {
  const sizes = blossoms.map(item => item.size);
  const min = Math.min(...sizes);
  const max = Math.max(...sizes);
  if (max === min) return 1;
  return (blossom.size - min) / (max - min);
}

/**
 * How far a leaf has unfurled, from the growth of the stem carrying it.
 * Zero until the stem reaches it; one once the stem has grown well past.
 */
export function leafOpenAt(grown, along, leaf = GARDEN_LEAF) {
  return easeInOut(((Number(grown) || 0) - along) / leaf.unfurl);
}

/** Width and haze for a stem at a given depth, 0 farthest and 1 nearest. */
export function stemDepthStyle(depth, d = GARDEN_DEPTH) {
  const t = clamp01(depth);
  return Object.freeze({
    width: d.widthFar + (d.widthNear - d.widthFar) * t,
    haze: d.hazeFar + (d.hazeNear - d.hazeFar) * t
  });
}

/**
 * Leaves, sprouting from the stems.
 *
 * The only part of a stem that has a SILHOUETTE. Everything else tried
 * here — taper, gradient, a lit cross-section — is material, and material
 * is what disappears when a stem is a few pixels wide in a feed. A leaf
 * is a shape, and a shape survives being small.
 *
 * A leaf unfurls from the growth of the stem carrying it rather than from
 * a clock of its own, so it opens as the stem passes it and furls again
 * when the stem withdraws, with nothing to keep in step.
 */
export const GARDEN_LEAF = Object.freeze({
  perStem: 3,
  // Where along the stem the first and last leaves attach.
  from: 0.26,
  to: 0.72,
  // How much further the stem must grow for a leaf to open completely.
  unfurl: 0.18,
  // Multiples of the stem's base width.
  length: 8.5,
  bulge: 0.32,
  // Radians away from the stem's own direction.
  angle: 0.95,
  // Near the stem's own body colour, not the shadow under it: a blade
  // whose base was almost the ground made every leaf look unattached,
  // because the join was there and simply could not be seen.
  baseColor: '#558E5B',
  tipColor: '#7CB179',
  sheenColor: '#C6E2B8',
  opacity: 0.88
});

/**
 * How the garden un-grows: all at once.
 *
 * The bed FILLS in sequence, a flower at a time, because growth is a
 * thing that happens to each of them. It EMPTIES on one clock, because
 * the closing is a single gesture the whole garden makes together — and
 * staggering it read as ten flowers collapsing at different rates rather
 * than as one breath drawn back in.
 *
 * The stems follow the same clock: every flower has shut before any stem
 * begins to withdraw.
 */
export const GARDEN_CLOSE = Object.freeze({
  fromMs: 16_500,
  foldMs: 2_600,
  recedeMs: 2_000
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

/**
 * The release card the piece ends on.
 *
 * The wordmark stays where it resolved; everything here arrives beneath
 * it once the bed is bare, so the last frame — the one a feed shows as
 * the thumbnail — carries the name, the announcement and whose it is.
 */
export const GARDEN_ANNOUNCEMENT = Object.freeze({
  message: Object.freeze({
    text: 'Out now',
    fontFamily: "'Marcellus', 'Space Grotesk', Georgia, serif",
    fontSize: 92,
    letterSpacing: 0.18,
    color: '#F0ECE2',
    opacity: 1,
    centerX: 0.5,
    centerY: 0.42,
    fromMs: 23_000,
    revealMs: 2_000,
    // An understated seat for the line: a stadium of deeper ink, blurred
    // until it has no edge of its own. On a ground this dark it is not
    // meant to be seen as a shape — only to stop the words floating.
    pill: Object.freeze({
      // Full black at full strength, which reads as an odd choice for
      // something meant to be barely there — but the ground here is only
      // (10, 13, 17), so even the deepest possible well is a whisper.
      // Depth is what buys smoothness. A faint pill spreads six 8-bit
      // levels across the whole feather and lands a contour every twenty
      // pixels, which is exactly the onion-ring the first render showed;
      // the full-depth well crosses three times as many levels over the
      // same distance, and bands that fine disappear into the grain. The
      // shallower, safer-looking pill is the one that rings.
      color: '#000000',
      opacity: 1,
      // Little padding and a wide feather, so almost none of the well is
      // flat: at a feed's thumbnail size a boxier pill reads as a black
      // lozenge laid on the frame rather than as ink around the words.
      paddingX: 0.82,
      paddingY: 0.46,
      featherPx: 48
    })
  }),
  mark: Object.freeze({
    // A share of frame WIDTH, like everything else placed here.
    width: 0.17,
    centerX: 0.5,
    centerY: 0.76,
    opacity: 1,
    fromMs: 25_000,
    revealMs: 1_600
  }),
  credit: Object.freeze({
    text: 'by SyberLabs',
    fontFamily: "'Marcellus', 'Space Grotesk', Georgia, serif",
    fontSize: 38,
    letterSpacing: 0.14,
    color: '#F0ECE2',
    opacity: 0.72,
    centerX: 0.5,
    centerY: 0.862,
    fromMs: 26_200,
    revealMs: 1_400
  })
});

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
export function blossomAt(blossom, elapsedMs, close = GARDEN_CLOSE) {
  const open = Math.max(1, Number(blossom?.openMs) || 1);
  const now = Number(elapsedMs) || 0;
  const local = now - (Number(blossom?.startMs) || 0);
  if (local <= 0) return Object.freeze({ visible: false, progress: 0, scale: 0, openness: 0 });
  const opened = easeOutCubic(local / open);
  // The plate's reveal takes `openness` directly, so the petals un-draw
  // from the edge back to the dense centre rather than fading out.
  //
  // EASED AT BOTH ENDS, unlike the opening. Opening accelerates away and
  // settles, which is right for something growing. Reusing that curve to
  // close meant a flower was 87% shut a third of the way through its fold
  // and then crept to nothing — a lurch, invisible while the flowers were
  // staggered and impossible to miss once they move together.
  const folding = now - close.fromMs;
  const fold = folding > 0 ? easeInOut(folding / close.foldMs) : 0;
  const openness = opened * (1 - fold);
  return Object.freeze({
    visible: true,
    openness,
    progress: openness,
    scale: GARDEN_BUD_SCALE + (1 - GARDEN_BUD_SCALE) * openness,
    open: local >= open && fold <= 0,
    closed: fold >= 1
  });
}

/**
 * A stem finishes exactly as its blossom starts to open, and withdraws
 * once that blossom has finished folding. The flower is drawn at the tip
 * rather than at a fixed point, so withdrawing pulls the bud into the
 * earth instead of leaving it hanging where it grew.
 */
export function stemAt(blossom, elapsedMs, stem = GARDEN_STEM, close = GARDEN_CLOSE) {
  const now = Number(elapsedMs) || 0;
  const start = (Number(blossom?.startMs) || 0) - stem.leadMs;
  const grown = easeOutCubic((now - start) / stem.leadMs);
  const recedeFrom = close.fromMs + close.foldMs;
  if (now <= recedeFrom) return grown;
  // Eased at both ends, for the same reason the fold is.
  return grown * (1 - easeInOut((now - recedeFrom) / close.recedeMs));
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

/** How far a card element has arrived, 0 before it starts and 1 once landed. */
export function revealAt(piece, elapsedMs) {
  return easeOutCubic(((Number(elapsedMs) || 0) - piece.fromMs) / piece.revealMs);
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
  grain: GARDEN_GRAIN,
  stem: GARDEN_STEM,
  leaf: GARDEN_LEAF,
  close: GARDEN_CLOSE,
  announcement: GARDEN_ANNOUNCEMENT,
  blossoms: GARDEN_BLOSSOMS,
  wordmark: GARDEN_WORDMARK
});
