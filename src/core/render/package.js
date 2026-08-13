/**
 * Render package: captions, credits, poster, thumbnail, rights, manifest.
 * No credentials, no private source text, no local paths.
 */

import { RENDER_MANIFEST_SCHEMA, PINNED_RENDERER } from './environment.js';
import { captionsFromPlan, captionsToSrt, captionsToVtt } from './captions.js';
import { contentHashOf } from './hash.js';

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

export function owedCreditLines({ sources = [], inventory = {} } = {}) {
  return creditsText({ sources, inventory })
    .split('\n')
    .slice(1)
    .map(line => line.trim())
    .filter(Boolean)
    .sort();
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

export async function buildRenderPackage({
  job,
  jobHash,
  plan,
  planHash,
  frameHashes,
  audioHash,
  audio,
  sources,
  inventory,
  diagnostics,
  posterBytes = null,
  thumbnailBytes = null,
  posterHash = null,
  thumbnailHash = null,
  quality = 'final',
  excerpt = null,
  captionRange = null
}) {
  const cues = captionsFromPlan(plan, captionRange || {});
  const vtt = captionsToVtt(cues);
  const srt = captionsToSrt(cues);
  const credits = creditsText({ sources, inventory });
  const rights = rightsReport(inventory, job.policies.distributionClass);
  const captionsJson = JSON.stringify(cues);
  const outputHashes = {
    frames: frameHashes,
    audio: audioHash,
    captionsVtt: await contentHashOf(vtt),
    captionsSrt: await contentHashOf(srt),
    captionsJson: await contentHashOf(captionsJson),
    credits: await contentHashOf(credits),
    rights: await contentHashOf(rights)
  };
  if (posterHash) outputHashes.poster = posterHash;
  if (thumbnailHash) outputHashes.thumbnail = thumbnailHash;

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
    quality,
    renderer: job.renderer,
    determinismCriterion: PINNED_RENDERER.determinismCriterion,
    encoder: Object.freeze({
      declared: job.renderer.codecProfile,
      actual: 'rise-decoded-identity/0.1',
      note: 'Decoded RGBA frames, mixed PCM, and BMP posters. H.264 mux is a later adapter.'
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
    excerpt: excerpt ? Object.freeze(excerpt) : null,
    outputHashes: Object.freeze(outputHashes),
    droppedFrames: 0,
    lateFrames: 0
  });

  const files = {
    'captions.vtt': vtt,
    'captions.srt': srt,
    'captions.json': captionsJson,
    'credits.txt': credits,
    'rights-report.json': rights,
    'render-manifest.json': manifest,
    'diagnostics.json': Object.freeze(diagnostics || {})
  };
  if (posterBytes) files['poster.bmp'] = posterBytes;
  if (thumbnailBytes) files['thumbnail.bmp'] = thumbnailBytes;

  return Object.freeze({
    ...files,
    captions: cues
  });
}
