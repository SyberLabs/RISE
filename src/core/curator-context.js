/**
 * rise.curator-context.v1 — capability document for the Live Curator doorway.
 *
 * Export what a model may name (registered IDs only). Never embed media
 * bytes, data URIs, blob URLs, or executable code. The matching import
 * boundary is experience-program-io.js.
 */

import { MUSEUM_CATEGORIES } from '../sources/visual/museum.js';
import { SOUNDSCAPES } from '../audio/soundscapes.js';
// THE VOICES THAT ARE ACTUALLY BUILT, which is not the same as the voices the
// product has labels for: `availableVoicePacks` keeps only a pack with entries
// in it. A voice with no recordings would be a capability offered that could
// never sound, which is the defect the literal `personal` swell already was.
// The manifest is already in the eager graph (src/content/keystones.js), so
// naming it here costs no bundle bytes.
import { availableVoicePacks } from '../audio/voice-pack.js';
import { WORK_ENGINE_MANIFEST, workEngineFamilies } from '../visuals/work-engines.js';
import { PROCEDURAL_PATTERNS, PROCEDURAL_PATTERN_IDS } from './visual-registry.js';
import { WORKSHOP_AUDIO_ASSETS } from './workshop-audio.js';
import {
  EXPERIENCE_PROGRAM_LIMITS,
  PROGRAM_VISUAL_FIELD_RENDERERS
} from './experience-program.js';
import { READING_LIMITS } from './reading-limits.js';
import { countWords } from './chunker.js';
import { EXTENT_REFUSAL, extentReadingBound, parseLibraryExtent } from './library-extent.js';
import { releaseArchiveMetadata } from '../content/archive/index.js';
// THE SERVED SHELF'S divisions, as they were measured from the committed
// bytes: how many, what they are called, and how long each one is. Generated
// by scripts/build-division-index.mjs. The per-division lengths spent a while
// in a sibling file because the two could not be regenerated in one change;
// they come out of one pass now, because the gate cannot measure
// `sacred-tao-te-ching#40` against a length that disagrees with the labels
// beside it.
//
// The withheld corpus is a SEPARATE artifact and is deliberately not imported
// here. The filter below drops those works at runtime, which is too late: this
// import is what puts them in the bundle, and eighty of them were riding in it.
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
  maxVoices: 32,
  maxSurfaces: 32,
  maxTitleLength: 200,
  // The same ceiling the descriptor applies (READING_LIMITS), so a reader's
  // description cannot pass the field and fail the document.
  maxDescriptionLength: READING_LIMITS.maxMaterialDescriptionChars,
  maxConstraintNumber: 10_000,
  // A scheme's per-division lists (labels, word counts) ride whole or not at
  // all, so this bounds the whole list rather than truncating one.
  maxDivisions: 4_096
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

/**
 * What RISE says about the reader's file when the reader has said nothing.
 *
 * Exported because a surface that PRINTS the catalogue needs to tell these
 * apart from a description a person wrote: the prompt quotes the reader's own
 * words and stays silent where there are none, and the alternative to naming
 * the defaults here is a prompt that string-matches prose defined elsewhere.
 */
export const SEQUENCE_ASSET_DEFAULT_DESCRIPTIONS = Object.freeze({
  image: 'An image the reader added to this project.',
  video: 'A video the reader added to this project.'
});

const CATALOGUE_URI = /^(data:|blob:|https?:|javascript:)/i;

/**
 * Would this string survive `boundedText`?
 *
 * Exported so a surface that takes catalogue text FROM A PERSON can say no
 * beside the field they typed it into. `boundedText` throws, which is right at
 * the trust boundary and useless as an answer to a reader: the description
 * field is several steps from Prepare prompt, and a refusal that surfaces
 * there names neither the file nor the sentence that caused it. One rule,
 * asked in two voices — the room asks whether, the document enforces that.
 */
export function catalogueTextIsSafe(value) {
  const text = String(value ?? '').trim();
  return text.length <= CURATOR_CONTEXT_LIMITS.maxDescriptionLength
    && !CATALOGUE_URI.test(text)
    && !text.includes('://');
}

/** Catalogue prose: bounded, trimmed, and never a URI. */
function boundedText(value, path) {
  const text = String(value).trim();
  if (text.length > CURATOR_CONTEXT_LIMITS.maxDescriptionLength) {
    fail('CURATOR_CONTEXT_TEXT_TOO_LONG',
      `Catalogue text may not exceed ${CURATOR_CONTEXT_LIMITS.maxDescriptionLength} characters`, path);
  }
  if (CATALOGUE_URI.test(text) || text.includes('://')) {
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
  onlyKeys(source, new Set(['id', 'title', 'characterLength', 'words']), path);
  const out = { id: exactId(source.id, `${path}.id`) };
  const title = optionalTitle(source.title, `${path}.title`);
  if (title != null) out.title = title;
  // The unit the length budget is measured in. Library entries have always
  // carried it; a loaded source carried only characters, and converting one
  // to the other would need a ratio nobody can defend.
  if (source.words != null) {
    if (!Number.isInteger(source.words) || source.words < 0) {
      fail('CURATOR_CONTEXT_SOURCE_WORDS',
        'Expected a non-negative whole number of words', `${path}.words`);
    }
    out.words = source.words;
  }
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

/**
 * `surfaces` IS THE LIST THAT WAS MISSING, and its absence was a hole rather
 * than an omission. A visual field renderer is a closed vocabulary — the
 * program validator has always refused `PROGRAM_VISUAL_FIELD_RENDERERS`
 * misses — but nothing offered the three names to a composer, and the
 * operations door took `assetId: "surface:<anything>"` and built an editor
 * asset out of it. A capability that can be named has to be a capability the
 * document describes, or the gate is checking against a list nobody was given.
 */
function normalizeVisuals(value, path) {
  const visuals = record(value, path);
  onlyKeys(visuals, new Set(['collections', 'engines', 'surfaces']), path);
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
    ),
    surfaces: uniqueIds(
      visuals.surfaces || [],
      `${path}.surfaces`,
      CURATOR_CONTEXT_LIMITS.maxSurfaces
    )
  };
}

/**
 * `voices` LIKEWISE. Narration is a lane an operation set can score, and the
 * document named no voice at all — so a model could not choose one on purpose
 * and every one it invented was admitted at both doors. An unbuilt voice is
 * silence, so the list is what `availableVoicePacks` reports rather than what
 * the product has labels for.
 */
function normalizeAudio(value, path) {
  const audio = record(value, path);
  onlyKeys(audio, new Set(['soundscapes', 'tones', 'swells', 'voices']), path);
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
    ),
    voices: uniqueIds(
      audio.voices || [],
      `${path}.voices`,
      CURATOR_CONTEXT_LIMITS.maxVoices
    )
  };
}

/**
 * How long the reader wants the reading to be, in WORDS.
 *
 * Words rather than minutes, for two reasons that outlived the field this
 * replaces. A word count is something a model can add up from the library it
 * was handed, where minutes would need a pace and a chunk mode it has not
 * been given. And since a program can now score its own pace, minutes are a
 * function of the score — so a minute budget could not be checked until after
 * the thing being budgeted had already been composed.
 */
function targetWordsConstraint(value, path) {
  if (value == null) return undefined;
  if (!Number.isInteger(value) || value < 1 || value > READING_LIMITS.maxAtoms) {
    fail('CURATOR_CONTEXT_TARGET_WORDS',
      `Expected a whole number of words from 1 to ${READING_LIMITS.maxAtoms}`, path);
  }
  return value;
}

function normalizeConstraints(value, path) {
  if (value == null) return undefined;
  const constraints = record(value, path);
  onlyKeys(constraints, new Set(['targetWords', 'maxMovements', 'maxVisualClips']), path);
  const out = {};
  const targetWords = targetWordsConstraint(constraints.targetWords, `${path}.targetWords`);
  const maxMovements = optionalConstraint(constraints.maxMovements, `${path}.maxMovements`);
  const maxVisualClips = optionalConstraint(constraints.maxVisualClips, `${path}.maxVisualClips`);
  if (targetWords !== undefined) out.targetWords = targetWords;
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
  // `swells` is annotation for the reader's own audio, which is a different
  // thing from a soundscape and belongs in its own section rather than
  // borrowing one. Additive and annotation-only: membership is still decided
  // against the flat id lists, so nothing here widens what a program may name.
  onlyKeys(input, new Set(['collections', 'engines', 'soundscapes', 'swells', 'voices']), path);
  const out = {};
  for (const section of ['collections', 'engines', 'soundscapes', 'swells', 'voices']) {
    if (input[section] === undefined) continue;
    const entries = record(input[section], `${path}.${section}`);
    const kept = {};
    for (const [id, entry] of Object.entries(entries)) {
      if (id === '__proto__' || id === 'constructor' || id === 'prototype') {
        fail('CURATOR_CONTEXT_PROTOTYPE', 'Prototype keys are refused', `${path}.${section}.${id}`);
      }
      const item = record(entry, `${path}.${section}.${id}`);
      onlyKeys(item, new Set(['name', 'kind', 'mediaKind', 'durationMs', 'tags',
        'work', 'description']), `${path}.${section}.${id}`);
      const clean = {};
      for (const field of ['name', 'kind', 'work', 'description']) {
        if (typeof item[field] === 'string' && item[field].trim()) {
          clean[field] = boundedText(item[field], `${path}.${section}.${id}.${field}`);
        }
      }
      // A still or a moving picture, and how long the moving one runs. Two
      // closed values and a whole number of milliseconds — anything else is
      // dropped, the same as any other annotation that arrives malformed.
      if (item.mediaKind === 'image' || item.mediaKind === 'video') {
        clean.mediaKind = item.mediaKind;
      }
      if (Number.isInteger(item.durationMs) && item.durationMs > 0) {
        clean.durationMs = item.durationMs;
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
      onlyKeys(div, new Set(['titled', 'authored', 'reason', 'count', 'noun',
        'labels', 'words', 'bodyFrom']), `${path}[${index}].divisions`);
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
      if (div.bodyFrom != null) {
        if (!Number.isInteger(div.bodyFrom) || div.bodyFrom < 1) {
          fail('CURATOR_CONTEXT_LIBRARY_DIVISIONS',
            'Expected a division ordinal of one or more',
            `${path}[${index}].divisions.bodyFrom`);
        }
        divisions.bodyFrom = div.bodyFrom;
      }
      if (div.labels != null) {
        if (!Array.isArray(div.labels)) {
          fail('CURATOR_CONTEXT_LIBRARY_DIVISIONS', 'Expected an array of labels',
            `${path}[${index}].divisions.labels`);
        }
        const labels = div.labels;
        // WHOLE OR NOT AT ALL. A truncated list reads as the work's complete
        // scheme, and a curator counting positions in it would name a division
        // past the end of the work.
        if (divisions.count != null && labels.length !== divisions.count) {
          fail('CURATOR_CONTEXT_LIBRARY_DIVISIONS',
            'Expected one label per division, or none',
            `${path}[${index}].divisions.labels`);
        }
        divisions.labels = labels.map((label, position) =>
          boundedText(label, `${path}[${index}].divisions.labels[${position}]`));
      }
      // HOW LONG EACH DIVISION IS. `entry.words` says how long the WORK is,
      // which is the wrong number for every extent the room teaches: a score
      // naming `sacred-tao-te-ching#40` spends 38 words, not 10,321. Same
      // whole-or-nothing rule as the labels — a short list would charge
      // divisions after the gap at their neighbour's length.
      if (div.words != null) {
        const divisionWords = div.words;
        if (!Array.isArray(divisionWords)) {
          fail('CURATOR_CONTEXT_LIBRARY_DIVISIONS', 'Expected an array of word counts',
            `${path}[${index}].divisions.words`);
        }
        if (divisionWords.length > CURATOR_CONTEXT_LIMITS.maxDivisions) {
          fail('CURATOR_CONTEXT_LIBRARY_DIVISIONS',
            `At most ${CURATOR_CONTEXT_LIMITS.maxDivisions} divisions`,
            `${path}[${index}].divisions.words`);
        }
        if (divisions.count != null && divisionWords.length !== divisions.count) {
          fail('CURATOR_CONTEXT_LIBRARY_DIVISIONS',
            'Expected one word count per division, or none',
            `${path}[${index}].divisions.words`);
        }
        divisions.words = divisionWords.map((count, position) => {
          if (!Number.isInteger(count) || count < 0) {
            fail('CURATOR_CONTEXT_LIBRARY_DIVISIONS', 'Expected a non-negative word count',
              `${path}[${index}].divisions.words[${position}]`);
          }
          return count;
        });
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

/**
 * What a source id turns out to be, once read against a capability document.
 *
 * `known` is the only admissible verdict; the rest are the reasons a gate
 * has to refuse with. The two extent refusals are library-extent.js's own
 * codes rather than new ones — the grammar is described in one place and
 * this reads it, so a new form of id teaches both at once.
 */
export const CURATOR_SOURCE_KNOWN = 'known';
export const CURATOR_SOURCE_UNKNOWN_WORK = 'unknown-work';
export const CURATOR_SOURCE_UNKNOWN_DIVISION = 'unknown-division';

/**
 * Read one source id against what this document offers.
 *
 * ONE PLACE. Membership ("may the score name this?") and budget ("how long
 * is it?") are the same question asked twice, and they were answered by two
 * `new Set(library.map(item => item.id))` lookups that had both never heard
 * of an extent. Every extent id the room teaches — the whole of `work#12`
 * and `work#12:200` — was refused as an unknown source, and fixing only the
 * membership side turned the refusal into an unmeasurable budget. So both
 * ask this, and a third caller can too.
 *
 * @param {object} context a validated curator context
 * @returns {(sourceId: string) => {
 *   status: string, sourceId: string, workId: string, division: number|null,
 *   askedWords: number|null, words: number|null, divisionCount: number|null,
 *   title: string|null
 * }}
 */
export function createCuratorSourceReader(context) {
  const loaded = new Map((context?.sources || []).map(item => [item.id, item]));
  const library = new Map((context?.library || []).map(item => [item.id, item]));

  const reading = (fields) => ({
    status: CURATOR_SOURCE_KNOWN,
    workId: fields.sourceId,
    division: null,
    askedWords: null,
    words: null,
    divisionCount: null,
    title: null,
    ...fields
  });

  return function readCuratorSource(sourceId) {
    const id = String(sourceId ?? '');

    // EXACTLY WHAT IT SAYS, FIRST. A source already loaded into a project
    // keeps its extent in its id — the resolver names it `middlemarch#2:200`
    // and the score's anchors are written against that — so an id the reader
    // already holds is that thing, not an instruction to cut it again.
    const held = loaded.get(id) || library.get(id);
    if (held) {
      return reading({
        sourceId: id,
        words: Number.isInteger(held.words) ? held.words : null,
        title: held.title || null
      });
    }

    const extent = parseLibraryExtent(id);
    // ONLY THE GRAMMAR IS JUDGED BEFORE THE SHELF IS ASKED, and it is the one
    // verdict that can be: an id whose shape is wrong names no work at all —
    // `workId` is the whole unparsed string — so there is nothing to look up.
    //
    // THE FLOOR IS NOT SUCH A VERDICT. `parseLibraryExtent` is a string reader:
    // it can see that `:39` is under the floor and it cannot see whether the
    // work or the division exists. Refusing here let a fact about the cut speak
    // for facts nobody had established — `no-such-work-at-all#5:20` and
    // `sacred-tao-te-ching#900:39` both refused below-floor, and the wording
    // that reads that refusal tells the curator to name "sacred-tao-te-ching#900"
    // instead, which is a chapter the Tao does not have. Spelled `:200` the same
    // two ids were correctly absent and correctly no-such-division, so which of
    // §13's four statuses a script learned turned on the `:N`. It is judged
    // below, where everything its wording asserts has been established — the
    // same order resolveLibrarySourceIds follows.
    if (extent.refusal === EXTENT_REFUSAL.GRAMMAR) {
      return reading({
        status: extent.refusal,
        sourceId: id,
        workId: extent.workId,
        division: extent.division
      });
    }
    if (!extent.division) {
      return reading({ status: CURATOR_SOURCE_UNKNOWN_WORK, sourceId: id });
    }

    const work = library.get(extent.workId);
    if (!work) {
      return reading({
        status: CURATOR_SOURCE_UNKNOWN_WORK,
        sourceId: id,
        workId: extent.workId,
        division: extent.division
      });
    }
    const divisionCount = Number.isInteger(work.divisions?.count)
      ? work.divisions.count
      : null;
    // A division the work does not have is a refusal, never the nearest one
    // it does have — and it is a different refusal from a work nobody holds,
    // which is what it used to be reported as.
    if (divisionCount !== null && extent.division > divisionCount) {
      return reading({
        status: CURATOR_SOURCE_UNKNOWN_DIVISION,
        sourceId: id,
        workId: extent.workId,
        division: extent.division,
        divisionCount,
        title: work.title || null
      });
    }
    // THE FLOOR, LAST: everything its wording asserts is established by here.
    // The count rides with it for the same reason it rides with the refusal
    // above — it was null on every floor refusal while the same id at `:200`
    // reported 81, so the reader was told the count where it does not matter
    // and denied it where it does.
    if (extent.refusal === EXTENT_REFUSAL.FLOOR) {
      return reading({
        status: extent.refusal,
        sourceId: id,
        workId: extent.workId,
        division: extent.division,
        divisionCount,
        title: work.title || null
      });
    }
    const perDivision = Array.isArray(work.divisions?.words) ? work.divisions.words : null;
    const divisionWords = perDivision && perDivision.length >= extent.division
      ? perDivision[extent.division - 1]
      : null;
    return reading({
      sourceId: id,
      workId: extent.workId,
      division: extent.division,
      askedWords: extent.words,
      divisionCount,
      words: extentReadingBound(divisionWords, extent.words),
      title: work.title || null
    });
  };
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
 * (docs/vision/SCRIPTORIUM-SPEC.md §7).
 */
export function buildLibraryCatalogue() {
  return releaseArchiveMetadata()
    .slice(0, CURATOR_CONTEXT_LIMITS.maxLibraryWorks).map(meta => {
    const div = DIVISION_INDEX[meta.id] || {};
    const divisionWords = Array.isArray(div.divisionWords) ? div.divisionWords : null;
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
      ...(div.noun ? { noun: String(div.noun).slice(0, 40) } : {}),
      // Where the work itself begins, when a Gutenberg header precedes it.
      ...(Number.isInteger(div.bodyFrom) && div.bodyFrom > 1
        ? { bodyFrom: div.bodyFrom } : {}),
      // What the edition calls each division, in order, exactly as the
      // divider read it. A second cap used to shorten them here after the
      // index had already shortened them at 60, and a label cut mid-word
      // reads as the edition's own title — so there is one bound now, the
      // validator's, and a label that breaches it refuses rather than lies.
      ...(Array.isArray(div.labels) && div.labels.length === div.count
        ? { labels: [...div.labels] } : {}),
      // Whereas these ride for every divided work, because they are what
      // makes a division spendable: a curator cannot compose to a length it
      // cannot add up, and the gate cannot measure what it was not told.
      ...(Array.isArray(divisionWords) && divisionWords.length === div.count
        ? { words: divisionWords } : {})
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
 * @param {Array} [surface.swells] personal swells, `{ id, name }`, so the
 *   catalogue can say which one is which
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
      if (text) {
        entry.characterLength = text.length;
        entry.words = countWords(text);
      }
      return entry;
    });

  const museumCollections = Object.keys(MUSEUM_CATEGORIES).map(id => `aic-${id}`);
  const assetList = (Array.isArray(surface.assets) ? surface.assets : [])
    .filter(asset => asset && typeof asset.id === 'string' && asset.id.trim());
  const sequenceCollections = assetList.map(asset => `sequence-asset:${asset.id.trim()}`);

  // WHAT THE READER CALLED IT. An id the model cannot tell from any other id is
  // a capability it cannot use on purpose; every uploaded asset used to reach it
  // under one constant sentence, and a personal swell reached it under none at
  // all. The name is the reader's own, so it is reported rather than invented.
  const materialNames = new Map();
  // WHAT KIND OF THING IT IS. A still and a thirty-second clip were described
  // by the same sentence, so a composer could not tell one from the other and
  // scored a video as if it were a photograph. The duration is measured at
  // upload (probeVideoDurationMs) and was then told to nobody.
  const materialKinds = new Map();
  for (const asset of assetList) {
    const collectionId = `sequence-asset:${asset.id.trim()}`;
    if (typeof asset.name === 'string' && asset.name.trim()) {
      materialNames.set(collectionId, asset.name.trim());
    }
    materialKinds.set(collectionId, {
      // The same test createSequenceVisualAsset applies, so a still and a
      // clip are not sorted one way in the score lane and another here.
      mediaKind: asset.kind === 'video' || asset.mimeType === 'video/mp4' ? 'video' : 'image',
      durationMs: Number.isInteger(asset.durationMs) && asset.durationMs > 0
        ? asset.durationMs
        : null,
      // THE READER'S OWN WORDS, AND SO NOT TRUSTED THE WAY A GENERATED
      // CONSTANT IS. Every other description in this catalogue is a string
      // this codebase wrote; this one was typed by a person into a text field,
      // so it is bounded and refused as a URI at the point it enters the
      // document rather than wherever it happens to be printed.
      description: typeof asset.description === 'string' && asset.description.trim()
        ? boundedText(asset.description.trim(), '$.assets.description')
        : null
    });
  }
  const swellList = (Array.isArray(surface.swells) ? surface.swells : [])
    .filter(swell => swell && typeof swell.id === 'string' && swell.id.trim());
  for (const swell of swellList) {
    if (typeof swell.name === 'string' && swell.name.trim()) {
      materialNames.set(swell.id.trim(), swell.name.trim());
    }
  }
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
  // THE READER'S OWN AUDIO, AND NOTHING ELSE. A literal 'personal' used to
  // head this list, and no swell has ever been called that: a personal
  // signal is `swell_<timestamp>_<rand>` (personal-swells.js) and nothing in
  // src/ reads the word specially. So the gate admitted a cue that was
  // guaranteed silent — a capability offered that could never sound.
  const swells = uniquePreserve([
    ...(Array.isArray(surface.swellIds) ? surface.swellIds : []),
    ...swellList.map(swell => swell.id.trim())
  ]);
  // Both from the registry that owns them, for the same reason as everything
  // above: a list written out here is a list that can come to disagree with
  // the thing it describes.
  const surfaces = uniquePreserve(PROGRAM_VISUAL_FIELD_RENDERERS);
  const voices = uniquePreserve(availableVoicePacks().map(pack => pack.id));

  const payload = {
    schema: CURATOR_CONTEXT_SCHEMA,
    id: typeof surface.id === 'string' && surface.id.trim()
      ? surface.id.trim()
      : `curator-context-${Date.now()}`,
    sources,
    visuals: { collections, engines, surfaces },
    audio: { soundscapes, tones, swells, voices },
    constraints: surface.constraints,
    catalog: buildCatalog({
      collections, engines, soundscapes, swells, voices, materialNames, materialKinds
    }),
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
function buildCatalog({
  collections, engines, soundscapes, swells = [], voices = [],
  materialNames = new Map(), materialKinds = new Map()
}) {
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
      const name = materialNames.get(id);
      const media = materialKinds.get(id) || {};
      const mediaKind = media.mediaKind === 'video' ? 'video' : 'image';
      collectionEntries[id] = {
        kind: 'sequence-asset',
        mediaKind,
        // WHAT THE READER SAID, IF THEY SAID ANYTHING. The generated sentence
        // below carries nothing `mediaKind` does not already carry, so once
        // there are real words it is pure redundancy and gives way to them.
        // The attribution — that these are the reader's own and RISE describes
        // rather than vouches for them — is not lost with it: it lives in
        // `kind: 'sequence-asset'` and in the prompt's own heading.
        description: media.description || SEQUENCE_ASSET_DEFAULT_DESCRIPTIONS[mediaKind],
        ...(mediaKind === 'video' && Number.isInteger(media.durationMs)
          ? { durationMs: media.durationMs } : {}),
        ...(name ? { name } : {})
      };
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

  // A SWELL THE READER UPLOADED IS IN NO REGISTRY, so nothing described it and
  // it reached the model as a bare id — the one capability it was given no way
  // to tell apart from any other.
  //
  // Every id here is the reader's own: the list is built from their swells and
  // nothing else. It used to be headed by a literal 'personal' that named no
  // swell, and this loop carried a guard to keep that phantom out of the
  // catalogue. The phantom is gone (see `swells` above), so the guard has gone
  // with it rather than being left where no input could fail it.
  const swellEntries = {};
  for (const id of swells) {
    const name = materialNames.get(id);
    swellEntries[id] = {
      kind: 'personal-audio',
      description: 'Audio the reader uploaded.',
      ...(name ? { name } : {})
    };
  }

  // A VOICE IS A PERSON'S NAME AND NOTHING ELSE WOULD SAY SO. `af_heart` is
  // an id nobody could choose between if there were two, so the label the
  // voice pack carries rides with it — from that registry, never authored here.
  const voiceEntries = {};
  const labelled = new Map(availableVoicePacks().map(pack => [pack.id, pack.label]));
  for (const id of voices) {
    const label = labelled.get(id);
    voiceEntries[id] = {
      kind: 'narration-voice',
      description: 'A built recitation voice. Narration is spoken; it is not a bed or a swell.',
      ...(label ? { name: label } : {})
    };
  }

  return {
    collections: collectionEntries,
    engines: engineEntries,
    soundscapes: soundscapeEntries,
    swells: swellEntries,
    voices: voiceEntries
  };
}

export function serializeCuratorContext(context) {
  const validated = validateCuratorContext(context);
  return `${JSON.stringify(validated, null, 2)}\n`;
}
