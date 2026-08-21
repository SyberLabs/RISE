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
  PROGRAM_VISUAL_FIELD_RENDERERS,
  validateExperienceProgram
} from './experience-program.js';
import {
  createCuratorSourceReader,
  CURATOR_SOURCE_KNOWN,
  CURATOR_SOURCE_UNKNOWN_DIVISION,
  validateCuratorContext
} from './curator-context.js';
import {
  EXTENT_MIN_WORDS,
  EXTENT_OVERSHOOT_LIMIT,
  EXTENT_REFUSAL,
  extentNominalWords,
  extentReadsWholeDivision,
  libraryExtentId,
  parseLibraryExtent
} from './library-extent.js';
import { MAX_SAFE_TARGET_WORDS, READING_LIMITS } from './reading-limits.js';
import {
  AGENT_OPERATION_SET_SCHEMA,
  operationSetCapabilities,
  validateAgentOperationSet
} from './agent-operations.js';
import {
  WORKSHOP_PROJECT_SCHEMA,
  validateWorkshopProject
} from './workshop-project.js';
import { isBoundarySource } from './journey-compiler.js';
import {
  SEQUENCE_ASSET_PREFIX,
  sequenceAssetReferencesFromCue
} from './visual-score-lane.js';

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

/**
 * EVERY source id this program will cause to be loaded.
 *
 * ONE ENUMERATION, SPENT BY THE BUDGET AND WALKED BY THE RESOLVER. They were
 * two: the budget iterated `if (track.kind !== 'movement') continue` on the
 * argument that a movement reads its source whole and every other lane binds
 * inside territory the movements already own. That argument is false of a
 * transition clip, whose anchor carries `sourceIds` of its own — so a score
 * could name a 38-word chapter as its movement and Middlemarch as its coda
 * and be admitted against a 200-word budget, then load 315,299 words. It was
 * the one place a score could name a work the budget never saw.
 *
 * So the budget spends exactly this, and `resolveProgramLibrarySources` walks
 * exactly this. Not two functions kept in agreement — one function, which is
 * the only arrangement a new anchor field cannot silently break.
 *
 * Synthetic boundary sources are program-local and carry no text; they are
 * skipped here because the resolver has nothing to load for them.
 *
 * AND IT IS THE READING ORDER, WHICH IS WHY THE MOVEMENT TRACK GOES FIRST.
 * ──────────────────────────────────────────────────────────────────────
 * This enumeration becomes `project.sources`, and `project.sources` is the
 * order the words reach the reader in. It used to walk `program.tracks` in
 * ARRAY order, so a track that is not a movement decided the reading: two
 * scores with identical movement tracks — m1 `sacred-tao-te-ching#1`, m2 `#81`
 * — read in opposite directions, because one of them also carried a visual
 * clip anchored to `#81` and listed that track first. 124 words then 106, or
 * 106 then 124, off the position of a cue in a JSON array. Both scores were
 * valid, both passed the gate, and nothing refused.
 *
 * THE MOVEMENT TRACK IS WHERE A SCORE DECLARES ITS ORDER. Movement clips carry
 * a contiguous `data.index` the validator checks against their position
 * (PROGRAM_MOVEMENT_INDEX), so walking that track in array order IS reading
 * order, stated by the score itself. Nothing else in the document says
 * anything about sequence: a visual track's position among the tracks is not a
 * claim, and refusing a score for it would be refusing on a rule no composer
 * was given and no field expresses. Reading the order out of the track that
 * declares it is not repair — it is reading the document correctly, which is
 * what the gate was failing to do.
 *
 * A SOURCE NO MOVEMENT NAMES still has to be loaded, so the other tracks are
 * walked after — a transition's own source lands at the end of the reading
 * rather than in the seam its `afterSourceId` names, which is a separate
 * defect and is not this function's to invent an answer for.
 *
 * ONE FUNCTION STILL. The order is a property of the walk, not a second
 * enumeration handed to the resolver: the budget spends this set and the
 * resolver loads this list, exactly as before.
 */
export function programSourceIds(program) {
  const ids = new Set();
  const tracks = program?.tracks || [];
  const inReadingOrder = [
    ...tracks.filter(track => track.kind === 'movement'),
    ...tracks.filter(track => track.kind !== 'movement')
  ];
  for (const track of inReadingOrder) {
    for (const clip of track.clips || []) {
      for (const sourceId of clip.anchor?.sourceIds || []) {
        if (isBoundarySource(sourceId)) continue;
        ids.add(sourceId);
      }
      const after = clip.anchor?.afterSourceId;
      const before = clip.anchor?.beforeSourceId;
      if (after && !isBoundarySource(after)) ids.add(after);
      if (before && !isBoundarySource(before)) ids.add(before);
    }
  }
  return [...ids];
}

/**
 * Every source id an operation set will cause to be loaded.
 *
 * The same law as programSourceIds, for the other door:
 * `resolveOperationLibrarySources` walks this list, and the gate spends it.
 * Only `add-source` puts a work into the project — every other operation
 * names a source the project already holds, and the producer refuses it as
 * `AGENT_OP_SOURCE` when it does not.
 *
 * Read out of `operationSetCapabilities`, which enumerates every capability an
 * operation set names rather than only the text: two walks over one document
 * is the arrangement that let a soundscape, a tone, a swell and a voice past
 * a door that was already counting the words.
 */
export function operationSetSourceIds(operationSet) {
  return [...new Set(operationSetCapabilities(operationSet).addedSources)];
}

/**
 * WHAT A DOCUMENT MAY NAME, AS ONE VOCABULARY IN ONE PLACE.
 *
 * One entry per family of capability: where the offered ids live in the
 * capability document, the refusal raised when an id is not among them, and
 * the field of `details` the id travels in. Both doors enumerate INTO this
 * shape and ONE loop checks it, so a family added here is checked at both
 * doors or at neither.
 *
 * That is the whole of the fix. The membership checks were six hand-written
 * loops inside `assertProgramWithinContext` and the operations door consulted
 * none of them, on the strength of a comment claiming an operation set "names
 * no collections, engines or soundscapes of its own". `set-atmosphere` names
 * three, `assign-visual` names four more, and every one of them was written
 * into the project unexamined.
 *
 * scriptorium-gate.test.js drives an invented id through every family at both
 * doors and requires the same refusal from each, so a family with no check is
 * a failing test rather than an accepted score.
 */
export const CAPABILITY_FAMILIES = Object.freeze({
  collections: Object.freeze({
    noun: 'collection',
    code: 'PROGRAM_IO_UNKNOWN_COLLECTION',
    detail: 'collectionId',
    offered: (context) => context.visuals?.collections
  }),
  engines: Object.freeze({
    noun: 'engine',
    code: 'PROGRAM_IO_UNKNOWN_ENGINE',
    detail: 'engineId',
    // A procedural pool is offered under both names, and an operation that
    // says `procedural:klee` is naming the same thing a cue's `collections`
    // names. Refusing one spelling of an id the document carries would be the
    // gate disagreeing with the document it handed out.
    offered: (context) => [
      ...(context.visuals?.engines || []),
      ...(context.visuals?.collections || [])
    ]
  }),
  /**
   * THE ONE FAMILY THAT IS THE BUILD'S RATHER THAN THE DOCUMENT'S.
   *
   * A field renderer is closed by `PROGRAM_VISUAL_FIELD_RENDERERS` and has
   * been since the program validator existed — the three names do not vary
   * with what a reader brought. So the check is against the constant, and the
   * document carries the list so a composer can READ it: a gate checking
   * against a vocabulary nobody was given refuses on a rule nobody could have
   * followed, which is why `visuals.surfaces` was added in the same pass.
   *
   * Reading `context.visuals.surfaces` here instead would make every document
   * written before that field existed refuse its own field cues — a new
   * requirement applied backwards, which is the opposite of degrading
   * reverently. scriptorium-gate.test.js requires the document to state
   * exactly this constant, so the two cannot drift apart.
   */
  surfaces: Object.freeze({
    noun: 'field renderer',
    code: 'PROGRAM_IO_UNKNOWN_SURFACE',
    detail: 'renderer',
    offered: () => PROGRAM_VISUAL_FIELD_RENDERERS
  }),
  soundscapes: Object.freeze({
    noun: 'soundscape',
    code: 'PROGRAM_IO_UNKNOWN_SOUNDSCAPE',
    detail: 'soundscapeId',
    offered: (context) => context.audio?.soundscapes
  }),
  tones: Object.freeze({
    noun: 'tone',
    code: 'PROGRAM_IO_UNKNOWN_TONE',
    detail: 'presetId',
    offered: (context) => context.audio?.tones
  }),
  swells: Object.freeze({
    noun: 'swell',
    code: 'PROGRAM_IO_UNKNOWN_SWELL',
    detail: 'swellId',
    offered: (context) => context.audio?.swells
  }),
  voices: Object.freeze({
    noun: 'voice',
    code: 'PROGRAM_IO_UNKNOWN_VOICE',
    detail: 'voiceId',
    offered: (context) => context.audio?.voices
  }),
  // A sequence asset travels in the context as a collection id, which is the
  // only vocabulary it has there. A context carrying no assets — the
  // Scriptorium exports none, because no bytes leave — refuses every one of
  // them by the same rule rather than by a special case.
  assets: Object.freeze({
    noun: 'asset',
    code: 'PROGRAM_IO_UNKNOWN_ASSET',
    detail: 'assetId',
    offered: (context) => (context.visuals?.collections || [])
      .filter(id => id.startsWith(SEQUENCE_ASSET_PREFIX))
      .map(id => id.slice(SEQUENCE_ASSET_PREFIX.length))
  })
});

/**
 * Refuse every named id no family offers.
 *
 * A family's entry is a Set of ids, or a Map from id to `{ noun, details }`
 * where the document knows more about it than its id — a sequence asset knows
 * what ROLE it was named in, and "this score requires personal focal asset
 * portrait" is a sentence a reader can act on where "asset portrait" is not.
 *
 * @param {Record<string, Set<string>|Map<string, object>>} named by family key
 * @param {object} context a validated capability document
 * @param {string} subject how the refusal names the document — 'Program' or
 *   'This operation set', because a reader who pasted operations was not
 *   handed a score and should not be told they were
 */
function assertCapabilitiesOffered(named, context, subject, path) {
  for (const [family, rule] of Object.entries(CAPABILITY_FAMILIES)) {
    const ids = named[family];
    if (!ids) continue;
    const offered = new Set(rule.offered(context) || []);
    const entries = ids instanceof Map ? [...ids] : [...ids].map(id => [id, null]);
    for (const [id, extra] of entries) {
      if (offered.has(id)) continue;
      fail(rule.code,
        `${subject} names ${extra?.noun || rule.noun} ${id} absent from curator context`,
        path,
        { [rule.detail]: id, family, ...(extra?.details || {}) });
    }
  }
}

/**
 * WHY AN ID THAT PASSED THE GATE STILL WOULD NOT LOAD.
 *
 * A CLOSED VOCABULARY, CARRIED RATHER THAN GUESSED. `describeImportFailure`
 * used to re-parse the refused id and switch on `extent.words` to decide what
 * to say — and `parseLibraryExtent` nulls `words` on a below-floor cut, so a
 * floor refusal was indistinguishable from a division holding no text. The
 * reader of `spoon-river-anthology#50:37` was told "The work is here; this
 * edition yields no text for division 50", which is false twice: division 50
 * exists and has text, and the fault was a 37-word cut against a 40-word
 * floor. That is a substitute offered where an absence was required (law 3),
 * written by the function that owns the wording.
 *
 * The resolver knows exactly which of these it hit. It says so, and the
 * phrasing reads it. scriptorium-gate.test.js fails when a member of this
 * object has no sentence.
 */
export const LIBRARY_LOAD_REFUSAL = Object.freeze({
  /** The id is not one of the three forms — see EXTENT_REFUSAL.GRAMMAR. */
  GRAMMAR: 'malformed-extent',
  /** The cut asks for fewer words than an opening may be. */
  FLOOR: 'below-floor',
  /** This edition is not divided, so it cannot serve a division of itself. */
  UNDIVIDED: 'work-undivided',
  /** The edition's scheme has no entry at that ordinal. */
  NO_DIVISION: 'no-such-division',
  /** The entry exists and holds no text. */
  EMPTY_DIVISION: 'empty-division',
  /** The work is here and this build holds no text for it. */
  EMPTY_WORK: 'empty-work',
  /** No honest boundary lies within the overshoot cap. */
  NO_BOUNDARY: 'no-boundary-within-cap',
  /** Reading the edition threw. */
  LOAD_FAILED: 'load-failed'
});

/**
 * A work the score was ALLOWED to name that will not load.
 *
 * This is the refusal only the bytes can settle, and it arrives after the
 * gate has said yes. The gate refuses everything it can prove wrong from the
 * catalogue alone — a work nobody holds, a division the edition does not
 * have, a cut below the floor — so what reaches here is chiefly an opening
 * whose first honest boundary lies past the overshoot cap.
 *
 * IT IS AN ERROR RATHER THAN A SENTENCE because both doors onto this gate hit
 * it and only one of them had words for it. The Workshop's Import score wrote
 * this reply itself (`describeUnloadableLibrarySources`, removed in the same
 * change) while the Scriptorium said `Could not load: ulysses#18:200` and
 * stopped — the same event, one wording, and the room with the copyable
 * refusal panel was the one that had nothing to say.
 *
 * @param {{ absent?: string[], unreadable?: string[],
 *           reasons?: Record<string, string> }} parts
 *   `absent` — not on this build's shelf at all;
 *   `unreadable` — the work is here and this cut of it is not;
 *   `reasons` — id → LIBRARY_LOAD_REFUSAL, from the resolver that hit it.
 */
export function unloadableLibrarySourcesError({
  absent = [], unreadable = [], reasons = {}
} = {}) {
  const named = [...unreadable, ...absent];
  return new ExperienceProgramIoError(
    'PROGRAM_IO_LIBRARY_UNLOADABLE',
    `Could not load ${named.join(', ')}`,
    '$.tracks',
    { absent: [...absent], unreadable: [...unreadable], reasons: { ...reasons } }
  );
}

/**
 * A score whose movements name nothing this build can load.
 *
 * Distinct from every membership refusal above: those are about an id that is
 * not offered, and this is about a score that named no Library work at all —
 * which the surface it was pasted into cannot compensate for, because the
 * Scriptorium has no sources of its own to bind to.
 */
export function noLibrarySourcesError() {
  return new ExperienceProgramIoError(
    'PROGRAM_IO_NO_LIBRARY_SOURCES',
    'The score names no Library sources to load',
    '$.tracks'
  );
}

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
 * WHAT SHAPE THE DOCUMENT IS IN, when it turns out not to be JSON.
 *
 * NAMING IS NOT REPAIRING. A fenced document is the commonest thing a model
 * hands back, and `Unexpected token '`'` is a true statement about character
 * zero that tells the writer nothing they can act on. Stripping the fence
 * would be correcting a model's output, which this doorway does not do — so
 * it says what it sees and lets a person decide.
 *
 * @returns {'fenced'|'truncated'|null}
 */
function jsonDocumentShape(text) {
  if (/(^|\n)[ \t]*```/u.test(text)) return 'fenced';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const character of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{' || character === '[') depth += 1;
    else if (character === '}' || character === ']') depth -= 1;
  }
  // A document that ends inside a string or inside a brace was cut off, and
  // "Expected property name at position 298" is a character offset into a
  // document the reader did not write.
  return inString || depth > 0 ? 'truncated' : null;
}

/** The checks every pasted document meets before anything reads its fields. */
function parseJsonDocument(text) {
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
  try {
    return JSON.parse(text);
  } catch (error) {
    return fail('PROGRAM_IO_JSON', `Invalid JSON: ${error.message}`, '$',
      { shape: jsonDocumentShape(text) });
  }
}

/**
 * Parse JSON text into a frozen proposed Experience Program.
 * Never clamps or repairs — validateExperienceProgram refuses or accepts.
 */
export function parseExperienceProgramJson(text, options = {}) {
  return importExperienceProgram(parseJsonDocument(text), options);
}

/**
 * Scriptorium paste: a full proposed score, or a bounded operation set.
 */
export function parseCuratorPaste(text, options = {}) {
  const parsed = parseJsonDocument(text);
  if (parsed?.schema === AGENT_OPERATION_SET_SCHEMA) {
    const operationSet = validateAgentOperationSet(parsed);
    // THE SAME GATE, THROUGH THE OTHER DOOR. This branch used to end at
    // `validateAgentOperationSet(parsed)` with the context dropped on the
    // floor, so an operation set met no membership check, no budget and no
    // ceiling: `{"op":"add-source","sourceId":"middlemarch"}` was accepted
    // against a 200-word length and handed back a 315,261-word novel under
    // one line of summary. A door that admits what the other refuses is not
    // a second door, it is a hole.
    if (options.context != null) {
      assertOperationSetWithinContext(operationSet, options.context);
    }
    return { kind: 'operations', operationSet };
  }
  return {
    kind: 'program',
    program: importExperienceProgram(parsed, options)
  };
}

/**
 * Import a program object (already parsed). Lands as proposed.
 * When `context` is supplied, every named source/collection/engine/
 * soundscape/swell/tone/sequence asset must appear in that capability
 * document.
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

/**
 * EVERY capability a program names, by family — the other half of the pair
 * `operationSetCapabilities` completes.
 *
 * `voices` and `surfaces` are enumerated here as well as there. A narration
 * cue names a voice and nothing checked it at either door; a visual `field`
 * cue names a renderer, which the program validator closes on its own, so
 * this family is normally empty on this side and is walked anyway — a
 * capability checked at one door and not the other is how this defect began.
 */
export function programCapabilities(program) {
  const collections = new Set();
  const engines = new Set();
  const surfaces = new Set();
  const soundscapes = new Set();
  const swells = new Set();
  const tones = new Set();
  const voices = new Set();
  const assets = new Map();
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
      if (cue.kind === 'field' && cue.renderer) surfaces.add(cue.renderer);
      if (cue.kind === 'spoken' && cue.voiceId) voices.add(cue.voiceId);
      for (const reference of sequenceAssetReferencesFromCue(cue)) {
        if (!assets.has(reference.id)) {
          assets.set(reference.id, {
            noun: `${reference.role} asset`,
            details: { assetRole: reference.role, expectedKind: reference.expectedKind }
          });
        }
      }
    }
  }
  return {
    collections, engines, surfaces, soundscapes, swells, tones, voices, assets, sourceRefs
  };
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

  // ONE READING PER ID, shared by membership and budget. Two independent
  // `new Set(...map(item => item.id))` lookups were what killed the extents:
  // both compared against bare work ids, so `sacred-tao-te-ching#40` was an
  // unknown source at one and an unmeasured one at the other.
  const readSource = createCuratorSourceReader(context);
  const readings = new Map();
  const read = (sourceId) => {
    if (!readings.has(sourceId)) readings.set(sourceId, readSource(sourceId));
    return readings.get(sourceId);
  };
  const declaredTransitionSources = new Set();
  for (const track of program.tracks || []) {
    if (track.kind !== 'transition') continue;
    for (const clip of track.clips || []) {
      for (const sourceId of clip.anchor?.sourceIds || []) {
        if (isBoundarySource(sourceId)) declaredTransitionSources.add(sourceId);
      }
    }
  }

  const used = programCapabilities(program);

  for (const { sourceId, trackKind } of used.sourceRefs) {
    if (declaredTransitionSources.has(sourceId)) continue;
    refuseUnlessOffered(read(sourceId), trackKind);
  }
  assertOneSourcePerPassage(used.sourceRefs, declaredTransitionSources, read, '$.tracks');
  assertCapabilitiesOffered(used, context, 'Program', '$.tracks');
  assertSourcesWithinBudget(programSourceIds(program), context, read, '$.tracks');
  return true;
}

/**
 * The capability gate, for an operation set.
 *
 * Everything `assertProgramWithinContext` proves about a score from the
 * catalogue alone, proved here about the same document through the other
 * door — the same reader, the same family table, the same refusals and the
 * same budget, so the two doors cannot disagree about the same capability at
 * the same length.
 *
 * WHAT USED TO STAND HERE was a sentence saying an operation set "names no
 * collections, engines or soundscapes of its own" and that "its cues are
 * validated against the project the producer builds, which is where a
 * capability it invents is refused". Both halves were false.
 * `set-atmosphere` names a soundscape, a tone preset and a personal swell,
 * and wrote all three into the project's reading defaults; `assign-visual`
 * names a collection, an engine, a field renderer or an asset;
 * `assign-narration` names a voice the document did not even list. Nothing on
 * that path consulted the capability document at all, so a score that asked
 * for a soundscape nobody offers was refused at one door and persisted at the
 * other under "Nothing refused."
 */
export function assertOperationSetWithinContext(operationSetValue, contextValue) {
  const context = validateCuratorContext(contextValue);
  const readSource = createCuratorSourceReader(context);
  const readings = new Map();
  const read = (sourceId) => {
    if (!readings.has(sourceId)) readings.set(sourceId, readSource(sourceId));
    return readings.get(sourceId);
  };
  const named = operationSetCapabilities(operationSetValue);
  const sourceIds = [...new Set(named.addedSources)];
  for (const sourceId of sourceIds) {
    refuseUnlessOffered(read(sourceId), 'operation', '$.operations');
  }
  assertCapabilitiesOffered(named, context, 'This operation set', '$.operations');
  assertOperationSetReadsSomething(named, context);
  assertSourcesWithinBudget(sourceIds, context, read, '$.operations');
  return true;
}

/**
 * THERE HAS TO BE A READING FOR THE OTHER CHECKS TO BE ABOUT.
 *
 * §13 gives status 51 to "there is no reading here", the program door
 * enforces it, and the operations door had no such check: `set-atmosphere`
 * alone, `request-asset` alone, and `add-source` followed by `remove-source`
 * all reached `Ready to read.` over a project with zero sources. The room
 * offered Begin on it and the CLI tripped three functions later inside
 * `measureReading`, which reported the empty reading as a fault in RISE.
 *
 * The add-then-remove case is the one that matters: it is what a model does
 * when it changes its mind mid-proposal, and it is invisible to any check
 * that only looks at which ids `add-source` names. So the NET membership is
 * what is measured — what the surface already holds, plus what the set adds,
 * less what it takes away. In the Workshop that starts from a project's own
 * sources and this passes; in the Scriptorium it starts from nothing, which
 * is why an operation set pasted here has to bring its own text.
 */
function assertOperationSetReadsSomething(named, context) {
  const remaining = new Set((context.sources || []).map(source => source.id));
  for (const sourceId of named.addedSources) remaining.add(sourceId);
  for (const sourceId of named.removedSources) remaining.delete(sourceId);
  if (remaining.size) return;
  throw new ExperienceProgramIoError(
    'PROGRAM_IO_NO_LIBRARY_SOURCES',
    'These operations leave no source to read',
    '$.operations',
    {
      added: [...new Set(named.addedSources)],
      removed: [...new Set(named.removedSources)]
    }
  );
}

/**
 * TWO SPELLINGS OF ONE PASSAGE ARE ONE SOURCE — the `:N` twin of the leading
 * zero, and it defeated the same rule.
 *
 * `PROGRAM_SOURCE_OWNERSHIP` refuses a source named by two movements. It
 * compares id STRINGS, which is all the program validator can do: it holds no
 * catalogue, so it cannot know how long a division is. So a score that opened
 * on `spoon-river-anthology#12` and returned to it as `#12:79` was admitted —
 * 79 words clears the division's own length, `sentenceAlignedPrefix` hands
 * back `boundary: 'whole'`, and Judge Somers was read twice under two movement
 * titles with two identical names in the source list. Exactly the hole
 * `#0040` vs `#40` left before the canonical-ordinal check closed it (§10c),
 * one grammar position along.
 *
 * A REPRISE IS REFUSED, DELIBERATELY, AND THIS IS WHERE THE REASONING LIVES.
 * ─────────────────────────────────────────────────────────────────────────
 * Returning to a passage is a normal move in a stitched reading and the rule
 * against it does read like it was written when a movement meant a chapter of
 * a novel. It is still the right refusal today, and not on taste: a source is
 * identified BY ITS ID everywhere downstream of here. `project.sources` is
 * keyed by id (WORKSHOP_PROJECT_DUPLICATE_SOURCE), the resolver loads one
 * payload per id, and every visual, audio, swell, reading and narration anchor
 * binds to a source id. A passage read twice under one id has no way to say
 * which pass a cue belongs to; read twice under two ids it is two sources, two
 * loads and two entries with the same name in the reader's own rundown, which
 * is what `reprise-two-ids` produced. Admitting a reprise properly means
 * movement-scoped source instances through the whole chain, and until that
 * exists the honest answer is a refusal that both spellings get.
 *
 * The budget was already right about it — it charges each id, so a reprise
 * costs its words twice — which is why this is a refusal and not a counting
 * fix.
 *
 * WHAT IS PROVED, AND WHAT IS NOT. Only a `:N` that provably covers its whole
 * division is folded, because that is the only collision the catalogue can
 * settle. Two openings of one division at different asks may land on the same
 * sentence, and where the sentences fall is not in any capability document —
 * so it is not claimed. The gate refuses what it can prove and never guesses.
 *
 * IDENTICAL IDS ARE NOT THIS CHECK'S. `validateExperienceProgram` already
 * refuses those, before any context is in hand, and the budget must not be the
 * thing that discovers them (see curator-budget.test.js). This fires only on
 * two DIFFERENT ids naming one passage, which is the case only the catalogue
 * can see.
 */
function assertOneSourcePerPassage(sourceRefs, declaredTransitionSources, read, path) {
  /** The id a passage would be spelled as, once a redundant `:N` is dropped. */
  const canonical = (sourceId) => {
    const reading = read(sourceId);
    if (!reading.division || reading.askedWords == null) return sourceId;
    return extentReadsWholeDivision(reading.words, reading.askedWords)
      ? libraryExtentId(reading.workId, reading.division)
      : sourceId;
  };

  // The same partition validateRelationships owns, so the two agree about
  // which refusal a collision earns: a movement may not share a passage with
  // another movement, and a transition may not share one with anything.
  const OWNERS = Object.freeze({
    movement: {
      code: 'PROGRAM_SOURCE_OWNERSHIP',
      say: (left, right) => `${left} and ${right} are the same passage, `
        + 'and a source belongs to one movement'
    },
    transition: {
      code: 'PROGRAM_TRANSITION_SOURCE_DUPLICATE',
      say: (left, right) => `${left} and ${right} are the same passage, `
        + 'so the transition source is not unique'
    }
  });

  const claimed = new Map();
  for (const { sourceId, trackKind } of sourceRefs) {
    const rule = OWNERS[trackKind];
    if (!rule || declaredTransitionSources.has(sourceId)) continue;
    const passage = canonical(sourceId);
    const held = claimed.get(passage);
    if (held && held.sourceId !== sourceId) {
      // A transition colliding with a movement is the transition's fault, in
      // both orders — it is the lane with the uniqueness requirement.
      const blamed = held.trackKind === 'transition' ? held : { sourceId, trackKind };
      fail(OWNERS[blamed.trackKind].code,
        OWNERS[blamed.trackKind].say(held.sourceId, sourceId),
        path,
        {
          sourceId: blamed.sourceId,
          otherSourceId: blamed.sourceId === sourceId ? held.sourceId : sourceId,
          canonicalId: passage,
          trackKind: blamed.trackKind
        });
    }
    if (!held) claimed.set(passage, { sourceId, trackKind });
  }
}

/**
 * Say which of the four ways a source id can be wrong it was.
 *
 * They used to be one: everything that was not an exact id in the context
 * came back as an unknown source, and the reply then listed the works that
 * WERE available — so `spoon-river-anthology#900` was told the room does not
 * have Spoon River, directly above a line offering Spoon River.
 */
function refuseUnlessOffered(reading, trackKind, path = '$.tracks') {
  const { status, sourceId } = reading;
  if (status === CURATOR_SOURCE_KNOWN) return;
  const details = {
    sourceId,
    trackKind,
    workId: reading.workId,
    division: reading.division,
    divisionCount: reading.divisionCount
  };
  if (status === CURATOR_SOURCE_UNKNOWN_DIVISION) {
    fail('PROGRAM_IO_UNKNOWN_DIVISION',
      `${reading.title || reading.workId} has ${reading.divisionCount} divisions; `
      + `the score names ${sourceId}`,
      path, details);
  }
  if (status === EXTENT_REFUSAL.FLOOR) {
    fail('PROGRAM_IO_EXTENT_FLOOR',
      `${sourceId} asks for an opening shorter than ${EXTENT_MIN_WORDS} words`,
      path, { ...details, minimumWords: EXTENT_MIN_WORDS });
  }
  if (status === EXTENT_REFUSAL.GRAMMAR) {
    fail('PROGRAM_IO_EXTENT_GRAMMAR',
      `${sourceId} is not a source id this reader can read`,
      path, details);
  }
  fail('PROGRAM_IO_UNKNOWN_SOURCE',
    `Program names source ${sourceId} absent from curator context`,
    path, { sourceId, trackKind });
}

/**
 * A reading is as long as the sources it will LOAD.
 *
 * The caller hands the one enumeration the resolver walks — programSourceIds
 * or operationSetSourceIds — so the number proved here is a fact about the
 * same set of works the reading will open. It used to be a fact about the
 * movement tracks alone; see programSourceIds for what that let through.
 *
 * A source whose length is unknown makes the budget unprovable, and inability
 * to prove is not proof: refuse, rather than admit an unmeasured work.
 *
 * TWO TOTALS, BECAUSE TWO DIFFERENT QUESTIONS ARE BEING ASKED.
 * ────────────────────────────────────────────────────────────
 * ONE number answered both and answered neither. Every extent was spent at
 * `extentReadingBound` — the MOST a cut can be handed — against the reader's
 * length, on the argument that a budget spending less would promise a length
 * the reading may exceed. True of the machine, false of the reader: the cutter
 * aims at the ask and the bound is 1.6× it, so a prompt-obedient model filling
 * a 2,000-word length named six openings and delivered 1,005 words. A dial
 * that says twenty minutes and reads ten is not a rounding cost.
 *
 * Worse, the error was not uniform. Where a division is SHORTER than the ask
 * it is read whole and charge equals delivery, so over the Tao at `:200` the
 * charge came within 2.3% of the reading, and over Ovid it over-charged by a
 * third. The size of the lie depended on the shape of the shelf, which is the
 * one thing a curator cannot see.
 *
 * So the two questions are answered by the two numbers they are about:
 *
 *   the reader's length  — `extentNominalWords`, what the extent NAMES, which
 *     is what a division holds or what an opening asked for. It is the best
 *     estimate of delivery the catalogue can make, and it is exact for a whole
 *     work or a whole division.
 *   the machine's hold   — `extentReadingBound`, the most it can read, which
 *     is the quantity MAX_SAFE_TARGET_WORDS is a bound over and the quantity
 *     shelf-measurements.test.js proves no cut exceeds. Unchanged.
 *
 * NOTHING GOT MORE OPTIMISTIC ABOUT THE MACHINE. The atom ceiling is still
 * spent at the bound and still checked first, so a score that could overrun
 * the compiler is refused on exactly the evidence it was refused on before.
 * And the reader's length keeps its own envelope for free: `bound ≤
 * OVERSHOOT_LIMIT × nominal` for every extent, so a score inside the length by
 * nominal cannot read past OVERSHOOT_LIMIT × the length whatever the text
 * turns out to hold — proved by arithmetic rather than by a second ceiling
 * that could come to disagree with the first.
 */
function assertSourcesWithinBudget(sourceIds, context, read, path = '$.tracks') {
  const budget = context.constraints?.targetWords;

  const named = sourceIds.map(sourceId => {
    const reading = read(sourceId);
    return {
      sourceId,
      // The most it can read, for the ceiling.
      bound: reading.words,
      // What it names, for the reader's length.
      words: extentNominalWords(reading.words, reading.askedWords)
    };
  });
  if (!named.length) return;

  /**
   * A SESSION HOLDS SO MANY WORKS AND NO MORE, refused here rather than by
   * the project this score would have become.
   *
   * `WORKSHOP_PROJECT_SOURCES` was the refusal a reader actually met for 65
   * chapters of the Tao — 8,456 words against a 20,000 budget, nothing large
   * or exotic — and what reached the room's copyable-refusal panel was
   * `A Workshop project accepts at most 64 sources ($.sources)`: a JSON path
   * and an internal schema, in a room whose ruling is that the reader never
   * passes through the Workshop (§10b). It arrived as exit 1, which §13 says
   * means a bug in the CLI rather than a verdict — so an ordinary score
   * reported the CLI as broken.
   *
   * The ceiling is READING_LIMITS.maxSources, which is the number the
   * Workshop project enforces, read from the same constant rather than
   * copied — so the gate cannot come to refuse at a different count than the
   * thing it is protecting.
   *
   * IT HAS ITS OWN CODE AND ITS OWN STATUS (43). It shared
   * PROGRAM_IO_ATOM_CEILING and 42 for one pass, on the reading that §13
   * defines 42 as "longer than one session can hold" and a session holds
   * works as well as words. True, and still not enough: the exit status is
   * the whole of what a script branches on, and `details.maxSources` — the
   * only thing that told the two apart — is not a status. The fixes differ
   * too. Too many WORDS means read less; too many WORKS means name the same
   * reading in fewer ids, which is often the identical text. §13 already
   * keeps 32 and 33 apart for exactly this reason.
   */
  if (named.length > READING_LIMITS.maxSources) {
    fail('PROGRAM_IO_SOURCE_CEILING',
      `This score names ${named.length} sources; one reading holds `
      + `${READING_LIMITS.maxSources}`,
      path,
      { count: named.length, maxSources: READING_LIMITS.maxSources });
  }

  // `extentNominalWords` is null exactly when the bound is, so one partition
  // serves both totals — a source is measured for both questions or for
  // neither, and there is no arrangement in which one of the two silently
  // counts a work the other could not.
  const unmeasured = named.filter(entry => !Number.isInteger(entry.words));
  const measured = named.filter(entry => Number.isInteger(entry.words));
  const total = measured.reduce((sum, entry) => sum + entry.words, 0);
  const boundTotal = measured.reduce((sum, entry) => sum + entry.bound, 0);

  /**
   * A CEILING THE READER CANNOT RAISE, checked whether or not they set a
   * length. The compiler counts atoms, not words, and emits a paragraph-break
   * atom between paragraphs — so a 118,695-word score passed this gate and
   * then threw at Begin with 121,617 atoms, advising a chunk mode this room
   * has no control for. It is refused here, where the reason is copyable and
   * nothing has been accepted into the Vault yet.
   *
   * BEFORE THE UNMEASURED BRANCH BELOW, and over the measured sources alone.
   * It used to sit after, so on a door with no targetWords one source of
   * unknown length returned early and carried every measured source past the
   * ceiling with it: `["middlemarch"]` was refused and `["middlemarch",
   * "unmeasured-notes"]` — strictly longer — was admitted. What cannot be
   * measured cannot excuse what can.
   *
   * AND IT SPENDS THE BOUND, WHERE THE READER'S LENGTH BELOW SPENDS WHAT THE
   * EXTENT NAMES. This is the machine's number: reading-limits.js derives
   * MAX_SAFE_TARGET_WORDS from atoms per word of BUDGET, and the step that
   * makes that argument work is that no cut delivers more words than
   * `extentReadingBound` charged it (shelf-measurements.test.js). Spending the
   * nominal here would be spending a number smaller than the thing the proof
   * is about, and the compiler would be handed a reading the ceiling never saw.
   */
  if (boundTotal > MAX_SAFE_TARGET_WORDS) {
    fail('PROGRAM_IO_ATOM_CEILING',
      `This score reads ${unmeasured.length ? 'at least ' : ''}${boundTotal.toLocaleString()} `
      + `words, which is more than one session can hold `
      + `(${MAX_SAFE_TARGET_WORDS.toLocaleString()} words)`,
      path,
      {
        total: boundTotal,
        atLeast: unmeasured.length > 0,
        maxWords: MAX_SAFE_TARGET_WORDS,
        maxAtoms: READING_LIMITS.maxAtoms,
        sources: [...measured]
          .map(entry => ({ sourceId: entry.sourceId, words: entry.bound }))
          .sort((left, right) => right.words - left.words)
      });
  }

  if (unmeasured.length) {
    // Nothing to prove it against, and nothing claimed. A context with no
    // length is a reader who did not ask for one — and the ceiling above has
    // already had its say about the part of the score that CAN be counted.
    if (!budget) return;
    fail('PROGRAM_IO_BUDGET_UNMEASURED',
      `Cannot measure this score against the ${budget}-word budget: `
      + `${unmeasured.map(entry => entry.sourceId).join(', ')} declares no word count`,
      path,
      { budget, sourceIds: unmeasured.map(entry => entry.sourceId) });
  }

  if (budget && total > budget) {
    fail('PROGRAM_IO_BUDGET_EXCEEDED',
      `This score reads about ${total.toLocaleString()} words against a budget of `
      + `${budget.toLocaleString()}`,
      path,
      {
        budget,
        total,
        // What the score could read at most, beside what it names. The two are
        // the same number for a score of whole works; where they differ the
        // difference IS the rounding an opening is allowed, and a reader
        // deciding what to cut is better served by both than by either.
        boundTotal,
        sources: [...measured]
          .map(entry => ({ sourceId: entry.sourceId, words: entry.words }))
          .sort((left, right) => right.words - left.words)
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
    revision: 0,
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
 * One sentence per way an admitted id can still fail to load.
 *
 * EXHAUSTIVE OVER LIBRARY_LOAD_REFUSAL, and it says so when it is not: a
 * reason with no wording gets a line that names the gap rather than the
 * nearest plausible sentence. That substitution is the defect this function
 * was extracted to end — the old code inferred the reason from the id and
 * told a curator that division 50 of Spoon River holds no text, when the
 * division holds text and the 37-word cut was the fault.
 *
 * scriptorium-gate.test.js asserts every member of the vocabulary reaches a
 * branch here, so a new refusal in the resolver fails the suite rather than
 * reaching a reader as an unexplained id.
 */
function unloadableReasonLines(id, extent, reason) {
  const whole = libraryExtentId(extent.workId, extent.division);
  switch (reason) {
    case LIBRARY_LOAD_REFUSAL.NO_BOUNDARY:
      return [
        `  The work is here and so is division ${extent.division}; an opening of about `
        + `${extent.words} words is not. An opening is cut at the nearest real boundary `
        + `and may run up to ${EXTENT_OVERSHOOT_LIMIT}× the length asked for — past that `
        + 'it is refused rather than quietly made longer.',
        `  Ask for a different length, or name "${whole}" to read that division whole.`
      ];
    case LIBRARY_LOAD_REFUSAL.FLOOR:
      return [
        `  It asks for an opening of fewer than ${EXTENT_MIN_WORDS} words, which is a `
        + 'fragment rather than an opening a reader could carry on from. The division '
        + 'itself is here and has text.',
        `  Ask for ${EXTENT_MIN_WORDS} or more, or name "${whole}" to read the division whole.`
      ];
    case LIBRARY_LOAD_REFUSAL.GRAMMAR:
      return [
        '  This is not a source id this reader can read, so it names no work.',
        '  A source is named one of three ways: the work ("work-id"), one of its '
        + 'divisions ("work-id#12"), or that division\'s opening at about a given '
        + 'length ("work-id#12:200"). Ordinals start at one and are written without '
        + 'leading zeros.'
      ];
    case LIBRARY_LOAD_REFUSAL.UNDIVIDED:
      return [
        '  The work is here and this edition of it is not divided, so it cannot serve '
        + `a division of itself.`,
        `  Drop the "#${extent.division}" to read "${extent.workId}" whole.`
      ];
    case LIBRARY_LOAD_REFUSAL.NO_DIVISION:
      return [
        `  The work is here; this edition has no division ${extent.division}.`,
        `  Name another division, or drop the "#${extent.division}" to read `
        + `"${extent.workId}" whole.`
      ];
    case LIBRARY_LOAD_REFUSAL.EMPTY_DIVISION:
      return [
        `  The work is here and so is division ${extent.division}; this edition yields `
        + 'no text for it.',
        `  Name another division, or drop the "#${extent.division}" to read `
        + `"${extent.workId}" whole.`
      ];
    case LIBRARY_LOAD_REFUSAL.EMPTY_WORK:
      return ['  This work is in the catalogue and this build holds no text for it.'];
    case LIBRARY_LOAD_REFUSAL.LOAD_FAILED:
      return ['  Reading this work\'s edition failed part way through, so nothing of it '
        + 'was taken.'];
    default:
      // NOT A GUESS. Naming the gap is worth more than a sentence that might
      // be false, and the suite fails on any reason that lands here.
      return [`  This build could not load it and has no account of why`
        + `${reason ? ` (${reason})` : ''}.`];
  }
}

/**
 * THE TRAILING `At:` NAMES A PLACE IN THE DOCUMENT THE READER PASTED.
 *
 * Exactly three families validate those bytes: `PROGRAM_IO_` and `PROGRAM_`
 * read an Experience Program, `AGENT_OP_` reads an operation set. Their paths
 * are places in something the reader wrote and can find.
 *
 * Every other family describes something built downstream — the project the
 * score would have become, an editor asset the producer assembled, a lane it
 * was handed to — and their paths are places in an object the reader never
 * saw. `At: $.sources` sent a curator looking for a field a score does not
 * have; `$.cueTemplate.kind` sent them looking for one no document has. This
 * was a single `!code.startsWith('WORKSHOP_PROJECT_')`, which fixed the
 * instance and left the shape, so the next family through leaked again.
 *
 * The code on the last line still says which refusal it was.
 */
const PASTED_DOCUMENT_FAMILIES = Object.freeze(['PROGRAM_IO_', 'PROGRAM_', 'AGENT_OP_']);

function namesThePastedDocument(code) {
  return PASTED_DOCUMENT_FAMILIES.some(prefix => code.startsWith(prefix));
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
  const path = error?.path && error.path !== '$' && namesThePastedDocument(code)
    ? error.path
    : '';
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
    /**
     * THE REPRISE, REFUSED IN WORDS RATHER THAN AS A VALIDATOR MESSAGE.
     *
     * Both doors onto this reach a reader now — the program validator's
     * string comparison, and the gate's canonical one, which is the only side
     * that can see `#12:79` and `#12` are one passage. Neither had a sentence,
     * so `reprise.json` came back as `Source sacred-tao-te-ching#1 belongs to
     * more than one movement ($.tracks)`: true, and it tells a composer
     * neither what a reprise costs nor what to do instead.
     *
     * The `details` are the gate's; the validator throws without them, and the
     * reply degrades to its own message rather than inventing two ids it does
     * not have.
     */
    case 'PROGRAM_SOURCE_OWNERSHIP':
    case 'PROGRAM_TRANSITION_SOURCE_DUPLICATE':
      lines.push(details.otherSourceId
        ? `"${details.sourceId}" and "${details.otherSourceId}" name the same passage`
          + `${details.canonicalId ? ` — both read ${details.canonicalId} entire` : ''}, `
          + 'and this score reads it twice.'
        : `${error.message}`);
      lines.push(
        'A reading returns to a passage by naming it once. Every source is loaded '
        + 'once and identified by its id, and every visual, audio and pace cue binds '
        + 'to that id — so a passage named twice is two loads of the same words with '
        + 'no way to tell one pass from the other, and it is charged to your length '
        + 'twice.',
        'Give each movement its own work, division or opening. To dwell on a passage, '
        + 'score it once and put the cues that change over it on the media lanes.'
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
    case 'PROGRAM_IO_UNKNOWN_DIVISION': {
      const work = (context?.library || []).find(item => item.id === details.workId);
      lines.push(
        `${work?.title || details.workId} has ${details.divisionCount} `
        + `${work?.divisions?.noun ? `${work.divisions.noun}s` : 'divisions'}, `
        + `and the score asks for number ${details.division}.`,
        `The work is here; that part of it is not. Name a division from 1 to `
        + `${details.divisionCount}, or drop the "#${details.division}" to read `
        + `${details.workId} whole.`
      );
      break;
    }
    case 'PROGRAM_IO_EXTENT_FLOOR':
      lines.push(
        `"${details.sourceId}" asks for a passage of fewer than `
        + `${details.minimumWords} words.`,
        `Below ${details.minimumWords} words a passage is a fragment rather than an `
        + 'opening a reader could carry on from, so it is refused rather than rounded up. '
        + `Ask for ${details.minimumWords} or more, or name `
        + `"${libraryExtentId(details.workId, details.division)}" to read the whole division `
        + '— which may itself be shorter than that, because a whole division is not a cut.'
      );
      break;
    case 'PROGRAM_IO_EXTENT_GRAMMAR':
      lines.push(
        `"${details.sourceId}" is not a source id this reader can read.`,
        'A source is named one of three ways: the work ("work-id"), one of its '
        + 'divisions ("work-id#12"), or that division\'s opening at about a given '
        + 'length ("work-id#12:200"). Ordinals start at one and are written '
        + 'without leading zeros — "#0040" is not corrected to "#40", because a '
        + 'gate that rewrote what it was handed would be editing your score.'
      );
      break;
    /**
     * WHAT ONLY THE TEXT COULD SETTLE, said once for both doors.
     *
     * Everything provable from the catalogue has already been refused above.
     * What is left is chiefly an opening whose first honest boundary lies past
     * the overshoot cap — a fact about where the sentences fall, which no
     * capability document knows. The reader is told that, rather than handed a
     * reading that quietly omits the work.
     */
    case 'PROGRAM_IO_LIBRARY_UNLOADABLE': {
      const titles = new Map((context?.library || []).map(work => [work.id, work.title]));
      lines.push(
        'This score names Library works that could not be loaded, so nothing was imported.',
        ''
      );
      for (const id of details.unreadable || []) {
        const extent = parseLibraryExtent(id);
        const named = titles.get(extent.workId) || extent.workId;
        // AN ID WHOSE GRAMMAR IS WRONG NAMES NO WORK, so it is not given one.
        // `sacred-tao-te-ching#0` used to be printed with its own broken id as
        // its title, above a sentence saying it is in the catalogue — it is
        // not a work, and it is not in the catalogue.
        lines.push(details.reasons?.[id] === LIBRARY_LOAD_REFUSAL.GRAMMAR
          ? `${id}`
          : `${id} — ${named}`);
        lines.push(...unloadableReasonLines(id, extent, details.reasons?.[id]));
        lines.push('');
      }
      for (const id of details.absent || []) {
        lines.push(`${id} — not on this build's shelf.`);
        options('works', [...titles.keys()]);
        lines.push('');
      }
      lines.push('Nothing was imported and nothing was changed. Correct or remove '
        + 'these ids and import again.');
      break;
    }
    /**
     * ONE VERDICT, BOTH DOORS. A score reaches this by naming no movement
     * source; an operation set reaches it by naming none — or by adding one
     * and then removing it again, which is what a model does when it changes
     * its mind mid-proposal and which used to arrive at "Ready to read." over
     * a project holding nothing.
     */
    case 'PROGRAM_IO_NO_LIBRARY_SOURCES':
      if (Array.isArray(details.added)) {
        lines.push(
          details.added.length
            ? `These operations add ${details.added.join(', ')} and then remove `
              + `${(details.removed || []).join(', ')}, so nothing is left to read.`
            : 'These operations name no source to read.',
          'An operation set is applied to an empty project here, so it has to '
          + 'bring its own text: add at least one work from the catalogue and '
          + 'leave it in.'
        );
        break;
      }
      lines.push(
        'The score names no Library sources to load.',
        'Every movement must name at least one work from the catalogue — this '
        + 'room composes from the Library and has no sources of its own to bind to.'
      );
      break;
    case 'PROGRAM_IO_EMPTY':
      lines.push('Nothing to examine — paste the score first.');
      break;
    case 'PROGRAM_IO_NOT_EXAMINED':
      lines.push(
        'No score has been examined, so there is nothing to read.',
        'A score passes the gate before its works are loaded.'
      );
      break;
    /**
     * "THIS" RATHER THAN "THE SCORE", because these five reach a reader
     * through two doors now and only one of them pasted a score. A curator who
     * sent an operation set and is told what "the score" names has been handed
     * a reply about a document they did not write.
     */
    case 'PROGRAM_IO_UNKNOWN_COLLECTION':
      lines.push(`This names collection "${details.collectionId}", which is not offered.`);
      options('collections', context?.visuals?.collections);
      break;
    case 'PROGRAM_IO_UNKNOWN_ENGINE':
      lines.push(`This names engine "${details.engineId}", which is not offered.`);
      options('engines', context?.visuals?.engines);
      break;
    case 'PROGRAM_IO_UNKNOWN_SOUNDSCAPE':
      lines.push(`This names soundscape "${details.soundscapeId}", which is not offered.`);
      options('soundscapes', context?.audio?.soundscapes);
      break;
    case 'PROGRAM_IO_UNKNOWN_TONE':
      lines.push(`This names tone "${details.presetId}", which is not offered.`);
      options('tones', context?.audio?.tones);
      break;
    /**
     * A SWELL IS THE READER'S OWN RECORDING, so the absence is about their
     * shelf and the reply says which shelf. It used to be answered by
     * FABRICATING an asset called "Personal audio" — a substitute offered
     * where an absence was required.
     */
    case 'PROGRAM_IO_UNKNOWN_SWELL':
      lines.push(
        `This names swell "${details.swellId}", which is not offered.`,
        'A swell is audio the reader added to this reading. One that is not on '
        + 'their shelf cannot be stood in for, so it is refused rather than '
        + 'played as something else.'
      );
      options('swells', context?.audio?.swells);
      break;
    /**
     * A VOICE THE DOCUMENT DID NOT DESCRIBE AND NEITHER DOOR CHECKED.
     *
     * The capability document carried no voice list at all, so a model could
     * not name a real one on purpose and every one it invented was admitted —
     * a narration cue on `voiceId: "no-such-voice"` persisted into the project
     * under "Nothing refused." The list exists now, and it is the voices that
     * are BUILT: an unbuilt one is silence wearing a name.
     */
    case 'PROGRAM_IO_UNKNOWN_VOICE':
      lines.push(
        `This names voice "${details.voiceId}", which is not offered.`,
        'Narration is spoken by a built recitation voice. A voice with no '
        + 'recordings behind it would be silence, so it is refused rather than '
        + 'played as nothing.'
      );
      options('voices', context?.audio?.voices);
      break;
    case 'PROGRAM_IO_UNKNOWN_SURFACE':
      lines.push(
        `This names field renderer "${details.renderer}", which is not offered.`,
        'A field is one of a closed set of renderers. Name one of these, or '
        + 'score a museum collection or a procedural pool instead.'
      );
      options('field renderers', context?.visuals?.surfaces);
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
      if (details.shape === 'fenced') {
        lines.push(
          'The document begins with a Markdown code fence (```), so it is not JSON yet.',
          'Send the JSON on its own — no ``` lines, no prose before or after it. '
          + 'The fence is not removed here: a doorway that edited what it was handed '
          + 'would be guessing at which part of it you meant.'
        );
      } else if (details.shape === 'truncated') {
        lines.push(
          'The document ends in the middle of itself — a brace, a bracket or a '
          + 'string is still open at the end of it.',
          'It looks cut off rather than mistyped, which usually means the reply hit '
          + 'a length limit. Ask for it again, or send a shorter score.'
        );
      } else {
        lines.push('The document is not valid JSON.', error.message);
      }
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
    case 'PROGRAM_IO_UNKNOWN_ASSET':
      lines.push(
        `This score requires ${details.assetRole === 'personal-focal' ? 'personal focal' : 'project media'} `
        + `asset "${details.assetId}", which this reading does not have.`,
        'Capability documents carry available asset ids, never the media bytes. '
        + 'Add the matching file to this project before importing the score, or '
        + 'replace the cue with a procedural engine or a museum collection.'
      );
      options('project media', (context?.visuals?.collections || [])
        .filter(id => id.startsWith(SEQUENCE_ASSET_PREFIX))
        .map(id => id.slice(SEQUENCE_ASSET_PREFIX.length)));
      break;
    case 'VISUAL_SCORE_ASSET_NOT_FOUND':
      lines.push(
        `${error.message}`,
        'The required project file is missing or incompatible — a video clip '
        + 'needs a video file (MP4), while a focal or sequence image needs an image.'
      );
      break;
    /**
     * "ABOUT", BECAUSE THE NUMBER IS NOW AN ESTIMATE OF THE READING RATHER
     * THAN A CEILING OVER IT.
     *
     * This said "This score reads 5,200 words", and "reads" was the charged
     * figure — `extentReadingBound`, the most every cut could be handed. For a
     * score of whole works the two coincide and the sentence was true; for a
     * score of openings it over-stated the reading by half, so a curator who
     * cut a movement to obey it cut more than they needed to. The total is
     * what the extents NAME now, which is exact for a whole work or a whole
     * division and is the nearest boundary to the ask for an opening — hence
     * "about", which is the honest word for a length nobody can know before
     * the text is cut.
     */
    case 'PROGRAM_IO_BUDGET_EXCEEDED': {
      lines.push(
        `This score reads about ${Number(details.total).toLocaleString()} words. `
        + `You asked for ${Number(details.budget).toLocaleString()}.`,
        '',
        // NOT "its movements name". The budget counts every source the score
        // will load, which is what the resolver loads — a transition clip
        // carries source ids of its own, and while this said "movements" it
        // was both the wrong word and the wrong sum.
        'It names:'
      );
      for (const entry of (details.sources || []).slice(0, 8)) {
        lines.push(`  ${entry.sourceId} — ${Number(entry.words).toLocaleString()} words`);
      }
      lines.push(
        '',
        'A whole work or a whole division is read entire; an opening is cut at the '
        + `nearest real boundary and may run up to ${EXTENT_OVERSHOOT_LIMIT}× what it `
        + 'asks for. The ways down are to name fewer works, name shorter ones, ask for '
        + 'shorter openings, or raise the length before exporting again.'
      );
      break;
    }
    /**
     * A SESSION HOLDS A NUMBER OF WORKS AS WELL AS A NUMBER OF WORDS, and
     * these are two refusals rather than one with a branch in it.
     *
     * They shared PROGRAM_IO_ATOM_CEILING for a pass, told apart by whether
     * `details.maxSources` was an integer. A reply that has to inspect the
     * details to know what it is about is a reply for two things, and the
     * exit status a script reads could not tell them apart at all.
     */
    case 'PROGRAM_IO_SOURCE_CEILING':
      lines.push(
        `This score names ${Number(details.count).toLocaleString()} sources. `
        + `One reading holds ${Number(details.maxSources).toLocaleString()}.`,
        '',
        'Every source a score names is loaded and held for the whole session. '
        + 'Name fewer works — or, where the score names several parts of one work '
        + 'in a row, name the work itself, which is one source rather than many.'
      );
      break;
    case 'PROGRAM_IO_ATOM_CEILING': {
      lines.push(
        `This score reads ${details.atLeast ? 'at least ' : ''}`
        + `${Number(details.total).toLocaleString()} words. One session `
        + `holds ${Number(details.maxWords).toLocaleString()} at the most.`,
        '',
        `It names${details.atLeast ? ', of the sources that carry a length' : ''}:`
      );
      for (const entry of (details.sources || []).slice(0, 8)) {
        lines.push(`  ${entry.sourceId} — ${Number(entry.words).toLocaleString()} words`);
      }
      lines.push(
        '',
        `A reading is cut into at most ${Number(details.maxAtoms).toLocaleString()} atoms, and `
        + 'a paragraph costs one atom of its own on top of its words — so the word ceiling '
        + 'sits below the atom ceiling. Name fewer works, name shorter ones, or read a '
        + 'division rather than a whole book.'
      );
      break;
    }
    /**
     * A WHOLE FAMILY THAT REACHED READERS AS RAW EXCEPTIONS.
     *
     * Nothing at the gate counted sources, so 65 chapters of the Tao — 8,456
     * words against a 20,000 budget — passed `examine` and threw at the
     * reading. What landed in the copyable-refusal panel was
     * `A Workshop project accepts at most 64 sources ($.sources)`: a JSON
     * path and an internal schema name, in a room whose §10b ruling is that
     * the reader never passes through the Workshop.
     *
     * The gate now refuses each of these before a project is built, so these
     * wordings are the backstop rather than the road. They are here anyway,
     * because the alternative to a wording is an exception, and an exception
     * is what the reader was getting.
     */
    case 'WORKSHOP_PROJECT_SOURCES':
      lines.push(
        `This score names more sources than one reading holds.`,
        'Name fewer works, or name a division of one where the score names several.'
      );
      break;
    case 'WORKSHOP_PROJECT_TOTAL_TEXT':
      lines.push(
        'The works this score names hold more text together than one reading can carry.',
        'Name fewer works, name shorter ones, or read a division rather than a whole book.'
      );
      break;
    case 'WORKSHOP_PROJECT_SOURCE_TEXT':
      lines.push(
        'One of the works this score names holds no text, or more text than a single '
        + 'source may carry.',
        'Read a division of it rather than the whole work.'
      );
      break;
    case 'WORKSHOP_PROJECT_DUPLICATE_SOURCE':
      lines.push(
        'This score names the same source twice.',
        'A source is loaded once and read once; give each movement its own work or '
        + 'its own division.'
      );
      break;
    case 'WORKSHOP_PROJECT_ASSETS':
    case 'WORKSHOP_PROJECT_INLINE_TOO_LARGE':
      lines.push(
        `${error.message}`,
        'This reading carries more of your own files than one session holds. Remove '
        + 'some before importing the score.'
      );
      break;
    case 'WORKSHOP_PROJECT_SCHEMA':
    case 'WORKSHOP_PROJECT_RECORD':
    case 'WORKSHOP_PROJECT_ID':
      lines.push(
        `${error.message}`,
        'The reading this score would become could not be assembled. Nothing was '
        + 'imported and nothing was changed.'
      );
      break;
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
    case 'AGENT_OP_STALE_REVISION':
      lines.push(
        `This proposal was built on project revision ${details.expected}, but the project is now at ${details.actual}.`,
        'Export a fresh context from the current revision, or discard the stale operations.'
      );
      break;
    case 'AGENT_OP_CANCELLED':
    case 'AGENT_OP_STALE_GENERATION':
      lines.push(
        'This agent run was cancelled or superseded. Late results cannot apply.',
        'Start a new run against the current project revision.'
      );
      break;
    case 'AGENT_OP_NO_WORKSHOP_EQUIVALENT':
      lines.push(
        `${error.message}`,
        'An agent may only propose commands a person can already perform in the Workshop.'
      );
      break;
    case 'AGENT_OP_URI':
      lines.push(
        'An operation named a URI. Operations name ids only — no data:, blob: or http(s) values.'
      );
      break;
    case 'AGENT_OP_UNKNOWN':
      lines.push(
        `${error.message}`,
        'Use only the closed operation vocabulary from the prompt.'
      );
      break;
    case 'AGENT_OP_DIVISION':
      lines.push(
        `${error.message}`,
        'A source id carries its own extent everywhere it appears, so the same '
        + 'operation reads the same words on any day: "work-id" for the whole work, '
        + '"work-id#12" for one division, "work-id#12:200" for that division\'s '
        + 'opening at about two hundred words.'
      );
      break;
    case 'AGENT_OP_ASSET':
    case 'AGENT_OP_SURFACE':
      lines.push(
        `${error.message}`,
        'An operation names imagery and audio by the ids the capability '
        + 'document offers: a museum set as "collection:<id>" or "aic-<id>", a '
        + 'generated field as "procedural:<pool>", a bed as "soundscape:<id>" '
        + 'or "tone:<id>", the reader\'s own recording as "swell:<id>".'
      );
      break;
    /**
     * ONE LANE PRESENTS ONE THING AT A TIME, said the same way in both lanes.
     *
     * The visual lane's overlap has had a wording and a status (50) since this
     * doorway existed; the audio lane's had neither, so the commonest scoring
     * mistake there is arrived as a bare exception under a status that says
     * RISE is broken.
     */
    case 'AUDIO_SCORE_OVERLAP':
    case 'NARRATION_SCORE_OVERLAP':
      lines.push(
        `${error.message}`,
        'One lane presents one thing at a time. Give the two clips ranges that '
        + 'do not intersect (ranges are half-open, so `to` may equal the next '
        + '`from`), or drop one of them.'
      );
      break;
    /**
     * THE CAPABILITY DOCUMENT ITSELF. §13 gives it status 24 and nothing here
     * had a sentence for it, so `--id "http://example.com/x"` left the process
     * as a stack trace rather than as a refusal.
     */
    case 'CURATOR_CONTEXT_URI_REFUSED':
    case 'CURATOR_CONTEXT_ID':
    case 'CURATOR_CONTEXT_ID_TOO_LONG':
      lines.push(
        `${error.message}`,
        'The capability document names what may be composed with, by id, and an '
        + 'id is a plain name — never a URI. The document could not be built, so '
        + 'nothing was examined against it.'
      );
      break;
    case 'AGENT_OP_SOURCE':
    case 'AGENT_OP_SOURCE_UNRESOLVED':
      lines.push(
        `${error.message}`,
        'Name a library work or already-loaded source from the companion context, and resolve its text before applying a span.'
      );
      options('sources', [
        ...(context?.sources || []).map(item => item.id),
        ...(context?.library || []).map(item => item.id)
      ]);
      break;
    case 'ACQUISITION_CONSENT_REQUIRED':
      lines.push(
        'Generated media needs explicit consent and a cost acknowledgement before a generator may run.',
        'A candidate is not an asset; scoring it now would bypass admission.'
      );
      break;
    case 'ACQUISITION_KIND_DEFERRED':
      lines.push(
        `${error.message}`,
        'Audio and video wait on media-specific checks. Request an image, a document, or an already-admitted asset.'
      );
      break;
    case 'ACQUISITION_TEXT_CLEANSING':
      lines.push(
        'This edition fails Archive identity or cleansing checks.',
        'A variorum apparatus, a bad scan, or a missing title/author/edition cannot enter as a source.'
      );
      break;
    case 'NARRATION_DUCK_TARGET':
    case 'NARRATION_NOT_VOICE':
    case 'NARRATION_KIND':
    case 'NARRATION_SCORE_NOT_VOICE':
      lines.push(
        `${error.message}`,
        'Narration is a spoken lane. It may duck the bed; it cannot become atmosphere or a swell.'
      );
      break;
    case 'PUBLICATION_HUMAN_REQUIRED':
    case 'PUBLICATION_WATCH_REQUIRED':
      lines.push(
        `${error.message}`,
        'A person must watch the hashed artifact and approve it. The agent cannot publish.'
      );
      break;
    case 'PUBLICATION_RIGHTS_UNRESOLVED':
      lines.push(
        'Unresolved or private-review rights cannot approve a public destination.',
        'Keep the package for private review, or resolve each named asset before asking again.'
      );
      break;
    case 'PUBLICATION_NOT_APPROVED':
    case 'PUBLICATION_SCHEDULED':
    case 'PUBLICATION_CREDENTIALS':
    case 'PUBLICATION_ARTIFACT':
      lines.push(
        `${error.message}`,
        'Publication is a human decision over one hashed artifact. Rendering does not post.'
      );
      break;
    case 'PRODUCER_NO_SCORE':
    case 'PRODUCER_PROFILE':
      lines.push(
        `${error.message}`,
        'The producer compiles a private review from a finished score. It cannot admit or publish.'
      );
      break;
    case 'PUBLICATION_POLICY_HUMAN_REQUIRED':
    case 'PUBLICATION_ACCOUNTABLE':
      lines.push(
        `${error.message}`,
        'A named person adopts the channel and remains accountable. The agent cannot.'
      );
      break;
    case 'PUBLICATION_EMERGENCY_STOP':
      lines.push(
        `${error.message}`,
        'Clear the stop only after a person has reviewed the channel.'
      );
      break;
    case 'PUBLICATION_FREQUENCY':
    case 'PUBLICATION_COST':
      lines.push(
        `${error.message}`,
        'The channel has a daily ceiling. Wait, or raise it as a person.'
      );
      break;
    case 'PUBLICATION_ESCALATE':
    case 'PUBLICATION_RIGHTS_WITHDRAWN':
    case 'PUBLICATION_CUSTODY':
    case 'PUBLICATION_POLICY_PROFILE':
      lines.push(
        `${error.message}`,
        'Automation may retry an approved artifact; it cannot waive review, rights, or custody.'
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
