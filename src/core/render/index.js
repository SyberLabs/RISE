/**
 * Render projection — Phase 0 contract.
 *
 * Inventory, support registry, immutable job, virtual clock, and preflight.
 * No encoder, no Chamber coupling, no Workshop mutation.
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
