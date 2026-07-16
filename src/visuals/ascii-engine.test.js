import { describe, expect, it, vi } from 'vitest';
import {
  ASCII_DENSITY_RAMP,
  AsciiCanvasRenderer,
  asciiFrameToText,
  compileFieldPlanToAscii,
  compilePolylinesToAscii,
  compileSampledRaster,
  resolveAsciiGrid
} from './ascii-engine.js';

function sampled(columns, rows, painter) {
  const data = new Uint8ClampedArray(columns * rows * 4);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const [r, g, b, a = 255] = painter(x, y);
      const offset = (y * columns + x) * 4;
      data.set([r, g, b, a], offset);
    }
  }
  return data;
}

describe('hybrid ASCII compiler', () => {
  it('resolves a bounded character-aspect-corrected grid', () => {
    expect(resolveAsciiGrid(1920, 1080, { columns: 120 })).toEqual({ columns: 120, rows: 37 });
    expect(resolveAsciiGrid(100, 400, { columns: 500 }).columns).toBe(144);
  });

  it('maps tone deterministically while keeping a strict ASCII character set', () => {
    const pixels = sampled(8, 4, x => {
      const value = Math.round((x / 7) * 255);
      return [value, value, value, 255];
    });
    const first = compileSampledRaster(pixels, 8, 4, { monochrome: true, edgeThreshold: 0.24 });
    const second = compileSampledRaster(pixels, 8, 4, { monochrome: true, edgeThreshold: 0.24 });

    expect(first.glyphs).toBe(second.glyphs);
    expect(first.glyphs).toMatch(/^[\x20-\x7e]+$/);
    expect(first.glyphs.at(-1)).toBe(ASCII_DENSITY_RAMP.at(-1));
  });

  it('uses directional glyphs at strong edges', () => {
    const pixels = sampled(9, 5, x => x < 4 ? [0, 0, 0, 255] : [255, 255, 255, 255]);
    const frame = compileSampledRaster(pixels, 9, 5, { monochrome: true, edgeThreshold: 0.1 });
    expect(frame.glyphs).toContain('|');
  });

  it('preserves structural identity while progressive growth reveals more cells', () => {
    const input = {
      width: 100,
      height: 100,
      palette: ['#ff8844'],
      polylines: [{ color: '#ff8844', points: [[5, 5], [95, 5], [95, 95]] }]
    };
    const early = compilePolylinesToAscii(input, { columns: 40, rows: 20, progress: 0.25 });
    const complete = compilePolylinesToAscii(input, { columns: 40, rows: 20, progress: 1 });
    const occupied = frame => [...frame.glyphs].filter(char => char !== ' ').length;

    expect(occupied(complete)).toBeGreaterThan(occupied(early));
    expect(asciiFrameToText(complete)).toContain('-');
    expect(asciiFrameToText(complete)).toContain('|');
  });

  it('compiles a structured light field without rasterizing CSS', () => {
    const frame = compileFieldPlanToAscii({
      kind: 'linear',
      angle: 180,
      stops: [
        { offset: 0, color: { h: 220, s: 60, l: 20 } },
        { offset: 1, color: { h: 25, s: 80, l: 75 } }
      ]
    }, { columns: 40, rows: 20 });

    expect(frame.metadata.kind).toBe('field');
    expect(frame.glyphs).toMatch(/^[\x20-\x7e]+$/);
    expect(frame.palette.length).toBeGreaterThan(1);
  });

  it('renders bounded palette rows rather than one draw call per cell', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    const frame = compilePolylinesToAscii({
      width: 100,
      height: 100,
      palette: ['#ffffff'],
      polylines: [{ color: '#ffffff', points: [[0, 0], [100, 100]] }]
    }, { columns: 40, rows: 20 });
    const renderer = new AsciiCanvasRenderer(canvas);

    expect(renderer.render(frame)).toBe(true);
    const ctx = canvas.getContext('2d');
    expect(ctx.fillText).toHaveBeenCalled();
    expect(ctx.fillText.mock.calls.length).toBeLessThanOrEqual(frame.rows * frame.palette.length);
    for (const [text] of ctx.fillText.mock.calls) expect(text).toMatch(/^[\x20-\x7e]+$/);
    vi.clearAllMocks();
  });
});
