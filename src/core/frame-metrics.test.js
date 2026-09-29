import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  flashSafe,
  frameStats,
  generalFlashCount,
  luminanceSeries,
  meanAbsDiff,
  relativeLuminance,
  textContrast
} from './frame-metrics.js';

/** A width x height RGBA frame; `paint(x, y)` returns [r, g, b]. */
function frame(width, height, paint) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = paint(x, y);
      const i = (y * width + x) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

const solid = (width, height, rgb) => frame(width, height, () => rgb);

/** Square wave between `low` and `high` at `hz`, sampled at `fps`. */
function square(hz, fps, seconds, low = 0.05, high = 0.65) {
  const out = [];
  for (let i = 0; i < fps * seconds; i += 1) {
    out.push(Math.floor((i * 2 * hz) / fps) % 2 === 0 ? low : high);
  }
  return out;
}

describe('relativeLuminance and contrastRatio', () => {
  it('matches the WCAG definitions at the extremes', () => {
    expect(relativeLuminance(0, 0, 0)).toBe(0);
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 10);
  });

  it('gives black on white as 21:1, in either argument order', () => {
    const white = relativeLuminance(255, 255, 255);
    const black = relativeLuminance(0, 0, 0);
    expect(contrastRatio(black, white)).toBeCloseTo(21, 10);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 10);
  });

  it('gives identical colours 1:1', () => {
    const grey = relativeLuminance(119, 119, 119);
    expect(contrastRatio(grey, grey)).toBe(1);
  });
});

describe('frameStats', () => {
  it('reports zero lit coverage for an all-black frame', () => {
    const stats = frameStats(solid(8, 8, [0, 0, 0]), 8, 8);
    expect(stats.litCoverage).toBe(0);
    expect(stats.p95Luminance).toBe(0);
    expect(stats.meanSaturationLit).toBe(0);
  });

  it('measures the lit fraction against the 0.15 luminance threshold', () => {
    // Left half white, right half black.
    const rgba = frame(10, 4, x => (x < 5 ? [255, 255, 255] : [0, 0, 0]));
    const stats = frameStats(rgba, 10, 4);
    expect(stats.litCoverage).toBe(0.5);
    expect(stats.p95Luminance).toBeCloseTo(1, 10);
    expect(stats.meanSaturationLit).toBe(0);
  });

  it('does not count pixels at or below the threshold', () => {
    // Luminance of grey 100 is about 0.127, below 0.15.
    expect(frameStats(solid(4, 4, [100, 100, 100]), 4, 4).litCoverage).toBe(0);
    expect(frameStats(solid(4, 4, [120, 120, 120]), 4, 4).litCoverage).toBe(1);
  });

  it('averages saturation over lit pixels only', () => {
    // One saturated red lit pixel, the rest black: saturation is 1, not 1/16.
    const rgba = frame(4, 4, (x, y) => (x === 0 && y === 0 ? [255, 0, 0] : [0, 0, 0]));
    // Pure red luminance 0.2126 is above 0.15.
    const stats = frameStats(rgba, 4, 4);
    expect(stats.litCoverage).toBe(1 / 16);
    expect(stats.meanSaturationLit).toBe(1);
  });

  it('leaves the excluded rectangle out of every statistic', () => {
    // Left half white, right half black; excluding the white half leaves black.
    const rgba = frame(10, 4, x => (x < 5 ? [255, 255, 255] : [0, 0, 0]));
    const stats = frameStats(rgba, 10, 4, { exclude: { x: 0, y: 0, w: 5, h: 4 } });
    expect(stats.litCoverage).toBe(0);
    expect(stats.p95Luminance).toBe(0);
  });
});

describe('meanAbsDiff', () => {
  it('is zero for identical frames and 1 for black against white', () => {
    const black = solid(4, 4, [0, 0, 0]);
    const white = solid(4, 4, [255, 255, 255]);
    expect(meanAbsDiff(black, black)).toBe(0);
    expect(meanAbsDiff(black, white)).toBe(1);
  });

  it('ignores alpha', () => {
    const a = solid(2, 2, [10, 20, 30]);
    const b = solid(2, 2, [10, 20, 30]);
    b[3] = 0;
    expect(meanAbsDiff(a, b)).toBe(0);
  });

  it('rejects frames of different sizes', () => {
    expect(() => meanAbsDiff(solid(2, 2, [0, 0, 0]), solid(3, 2, [0, 0, 0]))).toThrow(RangeError);
  });
});

describe('textContrast', () => {
  it('is 21:1 for black text over a white box', () => {
    const rgba = solid(10, 10, [255, 255, 255]);
    const box = { x: 2, y: 2, w: 4, h: 4 };
    expect(textContrast(rgba, 10, 10, box, 0)).toBeCloseTo(21, 10);
  });

  it('measures against the brightest 1% inside the box, not the rest of the frame', () => {
    // Dark frame; a bright spot outside the box must not count.
    const rgba = frame(20, 20, (x, y) => (x === 19 && y === 19 ? [255, 255, 255] : [0, 0, 0]));
    const box = { x: 0, y: 0, w: 10, h: 10 };
    expect(textContrast(rgba, 20, 20, box, 1)).toBeCloseTo(1.05 / 0.05, 10);
  });

  it('finds a bright spot that is inside the box', () => {
    // One white pixel in a 10x10 box is exactly the brightest 1% of 100.
    const rgba = frame(10, 10, (x, y) => (x === 3 && y === 3 ? [255, 255, 255] : [0, 0, 0]));
    const box = { x: 0, y: 0, w: 10, h: 10 };
    expect(textContrast(rgba, 10, 10, box, 1)).toBeCloseTo(1, 10);
  });
});

describe('generalFlashCount and flashSafe', () => {
  it('finds no flash in a steady bright frame', () => {
    const series = new Array(90).fill(0.9);
    expect(generalFlashCount(series, 30)).toBe(0);
    expect(flashSafe(series, 30)).toBe(true);
  });

  it('fails a 5 Hz square wave at 30 fps', () => {
    const series = square(5, 30, 3);
    expect(generalFlashCount(series, 30)).toBe(5);
    expect(flashSafe(series, 30)).toBe(false);
  });

  it('passes a 2 Hz square wave at 30 fps', () => {
    const series = square(2, 30, 3);
    expect(generalFlashCount(series, 30)).toBeLessThanOrEqual(3);
    expect(flashSafe(series, 30)).toBe(true);
  });

  it('accepts 3 flashes in a second and rejects 4', () => {
    expect(flashSafe(square(3, 30, 3), 30)).toBe(true);
    expect(flashSafe(square(4, 30, 3), 30)).toBe(false);
  });

  it('ignores changes smaller than 0.10', () => {
    const series = square(5, 30, 3, 0.4, 0.49);
    expect(generalFlashCount(series, 30)).toBe(0);
  });

  it('ignores flicker whose darker state is at or above 0.80', () => {
    const series = square(5, 30, 3, 0.82, 0.95);
    expect(generalFlashCount(series, 30)).toBe(0);
  });

  it('sees a swing that is spread over several frames', () => {
    // 0.05 -> 0.65 in 0.1 steps, 5 Hz: still a change of 0.6.
    const ramp = [];
    for (let cycle = 0; cycle < 15; cycle += 1) {
      ramp.push(0.05, 0.25, 0.45, 0.65, 0.45, 0.25);
    }
    expect(flashSafe(ramp, 30)).toBe(false);
  });

  it('handles empty and single-frame series', () => {
    expect(generalFlashCount([], 30)).toBe(0);
    expect(generalFlashCount([0.5], 30)).toBe(0);
  });
});

describe('luminanceSeries', () => {
  it('returns one whole-frame value and grid*grid cell values per frame', () => {
    const frames = [solid(8, 8, [255, 255, 255]), solid(8, 8, [0, 0, 0])];
    const { whole, cells } = luminanceSeries(frames, 8, 8, { grid: 4 });
    expect(whole).toHaveLength(2);
    expect(cells).toHaveLength(16);
    expect(cells[0]).toHaveLength(2);
    expect(whole[0]).toBeCloseTo(1, 10);
    expect(whole[1]).toBe(0);
  });

  it('catches a flash confined to one grid cell that the whole-frame mean dilutes', () => {
    const fps = 30;
    const width = 8;
    const height = 8;
    // Top-left 2x2 pixels (one cell of a 4x4 grid) flash white at 5 Hz over black.
    const on = frame(width, height, (x, y) => (x < 2 && y < 2 ? [255, 255, 255] : [0, 0, 0]));
    const off = solid(width, height, [0, 0, 0]);
    const frames = square(5, fps, 3).map(v => (v > 0.5 ? on : off));

    const { whole, cells } = luminanceSeries(frames, width, height, { grid: 4 });

    // One cell of sixteen: the whole-frame swing is 1/16 = 0.0625, under 0.10.
    expect(flashSafe(whole, fps)).toBe(true);
    // The cell that flashes swings by the full range and fails.
    expect(flashSafe(cells[0], fps)).toBe(false);
    expect(cells.some(series => !flashSafe(series, fps))).toBe(true);
    // The other fifteen cells are steady.
    expect(cells.slice(1).every(series => flashSafe(series, fps))).toBe(true);
  });
});
