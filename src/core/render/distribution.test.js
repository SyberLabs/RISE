import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildVerticalSlice } from './vertical-slice.js';
import { renderDistributionPackages, renderPreview, renderProfilePackage } from './distribution.js';
import { verifyRenderPackage } from './verify.js';
import { writeRenderPackageDir, readRenderPackageDir } from './package-fs.js';
import { owedCreditLines } from './package.js';
import { encodeBmp } from './bmp.js';
import { execFileSync } from 'node:child_process';

describe('distribution packages', () => {
  it('yields portrait, square, and landscape packages from one composition', async () => {
    const slice = await buildVerticalSlice();
    const set = await renderDistributionPackages(slice, { tier: 'draft' });
    const ids = Object.keys(set.packages);
    expect(ids).toEqual([
      'social-portrait-1080',
      'social-square-1080',
      'cinema-landscape-1080'
    ]);
    expect(new Set(Object.values(set.packages).map(item => item.job.programHash)).size).toBe(1);
    expect(set.packages['social-portrait-1080'].job.viewport).toEqual({
      width: 1080, height: 1920, pixelRatio: 1
    });
    expect(set.packages['social-square-1080'].job.viewport).toEqual({
      width: 1080, height: 1080, pixelRatio: 1
    });
    expect(set.packages['cinema-landscape-1080'].job.viewport).toEqual({
      width: 1920, height: 1080, pixelRatio: 1
    });

    const owed = owedCreditLines({ sources: slice.sources, inventory: slice.inventory });
    for (const rendered of Object.values(set.packages)) {
      expect(rendered.package['poster.bmp'][0]).toBe(0x42);
      expect(rendered.package['poster.bmp'][1]).toBe(0x4d);
      expect(rendered.package['thumbnail.bmp'].length).toBeLessThan(rendered.package['poster.bmp'].length);
      expect(rendered.package['render-manifest.json'].quality).toBe('draft');
      const credits = rendered.package['credits.txt'];
      for (const line of owed) expect(credits).toContain(line);
      const report = await verifyRenderPackage(rendered.package);
      expect(report.ok).toBe(true);
      expect(report.answers.hashesMatch).toBe(true);
      expect(report.answers.degradations).toEqual([]);
      expect(report.answers.rightsUnresolved).toEqual([]);
    }
    const posters = Object.values(set.packages).map(item => item.package['render-manifest.json'].outputHashes.poster);
    expect(new Set(posters).size).toBe(3);
  }, 30_000);

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

  it('refuses renderProfilePackage as a compile and does not export it as one', async () => {
    await expect(renderProfilePackage({}, 'social-portrait-1080', { compile: true }))
      .rejects.toMatchObject({
        name: 'RenderError',
        code: 'RENDER_COMPILE_POSTER'
      });
    const indexSrc = readFileSync(fileURLToPath(new URL('./index.js', import.meta.url)), 'utf8');
    expect(indexSrc).not.toMatch(/renderProfilePackage/);
    expect(indexSrc).toMatch(/renderArtifact/);
    expect(indexSrc).toMatch(/renderPreview/);
  });

  it('writes a directory the verification CLI can inspect', async () => {
    const slice = await buildVerticalSlice();
    const set = await renderDistributionPackages(slice, {
      tier: 'draft',
      profiles: ['social-portrait-1080']
    });
    const dir = mkdtempSync(join(tmpdir(), 'rise-render-'));
    try {
      writeRenderPackageDir(dir, set.packages['social-portrait-1080'].package);
      const roundTrip = await verifyRenderPackage(readRenderPackageDir(dir));
      expect(roundTrip.ok).toBe(true);
      const output = execFileSync(process.execPath, ['scripts/verify-render-package.mjs', dir], {
        encoding: 'utf8',
        cwd: process.cwd()
      });
      expect(output).toMatch(/hashes match: yes/);
      expect(output).toMatch(/rights unresolved: none/);
      expect(output).toMatch(/degradations: none/);
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
