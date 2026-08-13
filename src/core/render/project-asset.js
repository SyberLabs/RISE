/**
 * Project asset manifest — a description of admitted media over existing
 * Workshop stores. It does not migrate IndexedDB, mint object URLs, or
 * mutate Workshop state. Bytes stay where they are; this record names them.
 */

import { validateExperienceProgram } from '../experience-program.js';
import { sequenceAssetReferencesFromCue } from '../visual-score-lane.js';
import { workshopAudioAsset } from '../workshop-audio.js';
import { PINNED_RENDERER } from './environment.js';
import { RenderError } from './errors.js';
import {
  contentHashOf,
  contentHashOfBytes,
  hashesEqual,
  parseContentHash,
  refuseUri
} from './hash.js';
import { RENDER_LIMITS, RENDER_RIGHTS_STATUSES } from './limits.js';

export const PROJECT_ASSET_SCHEMA = 'rise.project-asset.v1';
export const PROJECT_ASSET_MANIFEST_SCHEMA = 'rise.project-asset-manifest.v1';
export const ASSET_TRANSFER_BUNDLE_SCHEMA = 'rise.asset-transfer-bundle.v1';

export const PROJECT_ASSET_KINDS = Object.freeze([
  'image', 'video', 'audio', 'font', 'document'
]);
export const PROJECT_ASSET_ORIGINS = Object.freeze([
  'upload', 'remote-acquisition', 'generated', 'library'
]);
export const PROJECT_ASSET_STORAGE_KINDS = Object.freeze([
  'workshop-idb', 'personal-swells-idb', 'library', 'inline', 'bundle'
]);

const ASSET_FIELDS = new Set([
  'schema', 'id', 'projectId', 'kind', 'mimeType', 'byteLength', 'contentHash',
  'dimensions', 'durationMs', 'storage', 'provenance', 'rights', 'transformations'
]);
const STORAGE_FIELDS = new Set(['kind', 'recordId']);
const PROVENANCE_FIELDS = new Set([
  'origin', 'sourceUrl', 'provider', 'creator', 'createdAt', 'acquiredAt',
  'generator', 'promptDigest'
]);
const RIGHTS_FIELDS = new Set([
  'status', 'license', 'credit', 'evidence', 'distributionAllowed'
]);
const TRANSFORM_FIELDS = new Set([
  'kind', 'parentId', 'parentHash', 'appliedAt', 'paramsHash'
]);
const MANIFEST_FIELDS = new Set(['schema', 'projectId', 'assets']);
const BUNDLE_META_FIELDS = new Set([
  'schema', 'jobId', 'projectId', 'assets', 'parts'
]);
const PART_FIELDS = new Set(['assetId', 'contentHash', 'byteLength']);

const IMAGE_MIME = /^image\/(?!svg\+xml$)[a-z0-9.+-]+$/i;
const AUDIO_MIME = /^audio\/[a-z0-9.+-]+$/i;
const FONT_MIME = /^(font\/(woff2?|ttf|otf)|application\/font-woff2?)$/i;
const DOCUMENT_MIME = /^(text\/plain|application\/json|application\/xml)$/i;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export class ProjectAssetError extends Error {
  constructor(code, message, path = '$', details = {}) {
    super(`${message} (${path})`);
    this.name = 'ProjectAssetError';
    this.code = code;
    this.path = path;
    this.details = details;
  }
}

const fail = (code, message, path, details) => {
  throw new ProjectAssetError(code, message, path, details);
};

function record(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('PROJECT_ASSET_OBJECT', 'Expected an object', path);
  }
  return value;
}

function onlyKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      fail('PROJECT_ASSET_UNKNOWN_FIELD', `Unknown field: ${key}`, `${path}.${key}`);
    }
  }
}

function exactId(value, path) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    fail('PROJECT_ASSET_ID', 'Expected a non-empty, trimmed id', path);
  }
  if (value.length > RENDER_LIMITS.maxIdLength) {
    fail('PROJECT_ASSET_ID', `Ids may not exceed ${RENDER_LIMITS.maxIdLength} characters`, path);
  }
  refuseUriAs(value, path);
  return value;
}

function refuseUriAs(value, path) {
  try {
    return refuseUri(value, path);
  } catch (error) {
    if (error instanceof RenderError && error.code === 'RENDER_URI_REFUSED') {
      fail('PROJECT_ASSET_URI', 'Project assets may not name URIs as identities', path, {
        value
      });
    }
    throw error;
  }
}

function digest(value, path) {
  try {
    return parseContentHash(value, path);
  } catch (error) {
    if (error instanceof RenderError) {
      fail('PROJECT_ASSET_HASH', 'Expected a sha256:<64 hex> content hash', path, { value });
    }
    throw error;
  }
}

function boundedText(value, path, max = 500) {
  if (value == null) return null;
  if (typeof value !== 'string') {
    fail('PROJECT_ASSET_TEXT', 'Expected a string', path);
  }
  const text = value.trim();
  if (!text) return null;
  if (text.length > max) {
    fail('PROJECT_ASSET_TEXT', `Text may not exceed ${max} characters`, path);
  }
  return text;
}

function isoTime(value, path) {
  if (value == null) return null;
  if (typeof value !== 'string' || !ISO_TIME.test(value)) {
    fail('PROJECT_ASSET_TIME', 'Expected an ISO-8601 UTC timestamp', path);
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

function kindFromMime(mimeType) {
  if (mimeType === 'video/mp4') return 'video';
  if (IMAGE_MIME.test(mimeType)) return 'image';
  if (AUDIO_MIME.test(mimeType)) return 'audio';
  if (FONT_MIME.test(mimeType)) return 'font';
  if (DOCUMENT_MIME.test(mimeType)) return 'document';
  return null;
}

function assertMimeForKind(kind, mimeType, path) {
  const ok = kind === 'image' ? IMAGE_MIME.test(mimeType)
    : kind === 'video' ? mimeType === 'video/mp4'
      : kind === 'audio' ? AUDIO_MIME.test(mimeType)
        : kind === 'font' ? FONT_MIME.test(mimeType)
          : kind === 'document' ? DOCUMENT_MIME.test(mimeType)
            : false;
  if (!ok) {
    fail('PROJECT_ASSET_MIME', `MIME ${mimeType} is not admitted for kind ${kind}`, path, {
      kind,
      mimeType
    });
  }
}

function byteCeiling(kind) {
  if (kind === 'video') return RENDER_LIMITS.maxVideoFileBytes;
  if (kind === 'audio') return RENDER_LIMITS.maxAudioFileBytes;
  if (kind === 'image') return RENDER_LIMITS.maxImageFileBytes;
  return RENDER_LIMITS.maxImageFileBytes;
}

function validateStorage(value, path) {
  const source = record(value, path);
  onlyKeys(source, STORAGE_FIELDS, path);
  if (!PROJECT_ASSET_STORAGE_KINDS.includes(source.kind)) {
    fail('PROJECT_ASSET_STORAGE', `Unknown storage kind: ${String(source.kind)}`, `${path}.kind`);
  }
  return Object.freeze({
    kind: source.kind,
    recordId: exactId(source.recordId, `${path}.recordId`)
  });
}

function validateProvenance(value, path) {
  const source = record(value, path);
  onlyKeys(source, PROVENANCE_FIELDS, path);
  if (!PROJECT_ASSET_ORIGINS.includes(source.origin)) {
    fail('PROJECT_ASSET_ORIGIN', `Unknown provenance origin: ${String(source.origin)}`,
      `${path}.origin`);
  }
  const provenance = { origin: source.origin };
  const sourceUrl = boundedText(source.sourceUrl, `${path}.sourceUrl`, 2000);
  if (sourceUrl) {
    if (!/^https?:\/\//i.test(sourceUrl)) {
      fail('PROJECT_ASSET_SOURCE_URL',
        'Remote provenance URLs must be http(s) reacquisition evidence',
        `${path}.sourceUrl`);
    }
    provenance.sourceUrl = sourceUrl;
  }
  const provider = boundedText(source.provider, `${path}.provider`, 160);
  if (provider) provenance.provider = provider;
  const creator = boundedText(source.creator, `${path}.creator`, 200);
  if (creator) provenance.creator = creator;
  const createdAt = isoTime(source.createdAt, `${path}.createdAt`);
  if (createdAt) provenance.createdAt = createdAt;
  const acquiredAt = isoTime(source.acquiredAt, `${path}.acquiredAt`);
  if (acquiredAt) provenance.acquiredAt = acquiredAt;
  const generator = boundedText(source.generator, `${path}.generator`, 160);
  if (generator) provenance.generator = generator;
  const promptDigest = source.promptDigest == null
    ? null
    : digest(source.promptDigest, `${path}.promptDigest`);
  if (promptDigest) provenance.promptDigest = promptDigest;
  return Object.freeze(provenance);
}

function validateRights(value, path) {
  const source = record(value, path);
  onlyKeys(source, RIGHTS_FIELDS, path);
  if (!RENDER_RIGHTS_STATUSES.includes(source.status)) {
    fail('PROJECT_ASSET_RIGHTS', `Unknown rights status: ${String(source.status)}`,
      `${path}.status`);
  }
  if (typeof source.distributionAllowed !== 'boolean') {
    fail('PROJECT_ASSET_RIGHTS', 'rights.distributionAllowed must be boolean',
      `${path}.distributionAllowed`);
  }
  const rights = {
    status: source.status,
    distributionAllowed: source.distributionAllowed
  };
  const license = boundedText(source.license, `${path}.license`, 120);
  if (license) rights.license = license;
  const credit = boundedText(source.credit, `${path}.credit`, 500);
  if (credit) rights.credit = credit;
  const evidence = boundedText(source.evidence, `${path}.evidence`, 500);
  if (evidence) rights.evidence = evidence;
  return Object.freeze(rights);
}

function validateTransformation(value, path) {
  const source = record(value, path);
  onlyKeys(source, TRANSFORM_FIELDS, path);
  const kind = boundedText(source.kind, `${path}.kind`, 80);
  if (!kind) fail('PROJECT_ASSET_TRANSFORM', 'Transformation kind is required', `${path}.kind`);
  const item = {
    kind,
    parentId: exactId(source.parentId, `${path}.parentId`),
    parentHash: digest(source.parentHash, `${path}.parentHash`),
    appliedAt: isoTime(source.appliedAt, `${path}.appliedAt`)
      || fail('PROJECT_ASSET_TRANSFORM', 'appliedAt is required', `${path}.appliedAt`)
  };
  if (source.paramsHash != null) {
    item.paramsHash = digest(source.paramsHash, `${path}.paramsHash`);
  }
  return Object.freeze(item);
}

function validateDimensions(value, path) {
  if (value == null) return null;
  const source = record(value, path);
  if (Object.keys(source).some(key => key !== 'width' && key !== 'height')) {
    fail('PROJECT_ASSET_UNKNOWN_FIELD', 'dimensions may only include width and height', path);
  }
  if (!Number.isInteger(source.width) || source.width <= 0
    || !Number.isInteger(source.height) || source.height <= 0) {
    fail('PROJECT_ASSET_DIMENSIONS', 'dimensions.width and height must be positive integers', path);
  }
  return Object.freeze({ width: source.width, height: source.height });
}

export function validateProjectAsset(value, path = '$') {
  const source = record(value, path);
  onlyKeys(source, ASSET_FIELDS, path);
  if (source.schema !== PROJECT_ASSET_SCHEMA) {
    fail('PROJECT_ASSET_SCHEMA', `Expected ${PROJECT_ASSET_SCHEMA}`, `${path}.schema`);
  }
  if (!PROJECT_ASSET_KINDS.includes(source.kind)) {
    fail('PROJECT_ASSET_KIND', `Unknown asset kind: ${String(source.kind)}`, `${path}.kind`);
  }
  if (typeof source.mimeType !== 'string' || !source.mimeType.trim()) {
    fail('PROJECT_ASSET_MIME', 'mimeType is required', `${path}.mimeType`);
  }
  const mimeType = source.mimeType.trim();
  assertMimeForKind(source.kind, mimeType, `${path}.mimeType`);
  if (!Number.isInteger(source.byteLength) || source.byteLength < 0) {
    fail('PROJECT_ASSET_SIZE', 'byteLength must be a non-negative integer', `${path}.byteLength`);
  }
  const max = byteCeiling(source.kind);
  if (source.byteLength > max) {
    fail('PROJECT_ASSET_SIZE', `Asset exceeds the ${source.kind} byte ceiling`, `${path}.byteLength`, {
      byteLength: source.byteLength,
      max
    });
  }
  const storage = validateStorage(source.storage, `${path}.storage`);
  if (storage.kind === 'library') {
    if (source.byteLength !== 0) {
      fail('PROJECT_ASSET_LIBRARY', 'Library assets do not carry user bytes', `${path}.byteLength`);
    }
  }
  if (source.durationMs != null && (!Number.isInteger(source.durationMs) || source.durationMs <= 0)) {
    fail('PROJECT_ASSET_DURATION', 'durationMs must be a positive integer when present',
      `${path}.durationMs`);
  }
  const transformations = Array.isArray(source.transformations) ? source.transformations : [];
  if (transformations.length > 32) {
    fail('PROJECT_ASSET_TRANSFORM', 'Too many transformation records', `${path}.transformations`);
  }
  const asset = {
    schema: PROJECT_ASSET_SCHEMA,
    id: exactId(source.id, `${path}.id`),
    projectId: exactId(source.projectId, `${path}.projectId`),
    kind: source.kind,
    mimeType,
    byteLength: source.byteLength,
    contentHash: digest(source.contentHash, `${path}.contentHash`),
    storage,
    provenance: validateProvenance(source.provenance, `${path}.provenance`),
    rights: validateRights(source.rights, `${path}.rights`),
    transformations: Object.freeze(transformations.map((item, index) =>
      validateTransformation(item, `${path}.transformations[${index}]`)))
  };
  const dimensions = validateDimensions(source.dimensions, `${path}.dimensions`);
  if (dimensions) asset.dimensions = dimensions;
  if (Number.isInteger(source.durationMs) && source.durationMs > 0) {
    asset.durationMs = source.durationMs;
  }
  return deepFreeze(asset);
}

export function validateProjectAssetManifest(value, path = '$') {
  const source = record(value, path);
  onlyKeys(source, MANIFEST_FIELDS, path);
  if (source.schema !== PROJECT_ASSET_MANIFEST_SCHEMA) {
    fail('PROJECT_ASSET_MANIFEST_SCHEMA', `Expected ${PROJECT_ASSET_MANIFEST_SCHEMA}`,
      `${path}.schema`);
  }
  const projectId = exactId(source.projectId, `${path}.projectId`);
  if (!Array.isArray(source.assets) || source.assets.length > RENDER_LIMITS.maxAssets) {
    fail('PROJECT_ASSET_MANIFEST',
      `A manifest accepts at most ${RENDER_LIMITS.maxAssets} assets`, `${path}.assets`);
  }
  const assets = source.assets.map((item, index) => {
    const asset = validateProjectAsset(item, `${path}.assets[${index}]`);
    if (asset.projectId !== projectId) {
      fail('PROJECT_ASSET_PROJECT', 'Asset projectId must match the manifest',
        `${path}.assets[${index}].projectId`);
    }
    return asset;
  });
  if (new Set(assets.map(asset => asset.id)).size !== assets.length) {
    fail('PROJECT_ASSET_DUPLICATE', 'Asset ids must be unique inside a project', `${path}.assets`);
  }
  return deepFreeze({
    schema: PROJECT_ASSET_MANIFEST_SCHEMA,
    projectId,
    assets
  });
}

export function defaultUploadRights() {
  return Object.freeze({
    status: 'unknown',
    distributionAllowed: false
  });
}

export function libraryRights() {
  return Object.freeze({
    status: 'verified',
    distributionAllowed: true,
    license: 'RISE-library',
    credit: 'RISE'
  });
}

/**
 * Interactive use is not distribution. Unknown and user-asserted remain
 * publication-blocked even when a private-review render is allowed.
 */
export function rightsCapabilities(asset) {
  const validated = asset?.schema === PROJECT_ASSET_SCHEMA
    ? asset
    : validateProjectAsset(asset);
  const publicDistribution = validated.rights.status === 'verified'
    && validated.rights.distributionAllowed === true;
  return Object.freeze({
    interactive: true,
    privateReview: validated.rights.status !== 'restricted',
    publicDistribution,
    unresolvedForPublication: !publicDistribution
  });
}

export function assertDistributionAllowed(asset, distributionClass) {
  const capabilities = rightsCapabilities(asset);
  if (distributionClass === 'public' && !capabilities.publicDistribution) {
    fail('PROJECT_ASSET_RIGHTS_UNRESOLVED',
      `Asset ${asset.id} cannot enter a public distribution package`,
      '$.rights',
      { assetId: asset.id, status: asset.rights.status });
  }
  return capabilities;
}

export function inventoryAssetFromProjectAsset(asset) {
  const validated = validateProjectAsset(asset);
  const item = {
    assetId: validated.id,
    contentHash: validated.contentHash,
    kind: validated.kind,
    mimeType: validated.mimeType,
    byteLength: validated.byteLength,
    rights: {
      status: validated.rights.status,
      distributionAllowed: validated.rights.distributionAllowed,
      ...(validated.rights.credit ? { credit: validated.rights.credit } : {})
    }
  };
  if (validated.durationMs) item.durationMs = validated.durationMs;
  if (validated.dimensions) {
    item.width = validated.dimensions.width;
    item.height = validated.dimensions.height;
  }
  return Object.freeze(item);
}

async function hashMediaBytes(bytes, path) {
  if (bytes instanceof Uint8Array || bytes instanceof ArrayBuffer) {
    return contentHashOfBytes(bytes);
  }
  if (bytes && typeof bytes.arrayBuffer === 'function') {
    return contentHashOfBytes(new Uint8Array(await bytes.arrayBuffer()));
  }
  fail('PROJECT_ASSET_BYTES', 'Admitted bytes are required before a content hash can exist', path);
}

function fromEpoch(value) {
  if (!Number.isFinite(value) || value <= 0) return null;
  try {
    return new Date(value).toISOString();
  } catch {
    return null;
  }
}

function mergeProvenance(base, extra) {
  const merged = { ...base };
  if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
    for (const key of PROVENANCE_FIELDS) {
      if (extra[key] != null && extra[key] !== '') merged[key] = extra[key];
    }
  }
  return merged;
}

export async function projectWorkshopMedia({
  record,
  meta = {},
  bytes = null,
  rights = null,
  provenance = null
} = {}) {
  const media = record && typeof record === 'object' ? record : {};
  const id = exactId(media.id || meta.id, '$.id');
  const projectId = exactId(media.projectId || meta.projectId, '$.projectId');
  const mimeType = String(media.mimeType || meta.mimeType || '').trim();
  const kind = meta.kind === 'video' || mimeType === 'video/mp4' ? 'video' : 'image';
  const payload = bytes || media.data || null;
  const contentHash = await hashMediaBytes(payload, '$.bytes');
  const byteLength = Number.isInteger(media.byteLength)
    ? media.byteLength
    : payload instanceof Uint8Array
      ? payload.byteLength
      : payload?.size;
  const acquiredAt = fromEpoch(media.createdAt);
  const asset = {
    schema: PROJECT_ASSET_SCHEMA,
    id,
    projectId,
    kind,
    mimeType,
    byteLength,
    contentHash,
    storage: {
      kind: meta.storage === 'inline' ? 'inline' : 'workshop-idb',
      recordId: id
    },
    provenance: mergeProvenance({
      origin: 'upload',
      ...(acquiredAt ? { acquiredAt, createdAt: acquiredAt } : {})
    }, meta.provenance || provenance),
    rights: rights || defaultUploadRights(),
    transformations: []
  };
  if (Number.isInteger(meta.durationMs) && meta.durationMs > 0) {
    asset.durationMs = meta.durationMs;
  }
  return validateProjectAsset(asset);
}

export async function projectPersonalSwell({
  record,
  projectId,
  bytes = null,
  rights = null,
  provenance = null
} = {}) {
  const swell = record && typeof record === 'object' ? record : {};
  const id = exactId(swell.id, '$.id');
  const mimeType = String(swell.type || swell.mimeType || 'audio/mpeg').trim();
  const payload = bytes || swell.data || null;
  const contentHash = await hashMediaBytes(payload, '$.bytes');
  const acquiredAt = fromEpoch(swell.timestamp);
  return validateProjectAsset({
    schema: PROJECT_ASSET_SCHEMA,
    id,
    projectId: exactId(projectId, '$.projectId'),
    kind: 'audio',
    mimeType,
    byteLength: Number.isInteger(swell.byteLength)
      ? swell.byteLength
      : payload instanceof Uint8Array
        ? payload.byteLength
        : payload?.size,
    contentHash,
    storage: { kind: 'personal-swells-idb', recordId: id },
    provenance: mergeProvenance({
      origin: 'upload',
      provider: 'Personal swell shelf',
      ...(acquiredAt ? { acquiredAt, createdAt: acquiredAt } : {})
    }, provenance),
    rights: rights || defaultUploadRights(),
    transformations: []
  });
}

export async function projectLibraryAudio({
  assetId,
  projectId
} = {}) {
  const registry = workshopAudioAsset(assetId);
  if (!registry) {
    fail('PROJECT_ASSET_LIBRARY', `Unknown library audio id: ${String(assetId)}`, '$.id');
  }
  const contentHash = await contentHashOf({
    schema: 'rise.library-audio.v1',
    id: registry.id,
    renderer: PINNED_RENDERER.version
  });
  return validateProjectAsset({
    schema: PROJECT_ASSET_SCHEMA,
    id: registry.id,
    projectId: exactId(projectId, '$.projectId'),
    kind: 'audio',
    mimeType: 'audio/rise-library',
    byteLength: 0,
    contentHash,
    storage: { kind: 'library', recordId: registry.id },
    provenance: {
      origin: 'library',
      provider: 'RISE audio registry',
      creator: registry.name
    },
    rights: libraryRights(),
    transformations: []
  });
}

/**
 * A transform writes new bytes under a new id. The parent remains; the
 * lineage record names it. Silent overwrite is a refusal, not a default.
 */
export async function admitTransformedAsset({
  parent,
  id,
  bytes,
  mimeType,
  kind = null,
  dimensions = null,
  durationMs = null,
  transformation,
  rights = null,
  storageKind = null
} = {}) {
  const source = validateProjectAsset(parent);
  const nextId = exactId(id, '$.id');
  if (nextId === source.id) {
    fail('PROJECT_ASSET_OVERWRITE',
      'A transformed asset receives a new id; it does not overwrite its parent',
      '$.id',
      { parentId: source.id });
  }
  const payload = bytes instanceof Uint8Array
    ? bytes
    : bytes instanceof ArrayBuffer
      ? new Uint8Array(bytes)
      : null;
  if (!payload) {
    fail('PROJECT_ASSET_BYTES', 'Transformed bytes are required', '$.bytes');
  }
  const contentHash = await contentHashOfBytes(payload);
  const transform = record(transformation, '$.transformation');
  const paramsHash = transform.params != null
    ? await contentHashOf(transform.params)
    : (typeof transform.paramsHash === 'string' ? transform.paramsHash : null);
  const next = {
    schema: PROJECT_ASSET_SCHEMA,
    id: nextId,
    projectId: source.projectId,
    kind: kind || source.kind,
    mimeType: mimeType || source.mimeType,
    byteLength: payload.byteLength,
    contentHash,
    storage: {
      kind: storageKind || (source.storage.kind === 'library' ? 'bundle' : source.storage.kind),
      recordId: nextId
    },
    provenance: source.provenance,
    rights: rights || source.rights,
    transformations: [
      ...source.transformations,
      {
        kind: transform.kind,
        parentId: source.id,
        parentHash: source.contentHash,
        appliedAt: transform.appliedAt || new Date().toISOString(),
        ...(paramsHash ? { paramsHash } : {})
      }
    ]
  };
  if (dimensions) next.dimensions = dimensions;
  if (durationMs) next.durationMs = durationMs;
  return validateProjectAsset(next);
}

export function referencedAssetIdsFromProgram(program) {
  const canonical = validateExperienceProgram(program);
  const ids = [];
  const seen = new Set();
  const add = (id) => {
    if (typeof id !== 'string' || !id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  for (const track of canonical.tracks) {
    for (const clip of track.clips || []) {
      const cue = clip.cue;
      if (!cue) continue;
      for (const reference of sequenceAssetReferencesFromCue(cue)) add(reference.id);
      if (cue.kind === 'swell' && cue.swellId) add(cue.swellId);
      if (cue.kind === 'soundscape' && cue.soundscapeId) add(`soundscape:${cue.soundscapeId}`);
      if (cue.kind === 'tone' && cue.presetId) add(`tone:${cue.presetId}`);
      if (cue.kind === 'silence') add('tone:silent');
    }
  }
  return Object.freeze(ids);
}

/**
 * Bytes of a scored asset cannot disappear while the score still names them.
 * Repair is atomic: either the repaired program no longer names the id, or
 * the deletion is refused and the original program stands.
 */
export function planAssetDeletion({ assetId, program, repair = null }) {
  const id = exactId(assetId, '$.assetId');
  const current = validateExperienceProgram(program);
  if (!referencedAssetIdsFromProgram(current).includes(id)) {
    return deepFreeze({
      allowed: true,
      assetId: id,
      referenced: false,
      nextProgram: current,
      repair: null
    });
  }
  if (repair == null) {
    fail('PROJECT_ASSET_REFERENCED',
      `Asset ${id} is named by the score and cannot be deleted without an atomic repair`,
      '$.assetId',
      { assetId: id });
  }
  const next = validateExperienceProgram(repair);
  if (referencedAssetIdsFromProgram(next).includes(id)) {
    fail('PROJECT_ASSET_REPAIR_INCOMPLETE',
      `The supplied repair still names asset ${id}`,
      '$.repair',
      { assetId: id });
  }
  return deepFreeze({
    allowed: true,
    assetId: id,
    referenced: true,
    nextProgram: next,
    repair: 'program'
  });
}

export async function compileProjectAssetManifest({
  projectId,
  workshopRecords = [],
  sequenceAssets = [],
  swells = [],
  libraryAudioIds = [],
  bytesById = {},
  rightsById = {}
} = {}) {
  const owner = exactId(projectId, '$.projectId');
  const metaById = new Map((sequenceAssets || []).map(asset => [asset.id, asset]));
  const lookupBytes = (id) => {
    if (bytesById instanceof Map) return bytesById.get(id) || null;
    return bytesById[id] || null;
  };
  const assets = [];
  for (const record of workshopRecords) {
    assets.push(await projectWorkshopMedia({
      record,
      meta: metaById.get(record.id) || {},
      bytes: lookupBytes(record.id),
      rights: rightsById[record.id] || null
    }));
  }
  for (const swell of swells) {
    assets.push(await projectPersonalSwell({
      record: swell,
      projectId: owner,
      bytes: lookupBytes(swell.id),
      rights: rightsById[swell.id] || null
    }));
  }
  for (const libraryId of libraryAudioIds) {
    assets.push(await projectLibraryAudio({ assetId: libraryId, projectId: owner }));
  }
  return validateProjectAssetManifest({
    schema: PROJECT_ASSET_MANIFEST_SCHEMA,
    projectId: owner,
    assets
  });
}

function bytesMap(bytesById) {
  if (bytesById instanceof Map) return bytesById;
  return new Map(Object.entries(bytesById || {}));
}

function partBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return null;
}

export async function packTransferBundle({
  jobId = null,
  projectId,
  assets,
  bytesById = {}
} = {}) {
  const owner = exactId(projectId, '$.projectId');
  const admitted = (assets || []).map((asset, index) =>
    validateProjectAsset(asset, `$.assets[${index}]`));
  if (admitted.length > RENDER_LIMITS.maxTransferAssets) {
    fail('PROJECT_ASSET_TRANSFER_BUDGET',
      `A transfer bundle accepts at most ${RENDER_LIMITS.maxTransferAssets} assets`,
      '$.assets');
  }
  const bytes = bytesMap(bytesById);
  const parts = [];
  let totalBytes = 0;
  for (const asset of admitted) {
    if (asset.projectId !== owner) {
      fail('PROJECT_ASSET_PROJECT', 'Bundle assets must belong to one project', '$.projectId');
    }
    if (asset.storage.kind === 'library') {
      if (bytes.has(asset.id)) {
        fail('PROJECT_ASSET_LIBRARY', 'Library assets do not travel as user bytes',
          `$.bytes.${asset.id}`);
      }
      continue;
    }
    const payload = partBytes(bytes.get(asset.id));
    if (!payload) {
      fail('PROJECT_ASSET_TRANSFER_BYTES',
        `Bundle is missing bytes for ${asset.id}`,
        `$.bytes.${asset.id}`);
    }
    if (payload.byteLength !== asset.byteLength) {
      fail('PROJECT_ASSET_TRANSFER_SIZE',
        `Byte length for ${asset.id} does not match the admitted record`,
        `$.bytes.${asset.id}`,
        { expected: asset.byteLength, actual: payload.byteLength });
    }
    const hash = await contentHashOfBytes(payload);
    if (!hashesEqual(hash, asset.contentHash)) {
      fail('PROJECT_ASSET_HASH_MISMATCH',
        `Bytes for ${asset.id} do not match the admitted content hash`,
        `$.bytes.${asset.id}`,
        { expected: asset.contentHash, actual: hash });
    }
    totalBytes += payload.byteLength;
    parts.push(Object.freeze({
      assetId: asset.id,
      contentHash: asset.contentHash,
      byteLength: asset.byteLength
    }));
  }
  if (totalBytes > RENDER_LIMITS.maxTransferBytes) {
    fail('PROJECT_ASSET_TRANSFER_BUDGET',
      'Transfer bundle exceeds the byte ceiling',
      '$.bytes',
      { totalBytes, max: RENDER_LIMITS.maxTransferBytes });
  }
  const meta = {
    schema: ASSET_TRANSFER_BUNDLE_SCHEMA,
    ...(jobId ? { jobId: exactId(jobId, '$.jobId') } : {}),
    projectId: owner,
    assets: admitted,
    parts
  };
  const bundleHash = await contentHashOf({
    schema: meta.schema,
    jobId: meta.jobId || null,
    projectId: meta.projectId,
    assets: admitted.map(asset => ({
      id: asset.id,
      contentHash: asset.contentHash,
      byteLength: asset.byteLength
    })),
    parts
  });
  return deepFreeze({
    ...meta,
    bundleHash,
    bytes: Object.freeze(Object.fromEntries(
      parts.map(part => [part.assetId, partBytes(bytes.get(part.assetId))])
    ))
  });
}

export async function verifyTransferBundle(bundle, path = '$') {
  const source = record(bundle, path);
  onlyKeys(source, new Set([...BUNDLE_META_FIELDS, 'bundleHash', 'bytes']), path);
  if (source.schema !== ASSET_TRANSFER_BUNDLE_SCHEMA) {
    fail('PROJECT_ASSET_BUNDLE_SCHEMA', `Expected ${ASSET_TRANSFER_BUNDLE_SCHEMA}`,
      `${path}.schema`);
  }
  const packed = await packTransferBundle({
    jobId: source.jobId || null,
    projectId: source.projectId,
    assets: source.assets,
    bytesById: source.bytes
  });
  if (source.bundleHash && !hashesEqual(source.bundleHash, packed.bundleHash)) {
    fail('PROJECT_ASSET_BUNDLE_HASH',
      'The transfer bundle hash does not match its admitted parts',
      `${path}.bundleHash`,
      { expected: packed.bundleHash, actual: source.bundleHash });
  }
  const declaredParts = Array.isArray(source.parts) ? source.parts : [];
  declaredParts.forEach((part, index) => {
    const item = record(part, `${path}.parts[${index}]`);
    onlyKeys(item, PART_FIELDS, `${path}.parts[${index}]`);
  });
  if (declaredParts.length !== packed.parts.length) {
    fail('PROJECT_ASSET_TRANSFER_PARTS',
      'Declared parts do not match the verified payload',
      `${path}.parts`);
  }
  return packed;
}

/**
 * Local and remote transfer use the same verification. Import returns
 * admitted records and bytes; it does not write Workshop stores.
 */
export async function importTransferBundle(bundle) {
  const verified = await verifyTransferBundle(bundle);
  return deepFreeze({
    projectId: verified.projectId,
    jobId: verified.jobId || null,
    assets: verified.assets,
    bytes: verified.bytes,
    bundleHash: verified.bundleHash
  });
}

export async function recoverAssetFromBundle(bundle, assetId) {
  const verified = await verifyTransferBundle(bundle);
  const id = exactId(assetId, '$.assetId');
  const asset = verified.assets.find(item => item.id === id);
  if (!asset) {
    fail('PROJECT_ASSET_MISSING', `Bundle does not contain ${id}`, '$.assetId');
  }
  if (asset.storage.kind === 'library') {
    return deepFreeze({ asset, bytes: null });
  }
  const bytes = partBytes(verified.bytes[id]);
  if (!bytes) {
    fail('PROJECT_ASSET_TRANSFER_BYTES', `Bundle is missing bytes for ${id}`, `$.bytes.${id}`);
  }
  return deepFreeze({ asset, bytes });
}
