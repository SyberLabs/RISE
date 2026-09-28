/**
 * Pixel measurements for rendered frames.
 *
 * Pure and dependency-free so an e2e spec or an offline render can call it
 * on RGBA buffers (Uint8ClampedArray / Uint8Array, 4 bytes per pixel, row
 * major). VisualFlashGate in visual-safety.js bounds flash timing and never
 * looks at pixels; the continuous engines skip it on the claim that they
 * cannot flash. This module is what lets that claim be checked.
 */

/** A pixel is "lit" when its relative luminance is above this. */
const LIT_LUMINANCE = 0.15;
/** WCAG 2.3.1: a change of at least this much relative luminance counts. */
const FLASH_DELTA = 0.1;
/** WCAG 2.3.1: only flashes whose darker state is below this count. */
const FLASH_DARK_CEILING = 0.8;
/** WCAG 2.3.1: at most this many flashes in any one second. */
const MAX_FLASHES_PER_SECOND = 3;

const CHANNEL = new Float64Array(256);
for (let v = 0; v < 256; v += 1) {
  const c = v / 255;
  CHANNEL[v] = c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance of an sRGB colour, channels 0-255. */
export function relativeLuminance(r, g, b) {
  return 0.2126 * CHANNEL[r] + 0.7152 * CHANNEL[g] + 0.0722 * CHANNEL[b];
}

/** WCAG 2.x contrast ratio between two relative luminances, 1 to 21. */
export function contrastRatio(l1, l2) {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function assertFrame(rgba, width, height) {
  if (rgba.length !== width * height * 4) {
    throw new RangeError(`frame has ${rgba.length} bytes, expected ${width * height * 4}`);
  }
}

/**
 * Lit coverage, 95th-percentile luminance and mean HSV saturation of the lit
 * pixels. `exclude` is a rectangle (for example the caption) left out of
 * every statistic. An empty measured area returns zeros.
 *
 * @returns {{litCoverage: number, p95Luminance: number, meanSaturationLit: number}}
 */
export function frameStats(rgba, width, height, { exclude } = {}) {
  assertFrame(rgba, width, height);
  const luminances = new Float64Array(width * height);
  let count = 0;
  let lit = 0;
  let saturation = 0;
  for (let y = 0; y < height; y += 1) {
    const skipRow = exclude && y >= exclude.y && y < exclude.y + exclude.h;
    for (let x = 0; x < width; x += 1) {
      if (skipRow && x >= exclude.x && x < exclude.x + exclude.w) continue;
      const i = (y * width + x) * 4;
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      const l = relativeLuminance(r, g, b);
      luminances[count] = l;
      count += 1;
      if (l > LIT_LUMINANCE) {
        lit += 1;
        const max = Math.max(r, g, b);
        saturation += max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
      }
    }
  }
  if (count === 0) return { litCoverage: 0, p95Luminance: 0, meanSaturationLit: 0 };
  const sorted = luminances.subarray(0, count).sort();
  return {
    litCoverage: lit / count,
    p95Luminance: sorted[Math.ceil(0.95 * count) - 1],
    meanSaturationLit: lit === 0 ? 0 : saturation / lit
  };
}

/** Mean absolute RGB difference between two same-size frames, 0 to 1. Alpha is ignored. */
export function meanAbsDiff(rgbaA, rgbaB) {
  if (rgbaA.length !== rgbaB.length) {
    throw new RangeError(`frames differ in size: ${rgbaA.length} vs ${rgbaB.length} bytes`);
  }
  let sum = 0;
  for (let i = 0; i < rgbaA.length; i += 4) {
    sum += Math.abs(rgbaA[i] - rgbaB[i])
      + Math.abs(rgbaA[i + 1] - rgbaB[i + 1])
      + Math.abs(rgbaA[i + 2] - rgbaB[i + 2]);
  }
  const pixels = rgbaA.length / 4;
  return pixels === 0 ? 0 : sum / (pixels * 3 * 255);
}

/**
 * WCAG contrast between a text luminance and the brightest 1% of pixels in
 * `textBox` ({x, y, w, h}, clipped to the frame). The brightest pixels are
 * averaged, so one hot pixel does not decide the result.
 */
export function textContrast(rgba, width, height, textBox, textLuminance) {
  assertFrame(rgba, width, height);
  const x0 = Math.max(0, textBox.x);
  const y0 = Math.max(0, textBox.y);
  const x1 = Math.min(width, textBox.x + textBox.w);
  const y1 = Math.min(height, textBox.y + textBox.h);
  const values = [];
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * width + x) * 4;
      values.push(relativeLuminance(rgba[i], rgba[i + 1], rgba[i + 2]));
    }
  }
  if (values.length === 0) throw new RangeError('textBox does not overlap the frame');
  values.sort((a, b) => b - a);
  const top = Math.max(1, Math.ceil(values.length * 0.01));
  let sum = 0;
  for (let i = 0; i < top; i += 1) sum += values[i];
  return contrastRatio(textLuminance, sum / top);
}

/**
 * Maximum number of general flashes in any rolling one-second window of a
 * relative-luminance series (one value per frame, 0 to 1).
 *
 * After WCAG 2.3.1: a flash is a pair of opposing changes in relative
 * luminance of at least 0.10 where the darker state is below 0.80. Swings
 * are found with a zigzag over the series (a swing ends when luminance
 * reverses by 0.10), so a change spread over several frames counts as one.
 * Each qualifying change is one half of a flash, and a window's flash count
 * is its change count halved and rounded UP: a window holding 7 changes
 * reports 4, not 3. Conservative on purpose.
 */
export function generalFlashCount(luminanceSeries, fps) {
  const pivots = zigzagPivots(luminanceSeries, FLASH_DELTA);
  const changeFrames = [];
  for (let k = 1; k < pivots.length; k += 1) {
    if (Math.min(pivots[k - 1].value, pivots[k].value) < FLASH_DARK_CEILING) {
      changeFrames.push(pivots[k].frame);
    }
  }
  const window = Math.max(1, Math.round(fps));
  let max = 0;
  let start = 0;
  for (let end = 0; end < changeFrames.length; end += 1) {
    while (changeFrames[end] - changeFrames[start] >= window) start += 1;
    max = Math.max(max, Math.ceil((end - start + 1) / 2));
  }
  return max;
}

/** True when no one-second window holds more than 3 general flashes. */
export function flashSafe(luminanceSeries, fps) {
  return generalFlashCount(luminanceSeries, fps) <= MAX_FLASHES_PER_SECOND;
}

/** Turning points of `series`, ignoring reversals smaller than `delta`. */
function zigzagPivots(series, delta) {
  const pivots = [];
  if (series.length < 2) return pivots;
  let direction = 0;
  let hi = series[0];
  let hiAt = 0;
  let lo = series[0];
  let loAt = 0;
  let extreme = 0;
  let extremeAt = 0;
  for (let i = 1; i < series.length; i += 1) {
    const v = series[i];
    if (direction === 0) {
      if (v > hi) { hi = v; hiAt = i; }
      if (v < lo) { lo = v; loAt = i; }
      if (hi - v >= delta) {
        pivots.push({ frame: hiAt, value: hi });
        direction = -1;
        extreme = v;
        extremeAt = i;
      } else if (v - lo >= delta) {
        pivots.push({ frame: loAt, value: lo });
        direction = 1;
        extreme = v;
        extremeAt = i;
      }
    } else if (direction > 0) {
      if (v > extreme) { extreme = v; extremeAt = i; }
      else if (extreme - v >= delta) {
        pivots.push({ frame: extremeAt, value: extreme });
        direction = -1;
        extreme = v;
        extremeAt = i;
      }
    } else if (v < extreme) {
      extreme = v;
      extremeAt = i;
    } else if (v - extreme >= delta) {
      pivots.push({ frame: extremeAt, value: extreme });
      direction = 1;
      extreme = v;
      extremeAt = i;
    }
  }
  if (direction !== 0) pivots.push({ frame: extremeAt, value: extreme });
  return pivots;
}

/**
 * Mean relative luminance per frame, for the whole frame and for each cell
 * of a `grid` x `grid` split (default 4x4, row-major). Feed each series to
 * flashSafe.
 *
 * A whole-frame mean dilutes a localized flash: one cell of sixteen
 * swinging 0 to 1 moves the mean by only 0.0625. Checking the cells too
 * catches it. This is a conservative approximation and NOT a WCAG
 * conformance claim: WCAG 2.3.1 measures flashes over a fixed fraction of a
 * 10-degree visual field (and red flashes separately), not over a pixel
 * grid, and this code knows neither viewing distance nor display size.
 *
 * @param {ArrayLike<number>[]} frames RGBA buffers, all width x height
 * @returns {{whole: number[], cells: number[][]}} cells[c][frameIndex]
 */
export function luminanceSeries(frames, width, height, { grid = 4 } = {}) {
  const whole = [];
  const cells = Array.from({ length: grid * grid }, () => []);
  const xs = Array.from({ length: grid + 1 }, (_, k) => Math.floor((k * width) / grid));
  const ys = Array.from({ length: grid + 1 }, (_, k) => Math.floor((k * height) / grid));
  for (const rgba of frames) {
    assertFrame(rgba, width, height);
    let total = 0;
    for (let cy = 0; cy < grid; cy += 1) {
      for (let cx = 0; cx < grid; cx += 1) {
        let sum = 0;
        for (let y = ys[cy]; y < ys[cy + 1]; y += 1) {
          for (let x = xs[cx]; x < xs[cx + 1]; x += 1) {
            const i = (y * width + x) * 4;
            sum += relativeLuminance(rgba[i], rgba[i + 1], rgba[i + 2]);
          }
        }
        total += sum;
        const area = (xs[cx + 1] - xs[cx]) * (ys[cy + 1] - ys[cy]);
        cells[cy * grid + cx].push(area === 0 ? 0 : sum / area);
      }
    }
    whole.push(total / (width * height));
  }
  return { whole, cells };
}
