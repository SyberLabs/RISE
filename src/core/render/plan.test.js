import { describe, expect, it } from 'vitest';
import { compileRenderPlan, hashRenderPlan, atomAt, visualRunAt } from './plan.js';
import { buildVerticalSlice } from './vertical-slice.js';

describe('render plan', () => {
  it('compiles the vertical slice onto the session clock', async () => {
    const slice = await buildVerticalSlice();
    expect(slice.session.totalDuration).toBeGreaterThanOrEqual(20_000);
    expect(slice.session.totalDuration).toBeLessThanOrEqual(30_000);

    const plan = compileRenderPlan(slice);
    expect(plan.durationMs).toBe(slice.job.durationMs);
    expect(plan.atoms.length).toBeGreaterThan(4);
    expect(plan.visualRuns.map(run => run.cueKind)).toEqual([
      'visual:still',
      'visual:sourced:project-image',
      'visual:procedural:klee',
      'visual:video'
    ]);
    expect(plan.audioRuns[0].cueKind).toBe('audio:soundscape');
    expect(plan.visualRuns.find(run => run.cueKind === 'visual:video').video.timeMode)
      .toBe('loop');

    const mid = Math.floor(plan.durationMs / 2);
    expect(atomAt(plan, 0)?.text).toBeTruthy();
    expect(visualRunAt(plan, mid)?.cueKind).toMatch(/^visual:/);
    expect(await hashRenderPlan(plan)).toBe(await hashRenderPlan(compileRenderPlan(slice)));
  });
});
