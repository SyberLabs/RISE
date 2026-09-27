import { describe, expect, it } from 'vitest';
import { ACOUSTIC_PIECES } from '../../audio/acoustic-pieces.js';
import { ACOUSTIC_OFFLINE_IDS, sampleAcousticPiece } from './acoustic-piece-sample.js';

function renderWindow(id, fromSec, frames = 1600, sampleRate = 8000) {
  return Float32Array.from({ length: frames }, (_, frame) =>
    sampleAcousticPiece(id, fromSec + frame / sampleRate, 0)
  );
}

describe('offline acoustic piece sampler', () => {
  it('exports exactly the six authored acoustic scores', () => {
    expect([...ACOUSTIC_OFFLINE_IDS].sort()).toEqual(Object.keys(ACOUSTIC_PIECES).sort());
    expect([...ACOUSTIC_OFFLINE_IDS].sort()).toEqual(['blues', 'bossa', 'lullaby', 'nocturne', 'ragtime', 'waltz']);
  });

  it('repeats each score deterministically with finite audible samples', () => {
    for (const id of ACOUSTIC_OFFLINE_IDS) {
      const first = renderWindow(id, 0.2);
      expect(first).toEqual(renderWindow(id, 0.2));
      expect([...first].every(Number.isFinite), id).toBe(true);
      expect(Math.max(...first.map(Math.abs)), id).toBeGreaterThan(1e-4);
    }
  });

  it('keeps the six authored scores acoustically distinct', () => {
    const samples = Object.fromEntries(ACOUSTIC_OFFLINE_IDS.map(id => [id, renderWindow(id, 0.2)]));
    for (let left = 0; left < ACOUSTIC_OFFLINE_IDS.length; left += 1) {
      for (let right = left + 1; right < ACOUSTIC_OFFLINE_IDS.length; right += 1) {
        const a = samples[ACOUSTIC_OFFLINE_IDS[left]];
        const b = samples[ACOUSTIC_OFFLINE_IDS[right]];
        let differing = 0;
        for (let i = 0; i < a.length; i += 1) if (Math.abs(a[i] - b[i]) > 1e-5) differing += 1;
        expect(differing / a.length).toBeGreaterThan(0.5);
      }
    }
  });

  it('returns silence for unsupported IDs and invalid times', () => {
    expect(sampleAcousticPiece('missing', 0.2)).toBe(0);
    expect(sampleAcousticPiece('lullaby', Number.NaN)).toBe(0);
    expect(sampleAcousticPiece('lullaby', -1)).toBe(0);
  });
});
