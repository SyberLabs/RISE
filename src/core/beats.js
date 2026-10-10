/**
 * Beats: the time a model composes.
 *
 * A `rise.current.v2` is a sequence of beats over a few scenes
 * (docs/superpowers/specs/2026-10-08-creative-control-design.md §5). A beat
 * says and shows a sentence, holds while the scene plays, or shows a line
 * nobody says. Validation here refuses with a code and a path, as the Current
 * does; nothing is clamped or quietly dropped.
 *
 * Lowering turns beats into the passages the score and the Player already
 * understand: one synthetic passage per beat, whose text is what is shown, and
 * beside it what is spoken (the voice's text), the hold the beat asks for, the
 * engine of the scene running under it, its sound as an audio cue, and the
 * typography and cue the layers render later. A hold's passage is the one
 * marker the chunker already turns into a timed, silent atom; the compiler
 * then gives that atom the hold's own duration (rise-current.js).
 *
 * A scene names a native engine and its parameters, held to the engine's
 * manifest (src/scenes/manifests.js); a cue names one of the running scene's
 * cues, or sets one of its cueable parameters. A generated scene is code: an
 * ES module with a default export, checked here only for its shape and size
 * (what it may reference is the server's static admission, and the worker's
 * own guard); any cue name is its to interpret. A figure is SVG, checked
 * here only for its size (its markup is svg-admission.js's, at the server and
 * again in the card); it takes no cue.
 */
import { soundKind } from '../audio/sound-ids.js';
import { fail, id, keys, object, spokenText } from './current-validation.js';
import { TYPE_NAMES } from './typography.js';
import { EXPERIENCE_PROGRAM_LIMITS, sceneCodeBytes } from './experience-program.js';
import { cueCommands, manifestFor, SCENE_ENGINES as ENGINES, validateSceneParams } from '../scenes/manifests.js';

export const BEAT_LIMITS = Object.freeze({
  beats: 64,
  scenes: 8,
  code: EXPERIENCE_PROGRAM_LIMITS.maxSceneCodeBytes,
  svg: EXPERIENCE_PROGRAM_LIMITS.maxSceneSvgBytes,
  text: 4_000,
  totalText: 20_000,
  id: 120,
  cue: 40,
  emphasis: 8,
  emphasisLength: 40,
  holdMinMs: 200,
  holdMaxMs: 60_000,
  transitionMaxMs: 5_000,
  transitionDefaultMs: 600
});

export const BEAT_PLACES = Object.freeze(['centre', 'caption', 'top', 'left', 'right', 'none']);
export const BEAT_SIZES = Object.freeze(['smaller', 'as-set', 'larger', 'display']);
/** Faces by role, and the faces RISE hosts by id (typography.js). */
export const BEAT_TYPES = TYPE_NAMES;
/** The engines a native scene may name: every one with a manifest (src/scenes/manifests.js). */
export const SCENE_ENGINES = ENGINES;
/** The guide's account of the engines, re-exported here so the live layer reaches it through the core. */
export { describeManifests } from '../scenes/manifests.js';
/** What a native scene's parameters and cues may be, by the same route: the line format checks them as it reads. */
export { cueCommands, validateSceneParams } from '../scenes/manifests.js';
/** A generated scene's frame budget, for the guide, by the same route. */
export { SCENE_LIMITS } from '../scenes/scene-protocol.js';
/** The names a scene may not use, declared once in scene-bans.js; the guide names them by this route. */
export { BANNED_SCENE_NAMES } from '../scenes/scene-bans.js';
/** The one source text that chunks to a single silent, timed atom (chunker.js PAUSE_DURATIONS). */
export const HOLD_MARKER = '[HOLD]';

/** What a cue may be, as a regex source: the validator's, and the JSON Schema's pattern for it (worker/mcp-server.mjs). */
export const BEAT_CUE_PATTERN = '^[A-Za-z0-9_:=.-]+$';
const CUE = new RegExp(BEAT_CUE_PATTERN, 'u');

export function validateScenes(value, path) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > BEAT_LIMITS.scenes) {
    fail('SCENE_COUNT', path, `Expected at most ${BEAT_LIMITS.scenes} scenes`);
  }
  const seen = new Set();
  return value.map((item, index) => {
    const at = `${path}[${index}]`;
    const scene = object(item, at);
    keys(scene, ['id', 'engine', 'params', 'code', 'svg'], at);
    const sceneId = id(scene.id, BEAT_LIMITS.id, `${at}.id`);
    if (seen.has(sceneId)) fail('CURRENT_DUPLICATE_ID', `${at}.id`, 'Duplicate scene id');
    seen.add(sceneId);
    if (scene.svg !== undefined) {
      if (scene.engine !== undefined || scene.params !== undefined || scene.code !== undefined) {
        fail('SCENE_SVG', at, 'A scene is a native engine with params, generated code, or an SVG figure, one of them');
      }
      if (typeof scene.svg !== 'string' || sceneCodeBytes(scene.svg) > BEAT_LIMITS.svg) {
        fail('SCENE_SVG', `${at}.svg`, `A figure is an SVG document of at most ${BEAT_LIMITS.svg.toLocaleString('en-US')} bytes`);
      }
      return { id: sceneId, svg: scene.svg };
    }
    if (scene.code !== undefined) {
      if (scene.engine !== undefined || scene.params !== undefined) {
        fail('SCENE_CODE', at, 'A scene is a native engine with params, or generated code, not both');
      }
      if (typeof scene.code !== 'string' || sceneCodeBytes(scene.code) > BEAT_LIMITS.code) {
        fail('SCENE_CODE', `${at}.code`, `A scene's code is the text of an ES module of at most ${BEAT_LIMITS.code.toLocaleString('en-US')} bytes`);
      }
      if (!/\bexport\s+default\b/u.test(scene.code)) {
        fail('SCENE_CODE', `${at}.code`, 'A scene is an ES module with a default export: export default function scene(rise) { return { frame(t, dt) {} }; }');
      }
      return { id: sceneId, code: scene.code };
    }
    if (!SCENE_ENGINES.includes(scene.engine)) {
      fail('SCENE_ENGINE', `${at}.engine`, `Unknown engine; use one of ${SCENE_ENGINES.join(', ')}`);
    }
    const params = validateSceneParams(scene.engine, scene.params, `${at}.params`);
    return Object.keys(params).length ? { id: sceneId, engine: scene.engine, params } : { id: sceneId, engine: scene.engine };
  });
}

function hold(value, path) {
  const source = object(value, path);
  keys(source, ['ms', 'maxMs'], path);
  const { ms, maxMs } = source;
  if (!Number.isInteger(ms) || ms < BEAT_LIMITS.holdMinMs || ms > BEAT_LIMITS.holdMaxMs) {
    fail('BEAT_HOLD', `${path}.ms`, `A hold lasts ${BEAT_LIMITS.holdMinMs} to ${BEAT_LIMITS.holdMaxMs} ms`);
  }
  if (maxMs === undefined) return { ms };
  if (!Number.isInteger(maxMs) || maxMs < ms || maxMs > BEAT_LIMITS.holdMaxMs) {
    fail('BEAT_HOLD', `${path}.maxMs`, `maxMs is at least ms and at most ${BEAT_LIMITS.holdMaxMs}`);
  }
  return { ms, maxMs };
}

function oneOf(value, list, code, path, what) {
  if (!list.includes(value)) fail(code, path, `Unknown ${what}; use one of ${list.join(', ')}`);
  return value;
}

/**
 * @param {unknown} value the model's beats
 * @param {string} path where they are, for refusals
 * @param {{scenes: Array<{id: string, engine?: string, code?: string}>}} context the scenes a beat may start or cue
 * @returns {Array<object>} the beats, each with its `kind`, frozen
 */
export function validateBeats(value, path, { scenes }) {
  const sceneOf = new Map(scenes.map(scene => [scene.id, scene]));
  let running = null;
  if (!Array.isArray(value) || value.length < 1 || value.length > BEAT_LIMITS.beats) {
    fail('BEAT_COUNT', path, `Expected 1 to ${BEAT_LIMITS.beats} beats`);
  }
  let total = 0;
  return value.map((item, index) => {
    const at = `${path}[${index}]`;
    const beat = object(item, at);
    keys(beat, ['say', 'show', 'hold', 'scene', 'cue', 'transition', 'place', 'size', 'type', 'emphasis', 'sound'], at);
    const has = key => beat[key] !== undefined;
    let kind;
    if (has('say') && !has('hold')) kind = 'say';
    else if (has('hold') && !has('say') && !has('show')) kind = 'hold';
    else if (has('hold') && has('show') && !has('say')) kind = 'show';
    else fail('BEAT_KIND', at, 'A beat says (with or without show), holds, or shows with a hold');

    const out = { kind };
    if (kind !== 'hold') {
      if (has('say')) out.say = spokenText(beat.say, BEAT_LIMITS.text, `${at}.say`);
      out.show = has('show') ? spokenText(beat.show, BEAT_LIMITS.text, `${at}.show`) : out.say;
      total += (out.say?.length ?? 0) + (has('show') ? out.show.length : 0);
      if (total > BEAT_LIMITS.totalText) {
        fail('CURRENT_TOTAL_TEXT', path, `Current exceeds ${BEAT_LIMITS.totalText.toLocaleString('en-US')} characters`);
      }
    }
    if (has('hold')) out.hold = hold(beat.hold, `${at}.hold`);
    if (has('scene')) {
      if (!sceneOf.has(beat.scene)) fail('BEAT_SCENE', `${at}.scene`, 'A beat starts a scene the Current declares');
      out.scene = beat.scene;
      running = beat.scene;
    }
    if (has('cue')) {
      if (typeof beat.cue !== 'string' || !CUE.test(beat.cue) || beat.cue.length > BEAT_LIMITS.cue) {
        fail('BEAT_CUE', `${at}.cue`, `A cue is a name of at most ${BEAT_LIMITS.cue} letters, digits, _, -, : or =`);
      }
      if (running === null) fail('BEAT_CUE', `${at}.cue`, 'A cue needs a scene running: start one with "scene" first');
      const { engine, code, svg } = sceneOf.get(running);
      if (svg !== undefined) fail('BEAT_CUE', `${at}.cue`, 'An SVG figure takes no cues');
      if (code === undefined && cueCommands(engine, beat.cue) === null) {
        const manifest = manifestFor(engine);
        const named = Object.keys(manifest.cues);
        const settable = Object.entries(manifest.parameters).filter(([, spec]) => spec.cueable).map(([name]) => `set:${name}=<value>`);
        const offers = [...named, ...settable];
        fail('BEAT_CUE', `${at}.cue`, offers.length ? `${engine} takes the cues ${offers.join(', ')}` : `${engine} takes no cues`);
      }
      out.cue = beat.cue;
    }
    if (has('transition')) {
      const transition = object(beat.transition, `${at}.transition`);
      keys(transition, ['ms'], `${at}.transition`);
      if (!Number.isInteger(transition.ms) || transition.ms < 0 || transition.ms > BEAT_LIMITS.transitionMaxMs) {
        fail('BEAT_TRANSITION', `${at}.transition.ms`, `A transition lasts 0 to ${BEAT_LIMITS.transitionMaxMs} ms`);
      }
      out.transition = { ms: transition.ms };
    }
    if (has('place')) out.place = oneOf(beat.place, BEAT_PLACES, 'BEAT_PLACE', `${at}.place`, 'place');
    if (has('size')) out.size = oneOf(beat.size, BEAT_SIZES, 'BEAT_SIZE', `${at}.size`, 'size');
    if (has('type')) out.type = oneOf(beat.type, BEAT_TYPES, 'BEAT_TYPE', `${at}.type`, 'face');
    if (has('emphasis')) {
      if (!Array.isArray(beat.emphasis) || beat.emphasis.length > BEAT_LIMITS.emphasis
        || beat.emphasis.some(word => typeof word !== 'string' || !word.trim() || word.length > BEAT_LIMITS.emphasisLength)) {
        fail('BEAT_EMPHASIS', `${at}.emphasis`, `At most ${BEAT_LIMITS.emphasis} words of at most ${BEAT_LIMITS.emphasisLength} characters`);
      }
      out.emphasis = [...beat.emphasis];
    }
    if (has('sound')) {
      if (typeof beat.sound !== 'string' || soundKind(beat.sound) === null) {
        fail('BEAT_SOUND', `${at}.sound`, 'Unknown sound; use an id from RISE’s sound list');
      }
      out.sound = beat.sound;
    }
    return Object.freeze(out);
  });
}

/** The audio cue a sound id lowers to: a bed, a tone preset, or silence. */
function audioCue(soundId) {
  const kind = soundKind(soundId);
  if (kind === 'soundscape') return { kind: 'soundscape', soundscapeId: soundId };
  if (kind === 'tone') return { kind: 'tone', presetId: soundId };
  return { kind: 'silence' };
}

/**
 * Lower validated beats to passages. A beat that shows text and sets no place
 * or size takes the style's (styles.js); a hold shows no text and takes none.
 * @param {{scenes: Array<{id: string, engine: string}>, beats: Array<object>, typography?: {place: string, size: string}|null}} current
 * @returns {{segments: Array<object>, audio: Array<{segmentId: string, cue: object}>, spokenIds: Set<string>, unspokenIds: Set<string>}}
 */
export function lowerBeats({ scenes, beats, typography = null }) {
  const byId = new Map(scenes.map(scene => [scene.id, scene]));
  const segments = [];
  const audio = [];
  const spokenIds = new Set();
  const unspokenIds = new Set();
  let running = null;
  beats.forEach((beat, index) => {
    const segmentId = `beat-${index}`;
    if (beat.scene !== undefined) running = beat.scene;
    const meta = {};
    for (const key of ['scene', 'cue', 'transition', 'place', 'size', 'type', 'emphasis']) {
      if (beat[key] !== undefined) meta[key] = beat[key];
    }
    if (typography && beat.kind !== 'hold') {
      for (const key of ['place', 'size']) meta[key] ??= typography[key];
    }
    const segment = { id: segmentId, beat: meta };
    if (running !== null) {
      const scene = byId.get(running);
      segment.visual = scene.engine ?? 'scene';
      segment.scene = { ...scene };
    }
    if (beat.kind === 'hold') {
      segment.text = HOLD_MARKER;
      segment.spoken = null;
      segment.hold = { ms: beat.hold.ms, ...(beat.hold.maxMs === undefined ? {} : { maxMs: beat.hold.maxMs }), sceneId: running };
    } else if (beat.kind === 'show') {
      segment.text = beat.show;
      segment.spoken = null;
      segment.shownMs = beat.hold.ms;
    } else {
      segment.text = beat.show;
      segment.spoken = beat.say;
    }
    (segment.spoken === null ? unspokenIds : spokenIds).add(segmentId);
    if (beat.sound !== undefined) audio.push({ segmentId, cue: audioCue(beat.sound) });
    segments.push(segment);
  });
  return { segments, audio, spokenIds, unspokenIds };
}
