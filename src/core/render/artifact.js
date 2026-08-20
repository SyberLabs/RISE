/**
 * Kernel: Experience Program → social MP4.
 *
 * rise.kernel-request.v1 → renderArtifact(request) →
 *   { mp4Path, srt, poster, manifest, jobHash }
 *
 * Node-only. The score stays rise.experience-program.v1. The job stays
 * admitRenderJob plus a profile from limits.js. This module does not
 * publish, upload, or open a Studio.
 */

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fail } from './errors.js';
import { EXPERIENCE_PROGRAM_SCHEMA } from '../experience-program.js';
import { compileSession } from '../session-compiler.js';
import { captionsFromPlan, captionsToSrt } from './captions.js';
import { frameIndexAt } from './clock.js';
import { RENDER_JOB_SCHEMA } from './environment.js';
import { contentHashOf, sha256Hex } from './hash.js';
import { admitRenderJob, pinnedRendererForProfile } from './job.js';
import { renderProfile } from './limits.js';
import { mixAudio, peakAmplitude } from './audio-mix.js';
import { buildRenderPackage } from './package.js';
import { compileRenderPlan, hashRenderPlan } from './plan.js';
import { preflightRenderJob, PREFLIGHT_VERDICTS } from './preflight.js';
import { renderPoster } from './poster.js';
import { qualityTier } from './quality.js';
import { exportRenderMp4 } from './export-mp4.js';
import { KERNEL_REQUEST_SCHEMA } from './kernel-request.js';

export { KERNEL_REQUEST_SCHEMA };

function audioBytes(pcm) {
  return new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
}

async function hashPcm(pcm) {
  return `sha256:${await sha256Hex(audioBytes(pcm))}`;
}

function validateKernelRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    fail('RENDER_KERNEL_REQUEST', 'renderArtifact needs a kernel request', '$');
  }
  if (request.schema !== KERNEL_REQUEST_SCHEMA) {
    fail('RENDER_KERNEL_SCHEMA', `Expected ${KERNEL_REQUEST_SCHEMA}`, '$.schema');
  }
  if (!request.program || request.program.schema !== EXPERIENCE_PROGRAM_SCHEMA) {
    fail('RENDER_KERNEL_PROGRAM',
      'renderArtifact needs a rise.experience-program.v1 score',
      '$.program');
  }
  return request;
}

async function jobFromRequest(request, program, sources, sessionInput, inventory) {
  if (request.job) return request.job;
  const profileId = request.profileId || 'social-portrait-1080';
  const profile = renderProfile(profileId);
  if (!profile) {
    fail('RENDER_KERNEL_PROFILE', `Unknown render profile: ${profileId}`, '$.profileId');
  }
  const session = compileSession({
    wpm: 160,
    chunkMode: 'phrase',
    curve: 'flat',
    ...sessionInput,
    experienceProgram: program,
    sources
  });
  const programHash = await contentHashOf(program);
  const sourceSnapshots = [];
  for (const source of sources || []) {
    const sourceId = source.id || source.sourceId;
    const text = source.data || '';
    sourceSnapshots.push({
      sourceId,
      contentHash: await contentHashOf(text),
      editionId: sourceId
    });
  }
  const assetSnapshots = (inventory.assets || [])
    .filter(asset => asset.assetId && asset.contentHash)
    .map(asset => ({ assetId: asset.assetId, contentHash: asset.contentHash }));
  return {
    schema: RENDER_JOB_SCHEMA,
    id: `render-${program.id || 'kernel'}`.slice(0, 160),
    projectId: request.projectId || program.id || 'kernel',
    projectRevision: request.projectRevision || 1,
    programHash,
    sourceSnapshots,
    assetSnapshots,
    profile: profile.id,
    viewport: { ...profile.viewport },
    frameRate: { ...profile.frameRate },
    durationMs: session.totalDuration,
    seed: request.seed || `${program.id || 'kernel'}:1`,
    renderer: pinnedRendererForProfile(profile.id),
    policies: {
      unsupportedCue: 'refuse',
      missingAsset: 'refuse',
      reducedMotion: false,
      includeCredits: true,
      distributionClass: 'private-review'
    }
  };
}

/**
 * Admit a job, compile the plan, mix spoken PCM from inventory, paint,
 * and mux H.264. Clerk is the test stub; Chamber is the painter.
 */
export async function renderArtifact(request = {}) {
  const req = validateKernelRequest(request);
  const program = req.program;
  const sources = req.sources || [];
  const inventory = req.inventory || {};
  const sessionInput = req.sessionInput || {};
  const job = await jobFromRequest(req, program, sources, sessionInput, inventory);
  const admitted = await admitRenderJob(job);
  const preflight = await preflightRenderJob({
    job: admitted.job,
    program,
    inventory
  });
  if (preflight.verdict === PREFLIGHT_VERDICTS.REFUSED) {
    fail('RENDER_PREFLIGHT_REFUSED', 'Preflight refused this kernel job', '$', {
      refusals: preflight.refusals
    });
  }

  const plan = compileRenderPlan({
    job: admitted.job,
    program,
    sources,
    inventory,
    sessionInput
  });
  const planHash = await hashRenderPlan(plan);
  const fromMs = req.fromMs || 0;
  const toMs = req.toMs == null ? plan.durationMs : req.toMs;
  const tier = qualityTier(req.tier || 'final');
  const scale = req.scale == null ? tier.scale : req.scale;
  const sampleRate = req.sampleRate || tier.sampleRate;
  const painter = req.painter || 'chamber';
  const outputPath = req.outputPath || join(
    mkdtempSync(join(tmpdir(), 'rise-artifact-')),
    'experience.mp4'
  );

  const audio = mixAudio(plan, { sampleRate, inventory, fromMs, toMs });
  const encoded = await exportRenderMp4({
    plan,
    inventory,
    outputPath,
    scale,
    sampleRate,
    ffmpegPath: req.ffmpegPath || null,
    painter,
    fromMs,
    toMs,
    audio,
    caption: req.caption
  });
  const posterFrame = req.fromMs
    ? Math.min(plan.frameCount - 1, Math.max(0, frameIndexAt(fromMs, plan.frameRate)))
    : undefined;
  const poster = await renderPoster(plan, {
    inventory,
    scale: tier.posterScale,
    thumbnailMaxEdge: tier.thumbnailMaxEdge,
    frameIndex: posterFrame
  });
  const excerpt = req.fromMs || req.toMs != null
    ? {
      parentJobId: admitted.job.id,
      parentProgramHash: admitted.job.programHash,
      parentProjectRevision: admitted.job.projectRevision,
      fromMs,
      toMs,
      openingCard: false,
      closingCard: false
    }
    : null;
  const pack = await buildRenderPackage({
    job: admitted.job,
    jobHash: admitted.jobHash,
    plan,
    planHash,
    frameHashes: Object.freeze([poster.posterHash]),
    audioHash: await hashPcm(audio.pcm),
    audio,
    sources,
    inventory,
    diagnostics: Object.freeze({
      scale,
      peakAmplitude: peakAmplitude(audio.pcm),
      droppedFrames: 0,
      lateFrames: 0,
      posterFrame: poster.frameIndex,
      mp4Path: encoded.path
    }),
    posterBytes: poster.posterBytes,
    thumbnailBytes: poster.thumbnailBytes,
    posterHash: poster.posterHash,
    thumbnailHash: poster.thumbnailHash,
    quality: tier.id,
    excerpt,
    captionRange: excerpt ? { fromMs, toMs } : null
  });
  const srt = pack['captions.srt'] || captionsToSrt(captionsFromPlan(plan, { fromMs, toMs }));

  return Object.freeze({
    mp4Path: encoded.path,
    srt,
    poster: pack['poster.bmp'],
    manifest: pack['render-manifest.json'],
    jobHash: admitted.jobHash,
    job: admitted.job,
    plan,
    planHash,
    package: pack,
    encoded
  });
}
