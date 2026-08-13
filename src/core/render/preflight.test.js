import { describe, expect, it } from 'vitest';
import {
  EXPERIENCE_PROGRAM_SCHEMA,
  validateExperienceProgram
} from '../experience-program.js';
import { SEQUENCE_ASSET_PREFIX } from '../visual-score-lane.js';
import { contentHashOf } from './hash.js';
import { RENDER_JOB_SCHEMA } from './environment.js';
import { pinnedRendererForProfile } from './job.js';
import {
  PREFLIGHT_VERDICTS,
  describePreflightFailure,
  preflightRenderJob
} from './preflight.js';

const IMAGE_ID = 'asset-rain-window';
const VIDEO_ID = 'asset-water';
const SOURCE_ID = 'source-1';

function sliceProgram() {
  return validateExperienceProgram({
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id: 'slice-memory',
    authority: 'user',
    editable: true,
    tracks: [
      {
        id: 'movements',
        kind: 'movement',
        clips: [{
          id: 'm1',
          anchor: { sourceIds: [SOURCE_ID] },
          data: { index: 0, title: 'One' }
        }]
      },
      {
        id: 'visual-main',
        kind: 'visual',
        clips: [
          {
            id: 'still-1',
            anchor: { sourceIds: [SOURCE_ID], fromProgress: 0, toProgress: 0.25 },
            cue: { kind: 'still' }
          },
          {
            id: 'image-1',
            anchor: { sourceIds: [SOURCE_ID], fromProgress: 0.25, toProgress: 0.5 },
            cue: {
              kind: 'sourced',
              collections: [`${SEQUENCE_ASSET_PREFIX}${IMAGE_ID}`]
            }
          },
          {
            id: 'klee-1',
            anchor: { sourceIds: [SOURCE_ID], fromProgress: 0.5, toProgress: 0.75 },
            cue: { kind: 'procedural', collections: ['klee'] }
          },
          {
            id: 'video-1',
            anchor: { sourceIds: [SOURCE_ID], fromProgress: 0.75, toProgress: 1 },
            cue: {
              kind: 'video',
              assetId: VIDEO_ID,
              timeMode: 'loop',
              audioPolicy: 'muted',
              reducedMotion: 'poster'
            }
          }
        ],
        fallback: { kind: 'still' }
      },
      {
        id: 'audio-bed',
        kind: 'audio',
        clips: [{
          id: 'bed-1',
          anchor: { sourceIds: [SOURCE_ID] },
          cue: { kind: 'soundscape', soundscapeId: 'aurora', fadeMs: 500 }
        }],
        fallback: { kind: 'silence', fadeMs: 500 }
      },
      {
        id: 'reading',
        kind: 'reading',
        clips: [{
          id: 'pace-1',
          anchor: { sourceIds: [SOURCE_ID] },
          cue: { kind: 'pace', wpm: 160, chunkMode: 'phrase' }
        }]
      }
    ]
  });
}

function genesisProgram() {
  return validateExperienceProgram({
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id: 'genesis-score',
    authority: 'user',
    editable: true,
    tracks: [
      {
        id: 'movements',
        kind: 'movement',
        clips: [{
          id: 'm1',
          anchor: { sourceIds: [SOURCE_ID] },
          data: { index: 0, title: 'One' }
        }]
      },
      {
        id: 'visual-main',
        kind: 'visual',
        clips: [{
          id: 'g1',
          anchor: { sourceIds: [SOURCE_ID] },
          cue: { kind: 'field', renderer: 'genesis', config: { preset: 'harmonic' } }
        }],
        fallback: { kind: 'still' }
      }
    ]
  });
}

async function jobFor(program, overrides = {}) {
  const programHash = await contentHashOf(program);
  const sourceHash = await contentHashOf(`${SOURCE_ID}:edition`);
  const imageHash = await contentHashOf(`${IMAGE_ID}:bytes`);
  const videoHash = await contentHashOf(`${VIDEO_ID}:bytes`);
  return {
    schema: RENDER_JOB_SCHEMA,
    id: 'render-memory-portrait-001',
    projectId: 'project-memory',
    projectRevision: 18,
    programHash,
    sourceSnapshots: [{ sourceId: SOURCE_ID, contentHash: sourceHash }],
    assetSnapshots: [
      { assetId: IMAGE_ID, contentHash: imageHash },
      { assetId: VIDEO_ID, contentHash: videoHash }
    ],
    profile: 'social-portrait-1080',
    viewport: { width: 1080, height: 1920, pixelRatio: 1 },
    frameRate: { numerator: 30, denominator: 1 },
    durationMs: 24000,
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

function inventoryFor(job, rightsStatus = 'verified') {
  const image = job.assetSnapshots.find(item => item.assetId === IMAGE_ID);
  const video = job.assetSnapshots.find(item => item.assetId === VIDEO_ID);
  return {
    sources: job.sourceSnapshots.map(snapshot => ({
      sourceId: snapshot.sourceId,
      contentHash: snapshot.contentHash,
      byteLength: 1200,
      characterCount: 400
    })),
    assets: [
      image && {
        assetId: image.assetId,
        contentHash: image.contentHash,
        kind: 'image',
        mimeType: 'image/png',
        byteLength: 48_000,
        rights: { status: rightsStatus, distributionAllowed: rightsStatus === 'verified' }
      },
      video && {
        assetId: video.assetId,
        contentHash: video.contentHash,
        kind: 'video',
        mimeType: 'video/mp4',
        byteLength: 1_200_000,
        rights: { status: rightsStatus, distributionAllowed: rightsStatus === 'verified' }
      }
    ].filter(Boolean)
  };
}

describe('render preflight', () => {
  it('accepts the vertical-slice score against a matching job and inventory', async () => {
    const program = sliceProgram();
    const job = await jobFor(program);
    const report = await preflightRenderJob({
      job,
      program,
      inventory: inventoryFor(job)
    });
    expect(report.verdict).toBe(PREFLIGHT_VERDICTS.RENDERABLE);
    expect(report.frameCount).toBe(720);
    expect(report.refusals).toEqual([]);
    expect(report.cues.every(item => item.render === 'native')).toBe(true);
  });

  it('refuses an unsupported required cue instead of omitting it', async () => {
    const program = genesisProgram();
    const job = await jobFor(program, { assetSnapshots: [] });
    const report = await preflightRenderJob({
      job,
      program,
      inventory: {
        sources: job.sourceSnapshots.map(snapshot => ({
          sourceId: snapshot.sourceId,
          contentHash: snapshot.contentHash,
          byteLength: 100,
          characterCount: 40
        })),
        assets: []
      }
    });
    expect(report.verdict).toBe(PREFLIGHT_VERDICTS.REFUSED);
    expect(report.refusals.some(item => item.code === 'RENDER_CUE_UNSUPPORTED')).toBe(true);
    expect(describePreflightFailure(report)).toMatch(/Genesis fields/i);
    expect(describePreflightFailure(report)).toMatch(/Replace this cue/);
  });

  it('refuses a program that does not match the job hash', async () => {
    const program = sliceProgram();
    const other = genesisProgram();
    const job = await jobFor(program);
    const report = await preflightRenderJob({
      job,
      program: other,
      inventory: inventoryFor(job)
    });
    expect(report.verdict).toBe(PREFLIGHT_VERDICTS.REFUSED);
    expect(report.refusals.map(item => item.code)).toContain('RENDER_PROGRAM_HASH_MISMATCH');
  });

  it('refuses a missing hashed asset', async () => {
    const program = sliceProgram();
    const job = await jobFor(program);
    const inventory = inventoryFor(job);
    inventory.assets = inventory.assets.filter(asset => asset.assetId !== VIDEO_ID);
    const report = await preflightRenderJob({ job, program, inventory });
    expect(report.verdict).toBe(PREFLIGHT_VERDICTS.REFUSED);
    expect(report.refusals.map(item => item.code)).toContain('RENDER_ASSET_MISSING');
  });

  it('allows unresolved rights for private review and blocks public distribution', async () => {
    const program = sliceProgram();
    const privateJob = await jobFor(program);
    const privateReport = await preflightRenderJob({
      job: privateJob,
      program,
      inventory: inventoryFor(privateJob, 'unknown')
    });
    expect(privateReport.verdict).toBe(PREFLIGHT_VERDICTS.RENDERABLE);
    expect(privateReport.rights.unresolved.length).toBeGreaterThan(0);
    expect(privateReport.rights.blocksPublic).toBe(false);

    const publicJob = await jobFor(program, {
      policies: {
        unsupportedCue: 'refuse',
        missingAsset: 'refuse',
        reducedMotion: false,
        includeCredits: true,
        distributionClass: 'public'
      }
    });
    const publicReport = await preflightRenderJob({
      job: publicJob,
      program,
      inventory: inventoryFor(publicJob, 'unknown')
    });
    expect(publicReport.verdict).toBe(PREFLIGHT_VERDICTS.REFUSED);
    expect(publicReport.refusals.map(item => item.code)).toContain('RENDER_RIGHTS_UNRESOLVED');
    expect(publicReport.rights.blocksPublic).toBe(true);
  });
});
