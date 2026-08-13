/**
 * MP4 source-time mapping for a muted video cue.
 *
 * Presentation time is the render clock. Source time is where to sample
 * the admitted video. Video audio stays muted.
 */

import { PROGRAM_VIDEO_TIME_MODES } from '../experience-program.js';
import { fail } from './errors.js';

export function mapVideoSourceTime({
  presentationMs,
  activeFromMs,
  activeToMs,
  timeMode,
  sourceDurationMs,
  sourceFromMs = 0,
  sourceToMs = null
} = {}) {
  if (!PROGRAM_VIDEO_TIME_MODES.includes(timeMode)) {
    fail('RENDER_VIDEO_TIME_MODE', `Unknown video time mode: ${String(timeMode)}`, '$.timeMode');
  }
  if (!Number.isInteger(presentationMs) || !Number.isInteger(activeFromMs)
    || !Number.isInteger(activeToMs) || activeToMs <= activeFromMs) {
    fail('RENDER_VIDEO_WINDOW', 'Video cue window must be a half-open millisecond range', '$.activeFromMs');
  }
  if (!Number.isInteger(sourceDurationMs) || sourceDurationMs <= 0) {
    fail('RENDER_VIDEO_DURATION', 'Video source duration must be a positive integer', '$.sourceDurationMs');
  }
  if (presentationMs < activeFromMs || presentationMs >= activeToMs) return null;

  const elapsed = presentationMs - activeFromMs;
  const cueDuration = activeToMs - activeFromMs;
  const from = Number.isInteger(sourceFromMs) ? sourceFromMs : 0;
  const to = Number.isInteger(sourceToMs) ? sourceToMs : sourceDurationMs;
  const window = Math.max(1, to - from);
  const last = from + window - 1;

  let sourceMs;
  if (timeMode === 'cue') {
    sourceMs = from + elapsed;
    if (sourceMs > last) sourceMs = last;
  } else if (timeMode === 'fit-span') {
    sourceMs = from + Math.floor((elapsed * window) / cueDuration);
    if (sourceMs > last) sourceMs = last;
  } else if (timeMode === 'loop') {
    sourceMs = from + (elapsed % window);
  } else {
    sourceMs = from + elapsed;
    if (sourceMs > last) sourceMs = last;
  }

  if (sourceMs < 0) sourceMs = 0;
  if (sourceMs >= sourceDurationMs) sourceMs = sourceDurationMs - 1;
  return sourceMs;
}
