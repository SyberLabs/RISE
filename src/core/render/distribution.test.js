import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildVerticalSlice } from '../../../tools/render/vertical-slice.js';
import { renderPreview } from './distribution.js';
import { verifyRenderPackage } from '../../../tools/render/verify.js';
import { writeRenderPackageDir, readRenderPackageDir } from '../../../tools/render/package-fs.js';
import { encodeBmp } from './bmp.js';

describe('distribution packages', () => {

  it('records an excerpt range and keeps source coordinates on captions', async () => {
    const slice = await buildVerticalSlice();
    const preview = await renderPreview(slice, { fromMs: 1000, toMs: 4000, tier: 'draft' });
    expect(preview.package['render-manifest.json'].excerpt).toMatchObject({
      parentJobId: slice.job.id,
      parentProgramHash: slice.job.programHash,
      fromMs: 1000,
      toMs: 4000
    });
    const cues = JSON.parse(preview.package['captions.json']);
    expect(cues.length).toBeGreaterThan(0);
    expect(cues.every(cue => cue.sourceId === 'source-1')).toBe(true);
    expect(cues[0]).toHaveProperty('sourceCharacterStart');
    expect(cues.every(cue => cue.playToMs <= 3000)).toBe(true);
    expect(preview.mp4Path).toBeUndefined();
    expect(await verifyRenderPackage(preview.package)).toMatchObject({ ok: true });
  }, 20_000);

  it('writes a directory the verification CLI can inspect', async () => {
    const slice = await buildVerticalSlice();
    const preview = await renderPreview(slice, { fromMs: 1000, toMs: 4000, tier: 'draft' });
    const dir = mkdtempSync(join(tmpdir(), 'rise-render-'));
    try {
      writeRenderPackageDir(dir, preview.package);
      const roundTrip = await verifyRenderPackage(readRenderPackageDir(dir));
      expect(roundTrip.ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);
});

describe('bmp posters', () => {
  it('encodes a deterministic 24-bit bitmap', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
    const once = encodeBmp(rgba, 2, 2);
    const twice = encodeBmp(rgba, 2, 2);
    expect(once).toEqual(twice);
    expect(once[0]).toBe(0x42);
    expect(once.byteLength).toBeGreaterThan(54);
  });
});
