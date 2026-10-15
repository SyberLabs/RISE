import { describe, expect, it } from 'vitest';
import { pictureCadence } from './cadence.js';

const beats = scenes => scenes.map(scene => (scene === null ? { say: 'Words.' } : { say: 'Words.', scene }));

describe('the picture cadence of a Current', () => {
  it('counts beats, the distinct scenes they start, and the longest run under one picture', () => {
    expect(pictureCadence({ beats: beats(['a', null, null, 'b', null, 'a', null, null, null, null]) })).toEqual({ beats: 10, scenes: 2, longestHold: 5 });
  });

  it('counts the beats before the first scene as one hold, and a scene started again as no change', () => {
    expect(pictureCadence({ beats: beats([null, null, null, 'a', 'a', null]) })).toEqual({ beats: 6, scenes: 1, longestHold: 3 });
  });

  it('measures the first real digest, one attractor held through all 16 beats', () => {
    expect(pictureCadence({ beats: beats(['open', ...Array(15).fill(null)]) })).toEqual({ beats: 16, scenes: 1, longestHold: 16 });
  });

  it('measures a v1 Current by its segments’ visuals', () => {
    const segments = ['still', 'attractor', 'attractor', undefined, 'still'].map(visual => ({ text: 'Words.', ...(visual ? { visual } : {}) }));
    expect(pictureCadence({ segments })).toEqual({ beats: 5, scenes: 3, longestHold: 2 });
  });

  it('is zero for what has no beats or segments', () => {
    expect(pictureCadence({})).toEqual({ beats: 0, scenes: 0, longestHold: 0 });
  });
});
