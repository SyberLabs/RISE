/**
 * rise.curator-context.v1 — capability document for the Live Curator doorway.
 *
 * Export what a model may name (registered IDs only). Never embed media
 * bytes, data URIs, blob URLs, or executable code. The matching import
 * boundary is experience-program-io.js.
 */

import { MUSEUM_CATEGORIES } from '../sources/visual/museum.js';
import { SOUNDSCAPES } from '../audio/soundscapes.js';
import { workEngineFamilies } from '../visuals/work-engines.js';
import { WORKSHOP_AUDIO_ASSETS } from './workshop-audio.js';
import { EXPERIENCE_PROGRAM_LIMITS } from './experience-program.js';

export const CURATOR_CONTEXT_SCHEMA = 'rise.curator-context.v1';

export const CURATOR_CONTEXT_LIMITS = Object.freeze({
  maxIdLength: EXPERIENCE_PROGRAM_LIMITS.maxIdLength,
  maxSources: 64,
  maxCollections: 512,
  maxEngines: 256,
  maxSoundscapes: 64,
  maxTones: 32,
  maxSwells: 128,
  maxTitleLength: 200,
  maxConstraintNumber: 10_000
});

const PROCEDURAL_ENGINE_IDS = Object.freeze([
  'klee', 'turrell', 'fractal', 'neural', 'rockgarden', 'harmonograph'
]);

/** Work-engine ids published for curator naming (IDs only; no class refs). */
const WORK_ENGINE_IDS = Object.freeze([
  'heaven_in_order', 'fall_hypercube', 'chariot_deity', 'flaming_sword',
  'sulfur_magma', 'dark_ocean_chaos',
  'voronoi', 'flowfield', 'attractor', 'flare_phosphene', 'spirograph',
  'incendiary_blast', 'ascii_soldier'
]);

export class CuratorContextValidationError extends Error {
  constructor(code, message, path = '$', details = {}) {
    super(`${message} (${path})`);
    this.name = 'CuratorContextValidationError';
    this.code = code;
    this.path = path;
    this.details = details;
  }
}

const fail = (code, message, path, details) => {
  throw new CuratorContextValidationError(code, message, path, details);
};

function record(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('CURATOR_CONTEXT_RECORD', 'Expected an object', path);
  }
  return value;
}

function onlyKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      fail('CURATOR_CONTEXT_UNKNOWN_FIELD', `Unknown field: ${key}`, `${path}.${key}`);
    }
  }
}

function exactId(value, path) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    fail('CURATOR_CONTEXT_ID', 'Expected a non-empty, trimmed id', path);
  }
  if (value.length > CURATOR_CONTEXT_LIMITS.maxIdLength) {
    fail('CURATOR_CONTEXT_ID_TOO_LONG',
      `Ids may not exceed ${CURATOR_CONTEXT_LIMITS.maxIdLength} characters`, path);
  }
  if (/^(data:|blob:|https?:|javascript:)/i.test(value) || value.includes('://')) {
    fail('CURATOR_CONTEXT_URI_REFUSED', 'Capability ids must not be URIs', path);
  }
  return value;
}

function optionalTitle(value, path) {
  if (value == null) return null;
  if (typeof value !== 'string' || value.length > CURATOR_CONTEXT_LIMITS.maxTitleLength) {
    fail('CURATOR_CONTEXT_TITLE',
      `Expected a title no longer than ${CURATOR_CONTEXT_LIMITS.maxTitleLength} characters`, path);
  }
  return value;
}

function uniqueIds(value, path, max) {
  if (!Array.isArray(value)) {
    fail('CURATOR_CONTEXT_ID_LIST', 'Expected an array of ids', path);
  }
  if (value.length > max) {
    fail('CURATOR_CONTEXT_ID_LIST_TOO_LONG', `At most ${max} ids`, path);
  }
  const out = [];
  const seen = new Set();
  value.forEach((item, index) => {
    const id = exactId(item, `${path}[${index}]`);
    if (seen.has(id)) {
      fail('CURATOR_CONTEXT_DUPLICATE_ID', `Duplicate id ${id}`, `${path}[${index}]`);
    }
    seen.add(id);
    out.push(id);
  });
  return out;
}

function optionalConstraint(value, path) {
  if (value == null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)
    || value < 0 || value > CURATOR_CONTEXT_LIMITS.maxConstraintNumber) {
    fail('CURATOR_CONTEXT_CONSTRAINT',
      `Expected a number from 0 to ${CURATOR_CONTEXT_LIMITS.maxConstraintNumber}`, path);
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function normalizeSource(value, path) {
  const source = record(value, path);
  onlyKeys(source, new Set(['id', 'title', 'characterLength']), path);
  const out = { id: exactId(source.id, `${path}.id`) };
  const title = optionalTitle(source.title, `${path}.title`);
  if (title != null) out.title = title;
  if (source.characterLength != null) {
    if (!Number.isInteger(source.characterLength) || source.characterLength < 0
      || source.characterLength > EXPERIENCE_PROGRAM_LIMITS.maxSourceCharacters) {
      fail('CURATOR_CONTEXT_SOURCE_LENGTH',
        'Expected a non-negative characterLength within source limits',
        `${path}.characterLength`);
    }
    out.characterLength = source.characterLength;
  }
  return out;
}

function normalizeVisuals(value, path) {
  const visuals = record(value, path);
  onlyKeys(visuals, new Set(['collections', 'engines']), path);
  return {
    collections: uniqueIds(
      visuals.collections || [],
      `${path}.collections`,
      CURATOR_CONTEXT_LIMITS.maxCollections
    ),
    engines: uniqueIds(
      visuals.engines || [],
      `${path}.engines`,
      CURATOR_CONTEXT_LIMITS.maxEngines
    )
  };
}

function normalizeAudio(value, path) {
  const audio = record(value, path);
  onlyKeys(audio, new Set(['soundscapes', 'tones', 'swells']), path);
  return {
    soundscapes: uniqueIds(
      audio.soundscapes || [],
      `${path}.soundscapes`,
      CURATOR_CONTEXT_LIMITS.maxSoundscapes
    ),
    tones: uniqueIds(
      audio.tones || [],
      `${path}.tones`,
      CURATOR_CONTEXT_LIMITS.maxTones
    ),
    swells: uniqueIds(
      audio.swells || [],
      `${path}.swells`,
      CURATOR_CONTEXT_LIMITS.maxSwells
    )
  };
}

function normalizeConstraints(value, path) {
  if (value == null) return undefined;
  const constraints = record(value, path);
  onlyKeys(constraints, new Set(['targetMinutes', 'maxMovements', 'maxVisualClips']), path);
  const out = {};
  const targetMinutes = optionalConstraint(constraints.targetMinutes, `${path}.targetMinutes`);
  const maxMovements = optionalConstraint(constraints.maxMovements, `${path}.maxMovements`);
  const maxVisualClips = optionalConstraint(constraints.maxVisualClips, `${path}.maxVisualClips`);
  if (targetMinutes !== undefined) out.targetMinutes = targetMinutes;
  if (maxMovements !== undefined) out.maxMovements = maxMovements;
  if (maxVisualClips !== undefined) out.maxVisualClips = maxVisualClips;
  return out;
}

/**
 * Strict validation for a curator capability document.
 * @returns {Readonly<object>}
 */
export function validateCuratorContext(value) {
  const input = record(value, '$');
  onlyKeys(input, new Set([
    'schema', 'id', 'sources', 'visuals', 'audio', 'constraints', 'generatedAt'
  ]), '$');
  if (input.schema !== CURATOR_CONTEXT_SCHEMA) {
    fail('CURATOR_CONTEXT_SCHEMA', `Expected ${CURATOR_CONTEXT_SCHEMA}`, '$.schema');
  }
  if (!Array.isArray(input.sources) || input.sources.length > CURATOR_CONTEXT_LIMITS.maxSources) {
    fail('CURATOR_CONTEXT_SOURCES',
      `Expected 0–${CURATOR_CONTEXT_LIMITS.maxSources} sources`, '$.sources');
  }
  const sources = input.sources.map((item, index) =>
    normalizeSource(item, `$.sources[${index}]`));
  if (new Set(sources.map(item => item.id)).size !== sources.length) {
    fail('CURATOR_CONTEXT_DUPLICATE_SOURCE', 'Source ids must be unique', '$.sources');
  }

  const context = {
    schema: CURATOR_CONTEXT_SCHEMA,
    id: exactId(input.id, '$.id'),
    sources,
    visuals: normalizeVisuals(input.visuals, '$.visuals'),
    audio: normalizeAudio(input.audio, '$.audio')
  };
  const constraints = normalizeConstraints(input.constraints, '$.constraints');
  if (constraints && Object.keys(constraints).length) context.constraints = constraints;
  if (input.generatedAt != null) {
    if (!Number.isFinite(Number(input.generatedAt))) {
      fail('CURATOR_CONTEXT_GENERATED_AT', 'Expected a finite timestamp', '$.generatedAt');
    }
    context.generatedAt = Number(input.generatedAt);
  }
  return deepFreeze(context);
}

function sourceText(source) {
  if (typeof source?.data === 'string') return source.data;
  if (typeof source?.raw === 'string') return source.raw;
  if (typeof source?.text === 'string') return source.text;
  return '';
}

function uniquePreserve(ids) {
  const out = [];
  const seen = new Set();
  for (const id of ids) {
    if (typeof id !== 'string' || !id.trim()) continue;
    const trimmed = id.trim();
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Build a capability document from the current Workshop (or equivalent) surface.
 * IDs only — never URIs or media bytes.
 *
 * @param {object} surface
 * @param {string} [surface.id]
 * @param {Array} [surface.sources]
 * @param {Array} [surface.assets] sequence visual assets
 * @param {Array<string>} [surface.swellIds] personal swell ids
 * @param {Array<string>} [surface.extraCollections]
 * @param {Array<string>} [surface.extraEngines]
 * @param {object} [surface.constraints]
 */
export function exportCuratorContext(surface = {}) {
  const sources = (Array.isArray(surface.sources) ? surface.sources : [])
    .filter(source => source && typeof source.id === 'string' && source.id.trim())
    .slice(0, CURATOR_CONTEXT_LIMITS.maxSources)
    .map(source => {
      const text = sourceText(source);
      const entry = {
        id: source.id.trim(),
        title: typeof source.name === 'string'
          ? source.name.slice(0, CURATOR_CONTEXT_LIMITS.maxTitleLength)
          : (typeof source.title === 'string'
            ? source.title.slice(0, CURATOR_CONTEXT_LIMITS.maxTitleLength)
            : undefined)
      };
      if (text) entry.characterLength = text.length;
      return entry;
    });

  const museumCollections = Object.keys(MUSEUM_CATEGORIES).map(id => `aic-${id}`);
  const sequenceCollections = (Array.isArray(surface.assets) ? surface.assets : [])
    .filter(asset => asset && typeof asset.id === 'string' && asset.id.trim())
    .map(asset => `sequence-asset:${asset.id.trim()}`);
  const collections = uniquePreserve([
    'global-pool',
    ...museumCollections,
    ...workEngineFamilies(),
    ...PROCEDURAL_ENGINE_IDS,
    ...sequenceCollections,
    ...(Array.isArray(surface.extraCollections) ? surface.extraCollections : [])
  ]);

  const engines = uniquePreserve([
    ...PROCEDURAL_ENGINE_IDS,
    ...WORK_ENGINE_IDS,
    ...(Array.isArray(surface.extraEngines) ? surface.extraEngines : [])
  ]);

  const soundscapes = uniquePreserve(Object.keys(SOUNDSCAPES));
  const tones = uniquePreserve(WORKSHOP_AUDIO_ASSETS
    .filter(asset => asset.kind === 'tone')
    .map(asset => asset.value));
  const swells = uniquePreserve([
    'personal',
    ...(Array.isArray(surface.swellIds) ? surface.swellIds : [])
  ]);

  return validateCuratorContext({
    schema: CURATOR_CONTEXT_SCHEMA,
    id: typeof surface.id === 'string' && surface.id.trim()
      ? surface.id.trim()
      : `curator-context-${Date.now()}`,
    sources,
    visuals: { collections, engines },
    audio: { soundscapes, tones, swells },
    constraints: surface.constraints,
    generatedAt: Date.now()
  });
}

export function serializeCuratorContext(context) {
  const validated = validateCuratorContext(context);
  return `${JSON.stringify(validated, null, 2)}\n`;
}
