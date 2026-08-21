// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { compileRenderPlan } from './plan.js';
import { exportRenderMp4 } from './export-mp4.js';
import { mixAudio } from './audio-mix.js';
import { buildVerticalSlice } from './vertical-slice.js';

const ffmpegCommand = process.env.RISE_FFMPEG_PATH || 'ffmpeg';
const ffmpeg = spawnSync(ffmpegCommand, ['-version'], { stdio: 'ignore' });
const hasFfmpeg = !ffmpeg.error && ffmpeg.status === 0;

describe('exportRenderMp4', () => {
  it.skipIf(!hasFfmpeg && !process.env.CI)('muxes clerk RGBA with inventory on mixAudio', async () => {
    expect(hasFfmpeg, 'CI installs ffmpeg; if it is missing, that step broke').toBe(true);
    const slice = await buildVerticalSlice();
    const plan = compileRenderPlan(slice);
    const dir = mkdtempSync(join(tmpdir(), 'rise-export-mp4-'));
    const outputPath = join(dir, 'take.mp4');
    try {
      const encoded = await exportRenderMp4({
        plan,
        inventory: slice.inventory,
        outputPath,
        painter: 'clerk',
        scale: 0.1,
        fromMs: 0,
        toMs: 200
      });
      const mixed = mixAudio(plan, {
        sampleRate: 48_000,
        inventory: slice.inventory,
        fromMs: 0,
        toMs: 200
      });
      expect(mixed.pcm.length).toBeGreaterThan(0);
      const bytes = readFileSync(encoded.path);
      expect(bytes.subarray(4, 8).toString()).toBe('ftyp');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
