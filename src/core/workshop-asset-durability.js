/**
 * Workshop asset durability helpers — migrate inline data URIs into IndexedDB
 * and hydrate idb metadata into runtime URIs for Session / cortex / Workshop UI.
 */

import {
  assetIdFromCollection,
  createSequenceVisualAsset,
  SEQUENCE_ASSET_STORAGE_IDB,
  SEQUENCE_ASSET_STORAGE_INLINE,
  sequenceAssetForPersistence,
  sequenceAssetHasUri
} from './visual-score-lane.js';
import {
  dataImageUriToBlob,
  WorkshopMedia,
  WorkshopMediaError
} from './workshop-media.js';
import {
  audioAssignmentsFromProgram,
  isWorkshopProject,
  validateWorkshopProject,
  visualAssignmentsFromProgram
} from './workshop-project.js';
import { personalFocalAssetIdFromCue } from './visual-style-definitions.js';

function resolvePersonalFocal(visualConfig, assets = []) {
  const config = visualConfig && typeof visualConfig === 'object'
    ? visualConfig
    : {};
  const focals = config.focals && typeof config.focals === 'object'
    ? config.focals
    : {};
  const assetId = typeof focals.personalAssetId === 'string'
    ? focals.personalAssetId
    : null;
  if (!assetId) return config;
  const asset = assets.find(item => item.id === assetId && item.kind !== 'video' && item.uri);
  return {
    ...config,
    focals: asset
      ? { ...focals, type: 'personal', personalImage: asset.uri }
      : {
          ...focals,
          type: 'standard',
          standardGlyph: focals.standardGlyph || 'breath',
          personalImage: null
        }
  };
}

/**
 * Ensure every asset's bytes are in IndexedDB and return persistence-safe
 * metadata (no transient blob:/data: URIs on idb assets).
 *
 * @param {string} projectId
 * @param {object[]} assets
 * @param {Map<string, Blob>|Record<string, Blob>|null} pendingBlobs
 */
export async function ensureWorkshopAssetsDurable(projectId, assets = [], pendingBlobs = null) {
  const pending = pendingBlobs instanceof Map
    ? pendingBlobs
    : new Map(Object.entries(pendingBlobs || {}));
  const durable = [];

  for (const raw of assets) {
    const asset = createSequenceVisualAsset(raw);
    const pendingBlob = pending.get(asset.id);

    if (pendingBlob) {
      const meta = await WorkshopMedia.put({
        id: asset.id,
        projectId,
        data: pendingBlob,
        mimeType: pendingBlob.type || asset.mimeType
      });
      durable.push(sequenceAssetForPersistence(createSequenceVisualAsset({
        id: asset.id,
        name: asset.name,
        color: asset.color,
        provenance: asset.provenance,
        ...(asset.kind === 'video' ? {
          kind: 'video', durationMs: asset.durationMs, audioPolicy: 'muted',
          timeMode: asset.timeMode, posterAssetId: asset.posterAssetId
        } : {}),
        storage: SEQUENCE_ASSET_STORAGE_IDB,
        mimeType: meta.mimeType,
        byteLength: meta.byteLength
      })));
      continue;
    }

    if (asset.storage === SEQUENCE_ASSET_STORAGE_INLINE && asset.uri?.startsWith('data:image/')) {
      const blob = dataImageUriToBlob(asset.uri);
      const meta = await WorkshopMedia.put({
        id: asset.id,
        projectId,
        data: blob,
        mimeType: blob.type
      });
      durable.push(sequenceAssetForPersistence(createSequenceVisualAsset({
        id: asset.id,
        name: asset.name,
        color: asset.color,
        provenance: asset.provenance,
        storage: SEQUENCE_ASSET_STORAGE_IDB,
        mimeType: meta.mimeType,
        byteLength: meta.byteLength
      })));
      continue;
    }

    if (asset.storage === SEQUENCE_ASSET_STORAGE_IDB) {
      // Missing blob must not block save — keep the reference so the
      // editor can flag it; hydration handles absence.
      if (!(await WorkshopMedia.has(asset.id).catch(() => false))) {
        console.warn(`[WorkshopMedia] bytes missing for ${asset.id}; saving the reference`);
      }
      durable.push(sequenceAssetForPersistence(asset));
      continue;
    }

    durable.push(sequenceAssetForPersistence(asset));
  }

  return durable;
}

/**
 * Attach runtime URIs to durable assets. Inline data URIs pass through.
 * Object URLs are owned by WorkshopMedia and revoked on project delete/clear.
 *
 * Unresolvable images are absent, never broken frames and never a reason
 * to refuse the reading. `missing` collects failures so the caller can
 * report them — quiet degradation is not silent.
 *
 * @param {object[]} assets
 * @param {{ onMissing?: 'omit'|'keep', missing?: object[] }} [options]
 *   `omit` (reading) drops the asset; `keep` (editor) returns metadata
 *   without a URI so the author still sees the entry that needs attention.
 */
export async function hydrateWorkshopAssets(assets = [], options = {}) {
  const { onMissing = 'omit', missing = [] } = options;
  const hydrated = [];
  for (const raw of assets) {
    const asset = createSequenceVisualAsset(raw);
    if (sequenceAssetHasUri(asset)) {
      hydrated.push(asset);
      continue;
    }
    let uri = null;
    if (asset.storage === SEQUENCE_ASSET_STORAGE_IDB) {
      try {
        uri = await WorkshopMedia.resolveObjectUrl(asset.id);
      } catch (error) {
        // Covers both a record that is gone and IndexedDB being
        // unavailable outright. Neither is a reason to withhold text.
        uri = null;
        if (!(error instanceof WorkshopMediaError)) throw error;
      }
    }
    if (uri) {
      hydrated.push(createSequenceVisualAsset({ ...asset, uri }));
      continue;
    }
    missing.push(asset);
    if (onMissing === 'keep') hydrated.push(asset);
  }
  return hydrated;
}

/**
 * Drop visual clips that name an asset which is no longer present.
 *
 * Omitting the asset alone is not enough: compile still validates clip
 * → asset references, so the clip must go with the image.
 */
export function pruneProgramAssetReferences(program, missingIds) {
  const gone = missingIds instanceof Set ? missingIds : new Set(missingIds || []);
  if (!gone.size || !program || !Array.isArray(program.tracks)) return program;

  const namesMissingAsset = (clip) => (clip?.cue?.collections || [])
    .some(collection => {
      const assetId = assetIdFromCollection(collection);
      return assetId !== null && gone.has(assetId);
    });
  const namesMissingVideo = (clip) => clip?.cue?.kind === 'video'
    && gone.has(clip.cue.assetId);
  const namesMissingFocal = (clip) => gone.has(personalFocalAssetIdFromCue(clip?.cue));

  let changed = false;
  const tracks = program.tracks.map((track) => {
    if (track.kind !== 'visual' || !Array.isArray(track.clips)) return track;
    const clips = track.clips.filter(clip => !namesMissingAsset(clip)
      && !namesMissingVideo(clip) && !namesMissingFocal(clip));
    if (clips.length === track.clips.length) return track;
    changed = true;
    return { ...track, clips };
  });
  // A visual track emptied of every clip is dropped rather than left as an
  // authority over nothing — lowering an empty track would hand the runtime
  // a lane with no fallback to choose.
  const kept = tracks.filter(track => track.kind !== 'visual'
    || !Array.isArray(track.clips)
    || track.clips.length > 0);
  if (kept.length !== tracks.length) changed = true;
  return changed ? { ...program, tracks: kept } : program;
}

/**
 * Build a session/blueprint view that carries hydrated URIs without writing
 * those URIs back through the persistence normalizer.
 */
export function workshopHydratedProjectToView(project) {
  const formal = isWorkshopProject(project)
    ? project
    : validateWorkshopProject(project);
  const assets = (formal.assets || []).map(createSequenceVisualAsset);
  const reading = formal.defaults.reading;
  const audio = formal.defaults.audio;
  const visualConfig = resolvePersonalFocal({
    ...(formal.defaults.visual.config || {}),
    visualMode: formal.defaults.visual.surface === 'focal'
      ? 'focals'
      : formal.defaults.visual.surface === 'scored'
        ? 'interlocution'
        : formal.defaults.visual.surface
  }, assets);

  return {
    id: formal.id,
    title: formal.title,
    intent: formal.intent,
    sources: formal.sources,
    wpm: reading.wpm,
    curve: reading.curve,
    chunkMode: reading.chunkMode,
    displayMode: reading.displayMode,
    visualConfig,
    soundscape: audio.soundscape,
    audioPreset: audio.audioPreset,
    selectedSwellId: audio.selectedSwellId,
    projection: formal.defaults.projection,
    recitation: formal.defaults.recitation,
    voiceId: formal.defaults.voiceId,
    customVisuals: assets
      .filter(asset => asset.kind !== 'video')
      .map(asset => asset.uri)
      .filter(uri => typeof uri === 'string'
        && (uri.startsWith('data:image/') || uri.startsWith('blob:'))),
    sequenceVisualAssets: assets,
    visualScoreAssignments: visualAssignmentsFromProgram(formal.experienceProgram),
    audioScoreAssignments: audioAssignmentsFromProgram(formal.experienceProgram),
    experienceProgram: formal.experienceProgram,
    experienceProgramId: formal.experienceProgram?.id || `workshop-${formal.id}`,
    provenance: formal.provenance,
    paceV2: true,
    updatedAt: formal.updatedAt,
    schema: formal.schema,
    defaults: formal.defaults,
    assets,
    project: {
      ...formal,
      assets
    }
  };
}

export async function hydrateWorkshopProjectView(project) {
  const formal = isWorkshopProject(project)
    ? validateWorkshopProject(project)
    : project;
  // keep: authoring view must still show missing entries.
  const assets = await hydrateWorkshopAssets(formal.assets || [], { onMissing: 'keep' });
  return workshopHydratedProjectToView({
    ...formal,
    assets
  });
}

/**
 * Hydrate a flat editor/session payload's sequenceVisualAssets in place.
 *
 * Returns the payload, and — on the same object — `missingSequenceAssets`,
 * the assets that could not be resolved. The reading is never withheld for
 * them; the caller is expected to tell the reader they are not there.
 */
export async function hydrateSessionSequenceAssets(sessionData) {
  if (!sessionData || typeof sessionData !== 'object') return sessionData;
  const assets = Array.isArray(sessionData.sequenceVisualAssets)
    ? sessionData.sequenceVisualAssets
    : [];
  const personalAssetId = sessionData.visualConfig?.focals?.personalAssetId;
  if (!assets.length && !personalAssetId) return sessionData;

  const missing = [];
  const hydrated = await hydrateWorkshopAssets(assets, { onMissing: 'omit', missing });
  const missingIds = new Set(missing.map(asset => asset.id));

  const next = {
    ...sessionData,
    sequenceVisualAssets: hydrated,
    visualConfig: resolvePersonalFocal(sessionData.visualConfig, hydrated),
    customVisuals: hydrated
      .filter(asset => asset.kind !== 'video')
      .map(asset => asset.uri)
      .filter(uri => typeof uri === 'string'
        && (uri.startsWith('data:image/') || uri.startsWith('blob:')))
  };

  if (missingIds.size) {
    // The clips that named them go with them — see
    // pruneProgramAssetReferences. Both the canonical program and the
    // editor's assignment list, because either one left dangling would
    // refuse the compile.
    if (next.experienceProgram) {
      next.experienceProgram = pruneProgramAssetReferences(next.experienceProgram, missingIds);
    }
    if (Array.isArray(next.visualScoreAssignments)) {
      next.visualScoreAssignments = next.visualScoreAssignments
        .filter(assignment => !missingIds.has(assignment?.assetId)
          && !missingIds.has(personalFocalAssetIdFromCue(assignment?.cue)));
    }
    next.missingSequenceAssets = missing;
  }
  return next;
}

export async function migrateAndHydrateWorkshopProject(project) {
  const formal = validateWorkshopProject(
    isWorkshopProject(project) ? project : project
  );
  const durableAssets = await ensureWorkshopAssetsDurable(
    formal.id,
    formal.assets,
    null
  );
  const migrated = validateWorkshopProject({
    ...formal,
    assets: durableAssets
  });
  const view = await hydrateWorkshopProjectView(migrated);
  return { project: migrated, view };
}
