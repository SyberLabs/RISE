import { describe, expect, it } from 'vitest';
import { compileRenderPlan } from './plan.js';
import { renderJob, renderJobTwice } from './driver.js';
import { mixAudio } from './audio-mix.js';
import { captionsFromPlan } from './captions.js';
import { hashPcm } from './driver.js';
import { buildVerticalSlice } from './vertical-slice.js';
import { RenderError } from './errors.js';

describe('vertical-slice render driver', () => {
  it('renders the same admitted job twice with identical decoded frames and audio', async () => {
    const slice = await buildVerticalSlice();
    const plan = compileRenderPlan(slice);
    const sampleFrames = plan.visualRuns.map((run) => {
      const mid = Math.floor((run.fromMs + run.toMs) / 2);
      return Math.min(plan.frameCount - 1, Math.floor((mid * plan.frameRate.numerator) / 1000));
    });
    const last = plan.frameCount - 1;

    const { first, second, identical } = await renderJobTwice(slice, {
      scale: 0.1,
      frames: [...new Set([...sampleFrames, last])],
      keepFrames: sampleFrames,
      sampleRate: 8_000
    });
    expect(identical).toBe(true);
    expect(first.planHash).toBe(second.planHash);
    expect(first.decoded.frameHashes.length).toBeGreaterThanOrEqual(4);
    expect(new Set(first.decoded.frameHashes).size).toBeGreaterThan(1);
    expect(plan.visualRuns.find(run => run.cueKind === 'visual:procedural:klee')).toBeTruthy();
    expect(first.package['render-manifest.json'].droppedFrames).toBe(0);
    expect(first.package['captions.vtt']).toMatch(/^WEBVTT/m);
    expect(first.package['credits.txt']).toMatch(/Tolstoy/);
    expect(captionsFromPlan(plan).every(cue => cue.sourceId === 'source-1')).toBe(true);

    const boundary = await renderJob(slice, {
      scale: 0.1,
      frames: [last],
      sampleRate: 8_000
    });
    expect(boundary.decoded.frameHashes).toHaveLength(1);
    expect(boundary.decoded.audioHash).toBe(first.decoded.audioHash);
  }, 20_000);

  it('mixes a deterministic aurora bed and cancels without a completed artifact', async () => {
    const slice = await buildVerticalSlice();
    const plan = compileRenderPlan(slice);
    const first = mixAudio(plan, { sampleRate: 8_000 });
    const second = mixAudio(plan, { sampleRate: 8_000 });
    expect(await hashPcm(first.pcm)).toBe(await hashPcm(second.pcm));
    expect(first.pcm.some(sample => sample !== 0)).toBe(true);

    const cancel = { cancelled: true };
    await expect(renderJob(slice, { scale: 0.1, fromFrame: 0, toFrame: 4, cancel, sampleRate: 8_000 }))
      .rejects.toMatchObject({ code: 'RENDER_CANCELLED' });
    try {
      await renderJob(slice, { scale: 0.1, fromFrame: 0, toFrame: 4, cancel, sampleRate: 8_000 });
    } catch (error) {
      expect(error).toBeInstanceOf(RenderError);
      expect(error.code).toBe('RENDER_CANCELLED');
    }
  });
});
