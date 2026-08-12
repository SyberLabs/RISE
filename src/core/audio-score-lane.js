import {
  createExperienceProgram,
  EXPERIENCE_PROGRAM_LIMITS,
  EXPERIENCE_PROGRAM_SCHEMA,
  halfOpenRangesOverlap
} from './experience-program.js';
import {
  normalizeQuote,
  resolveSourceSpan,
  snapCharacterRangeToTokens
} from './source-span.js';
import { validateVisualScoreLane } from './visual-score-lane.js';
import {
  EDITOR_ASSET_SCHEMA,
  editorAssetSupports,
  validateEditorAsset
} from './editor-asset.js';

export const AUDIO_SCORE_COLORS = Object.freeze([
  '#c47ad9', '#ef8a5b', '#d7b75e', '#8c79d8', '#d96f91', '#7b9ed9'
]);

export class AudioScoreLaneError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AudioScoreLaneError';
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details) => {
  throw new AudioScoreLaneError(code, message, details);
};

function exactId(value, label) {
  if (typeof value !== 'string' || !value || value !== value.trim()
    || value.length > EXPERIENCE_PROGRAM_LIMITS.maxIdLength) {
    fail('AUDIO_SCORE_INVALID_ID', `${label} must be a non-empty, trimmed id.`, { label });
  }
  return value;
}

function cue(value) {
  if (!value || typeof value !== 'object') {
    fail('AUDIO_SCORE_INVALID_CUE', 'An audio asset needs a canonical cue.');
  }
  return Object.freeze({ ...value });
}

export function createAudioScoreAsset(value) {
  if (value?.schema === EDITOR_ASSET_SCHEMA) {
    const asset = validateEditorAsset(value);
    if (!['audio', 'swell'].includes(asset.lane) || !editorAssetSupports(asset, 'span')) {
      fail('AUDIO_SCORE_ASSET_NOT_ASSIGNABLE', `${asset.name} is not passage-capable.`, {
        assetId: asset.id
      });
    }
    return Object.freeze({
      id: asset.id,
      lane: asset.lane,
      name: asset.name,
      color: asset.editor.color,
      cue: cue(asset.cueTemplate)
    });
  }
  const lane = value?.lane === 'swell' ? 'swell' : 'audio';
  return Object.freeze({
    id: exactId(value?.id, 'Audio asset id'),
    lane,
    name: typeof value?.name === 'string' && value.name.trim()
      ? value.name.trim().slice(0, 120)
      : 'Audio asset',
    color: /^#[0-9a-f]{6}$/iu.test(value?.color || '')
      ? value.color.toLowerCase()
      : AUDIO_SCORE_COLORS[0],
    cue: cue(value?.cue)
  });
}

function fingerprint(text, edge) {
  const normalized = normalizeQuote(text);
  if (!normalized) fail('AUDIO_SCORE_EMPTY_SELECTION', 'Select visible source text first.');
  if (normalized.length <= 200) return normalized;
  const candidate = edge === 'start' ? normalized.slice(0, 200) : normalized.slice(-200);
  return edge === 'start'
    ? candidate.replace(/\s+\S*$/u, '') || candidate
    : candidate.replace(/^\S*\s+/u, '') || candidate;
}

function overlaps(left, right) {
  return left.lane === right.lane
    && left.sourceId === right.sourceId
    && halfOpenRangesOverlap(
      left.fromCharacter, left.toCharacter,
      right.fromCharacter, right.toCharacter
    );
}

function strictAssignment(value, sources, assets) {
  const id = exactId(value?.id, 'Audio assignment id');
  const sourceId = exactId(value?.sourceId, 'Source id');
  const assetId = exactId(value?.assetId, 'Audio asset id');
  const source = sources.find(item => item.id === sourceId);
  const asset = assets.find(item => item.id === assetId);
  if (!source) fail('AUDIO_SCORE_SOURCE_NOT_FOUND', `Source ${sourceId} is unavailable.`, { sourceId });
  if (!asset) fail('AUDIO_SCORE_ASSET_NOT_FOUND', `Audio asset ${assetId} is unavailable.`, { assetId });
  const anchor = {
    sourceIds: [sourceId],
    fromCharacter: value.fromCharacter,
    toCharacter: value.toCharacter,
    quoteStart: value.quoteStart,
    quoteEnd: value.quoteEnd
  };
  resolveSourceSpan(anchor, source.text, `audioScore.assignments.${id}`);
  const snapped = snapCharacterRangeToTokens(
    source.text, anchor.fromCharacter, anchor.toCharacter);
  if (!snapped) fail('AUDIO_SCORE_EMPTY_SELECTION', 'Select visible source text first.');
  const snappedText = source.text.slice(snapped.fromCharacter, snapped.toCharacter);
  const assignment = {
    id, sourceId, assetId, lane: asset.lane,
    fromCharacter: snapped.fromCharacter,
    toCharacter: snapped.toCharacter,
    quoteStart: fingerprint(snappedText, 'start'),
    quoteEnd: fingerprint(snappedText, 'end')
  };
  if (value.syncGroup !== undefined) assignment.syncGroup = exactId(value.syncGroup, 'Sync group');
  return Object.freeze(assignment);
}

export function validateAudioScoreLane({ sources = [], assets = [], assignments = [] }) {
  const canonicalSources = sources.map(source => ({
    id: exactId(source?.id, 'Source id'),
    text: typeof source?.text === 'string' ? source.text : ''
  }));
  const canonicalAssets = assets.map(createAudioScoreAsset);
  if (new Set(canonicalAssets.map(asset => asset.id)).size !== canonicalAssets.length) {
    fail('AUDIO_SCORE_DUPLICATE_ASSET', 'Audio asset ids must be unique.');
  }
  if (!Array.isArray(assignments)
    || assignments.length > EXPERIENCE_PROGRAM_LIMITS.maxClipsPerTrack * 2) {
    fail('AUDIO_SCORE_ASSIGNMENT_LIMIT', 'The audio score contains too many assignments.');
  }
  const canonicalAssignments = assignments.map(item =>
    strictAssignment(item, canonicalSources, canonicalAssets));
  if (new Set(canonicalAssignments.map(item => item.id)).size !== canonicalAssignments.length) {
    fail('AUDIO_SCORE_DUPLICATE_ASSIGNMENT', 'Audio assignment ids must be unique.');
  }
  for (let i = 0; i < canonicalAssignments.length; i += 1) {
    for (let j = i + 1; j < canonicalAssignments.length; j += 1) {
      if (overlaps(canonicalAssignments[i], canonicalAssignments[j])) {
        fail('AUDIO_SCORE_OVERLAP', `Saved ${canonicalAssignments[i].lane} assignments overlap.`, {
          conflicts: [canonicalAssignments[i].id, canonicalAssignments[j].id]
        });
      }
    }
  }
  return Object.freeze({
    sources: Object.freeze(canonicalSources),
    assets: Object.freeze(canonicalAssets),
    assignments: Object.freeze(canonicalAssignments)
  });
}

export function assignAudioSpan({
  assignments = [], source, assetId, assets = [], assignmentId,
  fromCharacter, toCharacter, overlap = 'reject', syncGroup
}) {
  const canonicalAssets = assets.map(createAudioScoreAsset);
  const asset = canonicalAssets.find(item => item.id === assetId);
  if (!asset) fail('AUDIO_SCORE_ASSET_NOT_FOUND', `Audio asset ${assetId} is unavailable.`, { assetId });
  const sourceId = exactId(source?.id, 'Source id');
  const text = typeof source?.text === 'string' ? source.text : '';
  const snapped = snapCharacterRangeToTokens(text, fromCharacter, toCharacter);
  if (!snapped) fail('AUDIO_SCORE_EMPTY_SELECTION', 'Select visible source text first.');
  fromCharacter = snapped.fromCharacter;
  toCharacter = snapped.toCharacter;
  const selected = text.slice(fromCharacter, toCharacter);
  const candidate = {
    id: exactId(assignmentId, 'Audio assignment id'), sourceId,
    assetId: asset.id, lane: asset.lane, fromCharacter, toCharacter,
    quoteStart: fingerprint(selected, 'start'), quoteEnd: fingerprint(selected, 'end')
  };
  if (syncGroup !== undefined) candidate.syncGroup = exactId(syncGroup, 'Sync group');
  resolveSourceSpan({ sourceIds: [sourceId], fromCharacter, toCharacter,
    quoteStart: candidate.quoteStart, quoteEnd: candidate.quoteEnd }, text, 'audioScore.selection');
  const conflicts = assignments.filter(item => overlaps(item, candidate));
  if (conflicts.length && overlap !== 'replace') {
    fail('AUDIO_SCORE_OVERLAP', `That passage overlaps an existing ${asset.lane} clip.`, {
      conflicts: conflicts.map(item => item.id), candidate
    });
  }
  if (!['reject', 'replace'].includes(overlap)) {
    fail('AUDIO_SCORE_OVERLAP_POLICY', 'Unknown audio overlap policy.', { overlap });
  }
  const retained = assignments.filter(item => !conflicts.includes(item));
  return Object.freeze([...retained, Object.freeze(candidate)]);
}

export function eraseAudioSpan(assignments = [], assignmentId) {
  const id = exactId(assignmentId, 'Audio assignment id');
  return Object.freeze(assignments.filter(item => item.id !== id));
}

function sourceTitle(source, index) {
  return (typeof source?.name === 'string' && source.name.trim()
    ? source.name.trim() : `Source ${index + 1}`).slice(0, 200);
}

function clipFromAssignment(assignment, asset) {
  const clip = {
    id: assignment.id,
    anchor: {
      sourceIds: [assignment.sourceId],
      fromCharacter: assignment.fromCharacter,
      toCharacter: assignment.toCharacter,
      quoteStart: assignment.quoteStart,
      quoteEnd: assignment.quoteEnd
    },
    cue: assignment.cue || asset.cue
  };
  if (assignment.syncGroup) clip.syncGroup = assignment.syncGroup;
  return clip;
}

/** Compile every authored media lane into one canonical Experience Program. */
export function compileWorkshopScoreProgram({
  programId, sources, visualAssets = [], visualAssignments = [],
  audioAssets = [], audioAssignments = [], visualFallback = { kind: 'still' }
}) {
  const visual = validateVisualScoreLane({
    sources, assets: visualAssets, assignments: visualAssignments
  });
  const audio = validateAudioScoreLane({
    sources, assets: audioAssets, assignments: audioAssignments
  });
  if (!visual.assignments.length && !audio.assignments.length) return null;
  const tracks = [{
    id: 'movements', kind: 'movement',
    clips: audio.sources.map((source, index) => ({
      id: `source-${index + 1}`,
      anchor: { sourceIds: [source.id] },
      data: { index, title: sourceTitle(sources[index], index) }
    }))
  }];
  if (visual.assignments.length) {
    tracks.push({
      id: 'visual-main', kind: 'visual', fallback: visualFallback,
      clips: visual.assignments.map(assignment => clipFromAssignment(
        assignment, visual.assets.find(asset => asset.id === assignment.assetId)))
    });
  }
  const beds = audio.assignments.filter(item => item.lane === 'audio');
  if (beds.length) {
    tracks.push({
      id: 'audio-bed', kind: 'audio', fallback: { kind: 'hold', fadeMs: 500 },
      clips: beds.map(assignment => clipFromAssignment(
        assignment, audio.assets.find(asset => asset.id === assignment.assetId)))
    });
  }
  const swells = audio.assignments.filter(item => item.lane === 'swell');
  if (swells.length) {
    tracks.push({
      id: 'audio-events', kind: 'swell',
      clips: swells.map(assignment => clipFromAssignment(
        assignment, audio.assets.find(asset => asset.id === assignment.assetId)))
    });
  }
  return createExperienceProgram({
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id: exactId(programId, 'Program id'),
    authority: 'user', editable: true, tracks,
    metadata: { kind: audio.assignments.length ? 'workshop-media-score' : 'workshop-visual-score' }
  });
}
