import { describe, expect, it } from 'vitest';
import { GENESIS_GROW_MS, genesisGrowProgress, genesisProgressForRun } from './klee-field.js';

describe('genesis growth at explicit time', () => {
  it('is a pure ease-out of elapsed time', () => {
    expect(genesisGrowProgress(0)).toBe(0);
    expect(genesisGrowProgress(GENESIS_GROW_MS)).toBe(1);
    expect(genesisGrowProgress(GENESIS_GROW_MS * 2)).toBe(1);
    const mid = genesisGrowProgress(GENESIS_GROW_MS / 2);
    expect(mid).toBeGreaterThan(0.5);
    expect(mid).toBeLessThan(1);
    expect(genesisGrowProgress(9200)).toEqual(genesisGrowProgress(9200));
  });

  it('completes a short scored take without changing the ease', () => {
    expect(genesisProgressForRun(0, 9000)).toBe(0);
    expect(genesisProgressForRun(9000, 9000)).toBe(1);
    expect(genesisProgressForRun(4500, 9000)).toBe(genesisGrowProgress(GENESIS_GROW_MS / 2));
    expect(genesisProgressForRun(9000, 40000)).toBe(genesisGrowProgress(9000));
  });
});
