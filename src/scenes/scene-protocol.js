/**
 * What the Chamber and a scene worker say to each other
 * (docs/superpowers/specs/2026-10-08-creative-control-design.md §7–8).
 *
 * The host owns time: it sends frames while the reading plays and nothing
 * while it is paused, so scene time stops with the voice. The worker owns
 * drawing: it answers every frame with how long it took, reports a cue
 * handled, says `done` when a hold may end, samples its own picture for the
 * flash gate (the host cannot read a transferred canvas), and reports any
 * error with where it was. Nothing else crosses: no DOM, no host port, no
 * storage reaches the worker, and nothing the worker says is run by the host.
 */
export const SCENE_PROTOCOL_VERSION = 1;

/** Host → worker. */
export const TO_WORKER = Object.freeze({
  init: 'scene/init',          // { version, code, width, height, dpr, theme, reducedMotion, library, canvas }  library: the style's rise.lib defaults
  frame: 'scene/frame',        // { t, dt }  scene time in ms, and the step since the last frame
  cue: 'scene/cue',            // { name, instant }
  resize: 'scene/resize',      // { width, height, dpr }
  dispose: 'scene/dispose'
});

/** Worker → host. */
export const TO_HOST = Object.freeze({
  ready: 'scene/ready',        // { reportsCompletion }
  frameDone: 'scene/frame-done', // { t, ms }  how long the frame took to draw
  cued: 'scene/cued',          // { name }
  done: 'scene/done',          // the scene says its current hold may end
  luma: 'scene/luma',          // { value } mean brightness 0..1 of a coarse sample, for the flash gate
  error: 'scene/error'         // { message, where, phase }  phase: 'load' | 'init' | 'frame' | 'cue'
});

export const SCENE_LIMITS = Object.freeze({
  /** A frame slower than this is a failure outright. */
  frameHardMs: 200,
  /** Frames slower than this, three in one second, are a failure. */
  frameSoftMs: 24,
  frameSoftCount: 3,
  /** A worker that has not answered a frame for this long is gone. */
  silenceMs: 1000,
  /** A hold ended by the scene is honoured no sooner than this into the hold. */
  earliestDoneMs: 200,
  /** The flash gate's sample cadence. */
  lumaEveryMs: 100,
  /** Device pixel ratio is capped so a scene never draws more than this many pixels per CSS pixel. */
  maxDpr: 2
});

/** A message is a plain object with a known type; anything else is dropped unread. */
export function knownMessage(data, types) {
  return Boolean(data) && typeof data === 'object' && !Array.isArray(data)
    && typeof data.type === 'string' && Object.values(types).includes(data.type);
}
