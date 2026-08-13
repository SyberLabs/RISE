/**
 * Rights-safe vertical-slice composition for Phase 1.
 * One source, one image, one Klee field, one muted MP4, one audio bed.
 */

import {
  EXPERIENCE_PROGRAM_SCHEMA,
  validateExperienceProgram
} from '../experience-program.js';
import { compileSession } from '../session-compiler.js';
import { SEQUENCE_ASSET_PREFIX } from '../visual-score-lane.js';
import { contentHashOf } from './hash.js';
import { RENDER_JOB_SCHEMA } from './environment.js';
import { pinnedRendererForProfile } from './job.js';

export const SLICE_SOURCE_ID = 'source-1';
export const SLICE_IMAGE_ID = 'asset-rain-window';
export const SLICE_VIDEO_ID = 'asset-water';

export const SLICE_TEXT = [
  'Happy families are all alike; every unhappy family is unhappy in its own way.',
  "Everything was in confusion in the Oblonskys' house.",
  'The wife had discovered that the husband was carrying on an intrigue with a French girl,',
  'who had been a governess in their family, and she had announced to her husband',
  'that she could not go on living in the same house with him.'
].join(' ');

export function sliceSequenceAssets() {
  return [
    {
      id: SLICE_IMAGE_ID,
      kind: 'image',
      name: 'Rain window',
      storage: 'idb',
      mimeType: 'image/png',
      byteLength: 48_000
    },
    {
      id: SLICE_VIDEO_ID,
      kind: 'video',
      name: 'Moving water',
      storage: 'idb',
      mimeType: 'video/mp4',
      byteLength: 1_200_000,
      durationMs: 4000,
      timeMode: 'loop',
      audioPolicy: 'muted'
    }
  ];
}

export function sliceProgram() {
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
          anchor: { sourceIds: [SLICE_SOURCE_ID] },
          data: { index: 0, title: 'One' }
        }]
      },
      {
        id: 'visual-main',
        kind: 'visual',
        clips: [
          {
            id: 'still-1',
            anchor: { sourceIds: [SLICE_SOURCE_ID], fromProgress: 0, toProgress: 0.2 },
            cue: { kind: 'still' }
          },
          {
            id: 'image-1',
            anchor: { sourceIds: [SLICE_SOURCE_ID], fromProgress: 0.2, toProgress: 0.45 },
            cue: {
              kind: 'sourced',
              collections: [`${SEQUENCE_ASSET_PREFIX}${SLICE_IMAGE_ID}`]
            }
          },
          {
            id: 'klee-1',
            anchor: { sourceIds: [SLICE_SOURCE_ID], fromProgress: 0.45, toProgress: 0.75 },
            cue: { kind: 'procedural', collections: ['klee'] }
          },
          {
            id: 'video-1',
            anchor: { sourceIds: [SLICE_SOURCE_ID], fromProgress: 0.75, toProgress: 1 },
            cue: {
              kind: 'video',
              assetId: SLICE_VIDEO_ID,
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
          anchor: { sourceIds: [SLICE_SOURCE_ID] },
          cue: { kind: 'soundscape', soundscapeId: 'aurora', fadeMs: 500 }
        }],
        fallback: { kind: 'silence', fadeMs: 500 }
      },
      {
        id: 'reading',
        kind: 'reading',
        clips: [{
          id: 'pace-1',
          anchor: { sourceIds: [SLICE_SOURCE_ID] },
          cue: { kind: 'pace', wpm: 160, chunkMode: 'phrase' }
        }]
      }
    ]
  });
}

export function sliceSources() {
  return [{
    id: SLICE_SOURCE_ID,
    name: 'Anna Karenina · I',
    data: SLICE_TEXT,
    metadata: { author: 'Leo Tolstoy' }
  }];
}

export function sliceSessionInput() {
  return {
    wpm: 160,
    chunkMode: 'phrase',
    curve: 'flat',
    sequenceVisualAssets: sliceSequenceAssets()
  };
}

export async function buildVerticalSlice() {
  const program = sliceProgram();
  const sources = sliceSources();
  const sessionInput = sliceSessionInput();
  const session = compileSession({
    ...sessionInput,
    experienceProgram: program,
    sources
  });
  const programHash = await contentHashOf(program);
  const sourceHash = await contentHashOf(SLICE_TEXT);
  const imageHash = await contentHashOf(`${SLICE_IMAGE_ID}:bytes`);
  const videoHash = await contentHashOf(`${SLICE_VIDEO_ID}:bytes`);
  const job = {
    schema: RENDER_JOB_SCHEMA,
    id: 'render-memory-portrait-001',
    projectId: 'project-memory',
    projectRevision: 18,
    programHash,
    sourceSnapshots: [{ sourceId: SLICE_SOURCE_ID, contentHash: sourceHash, editionId: 'slice-anna-1' }],
    assetSnapshots: [
      { assetId: SLICE_IMAGE_ID, contentHash: imageHash },
      { assetId: SLICE_VIDEO_ID, contentHash: videoHash }
    ],
    profile: 'social-portrait-1080',
    viewport: { width: 1080, height: 1920, pixelRatio: 1 },
    frameRate: { numerator: 30, denominator: 1 },
    durationMs: session.totalDuration,
    seed: 'project-memory:18',
    renderer: pinnedRendererForProfile('social-portrait-1080'),
    policies: {
      unsupportedCue: 'refuse',
      missingAsset: 'refuse',
      reducedMotion: false,
      includeCredits: true,
      distributionClass: 'private-review'
    }
  };
  const inventory = {
    sources: [{
      sourceId: SLICE_SOURCE_ID,
      contentHash: sourceHash,
      byteLength: SLICE_TEXT.length,
      characterCount: SLICE_TEXT.length
    }],
    assets: [
      {
        assetId: SLICE_IMAGE_ID,
        contentHash: imageHash,
        kind: 'image',
        mimeType: 'image/png',
        byteLength: 48_000,
        rights: { status: 'verified', distributionAllowed: true, credit: 'User photograph' }
      },
      {
        assetId: SLICE_VIDEO_ID,
        contentHash: videoHash,
        kind: 'video',
        mimeType: 'video/mp4',
        byteLength: 1_200_000,
        durationMs: 4000,
        rights: { status: 'verified', distributionAllowed: true, credit: 'User recording' }
      }
    ]
  };
  return { program, sources, session, sessionInput, job, inventory };
}
