/**
 * The `rise.lib` a generated scene draws with
 * (docs/superpowers/specs/2026-10-08-creative-control-design.md §8).
 *
 * Small on purpose: axes, a grid, a plot, vectors, points, lines, arcs,
 * polygons, labels, tweens with easing, and colours from the reading's
 * theme. Its defaults are the style: a model that uses them gets a picture
 * that looks like RISE without saying so. Everything is plain 2D canvas, so
 * a scene may mix its own drawing with the library's, and nothing here
 * touches the worker's globals.
 *
 * Time is given, never taken: `tick(dt)` advances every tween by the step
 * the host sent, so a paused reading pauses every motion, and reduced motion
 * completes every tween in one step.
 */

export const EASE = Object.freeze({
  linear: t => t,
  smooth: t => t * t * (3 - 2 * t),
  in: t => t * t,
  out: t => 1 - (1 - t) * (1 - t),
  inOut: t => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2)
});

const DEFAULTS = Object.freeze({ stroke: 2, font: '16px sans-serif', labelFont: '14px sans-serif' });

/**
 * @param {object} options
 * @param {CanvasRenderingContext2D} options.ctx the scene's own context
 * @param {{width: number, height: number, dpr: number}} options.size in CSS pixels, and the ratio drawn at
 * @param {object} options.theme the reading's colours: background, text, accent, muted, highlight
 * @param {boolean} [options.reducedMotion] every tween completes at once
 */
export function createSceneLibrary({ ctx, size, theme, reducedMotion = false }) {
  const tweens = new Set();
  const palette = { background: '#06051a', text: '#f4f2ff', accent: '#8ab4ff', muted: '#8b88a6', highlight: '#ffd166', ...theme };
  const px = value => value * size.dpr;

  function clear(color = palette.background) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, px(size.width), px(size.height));
    ctx.restore();
  }

  /** A mapping from scene units to pixels, for axes and everything drawn on them. */
  function frameOf({ x: [x0, x1], y: [y0, y1] }, margin = 40) {
    const w = size.width - 2 * margin;
    const h = size.height - 2 * margin;
    return {
      toX: x => px(margin + ((x - x0) / (x1 - x0)) * w),
      toY: y => px(margin + h - ((y - y0) / (y1 - y0)) * h),
      x0, x1, y0, y1
    };
  }

  function stroke(path, { color = palette.text, width = DEFAULTS.stroke, dash = null } = {}) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = px(width);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (dash) ctx.setLineDash(dash.map(px));
    path();
    ctx.stroke();
    ctx.restore();
  }

  function fill(path, { color = palette.accent, alpha = 1 } = {}) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    path();
    ctx.fill();
    ctx.restore();
  }

  function label(text, { at, color = palette.text, font = DEFAULTS.labelFont, align = 'left', baseline = 'alphabetic', alpha = 1 } = {}) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = font.replace(/(\d+)px/u, (_, n) => `${px(Number(n))}px`);
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(String(text), px(at[0]), px(at[1]));
    ctx.restore();
  }

  /** Axes over a range; returns the frame everything else on them uses. */
  function axes(range, { color = palette.muted, labels = true, margin = 40 } = {}) {
    const frame = frameOf(range, margin);
    const origin = [frame.toX(Math.max(frame.x0, Math.min(0, frame.x1))), frame.toY(Math.max(frame.y0, Math.min(0, frame.y1)))];
    const draw = () => {
      stroke(() => {
        ctx.beginPath();
        ctx.moveTo(frame.toX(frame.x0), origin[1]);
        ctx.lineTo(frame.toX(frame.x1), origin[1]);
        ctx.moveTo(origin[0], frame.toY(frame.y0));
        ctx.lineTo(origin[0], frame.toY(frame.y1));
      }, { color, width: 1.5 });
      if (labels) {
        label(String(frame.x1), { at: [frame.toX(frame.x1) / size.dpr - 12, origin[1] / size.dpr + 18], color, align: 'right' });
        label(String(frame.y1), { at: [origin[0] / size.dpr + 8, frame.toY(frame.y1) / size.dpr + 14], color });
      }
    };
    return Object.assign(frame, { draw, origin });
  }

  function grid(frame, { step = 1, color = palette.muted, alpha = 0.25 } = {}) {
    ctx.save();
    ctx.globalAlpha = alpha;
    stroke(() => {
      ctx.beginPath();
      for (let x = Math.ceil(frame.x0 / step) * step; x <= frame.x1; x += step) { ctx.moveTo(frame.toX(x), frame.toY(frame.y0)); ctx.lineTo(frame.toX(x), frame.toY(frame.y1)); }
      for (let y = Math.ceil(frame.y0 / step) * step; y <= frame.y1; y += step) { ctx.moveTo(frame.toX(frame.x0), frame.toY(y)); ctx.lineTo(frame.toX(frame.x1), frame.toY(y)); }
    }, { color, width: 1 });
    ctx.restore();
  }

  /** A function of x, or points, drawn on a frame; `to` (0..1) draws only that much of it, for a tween. */
  function plot(frame, fnOrPoints, { color = palette.accent, width = 2.5, samples = 200, to = 1 } = {}) {
    const points = typeof fnOrPoints === 'function'
      ? Array.from({ length: samples + 1 }, (_, i) => { const x = frame.x0 + ((frame.x1 - frame.x0) * i) / samples; return [x, fnOrPoints(x)]; })
      : fnOrPoints;
    const count = Math.max(2, Math.round(points.length * Math.max(0, Math.min(1, to))));
    stroke(() => {
      ctx.beginPath();
      points.slice(0, count).forEach(([x, y], i) => { const X = frame.toX(x); const Y = frame.toY(y); if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); });
    }, { color, width });
  }

  /** A vector from the origin, or from `from`; its `t` (0..1) draws only that much, its `angle` rotates it. */
  function vector({ x, y, from = [0, 0], color = palette.accent, label: name = null, t = 1, angle = 0, width = 3 }) {
    const state = { x, y, from, color, name, t, angle, width };
    const draw = frame => {
      const cos = Math.cos(state.angle); const sin = Math.sin(state.angle);
      const dx = (state.x * cos - state.y * sin) * state.t; const dy = (state.x * sin + state.y * cos) * state.t;
      const ax = frame.toX(state.from[0]); const ay = frame.toY(state.from[1]);
      const bx = frame.toX(state.from[0] + dx); const by = frame.toY(state.from[1] + dy);
      stroke(() => { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); }, { color: state.color, width: state.width });
      const head = px(10); const dir = Math.atan2(by - ay, bx - ax);
      fill(() => {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - head * Math.cos(dir - 0.5), by - head * Math.sin(dir - 0.5));
        ctx.lineTo(bx - head * Math.cos(dir + 0.5), by - head * Math.sin(dir + 0.5));
        ctx.closePath();
      }, { color: state.color });
      if (state.name) label(state.name, { at: [bx / size.dpr + 8, by / size.dpr - 8], color: state.color });
    };
    return Object.assign(state, { draw });
  }

  function point(frame, [x, y], { color = palette.highlight, radius = 5, label: name = null } = {}) {
    fill(() => { ctx.beginPath(); ctx.arc(frame.toX(x), frame.toY(y), px(radius), 0, Math.PI * 2); }, { color });
    if (name) label(name, { at: [frame.toX(x) / size.dpr + 8, frame.toY(y) / size.dpr - 8], color });
  }

  function line(frame, [x0, y0], [x1, y1], options = {}) {
    stroke(() => { ctx.beginPath(); ctx.moveTo(frame.toX(x0), frame.toY(y0)); ctx.lineTo(frame.toX(x1), frame.toY(y1)); }, options);
  }

  function arc(frame, [cx, cy], radius, from, to, options = {}) {
    const r = Math.abs(frame.toX(cx + radius) - frame.toX(cx));
    stroke(() => { ctx.beginPath(); ctx.arc(frame.toX(cx), frame.toY(cy), r, -from, -to, true); }, options);
  }

  function polygon(frame, points, { color = palette.accent, alpha = 0.25, outline = true } = {}) {
    const path = () => { ctx.beginPath(); points.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(frame.toX(x), frame.toY(y)); else ctx.lineTo(frame.toX(x), frame.toY(y)); }); ctx.closePath(); };
    fill(path, { color, alpha });
    if (outline) stroke(path, { color });
  }

  /**
   * Move `target`'s numeric properties to `to` over `ms`, on the host's time. Resolves when done; with
   * `instant` (or reduced motion) it completes in one step, which is how a replayed cue lands at once.
   */
  function tween(target, to, { ms = 800, ease = EASE.smooth, instant = false } = {}) {
    const from = Object.fromEntries(Object.keys(to).map(key => [key, Number(target[key]) || 0]));
    if (instant || reducedMotion || ms <= 0) {
      Object.assign(target, to);
      return Promise.resolve(target);
    }
    return new Promise(resolve => {
      tweens.add({ target, from, to, ms, ease, elapsed: 0, resolve });
    });
  }

  /** Advance every tween by `dt` ms; the worker calls this once per frame before the scene draws. */
  function tick(dt) {
    for (const item of [...tweens]) {
      item.elapsed += dt;
      const k = item.ease(Math.max(0, Math.min(1, item.elapsed / item.ms)));
      for (const key of Object.keys(item.to)) item.target[key] = item.from[key] + (item.to[key] - item.from[key]) * k;
      if (item.elapsed >= item.ms) {
        Object.assign(item.target, item.to);
        tweens.delete(item);
        item.resolve(item.target);
      }
    }
  }

  function color(name, alpha = 1) {
    const hex = palette[name] ?? name;
    if (alpha >= 1 || !/^#[0-9a-f]{6}$/iu.test(hex)) return hex;
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return Object.freeze({
    clear, axes, grid, plot, vector, point, line, arc, polygon, label, tween, tick, ease: EASE, color, palette: Object.freeze({ ...palette }),
    /** How many tweens are still moving. */
    get moving() { return tweens.size; }
  });
}
