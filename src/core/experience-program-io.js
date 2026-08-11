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

  const allowedSources = new Set([
    ...context.sources.map(item => item.id),
    ...(context.library || []).map(item => item.id)
  ]);
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
  assertProgramWithinBudget(program, context);
  return true;
}

/**
 * A reading is as long as the sources its MOVEMENTS name.
 *
 * Exactly, not approximately: a movement anchor carries only `sourceIds` —
 * `validateAnchor` gives it no range — so a movement reads its sources whole.
 * Visual, audio and reading clips bind inside territory the movements already
 * own and add no words of their own.
 *
 * A source whose length is unknown makes the budget unprovable, and inability
 * to prove is not proof: refuse, rather than admit an unmeasured work.
 */
function assertProgramWithinBudget(program, context) {
  const budget = context.constraints?.targetWords;
  if (!budget) return;

  const wordsById = new Map();
  for (const item of [...(context.sources || []), ...(context.library || [])]) {
    if (Number.isInteger(item.words)) wordsById.set(item.id, item.words);
  }

  const named = [];
  for (const track of program.tracks || []) {
    if (track.kind !== 'movement') continue;
    for (const clip of track.clips || []) {
      for (const sourceId of clip.anchor?.sourceIds || []) {
        if (!named.some(entry => entry.sourceId === sourceId)) {
          named.push({ sourceId, words: wordsById.get(sourceId) });
        }
      }
    }
  }

  const unmeasured = named.filter(entry => entry.words === undefined);
  if (unmeasured.length) {
    fail('PROGRAM_IO_BUDGET_UNMEASURED',
      `Cannot measure this score against the ${budget}-word budget: `
      + `${unmeasured.map(entry => entry.sourceId).join(', ')} declares no word count`,
      '$.tracks',
      { budget, sourceIds: unmeasured.map(entry => entry.sourceId) });
  }

  const total = named.reduce((sum, entry) => sum + entry.words, 0);
  if (total > budget) {
    fail('PROGRAM_IO_BUDGET_EXCEEDED',
      `This score reads ${total.toLocaleString()} words against a budget of ${budget.toLocaleString()}`,
      '$.tracks',
      {
        budget,
        total,
        sources: [...named].sort((left, right) => right.words - left.words)
      });
  }
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
    defaults: withVisualSurfaceForProgram(experienceProgram, defaults),
    provenance: {
      kind: 'live-curator-import',
      ...provenance
    },
    updatedAt: Date.now()
  });
}

/**
 * A score with a visual track arrives with its surface already on.
 *
 * An imported program carried no reading defaults, so the project opened
 * with visuals off and the score did nothing until someone found the
 * Presentation control and chose Scored by hand — the one step a curator
 * loop exists to remove.
 *
 * GALLERY IS THE PRESENTATION CHOSEN. It is the reader default, it is the
 * only surface that never flashes, and it is therefore the only one that
 * opens without a photosensitivity notice standing between an accepted
 * score and its reading. A score cannot request a different surface: the
 * program has no field for one, and inventing a default that flashes
 * would put a safety prompt in a path the author never asked for.
 */
export function withVisualSurfaceForProgram(program, defaults = {}) {
  const hasVisualTrack = (program?.tracks || [])
    .some(track => track.kind === 'visual' && (track.clips || []).length);
  if (!hasVisualTrack) return defaults;
  // An explicit surface from the caller wins — this only fills a silence.
  if (defaults?.visual?.surface) return defaults;

  const config = defaults?.visual?.config || {};
  return {
    ...defaults,
    visual: {
      ...(defaults.visual || {}),
      surface: 'scored',
      config: {
        ...config,
        visualMode: 'interlocution',
        interlocution: {
          ...(config.interlocution || {}),
          presentation: 'continuous'
        }
      }
    }
  };
}

/**
 * What to say to whoever wrote the score that was refused.
 *
 * The typed errors already carry a code, a path and the offending ids;
 * this turns them into a correction a curator can paste back without
 * knowing anything about this codebase. Where the refusal is a
 * membership failure the reply lists what WAS available, because "not in
 * the context" is unactionable and "use one of these" is not.
 *
 * @returns {string} plain text, safe to put on a clipboard
 */
export function describeImportFailure(error, { context = null } = {}) {
  const code = error?.code || 'UNKNOWN';
  const path = error?.path && error.path !== '$' ? error.path : '';
  const details = error?.details || {};
  const lines = [];

  const options = (label, ids) => {
    const list = (ids || []).filter(Boolean);
    if (!list.length) return;
    const shown = list.slice(0, 40);
    lines.push(`Available ${label}: ${shown.join(', ')}${list.length > shown.length ? ', …' : ''}`);
  };

  switch (code) {
    case 'PROGRAM_LANE_OVERLAP':
      lines.push(
        `Two clips on the same ${details.trackKind || 'track'} lane cover overlapping ranges of source `
        + `"${details.sourceId}": ${(details.clipIds || []).join(' and ')}.`,
        'One lane may present one thing at a time. Give them ranges that do not intersect '
        + '(ranges are half-open, so `to` may equal the next `from`), put one on a different '
        + 'lane, or drop one.'
      );
      break;
    case 'PROGRAM_IO_PUBLISHED_REFUSED':
      lines.push(
        'This score declares authority "published", which only RISE\'s own Journeys may claim.',
        'Remove the authority field; an imported score is a proposal.'
      );
      break;
    case 'PROGRAM_IO_UNKNOWN_SOURCE':
      lines.push(`The score names source "${details.sourceId}", which this reader does not have.`);
      options('sources', [
        ...(context?.sources || []).map(item => item.id),
        ...(context?.library || []).map(item => item.id)
      ]);
      break;
    case 'PROGRAM_IO_UNKNOWN_COLLECTION':
      lines.push(`The score names collection "${details.collectionId}", which is not offered.`);
      options('collections', context?.visuals?.collections);
      break;
    case 'PROGRAM_IO_UNKNOWN_ENGINE':
      lines.push(`The score names engine "${details.engineId}", which is not offered.`);
      options('engines', context?.visuals?.engines);
      break;
    case 'PROGRAM_IO_UNKNOWN_SOUNDSCAPE':
      lines.push(`The score names soundscape "${details.soundscapeId}", which is not offered.`);
      options('soundscapes', context?.audio?.soundscapes);
      break;
    case 'PROGRAM_IO_UNKNOWN_TONE':
      lines.push(`The score names tone "${details.presetId}", which is not offered.`);
      options('tones', context?.audio?.tones);
      break;
    case 'PROGRAM_IO_UNKNOWN_SWELL':
      lines.push(`The score names swell "${details.swellId}", which is not offered.`);
      options('swells', context?.audio?.swells);
      break;
    case 'PROGRAM_IO_URI_REFUSED':
      lines.push(
        'The score embeds a URI. Scores name things by id only — no data:, blob: or http(s) values.',
        'Replace it with an id drawn from the curator context.'
      );
      break;
    case 'PROGRAM_IO_TOO_LARGE':
      lines.push(
        `The document is ${details.length} characters; the limit is ${details.maxBytes}.`,
        'Send the score only — no source text, no images.'
      );
      break;
    case 'PROGRAM_IO_JSON':
      lines.push('The document is not valid JSON.', error.message);
      break;
    case 'SOURCE_SPAN_QUOTE_AMBIGUOUS':
      lines.push(
        `"${details.quoteStart}" occurs ${details.occurrences} times in this source.`,
        'Quote a phrase that appears once, or extend it until it does.'
      );
      break;
    case 'SOURCE_SPAN_QUOTE_NOT_FOUND':
      lines.push(
        'A quotation anchor could not be located in the edition.',
        'Check the wording, or use a progress range instead.'
      );
      break;
    case 'PROGRAM_IO_BUDGET_EXCEEDED': {
      lines.push(
        `This score reads ${Number(details.total).toLocaleString()} words. `
        + `You asked for ${Number(details.budget).toLocaleString()}.`,
        '',
        'Its movements name:'
      );
      for (const entry of (details.sources || []).slice(0, 8)) {
        lines.push(`  ${entry.sourceId} — ${Number(entry.words).toLocaleString()} words`);
      }
      lines.push(
        '',
        'A movement reads its source whole, so the only ways down are to name '
        + 'fewer works, name shorter ones, or raise the length before exporting again.'
      );
      break;
    }
    case 'PROGRAM_IO_BUDGET_UNMEASURED':
      lines.push(
        `${error.message}.`,
        'A score is measured against the budget by adding up the sources its '
        + 'movements name, so one source of unknown length makes the total '
        + 'unknowable. Export the context again so every source carries its word count.'
      );
      break;
    case 'PROGRAM_READING_CHUNK_ANCHOR':
      lines.push(
        `Pace clip "${details.clipId}" sets a chunkMode on a ${details.coordinate} anchor.`,
        'A chunk mode decides where the text is cut into atoms, and a progress range is '
        + 'measured in those same atoms — it cannot locate the cut it is asking to change. '
        + 'Anchor it with quoteStart/quoteEnd, or drop the range to score the whole source. '
        + 'A wpm cue has no such limit and may use progress.'
      );
      break;
    case 'PROGRAM_READING_EMPTY_CUE':
      lines.push(
        'A pace cue sets neither wpm nor chunkMode, so it occupies its span without '
        + 'changing anything — and one lane presents one thing at a time, so it would '
        + 'silence any later cue there. Give it a wpm, a chunkMode, or both.'
      );
      break;
    case 'PROGRAM_READING_CHUNK_MODE':
      lines.push(
        `${error.message}`,
        'Chunk modes are: word, phrase, sentence, paragraph.'
      );
      break;
    case 'PROGRAM_INCOMPLETE_RANGE':
      lines.push('A range carries only one endpoint. Give both `from` and `to` in the same coordinate system.');
      break;
    case 'PROGRAM_UNKNOWN_FIELD':
      lines.push(
        `${error.message}`,
        'Unknown fields are refused rather than ignored, so a misspelling cannot pass as an omission.'
      );
      break;
    default:
      lines.push(error?.message || 'The score was refused.');
  }

  if (path) lines.push(`At: ${path}`);
  lines.push(`(${code})`);
  return lines.join('\n');
}

/** Trigger a browser download of a JSON document. */
export function downloadJsonFile(filename, text) {
  downloadTextFile(
    filename.endsWith('.json') ? filename : `${filename}.json`,
    text,
    'application/json;charset=utf-8'
  );
}

/** Trigger a browser download of plain text. */
export function downloadTextFile(filename, text, mimeType = 'text/plain;charset=utf-8') {
  if (typeof document === 'undefined') {
    fail('PROGRAM_IO_DOWNLOAD', 'downloadTextFile requires a document', '$');
  }
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
