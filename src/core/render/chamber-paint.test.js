// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compileRenderPlan } from './plan.js';
import { openChamberPainter } from './chamber-paint.js';
import { buildVerticalSlice } from './vertical-slice.js';

let hasPlaywright = true;
try {
  await import('playwright');
} catch {
  hasPlaywright = false;
}

describe('Chamber RGBA paint', () => {
  it.skipIf(!hasPlaywright)('captures raw RGBA from one live stage, not a PNG screenshot', async () => {
    const slice = await buildVerticalSlice();
    const plan = compileRenderPlan(slice);
    let stage;
    try {
      stage = await openChamberPainter({
        plan,
        scale: 0.1,
        inventory: slice.inventory,
        ffmpegLog: () => {}
      });
      const frame = await stage.capture(0);
      expect(frame.format).not.toBe('png');
      expect(frame.png).toBeUndefined();
      expect(frame.width).toBeGreaterThan(0);
      expect(frame.height).toBeGreaterThan(0);
      expect(frame.rgba).toBeInstanceOf(Uint8ClampedArray);
      expect(frame.rgba.length).toBe(frame.width * frame.height * 4);
    } finally {
      await stage?.close();
    }
  }, 120_000);
});
