/**
 * Quality tiers and distribution profile set.
 *
 * Draft is the cheap preview loop. Final is the full-resolution pin.
 * Profiles change layout only — never source text, cues, or assets.
 */

export const RENDER_QUALITY_TIERS = Object.freeze({
  draft: Object.freeze({
    id: 'draft',
    scale: 0.25,
    posterScale: 0.25,
    sampleRate: 24_000,
    thumbnailMaxEdge: 160
  }),
  final: Object.freeze({
    id: 'final',
    scale: 1,
    posterScale: 1,
    sampleRate: 48_000,
    thumbnailMaxEdge: 320
  })
});

export const DISTRIBUTION_PROFILE_IDS = Object.freeze([
  'social-portrait-1080',
  'social-square-1080',
  'cinema-landscape-1080'
]);

export function qualityTier(id = 'draft') {
  return RENDER_QUALITY_TIERS[id] || RENDER_QUALITY_TIERS.draft;
}
