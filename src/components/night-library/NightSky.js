/**
 * The night library: RISE's Library drawn as a star map behind Home's text.
 * Every released work is a star, constellation lines join works of a group,
 * and a faint spectrum attractor cloud glows behind them. A roll flares one
 * star (spectrum rings and a bright attractor burst) and dims the rest.
 *
 *   const sky = new NightSky(container, { sky, onPick });
 *   sky.start(); sky.stop(); sky.flare(workId | null); sky.setBusy(bool); sky.destroy();
 *
 * flare() ignores the id already flared, so it can be called on every render.
 * setBusy(true) makes the stars twinkle faster; it changes nothing in the DOM.
 *
 * What Home can rely on inside `container`:
 *   .night-sky                     the root; fills the container (absolute, inset 0)
 *   .night-sky--flat               no 2D canvas here: a CSS sky and CSS star dots stand in
 *   button.sky-star[data-work-id]  one per star, in reading order (group, then top to bottom)
 *   .sky-star.is-flared            the flared star; at most one
 *   --sky-x0, --sky-x1             on the root: the stars' least and greatest x, in
 *                                  percent (unitless), to fit the sky to a band
 *
 * The canvas is decoration only (aria-hidden, no pointer events); the buttons
 * carry every name and action, so the page works without it. Discipline as in
 * src/vendor/syber/syber-atmosphere.js: the frame loop holds while the tab is
 * hidden or the sky is off-screen, reduced motion gets one still frame, and a
 * machine whose frames cost too much (a software rasteriser) drops to a still
 * frame too. stop() releases everything that costs anything.
 */
import './night-sky.css';

const SPECTRUM = ['#90d8f0', '#4890f0', '#9a6bff', '#ff58d6', '#ffb54a'];
const RINGS = [[22, '#90d8f0'], [40, '#9a6bff'], [62, '#ff58d6'], [88, '#ffb54a']];
const CLOUD = [-1.4, 1.6, 1.0, 0.7]; // the Clifford-style map of the mockup's cloud
const BURST = [1.7, 1.7, 0.6, 1.2];  // and of the burst at a flared star
const BURST_RADIUS = 120;
const FLARE_MS = 700;
const FRAME_MS = 32;    // a twinkle needs no more than about 30 frames a second
const SLOW_FRAME_MS = 24;
const DUST = 260;

const hash = (i, k, m) => ((Math.sin(i * k) * m) % 1 + 1) % 1;
const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function onIdle(callback) {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(callback, { timeout: 500 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(callback, 16);
  return () => clearTimeout(id);
}

/**
 * Trace an attractor into a w×h sprite, one CSS pixel per point, hue by angle,
 * each hit adding `alpha` of its colour (the mockup's additive fillRect, done in
 * a buffer so it is a few milliseconds instead of 300,000 canvas calls). A
 * generator: it yields every few thousand points so the work spreads over idle
 * time. Returns the canvas.
 */
function* traceCloud(w, h, [a, b, c, d], count, alpha) {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  const sum = new Float32Array(w * h * 3);
  const colors = SPECTRUM.map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) * alpha));
  const ex = 1 + Math.abs(c);
  const ey = 1 + Math.abs(d);
  let x = 0.1;
  let y = 0.1;
  for (let i = 0; i < count; i++) {
    const nx = Math.sin(a * y) + c * Math.cos(a * x);
    const ny = Math.sin(b * x) + d * Math.cos(b * y);
    x = nx;
    y = ny;
    const px = Math.floor((1 + x / ex) * w / 2);
    const py = Math.floor((1 + y / ey) * h / 2);
    if (px >= 0 && px < w && py >= 0 && py < h) {
      const color = colors[Math.min(4, Math.floor((Math.atan2(y, x) + Math.PI) / (2 * Math.PI) * 5))];
      const o = (py * w + px) * 3;
      sum[o] += color[0];
      sum[o + 1] += color[1];
      sum[o + 2] += color[2];
    }
    if (i % 20000 === 19999) yield;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(w, h);
  for (let o = 0, q = 0; o < sum.length; o += 3, q += 4) {
    if (!sum[o] && !sum[o + 1] && !sum[o + 2]) continue;
    image.data[q] = sum[o];
    image.data[q + 1] = sum[o + 1];
    image.data[q + 2] = sum[o + 2];
    image.data[q + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export class NightSky {
  constructor(container, { sky, onPick }) {
    this.stars = sky.stars;
    this.links = sky.links;
    this.still = prefersReducedMotion();
    this.running = false;
    this.destroyed = false;
    this.busy = false;
    this.onScreen = true;
    this.raf = 0;
    this.cancelBuild = null;
    this.building = null;
    this.cloud = null;
    this.cloudSize = null;
    this.burst = null;
    this.flaredId = null;
    this.flareIndex = -1;
    this.flareStart = 0;
    this.lastPaint = -Infinity;
    this.lastFrame = 0;
    this.phase = 0;
    this.slowFrames = 0;
    this.W = 0;
    this.H = 0;
    this.dpr = 1;

    const xs = this.stars.map(s => s.x);
    const ys = this.stars.map(s => s.y);
    this.bounds = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };

    this.root = document.createElement('div');
    this.root.className = 'night-sky';
    this.root.style.setProperty('--sky-x0', String(this.bounds.x0));
    this.root.style.setProperty('--sky-x1', String(this.bounds.x1));

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'night-sky__canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d');
    if (this.ctx) this.root.append(this.canvas);
    else this.root.classList.add('night-sky--flat');

    const groupLabels = document.createElement('div');
    groupLabels.className = 'night-sky__groups';
    groupLabels.setAttribute('aria-hidden', 'true');
    for (const group of sky.groups) {
      const label = document.createElement('span');
      label.className = 'sky-group';
      label.textContent = group.label;
      label.style.left = `${group.x}%`;
      label.style.top = `${group.y}%`;
      groupLabels.append(label);
    }

    const map = document.createElement('div');
    map.className = 'night-sky__stars';
    map.setAttribute('role', 'group');
    map.setAttribute('aria-label', 'The Library as a star map');
    const rank = new Map(sky.groups.map((group, i) => [group.id, i]));
    const order = (s) => rank.get(s.group) ?? sky.groups.length;
    this.buttons = new Map();
    const reading = [...this.stars].sort((p, q) => order(p) - order(q) || p.y - q.y || p.x - q.x);
    for (const star of reading) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = star.x > 75 ? 'sky-star sky-star--west' : 'sky-star';
      button.dataset.workId = star.workId;
      button.setAttribute('aria-label', `${star.title}, ${star.author}`);
      button.style.left = `${star.x}%`;
      button.style.top = `${star.y}%`;
      const label = document.createElement('span');
      label.className = 'sky-star__label';
      label.textContent = star.title;
      button.append(label);
      button.addEventListener('click', () => onPick?.(star.workId));
      this.buttons.set(star.workId, button);
      map.append(button);
    }

    this.root.append(groupLabels, map);
    container.append(this.root);

    this.frame = this.frame.bind(this);
    this.onVisibility = () => { this.lastFrame = 0; this.go(); };
  }

  start() {
    if (this.destroyed || this.running) return;
    this.running = true;
    if (!this.ctx) return;
    document.addEventListener('visibilitychange', this.onVisibility);
    if (typeof IntersectionObserver === 'function') {
      this.io = new IntersectionObserver(([entry]) => {
        this.onScreen = entry.isIntersecting;
        this.lastFrame = 0;
        this.go();
      });
      this.io.observe(this.root);
    }
    if (typeof ResizeObserver === 'function') {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.root);
    }
    this.resize();
    if (this.still) this.paint(performance.now());
    else this.go();
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.cancelBuild?.();
    this.cancelBuild = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.io?.disconnect();
    this.ro?.disconnect();
    this.io = this.ro = null;
  }

  flare(workId) {
    if (this.destroyed || workId === this.flaredId) return;
    this.flaredId = workId;
    this.flareIndex = workId == null ? -1 : this.stars.findIndex(s => s.workId === workId);
    this.flareStart = performance.now();
    for (const [id, button] of this.buttons) button.classList.toggle('is-flared', id === workId);
    if (this.running && this.ctx && this.still) this.paint(this.flareStart);
  }

  setBusy(busy) {
    if (this.destroyed) return;
    this.busy = !!busy;
  }

  destroy() {
    if (this.destroyed) return;
    this.stop();
    this.destroyed = true;
    this.building = null;
    this.cloud = this.burst = null;
    this.canvas.width = this.canvas.height = 0;
    this.root.remove();
    this.buttons.clear();
  }

  /** The canvas follows the root's size at no more than two device pixels per CSS pixel. */
  resize() {
    if (!this.running) return;
    const W = Math.max(1, this.root.clientWidth);
    const H = Math.max(1, this.root.clientHeight);
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    if (W !== this.W || H !== this.H || dpr !== this.dpr) {
      this.W = W;
      this.H = H;
      this.dpr = dpr;
      this.canvas.width = Math.round(W * dpr);
      this.canvas.height = Math.round(H * dpr);
      this.lastPaint = -Infinity;
      if (this.still) this.paint(performance.now());
    }
    this.build();
  }

  /** The cloud sits over the stars: centred on them, a little wider than they spread. */
  cloudBox() {
    const { x0, x1, y0, y1 } = this.bounds;
    return {
      cx: (x0 + x1) / 200 * this.W,
      cy: (y0 + y1) / 200 * this.H,
      rx: Math.max(60, (x1 - x0) / 200 * this.W * 1.05),
      ry: Math.max(60, (y1 - y0) / 200 * this.H * 1.1)
    };
  }

  /**
   * Pre-render the cloud (once per size, within 10%) and the burst (once) in
   * idle time, one at a time. A stale cloud is drawn stretched until its
   * successor is ready.
   */
  build() {
    if (!this.running || this.cancelBuild) return;
    if (!this.building) {
      const { rx, ry } = this.cloudBox();
      const near = (p, q) => Math.abs(p - q) <= q * 0.1;
      if (!this.cloudSize || !near(rx, this.cloudSize.rx) || !near(ry, this.cloudSize.ry)) {
        this.building = {
          job: traceCloud(rx * 2, ry * 2, CLOUD, 300000, 0.035),
          done: canvas => { this.cloud = canvas; this.cloudSize = { rx, ry }; }
        };
      } else if (!this.burst) {
        this.building = {
          job: traceCloud(BURST_RADIUS * 2, BURST_RADIUS * 2, BURST, 120000, 0.09),
          done: canvas => { this.burst = canvas; }
        };
      } else {
        return;
      }
    }
    this.cancelBuild = onIdle(deadline => {
      this.cancelBuild = null;
      const task = this.building;
      let step;
      do step = task.job.next();
      while (!step.done && deadline?.timeRemaining?.() > 4);
      if (step.done) {
        this.building = null;
        task.done(step.value);
        if (this.still) this.paint(performance.now());
      }
      this.build();
    });
  }

  go() {
    if (this.running && !this.still && !this.raf && this.onScreen && !document.hidden) {
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  frame(now) {
    this.raf = 0;
    if (!this.running || !this.onScreen || document.hidden) return;
    if (now - this.lastPaint >= FRAME_MS) {
      const dt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0;
      this.lastFrame = now;
      this.phase += dt * (this.busy ? 4 : 1);
      const began = performance.now();
      this.paint(now);
      // A software rasteriser: five costly frames in a row and the sky holds still.
      if (performance.now() - began <= SLOW_FRAME_MS) this.slowFrames = 0;
      else if (++this.slowFrames >= 5) {
        this.still = true;
        this.paint(now);
        return;
      }
    }
    this.go();
  }

  paint(now) {
    const { ctx, W, H, dpr } = this;
    this.lastPaint = now;
    const flared = this.flareIndex >= 0;
    const eased = this.still ? 1 : 1 - (1 - Math.min(1, Math.max(0, (now - this.flareStart) / FLARE_MS))) ** 3;
    const p = flared ? eased : 0;
    const pt = s => [s.x / 100 * W, s.y / 100 * H];

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);

    for (let level = 0; level < 5; level++) {
      ctx.fillStyle = `rgba(223,226,251,${0.15 + level * 0.08})`;
      for (let i = level; i < DUST; i += 5) ctx.fillRect(hash(i, 12.9898, 43758.5453) * W, hash(i, 78.233, 12543.123) * H, 1, 1);
    }

    if (this.cloud) {
      const { cx, cy, rx, ry } = this.cloudBox();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - 0.43 * p;
      ctx.translate(cx, cy);
      ctx.rotate(this.still ? 0 : now / 1000 * 0.004); // one turn in about 26 minutes
      ctx.drawImage(this.cloud, -rx, -ry, rx * 2, ry * 2);
      ctx.restore();
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(170,180,255,${0.34 - 0.2 * p})`;
    ctx.beginPath();
    for (const [i, j] of this.links) {
      ctx.moveTo(...pt(this.stars[i]));
      ctx.lineTo(...pt(this.stars[j]));
    }
    ctx.stroke();

    this.stars.forEach((star, i) => {
      const [x, y] = pt(star);
      const base = i % 3 === 0 ? 1 : 0.75;
      const twinkle = this.still ? 1 : 0.82 + 0.18 * Math.sin(this.phase * (0.7 + hash(i, 3.7, 917.3) * 0.8) + i * 2.4);
      const bright = (i === this.flareIndex ? base : base + (0.4 - base) * p) * twinkle;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 10);
      glow.addColorStop(0, `rgba(238,240,255,${0.7 * bright})`);
      glow.addColorStop(1, 'rgba(238,240,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 10, y - 10, 20, 20);
      ctx.fillStyle = `rgba(238,240,255,${bright})`;
      ctx.beginPath();
      ctx.arc(x, y, i % 3 === 0 ? 2 : 1.4, 0, Math.PI * 2);
      ctx.fill();
    });

    const star = this.stars[this.flareIndex];
    if (!star || p <= 0) return;
    const [x, y] = pt(star);
    if (this.burst) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = p;
      ctx.drawImage(this.burst, x - BURST_RADIUS, y - BURST_RADIUS, BURST_RADIUS * 2, BURST_RADIUS * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    RINGS.forEach(([r, color], k) => {
      ctx.strokeStyle = color;
      ctx.globalAlpha = (0.55 - k * 0.11) * p;
      ctx.beginPath();
      ctx.arc(x, y, r * (0.6 + 0.4 * p), 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = p;
    const core = ctx.createRadialGradient(x, y, 0, x, y, 26);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(0.3, 'rgba(255,214,250,.6)');
    core.addColorStop(1, 'rgba(154,107,255,0)');
    ctx.fillStyle = core;
    ctx.fillRect(x - 26, y - 26, 52, 52);
    ctx.globalAlpha = 1;
  }
}
