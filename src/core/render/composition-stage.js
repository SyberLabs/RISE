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
  stemAt,
  wordmarkAt
} from '../../content/compositions/garden.js';

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

    this.groundLayer = offscreen(this.width, this.height);
    this.markMask = offscreen(this.width, this.height);
    this.markFill = offscreen(this.width, this.height);
    this.markOut = offscreen(this.width, this.height);

    await document.fonts.load(`400 200px ${this.score.wordmark.fontFamily}`);
    await document.fonts.ready;

    this.bakeGround();
    this.bakeStems();
    this.bakeBlossoms();
    await this.bakeWordmarkFill();

    this.baked = true;
    this.progressNote = 'baked';
    return true;
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
    this.stems = this.score.blossoms.map(blossom => {
      const lean = (rng() - 0.5) * 2 * stem.sway;
      return {
        spec: blossom,
        rootX: blossom.x + lean,
        // The control point sits at the blossom's height but off to one
        // side, which is what makes a stem lean into its flower instead
        // of arriving as a straight rod.
        ctrlX: blossom.x + lean * 1.9,
        ctrlY: (blossom.y + stem.rootY) / 2
      };
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

  paintStems(elapsedMs) {
    const stem = this.score.stem;
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = stem.color;
    for (const item of this.stems) {
      const grown = stemAt(item.spec, elapsedMs, stem);
      if (grown <= 0) continue;
      const x0 = item.rootX * this.width;
      const y0 = stem.rootY * this.height;
      const cx = item.ctrlX * this.width;
      const cy = item.ctrlY * this.height;
      const x1 = item.spec.x * this.width;
      const y1 = item.spec.y * this.height;
      // Walked rather than clipped, so the tip is where growth has
      // reached and the line tapers toward it.
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      const steps = 24;
      for (let i = 1; i <= steps; i += 1) {
        const t = (i / steps) * grown;
        const u = 1 - t;
        ctx.lineTo(
          u * u * x0 + 2 * u * t * cx + t * t * x1,
          u * u * y0 + 2 * u * t * cy + t * t * y1
        );
      }
      ctx.lineWidth = stem.width * (this.width / 1080) * (0.55 + 0.45 * grown);
      ctx.stroke();
    }
    ctx.restore();
  },

  /**
   * Bake a grid of candidate plates and lay them out on the main canvas.
   *
   * Choosing which plate becomes which flower is the authoring act here:
   * a seed either grows a radial rosette or a banded slab, and no mask
   * turns a slab into a flower. This is how that choice gets LOOKED at
   * rather than guessed. Preview only; it destroys the frame it draws on.
   */
  async auditPlates(palettes, variants) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = GARDEN_VOID;
    ctx.fillRect(0, 0, this.width, this.height);
    const cellW = this.width / variants;
    const cellH = this.height / palettes.length;
    const side = Math.round(Math.min(cellW, cellH) * 0.92);
    const cell = offscreen(side, side);
    for (let row = 0; row < palettes.length; row += 1) {
      for (let col = 0; col < variants; col += 1) {
        const engine = new Ostensoria();
        engine.generate(null, plateSeed(this.score.seed, palettes[row], col), {
          palette: palettes[row],
          quality: BLOSSOM_QUALITY
        });
        engine.render(cell, { progress: 1 });
        this.maskToDisc(cell);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(cell, col * cellW + (cellW - side) / 2, row * cellH + (cellH - side) / 2, side, side);
        ctx.restore();
        cell.getContext('2d').clearRect(0, 0, side, side);
      }
    }
    return true;
  },

  paintBlossoms(elapsedMs) {
    const ctx = this.ctx;
    for (const bloom of this.blossoms) {
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
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(
        bloom.canvas,
        bloom.spec.x * this.width - side / 2,
        bloom.spec.y * this.height - side / 2,
        side,
        side
      );
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
    return true;
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
