/**
 * Scenes: the phone Workshop's view of a sequence.
 *
 * A SCENE IS A SOURCE, AND ITS VISUAL IS ONE CLIP. Nothing here is persisted
 * that the desktop studio does not already persist. A scene's visual is a
 * visual clip spanning the whole source; its sound is an audio-bed clip over
 * the same span, and therefore carries the visual's sync group. Everything is
 * written through `assignVisualSpan` / `assignAudioSpan`, so a scene is
 * validated by exactly the rules a passage is.
 *
 * "WHOLE" MEANS EVERY TOKEN. Spans snap to tokens, so a clip over `[0, len)`
 * is stored from the first token to the last. Whole is judged against that
 * snapped span, never against the raw length.
 */
import { snapCharacterRangeToTokens } from './source-span.js';
import { assignVisualSpan } from './visual-score-lane.js';
import { assignAudioSpan } from './audio-score-lane.js';
import { normalizeReaderText } from './local-works.js';
import {
  normalizeConfigurableVisualCue,
  normalizeFieldStyle,
  normalizeProceduralStyle,
  visualCueIsConfigurable
} from './visual-style-definitions.js';

export const SCENE_EXCERPT_CHARS = 180;
const BED_LANE = 'audio';

export class SceneError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SceneError';
    this.code = code;
  }
}

const textOf = source => (typeof source?.data === 'string' ? source.data : '');
const countWords = text => text.split(/\s+/).filter(Boolean).length;
const scoreSource = source => ({ id: String(source.id), text: textOf(source) });

function wholeSpan(text) {
  return snapCharacterRangeToTokens(text, 0, text.length);
}

function isWhole(clip, text) {
  const whole = wholeSpan(text);
  return Boolean(whole)
    && clip.fromCharacter === whole.fromCharacter
    && clip.toCharacter === whole.toCharacter;
}

function findSource(data, sourceId) {
  const source = (data.sources || []).find(item => String(item.id) === String(sourceId));
  if (!source) throw new SceneError('SCENE_NOT_FOUND', 'That scene is no longer in this sequence.');
  return source;
}

function laneSummary(clips, text, nameOf) {
  if (!clips.length) return null;
  const whole = clips.length === 1 && isWhole(clips[0], text);
  return {
    assetId: clips[0].assetId,
    name: nameOf(clips[0].assetId) || null,
    whole,
    passages: whole ? 0 : clips.length,
    ...(clips[0].cue ? { cue: clips[0].cue } : {})
  };
}

export function isWrittenSource(source) {
  return source?.metadata?.source === 'written';
}

export function scenesFromSession(data = {}, { visualName = () => null, audioName = () => null } = {}) {
  const visual = data.visualScoreAssignments || [];
  const audio = data.audioScoreAssignments || [];
  return (data.sources || []).map((source, index) => {
    const id = String(source.id);
    const text = textOf(source);
    const visualClips = visual.filter(clip => clip.sourceId === id);
    const audioClips = audio.filter(clip => clip.sourceId === id);
    const beds = audioClips.filter(clip => clip.lane === BED_LANE);
    const everyClipWhole = [...visualClips, ...audioClips].every(clip => isWhole(clip, text));
    const written = isWrittenSource(source);
    return {
      id,
      index,
      name: source.name || `Scene ${index + 1}`,
      excerpt: text.replace(/\s+/g, ' ').trim().slice(0, SCENE_EXCERPT_CHARS),
      words: Number.isFinite(source.words) ? source.words : countWords(text),
      written,
      editable: written && everyClipWhole,
      visual: laneSummary(visualClips, text, visualName),
      sound: laneSummary(beds, text, audioName),
      layers: audioClips.length - beds.length
    };
  });
}

/** Returns both lanes: the sound's sync group follows its scene's new visual. */
export function setSceneVisual(data, sourceId, { assetId, cue = null, id }) {
  const source = findSource(data, sourceId);
  const text = textOf(source);
  const whole = wholeSpan(text);
  if (!whole) throw new SceneError('SCENE_EMPTY', 'A scene needs words before it can hold a visual.');
  const visualScoreAssignments = assignVisualSpan({
    assignments: (data.visualScoreAssignments || []).filter(clip => clip.sourceId !== String(source.id)),
    source: scoreSource(source),
    assetId,
    assignmentId: id,
    fromCharacter: whole.fromCharacter,
    toCharacter: whole.toCharacter,
    cue
  });
  const audioScoreAssignments = (data.audioScoreAssignments || []).map(clip =>
    clip.sourceId === String(source.id) && clip.lane === BED_LANE && isWhole(clip, text)
      ? Object.freeze({ ...clip, syncGroup: `sync-${id}` })
      : clip);
  return { visualScoreAssignments, audioScoreAssignments };
}

/** `sound: null` returns the scene to the sequence's own sound. */
export function setSceneSound(data, sourceId, sound) {
  const source = findSource(data, sourceId);
  const id = String(source.id);
  const text = textOf(source);
  const remaining = (data.audioScoreAssignments || [])
    .filter(clip => !(clip.sourceId === id && clip.lane === BED_LANE));
  if (!sound) return { audioScoreAssignments: Object.freeze(remaining) };
  const whole = wholeSpan(text);
  if (!whole) throw new SceneError('SCENE_EMPTY', 'A scene needs words before it can hold a sound.');
  const visual = (data.visualScoreAssignments || [])
    .find(clip => clip.sourceId === id && isWhole(clip, text));
  const audioScoreAssignments = assignAudioSpan({
    assignments: remaining,
    assets: sound.assets || [],
    source: scoreSource(source),
    assetId: sound.assetId,
    assignmentId: sound.id,
    fromCharacter: whole.fromCharacter,
    toCharacter: whole.toCharacter,
    ...(visual ? { syncGroup: `sync-${visual.id}` } : {})
  });
  return { audioScoreAssignments };
}

export function writtenSource(text, { id, name = '' } = {}) {
  const data = normalizeReaderText(text).trim();
  if (!data) throw new SceneError('SCENE_EMPTY', 'Write something first.');
  const firstLine = data.split('\n')[0].trim();
  return {
    id,
    name: name || (firstLine.length > 48 ? `${firstLine.slice(0, 47)}…` : firstLine),
    providerId: 'local',
    type: 'text/plain',
    words: countWords(data),
    data,
    metadata: { source: 'written' }
  };
}

/**
 * New words for a scene written here. Whole-scene clips are re-spanned,
 * because "the whole scene" is what they mean. A passage clip would land on
 * words it was never given, so its presence refuses the edit.
 */
export function rewriteWrittenScene(data, sourceId, text, { audioAssets = [] } = {}) {
  const source = findSource(data, sourceId);
  const id = String(source.id);
  if (!isWrittenSource(source)) {
    throw new SceneError('SCENE_NOT_WRITTEN', 'Only a scene written here can be rewritten here.');
  }
  const scene = scenesFromSession({ ...data, sources: [source] })[0];
  if (!scene.editable) {
    throw new SceneError('SCENE_HAS_PASSAGES',
      'This scene has passage visuals from the full studio. Changing its words would move them.');
  }
  const next = { ...writtenSource(text, { id, name: source.name }), metadata: source.metadata };
  const sources = (data.sources || []).map(item => (String(item.id) === id ? next : item));
  let visual = (data.visualScoreAssignments || []).filter(clip => clip.sourceId !== id);
  for (const clip of (data.visualScoreAssignments || []).filter(item => item.sourceId === id)) {
    visual = setSceneVisual({ sources, visualScoreAssignments: visual, audioScoreAssignments: [] }, id,
      { assetId: clip.assetId, cue: clip.cue || null, id: clip.id }).visualScoreAssignments;
  }
  let audio = (data.audioScoreAssignments || []).filter(clip => clip.sourceId !== id);
  const whole = wholeSpan(next.data);
  for (const clip of (data.audioScoreAssignments || []).filter(item => item.sourceId === id)) {
    audio = assignAudioSpan({
      assignments: audio,
      assets: audioAssets,
      source: scoreSource(next),
      assetId: clip.assetId,
      assignmentId: clip.id,
      fromCharacter: whole.fromCharacter,
      toCharacter: whole.toCharacter,
      ...(clip.syncGroup ? { syncGroup: clip.syncGroup } : {})
    });
  }
  return { sources, visualScoreAssignments: visual, audioScoreAssignments: audio };
}

export function moveScene(sources, from, to) {
  if (from === to || from < 0 || to < 0 || from >= sources.length || to >= sources.length) return sources;
  const next = [...sources];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function sessionForScene(data, sourceId) {
  const source = findSource(data, sourceId);
  const id = String(source.id);
  const copy = JSON.parse(JSON.stringify(data));
  copy.sources = copy.sources.filter(item => String(item.id) === id);
  copy.visualScoreAssignments = (copy.visualScoreAssignments || []).filter(clip => clip.sourceId === id);
  copy.audioScoreAssignments = (copy.audioScoreAssignments || []).filter(clip => clip.sourceId === id);
  return copy;
}

const SURFACE_OF = Object.freeze({ off: 'off', focal: 'focal', attractor: 'attractor', klee: 'genesis' });
const PROCEDURAL = new Set(['harmonograph', 'ostensoria', 'apparitio', 'fractal', 'turrell', 'neural', 'rockgarden']);

/**
 * The Workshop registry id for a navigator choice, or null when the Workshop
 * has no asset for it. The picker offers only leaves that answer non-null.
 */
export function leafToEditorAssetId(leafId, pool = null) {
  if (SURFACE_OF[leafId]) return `surface:${SURFACE_OF[leafId]}`;
  if (PROCEDURAL.has(leafId)) return `procedural:${leafId}`;
  if ((leafId === 'by-manner' || leafId === 'by-subject') && typeof pool === 'string' && pool.startsWith('aic-')) {
    return `collection:${pool}`;
  }
  if (leafId === 'personal' && pool === 'global-pool') return 'collection:global-pool';
  return null;
}

/** The cue a scene clip snapshots, carrying the preset or glyph chosen in Vary. */
export function cueForPick(leafId, style = {}, cueTemplate = null) {
  if (!cueTemplate) return null;
  let cue = cueTemplate;
  if (cueTemplate.kind === 'field') {
    const config = cueTemplate.renderer === 'focal'
      ? { type: 'standard', standardGlyph: style.glyph }
      : style;
    cue = { ...cueTemplate, config: normalizeFieldStyle(cueTemplate.renderer, config) };
  } else if (cueTemplate.kind === 'procedural') {
    cue = { ...cueTemplate, config: normalizeProceduralStyle(cueTemplate.collections, style) };
  }
  return visualCueIsConfigurable(cue) ? normalizeConfigurableVisualCue(cue) : null;
}
