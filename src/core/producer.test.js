import { describe, expect, it } from 'vitest';
import { RIGHTS } from '../content/imagery/works.js';
import {
  AGENT_OPERATION_OPS,
  AGENT_OPERATION_SET_SCHEMA
} from './agent-operations.js';
import { createDefaultAcquisitionProviders } from './acquisition-providers.js';
import { emptyWorkshopProject } from './workshop-project.js';
import { runProducer } from './producer.js';
import {
  PUBLICATION_REVIEW_SCHEMA,
  approvePublication,
  PublicationError
} from './publication.js';
import { PREFLIGHT_VERDICTS } from './render/preflight.js';

const SOURCE_ID = 'source-anna';
const SOURCE_TEXT = [
  'Happy families are all alike; every unhappy family is unhappy in its own way.',
  "Everything was in confusion in the Oblonskys' house."
].join(' ');
const NOW = '2026-08-13T21:00:00.000Z';

function opSet(operations, overrides = {}) {
  return {
    schema: AGENT_OPERATION_SET_SCHEMA,
    id: 'ops-beast-1',
    projectId: 'project-memory',
    baseRevision: 0,
    generationId: 'run-beast',
    intent: 'Build quietly, then open into color.',
    operations,
    ...overrides
  };
}

function composeOps(extra = []) {
  return opSet([
    { op: 'add-source', id: 'op-source', sourceId: SOURCE_ID },
    {
      op: 'assign-visual',
      id: 'op-visual',
      assignmentId: 'visual-klee',
      sourceId: SOURCE_ID,
      assetId: 'procedural:klee',
      fromCharacter: 0,
      toCharacter: 40
    },
    {
      op: 'assign-audio',
      id: 'op-audio',
      assignmentId: 'bed-aurora',
      sourceId: SOURCE_ID,
      assetId: 'soundscape:aurora',
      fromCharacter: 0,
      toCharacter: SOURCE_TEXT.length
    },
    {
      op: 'set-pace',
      id: 'op-pace',
      assignmentId: 'pace-1',
      sourceId: SOURCE_ID,
      cue: { wpm: 150, chunkMode: 'phrase' }
    },
    { op: 'set-render-profile', id: 'op-profile', profileId: 'social-portrait-1080' },
    { op: 'request-compile', id: 'op-compile' },
    ...extra
  ]);
}

function jpegBytes() {
  const bytes = new Uint8Array(64).fill(7);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xe0;
  return bytes;
}

describe('producer runtime', () => {
  it('runs intent → score → private pack → review queue without admitting or publishing', async () => {
    const produced = await runProducer({
      project: emptyWorkshopProject({ id: 'project-memory', title: 'Memory' }),
      operationSet: composeOps(),
      resolvedSources: {
        [SOURCE_ID]: { id: SOURCE_ID, name: 'Anna', data: SOURCE_TEXT }
      },
      now: NOW,
      tier: 'draft'
    });
    expect(produced.stage).toBe('review-queued');
    expect(produced.admitted).toEqual([]);
    expect(produced.approved).toEqual([]);
    expect(produced.delivered).toEqual([]);
    expect(produced.preflight.verdict).toBe(PREFLIGHT_VERDICTS.RENDERABLE);
    expect(produced.packages['social-portrait-1080'].package['poster.bmp']).toBeTruthy();
    expect(produced.reviewItems).toHaveLength(1);
    expect(produced.reviewItems[0].schema).toBe(PUBLICATION_REVIEW_SCHEMA);
    expect(produced.reviewItems[0].status).toBe('queued');
    expect(produced.reviewItems[0].rights.distributionClass).toBe('private-review');
    expect(AGENT_OPERATION_OPS).not.toContain('admit-asset');
    expect(AGENT_OPERATION_OPS).not.toContain('publish');
    try {
      approvePublication({
        item: produced.reviewItems[0],
        approval: {
          schema: 'rise.publication-approval.v1',
          reviewItemId: produced.reviewItems[0].id,
          artifactHash: produced.reviewItems[0].artifact.packageHash,
          decision: 'approve',
          actor: 'human',
          authority: 'user',
          watchedArtifact: true,
          decidedAt: NOW
        }
      });
      throw new Error('expected refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(PublicationError);
      expect(error.code).toBe('PUBLICATION_RIGHTS_UNRESOLVED');
    }
  }, 30_000);

  it('inspects a requested asset and will not admit it', async () => {
    const jpeg = jpegBytes();
    const produced = await runProducer({
      project: emptyWorkshopProject({ id: 'project-memory', title: 'Memory' }),
      operationSet: composeOps([{
        op: 'request-asset',
        id: 'op-req',
        requestId: 'rain-window',
        kind: 'image',
        query: 'aic:27992'
      }]),
      resolvedSources: {
        [SOURCE_ID]: { id: SOURCE_ID, name: 'Anna', data: SOURCE_TEXT }
      },
      providers: createDefaultAcquisitionProviders({
        resolveWork: async () => ({
          id: 'aic:27992',
          title: 'The Bedroom',
          artist: 'Vincent van Gogh',
          rights: RIGHTS.CC0,
          imageUrl: 'https://www.artic.edu/iiif/2/2d484387-2509-5e8e-2c43-22f2526b23a8/full/843,/0/default.jpg',
          sourceName: 'Art Institute of Chicago',
          sourceUrl: 'https://www.artic.edu/artworks/27992'
        }),
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          type: 'basic',
          headers: { get: () => 'image/jpeg' },
          arrayBuffer: async () => jpeg.buffer
        })
      }),
      render: false,
      now: NOW
    });
    expect(produced.acquisition).toHaveLength(1);
    expect(produced.acquisition[0].admitted).toBe(false);
    expect(produced.acquisition[0].status).toBe('pending');
    expect(produced.acquisition[0].candidates.length).toBeGreaterThan(0);
    expect(produced.admitted).toEqual([]);
    expect(produced.project.assets).toEqual([]);
  }, 20_000);
});
