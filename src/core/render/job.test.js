import { describe, expect, it } from 'vitest';
import { RENDER_JOB_SCHEMA, PINNED_RENDERER } from './environment.js';
import { admitRenderJob, pinnedRendererForProfile, validateRenderJob } from './job.js';
import { RenderError } from './errors.js';
import { contentHashOf, looksLikeUri } from './hash.js';

const HASH_A = `sha256:${'ab'.repeat(32)}`;
const HASH_B = `sha256:${'cd'.repeat(32)}`;

function jobInput(overrides = {}) {
  return {
    schema: RENDER_JOB_SCHEMA,
    id: 'render-memory-portrait-001',
    projectId: 'project-memory',
    projectRevision: 18,
    programHash: HASH_A,
    sourceSnapshots: [
      { sourceId: 'source-1', contentHash: HASH_B, editionId: 'edition-1' }
    ],
    assetSnapshots: [
      { assetId: 'asset-rain-window', contentHash: HASH_A }
    ],
    profile: 'social-portrait-1080',
    viewport: { width: 1080, height: 1920, pixelRatio: 1 },
    frameRate: { numerator: 30, denominator: 1 },
    durationMs: 27400,
    seed: 'project-memory:18',
    renderer: pinnedRendererForProfile('social-portrait-1080'),
    policies: {
      unsupportedCue: 'refuse',
      missingAsset: 'refuse',
      reducedMotion: false,
      includeCredits: true,
      distributionClass: 'private-review'
    },
    ...overrides
  };
}

describe('rise.render-job.v1', () => {
  it('returns a detached immutable job and a content hash', async () => {
    const input = jobInput();
    const { job, jobHash } = await admitRenderJob(input);
    expect(job).not.toBe(input);
    expect(Object.isFrozen(job)).toBe(true);
    expect(job.schema).toBe(RENDER_JOB_SCHEMA);
    expect(job.renderer.version).toBe(PINNED_RENDERER.version);
    expect(jobHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(await contentHashOf(job)).toBe(jobHash);
    expect(validateRenderJob(JSON.parse(JSON.stringify(job)))).toEqual(job);
  });

  it('hashes two identical admitted jobs the same way', async () => {
    const first = await admitRenderJob(jobInput());
    const second = await admitRenderJob(jobInput());
    expect(first.jobHash).toBe(second.jobHash);
  });

  it('refuses a remote URL as an asset identity', () => {
    expect(() => validateRenderJob(jobInput({
      assetSnapshots: [{ assetId: 'https://example.com/rain.png', contentHash: HASH_A }]
    }))).toThrow(expect.objectContaining({ code: 'RENDER_URI_REFUSED' }));
    expect(looksLikeUri('https://example.com/rain.png')).toBe(true);
  });

  it('refuses omitting unsupported cues or dropping required credits', () => {
    expect(() => validateRenderJob(jobInput({
      policies: {
        unsupportedCue: 'omit',
        missingAsset: 'refuse',
        reducedMotion: false,
        includeCredits: true,
        distributionClass: 'private-review'
      }
    }))).toThrow(expect.objectContaining({ code: 'RENDER_JOB_POLICY' }));

    expect(() => validateRenderJob(jobInput({
      policies: {
        unsupportedCue: 'refuse',
        missingAsset: 'refuse',
        reducedMotion: false,
        includeCredits: false,
        distributionClass: 'private-review'
      }
    }))).toThrow(expect.objectContaining({ code: 'RENDER_JOB_CREDITS_REQUIRED' }));
  });

  it('refuses a viewport that does not match the named profile', () => {
    expect(() => validateRenderJob(jobInput({
      viewport: { width: 1920, height: 1080, pixelRatio: 1 }
    }))).toThrow(expect.objectContaining({ code: 'RENDER_JOB_VIEWPORT_PROFILE' }));
  });

  it('refuses an unknown field rather than dropping it', () => {
    expect(() => validateRenderJob(jobInput({ encoderPreset: 'fast' })))
      .toThrow(expect.objectContaining({ code: 'RENDER_JOB_UNKNOWN_FIELD' }));
  });
});
