/**
 * Experience Program JSON interchange — Live Curator import / export gate.
 *
 * Parse and serialize rise.experience-program.v1. Imports land as
 * authority: proposed (Vault draft). Published programs cannot be
 * laundered through this doorway. Optional curator-context membership
 * checks fail closed when a context is supplied.
 */

import {
  EXPERIENCE_PROGRAM_SCHEMA,
  validateExperienceProgram
} from './experience-program.js';
import {
  validateCuratorContext
} from './curator-context.js';
import {
  WORKSHOP_PROJECT_SCHEMA,
  validateWorkshopProject
} from './workshop-project.js';
import { isBoundarySource } from './journey-compiler.js';

/** Refuse multi-hundred-megabyte pastes before JSON.parse allocates. */
export const PROGRAM_IO_MAX_JSON_BYTES = 2_000_000;

export class ExperienceProgramIoError extends Error {
  constructor(code, message, path = '$', details = {}) {
    super(`${message} (${path})`);
    this.name = 'ExperienceProgramIoError';
    this.code = code;
    this.path = path;
    this.details = details;
  }
}

const fail = (code, message, path, details) => {
  throw new ExperienceProgramIoError(code, message, path, details);
};

function looksLikeUri(value) {
  return typeof value === 'string'
    && (/^(data:|blob:|javascript:)/i.test(value) || /^https?:\/\//i.test(value));
}

function assertNoSmuggledUris(value, path = '$') {
  if (value == null) return;
  if (typeof value === 'string') {
    if (looksLikeUri(value)) {
      fail('PROGRAM_IO_URI_REFUSED', 'Imported scores may not embed URIs', path);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSmuggledUris(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
        fail('PROGRAM_IO_PROTOTYPE', 'Prototype keys are refused', `${path}.${key}`);
      }
      assertNoSmuggledUris(item, `${path}.${key}`);
    }
  }
}

/** Scan cues and metadata only — quote fingerprints may legitimately mention URLs. */
function assertScoreHasNoSmuggledUris(program) {
  assertNoSmuggledUris(program.metadata, '$.metadata');
  (program.tracks || []).forEach((track, trackIndex) => {
    assertNoSmuggledUris(track.metadata, `$.tracks[${trackIndex}].metadata`);
    (track.clips || []).forEach((clip, clipIndex) => {
      const base = `$.tracks[${trackIndex}].clips[${clipIndex}]`;
      assertNoSmuggledUris(clip.cue, `${base}.cue`);
      assertNoSmuggledUris(clip.metadata, `${base}.metadata`);
      assertNoSmuggledUris(clip.data, `${base}.data`);
    });
  });
}

/**
 * Coerce a validated-shape candidate into a Live Curator proposal.
 * Refuses published authority (cannot launder a Journey).
 */
export function normalizeImportedProgram(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('PROGRAM_IO_RECORD', 'Expected an Experience Program object', '$');
  }
  if (value.schema !== EXPERIENCE_PROGRAM_SCHEMA) {
    fail('PROGRAM_IO_SCHEMA', `Expected schema ${EXPERIENCE_PROGRAM_SCHEMA}`, '$.schema');
  }
  if (value.authority === 'published') {
    fail(
      'PROGRAM_IO_PUBLISHED_REFUSED',
      'Published programs cannot be imported through the Live Curator doorway',
      '$.authority'
    );
  }
  assertScoreHasNoSmuggledUris(value);

  const metadata = value.metadata && typeof value.metadata === 'object' && !Array.isArray(value.metadata)
    ? { ...value.metadata, kind: value.metadata.kind || 'live-curator-import' }
    : { kind: 'live-curator-import' };

  return {
    ...value,
    authority: 'proposed',
    editable: true,
    metadata
  };
}

/**
 * Parse JSON text into a frozen proposed Experience Program.
 * Never clamps or repairs — validateExperienceProgram refuses or accepts.
 */
export function parseExperienceProgramJson(text, options = {}) {
  if (typeof text !== 'string' || !text.trim()) {
    fail('PROGRAM_IO_EMPTY', 'Expected non-empty JSON text', '$');
  }
  if (text.length > PROGRAM_IO_MAX_JSON_BYTES) {
    fail(
      'PROGRAM_IO_TOO_LARGE',
      `Experience Program JSON may not exceed ${PROGRAM_IO_MAX_JSON_BYTES} characters`,
      '$',
      { maxBytes: PROGRAM_IO_MAX_JSON_BYTES, length: text.length }
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    fail('PROGRAM_IO_JSON', `Invalid JSON: ${error.message}`, '$');
  }
  return importExperienceProgram(parsed, options);
}

/**
 * Import a program object (already parsed). Lands as proposed.
 * When `context` is supplied, every named source/collection/engine/
 * soundscape/swell/tone must appear in that capability document.
 */
export function importExperienceProgram(value, { context = null } = {}) {
  const normalized = normalizeImportedProgram(value);
  const program = validateExperienceProgram(normalized);
  if (context != null) {
    assertProgramWithinContext(program, context);
  }
  return program;
}

/** Stable pretty JSON for handoff / file download. */
export function serializeExperienceProgram(program) {
  const validated = validateExperienceProgram(program);
  return `${JSON.stringify(validated, null, 2)}\n`;
}

function cueIdsFromProgram(program) {
  const collections = new Set();
  const engines = new Set();
  const soundscapes = new Set();
  const swells = new Set();
  const tones = new Set();
  /** @type {Array<{ sourceId: string, trackKind: string }>} */
  const sourceRefs = [];

  for (const track of program.tracks || []) {
    for (const clip of track.clips || []) {
      for (const sourceId of clip.anchor?.sourceIds || []) {
        sourceRefs.push({ sourceId, trackKind: track.kind });
      }
      const cue = clip.cue;
      if (!cue) continue;
      for (const id of cue.collections || []) collections.add(id);
      for (const id of cue.engines || []) engines.add(id);
      if (cue.soundscapeId) soundscapes.add(cue.soundscapeId);
      if (cue.swellId) swells.add(cue.swellId);
      if (cue.kind === 'tone' && cue.presetId) tones.add(cue.presetId);
    }
  }
  return { collections, engines, soundscapes, swells, tones, sourceRefs };
}

/**
 * Fail closed: every named capability in the program must be listed in context.
 *
 * Synthetic boundary sources are program-local and omitted from curator
 * context, but only when a transition clip in *this* program declares them.
 * A bare `journey-boundary:` prefix on a movement/visual does not bypass
 * membership — that was the hole. Uses isBoundarySource (shared with the
 * Journey compiler) rather than a second hardcoded literal.
 */
export function assertProgramWithinContext(program, contextValue) {
  const context = validateCuratorContext(contextValue);

  const allowedSources = new Set(context.sources.map(item => item.id));
  const allowedCollections = new Set(context.visuals.collections);
  const allowedEngines = new Set(context.visuals.engines);
  const allowedSoundscapes = new Set(context.audio.soundscapes);
  const allowedTones = new Set(context.audio.tones);
  const allowedSwells = new Set(context.audio.swells);

  const declaredTransitionSources = new Set();
  for (const track of program.tracks || []) {
    if (track.kind !== 'transition') continue;
    for (const clip of track.clips || []) {
      for (const sourceId of clip.anchor?.sourceIds || []) {
        if (isBoundarySource(sourceId)) declaredTransitionSources.add(sourceId);
      }
    }
  }

  const used = cueIdsFromProgram(program);

  for (const { sourceId, trackKind } of used.sourceRefs) {
    if (declaredTransitionSources.has(sourceId)) continue;
    if (!allowedSources.has(sourceId)) {
      fail('PROGRAM_IO_UNKNOWN_SOURCE',
        `Program names source ${sourceId} absent from curator context`,
        '$.tracks',
        { sourceId, trackKind });
    }
  }
  for (const id of used.collections) {
    if (!allowedCollections.has(id)) {
      fail('PROGRAM_IO_UNKNOWN_COLLECTION',
        `Program names collection ${id} absent from curator context`,
        '$.tracks',
        { collectionId: id });
    }
  }
  for (const id of used.engines) {
    if (!allowedEngines.has(id)) {
      fail('PROGRAM_IO_UNKNOWN_ENGINE',
        `Program names engine ${id} absent from curator context`,
        '$.tracks',
        { engineId: id });
    }
  }
  for (const id of used.soundscapes) {
    if (!allowedSoundscapes.has(id)) {
      fail('PROGRAM_IO_UNKNOWN_SOUNDSCAPE',
        `Program names soundscape ${id} absent from curator context`,
        '$.tracks',
        { soundscapeId: id });
    }
  }
  for (const id of used.tones) {
    if (!allowedTones.has(id)) {
      fail('PROGRAM_IO_UNKNOWN_TONE',
        `Program names tone ${id} absent from curator context`,
        '$.tracks',
        { presetId: id });
    }
  }
  for (const id of used.swells) {
    if (!allowedSwells.has(id)) {
      fail('PROGRAM_IO_UNKNOWN_SWELL',
        `Program names swell ${id} absent from curator context`,
        '$.tracks',
        { swellId: id });
    }
  }
  return true;
}

/**
 * Wrap an imported proposed program into a Vault-ready Workshop project
 * using the active surface's sources and assets (IDs only in the score).
 * When `context` is supplied, capability membership is enforced (fail-closed).
 */
export function workshopProjectFromImportedProgram({
  program,
  sources = [],
  assets = [],
  defaults = {},
  title = '',
  intent = 'custom',
  id = `curator-import-${Date.now()}`,
  provenance = {},
  context = null
} = {}) {
  const experienceProgram = importExperienceProgram(program, { context });
  return validateWorkshopProject({
    schema: WORKSHOP_PROJECT_SCHEMA,
    id,
    title: title || experienceProgram.id,
    intent,
    sources,
    assets,
    experienceProgram,
    defaults,
    provenance: {
      kind: 'live-curator-import',
      ...provenance
    },
    updatedAt: Date.now()
  });
}

/** Trigger a browser download of a JSON document. */
export function downloadJsonFile(filename, text) {
  if (typeof document === 'undefined') {
    fail('PROGRAM_IO_DOWNLOAD', 'downloadJsonFile requires a document', '$');
  }
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
