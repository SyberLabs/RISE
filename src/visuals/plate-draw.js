/**
 * Parametric time drawing adapter for finished plates.
 *
 * Ostensoria and Apparitio still generate the whole plate. This layer
 * does not re-run attractors or splats. It stencils the developed image
 * by an order field so gallery progress 0 is empty ground and progress 1
 * is the finished plate — cores of ink first, wash later.
 *
 * Spatial bias is the only family difference: Iris Plates open from the
 * centre; Spectral Plates unfurl from the mirror axis. Gallery drives
 * both on the same dwell clock.
 *
 * Presentation: a plate is a square. Cover-scaling it onto a landscape
 * or portrait Chamber crops the figure and upscales the bake. Contain
 * with a short-side inset keeps the whole plate on the glass.
 */

const VOID = '#0A0A0C';

export const OSTENSORIA_PAPER_RGB = [10, 10, 12];
export const APPARITIO_VOID_RGB = [10, 10, 12];
export const PLATE_FIT_INSET = 0.08;
export const PLATE_FIT_MIN_PAD = 24;

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Apparitio develops on black film. Lift the ink onto chamber void so
 * empty plate is the wall, not a darker square inside the contain-fit.
 */
export function compositeInkOnPaper(r, g, b, paperRgb = APPARITIO_VOID_RGB) {
  const R = clamp01(r);
  const G = clamp01(g);
  const B = clamp01(b);
  return [
    (paperRgb[0] / 255) * (1 - R) + R,
    (paperRgb[1] / 255) * (1 - G) + G,
    (paperRgb[2] / 255) * (1 - B) + B
  ];
}

/**
 * Bake resolution index for Chamber. HTML draft (760) is too small once
 * the plate is shown on a retina display; never drop below 1000px.
 *
 * @param {{ innerWidth?: number, innerHeight?: number, devicePixelRatio?: number }} [view]
 * @returns {2|3|4}
 */
export function chamberPlateQuality(view = typeof window !== 'undefined' ? window : null) {
  const w = Number(view?.innerWidth) || 1280;
  const h = Number(view?.innerHeight) || 800;
  const dpr = Math.min(2, Math.max(1, Number(view?.devicePixelRatio) || 1));
  const edge = Math.min(w, h) * dpr * (1 - PLATE_FIT_INSET * 2);
  if (edge >= 1300) return 4;
  if (edge >= 1080) return 3;
  return 2;
}

export function plateFitRect(canvasWidth, canvasHeight, srcWidth, srcHeight) {
  const sw = Math.max(1, Number(srcWidth) || 1);
  const sh = Math.max(1, Number(srcHeight) || 1);
  const short = Math.min(canvasWidth, canvasHeight);
  const pad = Math.max(PLATE_FIT_MIN_PAD, Math.round(short * PLATE_FIT_INSET));
  const availW = Math.max(1, canvasWidth - pad * 2);
  const availH = Math.max(1, canvasHeight - pad * 2);
  const scale = Math.min(availW / sw, availH / sh);
  const tw = sw * scale;
  const th = sh * scale;
  return {
    x: (canvasWidth - tw) / 2,
    y: (canvasHeight - th) / 2,
    width: tw,
    height: th
  };
}

export function fitPlateBlit(ctx, canvas, src, voidFill = VOID) {
  ctx.fillStyle = voidFill;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!src?.width || !src?.height) return;
  const rect = plateFitRect(canvas.width, canvas.height, src.width, src.height);
  ctx.imageSmoothingEnabled = true;
  try {
    ctx.imageSmoothingQuality = 'high';
  } catch {
    /* Safari versions without the quality enum still smooth. */
  }
  ctx.drawImage(src, rect.x, rect.y, rect.width, rect.height);
}

function spatialWeight(x, y, w, h, spatial) {
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  if (spatial === 'axis') {
    const a = Math.abs(x - cx) / (cx || 1);
    return 1 - 0.62 * Math.min(1, a);
  }
  const maxR = Math.hypot(cx, cy) || 1;
  const r = Math.hypot(x - cx, y - cy) / maxR;
  return 1 - 0.38 * Math.min(1, r);
}

/**
 * Rank each pixel of a scalar ink field. Higher order appears earlier.
 *
 * @param {Float32Array} field
 * @param {number} width
 * @param {number} height
 * @param {'radial'|'axis'} [spatial]
 * @returns {Uint8Array}
 */
export function buildPlateOrder(field, width, height, spatial = 'radial') {
  const n = width * height;
  const ink = new Float32Array(n);
  let maxInk = 1e-6;
  for (let i = 0; i < n; i++) {
    const d = field[i];
    const u = d > 0 ? Math.log(1 + d) * spatialWeight(i % width, (i / width) | 0, width, height, spatial) : 0;
    ink[i] = u;
    if (u > maxInk) maxInk = u;
  }
  const order = new Uint8Array(n);
  const inv = 255 / maxInk;
  for (let i = 0; i < n; i++) order[i] = (ink[i] * inv) | 0;
  return order;
}

/**
 * Rank Apparitio's accumulation buffers as a single ink field.
 */
export function buildPlateOrderFromRgb(accR, accG, accB, shR, shG, shB, width, height, spatial = 'axis') {
  const n = width * height;
  const field = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = accR[i] + shR[i] * 1.3;
    const g = accG[i] + shG[i] * 1.3;
    const b = accB[i] + shB[i] * 1.3;
    field[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return buildPlateOrder(field, width, height, spatial);
}

function ensureScratch(scratch, width, height) {
  if (scratch?.canvas?.width === width && scratch?.canvas?.height === height && scratch.imageData) {
    return scratch;
  }
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx?.createImageData) return null;
  return { canvas, ctx, imageData: ctx.createImageData(width, height) };
}

function fillGround(ctx, canvas, paperRgb) {
  ctx.fillStyle = `rgb(${paperRgb[0]},${paperRgb[1]},${paperRgb[2]})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Blit the developed plate onto `canvas`, stenciled by `order` at `progress`.
 * `progress` is already eased by galleryDrawProgress; this map is linear.
 *
 * @returns {boolean}
 */
export function revealPlate(canvas, spec = {}) {
  const {
    plate,
    plateData,
    order,
    width,
    height,
    progress = 1,
    paperRgb,
    scratch
  } = spec;
  const ctx = canvas?.getContext?.('2d');
  if (!ctx) return false;
  const t = Math.max(0, Math.min(1, Number(progress) || 0));
  const paper = paperRgb || APPARITIO_VOID_RGB;

  if (t >= 1 && plate) {
    fitPlateBlit(ctx, canvas, plate);
    return true;
  }
  if (t <= 0 || !plateData?.data || !order) {
    fillGround(ctx, canvas, paper);
    return true;
  }

  const next = ensureScratch(scratch, width, height);
  if (!next) {
    if (plate) fitPlateBlit(ctx, canvas, plate);
    return !!plate;
  }
  const src = plateData.data;
  const out = next.imageData.data;
  const threshold = (255 * (1 - t)) | 0;
  const pr = paper[0];
  const pg = paper[1];
  const pb = paper[2];
  for (let i = 0, p = 0; i < order.length; i++, p += 4) {
    if (order[i] > threshold) {
      out[p] = src[p];
      out[p + 1] = src[p + 1];
      out[p + 2] = src[p + 2];
      out[p + 3] = 255;
    } else {
      out[p] = pr;
      out[p + 1] = pg;
      out[p + 2] = pb;
      out[p + 3] = 255;
    }
  }
  next.ctx.putImageData(next.imageData, 0, 0);
  spec.scratch = next;
  fitPlateBlit(ctx, canvas, next.canvas);
  return true;
}

export function capturePlateData(plate, width, height) {
  const ctx = plate?.getContext?.('2d');
  if (!ctx?.getImageData) return null;
  return ctx.getImageData(0, 0, width, height);
}
