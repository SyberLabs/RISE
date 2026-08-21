// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { KERNEL_REQUEST_SCHEMA, renderArtifact } from './artifact.js';
import { buildVerticalSlice } from './vertical-slice.js';
import { RenderError } from './errors.js';
import { EXPERIENCE_PROGRAM_SCHEMA } from '../experience-program.js';

const ffmpegCommand = process.env.RISE_FFMPEG_PATH || 'ffmpeg';
const ffmpeg = spawnSync(ffmpegCommand, ['-version'], { stdio: 'ignore' });
const hasFfmpeg = !ffmpeg.error && ffmpeg.status === 0;

describe('renderArtifact kernel', () => {
  it('refuses a request that is not rise.kernel-request.v1', async () => {
    await expect(renderArtifact({
      schema: 'rise.not-a-kernel.v1',
      program: { schema: EXPERIENCE_PROGRAM_SCHEMA }
    })).rejects.toMatchObject({ code: 'RENDER_KERNEL_SCHEMA' });
  });

  it('refuses a request without an Experience Program', async () => {
    await expect(renderArtifact({
      schema: KERNEL_REQUEST_SCHEMA
    })).rejects.toBeInstanceOf(RenderError);
  });

  it.skipIf(!hasFfmpeg && !process.env.CI)('muxes a clerk MP4 with inventory on the mix', async () => {
    expect(hasFfmpeg, 'CI installs ffmpeg; if it is missing, that step broke').toBe(true);
    const slice = await buildVerticalSlice();
    const dir = mkdtempSync(join(tmpdir(), 'rise-artifact-test-'));
    const outputPath = join(dir, 'experience.mp4');
    try {
      const artifact = await renderArtifact({
        schema: KERNEL_REQUEST_SCHEMA,
        program: slice.program,
        sources: slice.sources,
        inventory: slice.inventory,
        sessionInput: slice.sessionInput,
        job: slice.job,
        outputPath,
        painter: 'clerk',
        scale: 0.1,
        fromMs: 0,
        toMs: 200,
        tier: 'draft'
      });
      expect(artifact.mp4Path).toBe(outputPath);
      expect(artifact.jobHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(artifact.srt).toMatch(/-->/);
      expect(artifact.poster[0]).toBe(0x42);
      expect(artifact.poster[1]).toBe(0x4d);
      expect(artifact.manifest.schema).toBe('rise.render-manifest.v1');
      expect(artifact.manifest.profile).toBe('social-portrait-1080');
      const bytes = readFileSync(artifact.mp4Path);
      expect(bytes.subarray(4, 8).toString()).toBe('ftyp');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
