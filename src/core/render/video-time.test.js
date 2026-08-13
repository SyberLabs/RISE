import { describe, expect, it } from 'vitest';
import { mapVideoSourceTime } from './video-time.js';

const window = {
  activeFromMs: 1000,
  activeToMs: 5000,
  sourceDurationMs: 2000,
  sourceFromMs: 0,
  sourceToMs: 2000
};

describe('muted MP4 source-time mapping', () => {
  it('maps cue time from the start of the file and holds the last sample', () => {
    expect(mapVideoSourceTime({ presentationMs: 1000, timeMode: 'cue', ...window })).toBe(0);
    expect(mapVideoSourceTime({ presentationMs: 2500, timeMode: 'cue', ...window })).toBe(1500);
    expect(mapVideoSourceTime({ presentationMs: 4999, timeMode: 'cue', ...window })).toBe(1999);
    expect(mapVideoSourceTime({ presentationMs: 5000, timeMode: 'cue', ...window })).toBeNull();
  });

  it('fits the authored span onto the source window', () => {
    expect(mapVideoSourceTime({ presentationMs: 1000, timeMode: 'fit-span', ...window })).toBe(0);
    expect(mapVideoSourceTime({ presentationMs: 3000, timeMode: 'fit-span', ...window })).toBe(1000);
    expect(mapVideoSourceTime({ presentationMs: 4999, timeMode: 'fit-span', ...window })).toBe(1999);
  });

  it('loops the source window for the length of the cue', () => {
    expect(mapVideoSourceTime({ presentationMs: 1000, timeMode: 'loop', ...window })).toBe(0);
    expect(mapVideoSourceTime({ presentationMs: 3000, timeMode: 'loop', ...window })).toBe(0);
    expect(mapVideoSourceTime({ presentationMs: 3500, timeMode: 'loop', ...window })).toBe(500);
  });

  it('plays once then holds the final source frame', () => {
    expect(mapVideoSourceTime({ presentationMs: 1500, timeMode: 'hold-final', ...window })).toBe(500);
    expect(mapVideoSourceTime({ presentationMs: 4000, timeMode: 'hold-final', ...window })).toBe(1999);
  });
});
