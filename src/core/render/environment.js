/**
 * Pinned first renderer environment and codec profile.
 *
 * Reproducibility is bounded to this pin. “Deterministic” here means the
 * declared criterion below — not pixel identity across arbitrary GPUs or
 * browser builds. Font bytes are not yet shipped; the hash is the digest of
 * the pack id and will be replaced by the admitted pack hash in Phase 1.
 */

export const RENDER_JOB_SCHEMA = 'rise.render-job.v1';
export const RENDER_MANIFEST_SCHEMA = 'rise.render-manifest.v1';

export const PINNED_RENDERER = Object.freeze({
  version: 'rise-renderer/0.1.0',
  environment: 'rise-render-env/1',
  fontPackId: 'rise-font-pack/0.1',
  fontPackHash: 'sha256:3282ce85a3c442fedf38ec68b01833a9281a2d159c7d217a1e9a5aa34373615b',
  codecProfile: 'h264-social-v1',
  /**
   * Identical decoded frames and mixed audio samples under this pin.
   * Encoded container bytes are not claimed identical.
   */
  determinismCriterion: 'decoded-identity'
});

export function pinnedRendererRecord() {
  return Object.freeze({
    version: PINNED_RENDERER.version,
    environment: PINNED_RENDERER.environment,
    fontPackHash: PINNED_RENDERER.fontPackHash,
    codecProfile: PINNED_RENDERER.codecProfile
  });
}
