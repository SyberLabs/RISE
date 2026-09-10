/**
 * Browser stage for RISE compositions.
 *
 * Paints a whole scene — bed, stems, blossoms, wordmark — as a pure
 * function of elapsed presentation time, the same contract the Chamber
 * stage keeps. Not a screen recording and not rAF.
 *
 * WHY THIS IS NOT THE CHAMBER STAGE. The Chamber paints ONE cue for a
 * span, anchored to reading atoms. A composition is several engines on
 * independent clocks with no reading at all. Bending the reading score
 * into a compositor would have earned nothing; the two stages share the
 * browser host, the encoder and the clock, which is all they have in
 * common.
 *
 * Layers composite additively so overlapping blossoms glow into each
 * other. That only works because each plate is masked to a disc first:
 * a plate's ground is [10,10,12], not black, so adding a whole square
 * lifts the whole square, and the first render of this scene was ten
 * grey boxes floating over a garden.
 */

import { createSeededRandom } from '../../visuals/lib/klee-core.js';
import { Ostensoria } from '../../visuals/ostensoria.js';
import { FractalFlameGenerator } from '../../visuals/lib/fractal-engine.js';
import {
  GARDEN_SCORE,
  GARDEN_VOID,
  blossomAt,
  groundBreathAt,
  revealAt,
  leafOpenAt,
  stemAt,
  stemDepthOf,
  stemDepthStyle,
  wordmarkAt
} from '../../content/compositions/garden.js';
import markUrl from '../../content/compositions/syberlabs-mark.png';

/** Blossoms never draw larger than ~400px, so the smallest bake will do. */
const BLOSSOM_QUALITY = 1;
const CREAM = 'rgba(240, 236, 226, 0.98)';

/**
 * One formula for both the garden and the audit sheet. If these drifted,
 * the sheet would be a picture of plates nobody is going to see.
 */
function plateSeed(seed, palette, variant) {
  return `${seed}:plate:${palette}:${variant}`;
}

function withSeededRandom(seed, fn) {
  const rng = createSeededRandom(String(seed));
  const original = Math.random;
  Math.random = rng;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

function hexToRgb(hex) {
  const value = String(hex).replace('#', '');
  return [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16));
}

/**
 * Blend two hex colours, `t` of the way from the first to the second.
 * Returns hex rather than `rgb()` so the result can be mixed again — the
 * stem colours are lightened toward the tip and then hazed by distance,
 * which is two blends of the same value.
 */
function mixHex(from, to, t) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const k = t > 1 ? 1 : t < 0 ? 0 : t;
  const channel = i => Math.round(a[i] + (b[i] - a[i]) * k).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/** A stadium: a rectangle whose ends are half-circles. */
function pillPath(ctx, x, y, width, height) {
  const r = height / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + r, r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function offscreen(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function bytesToBase64(bytes) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const stage = {
  ready: false,
  baked: false,
  progressNote: 'idle',
  width: 1080,
  height: 1920,
  score: GARDEN_SCORE,

  async prepare({ width, height } = {}) {
    this.width = width || this.score.viewport.width;
    this.height = height || this.score.viewport.height;
    this.canvas = offscreen(this.width, this.height);
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true, alpha: false });

    // What distance fades a stem toward: the earth it is standing in.
    this.hazeColor = this.score.ground.earthColor;
    this.groundLayer = offscreen(this.width, this.height);
    this.markMask = offscreen(this.width, this.height);
    this.markFill = offscreen(this.width, this.height);
    this.markOut = offscreen(this.width, this.height);

    await document.fonts.load(`400 200px ${this.score.wordmark.fontFamily}`);
    await document.fonts.ready;

    this.bakeGrain();
    this.bakeGround();
    this.bakeStems();
    this.bakeBlossoms();
    await this.bakeWordmarkFill();
    await this.loadMark();

    this.baked = true;
    this.progressNote = 'baked';
    return true;
  },

  /**
   * One tile of grain, laid down once and repeated over the frame.
   *
   * White at a low alpha rather than black at a low alpha: at the bottom
   * of the range a multiply has nothing left to take, so darkening a
   * value-5 pixel by 1% moves it by nothing at all and the contour
   * survives. Lifting works everywhere.
   */
  bakeGrain() {
    this.progressNote = 'grain';
    const grain = this.score.grain;
    const size = grain.tile;
    const tile = offscreen(size, size);
    const ctx = tile.getContext('2d');
    const image = ctx.createImageData(size, size);
    const data = image.data;
    withSeededRandom(grain.seed, () => {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = Math.round(Math.random() * grain.levels);
      }
    });
    ctx.putImageData(image, 0, 0);
    this.grainPattern = this.ctx.createPattern(tile, 'repeat');
  },

  /**
   * The bed, painted once: night at the top, earth below the ground line,
   * and a low glow where the planting is densest.
   */
  bakeGround() {
    this.progressNote = 'ground';
    const g = this.score.ground;
    const ctx = this.groundLayer.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, this.height);
    sky.addColorStop(0, g.topColor);
    sky.addColorStop(g.horizon, g.topColor);
    sky.addColorStop(1, g.earthColor);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.width, this.height);
    const glow = ctx.createRadialGradient(
      this.width * g.glowX, this.height * g.glowY, 0,
      this.width * g.glowX, this.height * g.glowY, this.width * g.glowRadius
    );
    glow.addColorStop(0, g.glowColor);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.width, this.height);
  },

  /**
   * One quadratic per blossom, rooted below the frame and curving to the
   * flower's centre. Seeded, so the sway is the same every render.
   */
  bakeStems() {
    this.progressNote = 'stems';
    const stem = this.score.stem;
    const rng = createSeededRandom(stem.seed);
    const leaf = this.score.leaf;
    const scale = this.width / this.score.viewport.width;
    this.stems = this.score.blossoms.map(blossom => {
      const lean = (rng() - 0.5) * 2 * stem.sway;
      const item = {
        spec: blossom,
        leaves: [],
        // Read off the flower's size: small at the back, large at the front.
        depth: stemDepthStyle(stemDepthOf(blossom, this.score.blossoms)),
        rootX: blossom.x + lean,
        // The control point sits at the blossom's height but off to one
        // side, which is what makes a stem lean into its flower instead
        // of arriving as a straight rod.
        ctrlX: blossom.x + lean * 1.9,
        ctrlY: (blossom.y + stem.rootY) / 2
      };

      // WHERE THE FLOWER BEGINS, not a fixed share of the stem. A leaf's
      // place used to be a constant fraction along the stalk, which knows
      // nothing about the size of the bloom above it — so the largest
      // flowers grew a leaf inside their own petals.
      const base = stem.width * scale * item.depth.width;
      const reach = base * leaf.length * 1.22 * 0.6;
      const clearance = (blossom.size * this.width) / 2 + reach;
      const centreX = blossom.x * this.width;
      const centreY = blossom.y * this.height;
      let highest = leaf.from;
      for (let t = leaf.to; t >= leaf.from; t -= 0.01) {
        const point = this.stemPointAt(item, t);
        if (Math.hypot(point.x - centreX, point.y - centreY) >= clearance) {
          highest = t;
          break;
        }
      }

      const span = highest - leaf.from;
      item.leaves = span <= 0.02 ? [] : Array.from({ length: leaf.perStem }, (unused, index) => {
        const spread = (index + 0.5) / leaf.perStem;
        return {
          // Spaced up the stem, jittered so a bed of them is not a ladder.
          along: leaf.from + span * spread + (rng() - 0.5) * span * 0.12,
          // Alternating, so a stem does not grow all its leaves one way.
          side: index % 2 === 0 ? 1 : -1,
          length: 0.78 + rng() * 0.44,
          tilt: (rng() - 0.5) * 0.4
        };
      });
      return item;
    });
  },

  bakeBlossoms() {
    this.blossoms = this.score.blossoms.map((blossom, index) => {
      this.progressNote = `blossom ${index + 1}/${this.score.blossoms.length}`;
      const engine = new Ostensoria();
      engine.generate(null, plateSeed(this.score.seed, blossom.palette, blossom.variant), {
        palette: blossom.palette,
        quality: BLOSSOM_QUALITY
      });
      // One canvas per blossom, at the size it is actually drawn. The
      // reveal itself always costs the plate's own resolution, so this
      // only saves the blit — but it saves it on every frame.
      const side = Math.round(blossom.size * this.width);
      return {
        spec: blossom,
        engine,
        canvas: offscreen(side, side),
        drawnProgress: -1
      };
    });
  },

  async bakeWordmarkFill() {
    this.progressNote = 'wordmark';
    const generator = new FractalFlameGenerator();
    generator.useWorkers = false;
    generator.backgroundColor = [10, 10, 12];
    withSeededRandom(this.score.wordmark.seed, () => {
      generator.palette = generator.generateDefaultPalette();
      generator.generateRandomFlame();
    });
    const width = this.width;
    const height = Math.round(this.width * 0.5);
    const imageData = await generator.generateImage({
      iterations: 900_000,
      width,
      height,
      gamma: 2.2,
      // Brighter than a full-frame flame: this one is seen only through
      // letter strokes, so most of what it draws is thrown away.
      brightness: 26,
      vibrancy: 1.35,
      oversample: 1,
      useWorkers: false
    });
    this.wordmarkFill = offscreen(width, height);
    this.wordmarkFill.getContext('2d').putImageData(imageData, 0, 0);
    generator.dispose?.();
  },

  /** The SyberLabs mark, decoded once before the first frame is asked for. */
  loadMark() {
    this.progressNote = 'mark';
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => { this.mark = image; resolve(true); };
      // A missing mark must not cost the whole render: the card simply
      // arrives without it, and the log says the bake fell short.
      image.onerror = () => { this.mark = null; resolve(false); };
      image.src = markUrl;
    });
  },

  /** One line of the release card, centred and letterspaced. */
  paintCardLine(piece, elapsedMs) {
    const reveal = revealAt(piece, elapsedMs);
    if (reveal <= 0) return;
    const ctx = this.ctx;
    const fontPx = piece.fontSize * (this.width / this.score.viewport.width);
    const tracking = fontPx * piece.letterSpacing;
    const centreX = this.width * piece.centerX - tracking / 2;
    const centreY = this.height * piece.centerY;

    ctx.save();
    ctx.font = `400 ${fontPx}px ${piece.fontFamily}`;
    ctx.letterSpacing = `${tracking}px`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (piece.pill) {
      const pill = piece.pill;
      const textWidth = ctx.measureText(piece.text).width;
      const boxW = textWidth + fontPx * pill.paddingX * 2;
      const boxH = fontPx * (1 + pill.paddingY * 2);
      ctx.save();
      // The blur is applied to the fill itself, so the stadium arrives
      // already without an edge rather than being softened afterwards.
      ctx.filter = `blur(${pill.featherPx * (this.width / this.score.viewport.width)}px)`;
      ctx.globalAlpha = reveal * pill.opacity;
      ctx.fillStyle = pill.color;
      pillPath(ctx, centreX - boxW / 2, centreY - boxH / 2, boxW, boxH);
      ctx.fill();
      ctx.restore();
    }

    ctx.globalAlpha = reveal * piece.opacity;
    ctx.fillStyle = piece.color;
    // The tracking is applied to the run, so the centred text sits half a
    // space to the right of true centre without the offset in `centreX`.
    ctx.fillText(piece.text, centreX, centreY);
    ctx.restore();
  },

  paintMark(elapsedMs) {
    const piece = this.score.announcement.mark;
    const reveal = revealAt(piece, elapsedMs);
    if (reveal <= 0 || !this.mark) return;
    const ctx = this.ctx;
    const width = this.width * piece.width;
    const height = width * (this.mark.naturalHeight / this.mark.naturalWidth);
    ctx.save();
    ctx.globalAlpha = reveal * piece.opacity;
    ctx.drawImage(
      this.mark,
      this.width * piece.centerX - width / 2,
      this.height * piece.centerY - height / 2,
      width,
      height
    );
    ctx.restore();
  },

  paintAnnouncement(elapsedMs) {
    const card = this.score.announcement;
    this.paintCardLine(card.message, elapsedMs);
    this.paintMark(elapsedMs);
    this.paintCardLine(card.credit, elapsedMs);
  },

  /** Glyph boxes for the wordmark, measured once against the loaded face. */
  wordmarkLayout() {
    if (this._layout) return this._layout;
    const mark = this.score.wordmark;
    const ctx = this.markMask.getContext('2d');
    const fontPx = mark.fontSize * (this.width / this.score.viewport.width);
    ctx.font = `${mark.fontWeight} ${fontPx}px ${mark.fontFamily}`;
    const tracking = fontPx * mark.letterSpacing;
    const glyphs = [...mark.text].map(glyph => ({
      glyph,
      width: ctx.measureText(glyph).width
    }));
    const total = glyphs.reduce((sum, g) => sum + g.width, 0) + tracking * (glyphs.length - 1);
    let x = this.width * mark.centerX - total / 2;
    for (const g of glyphs) {
      g.centerX = x + g.width / 2;
      x += g.width + tracking;
    }
    this._layout = {
      fontPx,
      glyphs,
      font: `${mark.fontWeight} ${fontPx}px ${mark.fontFamily}`,
      centerY: this.height * mark.centerY
    };
    return this._layout;
  },

  paintGround(elapsedMs) {
    const ctx = this.ctx;
    const breath = groundBreathAt(elapsedMs, this.score.ground);
    ctx.save();
    ctx.globalAlpha = breath;
    ctx.drawImage(this.groundLayer, 0, 0, this.width, this.height);
    ctx.restore();
  },

  /** A point along a stem's quadratic, at `t` of its full length. */
  stemPointAt(item, t) {
    const stem = this.score.stem;
    const x0 = item.rootX * this.width;
    const y0 = stem.rootY * this.height;
    const cx = item.ctrlX * this.width;
    const cy = item.ctrlY * this.height;
    const x1 = item.spec.x * this.width;
    const y1 = item.spec.y * this.height;
    const u = 1 - t;
    return {
      x: u * u * x0 + 2 * u * t * cx + t * t * x1,
      y: u * u * y0 + 2 * u * t * cy + t * t * y1
    };
  },

  /**
   * A blade: two quadratics out to a tip and back, bellied on both sides.
   * It takes its direction from the stem's own tangent where it attaches,
   * so a leaning stem carries leaves that lean with it.
   */
  paintLeaves(item, grown, base) {
    const leaf = this.score.leaf;
    const ctx = this.ctx;
    for (const spec of item.leaves) {
      const open = leafOpenAt(grown, spec.along, leaf);
      if (open <= 0) continue;
      const at = this.stemPointAt(item, spec.along);
      const ahead = this.stemPointAt(item, Math.min(1, spec.along + 0.02));
      const dx = ahead.x - at.x;
      const dy = ahead.y - at.y;
      const run = Math.hypot(dx, dy) || 1;

      // The stem's direction, turned toward the leaf's side.
      const turn = (leaf.angle + spec.tilt) * spec.side;
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      const length = base * leaf.length * spec.length * open;
      const axisX = ((dx * cos - dy * sin) / run) * length;
      const axisY = ((dx * sin + dy * cos) / run) * length;
      // The blade starts INSIDE the stem, not on its centre line. Ending
      // at a sharp point on a thin stalk left every leaf looking as though
      // it were floating beside the plant: the join was geometrically
      // exact and visually absent.
      const rootBack = base * 0.85;
      const rootX = at.x - (axisX / length) * rootBack;
      const rootY = at.y - (axisY / length) * rootBack;
      const tipX = at.x + axisX;
      const tipY = at.y + axisY;
      const midX = (rootX + tipX) / 2;
      const midY = (rootY + tipY) / 2;
      const belly = leaf.bulge * open;
      const spanX = tipX - rootX;
      const spanY = tipY - rootY;
      const bellyX = -spanY * belly;
      const bellyY = spanX * belly;

      const haze = colour => mixHex(colour, this.hazeColor, item.depth.haze);
      const shade = ctx.createLinearGradient(rootX, rootY, tipX, tipY);
      shade.addColorStop(0, haze(leaf.baseColor));
      shade.addColorStop(0.62, haze(leaf.tipColor));
      shade.addColorStop(1, haze(leaf.sheenColor));

      ctx.save();
      // Only the unfurling fades; distance is carried by colour.
      ctx.globalAlpha = leaf.opacity * open;
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      ctx.quadraticCurveTo(midX + bellyX, midY + bellyY, tipX, tipY);
      ctx.quadraticCurveTo(midX - bellyX, midY - bellyY, rootX, rootY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },

  paintStems(elapsedMs) {
    const stem = this.score.stem;
    const ctx = this.ctx;
    const scale = this.width / this.score.viewport.width;
    ctx.save();
    ctx.lineCap = 'round';
    for (const item of this.stems) {
      const grown = stemAt(item.spec, elapsedMs, stem);
      if (grown <= 0) continue;
      const base = stem.width * scale * item.depth.width;
      this.paintLeaves(item, grown, base);

      // Walked in short segments rather than stroked as one path, because
      // a stem is thicker at the root than at the tip and a single stroke
      // has one width for its whole length.
      const steps = 28;
      let previous = this.stemPointAt(item, 0);
      for (let i = 1; i <= steps; i += 1) {
        const along = (i / steps) * grown;
        const point = this.stemPointAt(item, along);
        const width = base * (1 - stem.taper * along);

        // A gradient laid across the segment, not along it. The stops
        // are a cylinder's cross-section: a dim rim, a specular band
        // inboard of it, the body, then the core shadow on the far side.
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        const length = Math.hypot(dx, dy) || 1;
        const nx = (-dy / length) * stem.lightFrom;
        const ny = (dx / length) * stem.lightFrom;
        const midX = (previous.x + point.x) / 2;
        const midY = (previous.y + point.y) / 2;
        const half = width / 2;
        const across = ctx.createLinearGradient(
          midX + nx * half, midY + ny * half,
          midX - nx * half, midY - ny * half
        );
        // Lightened toward the tip, the way new growth is paler.
        const lift = 0.35 * along;
        const haze = colour => mixHex(colour, this.hazeColor, item.depth.haze);
        across.addColorStop(0, haze(mixHex(stem.rimColor, stem.sheenColor, lift)));
        across.addColorStop(stem.sheenAt, haze(stem.sheenColor));
        across.addColorStop(stem.bodyAt, haze(mixHex(stem.bodyColor, stem.sheenColor, lift)));
        across.addColorStop(1, haze(stem.coreColor));
        ctx.beginPath();
        ctx.moveTo(previous.x, previous.y);
        ctx.lineTo(point.x, point.y);
        ctx.lineWidth = width;
        // Opaque. Semi-transparent strokes composited themselves at every
        // joint where the round caps overlapped, banding the stem.
        ctx.strokeStyle = across;
        ctx.stroke();
        previous = point;
      }
    }
    ctx.restore();
  },

  paintBlossoms(elapsedMs) {
    const ctx = this.ctx;
    for (const [index, bloom] of this.blossoms.entries()) {
      const at = blossomAt(bloom.spec, elapsedMs);
      if (!at.visible) continue;
      // A finished plate is a plain blit; only an opening one pays for
      // the reveal, which is why the stagger keeps the cost flat.
      if (at.progress !== bloom.drawnProgress) {
        bloom.engine.render(bloom.canvas, { progress: at.progress });
        this.maskToDisc(bloom.canvas);
        bloom.drawnProgress = at.progress;
      }
      const side = bloom.canvas.width * at.scale;
      // At the tip of its own stem rather than at a fixed point. While the
      // stem is full length the tip IS that point, so the opening is
      // unchanged; when the stem withdraws it takes the bud with it.
      const tip = this.stemPointAt(this.stems[index], stemAt(bloom.spec, elapsedMs, this.score.stem));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(bloom.canvas, tip.x - side / 2, tip.y - side / 2, side, side);
      ctx.restore();
    }
  },

  /**
   * Carve a plate's square down to a soft disc. Without this the plate's
   * near-black ground is additively visible as a rectangle; with it the
   * flower also gains the round silhouette a flower ought to have.
   */
  maskToDisc(canvas) {
    const ctx = canvas.getContext('2d');
    const half = canvas.width / 2;
    const fade = ctx.createRadialGradient(half, half, half * 0.10, half, half, half);
    fade.addColorStop(0, 'rgba(255, 255, 255, 1)');
    fade.addColorStop(0.52, 'rgba(255, 255, 255, 0.98)');
    fade.addColorStop(0.78, 'rgba(255, 255, 255, 0.45)');
    fade.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  },

  paintWordmark(elapsedMs) {
    const state = wordmarkAt(elapsedMs, this.score.wordmark);
    if (state.letters.every(letter => letter.alpha <= 0)) return;
    const ctx = this.ctx;
    const layout = this.wordmarkLayout();

    const mask = this.markMask.getContext('2d');
    mask.setTransform(1, 0, 0, 1, 0, 0);
    mask.clearRect(0, 0, this.width, this.height);
    mask.font = layout.font;
    mask.textAlign = 'center';
    mask.textBaseline = 'middle';
    mask.fillStyle = '#FFFFFF';
    state.letters.forEach((letter, index) => {
      if (letter.alpha <= 0) return;
      const glyph = layout.glyphs[index];
      mask.save();
      mask.globalAlpha = letter.alpha;
      mask.translate(glyph.centerX, layout.centerY);
      mask.scale(letter.scale, letter.scale);
      mask.fillText(letter.glyph, 0, 0);
      mask.restore();
    });

    // The letters are their own small night: a near-black body so they
    // separate from the garden, with the flame added inside it.
    const fill = this.markFill.getContext('2d');
    fill.setTransform(1, 0, 0, 1, 0, 0);
    fill.globalCompositeOperation = 'source-over';
    fill.fillStyle = GARDEN_VOID;
    fill.fillRect(0, 0, this.width, this.height);
    fill.save();
    fill.globalCompositeOperation = 'lighter';
    const fillHeight = this.width * 0.5;
    // Twice, additively. Seen only through letter strokes, a single pass
    // of the flame left the name dimmer than the flowers under it.
    for (let pass = 0; pass < 2; pass += 1) {
      fill.drawImage(
        this.wordmarkFill,
        0,
        layout.centerY - fillHeight / 2,
        this.width,
        fillHeight
      );
    }
    fill.restore();

    const out = this.markOut.getContext('2d');
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.globalCompositeOperation = 'source-over';
    out.clearRect(0, 0, this.width, this.height);
    out.drawImage(this.markFill, 0, 0);
    out.globalCompositeOperation = 'destination-in';
    out.drawImage(this.markMask, 0, 0);
    out.globalCompositeOperation = 'source-over';

    ctx.drawImage(this.markOut, 0, 0);

    // A hairline of cream on the outline: inscriptional letters holding
    // living light, rather than a glow with no edge.
    ctx.save();
    ctx.font = layout.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = Math.max(1, layout.fontPx * 0.022);
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(150, 210, 255, 0.45)';
    ctx.shadowBlur = layout.fontPx * 0.22;
    state.letters.forEach((letter, index) => {
      if (letter.alpha <= 0) return;
      const glyph = layout.glyphs[index];
      ctx.save();
      ctx.globalAlpha = letter.alpha;
      ctx.translate(glyph.centerX, layout.centerY);
      ctx.scale(letter.scale, letter.scale);
      ctx.strokeText(letter.glyph, 0, 0);
      ctx.restore();
    });
    ctx.restore();
  },

  paint({ elapsedMs = 0 } = {}) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = GARDEN_VOID;
    ctx.fillRect(0, 0, this.width, this.height);
    this.paintGround(elapsedMs);
    this.paintStems(elapsedMs);
    this.paintBlossoms(elapsedMs);
    this.paintWordmark(elapsedMs);
    this.paintAnnouncement(elapsedMs);
    this.paintGrain();
    return true;
  },

  /** Over everything, so no gradient laid down above it bands again. */
  paintGrain() {
    if (!this.grainPattern) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.grainPattern;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  },

  async captureRgba() {
    const pixels = this.ctx.getImageData(0, 0, this.width, this.height);
    return {
      width: this.width,
      height: this.height,
      rgba: await bytesToBase64(pixels.data)
    };
  },

  /** Preview only: a look at one instant without muxing six hundred frames. */
  capturePng() {
    return this.canvas.toDataURL('image/png');
  }
};

window.__stage = stage;
stage.ready = true;
