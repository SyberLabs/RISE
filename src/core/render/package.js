/**
 * Render package: captions, credits, manifest, diagnostics.
 * No credentials, no private source text, no local paths.
 */

import { RENDER_MANIFEST_SCHEMA, PINNED_RENDERER } from './environment.js';
import { captionsFromPlan, captionsToSrt, captionsToVtt } from './captions.js';

export function creditsText({ sources = [], inventory = {} } = {}) {
  const lines = ['Credits — RISE render package'];
  for (const source of sources) {
    const name = source.name || source.title || source.id;
    const author = source.metadata?.author || source.author || null;
    lines.push(author ? `Source: ${name} — ${author}` : `Source: ${name}`);
  }
  for (const asset of inventory.assets || []) {
    const credit = asset.rights?.credit || asset.assetId;
    lines.push(`${asset.kind}: ${credit}`);
  }
  return lines.join('\n');
}

export function rightsReport(inventory = {}, distributionClass = 'private-review') {
  const assets = (inventory.assets || []).map(asset => Object.freeze({
    assetId: asset.assetId,
    contentHash: asset.contentHash,
    kind: asset.kind,
    status: asset.rights?.status || 'unknown',
    distributionAllowed: asset.rights?.distributionAllowed === true
  }));
  const unresolved = assets.filter(asset =>
    asset.status === 'unknown' || asset.status === 'user-asserted' || !asset.distributionAllowed);
  return Object.freeze({
    distributionClass,
    assets: Object.freeze(assets),
    unresolved: Object.freeze(unresolved),
    publicationBlocked: distributionClass === 'public' && unresolved.length > 0
  });
}

export function buildRenderPackage({
  job,
  jobHash,
  plan,
  planHash,
  frameHashes,
  audioHash,
  audio,
  sources,
  inventory,
  diagnostics
}) {
  const cues = captionsFromPlan(plan);
  const manifest = Object.freeze({
    schema: RENDER_MANIFEST_SCHEMA,
    jobId: job.id,
    jobHash,
    planHash,
    projectId: job.projectId,
    projectRevision: job.projectRevision,
    programHash: job.programHash,
    profile: job.profile,
    seed: job.seed,
    renderer: job.renderer,
    determinismCriterion: PINNED_RENDERER.determinismCriterion,
    encoder: Object.freeze({
      declared: job.renderer.codecProfile,
      actual: 'rise-decoded-identity/0.1',
      note: 'Phase 1 compares decoded RGBA frames and mixed PCM. H.264 mux is a later adapter.'
    }),
    frameCount: plan.frameCount,
    durationMs: plan.durationMs,
    viewport: job.viewport,
    frameRate: job.frameRate,
    audio: Object.freeze({
      sampleRate: audio.sampleRate,
      channels: audio.channels,
      frames: audio.frames
    }),
    sourceSnapshots: job.sourceSnapshots,
    assetSnapshots: job.assetSnapshots,
    appliedDegradations: Object.freeze([]),
    outputHashes: Object.freeze({
      frames: frameHashes,
      audio: audioHash
    }),
    droppedFrames: 0,
    lateFrames: 0
  });

  return Object.freeze({
    'captions.vtt': captionsToVtt(cues),
    'captions.srt': captionsToSrt(cues),
    'credits.txt': creditsText({ sources, inventory }),
    'rights-report.json': rightsReport(inventory, job.policies.distributionClass),
    'render-manifest.json': manifest,
    'diagnostics.json': Object.freeze(diagnostics || {}),
    captions: cues
  });
}
