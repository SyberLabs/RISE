import {
  createExperienceProgram,
  EXPERIENCE_PROGRAM_LIMITS,
  EXPERIENCE_PROGRAM_SCHEMA,
  halfOpenRangesOverlap
} from './experience-program.js';
import { READING_LIMITS } from './reading-limits.js';
import {
  normalizeQuote,
  resolveSourceSpan,
  snapCharacterRangeToTokens
} from './source-span.js';
import {
  EDITOR_ASSET_SCHEMA,
  editorAssetSupports,
  validateEditorAsset
} from './editor-asset.js';
import { personalFocalAssetIdFromCue } from './visual-style-definitions.js';

export const SEQUENCE_ASSET_PREFIX = 'sequence-asset:';
export const SEQUENCE_ASSET_STORAGE_IDB = 'idb';
export const SEQUENCE_ASSET_STORAGE_INLINE = 'inline';
const MAX_SEQUENCE_ASSET_URI_LENGTH = READING_LIMITS.maxSequenceAssetUriChars;
export const VISUAL_SCORE_COLORS = Object.freeze([
  '#7fd4a4', '#d7a7ff', '#f0bf72', '#78bde8', '#ed8f9d', '#b9ca6b', '#c6a38a', '#8fc8bd'
]);

export class VisualScoreLaneError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'VisualScoreLaneError';
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details) => {
  throw new VisualScoreLaneError(code, message, details);
};

function exactId(value, label) {
  if (typeof value !== 'string' || !value || value !== value.trim()
    || value.length > EXPERIENCE_PROGRAM_LIMITS.maxIdLength) {
    fail('VISUAL_SCORE_INVALID_ID', `${label} must be a non-empty, trimmed id.`, { label });
  }
  return value;
}

function boundedName(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Sequence image';
  return value.trim().slice(0, 120);
}

function dataImage(value) {
  if (typeof value !== 'string' || !value.startsWith('data:image/')
    || value.length > MAX_SEQUENCE_ASSET_URI_LENGTH) {
    fail('VISUAL_SCORE_INVALID_ASSET', 'Sequence images must be local image data.', {});
  }
  return value;
}

function runtimeMediaUri(value) {
  if (typeof value !== 'string' || value.length > MAX_SEQUENCE_ASSET_URI_LENGTH) {
    fail('VISUAL_SCORE_INVALID_ASSET', 'Sequence media must be local data.', {});
  }
  if (value.startsWith('data:image/') || value.startsWith('blob:')) return value;
  fail('VISUAL_SCORE_INVALID_ASSET', 'Sequence media must be local data.', {});
}

function mediaMimeType(value, kind) {
  const valid = kind === 'video' ? value === 'video/mp4' : value?.startsWith('image/');
  if (typeof value !== 'string' || !valid || value.length > 120) {
    fail('VISUAL_SCORE_INVALID_ASSET', kind === 'video'
      ? 'Sequence videos must be video/mp4.'
      : 'Durable sequence images need an image/* MIME type.', {});
  }
  return value.trim();
}

function byteLength(value, kind) {
  const n = Number(value);
  const max = kind === 'video'
    ? READING_LIMITS.maxVideoFileBytes
    : READING_LIMITS.maxImageFileBytes;
  if (!Number.isInteger(n) || n <= 0 || n > max) {
    fail('VISUAL_SCORE_INVALID_ASSET', 'Durable sequence media needs a valid byte length.', {});
  }
  return n;
}

/** True when the asset carries a DOM/cortex-resolvable URI. */
export function sequenceAssetHasUri(asset) {
  return typeof asset?.uri === 'string'
    && (asset.uri.startsWith('data:image/') || asset.uri.startsWith('blob:'));
}

/**
 * Strip transient runtime URIs before persisting a durable idb asset into
 * rise.workshop-project.v1. Inline assets keep their data URI.
 */
export function sequenceAssetForPersistence(asset) {
  const canonical = createSequenceVisualAsset(asset);
  if (canonical.storage === SEQUENCE_ASSET_STORAGE_INLINE) return canonical;
  const persisted = {
    id: canonical.id,
    name: canonical.name,
    color: canonical.color,
    storage: SEQUENCE_ASSET_STORAGE_IDB,
    mimeType: canonical.mimeType,
    byteLength: canonical.byteLength
  };
  if (canonical.kind === 'video') {
    persisted.kind = 'video';
    persisted.durationMs = canonical.durationMs;
    persisted.audioPolicy = 'muted';
    persisted.timeMode = canonical.timeMode;
    if (canonical.posterAssetId) persisted.posterAssetId = canonical.posterAssetId;
  }
  if (canonical.provenance) persisted.provenance = canonical.provenance;
  return Object.freeze(persisted);
}

function boundedProvenance(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const provenance = {};
  for (const [rawKey, rawValue] of Object.entries(value).slice(0, 24)) {
    const key = String(rawKey).trim().slice(0, 80);
    if (!key || key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
    if (typeof rawValue === 'string') provenance[key] = rawValue.trim().slice(0, 500);
    else if (typeof rawValue === 'boolean') provenance[key] = rawValue;
    else if (typeof rawValue === 'number' && Number.isFinite(rawValue)) provenance[key] = rawValue;
  }
  return Object.keys(provenance).length ? Object.freeze(provenance) : null;
}

export function sequenceAssetCollection(assetId) {
  return `${SEQUENCE_ASSET_PREFIX}${exactId(assetId, 'Asset id')}`;
}

export function assetIdFromCollection(collectionId) {
  return typeof collectionId === 'string' && collectionId.startsWith(SEQUENCE_ASSET_PREFIX)
    ? collectionId.slice(SEQUENCE_ASSET_PREFIX.length)
    : null;
}

/**
 * Every durable project-media reference carried by one canonical visual cue.
 *
 * Keep discovery here beside the sequence-asset vocabulary and reuse it at
 * both trust boundaries: the curator gate asks whether an id was offered,
 * while project validation asks whether the local bytes have the right kind.
 * Adding another id-bearing cue must therefore update one exhaustive switch,
 * not two unrelated scans.
 */
export function sequenceAssetReferencesFromCue(cue) {
  if (!cue || typeof cue !== 'object') return Object.freeze([]);
  const personalFocalId = personalFocalAssetIdFromCue(cue);
  if (personalFocalId) {
    return Object.freeze([Object.freeze({
      id: personalFocalId,
      role: 'personal-focal',
      expectedKind: 'image'
    })]);
  }
  if (cue.kind === 'video' && typeof cue.assetId === 'string' && cue.assetId) {
    return Object.freeze([Object.freeze({
      id: cue.assetId,
      role: 'sequence-video',
      expectedKind: 'video'
    })]);
  }
  const references = [];
  for (const collectionId of cue.collections || []) {
    const id = assetIdFromCollection(collectionId);
    if (!id || references.some(reference => reference.id === id)) continue;
    references.push(Object.freeze({
      id,
      role: 'sequence-image',
      expectedKind: 'image'
    }));
  }
  return Object.freeze(references);
}

/** Rebuild the deterministic editor reference stored implicitly by a cue. */
export function scoreAssetIdFromCue(cue) {
  if (cue?.kind === 'video') return cue.assetId || null;
  if (cue?.kind === 'field' && ['focal', 'attractor', 'genesis'].includes(cue.renderer)) {
    return `surface:${cue.renderer}`;
  }
  if (cue?.kind === 'still') return 'surface:off';
  if (!cue || !Array.isArray(cue.collections) || cue.collections.length !== 1) return null;
  const collection = cue.collections[0];
  if (cue.kind === 'sourced') {
    return assetIdFromCollection(collection) || `collection:${collection}`;
  }
  if (cue.kind === 'procedural') return `procedural:${collection}`;
  return null;
}

export function createSequenceVisualAsset(value = {}) {
  const id = exactId(value.id, 'Asset id');
  const name = boundedName(value.name);
  const color = VISUAL_SCORE_COLORS.includes(value.color) ? value.color : VISUAL_SCORE_COLORS[0];
  const kind = value.kind === 'video' || value.mimeType === 'video/mp4' ? 'video' : 'image';
  const storage = value.storage === SEQUENCE_ASSET_STORAGE_IDB
    || (value.storage !== SEQUENCE_ASSET_STORAGE_INLINE
      && !value.uri
      && value.mimeType
      && value.byteLength != null)
    ? SEQUENCE_ASSET_STORAGE_IDB
    : SEQUENCE_ASSET_STORAGE_INLINE;

  let asset;
  if (kind === 'video' && storage !== SEQUENCE_ASSET_STORAGE_IDB) {
    fail('VISUAL_SCORE_INVALID_ASSET', 'Sequence videos require durable media storage.', {});
  }
  if (storage === SEQUENCE_ASSET_STORAGE_IDB) {
    asset = {
      id,
      name,
      color,
      storage: SEQUENCE_ASSET_STORAGE_IDB,
      mimeType: mediaMimeType(value.mimeType, kind),
      byteLength: byteLength(value.byteLength, kind)
    };
    if (value.uri != null) asset.uri = runtimeMediaUri(value.uri);
  } else {
    asset = {
      id,
      name,
      color,
      storage: SEQUENCE_ASSET_STORAGE_INLINE,
      uri: dataImage(value.uri)
    };
  }

  if (kind === 'video') {
    const durationMs = Number(value.durationMs);
    if (!Number.isInteger(durationMs) || durationMs <= 0 || durationMs > 24 * 60 * 60 * 1000) {
      fail('VISUAL_SCORE_INVALID_ASSET', 'Sequence videos need a valid duration.', {});
    }
    const timeModes = new Set(['cue', 'fit-span', 'loop', 'hold-final']);
    asset.kind = 'video';
    asset.durationMs = durationMs;
    asset.audioPolicy = 'muted';
    asset.timeMode = timeModes.has(value.timeMode) ? value.timeMode : 'loop';
    if (typeof value.posterAssetId === 'string' && value.posterAssetId.trim()) {
      asset.posterAssetId = exactId(value.posterAssetId.trim(), 'Poster asset id');
    }
  }

  const canonicalProvenance = boundedProvenance(value.provenance);
  if (canonicalProvenance) asset.provenance = canonicalProvenance;
  return Object.freeze(asset);
}

function scoreCue(value) {
  if (value.kind === 'still') return Object.freeze({ kind: 'still' });
  if (value.kind === 'field') {
    return Object.freeze({
      kind: 'field',
      renderer: value.renderer,
      config: Object.freeze({ ...(value.config || {}) })
    });
  }
  if (value.kind === 'video') {
    return Object.freeze({
      kind: 'video',
      assetId: value.assetId,
      timeMode: value.timeMode || 'loop',
      audioPolicy: 'muted',
      reducedMotion: 'poster'
    });
  }
  const cue = {
    kind: value.kind,
    collections: Object.freeze([...value.collections])
  };
  if (value.engines) cue.engines = Object.freeze([...value.engines]);
  if (value.config && Object.keys(value.config).length) {
    cue.config = Object.freeze({ ...value.config });
  }
  return Object.freeze(cue);
}

/**
 * Normalize either a legacy project image or a Phase 3 editor asset into the
 * small, DOM-free contract required by the visual score compiler.
 */
export function createVisualScoreAsset(value) {
  if (value?.schema === EDITOR_ASSET_SCHEMA) {
    const asset = validateEditorAsset(value);
    if (!editorAssetSupports(asset, 'span') || !asset.cueTemplate) {
      fail('VISUAL_SCORE_ASSET_NOT_ASSIGNABLE',
        `${asset.name} cannot be assigned to a source span.`, { assetId: asset.id });
    }
    return Object.freeze({
      id: asset.id,
      name: asset.name,
      color: asset.editor.color,
      cue: scoreCue(asset.cueTemplate)
    });
  }
  const asset = createSequenceVisualAsset(value);
  return Object.freeze({
    id: asset.id,
    name: asset.name,
    color: asset.color,
    cue: asset.kind === 'video'
      ? scoreCue({ kind: 'video', assetId: asset.id, timeMode: asset.timeMode })
      : scoreCue({ kind: 'sourced', collections: [sequenceAssetCollection(asset.id)] })
  });
}

function fingerprint(text, edge) {
  const normalized = normalizeQuote(text);
  if (!normalized) fail('VISUAL_SCORE_EMPTY_SELECTION', 'Select visible source text first.');
  if (normalized.length <= 200) return normalized;
  if (edge === 'start') {
    const candidate = normalized.slice(0, 200);
    return candidate.replace(/\s+\S*$/u, '') || candidate;
  }
  const candidate = normalized.slice(-200);
  return candidate.replace(/^\S*\s+/u, '') || candidate;
}

function overlaps(left, right) {
  return left.sourceId === right.sourceId
    && halfOpenRangesOverlap(
      left.fromCharacter, left.toCharacter,
      right.fromCharacter, right.toCharacter
    );
}

function strictAssignment(value, sources, assets) {
  const id = exactId(value?.id, 'Assignment id');
  const sourceId = exactId(value?.sourceId, 'Source id');
  const assetId = exactId(value?.assetId, 'Asset id');
  const source = sources.find(item => item.id === sourceId);
  if (!source) fail('VISUAL_SCORE_SOURCE_NOT_FOUND', `Source ${sourceId} is unavailable.`, { sourceId });
  const asset = assets.find(item => item.id === assetId);
  if (!asset) {
    fail('VISUAL_SCORE_ASSET_NOT_FOUND', `Visual asset ${assetId} is unavailable.`, { assetId });
  }
  const anchor = {
    sourceIds: [sourceId],
    fromCharacter: value.fromCharacter,
    toCharacter: value.toCharacter,
    quoteStart: value.quoteStart,
    quoteEnd: value.quoteEnd
  };
  resolveSourceSpan(anchor, source.text, `visualScore.assignments.${id}`);
  const snapped = snapCharacterRangeToTokens(
    source.text, anchor.fromCharacter, anchor.toCharacter);
  if (!snapped) fail('VISUAL_SCORE_EMPTY_SELECTION', 'Select visible source text first.');
  const snappedText = source.text.slice(snapped.fromCharacter, snapped.toCharacter);
  const assignment = {
    id,
    sourceId,
    assetId,
    fromCharacter: snapped.fromCharacter,
    toCharacter: snapped.toCharacter,
    quoteStart: fingerprint(snappedText, 'start'),
    quoteEnd: fingerprint(snappedText, 'end')
  };
  if (value.cue !== undefined) {
    const sameField = asset.cue.kind === 'field' && value.cue?.kind === 'field'
      && value.cue.renderer === asset.cue.renderer;
    const sameProcedural = asset.cue.kind === 'procedural' && value.cue?.kind === 'procedural'
      && JSON.stringify(value.cue.collections) === JSON.stringify(asset.cue.collections);
    if (!sameField && !sameProcedural) {
      fail('VISUAL_SCORE_CUE_SNAPSHOT',
        'Only the selected visual may carry a clip configuration snapshot.', { assetId });
    }
    assignment.cue = scoreCue(value.cue);
  }
  return Object.freeze(assignment);
}

/** Strictly validate restored editor state against its current sources/assets. */
export function validateVisualScoreLane({ sources = [], assets = [], assignments = [] }) {
  const canonicalSources = sources.map(source => ({
    id: exactId(source?.id, 'Source id'),
    text: typeof source?.text === 'string' ? source.text : ''
  }));
  if (new Set(canonicalSources.map(source => source.id)).size !== canonicalSources.length) {
    fail('VISUAL_SCORE_DUPLICATE_SOURCE', 'Visual score source ids must be unique.');
  }
  const canonicalAssets = assets.map(createVisualScoreAsset);
  if (new Set(canonicalAssets.map(asset => asset.id)).size !== canonicalAssets.length) {
    fail('VISUAL_SCORE_DUPLICATE_ASSET', 'Visual score asset ids must be unique.');
  }
  if (!Array.isArray(assignments)
    || assignments.length > EXPERIENCE_PROGRAM_LIMITS.maxClipsPerTrack) {
    fail('VISUAL_SCORE_ASSIGNMENT_LIMIT',
      `A visual lane accepts at most ${EXPERIENCE_PROGRAM_LIMITS.maxClipsPerTrack} assignments.`);
  }
  const canonicalAssignments = assignments.map(value =>
    strictAssignment(value, canonicalSources, canonicalAssets));
  if (new Set(canonicalAssignments.map(item => item.id)).size !== canonicalAssignments.length) {
    fail('VISUAL_SCORE_DUPLICATE_ASSIGNMENT', 'Visual assignment ids must be unique.');
  }
  for (let i = 0; i < canonicalAssignments.length; i += 1) {
    for (let j = i + 1; j < canonicalAssignments.length; j += 1) {
      if (overlaps(canonicalAssignments[i], canonicalAssignments[j])) {
        fail('VISUAL_SCORE_OVERLAP', 'Saved visual assignments overlap.', {
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

/**
 * Paint one source selection with an asset. `replace` is deliberately
 * explicit: it removes every intersecting assignment before adding the new
 * one; the default refuses and reports the conflicts.
 */
export function assignVisualSpan({
  assignments = [], source, assetId, assignmentId, fromCharacter, toCharacter,
  overlap = 'reject', cue = null
}) {
  if (!Array.isArray(assignments)) {
    fail('VISUAL_SCORE_ASSIGNMENTS_REQUIRED', 'Visual assignments must be an array.');
  }
  const sourceId = exactId(source?.id, 'Source id');
  const text = typeof source?.text === 'string' ? source.text : '';
  const snapped = snapCharacterRangeToTokens(text, fromCharacter, toCharacter);
  if (!snapped) fail('VISUAL_SCORE_EMPTY_SELECTION', 'Select visible source text first.');
  fromCharacter = snapped.fromCharacter;
  toCharacter = snapped.toCharacter;
  const selected = text.slice(fromCharacter, toCharacter);
  const candidate = {
    id: exactId(assignmentId, 'Assignment id'),
    sourceId,
    assetId: exactId(assetId, 'Asset id'),
    fromCharacter,
    toCharacter,
    quoteStart: fingerprint(selected, 'start'),
    quoteEnd: fingerprint(selected, 'end')
  };
  if (cue != null) {
    const field = cue?.kind === 'field' && ['focal', 'attractor', 'genesis'].includes(cue.renderer);
    const procedural = cue?.kind === 'procedural' && Array.isArray(cue.collections)
      && cue.collections.length === 1;
    if (!field && !procedural) {
      fail('VISUAL_SCORE_CUE_SNAPSHOT', 'Only configurable visual cues may be snapshotted.');
    }
    candidate.cue = scoreCue(cue);
  }
  resolveSourceSpan({
    sourceIds: [sourceId],
    fromCharacter,
    toCharacter,
    quoteStart: candidate.quoteStart,
    quoteEnd: candidate.quoteEnd
  }, text, 'visualScore.selection');

  const conflicts = assignments.filter(item => overlaps(item, candidate));
  if (conflicts.length && overlap !== 'replace') {
    fail('VISUAL_SCORE_OVERLAP',
      'That selection overlaps an existing visual assignment.', {
        conflicts: conflicts.map(item => item.id), candidate
      });
  }
  if (overlap !== 'reject' && overlap !== 'replace') {
    fail('VISUAL_SCORE_OVERLAP_POLICY', 'Unknown visual overlap policy.', { overlap });
  }
  const retained = assignments.filter(item => !conflicts.includes(item));
  if (retained.some(item => item?.id === candidate.id)) {
    fail('VISUAL_SCORE_DUPLICATE_ASSIGNMENT', `Assignment ${candidate.id} already exists.`, {
      assignmentId: candidate.id
    });
  }
  if (retained.length >= EXPERIENCE_PROGRAM_LIMITS.maxClipsPerTrack) {
    fail('VISUAL_SCORE_ASSIGNMENT_LIMIT',
      `A visual lane accepts at most ${EXPERIENCE_PROGRAM_LIMITS.maxClipsPerTrack} assignments.`);
  }
  return Object.freeze([
    ...retained,
    Object.freeze(candidate)
  ]);
}

export function eraseVisualSpan(assignments = [], assignmentId) {
  const id = exactId(assignmentId, 'Assignment id');
  return Object.freeze(assignments.filter(item => item.id !== id));
}

function sourceTitle(source, index) {
  const title = typeof source?.name === 'string' && source.name.trim()
    ? source.name.trim()
    : `Source ${index + 1}`;
  return title.slice(0, 200);
}

/** Compile editor state into the sole public Experience Program format. */
export function compileVisualScoreProgram({
  programId, sources, assets, assignments, visualFallback = { kind: 'still' }
}) {
  const lane = validateVisualScoreLane({ sources, assets, assignments });
  if (lane.assignments.length === 0) return null;

  return createExperienceProgram({
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id: exactId(programId, 'Program id'),
    authority: 'user',
    editable: true,
    tracks: [
      {
        id: 'movements',
        kind: 'movement',
        clips: lane.sources.map((source, index) => ({
          id: `source-${index + 1}`,
          anchor: { sourceIds: [source.id] },
          data: { index, title: sourceTitle(sources[index], index) }
        }))
      },
      {
        id: 'visual-main',
        kind: 'visual',
        clips: lane.assignments.map(assignment => {
          const asset = lane.assets.find(item => item.id === assignment.assetId);
          return {
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
        }),
        fallback: visualFallback
      }
    ],
    metadata: { kind: 'workshop-visual-score' }
  });
}

/** Validate that every canonical sequence-asset cue resolves locally. */
export function validateSequenceAssetReferences(program, assets = []) {
  const canonicalAssets = assets.map(createSequenceVisualAsset);
  const assetsById = new Map(canonicalAssets
    .map(asset => [exactId(asset.id, 'Asset id'), asset]));
  for (const track of program?.tracks || []) {
    if (track.kind !== 'visual') continue;
    for (const clip of track.clips) {
      for (const reference of sequenceAssetReferencesFromCue(clip.cue)) {
        const asset = assetsById.get(reference.id);
        const kindMatches = reference.expectedKind === 'video'
          ? asset?.kind === 'video'
          : asset != null && asset.kind !== 'video';
        if (!kindMatches) {
          const assetLabel = reference.role === 'personal-focal'
            ? 'personal focal'
            : reference.role === 'sequence-video' ? 'sequence video' : 'sequence image';
          fail('VISUAL_SCORE_ASSET_NOT_FOUND',
            `Visual clip ${clip.id} names missing ${assetLabel} ${reference.id}, `
              + 'or the project media has the wrong kind.',
            {
              clipId: clip.id,
              assetId: reference.id,
              assetRole: reference.role,
              expectedKind: reference.expectedKind,
              actualKind: asset?.kind || null
            });
        }
      }
    }
  }
  return true;
}
