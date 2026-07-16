/**
 * Hybrid ASCII rendering primitives.
 *
 * Raster sources are reduced to a small cell grid and matched by tone plus
 * edge direction. Geometry-native sources can bypass pixels entirely and
 * rasterize their polylines into the same frame contract. The visible surface
 * draws whole text rows grouped by a bounded palette, keeping flash-time work
 * independent of the source image resolution.
 */

export const ASCII_DENSITY_RAMP = ' .,:;irsXA253hMHGS#9B&@';
export const ASCII_BACKGROUND = '#0A0A0C';

const ASCII_ONLY = /^[\x20-\x7e]*$/;
const DEFAULT_COLUMNS = 112;
const MAX_PALETTE_COLORS = 8;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function rgbaLuma(r, g, b, a = 255) {
  return ((r * 0.2126 + g * 0.7152 + b * 0.0722) / 255) * (a / 255);
}

function cssRgb([r, g, b]) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function parseHex(value) {
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value);
  if (!match) return null;
  const hex = match[1].length === 3
    ? match[1].split('').map(char => char + char).join('')
    : match[1];
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16)
  ];
}

export function parseAsciiColor(value, fallback = [220, 220, 226]) {
  if (Array.isArray(value) && value.length >= 3) {
    return value.slice(0, 3).map(channel => clamp(finite(channel, 0), 0, 255));
  }
  if (value && typeof value === 'object'
    && ['r', 'g', 'b'].every(key => Number.isFinite(Number(value[key])))) {
    return ['r', 'g', 'b'].map(key => clamp(Number(value[key]), 0, 255));
  }
  if (typeof value !== 'string') return [...fallback];
  const hex = parseHex(value.trim());
  if (hex) return hex;
  const rgb = /^rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)/i.exec(value);
  if (rgb) return rgb.slice(1, 4).map(channel => clamp(Number(channel), 0, 255));
  return [...fallback];
}

function liftDarkColor(color, floor = 64) {
  const luma = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
  if (luma >= floor) return color.map(Math.round);
  const amount = (floor - luma) / Math.max(1, 255 - luma);
  return color.map(channel => Math.round(channel + (255 - channel) * amount));
}

function colorDistance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function nearestColorIndex(color, palette) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < palette.length; index++) {
    const distance = colorDistance(color, palette[index]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

export function resolveAsciiGrid(width, height, options = {}) {
  const safeWidth = Math.max(1, finite(width, 1920));
  const safeHeight = Math.max(1, finite(height, 1080));
  const columns = Math.round(clamp(
    finite(options.columns, Math.round(safeWidth / 12) || DEFAULT_COLUMNS),
    finite(options.minColumns, 48),
    finite(options.maxColumns, 144)
  ));
  // Monospace glyphs are roughly twice as tall as they are wide. Correcting
  // for that here prevents circles and paintings from looking stretched.
  const cellAspect = clamp(finite(options.cellAspect, 0.55), 0.4, 0.75);
  const rows = Math.round(clamp(
    finite(options.rows, columns * (safeHeight / safeWidth) * cellAspect),
    finite(options.minRows, 20),
    finite(options.maxRows, 84)
  ));
  return { columns, rows };
}

function makeLayers(glyphs, colorIndices, columns, rows, paletteSize) {
  const layers = Array.from({ length: paletteSize }, () => new Array(rows));
  for (let row = 0; row < rows; row++) {
    const offset = row * columns;
    for (let paletteIndex = 0; paletteIndex < paletteSize; paletteIndex++) {
      const chars = new Array(columns);
      for (let column = 0; column < columns; column++) {
        const index = offset + column;
        chars[column] = colorIndices[index] === paletteIndex ? glyphs[index] : ' ';
      }
      layers[paletteIndex][row] = chars.join('');
    }
  }
  return layers;
}

function createFrame({ columns, rows, glyphs, palette, colorIndices, background, metadata = {} }) {
  const glyphString = Array.isArray(glyphs) ? glyphs.join('') : String(glyphs || '');
  if (glyphString.length !== columns * rows || !ASCII_ONLY.test(glyphString)) {
    throw new TypeError('ASCII frame glyph grid must contain one printable ASCII character per cell');
  }
  const safePalette = palette.length ? palette : [[220, 220, 226]];
  return {
    columns,
    rows,
    glyphs: glyphString,
    palette: safePalette.map(color => cssRgb(liftDarkColor(color))),
    colorIndices,
    layers: makeLayers(glyphString, colorIndices, columns, rows, safePalette.length),
    background: background || ASCII_BACKGROUND,
    metadata: { ...metadata }
  };
}

export function asciiFrameToText(frame) {
  if (!frame?.glyphs || !frame.columns || !frame.rows) return '';
  const rows = [];
  for (let row = 0; row < frame.rows; row++) {
    rows.push(frame.glyphs.slice(row * frame.columns, (row + 1) * frame.columns));
  }
  return rows.join('\n');
}

function directionalGlyph(gx, gy) {
  // Sobel gives the gradient normal; ASCII needs the edge tangent.
  const tx = -gy;
  const ty = gx;
  const ax = Math.abs(tx);
  const ay = Math.abs(ty);
  if (ax > ay * 2) return '-';
  if (ay > ax * 2) return '|';
  return tx * ty >= 0 ? '\\' : '/';
}

function derivePalette(sampled, glyphs, maxColors = MAX_PALETTE_COLORS) {
  const buckets = new Map();
  for (let index = 0; index < glyphs.length; index++) {
    if (glyphs[index] === ' ') continue;
    const offset = index * 4;
    const r = sampled[offset];
    const g = sampled[offset + 1];
    const b = sampled[offset + 2];
    const key = `${r >> 5}:${g >> 5}:${b >> 5}`;
    const entry = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    entry.count++;
    entry.r += r;
    entry.g += g;
    entry.b += b;
    buckets.set(key, entry);
  }
  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.max(1, maxColors))
    .map(entry => [entry.r / entry.count, entry.g / entry.count, entry.b / entry.count]);
}

/**
 * Compile an RGBA buffer that already has one pixel per ASCII cell.
 */
export function compileSampledRaster(sampled, columns, rows, options = {}) {
  if (!sampled || sampled.length < columns * rows * 4) {
    throw new TypeError('Sampled raster does not cover the requested ASCII grid');
  }
  const count = columns * rows;
  const luma = new Float32Array(count);
  const glyphs = new Array(count).fill(' ');
  for (let index = 0; index < count; index++) {
    const offset = index * 4;
    luma[index] = rgbaLuma(
      sampled[offset], sampled[offset + 1], sampled[offset + 2], sampled[offset + 3]
    );
  }

  const signal = options.signal || null;
  const arousal = clamp(finite(signal?.arousal, 0.5), 0, 1);
  const edgeThreshold = clamp(
    finite(options.edgeThreshold, 0.18 - arousal * 0.045), 0.09, 0.24
  );
  const gamma = clamp(finite(options.gamma, 0.9 + (0.5 - arousal) * 0.12), 0.72, 1.15);
  const sampleLuma = (x, y) => luma[clamp(y, 0, rows - 1) * columns + clamp(x, 0, columns - 1)];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const index = y * columns + x;
      if (sampled[index * 4 + 3] < 12 || luma[index] < 0.018) continue;
      const gx =
        -sampleLuma(x - 1, y - 1) + sampleLuma(x + 1, y - 1)
        -2 * sampleLuma(x - 1, y) + 2 * sampleLuma(x + 1, y)
        -sampleLuma(x - 1, y + 1) + sampleLuma(x + 1, y + 1);
      const gy =
        -sampleLuma(x - 1, y - 1) - 2 * sampleLuma(x, y - 1) - sampleLuma(x + 1, y - 1)
        +sampleLuma(x - 1, y + 1) + 2 * sampleLuma(x, y + 1) + sampleLuma(x + 1, y + 1);
      const edge = Math.hypot(gx, gy) / 4;
      if (edge >= edgeThreshold) {
        glyphs[index] = directionalGlyph(gx, gy);
      } else {
        const tone = Math.pow(clamp(luma[index], 0, 1), gamma);
        const rampIndex = Math.round(tone * (ASCII_DENSITY_RAMP.length - 1));
        glyphs[index] = ASCII_DENSITY_RAMP[rampIndex];
      }
    }
  }

  const palette = options.monochrome
    ? [parseAsciiColor(options.foreground)]
    : derivePalette(sampled, glyphs, finite(options.maxColors, MAX_PALETTE_COLORS));
  const safePalette = palette.length ? palette : [parseAsciiColor(options.foreground)];
  const colorIndices = new Uint8Array(count);
  if (!options.monochrome) {
    for (let index = 0; index < count; index++) {
      if (glyphs[index] === ' ') continue;
      const offset = index * 4;
      colorIndices[index] = nearestColorIndex(
        [sampled[offset], sampled[offset + 1], sampled[offset + 2]], safePalette
      );
    }
  }

  return createFrame({
    columns,
    rows,
    glyphs,
    palette: safePalette,
    colorIndices,
    background: options.background,
    metadata: { kind: 'raster', ...(options.metadata || {}) }
  });
}

/**
 * Reduce arbitrary ImageData to one RGBA sample per target cell. Contain-fit
 * preserves the source composition and leaves letterbox cells transparent.
 */
export function sampleImageData(imageData, columns, rows, fit = 'contain') {
  const sourceWidth = Math.max(1, finite(imageData?.width, 0));
  const sourceHeight = Math.max(1, finite(imageData?.height, 0));
  const source = imageData?.data;
  if (!source || source.length < sourceWidth * sourceHeight * 4) {
    throw new TypeError('Invalid ImageData source');
  }
  const output = new Uint8ClampedArray(columns * rows * 4);
  const scale = fit === 'cover'
    ? Math.max(columns / sourceWidth, rows / sourceHeight)
    : Math.min(columns / sourceWidth, rows / sourceHeight);
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;
  const left = (columns - drawnWidth) / 2;
  const top = (rows - drawnHeight) / 2;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const sourceX = (x + 0.5 - left) / scale - 0.5;
      const sourceY = (y + 0.5 - top) / scale - 0.5;
      if (sourceX < 0 || sourceY < 0 || sourceX >= sourceWidth || sourceY >= sourceHeight) continue;
      const sx = clamp(Math.round(sourceX), 0, sourceWidth - 1);
      const sy = clamp(Math.round(sourceY), 0, sourceHeight - 1);
      const sourceOffset = (sy * sourceWidth + sx) * 4;
      const targetOffset = (y * columns + x) * 4;
      output[targetOffset] = source[sourceOffset];
      output[targetOffset + 1] = source[sourceOffset + 1];
      output[targetOffset + 2] = source[sourceOffset + 2];
      output[targetOffset + 3] = source[sourceOffset + 3];
    }
  }
  return output;
}

export function compileImageDataToAscii(imageData, options = {}) {
  const { columns, rows } = resolveAsciiGrid(imageData?.width, imageData?.height, options);
  const sampled = sampleImageData(imageData, columns, rows, options.fit || 'contain');
  return compileSampledRaster(sampled, columns, rows, options);
}

/**
 * Downsample an HTML image/canvas into a fresh origin-clean scratch canvas.
 * Cross-origin images without CORS permission deliberately throw here; the
 * caller can skip the frame without poisoning the visible ASCII surface.
 */
export function compileDrawableToAscii(source, options = {}) {
  if (!source) return null;
  const sourceWidth = finite(source.naturalWidth || source.videoWidth || source.width, 0);
  const sourceHeight = finite(source.naturalHeight || source.videoHeight || source.height, 0);
  if (sourceWidth <= 0 || sourceHeight <= 0) return null;
  const displayWidth = finite(options.displayWidth, sourceWidth);
  const displayHeight = finite(options.displayHeight, sourceHeight);
  const { columns, rows } = resolveAsciiGrid(displayWidth, displayHeight, options);
  const scratch = options.scratchCanvas
    || (typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(columns, rows)
      : document.createElement('canvas'));
  scratch.width = columns;
  scratch.height = rows;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, columns, rows);

  const fit = options.fit || 'contain';
  const scale = fit === 'cover'
    ? Math.max(columns / sourceWidth, rows / sourceHeight)
    : Math.min(columns / sourceWidth, rows / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  ctx.drawImage(source, (columns - width) / 2, (rows - height) / 2, width, height);
  const sampled = ctx.getImageData(0, 0, columns, rows).data;
  return compileSampledRaster(sampled, columns, rows, options);
}

/**
 * Async facade for the expensive density/edge/palette stage. Sampling a DOM
 * drawable remains a tiny main-thread canvas operation because DOM elements
 * cannot be posted to a worker; all per-cell analysis is worker-owned when
 * the runtime supports module workers.
 */
export class AsciiFrameCompiler {
  constructor() {
    this.worker = null;
    this.pending = new Map();
    this.nextId = 1;
    if (typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./ascii-worker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = event => this._resolveWorkerJob(event.data);
        this.worker.onerror = () => this._retireWorker();
      } catch {
        this.worker = null;
      }
    }
  }

  _workerOptions(options) {
    const { scratchCanvas, ...serializable } = options || {};
    return serializable;
  }

  _resolveWorkerJob(message) {
    const job = this.pending.get(message?.id);
    if (!job) return;
    this.pending.delete(message.id);
    if (message.error) {
      job.reject(new Error(message.error));
    } else {
      job.resolve(message.frame);
    }
  }

  _retireWorker() {
    this.worker?.terminate?.();
    this.worker = null;
    for (const job of this.pending.values()) {
      try {
        job.resolve(compileSampledRaster(
          job.fallbackSampled,
          job.columns,
          job.rows,
          job.options
        ));
      } catch (error) {
        job.reject(error);
      }
    }
    this.pending.clear();
  }

  compileSampled(sampled, columns, rows, options = {}) {
    if (!this.worker) {
      return Promise.resolve(compileSampledRaster(sampled, columns, rows, options));
    }
    const id = this.nextId++;
    const transfer = sampled instanceof Uint8ClampedArray
      ? sampled
      : new Uint8ClampedArray(sampled);
    const workerOptions = this._workerOptions(options);
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve,
        reject,
        columns,
        rows,
        options: workerOptions,
        fallbackSampled: transfer.slice()
      });
      this.worker.postMessage({
        id,
        sampled: transfer.buffer,
        columns,
        rows,
        options: workerOptions
      }, [transfer.buffer]);
    });
  }

  compileImageData(imageData, options = {}) {
    const { columns, rows } = resolveAsciiGrid(imageData?.width, imageData?.height, options);
    const sampled = sampleImageData(imageData, columns, rows, options.fit || 'contain');
    return this.compileSampled(sampled, columns, rows, options);
  }

  compileDrawable(source, options = {}) {
    if (!source) return Promise.resolve(null);
    const sourceWidth = finite(source.naturalWidth || source.videoWidth || source.width, 0);
    const sourceHeight = finite(source.naturalHeight || source.videoHeight || source.height, 0);
    if (sourceWidth <= 0 || sourceHeight <= 0) return Promise.resolve(null);
    const displayWidth = finite(options.displayWidth, sourceWidth);
    const displayHeight = finite(options.displayHeight, sourceHeight);
    const { columns, rows } = resolveAsciiGrid(displayWidth, displayHeight, options);
    const scratch = options.scratchCanvas
      || (typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(columns, rows)
        : document.createElement('canvas'));
    scratch.width = columns;
    scratch.height = rows;
    const ctx = scratch.getContext('2d', { willReadFrequently: true });
    if (!ctx) return Promise.resolve(null);
    ctx.clearRect(0, 0, columns, rows);

    const fit = options.fit || 'contain';
    const scale = fit === 'cover'
      ? Math.max(columns / sourceWidth, rows / sourceHeight)
      : Math.min(columns / sourceWidth, rows / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    ctx.drawImage(source, (columns - width) / 2, (rows - height) / 2, width, height);
    const sampled = ctx.getImageData(0, 0, columns, rows).data;
    return this.compileSampled(sampled, columns, rows, options);
  }

  destroy() {
    this.worker?.terminate?.();
    this.worker = null;
    for (const job of this.pending.values()) job.reject(new Error('ASCII compiler destroyed'));
    this.pending.clear();
  }
}

function hslToRgb({ h = 0, s = 0, l = 0 }) {
  const hue = ((finite(h, 0) % 360) + 360) % 360 / 360;
  const saturation = clamp(finite(s, 0) / 100, 0, 1);
  const lightness = clamp(finite(l, 0) / 100, 0, 1);
  if (saturation === 0) {
    const gray = lightness * 255;
    return [gray, gray, gray];
  }
  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const channel = offset => {
    let t = hue + offset;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(1 / 3) * 255, channel(0) * 255, channel(-1 / 3) * 255];
}

function planColor(value) {
  return value && typeof value === 'object' && Object.hasOwn(value, 'h')
    ? hslToRgb(value)
    : parseAsciiColor(value);
}

function sampleStops(stops, position) {
  const sorted = stops.length ? stops : [
    { offset: 0, color: [220, 220, 226] },
    { offset: 1, color: [40, 40, 46] }
  ];
  const t = clamp(position, 0, 1);
  let left = sorted[0];
  let right = sorted[sorted.length - 1];
  for (let index = 0; index < sorted.length - 1; index++) {
    if (t >= sorted[index].offset && t <= sorted[index + 1].offset) {
      left = sorted[index];
      right = sorted[index + 1];
      break;
    }
  }
  const span = Math.max(0.0001, right.offset - left.offset);
  const mix = clamp((t - left.offset) / span, 0, 1);
  const a = planColor(left.color);
  const b = planColor(right.color);
  return a.map((channel, index) => channel + (b[index] - channel) * mix);
}

/** Compile Turrell's structured light-field plan without screenshotting CSS. */
export function compileFieldPlanToAscii(plan, options = {}) {
  if (!plan || !Array.isArray(plan.stops)) return null;
  const width = finite(options.displayWidth, 1920);
  const height = finite(options.displayHeight, 1080);
  const { columns, rows } = resolveAsciiGrid(width, height, options);
  const sampled = new Uint8ClampedArray(columns * rows * 4);
  const center = Array.isArray(plan.center) ? plan.center : [0.5, 0.5];
  const radius = Array.isArray(plan.radius) ? plan.radius : [0.7, 0.7];
  const angle = finite(plan.angle, 180) * Math.PI / 180;
  const vx = Math.sin(angle);
  const vy = -Math.cos(angle);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const nx = (x + 0.5) / columns;
      const ny = (y + 0.5) / rows;
      let position;
      if (plan.kind === 'linear') {
        const projection = (nx - 0.5) * vx + (ny - 0.5) * vy;
        position = 0.5 + projection / Math.max(0.001, Math.abs(vx) + Math.abs(vy));
      } else {
        const dx = (nx - center[0]) / Math.max(0.001, radius[0]);
        const dy = (ny - center[1]) / Math.max(0.001, radius[1]);
        position = Math.hypot(dx, dy);
      }
      const color = sampleStops(plan.stops, position);
      const offset = (y * columns + x) * 4;
      sampled[offset] = color[0];
      sampled[offset + 1] = color[1];
      sampled[offset + 2] = color[2];
      sampled[offset + 3] = 255;
    }
  }
  return compileSampledRaster(sampled, columns, rows, {
    ...options,
    metadata: { kind: 'field', fieldKind: plan.kind, ...(options.metadata || {}) }
  });
}

function directionForSegment(dx, dy) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax > ay * 2) return '-';
  if (ay > ax * 2) return '|';
  return dx * dy >= 0 ? '\\' : '/';
}

function mergeStructuralGlyph(existing, incoming) {
  if (existing === ' ' || existing === incoming) return incoming;
  if ((existing === '-' && incoming === '|') || (existing === '|' && incoming === '-')) return '+';
  if ((existing === '/' && incoming === '\\') || (existing === '\\' && incoming === '/')) return 'x';
  return '*';
}

/**
 * Compile line-native artwork without first flattening it to pixels.
 */
export function compilePolylinesToAscii(input = {}, options = {}) {
  const width = Math.max(1, finite(input.width, 1920));
  const height = Math.max(1, finite(input.height, 1080));
  const { columns, rows } = resolveAsciiGrid(width, height, options);
  const glyphs = new Array(columns * rows).fill(' ');
  const colorIndices = new Uint8Array(columns * rows);
  const polylines = Array.isArray(input.polylines) ? input.polylines : [];
  const declaredPalette = Array.isArray(input.palette) && input.palette.length
    ? input.palette.map(color => parseAsciiColor(color)).slice(0, MAX_PALETTE_COLORS)
    : [...new Map(polylines.map(line => {
      const color = parseAsciiColor(line.color);
      return [color.join(','), color];
    })).values()].slice(0, MAX_PALETTE_COLORS);
  const palette = declaredPalette.length ? declaredPalette : [[220, 220, 226]];
  const progress = clamp(finite(options.progress, 1), 0, 1);

  for (let lineIndex = 0; lineIndex < polylines.length; lineIndex++) {
    const line = polylines[lineIndex];
    const points = Array.isArray(line?.points) ? line.points : [];
    if (points.length < 2) continue;
    const defaultDelay = polylines.length > 1
      ? (lineIndex / (polylines.length - 1)) * 0.16
      : 0;
    const delay = clamp(finite(line?.delay, defaultDelay), 0, 0.95);
    const localProgress = clamp((progress - delay) / Math.max(0.001, 1 - delay), 0, 1);
    const visibleSegments = Math.min(points.length - 1, Math.ceil((points.length - 1) * localProgress));
    if (visibleSegments <= 0) continue;
    const color = parseAsciiColor(line.color, palette[0]);
    const paletteIndex = nearestColorIndex(color, palette);

    for (let segment = 0; segment < visibleSegments; segment++) {
      const from = points[segment];
      const to = points[segment + 1];
      if (!from || !to) continue;
      const x0 = clamp((finite(from[0], 0) / width) * (columns - 1), 0, columns - 1);
      const y0 = clamp((finite(from[1], 0) / height) * (rows - 1), 0, rows - 1);
      const x1 = clamp((finite(to[0], 0) / width) * (columns - 1), 0, columns - 1);
      const y1 = clamp((finite(to[1], 0) / height) * (rows - 1), 0, rows - 1);
      const dx = x1 - x0;
      const dy = y1 - y0;
      const glyph = directionForSegment(dx, dy);
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        const x = Math.round(x0 + dx * t);
        const y = Math.round(y0 + dy * t);
        const index = y * columns + x;
        glyphs[index] = mergeStructuralGlyph(glyphs[index], glyph);
        colorIndices[index] = paletteIndex;
      }
    }
  }

  return createFrame({
    columns,
    rows,
    glyphs,
    palette,
    colorIndices,
    background: options.background,
    metadata: { kind: 'structural', progress, ...(options.metadata || {}) }
  });
}

export class AsciiCanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext?.('2d') || null;
  }

  resize(width, height) {
    if (!this.canvas) return false;
    const nextWidth = Math.max(1, Math.round(width));
    const nextHeight = Math.max(1, Math.round(height));
    if (this.canvas.width === nextWidth && this.canvas.height === nextHeight) return false;
    this.canvas.width = nextWidth;
    this.canvas.height = nextHeight;
    return true;
  }

  render(frame, options = {}) {
    if (!this.ctx || !frame?.layers?.length) return false;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = options.background || frame.background || ASCII_BACKGROUND;
    ctx.fillRect(0, 0, width, height);

    const cellHeight = height / frame.rows;
    const fontSize = Math.max(6, cellHeight * 0.94);
    ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace`;
    ctx.textBaseline = 'top';
    const measured = Math.max(1, ctx.measureText('M').width);
    const desiredCellWidth = width / frame.columns;
    const scaleX = clamp(desiredCellWidth / measured, 0.65, 1.35);
    const logicalWidth = width / scaleX;
    const textWidth = measured * frame.columns;
    const startX = (logicalWidth - textWidth) / 2;
    const drawnHeight = fontSize * frame.rows;
    const startY = Math.max(0, (height - drawnHeight) / 2);
    ctx.scale(scaleX, 1);

    for (let paletteIndex = 0; paletteIndex < frame.palette.length; paletteIndex++) {
      ctx.fillStyle = frame.palette[paletteIndex];
      const rows = frame.layers[paletteIndex];
      for (let row = 0; row < frame.rows; row++) {
        const text = rows[row];
        if (text.trim()) ctx.fillText(text, startX, startY + row * fontSize);
      }
    }
    ctx.restore();
    return true;
  }
}
