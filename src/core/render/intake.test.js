// @vitest-environment node
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXPERIENCE_PROGRAM_SCHEMA } from '../experience-program.js';
import { AGENT_OPERATION_SET_SCHEMA } from '../agent-operations.js';
import { KERNEL_REQUEST_SCHEMA } from './kernel-request.js';

vi.mock('./artifact.js', () => ({
  renderArtifact: vi.fn(async request => ({
    mp4Path: request.outputPath,
    srt: '1\n00:00:00,000 --> 00:00:00,200\nHello\n',
    poster: new Uint8Array([0x42, 0x4d]),
    manifest: { schema: 'rise.render-manifest.v1', profile: request.profileId },
    jobHash: `sha256:${'a'.repeat(64)}`,
    job: { profile: request.profileId },
    plan: { frameCount: 6, durationMs: 200 },
    package: { 'captions.srt': '1\n00:00:00,000 --> 00:00:00,200\nHello\n' },
    encoded: { path: request.outputPath, width: 108, height: 192, codec: 'h264', encoder: 'libx264' }
  }))
}));

vi.mock('../producer.js', () => ({
  runProducer: vi.fn(async ({ encode }) => ({
    stage: 'review-queued',
    job: { profile: 'social-portrait-1080' },
    packages: {
      'social-portrait-1080': {
        mp4Path: encode.outputPath,
        srt: '1\n00:00:00,000 --> 00:00:00,200\nHello\n',
        poster: new Uint8Array([0x42, 0x4d]),
        manifest: { schema: 'rise.render-manifest.v1' },
        jobHash: `sha256:${'b'.repeat(64)}`,
        job: { profile: 'social-portrait-1080' },
        plan: { frameCount: 6, durationMs: 200 },
        package: {},
        encoded: { path: encode.outputPath, width: 1080, height: 1920 }
      }
    }
  }))
}));

const {
  classifyRenderDocument,
  kernelRequestFromDocument,
  materializeExportJob,
  parseRenderCliArgs,
  renderFromDocument
} = await import('./intake.js');
const { renderArtifact } = await import('./artifact.js');
const { runProducer } = await import('../producer.js');

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '../../../scripts/render-mp4.mjs');

const program = {
  schema: EXPERIENCE_PROGRAM_SCHEMA,
  id: 'cli-score',
  authority: 'user',
  editable: true,
  tracks: [{
    id: 'movements',
    kind: 'movement',
    clips: [{
      id: 'm1',
      anchor: { sourceIds: ['source-anna'] },
      data: { index: 0, title: 'One' }
    }]
  }]
};

const sources = [{ id: 'source-anna', name: 'Anna', data: 'Happy families are all alike.' }];

const operationSet = {
  schema: AGENT_OPERATION_SET_SCHEMA,
  id: 'ops-cli',
  projectId: 'project-memory',
  baseRevision: 0,
  operations: [
    { op: 'add-source', id: 'op-source', sourceId: 'source-anna' },
    { op: 'set-render-profile', id: 'op-profile', profileId: 'social-portrait-1080' }
  ]
};

const dirs = [];
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'rise-intake-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.mocked(renderArtifact).mockClear();
  vi.mocked(runProducer).mockClear();
  while (dirs.length) {
    rmSync(dirs.pop(), { recursive: true, force: true });
  }
});

describe('parseRenderCliArgs', () => {
  it('requires program or op-set JSON and keeps scale/painter/out', () => {
    expect(parseRenderCliArgs([]).error).toMatch(/Missing input JSON/);
    const parsed = parseRenderCliArgs([
      'score.json', '--scale', '0.25', '--painter', 'clerk', '--out', 'out/reel'
    ], { cwd: process.cwd() });
    expect(parsed.scale).toBe(0.25);
    expect(parsed.painter).toBe('clerk');
    expect(parsed.profileId).toBe('social-portrait-1080');
    expect(parsed.mp4Path).toBe(join(process.cwd(), 'out', 'reel', 'experience.mp4'));
    expect(parsed.help).toBeUndefined();
  });

  it('prints help without requiring a file', () => {
    expect(parseRenderCliArgs(['--help'])).toEqual({ help: true });
  });
});

describe('render intake', () => {
  it('classifies program, op-set, kernel request, and wrappers', () => {
    expect(classifyRenderDocument(program)).toBe('program');
    expect(classifyRenderDocument(operationSet)).toBe('operations');
    expect(classifyRenderDocument({
      schema: KERNEL_REQUEST_SCHEMA,
      program
    })).toBe('kernel');
    expect(classifyRenderDocument({ program, sources })).toBe('program-envelope');
    expect(classifyRenderDocument({
      operationSet,
      resolvedSources: { 'source-anna': { data: sources[0].data } }
    })).toBe('operations-envelope');
  });

  it('refuses a program with no source text', () => {
    expect(() => kernelRequestFromDocument(program)).toThrow(/source text/);
  });

  it('wraps a program plus sources as a kernel request and calls renderArtifact', async () => {
    const dir = tempDir();
    const outputPath = join(dir, 'experience.mp4');
    await renderFromDocument(program, {
      sources,
      painter: 'clerk',
      scale: 0.1,
      outputPath,
      profileId: 'social-portrait-1080'
    });
    expect(renderArtifact).toHaveBeenCalledOnce();
    const request = vi.mocked(renderArtifact).mock.calls[0][0];
    expect(request.schema).toBe(KERNEL_REQUEST_SCHEMA);
    expect(request.program.id).toBe('cli-score');
    expect(request.sources[0].data).toMatch(/Happy families/);
    expect(request.painter).toBe('clerk');
    expect(request.profileId).toBe('social-portrait-1080');
    expect(runProducer).not.toHaveBeenCalled();
  });

  it('compiles an operation set through runProducer at encode.tier final', async () => {
    const dir = tempDir();
    const outputPath = join(dir, 'experience.mp4');
    const artifact = await renderFromDocument(operationSet, {
      sources,
      painter: 'clerk',
      outputPath
    });
    expect(runProducer).toHaveBeenCalledOnce();
    const call = vi.mocked(runProducer).mock.calls[0][0];
    expect(call.operationSet.operations.some(op => op.op === 'request-compile')).toBe(true);
    expect(call.encode.painter).toBe('clerk');
    expect(call.encode.tier).toBe('final');
    expect(call.proposePublication).toBe(false);
    expect(artifact.mp4Path).toBe(outputPath);
    expect(artifact.job.profile).toBe('social-portrait-1080');
    expect(artifact.encoded.width).toBe(1080);
    expect(artifact.encoded.height).toBe(1920);
    expect(renderArtifact).not.toHaveBeenCalled();
  });

  it('writes the export job JSON the CLI consumes', async () => {
    const dir = tempDir();
    const request = kernelRequestFromDocument({ program, sources }, {
      painter: 'chamber',
      scale: 1
    });
    const artifact = await materializeExportJob({
      document: request,
      outDir: dir,
      options: { painter: 'chamber', scale: 1 }
    });
    const saved = JSON.parse(readFileSync(join(dir, 'request.json'), 'utf8'));
    expect(saved.schema).toBe(KERNEL_REQUEST_SCHEMA);
    expect(saved.program.id).toBe('cli-score');
    expect(artifact.mp4Path).toBe(join(dir, 'experience.mp4'));
    expect(readFileSync(join(dir, 'encode.json'), 'utf8')).toMatch(/jobHash/);
    expect(renderArtifact).toHaveBeenCalledOnce();
  });
});

describe('render-mp4 CLI', () => {
  it('prints usage when no score is given', () => {
    const result = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toMatch(/Usage:/);
    expect(`${result.stdout}${result.stderr}`).toMatch(/experience-program/);
  });

  it('refuses program JSON that has no source text', () => {
    const dir = tempDir();
    const input = join(dir, 'program.json');
    writeFileSync(input, `${JSON.stringify(program)}\n`);
    const result = spawnSync(process.execPath, [
      SCRIPT, input, '--out', join(dir, 'out'), '--painter', 'clerk'
    ], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toMatch(/source text/i);
  });
});
