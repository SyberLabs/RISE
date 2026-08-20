// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { AGENT_OPERATION_SET_SCHEMA } from './agent-operations.js';
import { emptyWorkshopProject } from './workshop-project.js';
import { runProducer } from './producer.js';

const SOURCE_ID = 'source-anna';
const SOURCE_TEXT = [
  'Happy families are all alike; every unhappy family is unhappy in its own way.',
  "Everything was in confusion in the Oblonskys' house."
].join(' ');

const ffmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
const hasFfmpeg = !ffmpeg.error && ffmpeg.status === 0;

const HERE = dirname(fileURLToPath(import.meta.url));

function compileOps() {
  return {
    schema: AGENT_OPERATION_SET_SCHEMA,
    id: 'ops-compile-final',
    projectId: 'project-memory',
    baseRevision: 0,
    generationId: 'run-compile-final',
    intent: 'Compile is a file.',
    operations: [
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
      { op: 'request-compile', id: 'op-compile' }
    ]
  };
}

describe('producer compile is final', () => {
  it('does not route compile through poster-package functions', () => {
    const producerSrc = readFileSync(join(HERE, 'producer.js'), 'utf8');
    const intakeSrc = readFileSync(join(HERE, 'render', 'intake.js'), 'utf8');
    expect(producerSrc).toMatch(/renderArtifact/);
    expect(producerSrc).toMatch(/tier: 'final'/);
    expect(producerSrc).not.toMatch(/renderProfilePackage|renderDistributionPackages/);
    expect(intakeSrc).toMatch(/tier: 'final'/);
    expect(intakeSrc).not.toMatch(/renderProfilePackage|renderDistributionPackages/);
  });

  it.skipIf(!hasFfmpeg && !process.env.CI)('request-compile muxes a final 1080×1920 MP4 via renderArtifact', async () => {
    expect(hasFfmpeg, 'CI installs ffmpeg; if it is missing, that step broke').toBe(true);
    const dir = mkdtempSync(join(tmpdir(), 'rise-compile-final-'));
    const outputPath = join(dir, 'experience.mp4');
    try {
      const produced = await runProducer({
        project: emptyWorkshopProject({ id: 'project-memory', title: 'Memory' }),
        operationSet: compileOps(),
        resolvedSources: {
          [SOURCE_ID]: { id: SOURCE_ID, name: 'Anna', data: SOURCE_TEXT }
        },
        proposePublication: false,
        tier: 'draft',
        encode: {
          painter: 'clerk',
          outputPath,
          fromMs: 0,
          toMs: 200
        }
      });
      const artifact = produced.packages['social-portrait-1080'];
      expect(artifact.mp4Path).toBe(outputPath);
      expect(artifact.job.profile).toBe('social-portrait-1080');
      expect(artifact.job.viewport).toEqual({ width: 1080, height: 1920, pixelRatio: 1 });
      expect(artifact.package['render-manifest.json'].quality).toBe('final');
      expect(artifact.package['render-manifest.json'].profile).toBe('social-portrait-1080');
      expect(artifact.package['render-manifest.json'].viewport).toEqual({
        width: 1080, height: 1920, pixelRatio: 1
      });
      expect(artifact.encoded.width).toBe(1080);
      expect(artifact.encoded.height).toBe(1920);
      expect(readFileSync(artifact.mp4Path).subarray(4, 8).toString()).toBe('ftyp');
      expect(produced.packages.preview).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
