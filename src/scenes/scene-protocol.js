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
 *
 * A scene that listens (docs/plans/LIVE-CURRENT.md §20) is also given the
 * reader's input, as plain numbers and short strings the host builds, and
 * says what the reader set (`emit`) and what widgets it has (`widgets`); the
 * host reads both again as untrusted and holds them to SCENE_LIMITS. While
 * paused, its input is drawn by one frame at the same scene time (`dt` 0). A
 * scene that does not listen is given none of it, and says nothing new.
 */
export const SCENE_PROTOCOL_VERSION = 1;

/** Host → worker. */
export const TO_WORKER = Object.freeze({
  init: 'scene/init',          // { version, code, width, height, dpr, theme, reducedMotion, library, canvas }  library: the style's rise.lib defaults
  frame: 'scene/frame',        // { t, dt }  scene time in ms, and the step since the last frame
  cue: 'scene/cue',            // { name, instant }
  resize: 'scene/resize',      // { width, height, dpr }
  input: 'scene/input',        // { kind, x, y, buttons, key, modifiers }  the reader's input, to a scene that listens
  dispose: 'scene/dispose'
});

/** Worker → host. */
export const TO_HOST = Object.freeze({
  ready: 'scene/ready',        // { reportsCompletion, listens }
  frameDone: 'scene/frame-done', // { t, ms }  how long the frame took to draw
  cued: 'scene/cued',          // { name }
  done: 'scene/done',          // the scene says its current hold may end
  luma: 'scene/luma',          // { value } mean brightness 0..1 of a coarse sample, for the flash gate
  emit: 'scene/emit',          // { changes: [[control, value]], refused: [[control, reason]] }  what the reader set
  widgets: 'scene/widgets',    // { widgets: [{ id, kind, label, value, rect }] }  the scene's widgets, mirrored for assistive technology and touch
  error: 'scene/error'         // { message, where, phase }  phase: 'load' | 'init' | 'frame' | 'cue' | 'input'
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
  maxDpr: 2,
  /** Pointer inputs a listening scene is given a second; moves beyond it are coalesced, the latest kept. */
  inputPointerPerSecond: 120,
  /** Key inputs a listening scene is given a second; keys beyond it are dropped. */
  inputKeysPerSecond: 30,
  /** What the reader set, taken from one control a second; the trailing value is kept. */
  emitPerSecond: 10,
  /** Distinct controls (and widgets) one scene may report. */
  emitControls: 64,
  /** An emit is taken only this soon after an input the host delivered. */
  emitAfterInputMs: 1000,
  /** A control's id, at most, of [a-z0-9-]. */
  controlLength: 40,
  /** A string value, at most. */
  valueLength: 80,
  /** A widget's label as the host mirrors it, at most. */
  labelLength: 40
});

/** What a scene may say it listens to (`export const listens`, `rise.listen`). */
export const SCENE_LISTENS = Object.freeze(['pointer', 'keys']);

/** The inputs a listening scene is given, each by the kind it listens to. */
export const SCENE_INPUTS = Object.freeze({
  pointerdown: 'pointer', pointermove: 'pointer', pointerup: 'pointer', pointercancel: 'pointer', keydown: 'keys', keyup: 'keys'
});

/** The instrument's keys (src/live/host/stage-controls.js) and Escape: the stage's, never a scene's. */
export const INSTRUMENT_KEYS = Object.freeze([' ', 'r', 'R', 'f', 'F', '-', '_', '=', '+', '[', ']', 'Escape']);

const ARROW_KEYS = Object.freeze(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

/** Whether a key may reach a focused scene: an arrow, or one printable character that is not the instrument's. */
export function sceneKey(key) {
  if (typeof key !== 'string') return false;
  if (ARROW_KEYS.includes(key)) return true;
  return [...key].length === 1 && !INSTRUMENT_KEYS.includes(key) && !/[\p{Cc}\p{Cf}\s]/u.test(key);
}

/** A control's id: what `rise.emit` and every widget are named by. */
export const CONTROL_PATTERN = new RegExp(`^[a-z0-9-]{1,${SCENE_LIMITS.controlLength}}$`, 'u');

/** The widgets of `rise.lib` (scene-widgets.js), as the host mirrors them. */
export const SCENE_WIDGETS = Object.freeze(['slider', 'point', 'step']);

/** Why an emit was dropped. */
export const EMIT_REFUSALS = Object.freeze(['control', 'value', 'controls', 'unprompted']);

/** A value the reader set: a finite number, a boolean, or a string of at most `valueLength` characters. */
export function emitValue(value) {
  return (typeof value === 'number' && Number.isFinite(value)) || typeof value === 'boolean'
    || (typeof value === 'string' && value.length <= SCENE_LIMITS.valueLength);
}

/** A message is a plain object with a known type; anything else is dropped unread. */
export function knownMessage(data, types) {
  return Boolean(data) && typeof data === 'object' && !Array.isArray(data)
    && typeof data.type === 'string' && Object.values(types).includes(data.type);
}
