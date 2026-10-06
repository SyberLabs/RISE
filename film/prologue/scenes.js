/**
 * The animated prologue, drawn in code: paper-cut silhouettes, pages, letters
 * and light on a 1920×1080 canvas. Every shot is a pure function of time, so
 * animatic.mjs can paint it frame by frame at an exact clock.
 *
 * window.drawFrame(shotId, t, seconds) paints shot `shotId` at `t` seconds of
 * its `seconds` length into #stage.
 *
 * Palette: void #080d16 · teal #6e9397 · amber #f5b687 · paper #e8dec4 · ember #ff7a3d.
 */
(() => {
  const W = 1920, H = 1080;
  const canvas = document.getElementById('stage');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const TAU = Math.PI * 2;
  const VOID = '#080d16', TEAL = '#6e9397', AMBER = '#f5b687', PAPER = '#e8dec4', EMBER = '#ff7a3d', INK = '#03060b';
  const SERIF = '"Instrument Serif", "Crimson Pro", Georgia, serif';
  const BOOK = '"Crimson Pro", Georgia, serif';

  // Deterministic randomness per shot.
  let seed = 1;
  const srand = s => { seed = s * 9301 + 49297; };
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, x) => a + (b - a) * x;
  const mix = (c1, c2, x) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const a = p(c1), b = p(c2);
    return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], clamp(x)))).join(',')})`; };

  const MEDITATIONS = ('Begin the morning by saying to thyself I shall meet with the busybody the ungrateful arrogant deceitful envious unsocial '
    + 'All these things happen to them by reason of their ignorance of what is good and evil But I who have seen the nature of the good that it is '
    + 'beautiful and of the bad that it is ugly and the nature of him who does wrong that it is akin to me not only of the same blood or seed but that '
    + 'it participates in the same intelligence and the same portion of the divinity I can neither be injured by any of them for no one can fix on me '
    + 'what is ugly nor can I be angry with my kinsman nor hate him For we are made for cooperation like feet like hands like eyelids like the rows of '
    + 'the upper and lower teeth').split(' ');
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz&?!.,;';

  /* ─────────────────────────── shared drawing ─────────────────────────── */

  function back(top = '#0b1420', bottom = VOID) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function glow(x, y, r, color, alpha = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
  }
  function vignette(strength = 0.75) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // Grain: a pre-drawn noise tile offset per frame.
  const grainTile = document.createElement('canvas'); grainTile.width = 512; grainTile.height = 512;
  { const g = grainTile.getContext('2d'); const img = g.createImageData(512, 512); let s = 4242;
    for (let i = 0; i < img.data.length; i += 4) { s = (s * 16807) % 2147483647; const v = 110 + (s / 2147483647) * 80; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0); }
  function grain(t, alpha = 0.06) {
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = alpha;
    const ox = Math.floor((t * 977) % 512), oy = Math.floor((t * 641) % 512);
    for (let y = -oy; y < H; y += 512) for (let x = -ox; x < W; x += 512) ctx.drawImage(grainTile, x, y);
    ctx.restore();
  }
  function finish(t, v = 0.7) { vignette(v); grain(t); }

  /** A paper-cut person. `pose`: 'sit' | 'stand' | 'crouch' | 'fall' | 'back'. */
  function figure({ x, y, h = 300, pose = 'stand', dir = 1, who = 'ines', alpha = 1, rot = 0, lit = 0 }) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(dir, 1); ctx.globalAlpha = alpha;
    const u = h / 300; ctx.scale(u, u);
    ctx.fillStyle = INK; ctx.strokeStyle = INK;
    const head = who === 'teo' ? 26 : 28;
    if (pose === 'sit') {
      // Seated: torso upright, legs out in front.
      ctx.beginPath(); ctx.roundRect(-34, -150, 68, 130, 26); ctx.fill();          // torso
      ctx.beginPath(); ctx.roundRect(-30, -30, 120, 30, 12); ctx.fill();            // thighs
      ctx.beginPath(); ctx.arc(0, -180, head, 0, TAU); ctx.fill();                  // head
    } else if (pose === 'crouch') {
      ctx.beginPath(); ctx.roundRect(-38, -120, 76, 100, 30); ctx.fill();
      ctx.beginPath(); ctx.roundRect(-44, -30, 88, 30, 12); ctx.fill();
      ctx.beginPath(); ctx.arc(8, -150, head, 0, TAU); ctx.fill();
    } else if (pose === 'fall') {
      ctx.beginPath(); ctx.roundRect(-30, -150, 60, 150, 26); ctx.fill();
      ctx.beginPath(); ctx.roundRect(-70, -140, 50, 18, 9); ctx.fill();             // arm out
      ctx.beginPath(); ctx.roundRect(20, -120, 60, 18, 9); ctx.fill();
      ctx.beginPath(); ctx.roundRect(-34, -10, 26, 90, 10); ctx.fill();             // legs
      ctx.beginPath(); ctx.roundRect(10, -10, 26, 80, 10); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -180, head, 0, TAU); ctx.fill();
    } else {
      // Standing, or seen from the back.
      ctx.beginPath(); ctx.roundRect(-32, -250, 64, 150, 26); ctx.fill();
      ctx.beginPath(); ctx.roundRect(-30, -110, 24, 110, 10); ctx.fill();
      ctx.beginPath(); ctx.roundRect(6, -110, 24, 110, 10); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -280, head, 0, TAU); ctx.fill();
    }
    const hy = pose === 'sit' ? -180 : pose === 'crouch' ? -150 : -280;
    const hx = pose === 'crouch' ? 8 : 0;
    if (who === 'ines') {
      // Curls tied up: a bun.
      ctx.beginPath(); ctx.arc(hx - 10, hy - head + 2, 14, 0, TAU); ctx.fill();
      // The amber jacket: an edge of light on the torso.
      ctx.strokeStyle = AMBER; ctx.lineWidth = 2.5; ctx.globalAlpha = alpha * (0.5 + 0.5 * lit);
      ctx.beginPath(); ctx.moveTo(-30, hy + head + 10); ctx.lineTo(-30, hy + head + 110); ctx.stroke();
      ctx.globalAlpha = alpha;
    } else {
      // Headphones round the neck, round glasses.
      ctx.strokeStyle = TEAL; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(hx, hy + head + 14, 22, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.globalAlpha = alpha * 0.9;
      ctx.beginPath(); ctx.arc(hx + 8, hy - 2, 7, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(hx + 24, hy - 2, 7, 0, TAU); ctx.stroke();
      ctx.globalAlpha = alpha;
    }
    ctx.restore();
  }

  /** The lantern-book: a small open book that glows from inside. */
  function book(x, y, size = 36, strength = 1, tilt = 0) {
    glow(x, y, size * 7, 'rgba(245,182,135,0.55)', 0.9 * strength);
    glow(x, y, size * 2.2, 'rgba(255,240,210,0.9)', strength);
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    ctx.fillStyle = '#fff3dc'; ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.moveTo(-size, 0); ctx.quadraticCurveTo(-size / 2, -size * 0.35, 0, 0); ctx.quadraticCurveTo(size / 2, -size * 0.35, size, 0);
    ctx.lineTo(size, size * 0.5); ctx.quadraticCurveTo(size / 2, size * 0.2, 0, size * 0.5); ctx.quadraticCurveTo(-size / 2, size * 0.2, -size, size * 0.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /** A page of a book: paper with lines of type. */
  function page(x, y, w, h, rot, alpha, text = null) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
    ctx.fillStyle = PAPER; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = '#4a4238';
    if (text) { ctx.font = `${Math.max(6, h * 0.07)}px ${BOOK}`; ctx.textAlign = 'left';
      for (let i = 0; i < 6; i += 1) ctx.fillText(text[i % text.length], -w / 2 + w * 0.1, -h / 2 + h * 0.2 + i * h * 0.12, w * 0.8); }
    else for (let i = 0; i < 7; i += 1) { ctx.globalAlpha = alpha * 0.55; ctx.fillRect(-w / 2 + w * 0.12, -h / 2 + h * 0.18 + i * h * 0.1, w * (0.5 + 0.26 * ((i * 7) % 3)), Math.max(1, h * 0.025)); }
    ctx.restore();
  }

  function starfield(t, n = 260, drift = 0.002) {
    srand(55);
    for (let i = 0; i < n; i += 1) {
      const x = ((rnd() + t * drift * (0.3 + rnd())) % 1) * W, y = rnd() * H, s = rnd();
      ctx.fillStyle = s > 0.9 ? AMBER : s > 0.6 ? '#bad7d1' : '#6e8aa0'; ctx.globalAlpha = 0.25 + 0.6 * rnd() * (0.7 + 0.3 * Math.sin(t * 2 + i));
      ctx.fillRect(x, y, s > 0.85 ? 3 : 2, s > 0.85 ? 3 : 2);
    }
    ctx.globalAlpha = 1;
  }

  /** The phoenix as a path in a 1000×600 box, centred, facing right. */
  function phoenixPath() {
    const p = new Path2D();
    // Body and head.
    p.moveTo(-60, 40); p.bezierCurveTo(-40, -60, 60, -70, 120, -20);
    p.bezierCurveTo(150, 0, 170, -30, 190, -40); p.lineTo(250, -52); p.lineTo(200, -22);   // beak
    p.bezierCurveTo(180, 20, 120, 60, 40, 70); p.bezierCurveTo(-20, 80, -60, 60, -60, 40);
    // Upper wing.
    p.moveTo(0, -30); p.bezierCurveTo(-80, -220, -260, -300, -480, -260);
    p.bezierCurveTo(-400, -230, -360, -200, -330, -170); p.bezierCurveTo(-380, -160, -420, -130, -450, -90);
    p.bezierCurveTo(-370, -100, -320, -90, -280, -70); p.bezierCurveTo(-330, -40, -350, 0, -340, 40);
    p.bezierCurveTo(-260, -20, -140, -20, 0, 10); p.closePath();
    // Lower wing.
    p.moveTo(-20, 50); p.bezierCurveTo(-120, 80, -260, 160, -420, 240);
    p.bezierCurveTo(-330, 230, -300, 200, -250, 190); p.bezierCurveTo(-270, 230, -260, 260, -240, 290);
    p.bezierCurveTo(-180, 220, -120, 170, -40, 120); p.closePath();
    // Tail plumes.
    for (const [dx, dy, len] of [[0, 0, 1], [0, 30, 0.85], [0, -24, 0.9]]) {
      p.moveTo(-50 + dx, 50 + dy); p.bezierCurveTo(-200 * len + dx, 120 * len + dy, -420 * len + dx, 80 * len + dy, -520 * len + dx, 220 * len + dy);
      p.bezierCurveTo(-400 * len + dx, 160 * len + dy, -250 * len + dx, 160 * len + dy, -60 + dx, 80 + dy); p.closePath();
    }
    return p;
  }
  const PHOENIX = phoenixPath();
  // Sample points over the phoenix for the letters to gather on.
  const phoenixPoints = (() => {
    const off = document.createElement('canvas'); off.width = 1000; off.height = 700; const g = off.getContext('2d');
    g.translate(600, 330); g.fillStyle = '#fff'; g.fill(PHOENIX);
    const img = g.getImageData(0, 0, 1000, 700).data; const pts = []; let s = 77;
    for (let i = 0; i < 6000; i += 1) { s = (s * 16807) % 2147483647; const x = Math.floor((s / 2147483647) * 1000); s = (s * 16807) % 2147483647; const y = Math.floor((s / 2147483647) * 700);
      if (img[(y * 1000 + x) * 4 + 3] > 128) pts.push([x - 600, y - 330]); }
    return pts;
  })();

  function phoenix(x, y, scale, t, { heat = 1, alpha = 1, flip = false, rot = 0 } = {}) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(flip ? -scale : scale, scale); ctx.globalAlpha = alpha;
    // Wingbeat: a gentle vertical shear.
    const beat = Math.sin(t * 2.4) * 0.08; ctx.transform(1, 0, 0, 1 + beat, 0, 0);
    ctx.shadowColor = `rgba(255,122,61,${0.9 * heat})`; ctx.shadowBlur = 60;
    const g = ctx.createLinearGradient(-500, 0, 250, 0); g.addColorStop(0, mix(TEAL, EMBER, heat)); g.addColorStop(0.55, mix(TEAL, AMBER, heat)); g.addColorStop(1, mix('#bad7d1', '#fff1d6', heat));
    ctx.fillStyle = g; ctx.fill(PHOENIX);
    ctx.shadowBlur = 0;
    // Eye: a reading lamp.
    ctx.fillStyle = '#fff8e8'; ctx.beginPath(); ctx.arc(150, -32, 8, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function text(str, x, y, size, color, { align = 'center', font = SERIF, alpha = 1, italic = false, spacing = 0 } = {}) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.font = `${italic ? 'italic ' : ''}${size}px ${font}`; if (spacing) ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(str, x, y); ctx.restore();
  }

  /* ──────────────────────────────── shots ──────────────────────────────── */

  const SHOTS = {
    /** A bedroom at night, books everywhere. Pages lift. Slow push on Ines. */
    '1.1'(t, dur) {
      const p = t / dur;
      back('#0a1018', '#05080e');
      ctx.save();
      const z = 1 + 0.18 * ease(p); ctx.translate(W * 0.42, H * 0.62); ctx.scale(z, z); ctx.translate(-W * 0.42, -H * 0.62);
      // Lamp.
      glow(1500, 220, 520, 'rgba(245,182,135,0.35)', lerp(1, 0.45, ease((p - 0.5) * 2)));
      glow(1500, 220, 520, 'rgba(110,147,151,0.4)', ease((p - 0.5) * 2) * 0.9);
      ctx.fillStyle = INK; ctx.fillRect(1490, 240, 14, 400); ctx.beginPath(); ctx.moveTo(1420, 240); ctx.lineTo(1580, 240); ctx.lineTo(1540, 150); ctx.lineTo(1460, 150); ctx.closePath(); ctx.fill();
      // Floor and bed.
      ctx.fillStyle = '#060a10'; ctx.fillRect(0, 760, W, 320);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(260, 640, 900, 180, 24); ctx.fill();
      ctx.fillStyle = '#131a24'; ctx.beginPath(); ctx.roundRect(300, 600, 820, 70, 20); ctx.fill();
      // Book stacks.
      srand(11);
      for (let s = 0; s < 14; s += 1) { const bx = 40 + s * 135 + rnd() * 30, n = 3 + Math.floor(rnd() * 7);
        for (let i = 0; i < n; i += 1) { ctx.fillStyle = i % 2 ? '#0e141c' : INK; const bw = 90 + rnd() * 60; ctx.fillRect(bx - bw / 2 + rnd() * 10, 760 - i * 22, bw, 20); } }
      // Armchair with Teo.
      ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(1240, 520, 360, 260, 40); ctx.fill();
      figure({ x: 1420, y: 780, h: 250, pose: 'sit', dir: -1, who: 'teo', alpha: 1 });
      // Ines reading in bed, the lantern-book.
      figure({ x: 700, y: 640, h: 290, pose: 'sit', dir: 1, who: 'ines', lit: 1 });
      book(770, 600, 32, 1, 0.1);
      // Pages lifting: more and higher as the shot goes.
      srand(23);
      const count = Math.floor(lerp(0, 70, ease((p - 0.1) / 0.9)));
      for (let i = 0; i < 70; i += 1) {
        const bx = 60 + rnd() * 1800, start = rnd() * 0.8, speed = 60 + rnd() * 120, w = 44 + rnd() * 40, rot0 = rnd() * TAU, spin = (rnd() - 0.5) * 1.5;
        if (i >= count) continue;
        const life = Math.max(0, t - start * dur * 0.9);
        const y = 760 - life * speed, x = bx + Math.sin(life * 0.8 + rot0) * 40;
        if (y < -100) continue;
        page(x, y, w, w * 1.4, rot0 * 0.2 + life * spin * 0.3, clamp(life * 2) * 0.9);
      }
      ctx.restore();
      finish(t, 0.8);
    },

    /** The floor opens into a spiral of pages; ink lifts into ribbons; they fall. */
    '1.2'(t, dur) {
      const p = t / dur;
      back('#070b12', VOID);
      // Tilt down: the room slides up and away in the first third.
      const tilt = ease(p / 0.35);
      ctx.save(); ctx.translate(0, -tilt * 900);
      ctx.fillStyle = '#060a10'; ctx.fillRect(0, 760, W, 320);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(260, 640, 900, 180, 24); ctx.fill();
      ctx.restore();
      // The vortex: a logarithmic spiral of pages turning into the centre.
      const cx = W / 2, cy = H * 0.55 + (1 - tilt) * 600;
      const open = ease((p - 0.15) / 0.5);
      glow(cx, cy, 700 * open, 'rgba(110,147,151,0.35)', open);
      glow(cx, cy, 260 * open, 'rgba(245,182,135,0.5)', open);
      srand(31);
      const spin = t * 0.9;
      for (let i = 0; i < 160; i += 1) {
        const a0 = rnd() * TAU, r0 = 120 + rnd() * 900, w = 30 + rnd() * 50, k = 0.6 + rnd() * 0.5;
        const r = r0 * (1 - 0.35 * open) - ((t * 90 * k) % (r0 + 200)) * open; if (r < 10) continue;
        const a = a0 + spin * (1 + 400 / (r + 60)) + Math.log(r + 1) * 1.6;
        const x = cx + Math.cos(a) * r * 1.5, y = cy + Math.sin(a) * r * 0.75;
        const s = clamp(r / 700, 0.25, 1);
        page(x, y, w * s, w * 1.4 * s, a + Math.PI / 2, open * clamp(r / 160) * 0.9);
      }
      // Ink ribbons.
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 3;
      srand(41);
      for (let i = 0; i < 18; i += 1) {
        const a0 = rnd() * TAU, len = 0.9 + rnd() * 1.2, col = i % 3 ? TEAL : AMBER; ctx.strokeStyle = col; ctx.globalAlpha = open * 0.55;
        ctx.beginPath();
        for (let s = 0; s <= 40; s += 1) { const f = s / 40; const r = 40 + f * 900 * len * (1 - 0.3 * open); const a = a0 + spin * 0.8 + f * 3.2 + Math.sin(t + i) * 0.2;
          const x = cx + Math.cos(a) * r * 1.5, y = cy + Math.sin(a) * r * 0.75; if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.restore();
      // Ines grabs Teo's sleeve; both fall, shrinking into the centre.
      const fall = ease((p - 0.45) / 0.5);
      const fx = lerp(760, cx, fall), fy = lerp(560 - tilt * 500, cy, fall), fs = lerp(1, 0.12, fall), rot = fall * 5;
      figure({ x: fx, y: fy, h: 300 * fs, pose: fall > 0.05 ? 'fall' : 'stand', who: 'ines', rot: rot, lit: 1 });
      figure({ x: fx + 90 * fs, y: fy - 20 * fs, h: 330 * fs, pose: fall > 0.05 ? 'fall' : 'stand', who: 'teo', rot: rot * 1.2 });
      book(fx + 36 * fs, fy - 120 * fs, 26 * fs, 1);
      finish(t, 0.7);
    },

    /** The letters catch fire and gather into the Phoenix. Two small figures below. */
    '2.1'(t, dur) {
      const p = t / dur;
      back('#06090f', VOID);
      const gather = ease((p - 0.15) / 0.6), heat = ease((p - 0.35) / 0.5);
      const px = W / 2 + 80, py = H * 0.42, ps = 1.25;
      glow(px, py, 900, `rgba(255,122,61,${0.25 * heat})`, 1);
      if (heat > 0.6) phoenix(px, py, ps, t, { heat, alpha: (heat - 0.6) / 0.4 * 0.9 });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      srand(51);
      for (let i = 0; i < 1400; i += 1) {
        const target = phoenixPoints[i % phoenixPoints.length];
        const x0 = rnd() * W, y0 = rnd() * H, ch = LETTERS[Math.floor(rnd() * LETTERS.length)], size = 16 + rnd() * 22, ph = rnd() * TAU;
        // Before they gather, the letters still ride the vortex: a slow turn about the centre.
        const ang = t * 0.25 + ph * 0.1, cxv = W / 2, cyv = H / 2;
        const rx = (x0 - cxv) * Math.cos(ang) - (y0 - cyv) * Math.sin(ang) * 0.6, ry = (x0 - cxv) * Math.sin(ang) * 0.6 + (y0 - cyv) * Math.cos(ang);
        const g = clamp(gather * 1.4 - (i / 1400) * 0.4);
        const x = lerp(cxv + rx, px + target[0] * ps + Math.sin(t * 3 + ph) * 4, g);
        const y = lerp(cyv + ry, py + target[1] * ps + Math.cos(t * 3 + ph) * 4, g);
        const col = mix(mix('#9fc7c8', AMBER, g), '#fff6e2', heat * g);
        ctx.fillStyle = col; ctx.globalAlpha = (0.7 + 0.3 * g) * (1 - heat * g * 0.6) * (0.6 + 0.4 * Math.sin(t * 2 + ph));
        ctx.font = `${size}px ${BOOK}`; ctx.fillText(ch, x, y);
      }
      // Embers falling from the wings, burning into letters.
      if (heat > 0) for (let i = 0; i < 160; i += 1) {
        const ph = rnd() * TAU, life = ((t * 0.5 + rnd()) % 1); const src = phoenixPoints[(i * 37) % phoenixPoints.length];
        const x = px + src[0] * ps + Math.sin(ph + life * 4) * 30, y = py + src[1] * ps + life * 260;
        ctx.fillStyle = mix(EMBER, TEAL, life); ctx.globalAlpha = heat * (1 - life); ctx.font = `${12 + life * 10}px ${BOOK}`; ctx.fillText(LETTERS[i % LETTERS.length], x, y);
      }
      ctx.restore();
      // Low angle: two small figures looking up.
      figure({ x: 820, y: 1040, h: 150, who: 'ines', lit: 1 }); figure({ x: 900, y: 1040, h: 165, who: 'teo', dir: -1 });
      book(846, 950, 12, 0.8);
      finish(t, 0.65);
    },

    /** It turns. Eyes like two reading lamps, then banks away leaving a spiral of type. */
    '2.2'(t, dur) {
      const p = t / dur;
      back('#06090f', VOID);
      const turn = ease((p - 0.25) / 0.35), away = ease((p - 0.55) / 0.45);
      const px = lerp(W / 2, W * 0.78, away), py = lerp(H * 0.5, H * 0.3, away), ps = lerp(1.5, 0.7, away);
      glow(px, py, 1000, 'rgba(255,122,61,0.28)', 1 - away * 0.5);
      // Trail of glowing type along a spiral behind it.
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; srand(61);
      for (let i = 0; i < 700; i += 1) {
        const f = rnd(), ph = rnd() * TAU; const back_ = f * (0.6 + away * 1.4);
        const a = t * 1.1 + f * 7, r = 60 + f * 760;
        const x = px - away * 700 * f + Math.cos(a) * r * 0.5 * f - (1 - away) * 300 * f, y = py + Math.sin(a) * r * 0.35 * f + f * 120;
        ctx.fillStyle = mix(AMBER, TEAL, f); ctx.globalAlpha = (1 - f) * 0.9 * clamp(p * 3); ctx.font = `${10 + (1 - f) * 22}px ${BOOK}`;
        ctx.fillText(LETTERS[i % LETTERS.length], x, y + Math.sin(t * 2 + ph) * 8);
      }
      ctx.restore();
      // Head turn: scale the whole bird through a flip so it faces camera at the midpoint.
      const flip = Math.cos(turn * Math.PI);
      ctx.save(); ctx.translate(px, py); ctx.scale(Math.max(0.18, Math.abs(flip)), 1); ctx.translate(-px, -py);
      phoenix(px, py, ps, t, { heat: 1, flip: flip < 0, rot: -away * 0.4 });
      ctx.restore();
      // At the midpoint the eyes face us: two lamps.
      const face = 1 - Math.abs(flip);
      if (face > 0.3) { for (const dx of [-60, 60]) { glow(px + dx * ps, py - 40 * ps, 120 * ps, 'rgba(255,248,232,0.9)', face); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px + dx * ps, py - 40 * ps, 10 * ps, 0, TAU); ctx.fill(); } }
      finish(t, 0.6);
    },

    /** They ride the trail; the vortex thins into night; far below, SyberLabs. */
    '2.3'(t, dur) {
      const p = t / dur;
      back('#05080e', '#0b1826');
      starfield(t, 300, 0.01);
      // The laboratory campus far below: a perspective grid of teal lights on a dark coast.
      const horizon = lerp(H * 1.05, H * 0.62, ease(p / 0.7));
      ctx.save();
      const sea = ctx.createLinearGradient(0, horizon, 0, H); sea.addColorStop(0, '#0a1a24'); sea.addColorStop(1, '#04080c'); ctx.fillStyle = sea; ctx.fillRect(0, horizon, W, H - horizon);
      srand(71);
      for (let i = 0; i < 900; i += 1) {
        const gx = (rnd() - 0.5) * 2, gz = rnd(); const z = 0.08 + gz * 0.92; const sx = W / 2 + gx * W * 1.6 / z * 0.35, sy = horizon + (H - horizon) * 0.1 / z;
        if (sy > H || Math.abs(gx) > 0.9) continue;
        const big = rnd() > 0.92; ctx.fillStyle = big ? AMBER : TEAL; ctx.globalAlpha = (0.35 + 0.65 * rnd()) * (0.4 + 0.6 * Math.min(1, 1 / z * 0.4)) * ease((p - 0.2) / 0.5);
        const s = Math.max(1, 6 / z * 0.3); ctx.fillRect(sx, sy, s * (big ? 2.5 : 1), s);
      }
      ctx.globalAlpha = 1;
      // A long low building catching light: the lab.
      const lab = ease((p - 0.45) / 0.4); ctx.globalAlpha = lab;
      ctx.fillStyle = '#0d2330'; ctx.fillRect(W * 0.3, horizon + 40, W * 0.4, 30); ctx.fillStyle = TEAL; for (let i = 0; i < 60; i += 1) ctx.fillRect(W * 0.3 + i * (W * 0.4 / 60) + 2, horizon + 48, 4, 14);
      ctx.globalAlpha = 1; ctx.restore();
      // Clouds, parallax.
      srand(81); ctx.save();
      for (let i = 0; i < 14; i += 1) { const cx = ((rnd() + t * (0.01 + 0.02 * rnd())) % 1.2 - 0.1) * W, cy = horizon - 60 - rnd() * 500, cw = 300 + rnd() * 500;
        glow(cx, cy, cw, 'rgba(120,150,170,0.12)', 0.8); }
      ctx.restore();
      // The Phoenix ahead, the two carried in its wake.
      const px = lerp(W * 0.85, W * 0.6, ease(p)), py = lerp(H * 0.25, H * 0.4, ease(p)), ps = lerp(0.5, 0.42, p);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; srand(91);
      for (let i = 0; i < 500; i += 1) { const f = rnd(); const x = px - f * 1100 + Math.sin(t * 1.5 + f * 9) * 20, y = py + f * 160 + Math.sin(t * 2 + f * 20) * 30 * f;
        ctx.fillStyle = mix(AMBER, TEAL, f); ctx.globalAlpha = (1 - f) * 0.8; ctx.font = `${8 + (1 - f) * 16}px ${BOOK}`; ctx.fillText(LETTERS[i % LETTERS.length], x, y); }
      ctx.restore();
      phoenix(px, py, ps, t, { heat: 1 });
      const rx = px - 420, ry = py + 90;
      figure({ x: rx, y: ry, h: 120, pose: 'fall', who: 'ines', rot: -0.5, lit: 1 }); figure({ x: rx + 70, y: ry + 10, h: 130, pose: 'fall', who: 'teo', rot: -0.6 });
      book(rx + 10, ry - 60, 10, 0.9);
      finish(t, 0.6);
    },

    /** Arrival: a rooftop pad in rain and teal floodlight; the Phoenix dissolves to one ember. */
    '3.1'(t, dur) {
      const p = t / dur;
      back('#06090f', '#0a141c');
      // Floor grid in perspective.
      const horizon = H * 0.5;
      ctx.save(); ctx.strokeStyle = 'rgba(110,147,151,0.25)'; ctx.lineWidth = 1;
      for (let i = -12; i <= 12; i += 1) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 60, horizon); ctx.lineTo(W / 2 + i * 600, H); ctx.stroke(); }
      for (let i = 1; i < 14; i += 1) { const y = horizon + (H - horizon) * (i * i) / 196; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.restore();
      // The pad: a lit circle.
      ctx.save(); ctx.translate(W / 2, H * 0.78); ctx.scale(1, 0.32);
      ctx.strokeStyle = AMBER; ctx.lineWidth = 6; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 2); ctx.beginPath(); ctx.arc(0, 0, 420, 0, TAU); ctx.stroke();
      ctx.restore();
      // Floodlight cones.
      for (const [lx, dir] of [[120, 1], [W - 120, -1]]) { ctx.save(); ctx.globalAlpha = 0.18; const g = ctx.createLinearGradient(lx, 120, lx + dir * 700, H); g.addColorStop(0, 'rgba(110,147,151,0.9)'); g.addColorStop(1, 'rgba(110,147,151,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lx, 120); ctx.lineTo(lx + dir * 900, H); ctx.lineTo(lx + dir * 200, H); ctx.closePath(); ctx.fill(); ctx.restore(); }
      // The service door, right.
      ctx.fillStyle = '#0d1a22'; ctx.fillRect(W - 420, 300, 180, 320); ctx.strokeStyle = TEAL; ctx.lineWidth = 2; ctx.strokeRect(W - 420, 300, 180, 320);
      ctx.fillStyle = AMBER; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3); ctx.fillRect(W - 300, 430, 8, 8); ctx.globalAlpha = 1;
      // The Phoenix lands, then dissolves.
      const land = ease(p / 0.4), gone = ease((p - 0.45) / 0.3), ember = ease((p - 0.65) / 0.35);
      const px = lerp(W * 0.3, W / 2 + 40, land), py = lerp(H * 0.15, H * 0.5, land);
      if (gone < 1) phoenix(px, py, lerp(0.9, 0.75, land), t, { heat: 1 - gone * 0.5, alpha: 1 - gone });
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; srand(101);
      for (let i = 0; i < 500; i += 1) { if (gone <= 0) break; const src = phoenixPoints[(i * 13) % phoenixPoints.length]; const f = clamp(gone * 1.3 - (i / 500) * 0.3);
        const ex = lerp(px + src[0] * 0.75, W - 300, ember), ey = lerp(py + src[1] * 0.75, 434, ember);
        const x = lerp(px + src[0] * 0.75, ex, f) + Math.sin(t * 2 + i) * 6 * (1 - ember), y = lerp(py + src[1] * 0.75, ey, f) + Math.cos(t * 2 + i) * 6 * (1 - ember);
        ctx.fillStyle = mix(AMBER, EMBER, f); ctx.globalAlpha = f * (1 - ember * 0.98 * (i > 3 ? 1 : 0)); ctx.font = `${9 + (1 - f) * 10}px ${BOOK}`; ctx.fillText(LETTERS[i % LETTERS.length], x, y); }
      ctx.restore();
      if (ember > 0.95) glow(W - 300, 434, 60, 'rgba(255,122,61,0.9)', 1);
      // The two, set down.
      figure({ x: W / 2 - 120, y: H * 0.8, h: 260, who: 'ines', lit: 0.6 }); figure({ x: W / 2 - 30, y: H * 0.8, h: 285, who: 'teo', dir: 1 });
      book(W / 2 - 100, H * 0.8 - 150, 18, 0.9);
      // Rain.
      ctx.save(); ctx.strokeStyle = 'rgba(186,215,209,0.25)'; ctx.lineWidth = 1; srand(111);
      for (let i = 0; i < 400; i += 1) { const x = rnd() * W, y = ((rnd() + t * (1.2 + rnd())) % 1) * H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 28); ctx.stroke(); }
      ctx.restore();
      finish(t, 0.7);
    },

    /** The freight elevator: floors slide past the cage, halls of instruments beyond. */
    '3.2'(t, dur) {
      const p = t / dur;
      back('#06090f', VOID);
      // Floors scrolling down (we go up).
      const floorH = 540, scroll = t * 260;
      srand(121);
      for (let f = -1; f < 5; f += 1) {
        const y = ((f * floorH - scroll) % (floorH * 4) + floorH * 4) % (floorH * 4) - floorH;
        // Hall: a lit band with instruments.
        const g = ctx.createLinearGradient(0, y, 0, y + floorH); g.addColorStop(0, '#0a1620'); g.addColorStop(0.5, '#0f2430'); g.addColorStop(1, '#070d14');
        ctx.fillStyle = g; ctx.fillRect(0, y, W, floorH);
        ctx.fillStyle = INK; ctx.fillRect(0, y + floorH - 40, W, 40);
        for (let i = 0; i < 16; i += 1) { const ix = 60 + i * 115, kind = (i + f) % 3;
          if (kind === 0) { ctx.strokeStyle = TEAL; ctx.lineWidth = 2; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(ix + 40, y + 300, 34, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(ix + 40, y + 300, 34, t * 2 + i, t * 2 + i + 1.2); ctx.lineWidth = 6; ctx.strokeStyle = AMBER; ctx.stroke(); }
          else if (kind === 1) { ctx.fillStyle = '#122a36'; ctx.fillRect(ix, y + 240, 80, 200); ctx.fillStyle = TEAL; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4 + i); ctx.fillRect(ix + 10, y + 260 + ((t * 120 + i * 30) % 160), 60, 6); }
          else { ctx.fillStyle = AMBER; ctx.globalAlpha = 0.25; ctx.fillRect(ix + 10, y + 420, 60, 20); ctx.globalAlpha = 0.9; for (let r = 0; r < 4; r += 1) ctx.fillRect(ix + 14 + r * 15, y + 380 - ((t * 60 + r * 40 + i * 10) % 120), 8, 8); }
          ctx.globalAlpha = 1; }
        // Light sweep across the floor.
        const sweep = ((t * 500 + f * 300) % (W + 600)) - 300; ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(sweep, y + 250, 420, 'rgba(110,147,151,0.35)', 1); ctx.restore();
        // Floor number.
        text(String(12 + f + Math.floor(scroll / floorH)).padStart(2, '0'), W - 160, y + 120, 140, AMBER, { align: 'right', alpha: 0.5 });
      }
      // The cage in front: bars and crossbeams.
      ctx.fillStyle = 'rgba(3,6,11,0.55)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = INK;
      for (let x = 60; x < W; x += 110) ctx.fillRect(x, 0, 18, H);
      for (let y = 60; y < H; y += 260) { ctx.fillRect(0, y, W, 16); }
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, H); ctx.lineTo(W, H - 40); ctx.lineTo(40, 0); ctx.closePath(); ctx.globalAlpha = 0.6; ctx.fill(); ctx.globalAlpha = 1;
      // Teo pressed to the wall, Ines grinning at the view.
      figure({ x: 300, y: H - 60, h: 330, who: 'teo', dir: 1 }); figure({ x: 1500, y: H - 60, h: 300, who: 'ines', dir: -1, lit: 0.8 });
      book(1470, H - 230, 18, 0.9);
      finish(t, 0.65);
    },

    /** The corridor of doors: brass, glass, paper; a drone's searchlight; they duck behind a cart. */
    '3.3'(t, dur) {
      const p = t / dur;
      back('#06090f', VOID);
      const vx = W / 2, vy = H * 0.46; // vanishing point
      const travel = ease(p) * 0.5;
      // Walls, floor, ceiling.
      ctx.fillStyle = '#0b141c'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(vx, vy); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0b141c'; ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(vx, vy); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#070b10'; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(vx, vy); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      // Doors at depths along both walls.
      const kinds = [['#b08a4a', '#5a4320'], ['#9fc7c8', '#2a4a50'], [PAPER, '#8a7d62']];
      for (let side of [-1, 1]) for (let i = 0; i < 9; i += 1) {
        const z = ((i / 9 + travel) % 1); const d = 0.12 + z * 0.88; const k = kinds[(i + (side > 0 ? 1 : 0)) % 3];
        const x0 = vx + side * (W * 0.55) / d * 0.25, x1 = vx + side * (W * 0.55) / (d + 0.09) * 0.25;
        const yTop = vy - (H * 0.5) / d * 0.25, yBot = vy + (H * 0.5) / d * 0.25;
        const yTop1 = vy - (H * 0.5) / (d + 0.09) * 0.25, yBot1 = vy + (H * 0.5) / (d + 0.09) * 0.25;
        ctx.fillStyle = k[1]; ctx.globalAlpha = clamp(d * 1.6); ctx.beginPath(); ctx.moveTo(x0, yTop + (yBot - yTop) * 0.2); ctx.lineTo(x1, yTop1 + (yBot1 - yTop1) * 0.2); ctx.lineTo(x1, yBot1); ctx.lineTo(x0, yBot); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = k[0]; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
      }
      // The drone and its searchlight.
      const dx = vx + Math.sin(t * 0.9) * 500, dy = vy - 120;
      const ang = Math.sin(t * 0.9) * 0.7 + Math.PI / 2;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(dx, dy, dx + Math.cos(ang) * 900, dy + Math.sin(ang) * 900); g.addColorStop(0, 'rgba(245,182,135,0.55)'); g.addColorStop(1, 'rgba(245,182,135,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx + Math.cos(ang - 0.18) * 1100, dy + Math.sin(ang - 0.18) * 1100); ctx.lineTo(dx + Math.cos(ang + 0.18) * 1100, dy + Math.sin(ang + 0.18) * 1100); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(dx, dy, 14, 0, TAU); ctx.fill(); ctx.fillStyle = '#ff5a3d'; ctx.beginPath(); ctx.arc(dx, dy, 4, 0, TAU); ctx.fill();
      // The cart of books, foreground left; the two crouch behind it.
      ctx.fillStyle = INK; ctx.fillRect(220, 700, 520, 260); ctx.beginPath(); ctx.arc(300, 980, 34, 0, TAU); ctx.arc(660, 980, 34, 0, TAU); ctx.fill();
      srand(131); for (let i = 0; i < 40; i += 1) { ctx.fillStyle = i % 2 ? '#0e141c' : '#141b25'; ctx.fillRect(240 + (i % 10) * 50, 690 - Math.floor(i / 10) * 24 - rnd() * 6, 44, 22); }
      const duck = ease((p - 0.3) / 0.25);
      figure({ x: 820, y: 960, h: 280, pose: duck > 0.5 ? 'crouch' : 'stand', who: 'ines', dir: 1, lit: 1 }); figure({ x: 930, y: 960, h: 300, pose: duck > 0.5 ? 'crouch' : 'stand', who: 'teo', dir: -1 });
      // The lantern-book pulses toward the unmarked panel on the right wall.
      const panelX = W - 380, panelY = 520; const pulse = 0.5 + 0.5 * Math.sin(t * 5);
      book(850, 820 - duck * 60, 18, 0.8 + 0.4 * pulse);
      ctx.strokeStyle = `rgba(245,182,135,${0.15 + 0.5 * pulse * ease((p - 0.5) / 0.4)})`; ctx.lineWidth = 2; ctx.strokeRect(panelX, panelY - 160, 120, 320);
      finish(t, 0.7);
    },

    /** The hidden door: the book to the panel; the wall irises open on warm light. */
    '3.4'(t, dur) {
      const p = t / dur;
      back('#0a1118', '#06090f');
      const open = ease((p - 0.35) / 0.5);
      const cx = W / 2 + 120, cy = H / 2 - 40, R = 560;
      // Warm light behind the iris.
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R * open, 0, TAU); ctx.clip();
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, '#fff1d6'); g.addColorStop(0.4, AMBER); g.addColorStop(1, '#5a2a12'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // The room beyond, hinted: a wall of words.
      srand(141); ctx.fillStyle = 'rgba(8,13,22,0.85)';
      for (let i = 0; i < 30; i += 1) { ctx.font = `${30 + rnd() * 50}px ${SERIF}`; ctx.globalAlpha = 0.35 + rnd() * 0.5; ctx.fillText(MEDITATIONS[(i * 7) % MEDITATIONS.length], cx - 500 + rnd() * 1000, cy - 400 + rnd() * 800); }
      ctx.restore();
      // Iris blades.
      ctx.fillStyle = '#0d151d';
      const blades = 8;
      for (let i = 0; i < blades; i += 1) {
        const a = (i / blades) * TAU + open * 0.9; ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(R * open, 0); ctx.lineTo(R * 2.2, -R * 0.9); ctx.lineTo(R * 2.2, R * 1.2); ctx.lineTo(R * open * 0.3, R * 0.45 * (1 - open * 0.6)); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = TEAL; ctx.lineWidth = 2; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(R * open, 0); ctx.lineTo(R * 2.2, -R * 0.9); ctx.stroke(); ctx.globalAlpha = 1; ctx.restore();
      }
      // Wall outside the iris: a vignette of dark panel.
      ctx.save(); ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#0a1118'; ctx.fillRect(0, 0, W, H); ctx.restore();
      // Close on her hands and face: Ines large at left, the book against the panel.
      figure({ x: 420, y: H + 220, h: 900, who: 'ines', dir: 1, lit: 1 });
      const bx = lerp(560, cx - R * 0.1, ease(p / 0.3)), by = lerp(760, cy + 40, ease(p / 0.3));
      ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(bx - 160, by - 20, 170, 46, 20); ctx.fill(); // arm
      book(bx, by, 40, 1 + open, 0.2);
      finish(t, 0.55);
    },

    /** The room where reading moves: a lone figure at a long console, a wall of words arriving one at a time. */
    '3.5'(t, dur) {
      const p = t / dur;
      back('#05080e', VOID);
      // The wall of light: words, each with a colour and its own motion, arriving on the beat.
      const wallX = W / 2, wallY = H * 0.36;
      glow(wallX, wallY, 900, 'rgba(110,147,151,0.18)', 1);
      const cadence = 0.62; const shown = Math.floor(t / cadence);
      for (let i = Math.max(0, shown - 7); i <= shown; i += 1) {
        const age = t - i * cadence; const life = age / (cadence * 8); if (life > 1) continue;
        srand(151 + i); const col = [AMBER, TEAL, '#bad7d1', '#f2c6a0', '#9fc7c8'][i % 5];
        const x = wallX + (rnd() - 0.5) * 1100 * life + Math.sin(age + i) * 10, y = wallY + (rnd() - 0.5) * 380 * life;
        const size = i === shown ? lerp(140, 210, ease(age / 0.3)) : lerp(210, 60, ease(life));
        text(MEDITATIONS[i % MEDITATIONS.length], x, y, size, col, { alpha: (i === shown ? ease(age / 0.2) : 1) * (1 - ease((life - 0.6) / 0.4)) });
      }
      // The console: a long bar of instruments.
      ctx.fillStyle = INK; ctx.fillRect(W * 0.15, H * 0.66, W * 0.7, 80); ctx.fillRect(W * 0.2, H * 0.66 + 80, W * 0.6, 200);
      srand(161); for (let i = 0; i < 40; i += 1) { ctx.fillStyle = i % 4 === 0 ? AMBER : TEAL; ctx.globalAlpha = 0.4 + 0.6 * ((Math.sin(t * 3 + i) + 1) / 2); ctx.fillRect(W * 0.16 + i * (W * 0.68 / 40), H * 0.66 + 30, 10, 6); } ctx.globalAlpha = 1;
      // The figure from behind, teal rim light.
      const mx = W / 2, my = H * 0.66 + 70;
      ctx.save(); ctx.shadowColor = 'rgba(110,147,151,0.9)'; ctx.shadowBlur = 24; figure({ x: mx, y: my, h: 330, pose: 'back', who: 'mateo' }); ctx.restore();
      // A lab coat: a lighter hem.
      ctx.fillStyle = '#121c26'; ctx.beginPath(); ctx.roundRect(mx - 36, my - 150, 72, 150, 18); ctx.fill();
      // Floor reflection of the wall.
      ctx.save(); ctx.globalAlpha = 0.12; ctx.translate(0, H * 0.66 * 2 + 160); ctx.scale(1, -0.5); glow(wallX, wallY, 900, 'rgba(110,147,151,0.6)', 1); ctx.restore();
      // The two step in from the foreground.
      const step = ease(p / 0.6);
      figure({ x: lerp(-100, 380, step), y: H + 80, h: 620, who: 'ines', dir: 1, lit: 0.8 }); figure({ x: lerp(-260, 240, step), y: H + 120, h: 700, who: 'teo', dir: 1 });
      book(lerp(-70, 410, step), H - 230, 26, 0.9);
      finish(t, 0.7);
    },

    /** He turns. Over the shoulder; the face stays in shadow; the frame goes to the cut. */
    '3.6'(t, dur) {
      const p = t / dur;
      back('#05080e', VOID);
      glow(W / 2, H * 0.3, 900, 'rgba(110,147,151,0.16)', 1);
      // The wall, softly, behind.
      srand(171); for (let i = 0; i < 12; i += 1) { text(MEDITATIONS[(i * 5) % MEDITATIONS.length], W / 2 + (rnd() - 0.5) * 1200, H * 0.3 + (rnd() - 0.5) * 400, 60 + rnd() * 80, i % 2 ? AMBER : TEAL, { alpha: 0.25 }); }
      // Console edge, large and close.
      ctx.fillStyle = INK; ctx.fillRect(0, H * 0.72, W, H);
      // The turn: the figure rotates toward us through scaleX; the head leads.
      const turn = ease((p - 0.15) / 0.75);
      const sx = Math.cos(turn * Math.PI * 0.85);
      ctx.save(); ctx.translate(W * 0.58, H * 0.72 + 40); ctx.scale(Math.max(0.3, Math.abs(sx)) * (sx < 0 ? -1 : 1), 1); ctx.translate(-W * 0.58, -(H * 0.72 + 40));
      ctx.shadowColor = 'rgba(110,147,151,1)'; ctx.shadowBlur = 40;
      figure({ x: W * 0.58, y: H * 0.72 + 40, h: 760, pose: 'back', who: 'mateo' });
      ctx.restore();
      // Rim light on the turned shoulder.
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(W * 0.58 + 120 * turn, H * 0.25, 220, 'rgba(110,147,151,0.5)', turn); ctx.restore();
      // Over-the-shoulder: Ines's head and shoulder foreground left.
      figure({ x: 260, y: H + 500, h: 1400, who: 'ines', dir: 1, lit: 0.5 });
      finish(t, 0.75);
      // Hard cut: the last four frames go to black so the match cut lands.
      if (p > 0.97) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    },

    /** The pitch, until Syko's footage exists: three beats as words arriving in time. */
    '4.1'(t, dur) {
      back('#06090f', '#0b1420');
      // A slow harmonograph field, the way a reading breathes.
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.2;
      for (let k = 0; k < 3; k += 1) { ctx.strokeStyle = k === 0 ? 'rgba(110,147,151,0.35)' : k === 1 ? 'rgba(245,182,135,0.22)' : 'rgba(186,215,209,0.18)'; ctx.beginPath();
        for (let i = 0; i <= 1400; i += 1) { const u = i / 1400 * TAU * 6 + t * 0.15; const d = Math.exp(-i / 1400 * 1.2);
          const x = W / 2 + d * (Math.sin(u * (2 + k * 0.5) + t * 0.1) * 520 + Math.sin(u * 3.01) * 180), y = H / 2 + d * (Math.sin(u * 3 + 1.3 + k) * 300 + Math.cos(u * 2.03) * 120);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); }
      ctx.restore();
      const BEATS = [
        { at: 1, who: 'Mateo Robles · Founder, SyberLabs', lines: ['I built SyberLabs because reading', 'is the oldest technology we have,', 'and we stopped improving it.'] },
        { at: 20, who: 'What RISE is', lines: ['RISE is an audiovisual reader.', 'Words arrive in time, with light', 'and sound that move with them.', 'It runs in your browser.', 'Your data stays on your device.'] },
        { at: 40, who: 'Why now', lines: ['Readers are leaving books for screens.', 'RISE makes the screen a better', 'place to read, not a worse one.', 'Open source. Live. Read something now.'] }
      ];
      for (const [bi, b] of BEATS.entries()) {
        const local = t - b.at; if (local < 0 || local > 19) continue;
        const out = ease((local - 16.5) / 2);
        text(b.who, W / 2, 250, 30, AMBER, { font: '"Instrument Sans", Arial, sans-serif', alpha: ease(local / 0.8) * (1 - out), spacing: 6 });
        const words = b.lines.join(' ').split(' '); let wi = 0;
        for (const [li, line] of b.lines.entries()) {
          const lw = line.split(' '); let x = 0; ctx.font = `76px ${SERIF}`; const widths = lw.map(w => ctx.measureText(w + ' ').width); const total = widths.reduce((a, c) => a + c, 0);
          x = W / 2 - total / 2;
          for (const [k, w] of lw.entries()) { const arrive = 1.2 + wi * (13 / words.length); const a = ease((local - arrive) / 0.5) * (1 - out);
            text(w, x + widths[k] / 2, 400 + li * 96, 76, '#eef4f2', { alpha: a }); x += widths[k]; wi += 1; }
        }
        if (bi === 2) text('rise.syberlabs.io', W / 2, 860, 40, AMBER, { font: '"Instrument Sans", Arial, sans-serif', alpha: ease((local - 12) / 1) * (1 - out) });
      }
      finish(t, 0.6);
    }
  };

  window.drawFrame = (id, t, seconds) => {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.shadowBlur = 0;
    const shot = SHOTS[id]; if (!shot) throw new Error(`no shot ${id}`);
    shot(t, seconds);
    ctx.restore();
    return canvas.toDataURL('image/jpeg', 0.92);
  };
  window.shotIds = Object.keys(SHOTS);
})();
