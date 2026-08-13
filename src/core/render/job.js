/**
 * rise.render-job.v1 — immutable render input and environment contract.
 *
 * The job hashes and references admitted bytes. It does not acquire media,
 * rewrite the Experience Program, or authorize publication.
 */

import { fail } from './errors.js';
import { RENDER_JOB_SCHEMA, PINNED_RENDERER } from './environment.js';
import {
  RENDER_DISTRIBUTION_CLASSES,
  RENDER_LIMITS,
  RENDER_PROFILE_IDS,
  renderProfile
} from './limits.js';
import { contentHashOf, parseContentHash, refuseUri } from './hash.js';
import { frameCountForDuration, validateFrameRate } from './clock.js';

export { RENDER_JOB_SCHEMA };

const JOB_FIELDS = new Set([
  'schema', 'id', 'projectId', 'projectRevision', 'programHash',
  'sourceSnapshots', 'assetSnapshots', 'profile', 'viewport', 'frameRate',
  'durationMs', 'seed', 'renderer', 'policies'
]);

const SNAPSHOT_SOURCE_FIELDS = new Set(['sourceId', 'contentHash', 'editionId']);
const SNAPSHOT_ASSET_FIELDS = new Set(['assetId', 'contentHash']);
const VIEWPORT_FIELDS = new Set(['width', 'height', 'pixelRatio']);
const RENDERER_FIELDS = new Set(['version', 'environment', 'fontPackHash', 'codecProfile']);
const POLICY_FIELDS = new Set([
  'unsupportedCue', 'missingAsset', 'reducedMotion', 'includeCredits', 'distributionClass'
]);

function record(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('RENDER_JOB_OBJECT', 'Expected an object', path);
  }
  return value;
}

function onlyKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      fail('RENDER_JOB_UNKNOWN_FIELD', `Unknown field: ${key}`, `${path}.${key}`);
    }
  }
}

function exactId(value, path) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    fail('RENDER_JOB_ID', 'Expected a non-empty, trimmed id', path);
  }
  if (value.length > RENDER_LIMITS.maxIdLength) {
    fail('RENDER_JOB_ID_TOO_LONG',
      `Ids may not exceed ${RENDER_LIMITS.maxIdLength} characters`, path);
  }
  refuseUri(value, path);
  return value;
}

function integerRange(value, min, max, path) {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail('RENDER_JOB_INTEGER', `Expected an integer from ${min} to ${max}`, path);
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

function validateViewport(value, profile, path) {
  const source = record(value, path);
  onlyKeys(source, VIEWPORT_FIELDS, path);
  const viewport = {
    width: integerRange(source.width, 1, 7680, `${path}.width`),
    height: integerRange(source.height, 1, 7680, `${path}.height`),
    pixelRatio: integerRange(source.pixelRatio, 1, RENDER_LIMITS.maxPixelRatio, `${path}.pixelRatio`)
  };
  if (viewport.width !== profile.viewport.width
    || viewport.height !== profile.viewport.height
    || viewport.pixelRatio !== profile.viewport.pixelRatio) {
    fail('RENDER_JOB_VIEWPORT_PROFILE',
      'Viewport must match the named render profile', path, {
        expected: profile.viewport,
        actual: viewport
      });
  }
  return viewport;
}

function validateRenderer(value, profile, path) {
  const source = record(value, path);
  onlyKeys(source, RENDERER_FIELDS, path);
  const renderer = {
    version: exactId(source.version, `${path}.version`),
    environment: exactId(source.environment, `${path}.environment`),
    fontPackHash: parseContentHash(source.fontPackHash, `${path}.fontPackHash`),
    codecProfile: exactId(source.codecProfile, `${path}.codecProfile`)
  };
  if (renderer.codecProfile !== profile.codecProfile) {
    fail('RENDER_JOB_CODEC_PROFILE',
      'Codec profile must match the named render profile', `${path}.codecProfile`, {
        expected: profile.codecProfile,
        actual: renderer.codecProfile
      });
  }
  return renderer;
}

function validatePolicies(value, profile, path) {
  const source = record(value, path);
  onlyKeys(source, POLICY_FIELDS, path);
  if (source.unsupportedCue !== 'refuse') {
    fail('RENDER_JOB_POLICY',
      'V1 unsupported cues must refuse; omission is not a render policy',
      `${path}.unsupportedCue`);
  }
  if (source.missingAsset !== 'refuse') {
    fail('RENDER_JOB_POLICY',
      'V1 missing assets must refuse; substitution is not a render policy',
      `${path}.missingAsset`);
  }
  if (typeof source.reducedMotion !== 'boolean') {
    fail('RENDER_JOB_POLICY', 'reducedMotion must be boolean', `${path}.reducedMotion`);
  }
  if (typeof source.includeCredits !== 'boolean') {
    fail('RENDER_JOB_POLICY', 'includeCredits must be boolean', `${path}.includeCredits`);
  }
  if (profile.includeCredits && source.includeCredits !== true) {
    fail('RENDER_JOB_CREDITS_REQUIRED',
      'This profile cannot drop owed credits', `${path}.includeCredits`);
  }
  if (!RENDER_DISTRIBUTION_CLASSES.includes(source.distributionClass)) {
    fail('RENDER_JOB_DISTRIBUTION_CLASS',
      'distributionClass must be private-review or public', `${path}.distributionClass`);
  }
  return {
    unsupportedCue: 'refuse',
    missingAsset: 'refuse',
    reducedMotion: source.reducedMotion,
    includeCredits: source.includeCredits,
    distributionClass: source.distributionClass
  };
}

function validateSourceSnapshot(value, path) {
  const source = record(value, path);
  onlyKeys(source, SNAPSHOT_SOURCE_FIELDS, path);
  const snapshot = {
    sourceId: exactId(source.sourceId, `${path}.sourceId`),
    contentHash: parseContentHash(source.contentHash, `${path}.contentHash`)
  };
  if (source.editionId != null) {
    snapshot.editionId = exactId(source.editionId, `${path}.editionId`);
  }
  return snapshot;
}

function validateAssetSnapshot(value, path) {
  const source = record(value, path);
  onlyKeys(source, SNAPSHOT_ASSET_FIELDS, path);
  return {
    assetId: exactId(source.assetId, `${path}.assetId`),
    contentHash: parseContentHash(source.contentHash, `${path}.contentHash`)
  };
}

function uniqueBy(list, key, path, code) {
  const seen = new Set();
  for (const item of list) {
    if (seen.has(item[key])) {
      fail(code, `Duplicate ${key} in snapshots`, path, { [key]: item[key] });
    }
    seen.add(item[key]);
  }
}

/** Validate and return a detached, deeply immutable render job. */
export function validateRenderJob(value) {
  const source = record(value, '$');
  onlyKeys(source, JOB_FIELDS, '$');
  if (source.schema !== RENDER_JOB_SCHEMA) {
    fail('RENDER_JOB_SCHEMA', `Expected schema ${RENDER_JOB_SCHEMA}`, '$.schema');
  }
  const id = exactId(source.id, '$.id');
  const projectId = exactId(source.projectId, '$.projectId');
  const projectRevision = integerRange(
    source.projectRevision, 0, 1_000_000_000, '$.projectRevision');
  const programHash = parseContentHash(source.programHash, '$.programHash');

  if (!RENDER_PROFILE_IDS.includes(source.profile)) {
    fail('RENDER_JOB_PROFILE', `Unknown render profile: ${String(source.profile)}`, '$.profile');
  }
  const profile = renderProfile(source.profile);
  const viewport = validateViewport(source.viewport, profile, '$.viewport');
  const frameRate = validateFrameRate(source.frameRate, '$.frameRate');
  if (frameRate.numerator !== profile.frameRate.numerator
    || frameRate.denominator !== profile.frameRate.denominator) {
    fail('RENDER_JOB_FRAME_RATE_PROFILE',
      'Frame rate must match the named render profile', '$.frameRate', {
        expected: profile.frameRate,
        actual: frameRate
      });
  }

  const durationMs = integerRange(
    source.durationMs,
    Math.max(RENDER_LIMITS.minDurationMs, profile.minDurationMs),
    Math.min(RENDER_LIMITS.maxDurationMs, profile.maxDurationMs),
    '$.durationMs'
  );

  if (typeof source.seed !== 'string' || !source.seed || source.seed !== source.seed.trim()
    || source.seed.length > RENDER_LIMITS.maxSeedLength) {
    fail('RENDER_JOB_SEED', 'Expected a non-empty, trimmed seed', '$.seed');
  }
  refuseUri(source.seed, '$.seed');

  if (!Array.isArray(source.sourceSnapshots) || source.sourceSnapshots.length === 0) {
    fail('RENDER_JOB_SOURCES', 'A render job needs at least one source snapshot', '$.sourceSnapshots');
  }
  if (source.sourceSnapshots.length > RENDER_LIMITS.maxSources) {
    fail('RENDER_JOB_SOURCES',
      `A render job accepts at most ${RENDER_LIMITS.maxSources} sources`, '$.sourceSnapshots');
  }
  const sourceSnapshots = source.sourceSnapshots.map((item, index) =>
    validateSourceSnapshot(item, `$.sourceSnapshots[${index}]`));
  uniqueBy(sourceSnapshots, 'sourceId', '$.sourceSnapshots', 'RENDER_JOB_DUPLICATE_SOURCE');

  if (!Array.isArray(source.assetSnapshots)) {
    fail('RENDER_JOB_ASSETS', 'assetSnapshots must be an array', '$.assetSnapshots');
  }
  if (source.assetSnapshots.length > RENDER_LIMITS.maxAssets) {
    fail('RENDER_JOB_ASSETS',
      `A render job accepts at most ${RENDER_LIMITS.maxAssets} assets`, '$.assetSnapshots');
  }
  const assetSnapshots = source.assetSnapshots.map((item, index) =>
    validateAssetSnapshot(item, `$.assetSnapshots[${index}]`));
  uniqueBy(assetSnapshots, 'assetId', '$.assetSnapshots', 'RENDER_JOB_DUPLICATE_ASSET');

  const renderer = validateRenderer(source.renderer, profile, '$.renderer');
  const policies = validatePolicies(source.policies, profile, '$.policies');

  const job = {
    schema: RENDER_JOB_SCHEMA,
    id,
    projectId,
    projectRevision,
    programHash,
    sourceSnapshots,
    assetSnapshots,
    profile: profile.id,
    viewport,
    frameRate,
    durationMs,
    seed: source.seed,
    renderer,
    policies
  };
  return deepFreeze(job);
}

export async function admitRenderJob(value) {
  const job = validateRenderJob(value);
  const jobHash = await contentHashOf(job);
  return Object.freeze({ job, jobHash });
}

export function jobFrameCount(job) {
  return frameCountForDuration(job.durationMs, job.frameRate);
}

export function pinnedRendererForProfile(profileId) {
  const profile = renderProfile(profileId);
  if (!profile) {
    fail('RENDER_JOB_PROFILE', `Unknown render profile: ${String(profileId)}`, '$.profile');
  }
  return Object.freeze({
    version: PINNED_RENDERER.version,
    environment: PINNED_RENDERER.environment,
    fontPackHash: PINNED_RENDERER.fontPackHash,
    codecProfile: profile.codecProfile
  });
}

/**
 * Same admitted composition, different projection. Does not rewrite
 * program hash, source snapshots, assets, duration, or seed.
 */
export function deriveRenderJob(job, profileId) {
  const source = validateRenderJob(job);
  const profile = renderProfile(profileId);
  if (!profile) {
    fail('RENDER_JOB_PROFILE', `Unknown render profile: ${String(profileId)}`, '$.profile');
  }
  return validateRenderJob({
    schema: source.schema,
    id: `${source.id}:${profileId}`.slice(0, RENDER_LIMITS.maxIdLength),
    projectId: source.projectId,
    projectRevision: source.projectRevision,
    programHash: source.programHash,
    sourceSnapshots: source.sourceSnapshots.map(item => ({ ...item })),
    assetSnapshots: source.assetSnapshots.map(item => ({ ...item })),
    profile: profile.id,
    viewport: { ...profile.viewport },
    frameRate: { ...profile.frameRate },
    durationMs: source.durationMs,
    seed: source.seed,
    renderer: pinnedRendererForProfile(profile.id),
    policies: { ...source.policies }
  });
}
