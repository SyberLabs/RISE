/** A score and exact Archive references, carried as untrusted browser data. */
import { releaseArchiveMetadata } from '../content/archive/index.js';
import { PROCEDURAL_PATTERN_IDS } from './visual-registry.js';
import { exportCuratorContext } from './curator-context.js';
import { importExperienceProgram, programCapabilities, programSourceIds,
  workshopProjectFromImportedProgram } from './experience-program-io.js';
import { validateExperienceProgram } from './experience-program.js';
import { parseLibraryExtent } from './library-extent.js';
import { READING_PACE } from './reading-limits.js';
import { contentHashOf } from './render/hash.js';
import { assertResolvedProgramQuotations, resolveProgramLibrarySources } from './scriptorium-resolve.js';
import { validateWorkshopProject } from './workshop-project.js';

export const PORTABLE_SEQUENCE_SCHEMA = 'rise.portable-sequence.v1';
export const PORTABLE_SEQUENCE_MAX_BYTES = 2_000_000;
const PORTABLE_BASIS = 'pre-1930-us';
const PROCEDURAL_IDS = new Set(PROCEDURAL_PATTERN_IDS);

class PortableSequenceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PortableSequenceError';
    this.code = code;
  }
}

function refuse(code, message) { throw new PortableSequenceError(code, message); }

function onlyKeys(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    refuse('PORTABLE_RECORD', 'This is not a portable sequence document.');
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) refuse('PORTABLE_UNKNOWN_FIELD', `Unrecognized field: ${key}.`);
  }
}

function sourceReference(id) {
  const { workId } = parseLibraryExtent(id);
  const meta = releaseArchiveMetadata().find(item => item.id === workId);
  if (!meta) refuse('PORTABLE_SOURCE_MISSING', `RISE does not serve ${id} in this build.`);
  if (meta.basis !== PORTABLE_BASIS) {
    refuse('PORTABLE_RIGHTS', `${id} has no supported United States public-domain basis.`);
  }
  if (!meta.editionId || !/^sha256:[0-9a-f]{64}$/u.test(meta.sourceRevision || '')) {
    refuse('PORTABLE_SOURCE_MISMATCH', `${id} has no exact edition identity.`);
  }
  return { id, workId, editionId: meta.editionId, sourceRevision: meta.sourceRevision,
    basis: meta.basis, title: meta.title, author: meta.author || null };
}

function checkReference(reference, id) {
  onlyKeys(reference, ['id', 'workId', 'editionId', 'sourceRevision', 'basis', 'title', 'author']);
  const expected = sourceReference(id);
  if (Object.keys(expected).some(key => reference[key] !== expected[key])) {
    refuse('PORTABLE_SOURCE_MISMATCH',
      `${id} differs from the exact edition in this RISE build. Ask for a new export.`);
  }
}

function portableProgram(value) {
  const program = validateExperienceProgram(value);
  const used = programCapabilities(program);
  if (used.assets.size || used.swells.size || used.voices.size
    || program.tracks.some(track => ['swell', 'narration'].includes(track.kind))) {
    refuse('PORTABLE_CAPABILITY', 'Personal media or narration cannot travel in this file.');
  }
  for (const track of program.tracks.filter(item => item.kind === 'visual')) {
    for (const { cue } of track.clips) {
      if (!['still', 'focal', 'field', 'procedural'].includes(cue.kind)
        || (cue.kind === 'procedural' && (
          !cue.collections.every(id => PROCEDURAL_IDS.has(id))
          || (cue.engines || []).some(id => !PROCEDURAL_IDS.has(id))
        ))) {
        refuse('PORTABLE_CAPABILITY', 'Only built-in procedural imagery can travel in this file.');
      }
    }
  }
  // Metadata is commentary, not execution, and may hold a private prompt.
  return validateExperienceProgram({
    ...program, metadata: undefined,
    tracks: program.tracks.map(track => ({
      ...track, metadata: undefined,
      clips: track.clips.map(clip => ({ ...clip, metadata: undefined }))
    }))
  });
}

function context() {
  return exportCuratorContext({ id: 'portable-sequence', sources: [], assets: [] });
}

async function admittedSources(program) {
  const { sources, missing, refused } = await resolveProgramLibrarySources(program);
  if (missing.length || refused.length || sources.length !== programSourceIds(program).length) {
    refuse('PORTABLE_SOURCE_UNAVAILABLE',
      `The Archive reading cannot load: ${[...missing, ...refused].join(', ')}.`);
  }
  assertResolvedProgramQuotations(program, sources);
  return sources;
}

function credit(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.trim() !== value || value.length > 120
    || /[\r\n\0]/u.test(value)) {
    refuse('PORTABLE_CREDIT', 'Creator credit must be one line of at most 120 characters.');
  }
  return value;
}

function rethrow(error) {
  if (error instanceof PortableSequenceError) throw error;
  throw new PortableSequenceError('PORTABLE_SCORE_INVALID', error?.message || 'The score was refused.');
}

export async function exportPortableSequence(value, { creatorCredit = null } = {}) {
  try {
    if (value?.assets?.length) {
      refuse('PORTABLE_LOCAL_MEDIA', 'This sequence uses local media. Remove it before export.');
    }
    const project = validateWorkshopProject(value);
    if (!project.experienceProgram) refuse('PORTABLE_NO_SCORE', 'This sequence has no authored score.');
    const program = importExperienceProgram(portableProgram(project.experienceProgram), { context: context() });
    const references = programSourceIds(program).map(sourceReference);
    const resolved = await admittedSources(program);
    const saved = new Map(project.sources.map(source => [source.id, source]));
    for (const source of resolved) {
      if (!saved.has(source.id) || saved.get(source.id).data !== source.data) {
        refuse('PORTABLE_SOURCE_CHANGED',
          `${source.id} differs from the Archive edition. Make a fresh score from the Archive.`);
      }
    }
    const id = `portable-${(await contentHashOf({ program, sources: references })).slice(7, 39)}`;
    return `${JSON.stringify({
      schema: PORTABLE_SEQUENCE_SCHEMA, id, title: project.title || program.id,
      creatorCredit: credit(creatorCredit), sources: references, program,
      reading: { wpm: project.defaults.reading.wpm }
    }, null, 2)}\n`;
  } catch (error) { rethrow(error); }
}

export async function inspectPortableSequence(text) {
  try {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > PORTABLE_SEQUENCE_MAX_BYTES) {
      refuse('PORTABLE_TOO_LARGE', 'Portable sequence file exceeds the 2 MB limit.');
    }
    let bundle;
    try { bundle = JSON.parse(text); } catch {
      refuse('PORTABLE_JSON', 'This file is not valid JSON.');
    }
    onlyKeys(bundle, ['schema', 'id', 'title', 'creatorCredit', 'sources', 'program', 'reading']);
    if (bundle.schema !== PORTABLE_SEQUENCE_SCHEMA) {
      refuse('PORTABLE_SCHEMA', `Expected ${PORTABLE_SEQUENCE_SCHEMA}.`);
    }
    if (typeof bundle.title !== 'string' || !bundle.title.trim() || bundle.title.length > 200) {
      refuse('PORTABLE_TITLE', 'This sequence needs a title of at most 200 characters.');
    }
    const creatorCredit = credit(bundle.creatorCredit);
    if (!Array.isArray(bundle.sources)) refuse('PORTABLE_SOURCES', 'Source references are missing.');
    const program = importExperienceProgram(portableProgram(bundle.program), { context: context() });
    const ids = programSourceIds(program);
    if (bundle.sources.length !== ids.length) {
      refuse('PORTABLE_SOURCES', 'Source references do not match the score.');
    }
    ids.forEach((id, index) => checkReference(bundle.sources[index], id));
    const expectedId = `portable-${(await contentHashOf({ program, sources: bundle.sources })).slice(7, 39)}`;
    if (bundle.id !== expectedId) refuse('PORTABLE_ID', 'Sequence identity does not match its score.');
    const sources = await admittedSources(program);
    onlyKeys(bundle.reading, ['wpm']);
    const wpm = bundle.reading.wpm;
    if (!Number.isInteger(wpm) || wpm < READING_PACE.min || wpm > READING_PACE.max) {
      refuse('PORTABLE_PACE', 'The saved reading pace is invalid.');
    }
    const project = workshopProjectFromImportedProgram({
      program, context: context(), sources, assets: [],
      defaults: { reading: { wpm }, projection: 'stream' }, title: bundle.title, id: bundle.id,
      provenance: { kind: 'portable-sequence-import', portableId: bundle.id, creatorCredit }
    });
    return { id: bundle.id, title: project.title, creatorCredit,
      sources: bundle.sources, project };
  } catch (error) { rethrow(error); }
}
