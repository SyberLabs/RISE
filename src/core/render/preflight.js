/**
 * Render preflight — classify, budget, and refuse before any frame is allocated.
 *
 * Returns renderable, renderable-with-declared-degradations, or refused.
 * Does not encode, acquire media, or mutate the Workshop project.
 */

import { validateExperienceProgram } from '../experience-program.js';
import { sequenceAssetReferencesFromCue } from '../visual-score-lane.js';
import { fail, RenderError } from './errors.js';
import { contentHashOf, hashesEqual, parseContentHash, refuseUri } from './hash.js';
import {
  RENDER_LIMITS,
  RENDER_RIGHTS_STATUSES,
  renderProfile
} from './limits.js';
import { PINNED_RENDERER } from './environment.js';
import { jobFrameCount, validateRenderJob } from './job.js';
import { classifyProgramCues, renderSupportFor } from './support.js';

export const PREFLIGHT_VERDICTS = Object.freeze({
  RENDERABLE: 'renderable',
  RENDERABLE_WITH_DEGRADATIONS: 'renderable-with-degradations',
  REFUSED: 'refused'
});

const INVENTORY_ASSET_FIELDS = new Set([
  'assetId', 'contentHash', 'kind', 'mimeType', 'byteLength', 'rights',
  'durationMs', 'width', 'height'
]);
const INVENTORY_SOURCE_FIELDS = new Set([
  'sourceId', 'contentHash', 'byteLength', 'characterCount'
]);
const ASSET_KINDS = new Set(['image', 'video', 'audio', 'font', 'document']);

function record(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('RENDER_PREFLIGHT_OBJECT', 'Expected an object', path);
  }
  return value;
}

function onlyKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      fail('RENDER_PREFLIGHT_UNKNOWN_FIELD', `Unknown field: ${key}`, `${path}.${key}`);
    }
  }
}

function freezeReport(report) {
  return Object.freeze({
    ...report,
    refusals: Object.freeze(report.refusals.map(item => Object.freeze(item))),
    degradations: Object.freeze(report.degradations.map(item => Object.freeze(item))),
    cues: Object.freeze(report.cues.map(item => Object.freeze(item))),
    budgets: Object.freeze(report.budgets),
    rights: Object.freeze(report.rights)
  });
}

function refusal(code, message, path, details = {}, repair = null) {
  return { code, message, path, details, repair };
}

function validateInventoryAsset(value, path) {
  const source = record(value, path);
  onlyKeys(source, INVENTORY_ASSET_FIELDS, path);
  refuseUri(source.assetId, `${path}.assetId`);
  if (!ASSET_KINDS.has(source.kind)) {
    fail('RENDER_INVENTORY_KIND', `Unknown asset kind: ${String(source.kind)}`, `${path}.kind`);
  }
  const rightsSource = record(source.rights, `${path}.rights`);
  if (!RENDER_RIGHTS_STATUSES.includes(rightsSource.status)) {
    fail('RENDER_INVENTORY_RIGHTS',
      `Unknown rights status: ${String(rightsSource.status)}`, `${path}.rights.status`);
  }
  if (typeof rightsSource.distributionAllowed !== 'boolean') {
    fail('RENDER_INVENTORY_RIGHTS',
      'rights.distributionAllowed must be boolean', `${path}.rights.distributionAllowed`);
  }
  const asset = {
    assetId: source.assetId,
    contentHash: parseContentHash(source.contentHash, `${path}.contentHash`),
    kind: source.kind,
    mimeType: typeof source.mimeType === 'string' ? source.mimeType : '',
    byteLength: Number.isInteger(source.byteLength) ? source.byteLength : 0,
    rights: Object.freeze({
      status: rightsSource.status,
      distributionAllowed: rightsSource.distributionAllowed,
      ...(typeof rightsSource.credit === 'string' ? { credit: rightsSource.credit } : {})
    })
  };
  if (Number.isInteger(source.durationMs) && source.durationMs > 0) {
    asset.durationMs = source.durationMs;
  }
  if (Number.isInteger(source.width) && source.width > 0) asset.width = source.width;
  if (Number.isInteger(source.height) && source.height > 0) asset.height = source.height;
  return Object.freeze(asset);
}

function validateInventorySource(value, path) {
  const source = record(value, path);
  onlyKeys(source, INVENTORY_SOURCE_FIELDS, path);
  refuseUri(source.sourceId, `${path}.sourceId`);
  return Object.freeze({
    sourceId: source.sourceId,
    contentHash: parseContentHash(source.contentHash, `${path}.contentHash`),
    byteLength: Number.isInteger(source.byteLength) ? source.byteLength : 0,
    characterCount: Number.isInteger(source.characterCount) ? source.characterCount : 0
  });
}

function expectedAssetKind(reference) {
  if (reference.expectedKind === 'video') return 'video';
  return 'image';
}

/**
 * @param {{ job: object, program: object, inventory?: { sources?: object[], assets?: object[] } }} input
 */
export async function preflightRenderJob(input = {}) {
  const job = validateRenderJob(input.job);
  const program = validateExperienceProgram(input.program);
  const inventory = input.inventory && typeof input.inventory === 'object'
    ? input.inventory
    : {};

  const refusals = [];
  const degradations = [];
  const push = (item) => { refusals.push(item); };

  const programHash = await contentHashOf(program);
  if (programHash !== job.programHash) {
    push(refusal('RENDER_PROGRAM_HASH_MISMATCH',
      'The supplied program does not match the job program hash',
      '$.programHash',
      { expected: job.programHash, actual: programHash },
      'Re-admit the job from this program revision, or supply the hashed program.'));
  }

  if (job.renderer.version !== PINNED_RENDERER.version
    || job.renderer.environment !== PINNED_RENDERER.environment
    || job.renderer.fontPackHash !== PINNED_RENDERER.fontPackHash) {
    push(refusal('RENDER_ENVIRONMENT_PIN',
      'This renderer cannot execute a job pinned to a different environment',
      '$.renderer',
      { expected: PINNED_RENDERER, actual: job.renderer },
      'Create a new job against the current pinned renderer.'));
  }

  const sources = (inventory.sources || []).map((item, index) =>
    validateInventorySource(item, `$.inventory.sources[${index}]`));
  const assets = (inventory.assets || []).map((item, index) =>
    validateInventoryAsset(item, `$.inventory.assets[${index}]`));
  const sourcesById = new Map(sources.map(item => [item.sourceId, item]));
  const assetsById = new Map(assets.map(item => [item.assetId, item]));

  for (const snapshot of job.sourceSnapshots) {
    const found = sourcesById.get(snapshot.sourceId);
    if (!found) {
      push(refusal('RENDER_SOURCE_MISSING',
        `No inventory source matches ${snapshot.sourceId}`,
        '$.sourceSnapshots',
        { sourceId: snapshot.sourceId },
        'Load the edition that this job hashed, or remove it from the score.'));
      continue;
    }
    if (!hashesEqual(found.contentHash, snapshot.contentHash)) {
      push(refusal('RENDER_SOURCE_HASH_MISMATCH',
        `Source ${snapshot.sourceId} bytes do not match the job snapshot`,
        '$.sourceSnapshots',
        { sourceId: snapshot.sourceId, expected: snapshot.contentHash, actual: found.contentHash },
        'Re-admit the job from the current edition, or restore the hashed bytes.'));
    }
  }

  for (const snapshot of job.assetSnapshots) {
    const found = assetsById.get(snapshot.assetId);
    if (!found) {
      push(refusal('RENDER_ASSET_MISSING',
        `No inventory asset matches ${snapshot.assetId}`,
        '$.assetSnapshots',
        { assetId: snapshot.assetId },
        'Admit the asset into the project, or remove the cue that names it.'));
      continue;
    }
    if (!hashesEqual(found.contentHash, snapshot.contentHash)) {
      push(refusal('RENDER_ASSET_HASH_MISMATCH',
        `Asset ${snapshot.assetId} bytes do not match the job snapshot`,
        '$.assetSnapshots',
        { assetId: snapshot.assetId, expected: snapshot.contentHash, actual: found.contentHash },
        'Re-admit the job from the current asset bytes, or restore the hashed bytes.'));
    }
  }

  const classified = classifyProgramCues(program);
  const cues = classified.map((item) => {
    const support = item.support || renderSupportFor(item.cueKind);
    if (!support) {
      push(refusal('RENDER_CUE_UNDECLARED',
        `Cue ${item.cueKind} has no render-support declaration`,
        item.path,
        { cueKind: item.cueKind, clipId: item.clipId },
        'Add a native, degraded, or unsupported row to the render-support registry.'));
      return { ...item, render: 'unsupported' };
    }
    if (support.render === 'unsupported') {
      push(refusal('RENDER_CUE_UNSUPPORTED',
        support.reason || `Cue ${item.cueKind} cannot be rendered`,
        item.path,
        { cueKind: item.cueKind, clipId: item.clipId, role: item.role },
        'Replace this cue with a supported family, or wait for its render adapter.'));
    } else if (support.render === 'degraded') {
      degradations.push({
        cueKind: item.cueKind,
        clipId: item.clipId,
        path: item.path,
        degradation: support.degradation,
        reason: support.reason
      });
    }
    return { ...item, render: support.render, reason: support.reason };
  });

  for (const item of classified) {
    if (item.trackKind !== 'visual') continue;
    for (const reference of sequenceAssetReferencesFromCue(item.cue)) {
      const snapshot = job.assetSnapshots.find(entry => entry.assetId === reference.id);
      if (!snapshot) {
        push(refusal('RENDER_ASSET_UNSNAPSHOTTED',
          `Cue names asset ${reference.id} which is not in the job snapshots`,
          item.path,
          { assetId: reference.id, role: reference.role },
          'Include this asset in the job snapshots after admission.'));
        continue;
      }
      const found = assetsById.get(reference.id);
      if (found && found.kind !== expectedAssetKind(reference)) {
        push(refusal('RENDER_ASSET_KIND',
          `Asset ${reference.id} is ${found.kind}, but this cue requires ${expectedAssetKind(reference)}`,
          item.path,
          { assetId: reference.id, expected: expectedAssetKind(reference), actual: found.kind },
          'Bind a matching admitted asset, or change the cue.'));
      }
    }
  }

  for (const item of classified) {
    if (item.cueKind !== 'visual:sourced:collection') continue;
    const images = [...assetsById.values()].filter(asset => asset.kind === 'image');
    if (!images.length) {
      push(refusal('RENDER_COLLECTION_UNPINNED',
        'A museum collection cannot be fetched during render; admit stills first',
        item.path,
        { collections: item.cue?.collections || [] },
        'Admit collection works into the project, or assign a procedural engine.'));
    }
  }

  const publicDistribution = job.policies.distributionClass === 'public';
  const rightsIssues = [];
  for (const snapshot of job.assetSnapshots) {
    const found = assetsById.get(snapshot.assetId);
    if (!found) continue;
    const unresolved = found.rights.status === 'unknown'
      || found.rights.status === 'user-asserted'
      || found.rights.distributionAllowed !== true;
    if (unresolved) {
      rightsIssues.push({
        assetId: found.assetId,
        status: found.rights.status,
        distributionAllowed: found.rights.distributionAllowed
      });
      if (publicDistribution) {
        push(refusal('RENDER_RIGHTS_UNRESOLVED',
          `Asset ${found.assetId} cannot enter a public distribution package`,
          '$.assetSnapshots',
          { assetId: found.assetId, status: found.rights.status },
          'Verify rights, or render only for private review.'));
      }
    }
  }

  const profile = renderProfile(job.profile);
  const frameCount = jobFrameCount(job);
  const outputPixels = job.viewport.width * job.viewport.height * frameCount;
  if (job.viewport.width * job.viewport.height > RENDER_LIMITS.maxDecodedPixels) {
    push(refusal('RENDER_PIXEL_BUDGET',
      'Viewport exceeds the decoded-pixel ceiling',
      '$.viewport',
      { pixels: job.viewport.width * job.viewport.height, max: RENDER_LIMITS.maxDecodedPixels },
      'Choose a smaller profile.'));
  }

  let decodedBytes = 0;
  for (const asset of assets) {
    decodedBytes += asset.byteLength;
    const max = asset.kind === 'video'
      ? RENDER_LIMITS.maxVideoFileBytes
      : asset.kind === 'audio'
        ? RENDER_LIMITS.maxAudioFileBytes
        : RENDER_LIMITS.maxImageFileBytes;
    if (asset.byteLength > max) {
      push(refusal('RENDER_ASSET_SIZE',
        `Asset ${asset.assetId} exceeds the ${asset.kind} byte ceiling`,
        '$.inventory.assets',
        { assetId: asset.assetId, byteLength: asset.byteLength, max },
        'Replace the asset with a bounded original.'));
    }
  }

  const verdict = refusals.length
    ? PREFLIGHT_VERDICTS.REFUSED
    : degradations.length
      ? PREFLIGHT_VERDICTS.RENDERABLE_WITH_DEGRADATIONS
      : PREFLIGHT_VERDICTS.RENDERABLE;

  return freezeReport({
    verdict,
    jobId: job.id,
    profile: job.profile,
    durationMs: job.durationMs,
    frameCount,
    programHash,
    cues,
    refusals,
    degradations,
    rights: {
      distributionClass: job.policies.distributionClass,
      unresolved: rightsIssues,
      blocksPublic: publicDistribution && rightsIssues.length > 0,
      privateReviewAllowed: !publicDistribution
    },
    budgets: {
      frameCount,
      outputPixels,
      decodedBytes,
      maxOutputBytes: RENDER_LIMITS.maxOutputBytes,
      maxFrames: RENDER_LIMITS.maxFrames,
      profileMaxDurationMs: profile.maxDurationMs
    }
  });
}

export function describePreflightFailure(reportOrError) {
  if (reportOrError instanceof RenderError) {
    return [
      reportOrError.message,
      reportOrError.code ? `(${reportOrError.code})` : null
    ].filter(Boolean).join(' ');
  }
  const report = reportOrError;
  if (!report?.refusals?.length) return 'Preflight passed.';
  const lines = ['This job cannot render yet.', ''];
  for (const item of report.refusals) {
    lines.push(`- ${item.message} (${item.code})`);
    if (item.repair) lines.push(`  ${item.repair}`);
  }
  return lines.join('\n');
}
