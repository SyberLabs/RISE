/**
 * Render projection — Phases 0–3.
 *
 * Inventory, support, immutable job, preflight, vertical-slice render,
 * distribution packages, package verification, and the project asset
 * manifest over existing Workshop stores.
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
  contentHashOfBytes,
  parseContentHash,
  looksLikeUri
} from './hash.js';
export {
  presentationRational,
  presentationMs,
  compareFrameToDuration,
  frameCountForDuration,
  lastFrameIndex,
  frameIndexAt,
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
  pinnedRendererForProfile,
  deriveRenderJob
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
export {
  renderDistributionPackages,
  renderProfilePackage,
  renderPreview,
  DISTRIBUTION_PROFILE_IDS
} from './distribution.js';
export { verifyRenderPackage } from './verify.js';
export { RENDER_QUALITY_TIERS, qualityTier } from './quality.js';
export { owedCreditLines } from './package.js';
export {
  PROJECT_ASSET_SCHEMA,
  PROJECT_ASSET_MANIFEST_SCHEMA,
  ASSET_TRANSFER_BUNDLE_SCHEMA,
  PROJECT_ASSET_KINDS,
  PROJECT_ASSET_ORIGINS,
  PROJECT_ASSET_STORAGE_KINDS,
  ProjectAssetError,
  validateProjectAsset,
  validateProjectAssetManifest,
  defaultUploadRights,
  libraryRights,
  rightsCapabilities,
  assertDistributionAllowed,
  inventoryAssetFromProjectAsset,
  projectWorkshopMedia,
  projectPersonalSwell,
  projectLibraryAudio,
  admitTransformedAsset,
  referencedAssetIdsFromProgram,
  planAssetDeletion,
  compileProjectAssetManifest,
  packTransferBundle,
  verifyTransferBundle,
  importTransferBundle,
  recoverAssetFromBundle
} from './project-asset.js';
