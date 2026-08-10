/**
 * rise.curator-context.v1 — capability document for the Live Curator doorway.
 *
 * Export what a model may name (registered IDs only). Never embed media
 * bytes, data URIs, blob URLs, or executable code. The matching import
 * boundary is experience-program-io.js.
 */

import { MUSEUM_CATEGORIES } from '../sources/visual/museum.js';
import { SOUNDSCAPES } from '../audio/soundscapes.js';
import { WORK_ENGINE_MANIFEST, workEngineFamilies } from '../visuals/work-engines.js';
import { PROCEDURAL_PATTERNS, PROCEDURAL_PATTERN_IDS } from './visual-registry.js';
import { WORKSHOP_AUDIO_ASSETS } from './workshop-audio.js';
import { EXPERIENCE_PROGRAM_LIMITS } from './experience-program.js';
import { INGESTED_META } from '../content/archive/index.js';
import DIVISION_INDEX from '../content/archive/division-index.json';

export const CURATOR_CONTEXT_SCHEMA = 'rise.curator-context.v1';

export const CURATOR_CONTEXT_LIMITS = Object.freeze({
  maxIdLength: EXPERIENCE_PROGRAM_LIMITS.maxIdLength,
  maxSources: 64,
  maxLibraryWorks: 128,
  maxCollections: 512,
  maxEngines: 256,
  maxSoundscapes: 64,
  maxTones: 32,
  maxSwells: 128,
  maxTitleLength: 200,
  maxDescriptionLength: 400,
  maxConstraintNumber: 10_000
});

const PROCEDURAL_ENGINE_IDS = PROCEDURAL_PATTERN_IDS;
const WORK_ENGINE_IDS = Object.freeze(WORK_ENGINE_MANIFEST.map(entry => entry.id));

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

/** Catalogue prose: bounded, trimmed, and never a URI. */
function boundedText(value, path) {
  const text = String(value).trim();
  if (text.length > CURATOR_CONTEXT_LIMITS.maxDescriptionLength) {
    fail('CURATOR_CONTEXT_TEXT_TOO_LONG',
      `Catalogue text may not exceed ${CURATOR_CONTEXT_LIMITS.maxDescriptionLength} characters`, path);
  }
  if (/^(data:|blob:|https?:|javascript:)/i.test(text) || text.includes('://')) {
    fail('CURATOR_CONTEXT_URI_REFUSED', 'Catalogue text must not be a URI', path);
  }
  return text;
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
 * What the ids MEAN, for a reader that has never seen this product.
 *
 * Annotation only. Membership is decided against the flat id lists above
 * and never against this block, so a description can go missing or
 * arrive malformed without widening what a program may name. Entries are
 * dropped rather than defaulted: an id with nothing true to say about it
 * says nothing.
 */
function normalizeCatalog(value, path) {
  if (value === undefined) return undefined;
  const input = record(value, path);
  onlyKeys(input, new Set(['collections', 'engines', 'soundscapes']), path);
  const out = {};
  for (const section of ['collections', 'engines', 'soundscapes']) {
    if (input[section] === undefined) continue;
    const entries = record(input[section], `${path}.${section}`);
    const kept = {};
    for (const [id, entry] of Object.entries(entries)) {
      if (id === '__proto__' || id === 'constructor' || id === 'prototype') {
        fail('CURATOR_CONTEXT_PROTOTYPE', 'Prototype keys are refused', `${path}.${section}.${id}`);
      }
      const item = record(entry, `${path}.${section}.${id}`);
      onlyKeys(item, new Set(['name', 'kind', 'tags', 'work', 'description']),
        `${path}.${section}.${id}`);
      const clean = {};
      for (const field of ['name', 'kind', 'work', 'description']) {
        if (typeof item[field] === 'string' && item[field].trim()) {
          clean[field] = boundedText(item[field], `${path}.${section}.${id}.${field}`);
        }
      }
      if (Array.isArray(item.tags)) {
        clean.tags = item.tags
          .filter(tag => typeof tag === 'string' && tag.trim())
          .map(tag => boundedText(tag, `${path}.${section}.${id}.tags`));
      }
      if (Object.keys(clean).length) kept[id] = clean;
    }
    if (Object.keys(kept).length) out[section] = kept;
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeLibrary(value, path) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    fail('CURATOR_CONTEXT_LIBRARY', 'Expected an array of library works', path);
  }
  if (value.length > CURATOR_CONTEXT_LIMITS.maxLibraryWorks) {
    fail('CURATOR_CONTEXT_LIBRARY_TOO_LONG',
      `At most ${CURATOR_CONTEXT_LIMITS.maxLibraryWorks} library works`, path);
  }
  const out = [];
  const seen = new Set();
  value.forEach((raw, index) => {
    const item = record(raw, `${path}[${index}]`);
    onlyKeys(item, new Set(['id', 'title', 'author', 'words', 'divisions']), `${path}[${index}]`);
    const id = exactId(item.id, `${path}[${index}].id`);
    if (seen.has(id)) {
      fail('CURATOR_CONTEXT_DUPLICATE_LIBRARY', `Duplicate library id ${id}`, `${path}[${index}]`);
    }
    seen.add(id);
    const entry = { id };
    const title = optionalTitle(item.title, `${path}[${index}].title`);
    if (title != null) entry.title = title;
    if (item.author != null) {
      entry.author = boundedText(item.author, `${path}[${index}].author`);
    }
    if (item.words != null) {
      if (!Number.isInteger(item.words) || item.words < 0) {
        fail('CURATOR_CONTEXT_LIBRARY_WORDS', 'Expected a non-negative word count',
          `${path}[${index}].words`);
      }
      entry.words = item.words;
    }
    if (item.divisions != null) {
      const div = record(item.divisions, `${path}[${index}].divisions`);
      onlyKeys(div, new Set(['titled', 'authored', 'reason', 'count', 'noun']), `${path}[${index}].divisions`);
      const divisions = {};
      if (typeof div.titled === 'boolean') divisions.titled = div.titled;
      if (typeof div.authored === 'boolean') divisions.authored = div.authored;
      if (typeof div.reason === 'string' && div.reason.trim()) {
        divisions.reason = boundedText(div.reason, `${path}[${index}].divisions.reason`);
      }
      if (div.count != null) {
        if (!Number.isInteger(div.count) || div.count < 0) {
          fail('CURATOR_CONTEXT_LIBRARY_DIVISIONS', 'Expected a non-negative division count',
            `${path}[${index}].divisions.count`);
        }
        divisions.count = div.count;
      }
      if (div.noun != null) {
        divisions.noun = boundedText(div.noun, `${path}[${index}].divisions.noun`);
      }
      if (Object.keys(divisions).length) entry.divisions = divisions;
    }
    out.push(entry);
  });
  return out;
}

/**
 * Strict validation for a curator capability document.
 * @returns {Readonly<object>}
 */
export function validateCuratorContext(value) {
  const input = record(value, '$');
  onlyKeys(input, new Set([
    'schema', 'id', 'sources', 'library', 'visuals', 'audio', 'constraints', 'catalog', 'generatedAt'
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
  const library = normalizeLibrary(input.library, '$.library');
  if (library) context.library = library;
  const constraints = normalizeConstraints(input.constraints, '$.constraints');
  if (constraints && Object.keys(constraints).length) context.constraints = constraints;
  const catalog = normalizeCatalog(input.catalog, '$.catalog');
  if (catalog) context.catalog = catalog;
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
 * Library catalogue for the Scriptorium: what exists, not what is loaded.
 * Titles, authors, lengths, and whether divisions are the author's scheme
 * or RISE-measured — ids and metadata only, never payloads
 * (SCRIPTORIUM-SPEC §7).
 */
export function buildLibraryCatalogue() {
  return INGESTED_META.slice(0, CURATOR_CONTEXT_LIMITS.maxLibraryWorks).map(meta => {
    const div = DIVISION_INDEX[meta.id] || {};
    const entry = {
      id: meta.id,
      title: String(meta.title || meta.id).slice(0, CURATOR_CONTEXT_LIMITS.maxTitleLength)
    };
    if (meta.author) {
      entry.author = String(meta.author).slice(0, CURATOR_CONTEXT_LIMITS.maxDescriptionLength);
    }
    if (Number.isInteger(div.words) && div.words >= 0) entry.words = div.words;
    const reason = typeof div.reason === 'string' ? div.reason : null;
    const authored = typeof div.authored === 'boolean'
      ? div.authored
      : Boolean(reason) && reason !== 'measured';
    entry.divisions = {
      titled: div.titled === true,
      authored,
      ...(reason ? { reason } : {}),
      ...(Number.isInteger(div.count) ? { count: div.count } : {}),
      ...(div.noun ? { noun: String(div.noun).slice(0, 40) } : {})
    };
    return entry;
  });
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
 * @param {boolean} [surface.includeLibrary=true] ship Library catalogue (§7)
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

  const payload = {
    schema: CURATOR_CONTEXT_SCHEMA,
    id: typeof surface.id === 'string' && surface.id.trim()
      ? surface.id.trim()
      : `curator-context-${Date.now()}`,
    sources,
    visuals: { collections, engines },
    audio: { soundscapes, tones, swells },
    constraints: surface.constraints,
    catalog: buildCatalog({ collections, engines, soundscapes }),
    generatedAt: Date.now()
  };
  if (surface.includeLibrary !== false) {
    payload.library = buildLibraryCatalogue();
  }
  return validateCuratorContext(payload);
}

/**
 * Describe the exported ids from the registries that own them.
 *
 * Nothing is authored here. Museum categories already carry a name, a
 * kind and tags; soundscapes carry a description; work engines carry a
 * name and the work they were written for. The exporter used to reduce
 * all of it to Object.keys(), which left a reader deciding between
 * `aic-ukiyoe` and `dark_ocean_chaos` on the strength of the words
 * alone.
 *
 * The engines' `category` field is NOT carried. It is a display heading:
 * all six Paradise engines share one value, and five of Storm's seven
 * are singletons — uniform where it would need to discriminate, unique
 * where it would need to group.
 *
 * `work` is the field that matters most: the capability list offers
 * every engine at once, so without it a Milton engine looks equally
 * available over Anna Karenina — permitted, and wrong.
 */
function buildCatalog({ collections, engines, soundscapes }) {
  const collectionEntries = {};
  for (const id of collections) {
    if (id.startsWith('aic-')) {
      const category = MUSEUM_CATEGORIES[id.slice('aic-'.length)];
      if (!category) continue;
      const entry = { kind: 'museum-category' };
      if (category.name) entry.name = category.name;
      if (category.description) entry.description = category.description;
      if (Array.isArray(category.tags) && category.tags.length) entry.tags = [...category.tags];
      collectionEntries[id] = entry;
      continue;
    }
    if (id.startsWith('sequence-asset:')) {
      collectionEntries[id] = { kind: 'sequence-asset', description: 'An image you added to this project.' };
      continue;
    }
    const pattern = PROCEDURAL_PATTERNS.find(item => item.id === id);
    if (pattern) {
      collectionEntries[id] = {
        kind: 'procedural-pool', name: pattern.name, description: pattern.description
      };
      continue;
    }
    if (workEngineFamilies().includes(id)) {
      collectionEntries[id] = { kind: 'work-engine-family', work: id };
      continue;
    }
    if (id === 'global-pool') {
      collectionEntries[id] = { kind: 'pool', description: 'Every image the reader has added, drawn at random.' };
    }
  }

  const engineEntries = {};
  for (const id of engines) {
    const pattern = PROCEDURAL_PATTERNS.find(item => item.id === id);
    if (pattern) {
      engineEntries[id] = {
        kind: 'procedural', name: pattern.name, description: pattern.description
      };
      continue;
    }
    const authored = WORK_ENGINE_MANIFEST.find(item => item.id === id);
    if (authored) {
      engineEntries[id] = {
        kind: 'work-engine',
        name: authored.name,
        description: authored.description,
        work: authored.family
      };
    }
  }

  const soundscapeEntries = {};
  for (const id of soundscapes) {
    const scape = SOUNDSCAPES[id];
    if (!scape) continue;
    const entry = {};
    if (scape.name) entry.name = scape.name;
    if (scape.description) entry.description = scape.description;
    if (Object.keys(entry).length) soundscapeEntries[id] = entry;
  }

  return {
    collections: collectionEntries,
    engines: engineEntries,
    soundscapes: soundscapeEntries
  };
}

export function serializeCuratorContext(context) {
  const validated = validateCuratorContext(context);
  return `${JSON.stringify(validated, null, 2)}\n`;
}
