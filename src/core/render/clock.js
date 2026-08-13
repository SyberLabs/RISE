/**
 * Virtual render clock.
 *
 * Presentation time is rational and frame-addressable. Wall-clock timers,
 * requestAnimationFrame, and AudioContext.currentTime are not authority.
 *
 *   presentationTime(frame) = frame * frameRate.denominator / frameRate.numerator
 *
 * Arithmetic uses BigInt so 30 fps boundaries are exact. Integer milliseconds
 * are a derived display value and must not decide cue edges.
 */

import { fail } from './errors.js';
import { RENDER_LIMITS } from './limits.js';

export function validateFrameRate(value, path = '$.frameRate') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('RENDER_FRAME_RATE', 'Expected a frame-rate { numerator, denominator }', path);
  }
  const numerator = value.numerator;
  const denominator = value.denominator;
  if (!Number.isInteger(numerator) || numerator < 1 || numerator > RENDER_LIMITS.maxFrameRateNumerator) {
    fail('RENDER_FRAME_RATE',
      `Frame-rate numerator must be an integer from 1 to ${RENDER_LIMITS.maxFrameRateNumerator}`,
      `${path}.numerator`);
  }
  if (!Number.isInteger(denominator) || denominator < 1 || denominator > RENDER_LIMITS.maxFrameRateDenominator) {
    fail('RENDER_FRAME_RATE',
      `Frame-rate denominator must be an integer from 1 to ${RENDER_LIMITS.maxFrameRateDenominator}`,
      `${path}.denominator`);
  }
  return Object.freeze({ numerator, denominator });
}

export function presentationRational(frameIndex, frameRate) {
  if (!Number.isInteger(frameIndex) || frameIndex < 0) {
    fail('RENDER_FRAME_INDEX', 'Frame index must be a non-negative integer', '$.frameIndex');
  }
  const rate = validateFrameRate(frameRate);
  return Object.freeze({
    numerator: BigInt(frameIndex) * BigInt(rate.denominator),
    denominator: BigInt(rate.numerator)
  });
}

/** Truncated integer milliseconds — diagnostics only, never cue authority. */
export function presentationMs(frameIndex, frameRate) {
  const time = presentationRational(frameIndex, frameRate);
  return Number((time.numerator * 1000n) / time.denominator);
}

/**
 * Compare presentationTime(frame) to durationMs.
 * -1 before the duration, 0 exactly on it, 1 after.
 */
export function compareFrameToDuration(frameIndex, frameRate, durationMs) {
  const rate = validateFrameRate(frameRate);
  if (!Number.isInteger(durationMs) || durationMs < 0) {
    fail('RENDER_DURATION', 'Duration must be a non-negative integer millisecond count', '$.durationMs');
  }
  const left = BigInt(frameIndex) * BigInt(rate.denominator) * 1000n;
  const right = BigInt(durationMs) * BigInt(rate.numerator);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Number of frames whose presentation times cover [0, durationMs).
 * Frame `n-1` is the last frame strictly before duration; if duration falls
 * exactly on a frame time, that frame is the exclusive end and is omitted.
 */
export function frameCountForDuration(durationMs, frameRate) {
  const rate = validateFrameRate(frameRate);
  if (!Number.isInteger(durationMs) || durationMs < 0) {
    fail('RENDER_DURATION', 'Duration must be a non-negative integer millisecond count', '$.durationMs');
  }
  if (durationMs === 0) return 0;
  const numerator = BigInt(durationMs) * BigInt(rate.numerator);
  const denominator = BigInt(rate.denominator) * 1000n;
  const count = (numerator + denominator - 1n) / denominator;
  if (count > BigInt(RENDER_LIMITS.maxFrames)) {
    fail('RENDER_FRAME_BUDGET',
      `This duration produces more than ${RENDER_LIMITS.maxFrames} frames`,
      '$.durationMs',
      { durationMs, frameRate: rate, frameCount: Number(count) });
  }
  return Number(count);
}

export function lastFrameIndex(durationMs, frameRate) {
  const count = frameCountForDuration(durationMs, frameRate);
  return count === 0 ? null : count - 1;
}

/** First frame whose presentation time is >= ms (exclusive-end friendly). */
export function frameIndexAt(ms, frameRate) {
  const rate = validateFrameRate(frameRate);
  if (!Number.isInteger(ms) || ms < 0) {
    fail('RENDER_DURATION', 'Expected a non-negative integer millisecond count', '$.ms');
  }
  return Number((BigInt(ms) * BigInt(rate.numerator)) / (1000n * BigInt(rate.denominator)));
}
