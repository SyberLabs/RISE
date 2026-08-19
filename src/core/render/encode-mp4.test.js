// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { encodeMp4 } from './encode-mp4.js';
import { RENDER_SAMPLE_RATE } from './layout.js';

function solidFrame(width, height, color) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = color[0];
    rgba[i + 1] = color[1];
    rgba[i + 2] = color[2];
    rgba[i + 3] = 255;
  }
  return { width, height, rgba };
}

/**
 * This exercises the real ffmpeg, which is the point: the adapter's job is to
 * hand a system encoder bytes it accepts, and a stub would only prove we can
 * satisfy our own stub. So it is skipped where ffmpeg is absent rather than
 * failing there — a build machine without the binary is telling us about the
 * machine, not about the code.
 *
 * Skipped, never quietly passed. A run that did not encode says so.
 *
 * AND THE SKIP IS A DEVELOPER CONVENIENCE, NOT A CI ESCAPE HATCH. The workflow
 * installs ffmpeg, so on CI its absence means that step broke — and a skip
 * there would hide the very regression the install exists to prevent. There it
 * fails instead.
 */
const ffmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
const hasFfmpeg = !ffmpeg.error && ffmpeg.status === 0;

describe('H.264 encoder adapter', () => {
  it.skipIf(!hasFfmpeg && !process.env.CI)('muxes a short RGBA + PCM take into an MP4', async () => {
    expect(hasFfmpeg, 'CI installs ffmpeg; if it is missing, that step broke')
      .toBe(true);
    const dir = mkdtempSync(join(tmpdir(), 'rise-mp4-test-'));
    const outputPath = join(dir, 'take.mp4');
    const frames = [
      solidFrame(64, 64, [10, 10, 12]),
      solidFrame(64, 64, [40, 80, 120]),
      solidFrame(64, 64, [200, 160, 40])
    ];
    const pcm = new Float32Array(RENDER_SAMPLE_RATE * 2 * 0.2);
    for (let i = 0; i < pcm.length; i += 2) {
      pcm[i] = Math.sin(i / 40) * 0.2;
      pcm[i + 1] = Math.sin(i / 37) * 0.2;
    }
    const encoded = await encodeMp4({
      frames,
      audio: { pcm, sampleRate: RENDER_SAMPLE_RATE, channels: 2 },
      outputPath,
      frameRate: { numerator: 30, denominator: 1 }
    });
    const bytes = readFileSync(encoded.path);
    expect(bytes.subarray(4, 8).toString()).toBe('ftyp');
    expect(bytes.byteLength).toBeGreaterThan(1000);
    rmSync(dir, { recursive: true, force: true });
  }, 20_000);
});
