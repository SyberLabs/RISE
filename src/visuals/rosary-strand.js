/**
 * The glass rosary — the bead strand (spec §4).
 *
 * The one place the interface adds something, because the physical
 * rosary's job is exactly this: holding your place so attention can
 * leave the counting. Rendered as translucent glass beads on the dark
 * ground; the CURRENT bead warms to an ember glow, prayed beads keep
 * a faint after-warmth, so the path traveled stays visible.
 *
 * House visual rules: still frames only (re-render on state change,
 * no animation loop); glow via wide understrokes and layered fills,
 * never shadowBlur; fully deterministic — same state, same pixels;
 * null-ctx guard.
 *
 * Geometry: the loop carries the five decades (55 beads: 5 × (1 Our
 * Father + 10 Hail Marys)) arranged on an oval; the pendant hangs
 * below: medal, then the introductory beads (Glory Be, 3 Hail Marys,
 * Our Father), then the crucifix. Bead numbering matches
 * rosary-liturgy.js: crucifix 0, intro 1–5, decades 6–60.
 */

const EMBER = { r: 212, g: 165, b: 116 };
const GLASS = { r: 190, g: 198, b: 214 };

export class RosaryStrand {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext?.('2d') ?? null;
    this.state = { currentBead: null, prayed: new Set() };
  }

  /** Update choreography state and re-render the still. */
  setBead(bead) {
    if (bead == null) { this.render(); return; }
    if (this.state.currentBead != null && this.state.currentBead !== bead) {
      this.state.prayed.add(this.state.currentBead);
    }
    this.state.currentBead = bead;
    this.render();
  }

  reset() {
    this.state = { currentBead: null, prayed: new Set() };
    this.render();
  }

  /** Deterministic bead layout in unit space; cached per size. */
  _layout(w, h) {
    const cx = w / 2;
    const loopCy = h * 0.40;
    const rx = Math.min(w * 0.40, 190);
    const ry = Math.min(h * 0.30, 150);
    const beads = [];

    // The loop: 55 beads (5 decades × 11), medal at the bottom seam.
    // Walk clockwise from the medal position (bottom of the oval).
    const loopCount = 55;
    for (let i = 0; i < loopCount; i += 1) {
      const t = (i + 0.5) / loopCount;                 // avoid the seam itself
      const angle = Math.PI / 2 + t * Math.PI * 2;      // start at bottom, clockwise
      const decadeIndex = Math.floor(i / 11);
      const withinDecade = i % 11;
      beads.push({
        // bead number: decade N's Our Father is 6 + N*11 - 11
        bead: 6 + decadeIndex * 11 + withinDecade,
        x: cx + Math.cos(angle) * rx,
        y: loopCy + Math.sin(angle) * ry,
        r: withinDecade === 0 ? 7.5 : 5.5,             // Our Father beads larger
        kind: withinDecade === 0 ? 'pater' : 'ave'
      });
    }

    // The pendant: medal → Glory Be(5) → 3 Aves(4,3,2) → Pater(1) → crucifix(0)
    const pendantX = cx;
    const medalY = loopCy + ry + 14;
    const drop = 24;
    beads.push({ bead: -1, x: pendantX, y: medalY, r: 8, kind: 'medal' });
    beads.push({ bead: 5, x: pendantX, y: medalY + drop, r: 5.5, kind: 'ave' });
    beads.push({ bead: 4, x: pendantX, y: medalY + drop * 2, r: 5.5, kind: 'ave' });
    beads.push({ bead: 3, x: pendantX, y: medalY + drop * 3, r: 5.5, kind: 'ave' });
    beads.push({ bead: 2, x: pendantX, y: medalY + drop * 4, r: 5.5, kind: 'ave' });
    beads.push({ bead: 1, x: pendantX, y: medalY + drop * 5, r: 7.5, kind: 'pater' });
    beads.push({ bead: 0, x: pendantX, y: medalY + drop * 6 + 10, r: 11, kind: 'crucifix' });

    return { beads, cx, loopCy, rx, ry, pendantX, medalY, drop };
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;
    const { width: w, height: h } = this.canvas;
    ctx.clearRect(0, 0, w, h);
    const layout = this._layout(w, h);

    // The cord: a faint line through the loop and down the pendant
    ctx.strokeStyle = 'rgba(190, 198, 214, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(layout.cx, layout.loopCy, layout.rx, layout.ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(layout.pendantX, layout.loopCy + layout.ry);
    ctx.lineTo(layout.pendantX, layout.medalY + layout.drop * 6);
    ctx.stroke();

    for (const bead of layout.beads) {
      this._drawBead(ctx, bead);
    }
  }

  _drawBead(ctx, bead) {
    const isCurrent = bead.bead === this.state.currentBead;
    const isPrayed = this.state.prayed.has(bead.bead);
    const warm = isCurrent ? 1 : isPrayed ? 0.32 : 0;

    // Glow: layered wide understrokes, never shadowBlur
    if (warm > 0) {
      for (const [mult, alpha] of [[3.2, 0.05], [2.4, 0.09], [1.7, 0.16]]) {
        ctx.fillStyle = `rgba(${EMBER.r}, ${EMBER.g}, ${EMBER.b}, ${(alpha * warm).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(bead.x, bead.y, bead.r * mult, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (bead.kind === 'crucifix') {
      this._drawCrucifix(ctx, bead, warm);
      return;
    }

    // Glass body: cool translucent fill warmed by prayer state
    const mix = channel => Math.round(GLASS[channel] + (EMBER[channel] - GLASS[channel]) * warm);
    ctx.fillStyle = `rgba(${mix('r')}, ${mix('g')}, ${mix('b')}, ${(0.16 + warm * 0.36).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(bead.x, bead.y, bead.r, 0, Math.PI * 2);
    ctx.fill();

    // Rim light
    ctx.strokeStyle = `rgba(${mix('r')}, ${mix('g')}, ${mix('b')}, ${(0.35 + warm * 0.45).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bead.x, bead.y, bead.r, 0, Math.PI * 2);
    ctx.stroke();

    // Specular highlight — the glass — upper left, deterministic
    ctx.fillStyle = `rgba(255, 255, 255, ${(0.28 + warm * 0.25).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(bead.x - bead.r * 0.35, bead.y - bead.r * 0.35, bead.r * 0.28, 0, Math.PI * 2);
    ctx.fill();

    if (bead.kind === 'medal') {
      // The medal: a small ring
      ctx.strokeStyle = `rgba(${mix('r')}, ${mix('g')}, ${mix('b')}, 0.5)`;
      ctx.beginPath();
      ctx.arc(bead.x, bead.y, bead.r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _drawCrucifix(ctx, bead, warm) {
    const mix = channel => Math.round(GLASS[channel] + (EMBER[channel] - GLASS[channel]) * warm);
    const stroke = `rgba(${mix('r')}, ${mix('g')}, ${mix('b')}, ${(0.55 + warm * 0.4).toFixed(3)})`;
    const armY = bead.y - bead.r * 0.25;
    // Wide understroke glow for the cross itself
    if (warm > 0) {
      ctx.strokeStyle = `rgba(${EMBER.r}, ${EMBER.g}, ${EMBER.b}, ${(0.14 * warm).toFixed(3)})`;
      ctx.lineWidth = 6;
      this._crossPath(ctx, bead, armY);
      ctx.stroke();
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    this._crossPath(ctx, bead, armY);
    ctx.stroke();
  }

  _crossPath(ctx, bead, armY) {
    ctx.beginPath();
    ctx.moveTo(bead.x, bead.y - bead.r);
    ctx.lineTo(bead.x, bead.y + bead.r);
    ctx.moveTo(bead.x - bead.r * 0.6, armY);
    ctx.lineTo(bead.x + bead.r * 0.6, armY);
  }
}
