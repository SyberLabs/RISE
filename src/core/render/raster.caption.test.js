import { describe, expect, it } from 'vitest';
import { RENDER_BACKGROUND, safeAreasFor } from './layout.js';
import { renderFrameRgba } from './raster.js';

const plan = {
  viewport: { width: 1080, height: 1920 },
  frameRate: { numerator: 24, denominator: 1 },
  frameCount: 1,
  durationMs: 1000,
  seed: 'caption-clerk',
  atoms: [{ startMs: 0, endMs: 1000, text: 'HELLO' }],
  visualRuns: [],
  safeAreas: safeAreasFor({ width: 1080, height: 1920 })
};

function countPainted(frame, y0, y1, pred) {
  let n = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const i = (y * frame.width + x) * 4;
      const r = frame.rgba[i];
      const g = frame.rgba[i + 1];
      const b = frame.rgba[i + 2];
      if (r === RENDER_BACKGROUND.r && g === RENDER_BACKGROUND.g && b === RENDER_BACKGROUND.b) {
        continue;
      }
      if (!pred || pred(r, g, b)) n += 1;
    }
  }
  return n;
}

describe('clerk caption burn-in', () => {
  it('keeps the profile text region when caption is omitted', () => {
    const plain = renderFrameRgba(plan, 0, { scale: 1 });
    const region = plan.safeAreas.text;
    expect(countPainted(plain, region.y, region.y + 20)).toBeGreaterThan(20);
  });

  it('honors caption color and top-center placement', () => {
    const captioned = renderFrameRgba(plan, 0, {
      scale: 1,
      caption: { color: '#FF0000', position: 'top-center' }
    });
    const redAtTop = countPainted(
      captioned,
      0,
      Math.round(1920 * 0.2),
      (r, g, b) => r > 200 && g < 40 && b < 40
    );
    const defaultBand = plan.safeAreas.text;
    expect(redAtTop).toBeGreaterThan(20);
    expect(countPainted(captioned, defaultBand.y, defaultBand.y + 20)).toBe(0);
  });
});
