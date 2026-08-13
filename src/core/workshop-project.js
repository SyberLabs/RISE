import { validateExperienceProgram } from './experience-program.js';
import { READING_LIMITS } from './reading-limits.js';
import {
  compileVisualScoreProgram,
  createSequenceVisualAsset,
  scoreAssetIdFromCue,
  sequenceAssetForPersistence,
  validateSequenceAssetReferences
} from './visual-score-lane.js';
import { visualFallbackCueFromConfig } from './visual-program.js';
import { compileWorkshopScoreProgram } from './audio-score-lane.js';
import { audioScoreAssetFromId } from './workshop-audio.js';

export const WORKSHOP_PROJECT_SCHEMA = 'rise.workshop-project.v1';

export const WORKSHOP_PROJECT_LIMITS = Object.freeze({
  maxSources: READING_LIMITS.maxSources,
  maxAssets: READING_LIMITS.maxSequenceAssets,
  maxSourceCharacters: READING_LIMITS.maxTextCharacters,
  maxTotalCharacters: READING_LIMITS.maxTotalChars,
  maxTitleLength: 200,
  maxIdLength: 160
});

const CHUNK_MODES = new Set(['word', 'phrase', 'sentence']);
const CURVES = new Set(['flat', 'induction', 'ascent', 'wave', 'climax']);
const VISUAL_SURFACES = new Set(['off', 'focal', 'attractor', 'genesis', 'scored']);

export class WorkshopProjectError extends Error {
  constructor(code, message, path = '$', details = {}) {
    super(`${message} (${path})`);
    this.name = 'WorkshopProjectError';
    this.code = code;
    this.path = path;
    this.details = details;
  }
}

const fail = (code, message, path, details) => {
  throw new WorkshopProjectError(code, message, path, details);
};

function record(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('WORKSHOP_PROJECT_RECORD', 'Expected an object', path);
  }
  return value;
}

function exactId(value, path) {
  if (typeof value !== 'string' || !value || value !== value.trim()
    || value.length > WORKSHOP_PROJECT_LIMITS.maxIdLength) {
    fail('WORKSHOP_PROJECT_ID', 'Expected a non-empty, trimmed id', path);
  }
  return value;
}

function text(value, fallback = '', max = WORKSHOP_PROJECT_LIMITS.maxTitleLength) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().slice(0, max);
  return normalized || fallback;
}

function plainClone(value, depth = 0) {
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (depth >= 5) return undefined;
  if (Array.isArray(value)) {
    return value.slice(0, 256)
      .map(item => plainClone(item, depth + 1))
      .filter(item => item !== undefined);
  }
  if (typeof value !== 'object') return undefined;
  const out = {};
  for (const [key, item] of Object.entries(value).slice(0, 128)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
    const cloned = plainClone(item, depth + 1);
    if (cloned !== undefined) out[key] = cloned;
  }
  return out;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function normalizeSource(value, index, path) {
  const source = record(value, path);
  const raw = typeof source.data === 'string'
    ? source.data
    : (typeof source.raw === 'string' ? source.raw : '');
  if (!raw || raw.length > WORKSHOP_PROJECT_LIMITS.maxSourceCharacters) {
    fail('WORKSHOP_PROJECT_SOURCE_TEXT',
      `Source text must contain 1–${WORKSHOP_PROJECT_LIMITS.maxSourceCharacters} characters`,
      `${path}.data`);
  }
  const id = source.id == null ? `legacy-source-${index + 1}` : exactId(source.id, `${path}.id`);
  const words = raw.split(/\s+/u).filter(Boolean).length;
  const normalized = {
    id,
    name: text(source.name, `Source ${index + 1}`),
    providerId: text(source.providerId, 'local', 120),
    type: text(source.type, 'text/plain', 120),
    words,
    data: raw
  };
  const metadata = plainClone(source.metadata);
  const provenance = plainClone(source.provenance);
  if (metadata && Object.keys(metadata).length) normalized.metadata = metadata;
  if (provenance && Object.keys(provenance).length) normalized.provenance = provenance;
  return normalized;
}

function normalizeSources(value, path = '$.sources') {
  if (!Array.isArray(value) || value.length > WORKSHOP_PROJECT_LIMITS.maxSources) {
    fail('WORKSHOP_PROJECT_SOURCES',
      `A Workshop project accepts at most ${WORKSHOP_PROJECT_LIMITS.maxSources} sources`, path);
  }
  const sources = value.map((source, index) => normalizeSource(source, index, `${path}[${index}]`));
  if (new Set(sources.map(source => source.id)).size !== sources.length) {
    fail('WORKSHOP_PROJECT_DUPLICATE_SOURCE', 'Source ids must be unique', path);
  }
  const totalChars = sources.reduce((sum, source) => sum + source.data.length, 0);
  if (totalChars > WORKSHOP_PROJECT_LIMITS.maxTotalCharacters) {
    fail('WORKSHOP_PROJECT_TOTAL_TEXT',
      `Workshop sources may not exceed ${WORKSHOP_PROJECT_LIMITS.maxTotalCharacters} characters combined`,
      path,
      { totalChars, maxTotalCharacters: WORKSHOP_PROJECT_LIMITS.maxTotalCharacters });
  }
  return sources;
}

function normalizeAssets(value, path = '$.assets') {
  if (!Array.isArray(value) || value.length > WORKSHOP_PROJECT_LIMITS.maxAssets) {
    fail('WORKSHOP_PROJECT_ASSETS',
      `A Workshop project accepts at most ${WORKSHOP_PROJECT_LIMITS.maxAssets} local assets`, path);
  }
  const assets = value.map((raw, index) => {
    const asset = sequenceAssetForPersistence(createSequenceVisualAsset(raw));
    // Tiny inline fixtures remain legal for tests and legacy migration input.
    // Anything approaching localStorage pressure must go through IndexedDB.
    if (asset.storage === 'inline'
      && typeof asset.uri === 'string'
      && asset.uri.length > READING_LIMITS.maxInlineProjectImageUriChars) {
      fail('WORKSHOP_PROJECT_INLINE_TOO_LARGE',
        `Sequence images larger than ${
          READING_LIMITS.maxInlineProjectImageUriChars / 1024
        } KiB must use durable Workshop media storage`,
        `${path}[${index}]`,
        { id: asset.id, uriLength: asset.uri.length });
    }
    return asset;
  });
  if (new Set(assets.map(asset => asset.id)).size !== assets.length) {
    fail('WORKSHOP_PROJECT_DUPLICATE_ASSET', 'Project asset ids must be unique', path);
  }
  return assets;
}

function normalizeReading(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const numericWpm = Number(input.wpm);
  return {
    wpm: Number.isFinite(numericWpm) ? Math.max(100, Math.min(500, Math.round(numericWpm))) : 200,
    chunkMode: CHUNK_MODES.has(input.chunkMode) ? input.chunkMode : 'word',
    curve: CURVES.has(input.curve) ? input.curve : 'flat',
    displayMode: text(input.displayMode, 'focal', 40)
  };
}

function surfaceFromMode(mode) {
  if (mode === 'focals') return 'focal';
  if (mode === 'interlocution') return 'scored';
  return VISUAL_SURFACES.has(mode) ? mode : 'off';
}

function modeFromSurface(surface) {
  if (surface === 'focal') return 'focals';
  if (surface === 'scored') return 'interlocution';
  return VISUAL_SURFACES.has(surface) ? surface : 'off';
}

function normalizeVisual(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const config = plainClone(input.config) || {};
  // Object URLs belong to a single document lifetime. A personal focal is
  // persisted by its project asset id and rehydrated at authoring/launch.
  if (typeof config.focals?.personalAssetId === 'string') {
    config.focals.personalImage = null;
  }
  const surface = VISUAL_SURFACES.has(input.surface)
    ? input.surface
    : surfaceFromMode(config.visualMode);
  config.visualMode = modeFromSurface(surface);
  return { surface, config };
}

function normalizeAudio(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    soundscape: text(input.soundscape, 'none', 80),
    audioPreset: text(input.audioPreset, 'silent', 80),
    selectedSwellId: typeof input.selectedSwellId === 'string'
      ? input.selectedSwellId.slice(0, WORKSHOP_PROJECT_LIMITS.maxIdLength)
      : null
  };
}

function normalizeDefaults(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    reading: normalizeReading(input.reading),
    visual: normalizeVisual(input.visual),
    audio: normalizeAudio(input.audio),
    projection: input.projection === 'page' ? 'page' : 'stream',
    recitation: { enabled: input.recitation?.enabled === true },
    voiceId: typeof input.voiceId === 'string' ? input.voiceId.slice(0, 160) : null,
    render: {
      profileId: typeof input.render?.profileId === 'string' && input.render.profileId.trim()
        ? input.render.profileId.trim().slice(0, 80)
        : null
    }
  };
}

function validateProgram(value) {
  return value == null ? null : validateExperienceProgram(value);
}

export function isWorkshopProject(value) {
  return value?.schema === WORKSHOP_PROJECT_SCHEMA;
}

export function validateWorkshopProject(value) {
  const input = record(value, '$');
  if (input.schema !== WORKSHOP_PROJECT_SCHEMA) {
    fail('WORKSHOP_PROJECT_SCHEMA', `Expected ${WORKSHOP_PROJECT_SCHEMA}`, '$.schema');
  }
  const sources = normalizeSources(input.sources);
  const assets = normalizeAssets(input.assets);
  const experienceProgram = validateProgram(input.experienceProgram);
  validateSequenceAssetReferences(experienceProgram, assets);
  const project = {
    schema: WORKSHOP_PROJECT_SCHEMA,
    id: exactId(input.id, '$.id'),
    title: text(input.title, '', WORKSHOP_PROJECT_LIMITS.maxTitleLength),
    intent: text(input.intent, 'custom', 80),
    sources,
    assets,
    experienceProgram,
    defaults: normalizeDefaults(input.defaults),
    provenance: plainClone(input.provenance) || {},
    paceV2: true,
    revision: Number.isInteger(input.revision) && input.revision >= 0
      ? input.revision
      : 0,
    updatedAt: Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : 0
  };
  return deepFreeze(project);
}

/** A blank Workshop project an agent operation set may revise from revision 0. */
export function emptyWorkshopProject({
  id = 'project-draft',
  title = '',
  intent = 'custom'
} = {}) {
  return validateWorkshopProject({
    schema: WORKSHOP_PROJECT_SCHEMA,
    id,
    title,
    intent,
    sources: [],
    assets: [],
    experienceProgram: null,
    defaults: {},
    revision: 0,
    updatedAt: 0
  });
}

function migratedWpm(blueprint) {
  const raw = Number(blueprint.wpm);
  const wpm = Number.isFinite(raw) ? raw : 200;
  if (blueprint.paceV2 === true) return wpm;
  return Math.max(100, Math.min(500, Math.round((wpm * 1.4375) / 10) * 10));
}

function legacyAssets(blueprint) {
  if (Array.isArray(blueprint.sequenceVisualAssets)) return blueprint.sequenceVisualAssets;
  return (Array.isArray(blueprint.customVisuals) ? blueprint.customVisuals : [])
    .map((uri, index) => ({
      id: `legacy-asset-${index + 1}`,
      uri,
      name: `Sequence image ${index + 1}`
    }));
}

function programFromLegacy(blueprint, sources, assets, visualConfig = {}) {
  if (blueprint.experienceProgram) return blueprint.experienceProgram;
  const visualAssignments = Array.isArray(blueprint.visualScoreAssignments)
    ? blueprint.visualScoreAssignments : [];
  const audioAssignments = Array.isArray(blueprint.audioScoreAssignments)
    ? blueprint.audioScoreAssignments : [];
  if (!visualAssignments.length && !audioAssignments.length) return null;
  if (!audioAssignments.length) return compileVisualScoreProgram({
    programId: typeof blueprint.experienceProgramId === 'string'
      ? blueprint.experienceProgramId
      : `workshop-${exactId(blueprint.id, '$.id')}`,
    sources: sources.map(source => ({ id: source.id, name: source.name, text: source.data })),
    assets,
    assignments: visualAssignments,
    visualFallback: visualFallbackCueFromConfig(visualConfig)
  });
  const audioAssets = [...new Set(audioAssignments.map(item => item.assetId))]
    .map(audioScoreAssetFromId).filter(Boolean);
  return compileWorkshopScoreProgram({
    programId: typeof blueprint.experienceProgramId === 'string'
      ? blueprint.experienceProgramId
      : `workshop-${exactId(blueprint.id, '$.id')}`,
    sources: sources.map(source => ({ id: source.id, name: source.name, text: source.data })),
    visualAssets: assets,
    visualAssignments,
    audioAssets,
    audioAssignments,
    visualFallback: visualFallbackCueFromConfig(visualConfig)
  });
}

export function migrateWorkshopBlueprint(value) {
  if (isWorkshopProject(value)) return validateWorkshopProject(value);
  const legacy = record(value, '$');
  const sources = normalizeSources(Array.isArray(legacy.sources) ? legacy.sources : []);
  const assets = normalizeAssets(legacyAssets(legacy));
  const visualConfig = plainClone(legacy.visualConfig) || { visualMode: 'off' };
  const project = {
    schema: WORKSHOP_PROJECT_SCHEMA,
    id: exactId(legacy.id, '$.id'),
    title: text(legacy.title, '', WORKSHOP_PROJECT_LIMITS.maxTitleLength),
    intent: text(legacy.intent, 'custom', 80),
    sources,
    assets,
    experienceProgram: programFromLegacy(legacy, sources, assets, visualConfig),
    defaults: {
      reading: {
        wpm: migratedWpm(legacy),
        chunkMode: legacy.chunkMode,
        curve: legacy.curve,
        displayMode: legacy.displayMode
      },
      visual: {
        surface: surfaceFromMode(visualConfig.visualMode),
        config: visualConfig
      },
      audio: {
        soundscape: legacy.soundscape,
        audioPreset: legacy.audioPreset,
        selectedSwellId: legacy.selectedSwellId
      },
      projection: legacy.projection,
      recitation: legacy.recitation,
      voiceId: legacy.voiceId
    },
    provenance: plainClone(legacy.provenance) || {},
    paceV2: true,
    updatedAt: legacy.updatedAt
  };
  return validateWorkshopProject(project);
}

export function visualAssignmentsFromProgram(program) {
  if (!program) return [];
  const canonical = validateExperienceProgram(program);
  const visual = canonical.tracks.find(track => track.kind === 'visual');
  if (!visual) return [];
  return visual.clips.flatMap(clip => {
    if (clip.anchor.fromCharacter === undefined) return [];
    const assetId = scoreAssetIdFromCue(clip.cue);
    if (!assetId) return [];
    return [{
      id: clip.id,
      sourceId: clip.anchor.sourceIds[0],
      assetId,
      fromCharacter: clip.anchor.fromCharacter,
      toCharacter: clip.anchor.toCharacter,
      quoteStart: clip.anchor.quoteStart,
      quoteEnd: clip.anchor.quoteEnd,
      ...(['field', 'procedural'].includes(clip.cue.kind) && clip.cue.config
        ? { cue: clip.cue }
        : clip.cue.kind === 'field' ? { cue: clip.cue } : {})
    }];
  });
}

export function audioAssignmentsFromProgram(program) {
  if (!program) return [];
  const canonical = validateExperienceProgram(program);
  return canonical.tracks
    .filter(track => track.kind === 'audio' || track.kind === 'swell')
    .flatMap(track => track.clips.flatMap(clip => {
      if (clip.anchor.fromCharacter === undefined) return [];
      const assetId = clip.cue.kind === 'soundscape'
        ? `soundscape:${clip.cue.soundscapeId}`
        : clip.cue.kind === 'tone'
          ? `tone:${clip.cue.presetId}`
          : clip.cue.kind === 'silence'
            ? 'tone:silent'
            : clip.cue.kind === 'swell'
              ? `swell:${clip.cue.swellId}` : null;
      if (!assetId) return [];
      return [{
        id: clip.id,
        sourceId: clip.anchor.sourceIds[0],
        assetId,
        lane: track.kind === 'swell' ? 'swell' : 'audio',
        fromCharacter: clip.anchor.fromCharacter,
        toCharacter: clip.anchor.toCharacter,
        quoteStart: clip.anchor.quoteStart,
        quoteEnd: clip.anchor.quoteEnd,
        ...(clip.syncGroup ? { syncGroup: clip.syncGroup } : {})
      }];
    }));
}

export function workshopProjectToSessionConfig(value) {
  const project = isWorkshopProject(value)
    ? validateWorkshopProject(value)
    : migrateWorkshopBlueprint(value);
  const reading = project.defaults.reading;
  const audio = project.defaults.audio;
  const visualConfig = plainClone(project.defaults.visual.config);
  visualConfig.visualMode = modeFromSurface(project.defaults.visual.surface);
  return {
    id: project.id,
    title: project.title,
    intent: project.intent,
    sources: plainClone(project.sources),
    wpm: reading.wpm,
    curve: reading.curve,
    chunkMode: reading.chunkMode,
    displayMode: reading.displayMode,
    visualConfig,
    soundscape: audio.soundscape,
    audioPreset: audio.audioPreset,
    selectedSwellId: audio.selectedSwellId,
    projection: project.defaults.projection,
    recitation: plainClone(project.defaults.recitation),
    voiceId: project.defaults.voiceId,
    customVisuals: project.assets
      .filter(asset => asset.kind !== 'video')
      .map(asset => asset.uri)
      .filter(uri => typeof uri === 'string'
        && (uri.startsWith('data:image/') || uri.startsWith('blob:'))),
    sequenceVisualAssets: plainClone(project.assets),
    visualScoreAssignments: visualAssignmentsFromProgram(project.experienceProgram),
    audioScoreAssignments: audioAssignmentsFromProgram(project.experienceProgram),
    experienceProgram: project.experienceProgram,
    experienceProgramId: project.experienceProgram?.id || `workshop-${project.id}`,
    provenance: plainClone(project.provenance),
    paceV2: true,
    revision: project.revision,
    updatedAt: project.updatedAt
  };
}

/** A compatibility read model; never write this projection to storage. */
export function workshopProjectToBlueprintView(value) {
  const project = isWorkshopProject(value)
    ? validateWorkshopProject(value)
    : migrateWorkshopBlueprint(value);
  return {
    ...workshopProjectToSessionConfig(project),
    schema: project.schema,
    defaults: project.defaults,
    assets: project.assets,
    project
  };
}

/** Serialize the current flat Workshop editor projection into the v1 boundary. */
export function workshopEditorDataToProject(value, { id, updatedAt = 0 } = {}) {
  const editor = record(value, '$');
  const projectId = id || editor.id;
  const sources = normalizeSources(Array.isArray(editor.sources) ? editor.sources : []);
  const assets = normalizeAssets(legacyAssets(editor));
  const experienceProgram = programFromLegacy({ ...editor, id: projectId }, sources, assets);
  return validateWorkshopProject({
    schema: WORKSHOP_PROJECT_SCHEMA,
    id: exactId(projectId, '$.id'),
    title: editor.title,
    intent: editor.intent,
    sources,
    assets,
    experienceProgram,
    defaults: {
      reading: {
        wpm: editor.wpm,
        curve: editor.curve,
        chunkMode: editor.chunkMode,
        displayMode: editor.displayMode
      },
      visual: {
        surface: surfaceFromMode(editor.visualConfig?.visualMode),
        config: editor.visualConfig
      },
      audio: {
        soundscape: editor.soundscape,
        audioPreset: editor.audioPreset,
        selectedSwellId: editor.selectedSwellId
      },
      projection: editor.projection,
      recitation: editor.recitation,
      voiceId: editor.voiceId
    },
    provenance: editor.provenance,
    paceV2: true,
    revision: editor.revision,
    updatedAt
  });
}
