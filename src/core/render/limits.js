/**
 * Render-specific ceilings. Stricter than READING_LIMITS where export
 * budgets demand it; never looser. UI controls do not own these numbers.
 */

import { READING_LIMITS } from '../reading-limits.js';
import { EXPERIENCE_PROGRAM_LIMITS } from '../experience-program.js';

export const RENDER_LIMITS = Object.freeze({
  maxIdLength: EXPERIENCE_PROGRAM_LIMITS.maxIdLength,
  maxSeedLength: 160,
  maxAssets: READING_LIMITS.maxSequenceAssets,
  maxSources: READING_LIMITS.maxSources,
  maxAtoms: READING_LIMITS.maxAtoms,
  maxImageFileBytes: READING_LIMITS.maxImageFileBytes,
  maxVideoFileBytes: READING_LIMITS.maxVideoFileBytes,
  maxAudioFileBytes: 32 * 1024 * 1024,
  maxOutputBytes: 256 * 1024 * 1024,
  maxTemporaryBytes: 512 * 1024 * 1024,
  maxTransferAssets: READING_LIMITS.maxSequenceAssets,
  maxTransferBytes: 128 * 1024 * 1024,
  maxDecodedPixels: 1920 * 1080,
  maxVideoDurationMs: 120_000,
  maxFrames: 90_000,
  maxFrameRateNumerator: 120,
  maxFrameRateDenominator: 1001,
  maxPixelRatio: 2,
  minDurationMs: 1,
  maxDurationMs: 1_800_000,
  maxTitleLength: 200
});

export const RENDER_DISTRIBUTION_CLASSES = Object.freeze(['private-review', 'public']);
export const RENDER_RIGHTS_STATUSES = Object.freeze([
  'verified', 'restricted', 'unknown', 'user-asserted'
]);

/**
 * Versioned projection policies. A profile may change layout, not text,
 * cues, or assets.
 */
export const RENDER_PROFILES = Object.freeze({
  'social-portrait-1080': Object.freeze({
    id: 'social-portrait-1080',
    viewport: Object.freeze({ width: 1080, height: 1920, pixelRatio: 1 }),
    frameRate: Object.freeze({ numerator: 30, denominator: 1 }),
    codecProfile: 'h264-social-v1',
    minDurationMs: 1_000,
    maxDurationMs: 90_000,
    loudnessLufs: -14,
    truePeakDbtp: -1,
    captionMode: 'sidecar-and-burn-in',
    credits: 'sidecar-and-closing-card',
    includeCredits: true
  }),
  'social-square-1080': Object.freeze({
    id: 'social-square-1080',
    viewport: Object.freeze({ width: 1080, height: 1080, pixelRatio: 1 }),
    frameRate: Object.freeze({ numerator: 30, denominator: 1 }),
    codecProfile: 'h264-social-v1',
    minDurationMs: 1_000,
    maxDurationMs: 90_000,
    loudnessLufs: -14,
    truePeakDbtp: -1,
    captionMode: 'sidecar-and-burn-in',
    credits: 'sidecar-and-closing-card',
    includeCredits: true
  }),
  'cinema-landscape-1080': Object.freeze({
    id: 'cinema-landscape-1080',
    viewport: Object.freeze({ width: 1920, height: 1080, pixelRatio: 1 }),
    frameRate: Object.freeze({ numerator: 30, denominator: 1 }),
    codecProfile: 'h264-social-v1',
    minDurationMs: 1_000,
    maxDurationMs: 600_000,
    loudnessLufs: -16,
    truePeakDbtp: -1,
    captionMode: 'sidecar',
    credits: 'sidecar-and-closing-card',
    includeCredits: true
  }),
  'archive-master-1080': Object.freeze({
    id: 'archive-master-1080',
    viewport: Object.freeze({ width: 1920, height: 1080, pixelRatio: 1 }),
    frameRate: Object.freeze({ numerator: 30, denominator: 1 }),
    codecProfile: 'h264-social-v1',
    minDurationMs: 1_000,
    maxDurationMs: 600_000,
    loudnessLufs: -16,
    truePeakDbtp: -1,
    captionMode: 'sidecar',
    credits: 'sidecar',
    includeCredits: true
  }),
  'keystone-landscape-1080': Object.freeze({
    id: 'keystone-landscape-1080',
    viewport: Object.freeze({ width: 1920, height: 1080, pixelRatio: 1 }),
    frameRate: Object.freeze({ numerator: 30, denominator: 1 }),
    codecProfile: 'h264-social-v1',
    minDurationMs: 1_000,
    maxDurationMs: 1_800_000,
    loudnessLufs: -16,
    truePeakDbtp: -1,
    captionMode: 'sidecar',
    credits: 'sidecar-and-closing-card',
    includeCredits: true
  })
});

export const RENDER_PROFILE_IDS = Object.freeze(Object.keys(RENDER_PROFILES));

export function renderProfile(id) {
  return RENDER_PROFILES[id] || null;
}
