/**
 * rise.agent-operation-set.v1 — closed, inspectable Workshop mutations.
 *
 * An agent proposes a bounded command list against an explicit revision.
 * It does not emit a shadow project, hold the mutation lock across a
 * network wait, or gain any power a human cannot inspect and undo.
 */

import {
  EXPERIENCE_PROGRAM_SCHEMA,
  PROGRAM_VISUAL_FIELD_RENDERERS,
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
  assignNarrationSpan,
  appendNarrationTrack,
  createNarrationScoreAsset,
  eraseNarrationSpan,
  narrationAssignmentsFromClips
} from './narration-score-lane.js';
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
import { libraryExtentId } from './library-extent.js';
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
  'assign-narration',
  'replace-narration',
  'erase-narration',
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
  'assign-narration', 'replace-narration', 'erase-narration',
  'configure-field', 'set-pace', 'create-sync-group', 'remove-sync-group',
  'set-atmosphere', 'set-render-profile'
]);

const PENDING_OPS = new Set(['request-asset']);
const HOST_REQUEST_OPS = new Set(['request-preview', 'request-compile']);
const UNIMPLEMENTED_OPS = new Set(['create-transition', 'revise-transition']);

/**
 * WHY THE TWO DOORS DISAGREE ABOUT TRANSITIONS, SETTLED AND SAID OUT LOUD.
 * ───────────────────────────────────────────────────────────────────────
 * A transition is not a thing RISE cannot do. An experience program may carry
 * a `transition` track; the validator takes it; `lowerExperienceProgram` turns
 * it into a source boundary and `createAuthoredBoundary` compiles it into an
 * atom with the score's own duration, a synthetic source id the visual and
 * audio lanes can cue against, and an `authored-boundary` tag the Chamber
 * already honours. It is exactly the construct the inverted shelf needs, and
 * it works today.
 *
 * IT IS STILL REFUSED HERE, AND NOT OUT OF LAZINESS. An operation set's whole
 * authority is that every op is a command a person can already perform, which
 * is what makes one inspectable, reorderable and undoable by the reader it
 * acts for. The Workshop has no transition control — no lane, no handle, no
 * command — so an agent able to create one would hold a power the reader does
 * not, over a lane the reader cannot see in order to correct it.
 *
 * And it would not survive being held. `compileDraft` rebuilds a project's
 * program out of its assignments, and there is no transition assignment: the
 * clip would be admitted, then dropped at the next edit. That is the
 * `add-source.division` defect exactly — declared, validated, and read by
 * nothing — and this codebase has already paid for it once.
 *
 * So the refusal stands and NAMES THE DOOR THAT WORKS. One sentence, in one
 * place: the failure raises it, the inspection row prints it, and
 * curator-prompt.js teaches the same distinction, so a model that meets it at
 * any of the three is told the same thing.
 */
export const NO_TRANSITION_OPERATION = 'The Workshop has no transition control '
  + 'for a person to inspect or undo, so an operation set may not create one. A '
  + `transition IS available in a score: return a ${EXPERIENCE_PROGRAM_SCHEMA} `
  + 'with a "transition" track instead.';

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
  'assign-narration': ['assignmentId', 'sourceId', 'voiceId', 'assetId', 'fromCharacter',
    'toCharacter', 'quoteStart', 'quoteEnd', 'overlap', 'duck', 'pronunciations', 'words'],
  'replace-narration': ['assignmentId', 'sourceId', 'voiceId', 'assetId', 'fromCharacter',
    'toCharacter', 'quoteStart', 'quoteEnd', 'duck', 'pronunciations', 'words'],
  'erase-narration': ['assignmentId'],
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

/**
 * WHICH FIELDS OF AN OPERATION NAME A CAPABILITY, and which family each names.
 *
 * `OP_FIELDS` above says what an operation may carry. This says which of those
 * fields carry an id the reader was OFFERED, as opposed to a label the author
 * invents (`assignmentId`), a coordinate (`fromCharacter`) or a closed enum
 * the validator already settles (`overlap`).
 *
 * It is read back out of this file by scriptorium-gate.test.js and checked
 * against `OP_FIELDS`: a field that appears there and neither here nor in that
 * test's list of fields that name nothing is a failure. That is the only
 * arrangement in which a NEW capability-bearing field cannot be added without
 * the gate learning to check it — which is exactly how `soundscape`,
 * `audioPreset` and `selectedSwellId` came to be written straight into a
 * project's reading defaults with no gate anywhere in the path.
 */
export const OPERATION_CAPABILITY_FIELDS = Object.freeze({
  sourceId: 'sources',
  sourceIds: 'sources',
  assetId: 'lane-asset',
  voiceId: 'voices',
  soundscape: 'soundscapes',
  audioPreset: 'tones',
  selectedSwellId: 'swells',
  renderer: 'surfaces',
  profileId: 'render-profile'
});

/** The empty families every enumeration starts from, so callers may `for..of`. */
const noCapabilities = () => ({
  addedSources: [],
  removedSources: [],
  collections: new Set(),
  engines: new Set(),
  surfaces: new Set(),
  soundscapes: new Set(),
  tones: new Set(),
  swells: new Set(),
  voices: new Set(),
  assets: new Set()
});

/**
 * A soundscape whose voice is the reader's own file (workshop-audio.js).
 *
 * Written into `defaults.audio.soundscape` by the Workshop, so an operation
 * set may legitimately name one — and what it is really naming is a SWELL,
 * which is where the gate has to look for it.
 */
const PERSONAL_BED = 'personal:';

/**
 * The absence of a bed, which is not a bed and so is not a capability.
 *
 * `applyWorkshopAudioAsset` writes it whenever a tone is chosen. Refusing it
 * would refuse the one way an operation set has of saying "no atmosphere".
 */
const NO_SOUNDSCAPE = 'none';

/**
 * WHAT A VISUAL `assetId` NAMES — the grammar, in one place.
 *
 * `visualAssetFor` used to carry this as a chain of `startsWith` tests and the
 * gate carried none of it, so the two could not disagree only because one of
 * them did not exist. They read this now, which means a prefix added here is
 * a prefix both the gate and the producer learn at once.
 *
 * MUSEUM COLLECTIONS ARE TESTED BEFORE PROCEDURAL POOLS. Every museum id is in
 * `context.visuals.collections`, and the old order asked "is this id a
 * collection the context offers?" first and answered a bare `aic-ukiyoe` with
 * a PROCEDURAL field — so the `aic-` branch was dead code for every id the
 * context actually offered, and a reader who asked for ukiyo-e prints got a
 * generated field pointed at a pool that is not one.
 *
 * @returns {{ family: string, id: string, kind: string }}
 */
export function visualAssetReference(assetId) {
  const id = String(assetId ?? '');
  for (const prefix of ['project-image:', 'project-video:', 'sequence-asset:']) {
    if (id.startsWith(prefix)) {
      return { family: 'assets', id: id.slice(prefix.length), kind: 'project-asset' };
    }
  }
  if (id.startsWith('collection:')) {
    return { family: 'collections', id: id.slice('collection:'.length), kind: 'sourced' };
  }
  if (id.startsWith('aic-')) return { family: 'collections', id, kind: 'sourced' };
  if (id.startsWith('surface:')) {
    return { family: 'surfaces', id: id.slice('surface:'.length), kind: 'field' };
  }
  if (id.startsWith('procedural:')) {
    return { family: 'engines', id: id.slice('procedural:'.length), kind: 'procedural' };
  }
  // A bare id is a procedural pool or a work-engine family, which are offered
  // under both `collections` and `engines`; the gate accepts either.
  return { family: 'engines', id, kind: 'procedural' };
}

/** The same for an audio `assetId`: `soundscape:`, `tone:` or `swell:`. */
export function audioAssetReference(assetId) {
  const id = String(assetId ?? '');
  if (id.startsWith('soundscape:')) {
    return { family: 'soundscapes', id: id.slice('soundscape:'.length) };
  }
  if (id.startsWith('tone:')) return { family: 'tones', id: id.slice('tone:'.length) };
  if (id.startsWith('swell:')) return { family: 'swells', id: id.slice('swell:'.length) };
  // Not one of the three forms. The producer refuses it by name
  // (AGENT_OP_ASSET); there is no family for the gate to check it against.
  return { family: null, id };
}

/**
 * EVERY capability an operation set names, by family.
 *
 * The same law as `programSourceIds`, carried the rest of the way. That
 * function made the SOURCE check derived — one enumeration the budget spends
 * and the resolver walks — and the derivation stopped at text: a soundscape,
 * a tone preset, a personal swell, a narration voice and a field renderer
 * were all still hand-written allowlists, and the operations door consulted
 * none of them. `set-atmosphere` wrote three of them straight into a
 * project's reading defaults with no gate anywhere in the path.
 *
 * So the door spends exactly this, and the producer resolves exactly this
 * grammar. Not two functions kept in agreement — one enumeration, which is
 * the only arrangement a new capability-bearing field cannot silently break.
 *
 * `addedSources` and `removedSources` are kept in order rather than as a set,
 * because what a set cannot say is that a proposal added a work and then took
 * it away again — which is what a model does when it changes its mind
 * mid-proposal, and which leaves a reading with no text in it.
 */
export function operationSetCapabilities(operationSet) {
  const named = noCapabilities();
  for (const operation of operationSet?.operations || []) {
    switch (operation.op) {
      case 'add-source':
        if (operation.sourceId) named.addedSources.push(operation.sourceId);
        break;
      case 'remove-source':
        if (operation.sourceId) named.removedSources.push(operation.sourceId);
        break;
      case 'assign-visual':
      case 'replace-visual': {
        if (!operation.assetId) break;
        const reference = visualAssetReference(operation.assetId);
        named[reference.family].add(reference.id);
        break;
      }
      case 'configure-field':
        if (operation.renderer) named.surfaces.add(operation.renderer);
        break;
      case 'assign-audio':
      case 'replace-audio': {
        if (!operation.assetId) break;
        const reference = audioAssetReference(operation.assetId);
        if (reference.family) named[reference.family].add(reference.id);
        break;
      }
      case 'assign-narration':
      case 'replace-narration':
        if (operation.voiceId) named.voices.add(operation.voiceId);
        // A narration `assetId` is pre-rendered audio for a voice — a file,
        // and so an asset of the project, checked the way every other asset a
        // document names is checked.
        if (operation.assetId) named.assets.add(operation.assetId);
        break;
      case 'import-asset':
        if (operation.assetId) named.assets.add(operation.assetId);
        break;
      case 'set-atmosphere':
        if (operation.soundscape && operation.soundscape !== NO_SOUNDSCAPE) {
          if (operation.soundscape.startsWith(PERSONAL_BED)) {
            named.swells.add(operation.soundscape.slice(PERSONAL_BED.length));
          } else {
            named.soundscapes.add(operation.soundscape);
          }
        }
        if (operation.audioPreset) named.tones.add(operation.audioPreset);
        if (operation.selectedSwellId) named.swells.add(operation.selectedSwellId);
        break;
      default:
        // reorder-source permutes what the project already holds;
        // set-render-profile and request-asset name closed vocabularies the
        // validator has already settled; the rest name nothing offered.
        break;
    }
  }
  return named;
}

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
    /**
     * VALIDATED AND DROPPED IS THE WORST OF THE THREE.
     *
     * `division` was declared a legal field, checked into the operation, and
     * then read by nothing: resolveOperationLibrarySources maps `sourceId`
     * alone. So `{"op":"add-source","sourceId":"sacred-tao-te-ching",
     * "division":40}` was ACCEPTED and loaded the whole 10,321-word book —
     * the one place in this room that did something other than what it was
     * told.
     *
     * It is refused rather than honoured. Composing the id here would be
     * rewriting a model's output on its behalf, and the extent already has a
     * grammar that says the same thing in the place everything else reads:
     * the source id. The refusal names the id that WOULD have been meant, so
     * a curator can paste back a correction without learning anything about
     * this codebase.
     */
    if (source.division !== undefined) {
      const division = optionalInteger(source.division, `${path}.division`, 1);
      fail('AGENT_OP_DIVISION',
        `add-source names a division in a field nothing reads. An extent rides in `
        + `the source id: write "${libraryExtentId(op.sourceId, division)}"`,
        `${path}.division`,
        { sourceId: op.sourceId, division, extentId: libraryExtentId(op.sourceId, division) });
    }
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
    if (!['image', 'video', 'audio', 'font', 'document', 'voice'].includes(source.kind)) {
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
      // The program validator's own list, not a second spelling of it.
      if (!PROGRAM_VISUAL_FIELD_RENDERERS.includes(source.renderer)) {
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
  } else if (source.op === 'assign-narration' || source.op === 'replace-narration') {
    copyId('assignmentId');
    copyId('sourceId');
    if (source.assetId != null) copyId('assetId');
    if (source.voiceId != null) copyId('voiceId');
    if (!op.assetId && !op.voiceId) {
      fail('AGENT_OP_ASSET', 'assign-narration needs voiceId or assetId', `${path}.voiceId`);
    }
    Object.assign(op, validateAnchorFields(source, path));
    if (source.overlap != null) {
      if (source.overlap !== 'reject' && source.overlap !== 'replace') {
        fail('AGENT_OP_OVERLAP', 'overlap must be reject or replace', `${path}.overlap`);
      }
      op.overlap = source.overlap;
    }
    if (source.duck && typeof source.duck === 'object') op.duck = deepFreeze({ ...source.duck });
    if (Array.isArray(source.pronunciations)) {
      op.pronunciations = deepFreeze(source.pronunciations.map(item => ({ ...item })));
    }
    if (Array.isArray(source.words)) {
      op.words = deepFreeze(source.words.map(item => ({ ...item })));
    }
  } else if (source.op === 'erase-visual' || source.op === 'erase-audio'
    || source.op === 'erase-narration') {
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
      // A REFUSAL THAT SAYS ONLY ITS OWN NAME IS NOT A REFUSAL A CURATOR CAN
      // ACT ON. This row printed `create-transition` beside the word
      // "refused" and left the reader to guess whether RISE lacks the
      // capability or the door lacks it.
      : UNIMPLEMENTED_OPS.has(op.op)
        ? NO_TRANSITION_OPERATION
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

/**
 * The producer's half of the grammar `visualAssetReference` declares.
 *
 * It decides WHAT to build; the reference decides what the id NAMES. Keeping
 * those one function was how `aic-ukiyoe` came to build a procedural field:
 * the museum test sat below a bare-collection test that every museum id
 * satisfied, and nothing else in the tree read the same order.
 */
function visualAssetFor(assetId, { project, context, path = '$.assetId' }) {
  const reference = visualAssetReference(assetId);
  const held = (project.assets || []);
  const sequence = held.find(item => item.id === reference.id)
    || held.find(item => item.id === assetId);
  if (sequence) return sequence;

  if (reference.family === 'assets') {
    fail('AGENT_OP_ASSET', `Asset ${reference.id} is not admitted in this project`, path,
      { assetId: reference.id });
  }

  if (reference.family === 'surfaces') {
    // A CLOSED VOCABULARY, CHECKED WHERE IT IS NAMED. `surface:<anything>`
    // used to go straight into createEditorAsset, which refused it as
    // EDITOR_ASSET_CUE_KIND and leaked `$.cueTemplate.kind` — a path into an
    // object the reader never wrote — under a status that says RISE is broken.
    if (!PROGRAM_VISUAL_FIELD_RENDERERS.includes(reference.id)) {
      fail('AGENT_OP_SURFACE', `Unknown field renderer: ${reference.id}`, path,
        { renderer: reference.id, offered: [...PROGRAM_VISUAL_FIELD_RENDERERS] });
    }
    return createEditorAsset({
      id: `surface:${reference.id}`,
      lane: 'visual',
      kind: 'project-surface',
      name: reference.id,
      capability: 'span',
      editor: { color: VISUAL_SCORE_COLORS[2], preview: { kind: 'surface', ref: reference.id } },
      cueTemplate: { kind: 'field', renderer: reference.id, config: {} }
    });
  }

  if (reference.family === 'collections') {
    if (context?.visuals?.collections && !context.visuals.collections.includes(reference.id)) {
      fail('AGENT_OP_ASSET', `Collection ${reference.id} is not offered`, path);
    }
    return createEditorAsset({
      id: `collection:${reference.id}`,
      lane: 'visual',
      kind: 'sourced-collection',
      name: reference.id,
      capability: 'span',
      editor: { color: VISUAL_SCORE_COLORS[1], preview: { kind: 'sample', ref: reference.id } },
      cueTemplate: { kind: 'sourced', collections: [reference.id] }
    });
  }

  const family = reference.id;
  const offered = context?.visuals?.collections
    ? context.visuals.collections.includes(family)
      || (context.visuals.engines || []).includes(family)
    : null;
  if (reference.kind === 'bare' && !offered) {
    fail('AGENT_OP_ASSET', `Unknown visual asset ${assetId}`, path);
  }
  if (offered === false) {
    fail('AGENT_OP_ASSET', `Visual ${assetId} is not offered in context`, path);
  }
  return createEditorAsset({
    id: `procedural:${family}`,
    lane: 'visual',
    kind: 'procedural',
    name: family,
    capability: 'span',
    editor: { color: VISUAL_SCORE_COLORS[0], preview: { kind: 'generator', ref: family } },
    cueTemplate: { kind: 'procedural', collections: [family] }
  });
}

function audioAssetFor(assetId, { personalSwells = [], path = '$.assetId' }) {
  const asset = audioScoreAssetFromId(assetId, personalSwells);
  if (!asset) {
    // A swell says which absence it is. `Unknown audio asset swell:ghost` is
    // true and useless: the reader's shelf is the only place it could have
    // come from, and naming the shelf is what makes the refusal actionable.
    const reference = audioAssetReference(assetId);
    if (reference.family === 'swells') {
      fail('AGENT_OP_ASSET',
        `Personal audio ${reference.id} is not on this reader's shelf`, path,
        { swellId: reference.id });
    }
    fail('AGENT_OP_ASSET', `Unknown audio asset ${assetId}`, path);
  }
  return asset;
}

function sourceView(source) {
  return { id: source.id, name: source.name, text: source.data };
}

function compileDraft(draft) {
  const sources = draft.sources.map(sourceView);
  const hasMedia = draft.visualAssignments.length || draft.audioAssignments.length
    || draft.narrationAssignments.length;
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
    if (!program && sources.length) {
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
    if (program && draft.narrationAssignments.length) {
      program = validateExperienceProgram({
        ...program,
        tracks: appendNarrationTrack(program.tracks, draft.narrationAssignments)
      });
    }
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
    narrationAssignments: narrationAssignmentsFromClips(
      (base.experienceProgram?.tracks || []).find(track => track.kind === 'narration')?.clips || []
    ).map(item => ({ ...item })),
    visualAssets: [],
    audioAssets: [],
    narrationAssets: [],
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
  for (const assignment of draft.narrationAssignments) {
    if (draft.narrationAssets.some(item => item.id === assignment.assetId)) continue;
    try {
      draft.narrationAssets.push(createNarrationScoreAsset({
        id: assignment.assetId,
        cue: assignment.cue
      }));
    } catch {
      /* compile will refuse if the voice cannot be named */
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
        `${op.op} has no human Workshop command yet, so an agent may not use it. `
        + NO_TRANSITION_OPERATION,
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
        ...draft.narrationAssignments, ...draft.paceAssignments]
        .some(item => item.sourceId === op.sourceId);
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
      const visual = visualAssetFor(assetId, {
        project: { assets: draft.assets }, context, path
      });
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
      const audio = audioAssetFor(op.assetId, { personalSwells, path });
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

    if (op.op === 'assign-narration' || op.op === 'replace-narration') {
      const source = findSource(op.sourceId, path);
      const span = resolveSpan(op, source, path);
      const voiceKey = op.voiceId || op.assetId;
      let asset = draft.narrationAssets.find(item => item.id === voiceKey);
      if (!asset) {
        try {
          asset = createNarrationScoreAsset({
            id: voiceKey,
            voiceId: op.voiceId,
            voiceAssetId: op.assetId,
            duck: op.duck,
            pronunciations: op.pronunciations,
            words: op.words
          });
        } catch (error) {
          fail(error.code || 'AGENT_OP_NARRATION', error.message, path, error.details || {});
        }
        draft.narrationAssets.push(asset);
      }
      const overlap = op.op === 'replace-narration' ? 'replace' : (op.overlap || 'reject');
      try {
        draft.narrationAssignments = assignNarrationSpan({
          assignments: draft.narrationAssignments,
          source: sourceView(source),
          assetId: asset.id,
          assets: draft.narrationAssets,
          assignmentId: op.assignmentId,
          fromCharacter: span.fromCharacter,
          toCharacter: span.toCharacter,
          overlap,
          cue: {
            kind: 'spoken',
            ...(op.voiceId || asset.cue.voiceId
              ? { voiceId: op.voiceId || asset.cue.voiceId } : {}),
            ...(op.assetId || asset.cue.voiceAssetId
              ? { voiceAssetId: op.assetId || asset.cue.voiceAssetId } : {}),
            ...(op.duck ? { duck: op.duck } : {}),
            ...(op.pronunciations ? { pronunciations: op.pronunciations } : {}),
            ...(op.words ? { words: op.words } : {})
          }
        });
      } catch (error) {
        fail(error.code || 'AGENT_OP_NARRATION', error.message, path, error.details || {});
      }
      const command = overlap === 'replace' ? 'replace-overlap' : 'assign';
      inspection.push(inspectionRow(op, {
        summary: `Narration ${asset.id} on ${op.sourceId}`,
        fromCharacter: span.fromCharacter,
        toCharacter: span.toCharacter,
        workshopCommand: command
      }));
      workshopCommands.push({ type: command, lane: 'narration', assignmentId: op.assignmentId });
      continue;
    }

    if (op.op === 'erase-narration') {
      draft.narrationAssignments = eraseNarrationSpan(draft.narrationAssignments, op.assignmentId);
      inspection.push(inspectionRow(op, {
        summary: `Erase narration ${op.assignmentId}`,
        workshopCommand: 'erase'
      }));
      workshopCommands.push({ type: 'erase', lane: 'narration', assignmentId: op.assignmentId });
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
