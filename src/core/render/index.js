/**
 * Render projection — Phase 0 contract and Phase 1 vertical slice.
 *
 * Inventory, support registry, immutable job, virtual clock, preflight,
 * render plan, explicit-time presenters, offline audio, decoded-identity driver.
 * No Chamber coupling, no Workshop mutation, no H.264 mux yet.
 */

export { RenderError } from './errors.js';
export {
  RENDER_LIMITS,
  RENDER_PROFILES,
  RENDER_PROFILE_IDS,
  RENDER_DISTRIBUTION_CLASSES,
  RENDER_RIGHTS_STATUSES,
  renderProfile
} from './limits.js';
export {
  RENDER_JOB_SCHEMA,
  RENDER_MANIFEST_SCHEMA,
  PINNED_RENDERER,
  pinnedRendererRecord
} from './environment.js';
export {
  canonicalJson,
  contentHashOf,
  parseContentHash,
  looksLikeUri
} from './hash.js';
export {
  presentationRational,
  presentationMs,
  compareFrameToDuration,
  frameCountForDuration,
  lastFrameIndex,
  validateFrameRate
} from './clock.js';
export {
  RENDER_SUPPORT,
  RENDER_SUPPORT_KINDS,
  requiredRenderCueKinds,
  renderSupportFor,
  collectProgramCues,
  classifyCue,
  classifyProgramCues
} from './support.js';
export {
  validateRenderJob,
  admitRenderJob,
  jobFrameCount,
  pinnedRendererForProfile
} from './job.js';
export {
  PREFLIGHT_VERDICTS,
  preflightRenderJob,
  describePreflightFailure
} from './preflight.js';
export {
  compileRenderPlan,
  hashRenderPlan,
  atomAt,
  visualRunAt,
  audioRunAt
} from './plan.js';
export { mapVideoSourceTime } from './video-time.js';
export { renderFrameRgba } from './raster.js';
export { mixAudio } from './audio-mix.js';
export { captionsFromPlan, captionsToVtt, captionsToSrt } from './captions.js';
export { renderJob, renderJobTwice } from './driver.js';
export { safeAreasFor } from './layout.js';
