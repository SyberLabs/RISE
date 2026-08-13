/**
 * rise.agent-operation-set.v1 — closed, inspectable Workshop mutations.
 *
 * An agent proposes a bounded command list against an explicit revision.
 * It does not emit a shadow project, hold the mutation lock across a
 * network wait, or gain any power a human cannot inspect and undo.
 */

import {
  EXPERIENCE_PROGRAM_SCHEMA,
  createExperienceProgram,
  validateExperienceProgram
} from './experience-program.js';
import { createEditorAsset } from './editor-asset.js';
import {
  assignAudioSpan,
  compileWorkshopScoreProgram,
  eraseAudioSpan
} from './audio-score-lane.js';
import {
  assignVisualSpan,
  eraseVisualSpan,
  VISUAL_SCORE_COLORS
} from './visual-score-lane.js';
import { audioScoreAssetFromId } from './workshop-audio.js';
import {
  WORKSHOP_PROJECT_SCHEMA,
  audioAssignmentsFromProgram,
  emptyWorkshopProject,
  validateWorkshopProject,
  visualAssignmentsFromProgram
} from './workshop-project.js';
import { locateQuoteSpan } from './source-span.js';
import { RENDER_PROFILE_IDS } from './render/limits.js';

export const AGENT_OPERATION_SET_SCHEMA = 'rise.agent-operation-set.v1';

export const AGENT_OPERATION_OPS = Object.freeze([
  'add-source',
  'remove-source',
  'reorder-source',
  'request-asset',
  'import-asset',
  'assign-visual',
  'replace-visual',
  'erase-visual',
  'assign-audio',
  'replace-audio',
  'erase-audio',
  'configure-field',
  'set-pace',
  'create-transition',
  'revise-transition',
  'create-sync-group',
  'remove-sync-group',
  'set-atmosphere',
  'set-render-profile',
  'request-preview',
  'request-compile'
]);

const MUTATING_OPS = new Set([
  'add-source', 'remove-source', 'reorder-source', 'import-asset',
  'assign-visual', 'replace-visual', 'erase-visual',
  'assign-audio', 'replace-audio', 'erase-audio',
  'configure-field', 'set-pace', 'create-sync-group', 'remove-sync-group',
  'set-atmosphere', 'set-render-profile'
]);

const PENDING_OPS = new Set(['request-asset']);
const HOST_REQUEST_OPS = new Set(['request-preview', 'request-compile']);
const UNIMPLEMENTED_OPS = new Set(['create-transition', 'revise-transition']);

export const AGENT_OPERATION_LIMITS = Object.freeze({
  maxIdLength: 160,
  maxOperations: 32,
  maxIntentLength: 2000,
  maxRationaleLength: 500
});

const SET_FIELDS = new Set([
  'schema', 'id', 'projectId', 'baseRevision', 'generationId', 'intent',
  'operations', 'rationale'
]);
const COMMON_OP_FIELDS = new Set(['op', 'id', 'rationale']);
const OP_FIELDS = Object.freeze({
  'add-source': ['sourceId', 'division'],
  'remove-source': ['sourceId'],
  'reorder-source': ['sourceIds'],
  'request-asset': ['requestId', 'kind', 'query', 'anchor'],
  'import-asset': ['assetId'],
  'assign-visual': ['assignmentId', 'sourceId', 'assetId', 'fromCharacter', 'toCharacter',
    'quoteStart', 'quoteEnd', 'overlap', 'cue'],
  'replace-visual': ['assignmentId', 'sourceId', 'assetId', 'fromCharacter', 'toCharacter',
    'quoteStart', 'quoteEnd', 'cue'],
  'erase-visual': ['assignmentId'],
  'assign-audio': ['assignmentId', 'sourceId', 'assetId', 'fromCharacter', 'toCharacter',
    'quoteStart', 'quoteEnd', 'overlap', 'syncGroup'],
  'replace-audio': ['assignmentId', 'sourceId', 'assetId', 'fromCharacter', 'toCharacter',
    'quoteStart', 'quoteEnd', 'syncGroup'],
  'erase-audio': ['assignmentId'],
  'configure-field': ['assignmentId', 'sourceId', 'renderer', 'fromCharacter', 'toCharacter',
    'quoteStart', 'quoteEnd'],
  'set-pace': ['assignmentId', 'sourceId', 'fromCharacter', 'toCharacter', 'quoteStart',
    'quoteEnd', 'cue'],
  'create-transition': ['transitionId', 'fromMovementId', 'toMovementId'],
  'revise-transition': ['transitionId', 'fromMovementId', 'toMovementId'],
  'create-sync-group': ['syncGroup', 'visualAssignmentId', 'audioAssignmentId'],
  'remove-sync-group': ['syncGroup'],
  'set-atmosphere': ['soundscape', 'audioPreset', 'selectedSwellId'],
  'set-render-profile': ['profileId'],
  'request-preview': ['fromMs', 'toMs', 'tier'],
  'request-compile': []
});

export class AgentOperationError extends Error {
  constructor(code, message, path = '$', details = {}) {
    super(`${message} (${path})`);
    this.name = 'AgentOperationError';
    this.code = code;
    this.path = path;
    this.details = details;
  }
}

const fail = (code, message, path, details) => {
  throw new AgentOperationError(code, message, path, details);
};

function record(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('AGENT_OP_OBJECT', 'Expected an object', path);
  }
  return value;
}

function onlyKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      fail('AGENT_OP_UNKNOWN_FIELD', `Unknown field: ${key}`, `${path}.${key}`);
    }
  }
}

function exactId(value, path) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    fail('AGENT_OP_ID', 'Expected a non-empty, trimmed id', path);
  }
  if (value.length > AGENT_OPERATION_LIMITS.maxIdLength) {
    fail('AGENT_OP_ID', `Ids may not exceed ${AGENT_OPERATION_LIMITS.maxIdLength} characters`, path);
  }
  if (/^(data:|blob:|https?:|javascript:)/i.test(value) || value.includes('://')) {
    fail('AGENT_OP_URI', 'Operation identities may not be URIs', path, { value });
  }
  return value;
}

function boundedText(value, path, max) {
  if (value == null) return null;
  if (typeof value !== 'string') fail('AGENT_OP_TEXT', 'Expected a string', path);
  const text = value.trim();
  if (!text) return null;
  if (text.length > max) fail('AGENT_OP_TEXT', `Text may not exceed ${max} characters`, path);
  return text;
}

function optionalInteger(value, path, min = 0) {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < min) {
    fail('AGENT_OP_INTEGER', `Expected an integer ≥ ${min}`, path);
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

function validateAnchorFields(source, path) {
  const fromCharacter = optionalInteger(source.fromCharacter, `${path}.fromCharacter`);
  const toCharacter = optionalInteger(source.toCharacter, `${path}.toCharacter`);
  const quoteStart = boundedText(source.quoteStart, `${path}.quoteStart`, 500);
  const quoteEnd = boundedText(source.quoteEnd, `${path}.quoteEnd`, 500);
  if ((fromCharacter == null) !== (toCharacter == null)) {
    fail('AGENT_OP_ANCHOR', 'fromCharacter and toCharacter must be paired', path);
  }
  if ((quoteStart == null) !== (quoteEnd == null)) {
    fail('AGENT_OP_ANCHOR', 'quoteStart and quoteEnd must be paired', path);
  }
  return { fromCharacter, toCharacter, quoteStart, quoteEnd };
}

function validateOperation(value, path) {
  const source = record(value, path);
  if (!AGENT_OPERATION_OPS.includes(source.op)) {
    fail('AGENT_OP_UNKNOWN', `Unknown operation: ${String(source.op)}`, `${path}.op`);
  }
  onlyKeys(source, new Set([...COMMON_OP_FIELDS, ...OP_FIELDS[source.op]]), path);
  const op = {
    op: source.op,
    id: exactId(source.id, `${path}.id`)
  };
  const rationale = boundedText(source.rationale, `${path}.rationale`,
    AGENT_OPERATION_LIMITS.maxRationaleLength);
  if (rationale) op.rationale = rationale;

  const copyId = (field) => {
    if (source[field] != null) op[field] = exactId(source[field], `${path}.${field}`);
  };

  if (source.op === 'add-source') {
    op.sourceId = exactId(source.sourceId, `${path}.sourceId`);
    const division = optionalInteger(source.division, `${path}.division`, 0);
    if (division != null) op.division = division;
  } else if (source.op === 'remove-source') {
    op.sourceId = exactId(source.sourceId, `${path}.sourceId`);
  } else if (source.op === 'reorder-source') {
    if (!Array.isArray(source.sourceIds) || !source.sourceIds.length) {
      fail('AGENT_OP_SOURCE_LIST', 'reorder-source needs a sourceIds array', `${path}.sourceIds`);
    }
    op.sourceIds = Object.freeze(source.sourceIds.map((id, index) =>
      exactId(id, `${path}.sourceIds[${index}]`)));
  } else if (source.op === 'request-asset') {
    op.requestId = exactId(source.requestId, `${path}.requestId`);
    if (!['image', 'video', 'audio', 'font', 'document'].includes(source.kind)) {
      fail('AGENT_OP_KIND', `Unknown asset kind: ${String(source.kind)}`, `${path}.kind`);
    }
    op.kind = source.kind;
    op.query = boundedText(source.query, `${path}.query`, 400)
      || fail('AGENT_OP_TEXT', 'request-asset needs a query', `${path}.query`);
    if (source.anchor && typeof source.anchor === 'object') {
      op.anchor = deepFreeze({ ...validateAnchorFields(source.anchor, `${path}.anchor`) });
    }
  } else if (source.op === 'import-asset') {
    op.assetId = exactId(source.assetId, `${path}.assetId`);
  } else if (['assign-visual', 'replace-visual', 'assign-audio', 'replace-audio',
    'configure-field', 'set-pace'].includes(source.op)) {
    copyId('assignmentId');
    copyId('sourceId');
    if (source.op !== 'configure-field' && source.op !== 'set-pace') copyId('assetId');
    if (source.op === 'configure-field') {
      if (!['focal', 'attractor', 'genesis'].includes(source.renderer)) {
        fail('AGENT_OP_FIELD', `Unknown field renderer: ${String(source.renderer)}`,
          `${path}.renderer`);
      }
      op.renderer = source.renderer;
    }
    Object.assign(op, validateAnchorFields(source, path));
    if (source.overlap != null) {
      if (source.overlap !== 'reject' && source.overlap !== 'replace') {
        fail('AGENT_OP_OVERLAP', 'overlap must be reject or replace', `${path}.overlap`);
      }
      op.overlap = source.overlap;
    }
    if (source.syncGroup != null) op.syncGroup = exactId(source.syncGroup, `${path}.syncGroup`);
    if (source.cue && typeof source.cue === 'object') {
      op.cue = deepFreeze({ ...source.cue });
    }
    if (!op.assignmentId) {
      fail('AGENT_OP_ID', 'A span operation needs assignmentId', `${path}.assignmentId`);
    }
    if (!op.sourceId) {
      fail('AGENT_OP_ID', 'A span operation needs sourceId', `${path}.sourceId`);
    }
  } else if (source.op === 'erase-visual' || source.op === 'erase-audio') {
    op.assignmentId = exactId(source.assignmentId, `${path}.assignmentId`);
  } else if (source.op === 'create-transition' || source.op === 'revise-transition') {
    copyId('transitionId');
    copyId('fromMovementId');
    copyId('toMovementId');
  } else if (source.op === 'create-sync-group') {
    op.syncGroup = exactId(source.syncGroup, `${path}.syncGroup`);
    copyId('visualAssignmentId');
    copyId('audioAssignmentId');
  } else if (source.op === 'remove-sync-group') {
    op.syncGroup = exactId(source.syncGroup, `${path}.syncGroup`);
  } else if (source.op === 'set-atmosphere') {
    if (source.soundscape != null) op.soundscape = exactId(source.soundscape, `${path}.soundscape`);
    if (source.audioPreset != null) op.audioPreset = exactId(source.audioPreset, `${path}.audioPreset`);
    if (source.selectedSwellId != null) {
      op.selectedSwellId = exactId(source.selectedSwellId, `${path}.selectedSwellId`);
    }
  } else if (source.op === 'set-render-profile') {
    op.profileId = exactId(source.profileId, `${path}.profileId`);
    if (!RENDER_PROFILE_IDS.includes(op.profileId)) {
      fail('AGENT_OP_PROFILE', `Unknown render profile: ${op.profileId}`, `${path}.profileId`);
    }
  } else if (source.op === 'request-preview') {
    const fromMs = optionalInteger(source.fromMs, `${path}.fromMs`);
    const toMs = optionalInteger(source.toMs, `${path}.toMs`);
    if (fromMs != null) op.fromMs = fromMs;
    if (toMs != null) op.toMs = toMs;
    if (source.tier != null) {
      if (source.tier !== 'draft' && source.tier !== 'final') {
        fail('AGENT_OP_TIER', 'tier must be draft or final', `${path}.tier`);
      }
      op.tier = source.tier;
    }
  }

  return deepFreeze(op);
}

export function validateAgentOperationSet(value, path = '$') {
  const source = record(value, path);
  onlyKeys(source, SET_FIELDS, path);
  if (source.schema !== AGENT_OPERATION_SET_SCHEMA) {
    fail('AGENT_OP_SCHEMA', `Expected ${AGENT_OPERATION_SET_SCHEMA}`, `${path}.schema`);
  }
  if (!Array.isArray(source.operations) || !source.operations.length
    || source.operations.length > AGENT_OPERATION_LIMITS.maxOperations) {
    fail('AGENT_OP_COUNT',
      `An operation set accepts 1–${AGENT_OPERATION_LIMITS.maxOperations} operations`,
      `${path}.operations`);
  }
  const operations = source.operations.map((item, index) =>
    validateOperation(item, `${path}.operations[${index}]`));
  if (new Set(operations.map(item => item.id)).size !== operations.length) {
    fail('AGENT_OP_DUPLICATE', 'Operation ids must be unique', `${path}.operations`);
  }
  const set = {
    schema: AGENT_OPERATION_SET_SCHEMA,
    id: exactId(source.id, `${path}.id`),
    projectId: exactId(source.projectId, `${path}.projectId`),
    baseRevision: optionalInteger(source.baseRevision, `${path}.baseRevision`) ?? 0,
    operations
  };
  if (source.generationId != null) {
    set.generationId = exactId(source.generationId, `${path}.generationId`);
  }
  const intent = boundedText(source.intent, `${path}.intent`,
    AGENT_OPERATION_LIMITS.maxIntentLength);
  if (intent) set.intent = intent;
  const rationale = boundedText(source.rationale, `${path}.rationale`,
    AGENT_OPERATION_LIMITS.maxRationaleLength);
  if (rationale) set.rationale = rationale;
  return deepFreeze(set);
}

export function createAgentRun({ generationId = `run-${Date.now()}` } = {}) {
  return deepFreeze({
    generationId: exactId(generationId, '$.generationId'),
    cancelled: false
  });
}

export function cancelAgentRun(run) {
  return deepFreeze({ ...run, cancelled: true });
}

export function createAgentOperationHistory(limit = 50) {
  return deepFreeze({ limit, past: [], future: [] });
}

export function recordAgentOperationSet(history, command) {
  const current = history && Array.isArray(history.past) ? history : createAgentOperationHistory();
  return deepFreeze({
    limit: current.limit,
    past: [...current.past, deepFreeze(command)].slice(-current.limit),
    future: []
  });
}

export function undoAgentOperationSet(history) {
  const current = history && Array.isArray(history.past) ? history : createAgentOperationHistory();
  if (!current.past.length) return deepFreeze({ history: current, command: null });
  const command = current.past[current.past.length - 1];
  return deepFreeze({
    history: {
      limit: current.limit,
      past: current.past.slice(0, -1),
      future: [command, ...current.future]
    },
    command
  });
}

export function redoAgentOperationSet(history) {
  const current = history && Array.isArray(history.past) ? history : createAgentOperationHistory();
  if (!current.future.length) return deepFreeze({ history: current, command: null });
  const command = current.future[0];
  return deepFreeze({
    history: {
      limit: current.limit,
      past: [...current.past, command].slice(-current.limit),
      future: current.future.slice(1)
    },
    command
  });
}

/** Inspect a proposal without applying it. Pending acquisitions stay pending. */
export function summarizeAgentOperationSet(value) {
  const set = validateAgentOperationSet(value);
  return Object.freeze(set.operations.map((op) => inspectionRow(op, {
    status: PENDING_OPS.has(op.op)
      ? 'pending'
      : HOST_REQUEST_OPS.has(op.op)
        ? 'requested'
        : UNIMPLEMENTED_OPS.has(op.op)
          ? 'refused'
          : 'proposed',
    summary: op.op === 'request-asset'
      ? `Acquisition ${op.requestId} remains unresolved until admission`
      : op.rationale || op.op
  })));
}

function libraryIds(context) {
  return new Set((context?.library || []).map(item => item.id));
}

function offeredSourceIds(context, project) {
  return new Set([
    ...(project?.sources || []).map(item => item.id),
    ...(context?.sources || []).map(item => item.id),
    ...libraryIds(context)
  ]);
}

function resolveSpan(op, source, path) {
  if (op.fromCharacter != null && op.toCharacter != null) {
    return { fromCharacter: op.fromCharacter, toCharacter: op.toCharacter };
  }
  if (op.quoteStart && op.quoteEnd) {
    const located = locateQuoteSpan(source.data || source.text || '', op.quoteStart, op.quoteEnd);
    if (!located) {
      fail('AGENT_OP_SPAN', `Could not locate the quoted span in ${source.id}`, path);
    }
    return located;
  }
  return {
    fromCharacter: 0,
    toCharacter: (source.data || source.text || '').length
  };
}

function visualAssetFor(assetId, { project, context }) {
  const rawId = assetId.startsWith('project-image:')
    ? assetId.slice('project-image:'.length)
    : assetId.startsWith('project-video:')
      ? assetId.slice('project-video:'.length)
      : assetId;
  const sequence = (project.assets || []).find(item => item.id === rawId);
  if (sequence) return sequence;

  if (assetId.startsWith('procedural:') || (context?.visuals?.collections || []).includes(assetId)) {
    const family = assetId.startsWith('procedural:') ? assetId.slice('procedural:'.length) : assetId;
    if (context?.visuals?.collections
      && !context.visuals.collections.includes(family)
      && !context.visuals.collections.includes(assetId)
      && !(context.visuals.engines || []).includes(family)) {
      fail('AGENT_OP_ASSET', `Visual ${assetId} is not offered in context`, '$.assetId');
    }
    return createEditorAsset({
      id: assetId.startsWith('procedural:') ? assetId : `procedural:${family}`,
      lane: 'visual',
      kind: 'procedural',
      name: family,
      capability: 'span',
      editor: { color: VISUAL_SCORE_COLORS[0], preview: { kind: 'generator', ref: family } },
      cueTemplate: { kind: 'procedural', collections: [family] }
    });
  }

  if (assetId.startsWith('collection:') || assetId.startsWith('aic-')) {
    const collectionId = assetId.startsWith('collection:')
      ? assetId.slice('collection:'.length)
      : assetId;
    if (context?.visuals?.collections && !context.visuals.collections.includes(collectionId)) {
      fail('AGENT_OP_ASSET', `Collection ${collectionId} is not offered`, '$.assetId');
    }
    return createEditorAsset({
      id: `collection:${collectionId}`,
      lane: 'visual',
      kind: 'sourced-collection',
      name: collectionId,
      capability: 'span',
      editor: { color: VISUAL_SCORE_COLORS[1], preview: { kind: 'sample', ref: collectionId } },
      cueTemplate: { kind: 'sourced', collections: [collectionId] }
    });
  }

  if (assetId.startsWith('surface:')) {
    const renderer = assetId.slice('surface:'.length);
    return createEditorAsset({
      id: assetId,
      lane: 'visual',
      kind: 'project-surface',
      name: renderer,
      capability: 'span',
      editor: { color: VISUAL_SCORE_COLORS[2], preview: { kind: 'surface', ref: renderer } },
      cueTemplate: { kind: 'field', renderer, config: {} }
    });
  }

  fail('AGENT_OP_ASSET', `Unknown visual asset ${assetId}`, '$.assetId');
}

function audioAssetFor(assetId, { personalSwells = [] }) {
  const asset = audioScoreAssetFromId(assetId, personalSwells);
  if (!asset) fail('AGENT_OP_ASSET', `Unknown audio asset ${assetId}`, '$.assetId');
  return asset;
}

function sourceView(source) {
  return { id: source.id, name: source.name, text: source.data };
}

function compileDraft(draft) {
  const sources = draft.sources.map(sourceView);
  const hasMedia = draft.visualAssignments.length || draft.audioAssignments.length;
  let program = null;
  if (hasMedia) {
    program = compileWorkshopScoreProgram({
      programId: `workshop-${draft.id}`,
      sources,
      visualAssets: draft.visualAssets,
      visualAssignments: draft.visualAssignments,
      audioAssets: draft.audioAssets,
      audioAssignments: draft.audioAssignments
    });
  } else if (sources.length) {
    program = createExperienceProgram({
      schema: EXPERIENCE_PROGRAM_SCHEMA,
      id: `workshop-${draft.id}`,
      authority: 'user',
      editable: true,
      tracks: [{
        id: 'movements',
        kind: 'movement',
        clips: sources.map((source, index) => ({
          id: `source-${index + 1}`,
          anchor: { sourceIds: [source.id] },
          data: { index, title: source.name || `Source ${index + 1}` }
        }))
      }]
    });
  }
  if (draft.paceAssignments.length && program) {
    const tracks = [...program.tracks];
    tracks.push({
      id: 'reading',
      kind: 'reading',
      clips: draft.paceAssignments.map(item => ({
        id: item.id,
        anchor: {
          sourceIds: [item.sourceId],
          ...(item.fromCharacter != null ? {
            fromCharacter: item.fromCharacter,
            toCharacter: item.toCharacter,
            quoteStart: item.quoteStart,
            quoteEnd: item.quoteEnd
          } : {})
        },
        cue: item.cue
      }))
    });
    program = validateExperienceProgram({ ...program, tracks });
  }
  return program;
}

function projectFromDraft(draft, revision) {
  return validateWorkshopProject({
    schema: WORKSHOP_PROJECT_SCHEMA,
    id: draft.id,
    title: draft.title,
    intent: draft.intent,
    sources: draft.sources,
    assets: draft.assets,
    experienceProgram: compileDraft(draft),
    defaults: draft.defaults,
    provenance: draft.provenance,
    revision,
    updatedAt: Date.now()
  });
}

function inspectionRow(op, extra = {}) {
  return deepFreeze({
    id: op.id,
    op: op.op,
    status: extra.status || 'applied',
    summary: extra.summary || op.op,
    sourceId: extra.sourceId || op.sourceId || null,
    assetId: extra.assetId || op.assetId || null,
    fromCharacter: extra.fromCharacter ?? op.fromCharacter ?? null,
    toCharacter: extra.toCharacter ?? op.toCharacter ?? null,
    rationale: op.rationale || null,
    workshopCommand: extra.workshopCommand || null
  });
}

function assertGeneration(operationSet, run) {
  if (!run) return;
  if (run.cancelled) {
    fail('AGENT_OP_CANCELLED', 'This agent run was cancelled; its result cannot apply',
      '$.generationId', { generationId: operationSet.generationId });
  }
  if (operationSet.generationId && run.generationId !== operationSet.generationId) {
    fail('AGENT_OP_STALE_GENERATION',
      'This proposal belongs to a superseded agent run',
      '$.generationId',
      { expected: run.generationId, actual: operationSet.generationId });
  }
}

/**
 * Apply a validated operation set to a Workshop project.
 * Either every mutating op commits or the original project is unchanged.
 */
export function applyAgentOperationSet({
  project = null,
  operationSet,
  context = null,
  resolvedSources = {},
  personalSwells = [],
  run = null
} = {}) {
  const set = validateAgentOperationSet(operationSet);
  const base = project
    ? validateWorkshopProject(project)
    : emptyWorkshopProject({ id: set.projectId, intent: 'custom' });
  assertGeneration(set, run);
  if (base.id !== set.projectId) {
    fail('AGENT_OP_PROJECT', 'The operation set names a different project', '$.projectId', {
      expected: base.id, actual: set.projectId
    });
  }
  if (base.revision !== set.baseRevision) {
    fail('AGENT_OP_STALE_REVISION',
      `Project is at revision ${base.revision}; this proposal was built on ${set.baseRevision}`,
      '$.baseRevision',
      { expected: set.baseRevision, actual: base.revision });
  }

  const sourceLookup = resolvedSources instanceof Map
    ? resolvedSources
    : new Map(Object.entries(resolvedSources || {}));
  const offered = offeredSourceIds(context, base);
  const draft = {
    id: base.id,
    title: base.title,
    intent: set.intent || base.intent,
    sources: base.sources.map(item => ({ ...item })),
    assets: [...base.assets],
    defaults: {
      ...base.defaults,
      reading: { ...base.defaults.reading },
      visual: { ...base.defaults.visual },
      audio: { ...base.defaults.audio },
      render: { ...(base.defaults.render || {}) }
    },
    provenance: { ...base.provenance },
    visualAssignments: visualAssignmentsFromProgram(base.experienceProgram).map(item => ({ ...item })),
    audioAssignments: audioAssignmentsFromProgram(base.experienceProgram).map(item => ({ ...item })),
    visualAssets: [],
    audioAssets: [],
    paceAssignments: (base.experienceProgram?.tracks || [])
      .filter(track => track.kind === 'reading')
      .flatMap(track => (track.clips || []).map(clip => ({
        id: clip.id,
        sourceId: clip.anchor.sourceIds[0],
        fromCharacter: clip.anchor.fromCharacter,
        toCharacter: clip.anchor.toCharacter,
        quoteStart: clip.anchor.quoteStart,
        quoteEnd: clip.anchor.quoteEnd,
        cue: clip.cue
      })))
  };

  for (const assignment of draft.visualAssignments) {
    if (draft.visualAssets.some(item => item.id === assignment.assetId)) continue;
    try {
      draft.visualAssets.push(visualAssetFor(assignment.assetId, { project: base, context }));
    } catch {
      /* existing assignment without a resolvable library id stays until compile */
    }
  }
  for (const assignment of draft.audioAssignments) {
    if (draft.audioAssets.some(item => item.id === assignment.assetId)) continue;
    try {
      draft.audioAssets.push(audioAssetFor(assignment.assetId, { personalSwells }));
    } catch {
      /* same as visual: compile will refuse if the asset is truly gone */
    }
  }

  const inspection = [];
  const requests = [];
  const workshopCommands = [];

  const findSource = (sourceId, path) => {
    const found = draft.sources.find(item => item.id === sourceId);
    if (!found) fail('AGENT_OP_SOURCE', `Source ${sourceId} is not in the project`, path);
    return found;
  };

  for (const op of set.operations) {
    const path = `$.operations[id=${op.id}]`;
    if (UNIMPLEMENTED_OPS.has(op.op)) {
      fail('AGENT_OP_NO_WORKSHOP_EQUIVALENT',
        `${op.op} has no human Workshop command yet, so an agent may not use it`,
        path, { op: op.op, operationId: op.id });
    }
    if (PENDING_OPS.has(op.op)) {
      inspection.push(inspectionRow(op, {
        status: 'pending',
        summary: `Acquisition ${op.requestId} remains unresolved until admission`
      }));
      continue;
    }
    if (HOST_REQUEST_OPS.has(op.op)) {
      requests.push(op);
      inspection.push(inspectionRow(op, {
        status: 'requested',
        summary: op.op === 'request-compile'
          ? 'Compilation and duration estimate requested'
          : 'Bounded preview requested'
      }));
      continue;
    }

    if (op.op === 'add-source') {
      if (!offered.has(op.sourceId) && !sourceLookup.has(op.sourceId)) {
        fail('AGENT_OP_SOURCE', `Source ${op.sourceId} is not offered`, path);
      }
      if (draft.sources.some(item => item.id === op.sourceId)) {
        fail('AGENT_OP_SOURCE', `Source ${op.sourceId} is already in the project`, path);
      }
      const resolved = sourceLookup.get(op.sourceId);
      if (!resolved || typeof resolved.data !== 'string' || !resolved.data) {
        fail('AGENT_OP_SOURCE_UNRESOLVED',
          `Source ${op.sourceId} has no resolved text to admit`, path);
      }
      draft.sources.push({
        id: op.sourceId,
        name: resolved.name || op.sourceId,
        providerId: resolved.providerId || 'library',
        type: resolved.type || 'text/plain',
        data: resolved.data,
        words: resolved.data.split(/\s+/u).filter(Boolean).length
      });
      inspection.push(inspectionRow(op, {
        summary: `Add source ${op.sourceId}`,
        workshopCommand: 'add-source'
      }));
      workshopCommands.push({ type: 'add-source', sourceId: op.sourceId });
      continue;
    }

    if (op.op === 'remove-source') {
      findSource(op.sourceId, path);
      const stillNamed = [...draft.visualAssignments, ...draft.audioAssignments,
        ...draft.paceAssignments].some(item => item.sourceId === op.sourceId);
      if (stillNamed) {
        fail('AGENT_OP_SOURCE_IN_USE',
          `Source ${op.sourceId} is still named by the score`, path);
      }
      draft.sources = draft.sources.filter(item => item.id !== op.sourceId);
      inspection.push(inspectionRow(op, {
        summary: `Remove source ${op.sourceId}`,
        workshopCommand: 'remove-source'
      }));
      workshopCommands.push({ type: 'remove-source', sourceId: op.sourceId });
      continue;
    }

    if (op.op === 'reorder-source') {
      const current = draft.sources.map(item => item.id);
      if (op.sourceIds.length !== current.length
        || op.sourceIds.some(id => !current.includes(id))) {
        fail('AGENT_OP_SOURCE_LIST', 'reorder-source must permute the current sources', path);
      }
      draft.sources = op.sourceIds.map(id => draft.sources.find(item => item.id === id));
      inspection.push(inspectionRow(op, {
        summary: 'Reorder sources',
        workshopCommand: 'reorder-source'
      }));
      workshopCommands.push({ type: 'reorder-source' });
      continue;
    }

    if (op.op === 'import-asset') {
      if (!(draft.assets || []).some(item => item.id === op.assetId)) {
        fail('AGENT_OP_ASSET', `Asset ${op.assetId} is not admitted in this project`, path);
      }
      inspection.push(inspectionRow(op, {
        summary: `Use admitted asset ${op.assetId}`,
        workshopCommand: 'import-asset'
      }));
      continue;
    }

    if (op.op === 'assign-visual' || op.op === 'replace-visual' || op.op === 'configure-field') {
      const source = findSource(op.sourceId, path);
      const span = resolveSpan(op, source, path);
      const assetId = op.op === 'configure-field' ? `surface:${op.renderer}` : op.assetId;
      const visual = visualAssetFor(assetId, { project: { assets: draft.assets }, context });
      if (!draft.visualAssets.some(item => item.id === visual.id)) draft.visualAssets.push(visual);
      const overlap = op.op === 'replace-visual' ? 'replace' : (op.overlap || 'reject');
      draft.visualAssignments = assignVisualSpan({
        assignments: draft.visualAssignments,
        source: sourceView(source),
        assetId: visual.id,
        assignmentId: op.assignmentId,
        fromCharacter: span.fromCharacter,
        toCharacter: span.toCharacter,
        overlap,
        cue: op.op === 'configure-field'
          ? { kind: 'field', renderer: op.renderer, config: {} }
          : op.cue || null
      });
      const command = overlap === 'replace' ? 'replace-overlap' : 'assign';
      inspection.push(inspectionRow(op, {
        summary: `Visual ${visual.id} on ${op.sourceId}`,
        assetId: visual.id,
        fromCharacter: span.fromCharacter,
        toCharacter: span.toCharacter,
        workshopCommand: command
      }));
      workshopCommands.push({ type: command, lane: 'visual', assignmentId: op.assignmentId });
      continue;
    }

    if (op.op === 'erase-visual') {
      draft.visualAssignments = eraseVisualSpan(draft.visualAssignments, op.assignmentId);
      inspection.push(inspectionRow(op, {
        summary: `Erase visual ${op.assignmentId}`,
        workshopCommand: 'erase'
      }));
      workshopCommands.push({ type: 'erase', lane: 'visual', assignmentId: op.assignmentId });
      continue;
    }

    if (op.op === 'assign-audio' || op.op === 'replace-audio') {
      const source = findSource(op.sourceId, path);
      const span = resolveSpan(op, source, path);
      const audio = audioAssetFor(op.assetId, { personalSwells });
      if (!draft.audioAssets.some(item => item.id === audio.id)) draft.audioAssets.push(audio);
      const overlap = op.op === 'replace-audio' ? 'replace' : (op.overlap || 'reject');
      draft.audioAssignments = assignAudioSpan({
        assignments: draft.audioAssignments,
        source: sourceView(source),
        assetId: audio.id,
        assets: draft.audioAssets,
        assignmentId: op.assignmentId,
        fromCharacter: span.fromCharacter,
        toCharacter: span.toCharacter,
        overlap,
        syncGroup: op.syncGroup
      });
      const command = overlap === 'replace' ? 'replace-overlap' : 'assign';
      inspection.push(inspectionRow(op, {
        summary: `Audio ${audio.id} on ${op.sourceId}`,
        fromCharacter: span.fromCharacter,
        toCharacter: span.toCharacter,
        workshopCommand: command
      }));
      workshopCommands.push({ type: command, lane: 'audio', assignmentId: op.assignmentId });
      continue;
    }

    if (op.op === 'erase-audio') {
      draft.audioAssignments = eraseAudioSpan(draft.audioAssignments, op.assignmentId);
      inspection.push(inspectionRow(op, {
        summary: `Erase audio ${op.assignmentId}`,
        workshopCommand: 'erase'
      }));
      workshopCommands.push({ type: 'erase', lane: 'audio', assignmentId: op.assignmentId });
      continue;
    }

    if (op.op === 'set-pace') {
      const source = findSource(op.sourceId, path);
      const cue = op.cue && (op.cue.wpm != null || op.cue.chunkMode)
        ? { kind: 'pace', ...(op.cue.wpm != null ? { wpm: op.cue.wpm } : {}),
          ...(op.cue.chunkMode ? { chunkMode: op.cue.chunkMode } : {}) }
        : fail('AGENT_OP_PACE', 'set-pace needs wpm or chunkMode', `${path}.cue`);
      const ranged = op.fromCharacter != null || op.quoteStart;
      const span = ranged ? resolveSpan(op, source, path) : {};
      draft.paceAssignments = draft.paceAssignments.filter(item => item.id !== op.assignmentId);
      draft.paceAssignments.push({
        id: op.assignmentId,
        sourceId: op.sourceId,
        cue,
        ...span
      });
      inspection.push(inspectionRow(op, {
        summary: `Pace on ${op.sourceId}`,
        fromCharacter: span.fromCharacter ?? null,
        toCharacter: span.toCharacter ?? null,
        workshopCommand: 'set-pace'
      }));
      workshopCommands.push({ type: 'set-pace', assignmentId: op.assignmentId });
      continue;
    }

    if (op.op === 'create-sync-group') {
      const visual = draft.visualAssignments.find(item => item.id === op.visualAssignmentId);
      const audio = draft.audioAssignments.find(item => item.id === op.audioAssignmentId);
      if (!visual || !audio) {
        fail('AGENT_OP_SYNC', 'create-sync-group names missing assignments', path);
      }
      draft.audioAssignments = draft.audioAssignments.map(item =>
        item.id === audio.id ? { ...item, syncGroup: op.syncGroup } : item);
      inspection.push(inspectionRow(op, {
        summary: `Sync ${op.syncGroup}`,
        workshopCommand: 'create-sync-group'
      }));
      workshopCommands.push({ type: 'create-sync-group', syncGroup: op.syncGroup });
      continue;
    }

    if (op.op === 'remove-sync-group') {
      draft.audioAssignments = draft.audioAssignments.map(item => {
        if (item.syncGroup !== op.syncGroup) return item;
        const next = { ...item };
        delete next.syncGroup;
        return next;
      });
      inspection.push(inspectionRow(op, {
        summary: `Remove sync ${op.syncGroup}`,
        workshopCommand: 'remove-sync-group'
      }));
      workshopCommands.push({ type: 'remove-sync-group', syncGroup: op.syncGroup });
      continue;
    }

    if (op.op === 'set-atmosphere') {
      if (op.soundscape) draft.defaults.audio.soundscape = op.soundscape;
      if (op.audioPreset) draft.defaults.audio.audioPreset = op.audioPreset;
      if (op.selectedSwellId !== undefined) {
        draft.defaults.audio.selectedSwellId = op.selectedSwellId || null;
      }
      inspection.push(inspectionRow(op, {
        summary: 'Set project atmosphere',
        workshopCommand: 'set-atmosphere'
      }));
      workshopCommands.push({ type: 'set-atmosphere' });
      continue;
    }

    if (op.op === 'set-render-profile') {
      draft.defaults.render.profileId = op.profileId;
      inspection.push(inspectionRow(op, {
        summary: `Render profile ${op.profileId}`,
        workshopCommand: 'set-render-profile'
      }));
      workshopCommands.push({ type: 'set-render-profile', profileId: op.profileId });
    }
  }

  const next = projectFromDraft(draft, base.revision + 1);
  const command = {
    type: 'agent-operation-set',
    operationSetId: set.id,
    generationId: set.generationId || null,
    before: base,
    after: next,
    workshopCommands
  };

  return deepFreeze({
    project: next,
    inspection,
    requests,
    historyCommand: command,
    proposedVisual: draft.visualAssignments,
    proposedAudio: draft.audioAssignments
  });
}

export function previewAgentOperationSet(input) {
  return applyAgentOperationSet(input);
}

export function rejectAgentOperation({ operationSet, operationId }) {
  const set = validateAgentOperationSet(operationSet);
  const kept = set.operations.filter(item => item.id !== operationId);
  if (kept.length === set.operations.length) {
    fail('AGENT_OP_MISSING', `No operation ${operationId} in this proposal`, '$.operationId');
  }
  if (!kept.length) {
    return null;
  }
  return validateAgentOperationSet({ ...set, operations: kept });
}
