import {
  createExperienceProgram,
  EXPERIENCE_PROGRAM_LIMITS,
  EXPERIENCE_PROGRAM_SCHEMA
} from './experience-program.js';
import { normalizeQuote, resolveSourceSpan } from './source-span.js';
import {
  EDITOR_ASSET_SCHEMA,
  editorAssetSupports,
  validateEditorAsset
} from './editor-asset.js';

export const SEQUENCE_ASSET_PREFIX = 'sequence-asset:';
const MAX_SEQUENCE_ASSET_URI_LENGTH = 12 * 1024 * 1024;
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

/** Rebuild the deterministic editor reference stored implicitly by a cue. */
export function scoreAssetIdFromCue(cue) {
  if (!cue || !Array.isArray(cue.collections) || cue.collections.length !== 1) return null;
  const collection = cue.collections[0];
  if (cue.kind === 'sourced') {
    return assetIdFromCollection(collection) || `collection:${collection}`;
  }
  if (cue.kind === 'procedural') return `procedural:${collection}`;
  return null;
}

export function createSequenceVisualAsset({ id, uri, name, color, provenance }) {
  const asset = {
    id: exactId(id, 'Asset id'),
    uri: dataImage(uri),
    name: boundedName(name),
    color: VISUAL_SCORE_COLORS.includes(color) ? color : VISUAL_SCORE_COLORS[0]
  };
  const canonicalProvenance = boundedProvenance(provenance);
  if (canonicalProvenance) asset.provenance = canonicalProvenance;
  return Object.freeze(asset);
}

function scoreCue(value) {
  const cue = {
    kind: value.kind,
    collections: Object.freeze([...value.collections])
  };
  if (value.engines) cue.engines = Object.freeze([...value.engines]);
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
    cue: scoreCue({ kind: 'sourced', collections: [sequenceAssetCollection(asset.id)] })
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
    && left.fromCharacter < right.toCharacter
    && right.fromCharacter < left.toCharacter;
}

function strictAssignment(value, sources, assets) {
  const id = exactId(value?.id, 'Assignment id');
  const sourceId = exactId(value?.sourceId, 'Source id');
  const assetId = exactId(value?.assetId, 'Asset id');
  const source = sources.find(item => item.id === sourceId);
  if (!source) fail('VISUAL_SCORE_SOURCE_NOT_FOUND', `Source ${sourceId} is unavailable.`, { sourceId });
  if (!assets.some(item => item.id === assetId)) {
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
  return Object.freeze({
    id,
    sourceId,
    assetId,
    fromCharacter: anchor.fromCharacter,
    toCharacter: anchor.toCharacter,
    quoteStart: anchor.quoteStart,
    quoteEnd: anchor.quoteEnd
  });
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
  overlap = 'reject'
}) {
  if (!Array.isArray(assignments)) {
    fail('VISUAL_SCORE_ASSIGNMENTS_REQUIRED', 'Visual assignments must be an array.');
  }
  const sourceId = exactId(source?.id, 'Source id');
  const text = typeof source?.text === 'string' ? source.text : '';
  const selected = Number.isInteger(fromCharacter) && Number.isInteger(toCharacter)
    ? text.slice(fromCharacter, toCharacter)
    : '';
  const candidate = {
    id: exactId(assignmentId, 'Assignment id'),
    sourceId,
    assetId: exactId(assetId, 'Asset id'),
    fromCharacter,
    toCharacter,
    quoteStart: fingerprint(selected, 'start'),
    quoteEnd: fingerprint(selected, 'end')
  };
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
export function compileVisualScoreProgram({ programId, sources, assets, assignments }) {
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
            cue: asset.cue
          };
        }),
        fallback: { kind: 'still' }
      }
    ],
    metadata: { kind: 'workshop-visual-score' }
  });
}

/** Validate that every canonical sequence-asset cue resolves locally. */
export function validateSequenceAssetReferences(program, assets = []) {
  const ids = new Set(assets.map(asset => createSequenceVisualAsset(asset).id));
  for (const track of program?.tracks || []) {
    if (track.kind !== 'visual') continue;
    for (const clip of track.clips) {
      for (const collection of clip.cue?.collections || []) {
        const assetId = assetIdFromCollection(collection);
        if (assetId && !ids.has(assetId)) {
          fail('VISUAL_SCORE_ASSET_NOT_FOUND',
            `Visual clip ${clip.id} names missing sequence image ${assetId}.`,
            { clipId: clip.id, assetId });
        }
      }
    }
  }
  return true;
}
