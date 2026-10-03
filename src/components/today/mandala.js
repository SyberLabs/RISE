/**
 * Today's mark: the kit's de Jong sigil for a date, folded `folds` ways
 * about its centre (odd folds mirrored), one Atlas spectrum colour per fold,
 * added on ink with log density so dense cores burn toward white.
 * The kit itself is not edited; only its seeding (`params`) is used.
 */
import { params } from '../../vendor/syber/syber-sigil.js';

// ice, blue, violet, magenta, amber, accent-rise
const COLORS = [[144, 216, 240], [72, 144, 240], [154, 107, 255], [255, 88, 214], [255, 181, 74], [242, 217, 166]];

export function foldMatrices(folds) {
  return Array.from({ length: folds }, (_, k) => {
    const a = (2 * Math.PI * k) / folds;
    return { c: Math.cos(a), s: Math.sin(a), m: k % 2 ? -1 : 1 };
  });
}

const reducedMotion = () => typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function drawMandala(canvas, seed, { folds = 12, animate = true } = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { P, box, caption } = params(seed);
  const S = Math.round(canvas.clientWidth * Math.min(globalThis.devicePixelRatio || 1, 2)) || 480;
  canvas.width = canvas.height = S;
  const img = ctx.createImageData(S, S);
  const hist = COLORS.map(() => new Float32Array(S * S));
  const turns = foldMatrices(folds);
  // A folded point can reach the box's corner, √2 · size/2 from the centre.
  const k = (S * 0.68) / box[2];
  const half = S / 2;
  const TOTAL = Math.round(S * S * 0.4);
  const STEP = animate && !reducedMotion() ? Math.ceil(TOTAL / 16) : TOTAL;
  let x = 0.1, y = 0.1, done = 0, max = 1, raf = 0;

  const paint = () => {
    const d = img.data, L = Math.log(1 + max * 0.5);
    for (let j = 0; j < S * S; j++) {
      let r = 0, g = 0, b = 0, dense = 0;
      for (let c = 0; c < COLORS.length; c++) {
        const v = hist[c][j];
        if (!v) continue;
        const t = Math.min(1, Math.log(1 + v) / L);
        r += COLORS[c][0] * t; g += COLORS[c][1] * t; b += COLORS[c][2] * t;
        if (t > dense) dense = t;
      }
      if (!dense) continue;
      const w = dense * dense * dense * 0.9, q = j * 4;
      r = Math.min(255, r); g = Math.min(255, g); b = Math.min(255, b);
      d[q] = r + (255 - r) * w; d[q + 1] = g + (255 - g) * w; d[q + 2] = b + (255 - b) * w;
      d[q + 3] = 255 * Math.min(1, 1.25 * Math.pow(dense, 0.6));
    }
    ctx.putImageData(img, 0, 0);
  };

  const chunk = () => {
    raf = 0;
    for (let i = 0; i < STEP && done < TOTAL; i++, done++) {
      const nx = Math.sin(P[0] * y) - Math.cos(P[1] * x);
      y = Math.sin(P[2] * x) - Math.cos(P[3] * y);
      x = nx;
      const rx = (x - box[0]) * k, ry = (y - box[1]) * k;
      for (let f = 0; f < turns.length; f++) {
        const { c, s, m } = turns[f];
        const ix = (half + m * rx * c - ry * s) | 0, iy = (half + m * rx * s + ry * c) | 0;
        if (ix < 0 || iy < 0 || ix >= S || iy >= S) continue;
        const h = hist[f % COLORS.length], j = ix + iy * S;
        if (++h[j] > max) max = h[j];
      }
    }
    paint();
    if (done < TOTAL) raf = requestAnimationFrame(chunk);
  };
  chunk();
  return { caption, cancel() { if (raf) cancelAnimationFrame(raf); raf = 0; } };
}
