/**
 * The canonical authored score boundary for RISE
 *
 * An Experience Program is durable, domain-neutral data. Journeys, user
 * scores, and proposed Live Curator arrangements meet here; the Chamber
 * does not. The runtime continues to consume its bounded movement, visual,
 * and audio schedules through `lowerExperienceProgram` until those legacy
 * shapes can be retired deliberately.
 *
 * This boundary is strict by design. Authored data is never truncated,
 * clamped, or translated to stillness/silence because it was malformed.
 * A score either validates exactly or refuses with a path and error code.
 */

export const EXPERIENCE_PROGRAM_SCHEMA = 'rise.experience-program.v1';

export const EXPERIENCE_PROGRAM_LIMITS = Object.freeze({
  maxIdLength: 160,
  maxTracks: 8,
  maxMovements: 16,
  maxTransitions: 32,
  maxClipsPerTrack: 512,
  maxSourceIds: 64,
  maxSourceCharacters: 2_000_000,
  maxSourceTokens: 2_000_000,
  maxQuoteLength: 500,
  maxCollections: 32,
  maxEngines: 32,
  maxDurationMs: 60_000,
  minTransitionDurationMs: 200,
  maxTransitionDurationMs: 30_000,
  maxFadeMs: 10_000,
  maxMetadataDepth: 4,
  maxMetadataKeys: 40,
  maxMetadataArray: 64,
  maxMetadataString: 2_000
});

const AUTHORITIES = new Set(['published', 'user', 'proposed']);
const TRACK_KINDS = new Set(['movement', 'transition', 'visual', 'audio', 'swell']);
const VISUAL_KINDS = new Set(['still', 'focal', 'sourced', 'procedural']);
const AUDIO_KINDS = new Set(['hold', 'silence', 'soundscape', 'tone']);

const TRACK_LIMITS = Object.freeze({
  movement: EXPERIENCE_PROGRAM_LIMITS.maxMovements,
  transition: EXPERIENCE_PROGRAM_LIMITS.maxTransitions,
  visual: EXPERIENCE_PROGRAM_LIMITS.maxClipsPerTrack,
  audio: EXPERIENCE_PROGRAM_LIMITS.maxClipsPerTrack,
  swell: EXPERIENCE_PROGRAM_LIMITS.maxClipsPerTrack
});

export class ExperienceProgramValidationError extends Error {
  constructor(code, message, path = '$', details = {}) {
    super(`${message} (${path})`);
    this.name = 'ExperienceProgramValidationError';
    this.code = code;
    this.path = path;
    this.details = details;
  }
}

const fail = (code, message, path, details) => {
  throw new ExperienceProgramValidationError(code, message, path, details);
};

function record(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('PROGRAM_EXPECTED_OBJECT', 'Expected an object', path);
  }
  return value;
}

function onlyKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      fail('PROGRAM_UNKNOWN_FIELD', `Unknown field: ${key}`, `${path}.${key}`);
    }
  }
}

function exactId(value, path) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    fail('PROGRAM_INVALID_ID', 'Expected a non-empty, trimmed string id', path);
  }
  if (value.length > EXPERIENCE_PROGRAM_LIMITS.maxIdLength) {
    fail('PROGRAM_ID_TOO_LONG',
      `Ids may not exceed ${EXPERIENCE_PROGRAM_LIMITS.maxIdLength} characters`, path);
  }
  return value;
}

function optionalId(value, path) {
  return value == null ? null : exactId(value, path);
}

function optionalText(value, max, path) {
  if (value == null) return null;
  if (typeof value !== 'string' || value.length > max) {
    fail('PROGRAM_INVALID_TEXT', `Expected text no longer than ${max} characters`, path);
  }
  return value;
}

function quoteFingerprint(value, path) {
  if (typeof value !== 'string' || !value || value !== value.trim()
    || value.length > EXPERIENCE_PROGRAM_LIMITS.maxQuoteLength || value.includes('\0')) {
    fail('PROGRAM_INVALID_QUOTE',
      `Expected a non-empty, trimmed quote no longer than ${EXPERIENCE_PROGRAM_LIMITS.maxQuoteLength} characters`,
      path);
  }
  return value;
}

function finiteRange(value, min, max, path) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    fail('PROGRAM_NUMBER_OUT_OF_RANGE', `Expected a number from ${min} to ${max}`, path);
  }
  return value;
}

function integerRange(value, min, max, path) {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail('PROGRAM_INTEGER_OUT_OF_RANGE', `Expected an integer from ${min} to ${max}`, path);
  }
  return value;
}

function uniqueIds(value, path, max) {
  if (!Array.isArray(value) || value.length === 0) {
    fail('PROGRAM_IDS_REQUIRED', 'Expected at least one id', path);
  }
  if (value.length > max) {
    fail('PROGRAM_TOO_MANY_IDS', `Expected no more than ${max} ids`, path);
  }
  const out = value.map((id, index) => exactId(id, `${path}[${index}]`));
  if (new Set(out).size !== out.length) {
    fail('PROGRAM_DUPLICATE_ID', 'Ids must be unique', path);
  }
  return out;
}

function cloneMetadata(value, path, depth = 0) {
  if (value == null) return null;
  if (typeof value === 'string') {
    if (value.length > EXPERIENCE_PROGRAM_LIMITS.maxMetadataString) {
      fail('PROGRAM_METADATA_TOO_LONG', 'Metadata string is too long', path);
    }
    return value;
  }
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('PROGRAM_METADATA_NUMBER', 'Metadata number must be finite', path);
    return value;
  }
  if (depth >= EXPERIENCE_PROGRAM_LIMITS.maxMetadataDepth) {
    fail('PROGRAM_METADATA_DEPTH', 'Metadata is nested too deeply', path);
  }
  if (Array.isArray(value)) {
    if (value.length > EXPERIENCE_PROGRAM_LIMITS.maxMetadataArray) {
      fail('PROGRAM_METADATA_ARRAY', 'Metadata array is too large', path);
    }
    return value.map((item, index) => cloneMetadata(item, `${path}[${index}]`, depth + 1));
  }
  record(value, path);
  const entries = Object.entries(value);
  if (entries.length > EXPERIENCE_PROGRAM_LIMITS.maxMetadataKeys) {
    fail('PROGRAM_METADATA_KEYS', 'Metadata object has too many keys', path);
  }
  const out = {};
  for (const [key, item] of entries) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      fail('PROGRAM_METADATA_KEY', 'Metadata contains a forbidden key', `${path}.${key}`);
    }
    if (!key || key.length > 120) fail('PROGRAM_METADATA_KEY', 'Metadata key is invalid', `${path}.${key}`);
    out[key] = cloneMetadata(item, `${path}.${key}`, depth + 1);
  }
  return out;
}

function validateAnchor(value, path, kind) {
  const source = record(value, path);
  const anchorFields = new Set(['sourceIds']);
  if (kind === 'transition') {
    anchorFields.add('afterSourceId');
    anchorFields.add('beforeSourceId');
  } else if (kind !== 'movement') {
    anchorFields.add('fromProgress');
    anchorFields.add('toProgress');
    anchorFields.add('fromCharacter');
    anchorFields.add('toCharacter');
    anchorFields.add('fromToken');
    anchorFields.add('toToken');
    anchorFields.add('quoteStart');
    anchorFields.add('quoteEnd');
  }
  onlyKeys(source, anchorFields, path);
  const sourceIds = uniqueIds(
    source.sourceIds,
    `${path}.sourceIds`,
    kind === 'movement'
      ? EXPERIENCE_PROGRAM_LIMITS.maxSourceIds
      : EXPERIENCE_PROGRAM_LIMITS.maxSourceIds
  );
  const out = { sourceIds };

  const rangePairs = [
    ['progress', 'fromProgress', 'toProgress'],
    ['character', 'fromCharacter', 'toCharacter'],
    ['token', 'fromToken', 'toToken']
  ];
  const presentRanges = [];
  for (const [name, fromKey, toKey] of rangePairs) {
    const hasFrom = source[fromKey] !== undefined;
    const hasTo = source[toKey] !== undefined;
    if (hasFrom !== hasTo) {
      fail('PROGRAM_INCOMPLETE_RANGE', `A ${name} range needs both endpoints`, path);
    }
    if (hasFrom) presentRanges.push(name);
  }
  if (presentRanges.length > 1) {
    fail('PROGRAM_AMBIGUOUS_RANGE',
      'An anchor may use progress, character, or token coordinates, not more than one', path);
  }

  if (presentRanges[0] === 'progress') {
    out.fromProgress = finiteRange(source.fromProgress, 0, 1, `${path}.fromProgress`);
    out.toProgress = finiteRange(source.toProgress, 0, 1, `${path}.toProgress`);
    if (out.toProgress <= out.fromProgress) {
      fail('PROGRAM_INVERTED_RANGE', 'Anchor end must be greater than its start', path);
    }
  } else if (presentRanges[0] === 'character') {
    out.fromCharacter = integerRange(
      source.fromCharacter, 0, EXPERIENCE_PROGRAM_LIMITS.maxSourceCharacters - 1,
      `${path}.fromCharacter`);
    out.toCharacter = integerRange(
      source.toCharacter, 1, EXPERIENCE_PROGRAM_LIMITS.maxSourceCharacters,
      `${path}.toCharacter`);
    if (out.toCharacter <= out.fromCharacter) {
      fail('PROGRAM_INVERTED_RANGE', 'Anchor end must be greater than its start', path);
    }
  } else if (presentRanges[0] === 'token') {
    out.fromToken = integerRange(
      source.fromToken, 0, EXPERIENCE_PROGRAM_LIMITS.maxSourceTokens - 1,
      `${path}.fromToken`);
    out.toToken = integerRange(
      source.toToken, 1, EXPERIENCE_PROGRAM_LIMITS.maxSourceTokens,
      `${path}.toToken`);
    if (out.toToken <= out.fromToken) {
      fail('PROGRAM_INVERTED_RANGE', 'Anchor end must be greater than its start', path);
    }
  }

  const authoredSpan = presentRanges[0] === 'character' || presentRanges[0] === 'token';
  const hasQuoteStart = source.quoteStart !== undefined;
  const hasQuoteEnd = source.quoteEnd !== undefined;
  if (authoredSpan && (!hasQuoteStart || !hasQuoteEnd)) {
    fail('PROGRAM_QUOTE_REQUIRED',
      'Character and token spans require opening and closing quote fingerprints', path);
  }
  if (!authoredSpan && (hasQuoteStart || hasQuoteEnd)) {
    fail('PROGRAM_ORPHAN_QUOTE',
      'Quote fingerprints are valid only on character or token spans', path);
  }
  if (authoredSpan) {
    out.quoteStart = quoteFingerprint(source.quoteStart, `${path}.quoteStart`);
    out.quoteEnd = quoteFingerprint(source.quoteEnd, `${path}.quoteEnd`);
  }

  if (kind === 'transition') {
    if (sourceIds.length !== 1) {
      fail('PROGRAM_TRANSITION_SOURCE', 'A transition must own exactly one source id', path);
    }
    out.afterSourceId = optionalId(source.afterSourceId, `${path}.afterSourceId`);
    out.beforeSourceId = optionalId(source.beforeSourceId, `${path}.beforeSourceId`);
  }
  return out;
}

function validateVisualCue(value, path) {
  const source = record(value, path);
  if (!VISUAL_KINDS.has(source.kind)) {
    fail('PROGRAM_VISUAL_KIND', `Unknown visual cue kind: ${String(source.kind)}`, `${path}.kind`);
  }
  const cueFields = new Set(['kind']);
  if (source.kind === 'focal') cueFields.add('focal');
  if (source.kind === 'sourced' || source.kind === 'procedural') cueFields.add('collections');
  if (source.kind === 'procedural') cueFields.add('engines');
  onlyKeys(source, cueFields, path);
  if (source.kind === 'still') return { kind: 'still' };
  if (source.kind === 'focal') {
    return {
      kind: 'focal',
      focal: source.focal == null ? {} : cloneMetadata(source.focal, `${path}.focal`)
    };
  }
  const collections = uniqueIds(
    source.collections,
    `${path}.collections`,
    EXPERIENCE_PROGRAM_LIMITS.maxCollections
  );
  if (source.kind === 'sourced') return { kind: 'sourced', collections };
  const out = { kind: 'procedural', collections };
  if (source.engines !== undefined) {
    out.engines = uniqueIds(
      source.engines,
      `${path}.engines`,
      EXPERIENCE_PROGRAM_LIMITS.maxEngines
    );
  }
  return out;
}

function validateAudioCue(value, path) {
  const source = record(value, path);
  if (!AUDIO_KINDS.has(source.kind)) {
    fail('PROGRAM_AUDIO_KIND', `Unknown audio cue kind: ${String(source.kind)}`, `${path}.kind`);
  }
  const cueFields = new Set(['kind', 'fadeMs']);
  if (source.kind === 'soundscape') {
    cueFields.add('soundscapeId');
    cueFields.add('gain');
  }
  if (source.kind === 'tone') {
    cueFields.add('presetId');
    cueFields.add('gain');
  }
  onlyKeys(source, cueFields, path);
  const out = { kind: source.kind };
  if (source.fadeMs !== undefined) {
    out.fadeMs = integerRange(
      source.fadeMs, 0, EXPERIENCE_PROGRAM_LIMITS.maxFadeMs, `${path}.fadeMs`);
  }
  if (source.kind === 'soundscape') {
    out.soundscapeId = exactId(source.soundscapeId, `${path}.soundscapeId`);
    if (source.gain !== undefined) out.gain = finiteRange(source.gain, 0, 1, `${path}.gain`);
  }
  if (source.kind === 'tone') {
    out.presetId = exactId(source.presetId, `${path}.presetId`);
    if (source.gain !== undefined) out.gain = finiteRange(source.gain, 0, 1, `${path}.gain`);
  }
  return out;
}

function validateSwellCue(value, path) {
  const source = record(value, path);
  onlyKeys(source, new Set(['kind', 'swellId', 'fadeMs']), path);
  if (source.kind !== 'swell') {
    fail('PROGRAM_SWELL_KIND', 'A swell track accepts only swell cues', `${path}.kind`);
  }
  const out = { kind: 'swell', swellId: exactId(source.swellId, `${path}.swellId`) };
  if (source.fadeMs !== undefined) {
    out.fadeMs = integerRange(
      source.fadeMs, 0, EXPERIENCE_PROGRAM_LIMITS.maxFadeMs, `${path}.fadeMs`);
  }
  return out;
}

function validateClip(value, path, kind, index) {
  const source = record(value, path);
  const clipFields = new Set(['id', 'anchor', 'syncGroup', 'metadata']);
  if (kind === 'movement') clipFields.add('data');
  if (kind === 'transition') {
    clipFields.add('data');
    clipFields.add('durationMs');
  }
  if (kind === 'visual' || kind === 'audio' || kind === 'swell') clipFields.add('cue');
  onlyKeys(source, clipFields, path);
  const clip = {
    id: exactId(source.id, `${path}.id`),
    anchor: validateAnchor(source.anchor, `${path}.anchor`, kind)
  };
  if (source.syncGroup !== undefined) {
    clip.syncGroup = exactId(source.syncGroup, `${path}.syncGroup`);
  }
  if (source.metadata !== undefined) {
    clip.metadata = cloneMetadata(source.metadata, `${path}.metadata`);
  }

  if (kind === 'movement') {
    const data = record(source.data, `${path}.data`);
    onlyKeys(data, new Set(['index', 'title']), `${path}.data`);
    if (!Number.isInteger(data.index) || data.index !== index) {
      fail('PROGRAM_MOVEMENT_INDEX', 'Movement indexes must be contiguous and ordered', `${path}.data.index`);
    }
    clip.data = {
      index: data.index,
      title: optionalText(data.title, 200, `${path}.data.title`)
    };
  } else if (kind === 'transition') {
    const data = record(source.data, `${path}.data`);
    onlyKeys(data, new Set(['fromMovementId', 'toMovementId']), `${path}.data`);
    clip.data = {
      fromMovementId: exactId(data.fromMovementId, `${path}.data.fromMovementId`),
      toMovementId: optionalId(data.toMovementId, `${path}.data.toMovementId`)
    };
    clip.durationMs = integerRange(
      source.durationMs,
      EXPERIENCE_PROGRAM_LIMITS.minTransitionDurationMs,
      EXPERIENCE_PROGRAM_LIMITS.maxTransitionDurationMs,
      `${path}.durationMs`
    );
  } else if (kind === 'visual') {
    clip.cue = validateVisualCue(source.cue, `${path}.cue`);
  } else if (kind === 'audio') {
    clip.cue = validateAudioCue(source.cue, `${path}.cue`);
  } else if (kind === 'swell') {
    clip.cue = validateSwellCue(source.cue, `${path}.cue`);
  }
  return clip;
}

function validateRelationships(tracks) {
  const movementTracks = tracks.filter(track => track.kind === 'movement');
  if (movementTracks.length !== 1 || movementTracks[0].clips.length === 0) {
    fail('PROGRAM_MOVEMENT_TRACK', 'A program needs exactly one non-empty movement track', '$.tracks');
  }
  const movementIds = new Set(movementTracks[0].clips.map(clip => clip.id));
  const sourceOwners = new Map();
  for (const movement of movementTracks[0].clips) {
    for (const sourceId of movement.anchor.sourceIds) {
      if (sourceOwners.has(sourceId)) {
        fail('PROGRAM_SOURCE_OWNERSHIP',
          `Source ${sourceId} belongs to more than one movement`, '$.tracks');
      }
      sourceOwners.set(sourceId, movement.id);
    }
  }

  const transitionSources = new Set();
  for (const track of tracks.filter(item => item.kind === 'transition')) {
    for (const clip of track.clips) {
      const transitionSource = clip.anchor.sourceIds[0];
      if (sourceOwners.has(transitionSource) || transitionSources.has(transitionSource)) {
        fail('PROGRAM_TRANSITION_SOURCE_DUPLICATE',
          `Transition source ${transitionSource} is not unique`, '$.tracks');
      }
      transitionSources.add(transitionSource);
      if (!movementIds.has(clip.data.fromMovementId)
        || (clip.data.toMovementId && !movementIds.has(clip.data.toMovementId))) {
        fail('PROGRAM_TRANSITION_MOVEMENT',
          `Transition ${clip.id} names an unknown movement`, '$.tracks');
      }
      if (!clip.anchor.afterSourceId) {
        fail('PROGRAM_TRANSITION_NEIGHBOR',
          `Transition ${clip.id} must name the source before it`, '$.tracks');
      }
      if (clip.data.toMovementId && !clip.anchor.beforeSourceId) {
        fail('PROGRAM_TRANSITION_NEIGHBOR',
          `Transition ${clip.id} must name the source after it`, '$.tracks');
      }
      if (!clip.data.toMovementId && clip.anchor.beforeSourceId) {
        fail('PROGRAM_TRANSITION_CODA',
          `Coda ${clip.id} cannot name a following source`, '$.tracks');
      }
      for (const [side, sourceId] of [
        ['afterSourceId', clip.anchor.afterSourceId],
        ['beforeSourceId', clip.anchor.beforeSourceId]
      ]) {
        if (sourceId && !sourceOwners.has(sourceId)) {
          fail('PROGRAM_TRANSITION_NEIGHBOR',
            `Transition ${clip.id} names an unknown ${side}`, '$.tracks');
        }
      }
      if (sourceOwners.get(clip.anchor.afterSourceId) !== clip.data.fromMovementId) {
        fail('PROGRAM_TRANSITION_OWNERSHIP',
          `Transition ${clip.id} does not leave its declared movement`, '$.tracks');
      }
      if (clip.anchor.beforeSourceId
        && sourceOwners.get(clip.anchor.beforeSourceId) !== clip.data.toMovementId) {
        fail('PROGRAM_TRANSITION_OWNERSHIP',
          `Transition ${clip.id} does not enter its declared movement`, '$.tracks');
      }
    }
  }

  const knownAnchors = new Set([...sourceOwners.keys(), ...transitionSources]);
  for (const track of tracks.filter(item =>
    item.kind === 'visual' || item.kind === 'audio' || item.kind === 'swell')) {
    for (const clip of track.clips) {
      const ranged = clip.anchor.fromProgress !== undefined
        || clip.anchor.fromCharacter !== undefined
        || clip.anchor.fromToken !== undefined;
      if (ranged && clip.anchor.sourceIds.length !== 1) {
        fail('PROGRAM_RANGED_SOURCE',
          `Ranged clip ${clip.id} must bind exactly one source`, '$.tracks');
      }
      for (const sourceId of clip.anchor.sourceIds) {
        if (!knownAnchors.has(sourceId)) {
          fail('PROGRAM_UNKNOWN_SOURCE',
            `Clip ${clip.id} names unknown source ${sourceId}`, '$.tracks');
        }
      }
    }
  }

  for (const track of tracks) {
    // Exclusivity is the default for media lanes. Movement and transition
    // have stronger ownership rules already enforced above; every other
    // track kind — including ones added later — must demonstrate
    // non-overlap or refuse (fail-closed, not an allowlist).
    if (track.kind === 'movement' || track.kind === 'transition') continue;
    assertSameLaneExclusivity(track, '$.tracks');
  }
}

/**
 * Half-open interval intersection — adjacent endpoints (a.to === b.from) do not
 * conflict. Shared by the canonical program validator and Workshop score lanes
 * so exclusivity is one vocabulary (ROADMAP Phase 0.4 finding #4).
 */
export function halfOpenRangesOverlap(fromA, toA, fromB, toB) {
  return fromA < toB && fromB < toA;
}

/** @returns {'progress'|'character'|'token'|'unranged'} */
export function anchorCoordinateSystem(anchor) {
  if (!anchor || typeof anchor !== 'object') return 'unranged';
  if (anchor.fromProgress !== undefined) return 'progress';
  if (anchor.fromCharacter !== undefined) return 'character';
  if (anchor.fromToken !== undefined) return 'token';
  return 'unranged';
}

function rangeEndpoints(anchor, system) {
  if (system === 'progress') return [anchor.fromProgress, anchor.toProgress];
  if (system === 'character') return [anchor.fromCharacter, anchor.toCharacter];
  if (system === 'token') return [anchor.fromToken, anchor.toToken];
  return null;
}

/**
 * True when two clips on the same track would make array order a silent mix law.
 *
 * Unranged + ranged nesting is allowed (Journey movement-wide cue beside
 * figures) — runtime prefers the ranged match.
 *
 * Two ranged clips in different coordinate systems cannot demonstrate
 * exclusivity without inventing a progress↔character↔token map. Inability to
 * prove overlap is not proof of non-overlap: refuse, so JSON import cannot
 * smuggle the ambiguity past the gate.
 */
export function sameLaneClipsConflict(left, right) {
  if (!left?.anchor || !right?.anchor) return false;
  const shared = (left.anchor.sourceIds || [])
    .filter(id => (right.anchor.sourceIds || []).includes(id));
  if (!shared.length) return false;

  const systemLeft = anchorCoordinateSystem(left.anchor);
  const systemRight = anchorCoordinateSystem(right.anchor);
  if (systemLeft !== systemRight) {
    if (systemLeft === 'unranged' || systemRight === 'unranged') return false;
    return true;
  }

  if (systemLeft === 'unranged') return true;

  const [fromA, toA] = rangeEndpoints(left.anchor, systemLeft);
  const [fromB, toB] = rangeEndpoints(right.anchor, systemRight);
  return halfOpenRangesOverlap(fromA, toA, fromB, toB);
}

function assertSameLaneExclusivity(track, path) {
  const clips = track.clips || [];
  for (let i = 0; i < clips.length; i += 1) {
    for (let j = i + 1; j < clips.length; j += 1) {
      if (!sameLaneClipsConflict(clips[i], clips[j])) continue;
      const sourceId = clips[i].anchor.sourceIds
        .find(id => clips[j].anchor.sourceIds.includes(id));
      fail(
        'PROGRAM_LANE_OVERLAP',
        `Same-lane ${track.kind} clips ${clips[i].id} and ${clips[j].id} overlap`,
        path,
        {
          trackKind: track.kind,
          trackId: track.id,
          sourceId,
          coordinate: anchorCoordinateSystem(clips[i].anchor),
          clipIds: [clips[i].id, clips[j].id]
        }
      );
    }
  }
}

function validateTrack(value, path) {
  const source = record(value, path);
  if (!TRACK_KINDS.has(source.kind)) {
    fail('PROGRAM_TRACK_KIND', `Unknown track kind: ${String(source.kind)}`, `${path}.kind`);
  }
  const trackFields = new Set(['id', 'kind', 'clips', 'metadata']);
  if (source.kind === 'visual' || source.kind === 'audio') trackFields.add('fallback');
  onlyKeys(source, trackFields, path);
  const id = exactId(source.id, `${path}.id`);
  if (!Array.isArray(source.clips)) fail('PROGRAM_CLIPS_REQUIRED', 'Track clips must be an array', `${path}.clips`);
  const max = TRACK_LIMITS[source.kind];
  if (source.clips.length > max) {
    fail('PROGRAM_TOO_MANY_CLIPS', `A ${source.kind} track accepts at most ${max} clips`, `${path}.clips`);
  }
  const clips = source.clips.map((clip, index) =>
    validateClip(clip, `${path}.clips[${index}]`, source.kind, index));
  const clipIds = clips.map(clip => clip.id);
  if (new Set(clipIds).size !== clipIds.length) {
    fail('PROGRAM_DUPLICATE_CLIP', 'Clip ids must be unique within a track', `${path}.clips`);
  }
  const track = { id, kind: source.kind, clips };
  if (source.kind === 'visual') {
    track.fallback = validateVisualCue(source.fallback, `${path}.fallback`);
  } else if (source.kind === 'audio') {
    track.fallback = validateAudioCue(source.fallback, `${path}.fallback`);
  }
  if (source.metadata !== undefined) {
    track.metadata = cloneMetadata(source.metadata, `${path}.metadata`);
  }
  return track;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

/** Validate and return a detached, deeply immutable canonical program. */
export function validateExperienceProgram(value) {
  const source = record(value, '$');
  onlyKeys(source, new Set(['schema', 'id', 'authority', 'editable', 'tracks', 'metadata']), '$');
  if (source.schema !== EXPERIENCE_PROGRAM_SCHEMA) {
    fail('PROGRAM_SCHEMA', `Expected schema ${EXPERIENCE_PROGRAM_SCHEMA}`, '$.schema');
  }
  const id = exactId(source.id, '$.id');
  if (!AUTHORITIES.has(source.authority)) {
    fail('PROGRAM_AUTHORITY', `Unknown authority: ${String(source.authority)}`, '$.authority');
  }
  if (typeof source.editable !== 'boolean') {
    fail('PROGRAM_EDITABLE', 'editable must be boolean', '$.editable');
  }
  const shouldBeEditable = source.authority !== 'published';
  if (source.editable !== shouldBeEditable) {
    fail('PROGRAM_AUTHORITY_EDITABLE',
      `${source.authority} programs must set editable to ${shouldBeEditable}`, '$.editable');
  }
  if (!Array.isArray(source.tracks) || source.tracks.length === 0) {
    fail('PROGRAM_TRACKS_REQUIRED', 'A program needs at least one track', '$.tracks');
  }
  if (source.tracks.length > EXPERIENCE_PROGRAM_LIMITS.maxTracks) {
    fail('PROGRAM_TOO_MANY_TRACKS',
      `A program accepts at most ${EXPERIENCE_PROGRAM_LIMITS.maxTracks} tracks`, '$.tracks');
  }
  const tracks = source.tracks.map((track, index) => validateTrack(track, `$.tracks[${index}]`));
  const trackIds = tracks.map(track => track.id);
  if (new Set(trackIds).size !== trackIds.length) {
    fail('PROGRAM_DUPLICATE_TRACK', 'Track ids must be unique', '$.tracks');
  }
  // V1 gives each lane one authority. Additional parallel lanes need an
  // explicit mixing/compositing contract before the runtime can lower them
  // without choosing one fallback or ordering implicitly.
  for (const singleton of TRACK_KINDS) {
    if (tracks.filter(track => track.kind === singleton).length > 1) {
      fail('PROGRAM_DUPLICATE_TRACK_KIND', `Only one ${singleton} track is supported`, '$.tracks');
    }
  }
  validateRelationships(tracks);
  const program = {
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id,
    authority: source.authority,
    editable: source.editable,
    tracks
  };
  if (source.metadata !== undefined) {
    program.metadata = cloneMetadata(source.metadata, '$.metadata');
  }
  return deepFreeze(program);
}

export const createExperienceProgram = validateExperienceProgram;

/**
 * Lower one canonical score into the schedules used by the current Chamber.
 * This is an adapter, not a second authoring format: canonical data always
 * wins and every legacy object is derived from it.
 */
export function lowerExperienceProgram(value) {
  const program = validateExperienceProgram(value);
  const byKind = kind => program.tracks.filter(track => track.kind === kind);
  const movementTrack = byKind('movement')[0] || { clips: [] };
  const transitionTrack = byKind('transition')[0] || { clips: [] };
  const visualTracks = byKind('visual');
  const audioTracks = byKind('audio');
  const swellTracks = byKind('swell');

  const movements = movementTrack.clips.map(clip => ({
    id: clip.id,
    index: clip.data.index,
    title: clip.data.title,
    sourceIds: [...clip.anchor.sourceIds]
  }));
  const boundaries = transitionTrack.clips.map(clip => ({
    id: clip.id,
    sourceId: clip.anchor.sourceIds[0],
    fromMovementId: clip.data.fromMovementId,
    toMovementId: clip.data.toMovementId,
    afterSourceId: clip.anchor.afterSourceId,
    beforeSourceId: clip.anchor.beforeSourceId,
    durationMs: clip.durationMs
  }));
  const segmentsFor = tracks => tracks.flatMap(track => track.clips.map(clip => ({
    id: clip.id,
    match: { ...clip.anchor },
    cue: { ...clip.cue },
    ...(clip.syncGroup ? { syncGroup: clip.syncGroup } : {})
  })));
  const visualSegments = segmentsFor(visualTracks);
  const audioSegments = segmentsFor(audioTracks);
  const swellSegments = segmentsFor(swellTracks);

  const visualFallback = visualTracks[0]?.fallback || { kind: 'still' };
  const audioFallback = audioTracks[0]?.fallback || { kind: 'silence', fadeMs: 500 };
  const movementProgram = movements.length ? {
    schema: 'rise.movement-program.v1',
    journeyId: program.id,
    movements,
    boundaries
  } : null;
  const visualProgram = visualSegments.length ? {
    coordinateSpace: 'source',
    segments: visualSegments,
    fallback: visualFallback
  } : null;
  const audioProgram = (audioSegments.length || swellSegments.length) ? {
    coordinateSpace: 'source',
    segments: [...audioSegments, ...swellSegments],
    fallback: audioFallback,
    lanes: {
      bed: {
        coordinateSpace: 'source',
        segments: audioSegments,
        fallback: audioFallback
      },
      swell: {
        coordinateSpace: 'source',
        segments: swellSegments,
        fallback: { kind: 'hold' }
      }
    }
  } : null;

  return {
    experienceProgram: program,
    movementProgram,
    visualProgram,
    audioProgram,
    swellProgram: swellSegments.length ? {
      coordinateSpace: 'source',
      segments: swellSegments,
      fallback: { kind: 'hold' }
    } : null,
    boundaries,
    sourceBoundaries: boundaries
      .filter(boundary => boundary.afterSourceId && boundary.beforeSourceId)
      .map(boundary => ({
        id: boundary.id,
        sourceId: boundary.sourceId,
        afterSourceId: boundary.afterSourceId,
        beforeSourceId: boundary.beforeSourceId,
        kind: boundary.fromMovementId === boundary.toMovementId ? 'passage' : 'movement',
        durationMs: boundary.durationMs
      }))
  };
}
