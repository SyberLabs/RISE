/**
 * Offline render driver.
 *
 * prepare → renderFrame / renderAudio → finalize. Cancellation never
 * yields a completed artifact and never mutates the Workshop project.
 */

import { fail } from './errors.js';
import { sha256Hex } from './hash.js';
import { admitRenderJob } from './job.js';
import { compileRenderPlan, hashRenderPlan } from './plan.js';
import { renderFrameRgba } from './raster.js';
import { mixAudio, peakAmplitude } from './audio-mix.js';
import { buildRenderPackage } from './package.js';
import { preflightRenderJob, PREFLIGHT_VERDICTS } from './preflight.js';
import { renderPoster } from './poster.js';

function audioBytes(pcm) {
  return new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
}

export async function hashRgba(rgba) {
  return `sha256:${await sha256Hex(rgba)}`;
}

export async function hashPcm(pcm) {
  return `sha256:${await sha256Hex(audioBytes(pcm))}`;
}

/**
 * @param {{ job, program, sources, inventory, sessionInput?, plan? }} input
 * @param {{ scale?: number, fromFrame?: number, toFrame?: number, keepFrames?: number[], sampleRate?: number, cancel?: { cancelled: boolean } }} options
 */
export async function renderJob(input, options = {}) {
  const started = Date.now();
  const admitted = await admitRenderJob(input.job);
  const preflight = await preflightRenderJob({
    job: admitted.job,
    program: input.program,
    inventory: input.inventory
  });
  if (preflight.verdict === PREFLIGHT_VERDICTS.REFUSED) {
    fail('RENDER_PREFLIGHT_REFUSED',
      'Preflight refused this job',
      '$',
      { refusals: preflight.refusals });
  }

  const plan = input.plan || compileRenderPlan({
    job: admitted.job,
    program: input.program,
    sources: input.sources,
    inventory: input.inventory,
    sessionInput: input.sessionInput
  });
  const planHash = await hashRenderPlan(plan);
  const scale = options.scale == null ? 1 : options.scale;
  const fromFrame = options.fromFrame == null ? 0 : options.fromFrame;
  const toFrame = options.toFrame == null ? plan.frameCount : options.toFrame;
  const selectedFrames = Array.isArray(options.frames)
    ? options.frames.filter(index => Number.isInteger(index) && index >= 0 && index < plan.frameCount)
    : null;
  const keep = new Set(options.keepFrames || []);
  const cancel = options.cancel || { cancelled: false };
  const frameHashes = [];
  const kept = [];
  const indices = selectedFrames || Array.from({ length: toFrame - fromFrame }, (_, i) => fromFrame + i);

  for (const frameIndex of indices) {
    if (cancel.cancelled) {
      fail('RENDER_CANCELLED', 'Render cancelled before completion', '$.render', {
        atFrame: frameIndex
      });
    }
    const frame = renderFrameRgba(plan, frameIndex, {
      inventory: input.inventory,
      scale
    });
    const hash = await hashRgba(frame.rgba);
    frameHashes.push(hash);
    if (keep.has(frameIndex)) {
      kept.push(Object.freeze({
        frameIndex,
        hash,
        width: frame.width,
        height: frame.height,
        timeMs: frame.timeMs
      }));
    }
  }

  const audio = mixAudio(plan, {
    sampleRate: options.sampleRate,
    fromMs: options.excerpt?.fromMs,
    toMs: options.excerpt?.toMs,
    inventory: input.inventory
  });
  const audioHash = await hashPcm(audio.pcm);
  const poster = await renderPoster(plan, {
    inventory: input.inventory,
    scale: options.posterScale == null ? Math.min(scale, 0.25) : options.posterScale,
    thumbnailMaxEdge: options.thumbnailMaxEdge || 160
  });
  const diagnostics = Object.freeze({
    startedAt: started,
    endedAt: Date.now(),
    scale,
    fromFrame,
    toFrame,
    droppedFrames: 0,
    lateFrames: 0,
    peakAmplitude: peakAmplitude(audio.pcm),
    posterFrame: poster.frameIndex
  });
  const pack = await buildRenderPackage({
    job: admitted.job,
    jobHash: admitted.jobHash,
    plan,
    planHash,
    frameHashes,
    audioHash,
    audio,
    sources: input.sources,
    inventory: input.inventory,
    diagnostics,
    posterBytes: poster.posterBytes,
    thumbnailBytes: poster.thumbnailBytes,
    posterHash: poster.posterHash,
    thumbnailHash: poster.thumbnailHash,
    quality: options.tier || 'final',
    excerpt: options.excerpt || null,
    captionRange: options.excerpt
      ? { fromMs: options.excerpt.fromMs, toMs: options.excerpt.toMs }
      : null
  });

  return Object.freeze({
    job: admitted.job,
    jobHash: admitted.jobHash,
    plan,
    planHash,
    decoded: Object.freeze({
      frameHashes: Object.freeze(frameHashes),
      audioHash,
      kept: Object.freeze(kept),
      peakAmplitude: diagnostics.peakAmplitude
    }),
    package: pack,
    diagnostics
  });
}

export async function renderJobTwice(input, options = {}) {
  const first = await renderJob(input, options);
  const second = await renderJob(input, options);
  const identical = first.planHash === second.planHash
    && first.decoded.audioHash === second.decoded.audioHash
    && first.decoded.frameHashes.length === second.decoded.frameHashes.length
    && first.decoded.frameHashes.every((hash, index) => hash === second.decoded.frameHashes[index]);
  return Object.freeze({ first, second, identical });
}
