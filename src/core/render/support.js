/**
 * Central render-support registry.
 *
 * Every canonical cue the Experience Program can name must be declared
 * native, degraded, or unsupported. Interactive presenters are not evidence
 * of export support. CI fails when the vocab grows without a declaration.
 *
 * Phase 0 declares the first vertical-slice families as native (the contract
 * Phase 1 implements) and everything else as unsupported. Unsupported required
 * cues refuse preflight; they are never silently omitted.
 */

import {
  PROGRAM_AUDIO_KINDS,
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
  'visual:focal': unsupported('visual:focal',
    'Focal placement depends on the live page/stream viewport; no explicit-time adapter yet',
    ['live viewport', 'page/stream placement', 'glyph animation']),
  'visual:field:focal': unsupported('visual:field:focal',
    'Focal fields advance on requestAnimationFrame; no frame-addressable adapter yet',
    ['visual-field-director', 'requestAnimationFrame', 'canvas']),
  'visual:field:attractor': unsupported('visual:field:attractor',
    'Attractor fields integrate with step(dt) and have no render checkpoint contract yet',
    ['requestAnimationFrame', 'step(dt)', 'canvas filament']),
  'visual:field:genesis': unsupported('visual:field:genesis',
    'Genesis fields advance mutable state on the live clock; no explicit-time adapter yet',
    ['requestAnimationFrame', 'mutable field state', 'canvas']),

  'visual:sourced:project-image': nativeSlice('visual:sourced:project-image', [
    'blob/object-URL hydration at runtime',
    'canvas drawImage'
  ]),
  'visual:sourced:gallery': unsupported('visual:sourced:gallery',
    'Ordered gallery cadence is not in the first render slice',
    ['gallery cadence', 'multiple sequence assets']),
  'visual:sourced:collection': unsupported('visual:sourced:collection',
    'Museum/collection sourced cues shuffle live and may fetch remote works',
    ['ShuffleBag', 'Math.random', 'collection fetch']),

  'visual:procedural:klee': nativeSlice('visual:procedural:klee', [
    'requestAnimationFrame in the Chamber',
    'canvas 2d',
    'preset randomness — render must pin seed'
  ]),
  'visual:procedural:turrell': unsupported('visual:procedural:turrell',
    'No explicit-time Turrell adapter in the first render slice',
    ['requestAnimationFrame', 'canvas']),
  'visual:procedural:fractal': unsupported('visual:procedural:fractal',
    'No explicit-time fractal adapter in the first render slice',
    ['requestAnimationFrame', 'canvas']),
  'visual:procedural:neural': unsupported('visual:procedural:neural',
    'No explicit-time neural adapter in the first render slice',
    ['requestAnimationFrame', 'canvas']),
  'visual:procedural:rockgarden': unsupported('visual:procedural:rockgarden',
    'No explicit-time rock-garden adapter in the first render slice',
    ['requestAnimationFrame', 'canvas']),
  'visual:procedural:harmonograph': unsupported('visual:procedural:harmonograph',
    'No explicit-time harmonograph adapter in the first render slice',
    ['requestAnimationFrame', 'canvas']),
  'visual:procedural:shuffled': unsupported('visual:procedural:shuffled',
    'A procedural cue naming several collections is a live shuffle, not a pinned engine',
    ['Math.random', 'collection pool']),
  'visual:procedural:work-engine': unsupported('visual:procedural:work-engine',
    'Work-authored engines have no pinned render adapter; interactive load is lazy and index-walked',
    ['dynamic import', 'engine index walk', 'canvas']),

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
  if (engines.length > 0 || collections.some(id => isWorkEngineFamily(id))) {
    return 'visual:procedural:work-engine';
  }
  const patterns = collections.filter(id => PROCEDURAL_PATTERN_IDS.includes(id));
  if (patterns.length > 1 || collections.length > 1) {
    return 'visual:procedural:shuffled';
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
