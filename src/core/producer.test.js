// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  AGENT_OPERATION_LIMITS,
  AGENT_OPERATION_OPS,
  AGENT_OPERATION_SET_SCHEMA
} from './agent-operations.js';
import { emptyWorkshopProject } from './workshop-project.js';
import { runProducer } from './producer.js';
import { PREFLIGHT_VERDICTS } from './render/preflight.js';

const SOURCE_ID = 'source-anna';
const SOURCE_TEXT = [
  'Happy families are all alike; every unhappy family is unhappy in its own way.',
  "Everything was in confusion in the Oblonskys' house."
].join(' ');

const ffmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
const hasFfmpeg = !ffmpeg.error && ffmpeg.status === 0;

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

describe('producer runtime', () => {
  it('keeps the 32-op ceiling and never admits or publishes', async () => {
    const produced = await runProducer({
      project: emptyWorkshopProject({ id: 'project-memory', title: 'Memory' }),
      operationSet: composeOps(),
      resolvedSources: {
        [SOURCE_ID]: { id: SOURCE_ID, name: 'Anna', data: SOURCE_TEXT }
      },
      render: false
    });
    expect(produced.admitted).toEqual([]);
    expect(produced.approved).toEqual([]);
    expect(produced.delivered).toEqual([]);
    expect(produced.preflight.verdict).toBe(PREFLIGHT_VERDICTS.RENDERABLE);
    expect(AGENT_OPERATION_LIMITS.maxOperations).toBe(32);
    expect(AGENT_OPERATION_OPS).not.toContain('admit-asset');
    expect(AGENT_OPERATION_OPS).not.toContain('publish');
  }, 20_000);

  it.skipIf(!hasFfmpeg && !process.env.CI)('request-compile muxes an MP4 for human review', async () => {
    expect(hasFfmpeg, 'CI installs ffmpeg; if it is missing, that step broke').toBe(true);
    const dir = mkdtempSync(join(tmpdir(), 'rise-producer-mp4-'));
    const outputPath = join(dir, 'experience.mp4');
    try {
      const produced = await runProducer({
        project: emptyWorkshopProject({ id: 'project-memory', title: 'Memory' }),
        operationSet: composeOps(),
        resolvedSources: {
          [SOURCE_ID]: { id: SOURCE_ID, name: 'Anna', data: SOURCE_TEXT }
        },
        tier: 'draft',
        encode: {
          painter: 'clerk',
          outputPath,
          fromMs: 0,
          toMs: 200
        }
      });
      expect(produced.stage).toBe('review-queued');
      expect(produced.admitted).toEqual([]);
      expect(produced.approved).toEqual([]);
      expect(produced.delivered).toEqual([]);
      expect(produced.preflight.verdict).toBe(PREFLIGHT_VERDICTS.RENDERABLE);
      const artifact = produced.packages['social-portrait-1080'];
      expect(artifact.mp4Path).toBe(outputPath);
      expect(artifact.package['poster.bmp']).toBeTruthy();
      expect(artifact.srt).toMatch(/-->/);
      expect(readFileSync(artifact.mp4Path).subarray(4, 8).toString()).toBe('ftyp');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it('leaves a requested asset pending and will not admit it', async () => {
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
      render: false
    });
    expect(produced.inspection.find(row => row.id === 'op-req' || row.op === 'request-asset').status)
      .toBe('pending');
    expect(produced.admitted).toEqual([]);
    expect(produced.project.assets).toEqual([]);
  });
});
