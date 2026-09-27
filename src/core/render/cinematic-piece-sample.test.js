import { describe, expect, it } from 'vitest';
import { CINEMATIC_OFFLINE_IDS, sampleCinematicPiece } from './cinematic-piece-sample.js';

describe('offline cinematic piece samples', () => {
  it('covers the six live cinematic pieces', () => {
    expect([...CINEMATIC_OFFLINE_IDS].sort()).toEqual([
      'chase', 'haunted', 'mystery', 'starlight', 'triumph', 'wonder'
    ]);
  });

  it('returns a finite, deterministic, audible stereo signal for every piece', () => {
    for (const id of CINEMATIC_OFFLINE_IDS) {
      const samples = Array.from({ length: 4_800 }, (_, frame) => [
        sampleCinematicPiece(id, frame / 8_000, 0),
        sampleCinematicPiece(id, frame / 8_000, 1)
      ]);
      expect(samples.flat().every(Number.isFinite), id).toBe(true);
      expect(Math.max(...samples.flat().map(Math.abs)), id).toBeGreaterThan(1e-4);
      expect(samples, id).toEqual(Array.from({ length: 4_800 }, (_, frame) => [
        sampleCinematicPiece(id, frame / 8_000, 0),
        sampleCinematicPiece(id, frame / 8_000, 1)
      ]));
    }
  });

  it('preserves piece identity and stereo contour', () => {
    const signatures = [...CINEMATIC_OFFLINE_IDS].map(id => {
      const values = Array.from({ length: 1_600 }, (_, frame) =>
        sampleCinematicPiece(id, frame / 8_000, 0));
      return values.reduce((sum, value, index) => sum + value * (index % 7 + 1), 0);
    });
    expect(new Set(signatures).size).toBe(CINEMATIC_OFFLINE_IDS.length);
    expect(sampleCinematicPiece('wonder', 0.37, 0))
      .not.toBe(sampleCinematicPiece('wonder', 0.37, 1));
  });

  it('returns silence for unknown IDs and invalid sample positions', () => {
    expect(sampleCinematicPiece('not-a-piece', 0.5, 0)).toBe(0);
    expect(sampleCinematicPiece('wonder', -1, 0)).toBe(0);
    expect(sampleCinematicPiece('wonder', Number.NaN, 1)).toBe(0);
  });
});
