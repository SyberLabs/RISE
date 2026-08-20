/**
 * Distribution packages: one composition, several profiles.
 * Layout changes. Authorship does not.
 */

import { fail } from './errors.js';
import { deriveRenderJob } from './job.js';
import { compileRenderPlan, hashRenderPlan } from './plan.js';
import { admitRenderJob } from './job.js';
import { preflightRenderJob, PREFLIGHT_VERDICTS } from './preflight.js';
import { mixAudio, peakAmplitude } from './audio-mix.js';
import { sha256Hex } from './hash.js';
import { renderPoster } from './poster.js';
import { buildRenderPackage, owedCreditLines } from './package.js';
import { DISTRIBUTION_PROFILE_IDS, qualityTier } from './quality.js';
import { frameIndexAt } from './clock.js';

export { DISTRIBUTION_PROFILE_IDS };

function audioBytes(pcm) {
  return new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
}

async function hashPcm(pcm) {
  return `sha256:${await sha256Hex(audioBytes(pcm))}`;
}

async function renderAdmittedPackage(input, job, options = {}) {
  const tier = qualityTier(options.tier || 'draft');
  const admitted = await admitRenderJob(job);
  const preflight = await preflightRenderJob({
    job: admitted.job,
    program: input.program,
    inventory: input.inventory
  });
  if (preflight.verdict === PREFLIGHT_VERDICTS.REFUSED) {
    fail('RENDER_PREFLIGHT_REFUSED', 'Preflight refused this distribution job', '$', {
      profile: admitted.job.profile,
      refusals: preflight.refusals
    });
  }
  const plan = compileRenderPlan({
    job: admitted.job,
    program: input.program,
    sources: input.sources,
    inventory: input.inventory,
    sessionInput: input.sessionInput
  });
  const planHash = await hashRenderPlan(plan);
  const excerpt = options.excerpt || null;
  const fromMs = excerpt?.fromMs || 0;
  const toMs = excerpt?.toMs == null ? plan.durationMs : excerpt.toMs;
  const audio = mixAudio(plan, {
    sampleRate: options.sampleRate || tier.sampleRate,
    fromMs,
    toMs,
    inventory: input.inventory
  });
  const posterFrame = excerpt
    ? Math.min(plan.frameCount - 1, Math.max(0, frameIndexAt(fromMs, plan.frameRate)))
    : undefined;
  const poster = await renderPoster(plan, {
    inventory: input.inventory,
    scale: tier.posterScale,
    thumbnailMaxEdge: tier.thumbnailMaxEdge,
    frameIndex: posterFrame
  });
  const pack = await buildRenderPackage({
    job: admitted.job,
    jobHash: admitted.jobHash,
    plan,
    planHash,
    frameHashes: Object.freeze([poster.posterHash]),
    audioHash: await hashPcm(audio.pcm),
    audio,
    sources: input.sources,
    inventory: input.inventory,
    diagnostics: Object.freeze({
      scale: tier.posterScale,
      peakAmplitude: peakAmplitude(audio.pcm),
      droppedFrames: 0,
      lateFrames: 0,
      posterFrame: poster.frameIndex
    }),
    posterBytes: poster.posterBytes,
    thumbnailBytes: poster.thumbnailBytes,
    posterHash: poster.posterHash,
    thumbnailHash: poster.thumbnailHash,
    quality: tier.id,
    excerpt: excerpt
      ? {
        parentJobId: input.job.id,
        parentProgramHash: admitted.job.programHash,
        parentProjectRevision: admitted.job.projectRevision,
        fromMs,
        toMs,
        openingCard: false,
        closingCard: false
      }
      : null,
    captionRange: excerpt ? { fromMs, toMs } : null
  });
  return Object.freeze({
    job: admitted.job,
    jobHash: admitted.jobHash,
    plan,
    planHash,
    package: pack,
    credits: owedCreditLines({ sources: input.sources, inventory: input.inventory })
  });
}

export async function renderProfilePackage(input, profileId, options = {}) {
  return renderAdmittedPackage(input, deriveRenderJob(input.job, profileId), options);
}

export async function renderPreview(input, { fromMs, toMs, tier = 'draft' } = {}) {
  if (!Number.isInteger(fromMs) || !Number.isInteger(toMs) || toMs <= fromMs) {
    fail('RENDER_PREVIEW_RANGE', 'Preview range must be a half-open millisecond window', '$.excerpt');
  }
  return renderAdmittedPackage(input, input.job, {
    tier,
    excerpt: { fromMs, toMs }
  });
}

/**
 * Portrait, square, and landscape packages from one admitted composition.
 */
export async function renderDistributionPackages(input, options = {}) {
  const profiles = options.profiles || DISTRIBUTION_PROFILE_IDS;
  const packages = {};
  let credits = null;
  for (const profileId of profiles) {
    const rendered = await renderProfilePackage(input, profileId, options);
    if (!credits) credits = rendered.credits;
    else {
      const missing = credits.filter(line => !rendered.credits.includes(line));
      if (missing.length) {
        fail('RENDER_CREDITS_REMOVED',
          'A profile cannot drop an owed credit',
          '$.credits',
          { profileId, missing });
      }
    }
    packages[profileId] = rendered;
  }
  return Object.freeze({
    programHash: packages[profiles[0]].job.programHash,
    credits,
    packages: Object.freeze(packages)
  });
}
