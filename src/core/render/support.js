/**
 * Central render-support registry.
 *
 * Every canonical cue the Experience Program can name must be declared
 * native, degraded, or unsupported. Interactive presenters are not evidence
 * of export support. CI fails when the vocab grows without a declaration.
 *
 * Chamber engines and collections are native when the Playwright stage can
 * paint them at explicit t. Museum collections need admitted stills in
 * inventory — render never fetches AIC. Swell remains unsupported.
 * Unsupported required cues refuse preflight; they are never silently omitted.
 */

import {
  PROGRAM_AUDIO_KINDS,
  PROGRAM_NARRATION_KINDS,
  PROGRAM_READING_KINDS,
  PROGRAM_VISUAL_FIELD_RENDERERS,
  PROGRAM_VISUAL_KINDS
} from '../experience-program.js';
import { PROCEDURAL_PATTERN_IDS } from '../visual-registry.js';
import { isWorkEngineFamily } from '../../visuals/work-engines.js';
import {
  SEQUENCE_ASSET_PREFIX,
  sequenceAssetReferencesFromCue
} from '../visual-score-lane.js';
import { PINNED_RENDERER } from './environment.js';

const RENDER_STATUSES = new Set(['native', 'degraded', 'unsupported']);

function entry(cueKind, render, fields = {}) {
  if (!RENDER_STATUSES.has(render)) {
    throw new Error(`Render support for ${cueKind} must be native, degraded, or unsupported`);
  }
  return Object.freeze({
    cueKind,
    interactive: true,
    render,
    degradation: fields.degradation || null,
    reason: fields.reason || null,
    rendererVersion: PINNED_RENDERER.version,
    realtimeDependencies: Object.freeze([...(fields.realtimeDependencies || [])])
  });
}

const nativeSlice = (cueKind, realtimeDependencies) => entry(cueKind, 'native', {
  realtimeDependencies
});

const unsupported = (cueKind, reason, realtimeDependencies) => entry(cueKind, 'unsupported', {
  reason,
  realtimeDependencies
});

/**
 * Exhaustive declarations. Keys are cueKind strings produced by classifyCue.
 * Realtime dependencies are the current Chamber/cortex couplings — inventory
 * for adapters, not permission to use them during offline render.
 */
export const RENDER_SUPPORT = Object.freeze({
  'structural:movement': nativeSlice('structural:movement', [
    'session-compiler source order'
  ]),
  'structural:transition': nativeSlice('structural:transition', [
    'session-compiler authored boundary duration'
  ]),

  'visual:still': nativeSlice('visual:still', [
    'canvas still / CSS background',
    'no object-URL persistence'
  ]),
  'visual:focal': nativeSlice('visual:focal', [
    'canvas 2d / CSS glyph',
    'Rosa Mystica WebGL for rose'
  ]),
  'visual:field:focal': nativeSlice('visual:field:focal', [
    'canvas 2d / CSS glyph',
    'Rosa Mystica WebGL for rose'
  ]),
  'visual:field:attractor': nativeSlice('visual:field:attractor', [
    'AttractorField.tick at explicit t',
    'canvas 2d'
  ]),
  'visual:field:genesis': nativeSlice('visual:field:genesis', [
    'KleeEngine.render at genesisGrowProgress(t)',
    'canvas 2d'
  ]),

  'visual:sourced:project-image': nativeSlice('visual:sourced:project-image', [
    'blob/object-URL hydration at runtime',
    'canvas drawImage'
  ]),
  'visual:sourced:gallery': nativeSlice('visual:sourced:gallery', [
    'admitted stills in inventory',
    'canvas drawImage / putImageData'
  ]),
  'visual:sourced:collection': nativeSlice('visual:sourced:collection', [
    'admitted stills in inventory — render does not fetch museum APIs',
    'seeded pick among pinned works'
  ]),

  'visual:procedural:klee': nativeSlice('visual:procedural:klee', [
    'requestAnimationFrame in the Chamber',
    'canvas 2d',
    'preset randomness — render must pin seed'
  ]),
  'visual:procedural:turrell': nativeSlice('visual:procedural:turrell', [
    'Turrell.generate + canvas render',
    'preset randomness — render must pin seed'
  ]),
  'visual:procedural:fractal': nativeSlice('visual:procedural:fractal', [
    'FractalFlameGenerator at pinned seed',
    'canvas putImageData'
  ]),
  'visual:procedural:neural': nativeSlice('visual:procedural:neural', [
    'NeuralNetwork.generate at pinned seed',
    'canvas 2d'
  ]),
  'visual:procedural:rockgarden': nativeSlice('visual:procedural:rockgarden', [
    'RockGarden.generateRockGarden at pinned seed',
    'canvas 2d'
  ]),
  'visual:procedural:harmonograph': nativeSlice('visual:procedural:harmonograph', [
    'Harmonograph.generate + render(progress)',
    'canvas 2d'
  ]),
  'visual:procedural:ostensoria': nativeSlice('visual:procedural:ostensoria', [
    'Ostensoria.generate + render',
    'canvas 2d'
  ]),
  'visual:procedural:apparitio': nativeSlice('visual:procedural:apparitio', [
    'Apparitio.generate + render',
    'canvas 2d'
  ]),
  'visual:procedural:shuffled': nativeSlice('visual:procedural:shuffled', [
    'seeded pick among named collections',
    'same painters as a single-engine cue'
  ]),
  'visual:procedural:work-engine': nativeSlice('visual:procedural:work-engine', [
    'work engine generate + step(dt) + render',
    'TIME_SCALE 0.3 reading pace'
  ]),

  'visual:video': nativeSlice('visual:video', [
    'HTMLVideoElement.currentTime',
    'object-URL hydration',
    'muted runtime policy'
  ]),

  'audio:hold': nativeSlice('audio:hold', ['AudioContext.currentTime']),
  'audio:silence': nativeSlice('audio:silence', ['AudioContext.currentTime']),
  'audio:soundscape': nativeSlice('audio:soundscape', [
    'AudioContext.currentTime',
    'live audio graph'
  ]),
  'audio:tone': nativeSlice('audio:tone', [
    'AudioContext.currentTime',
    'live audio graph'
  ]),

  'swell:swell': unsupported('swell:swell',
    'Swell start and cancellation boundaries are not in the first offline mix slice',
    ['AudioContext.currentTime', 'live swell graph']),

  'reading:pace': nativeSlice('reading:pace', [
    'session-compiler atom timeline',
    'PacingEngine wall-adjacent durations'
  ]),

  'narration:spoken': nativeSlice('narration:spoken', [
    'offline spoken mix',
    'authored bed duck',
    'source-span captions'
  ])
});

export const RENDER_SUPPORT_KINDS = Object.freeze(Object.keys(RENDER_SUPPORT));

/**
 * Cue kinds the canonical vocab requires a declaration for.
 * Derived from experience-program + procedural registry — not from this file's
 * keys — so a new kind without a row fails CI.
 */
export function requiredRenderCueKinds() {
  const kinds = new Set([
    'structural:movement',
    'structural:transition',
    'visual:sourced:project-image',
    'visual:sourced:gallery',
    'visual:sourced:collection',
    'visual:procedural:shuffled',
    'visual:procedural:work-engine',
    'swell:swell'
  ]);
  for (const kind of PROGRAM_VISUAL_KINDS) {
    if (kind === 'field') {
      for (const renderer of PROGRAM_VISUAL_FIELD_RENDERERS) {
        kinds.add(`visual:field:${renderer}`);
      }
    } else if (kind === 'sourced' || kind === 'procedural') {
      continue;
    } else {
      kinds.add(`visual:${kind}`);
    }
  }
  for (const id of PROCEDURAL_PATTERN_IDS) {
    kinds.add(`visual:procedural:${id}`);
  }
  for (const kind of PROGRAM_AUDIO_KINDS) kinds.add(`audio:${kind}`);
  for (const kind of PROGRAM_READING_KINDS) kinds.add(`reading:${kind}`);
  for (const kind of PROGRAM_NARRATION_KINDS) kinds.add(`narration:${kind}`);
  return kinds;
}

export function renderSupportFor(cueKind) {
  return RENDER_SUPPORT[cueKind] || null;
}

export function collectProgramCues(program) {
  const out = [];
  for (const [trackIndex, track] of (program?.tracks || []).entries()) {
    const trackPath = `$.tracks[${trackIndex}]`;
    if (track.kind === 'movement' || track.kind === 'transition') {
      out.push(Object.freeze({
        trackId: track.id,
        trackKind: track.kind,
        clipId: null,
        path: trackPath,
        cue: Object.freeze({ kind: track.kind }),
        role: 'structural'
      }));
      continue;
    }
    if (track.fallback) {
      out.push(Object.freeze({
        trackId: track.id,
        trackKind: track.kind,
        clipId: null,
        path: `${trackPath}.fallback`,
        cue: track.fallback,
        role: 'fallback'
      }));
    }
    for (const [clipIndex, clip] of (track.clips || []).entries()) {
      if (!clip?.cue) continue;
      out.push(Object.freeze({
        trackId: track.id,
        trackKind: track.kind,
        clipId: clip.id,
        path: `${trackPath}.clips[${clipIndex}].cue`,
        cue: clip.cue,
        role: 'clip'
      }));
    }
  }
  return Object.freeze(out);
}

export function classifyCue(cue, trackKind = null) {
  const kind = cue?.kind;
  if (trackKind === 'movement' || kind === 'movement') return 'structural:movement';
  if (trackKind === 'transition' || kind === 'transition') return 'structural:transition';
  if (trackKind === 'swell' || kind === 'swell') return 'swell:swell';
  if (trackKind === 'narration' || kind === 'spoken') return 'narration:spoken';
  if (trackKind === 'reading' || kind === 'pace') return `reading:${kind || 'pace'}`;
  if (trackKind === 'audio' || PROGRAM_AUDIO_KINDS.includes(kind)) return `audio:${kind}`;
  if (kind === 'still') return 'visual:still';
  if (kind === 'focal') return 'visual:focal';
  if (kind === 'field') return `visual:field:${cue.renderer}`;
  if (kind === 'video') return 'visual:video';
  if (kind === 'sourced') return classifySourcedCue(cue);
  if (kind === 'procedural') return classifyProceduralCue(cue);
  return `undeclared:${trackKind || 'unknown'}:${String(kind)}`;
}

function classifySourcedCue(cue) {
  const references = sequenceAssetReferencesFromCue(cue)
    .filter(reference => reference.expectedKind === 'image');
  const collections = cue.collections || [];
  const sequenceCollections = collections.filter(id =>
    typeof id === 'string' && id.startsWith(SEQUENCE_ASSET_PREFIX));
  if (references.length === 1 || sequenceCollections.length === 1) {
    return 'visual:sourced:project-image';
  }
  if (references.length > 1 || sequenceCollections.length > 1) {
    return 'visual:sourced:gallery';
  }
  return 'visual:sourced:collection';
}

function classifyProceduralCue(cue) {
  const collections = Array.isArray(cue.collections) ? cue.collections : [];
  const engines = Array.isArray(cue.engines) ? cue.engines : [];
  const workFamilies = collections.filter(id => isWorkEngineFamily(id));
  const patterns = collections.filter(id => PROCEDURAL_PATTERN_IDS.includes(id));
  if (patterns.length + workFamilies.length > 1 || collections.length > 1) {
    return 'visual:procedural:shuffled';
  }
  if (engines.length > 0 || workFamilies.length === 1) {
    return 'visual:procedural:work-engine';
  }
  if (patterns.length === 1) return `visual:procedural:${patterns[0]}`;
  return 'visual:procedural:shuffled';
}

export function classifyProgramCues(program) {
  return Object.freeze(collectProgramCues(program).map((item) => {
    const cueKind = classifyCue(item.cue, item.trackKind);
    return Object.freeze({
      ...item,
      cueKind,
      support: renderSupportFor(cueKind)
    });
  }));
}
