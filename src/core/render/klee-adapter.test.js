import { describe, expect, it } from 'vitest';
import { kleeStrokes } from './klee-adapter.js';

describe('klee render adapter', () => {
  it('is a pure function of seed, preset, and time', () => {
    const args = { seed: 'project-memory:18', width: 108, height: 192, preset: 'harmonic', timeMs: 400 };
    expect(kleeStrokes(args)).toEqual(kleeStrokes(args));
    expect(kleeStrokes({ ...args, timeMs: 800 })).not.toEqual(kleeStrokes(args));
    expect(kleeStrokes({ ...args, seed: 'other' }).strokes[0].points)
      .not.toEqual(kleeStrokes(args).strokes[0].points);
  });
});
