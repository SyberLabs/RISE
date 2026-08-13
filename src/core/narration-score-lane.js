/**
 * Narration score lane — span assignments a person can already undo.
 *
 * Compiles onto an Experience Program `narration` track. It never writes
 * audio defaults, soundscape cues, or swell clips.
 */

import {
  createExperienceProgram,
  EXPERIENCE_PROGRAM_LIMITS,
  EXPERIENCE_PROGRAM_SCHEMA,
  halfOpenRangesOverlap
} from './experience-program.js';
import { resolveSourceSpan } from './source-span.js';
import {
  assertPronunciationsInSource,
  assertWordsInsideSpan,
  isVoiceIdentity,
  NarrationError,
  validateNarrationCue
} from './narration.js';

export class NarrationScoreLaneError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NarrationScoreLaneError';
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details) => {
  throw new NarrationScoreLaneError(code, message, details);
};

function exactId(value, label) {
  if (typeof value !== 'string' || !value || value !== value.trim()
    || value.length > EXPERIENCE_PROGRAM_LIMITS.maxIdLength) {
    fail('NARRATION_SCORE_INVALID_ID', `${label} must be a non-empty, trimmed id.`, { label });
  }
  return value;
}

function fingerprint(text, edge) {
  const slice = edge === 'start' ? text.slice(0, 24) : text.slice(-24);
  return slice.trim();
}

function overlaps(left, right) {
  if (left.sourceId !== right.sourceId) return false;
  return halfOpenRangesOverlap(
    left.fromCharacter, left.toCharacter, right.fromCharacter, right.toCharacter);
}

export function createNarrationScoreAsset(value) {
  const id = exactId(value?.id, 'Narration asset id');
  if (!isVoiceIdentity(id) && !isVoiceIdentity(value?.voiceId || '')) {
    fail('NARRATION_SCORE_NOT_VOICE', 'Narration assets name a voice, not a bed or swell.', {
      assetId: id
    });
  }
  const cue = validateNarrationCue(value?.cue || {
    kind: 'spoken',
    ...(value?.voiceId ? { voiceId: value.voiceId } : { voiceId: id }),
    ...(value?.voiceAssetId ? { voiceAssetId: value.voiceAssetId } : {}),
    ...(value?.duck ? { duck: value.duck } : {}),
    ...(value?.words ? { words: value.words } : {}),
    ...(value?.pronunciations ? { pronunciations: value.pronunciations } : {})
  });
  return Object.freeze({
    id,
    lane: 'narration',
    name: typeof value?.name === 'string' && value.name.trim()
      ? value.name.trim().slice(0, 120)
      : 'Voice',
    cue
  });
}

export function assignNarrationSpan({
  assignments = [],
  source,
  assetId,
  assets = [],
  assignmentId,
  fromCharacter,
  toCharacter,
  overlap = 'reject',
  cue = null
} = {}) {
  const sourceId = exactId(source?.id, 'Source id');
  const text = typeof source?.text === 'string' ? source.text
    : typeof source?.data === 'string' ? source.data : '';
  const asset = assets.find(item => item.id === assetId) || createNarrationScoreAsset({
    id: assetId,
    voiceId: assetId
  });
  if (asset.lane !== 'narration') {
    fail('NARRATION_SCORE_NOT_VOICE', 'That asset is not a spoken voice.', { assetId });
  }
  const spoken = cue ? validateNarrationCue({ ...asset.cue, ...cue, kind: 'spoken' }) : asset.cue;
  assertPronunciationsInSource(spoken.pronunciations, text.slice(fromCharacter, toCharacter),
    '$.pronunciations');
  assertWordsInsideSpan(spoken.words, fromCharacter, toCharacter, text, '$.words');
  const selected = text.slice(fromCharacter, toCharacter);
  const candidate = {
    id: exactId(assignmentId, 'Narration assignment id'),
    sourceId,
    assetId: asset.id,
    lane: 'narration',
    fromCharacter,
    toCharacter,
    quoteStart: fingerprint(selected, 'start'),
    quoteEnd: fingerprint(selected, 'end'),
    cue: spoken
  };
  resolveSourceSpan({
    sourceIds: [sourceId],
    fromCharacter,
    toCharacter,
    quoteStart: candidate.quoteStart,
    quoteEnd: candidate.quoteEnd
  }, text, 'narrationScore.selection');
  const conflicts = assignments.filter(item => overlaps(item, candidate));
  if (conflicts.length && overlap !== 'replace') {
    fail('NARRATION_SCORE_OVERLAP', 'That passage already has a spoken clip.', {
      conflicts: conflicts.map(item => item.id), candidate
    });
  }
  const retained = assignments.filter(item => !conflicts.includes(item));
  return Object.freeze([...retained, Object.freeze(candidate)]);
}

export function eraseNarrationSpan(assignments = [], assignmentId) {
  const id = exactId(assignmentId, 'Narration assignment id');
  return Object.freeze(assignments.filter(item => item.id !== id));
}

export function narrationAssignmentsFromClips(clips = []) {
  return clips.flatMap((clip) => {
    if (clip.anchor?.fromCharacter === undefined) return [];
    const voiceId = clip.cue?.voiceId || clip.cue?.voiceAssetId;
    if (!voiceId) return [];
    return [{
      id: clip.id,
      sourceId: clip.anchor.sourceIds[0],
      assetId: clip.cue.voiceAssetId || clip.cue.voiceId,
      lane: 'narration',
      fromCharacter: clip.anchor.fromCharacter,
      toCharacter: clip.anchor.toCharacter,
      quoteStart: clip.anchor.quoteStart,
      quoteEnd: clip.anchor.quoteEnd,
      cue: clip.cue
    }];
  });
}

export function clipsFromNarrationAssignments(assignments = []) {
  return assignments.map((assignment) => {
    const clip = {
      id: assignment.id,
      anchor: {
        sourceIds: [assignment.sourceId],
        fromCharacter: assignment.fromCharacter,
        toCharacter: assignment.toCharacter,
        quoteStart: assignment.quoteStart,
        quoteEnd: assignment.quoteEnd
      },
      cue: assignment.cue
    };
    return clip;
  });
}

export function appendNarrationTrack(tracks, assignments = []) {
  if (!assignments.length) return tracks;
  return [
    ...tracks,
    {
      id: 'narration',
      kind: 'narration',
      clips: clipsFromNarrationAssignments(assignments)
    }
  ];
}

export { NarrationError, EXPERIENCE_PROGRAM_SCHEMA, createExperienceProgram };
