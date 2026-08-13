import { describe, expect, it } from 'vitest';
import {
  compareFrameToDuration,
  frameCountForDuration,
  frameIndexAt,
  lastFrameIndex,
  presentationMs,
  presentationRational,
  validateFrameRate
} from './clock.js';
import { RenderError } from './errors.js';

const FPS30 = Object.freeze({ numerator: 30, denominator: 1 });

describe('virtual render clock', () => {
  it('keeps presentation time rational so 30 fps boundaries are exact', () => {
    const time = presentationRational(1, FPS30);
    expect(time.numerator).toBe(1n);
    expect(time.denominator).toBe(30n);
    expect(presentationMs(0, FPS30)).toBe(0);
    expect(presentationMs(30, FPS30)).toBe(1000);
    expect(presentationMs(29, FPS30)).toBe(966);
  });

  it('covers [0, duration) with an exclusive end on an exact frame time', () => {
    expect(frameCountForDuration(1000, FPS30)).toBe(30);
    expect(lastFrameIndex(1000, FPS30)).toBe(29);
    expect(compareFrameToDuration(29, FPS30, 1000)).toBe(-1);
    expect(compareFrameToDuration(30, FPS30, 1000)).toBe(0);
    expect(compareFrameToDuration(31, FPS30, 1000)).toBe(1);
  });

  it('counts frames for the vertical-slice duration without float accumulation', () => {
    expect(frameCountForDuration(27400, FPS30)).toBe(822);
    expect(compareFrameToDuration(821, FPS30, 27400)).toBe(-1);
    expect(compareFrameToDuration(822, FPS30, 27400)).toBe(0);
    expect(frameIndexAt(0, FPS30)).toBe(0);
    expect(frameIndexAt(1000, FPS30)).toBe(30);
  });

  it('refuses a zero or inverted frame rate', () => {
    expect(() => validateFrameRate({ numerator: 0, denominator: 1 }))
      .toThrow(RenderError);
    expect(() => validateFrameRate({ numerator: 30, denominator: 0 }))
      .toThrow(expect.objectContaining({ code: 'RENDER_FRAME_RATE' }));
  });
});
