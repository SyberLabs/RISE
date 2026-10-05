import { describe, expect, it } from 'vitest';
import DIVISION_INDEX from '../content/archive/division-index.json' with { type: 'json' };
import { TODAY_MAX_WORDS, TODAY_WORKS, dayNumber, localDateKey, poemTitle, todayPoem, todayPool, todayPools } from './today-poem.js';

describe('the pool', () => {
  it('holds every short division of the two works, once', () => {
    const pool = todayPool();
    const expected = TODAY_WORKS.flatMap(workId => DIVISION_INDEX[workId].divisionWords
      .map((words, entryId) => ({ workId, entryId, words }))
      .filter(item => item.words <= TODAY_MAX_WORDS));
    expect(pool).toHaveLength(expected.length);
    expect(pool.length).toBe(275);
    expect(new Set(pool.map(p => `${p.workId}:${p.entryId}`)).size).toBe(pool.length);
    for (const p of pool) expect(p.label).toBe(DIVISION_INDEX[p.workId].labels[p.entryId]);
    expect(pool.some(p => p.label === 'The Spooniad')).toBe(false);
  });

  it('is shuffled the same way every time, within each work', () => {
    expect(todayPools()).toEqual(todayPools());
    const pools = todayPools();
    expect(Object.keys(pools)).toEqual([...TODAY_WORKS]);
    expect(pools['spoon-river-anthology']).toHaveLength(244);
    expect(pools['lyrical-ballads']).toHaveLength(31);
    for (const [workId, list] of Object.entries(pools)) {
      for (const p of list) expect(p.workId).toBe(workId);
    }
  });
});

describe('the day', () => {
  it('counts local calendar days', () => {
    expect(localDateKey(new Date(2026, 9, 3, 23, 59))).toBe('2026-10-03');
    expect(dayNumber(new Date(2026, 9, 4, 0, 1)) - dayNumber(new Date(2026, 9, 3, 23, 59))).toBe(1);
    expect(dayNumber(new Date(2026, 9, 3, 0, 0))).toBe(dayNumber(new Date(2026, 9, 3, 23, 59)));
  });

  it('gives everyone on one local date the same poem', () => {
    const morning = todayPoem(new Date(2026, 9, 3, 7));
    expect(todayPoem(new Date(2026, 9, 3, 22))).toEqual(morning);
    expect(morning.seed).toBe('2026-10-03');
  });

  it('carries the poem’s word count, so Home can say how long it takes', () => {
    const pick = todayPoem(new Date(2026, 9, 5));
    expect(pick.words).toBe(DIVISION_INDEX[pick.workId].divisionWords[pick.entryId]);
    expect(pick.words).toBeGreaterThan(0);
  });

  it('alternates the works day by day, so neither runs for weeks', () => {
    const works = Array.from({ length: 10 }, (_, i) => todayPoem(new Date(2026, 9, 3 + i, 12)).workId);
    for (let i = 1; i < works.length; i++) expect(works[i]).not.toBe(works[i - 1]);
    expect(new Set(works)).toEqual(new Set(TODAY_WORKS));
  });

  it('repeats no poem of a work until that work has given every one', () => {
    const pools = todayPools();
    for (const workId of TODAY_WORKS) {
      const seen = new Set();
      for (let day = 0; seen.size < pools[workId].length && day < 2000; day++) {
        const p = todayPoem(new Date(2026, 0, 1 + day, 12));
        if (p.workId !== workId) continue;
        expect(seen.has(p.entryId), `${workId} ${p.entryId} repeated`).toBe(false);
        seen.add(p.entryId);
      }
      expect(seen.size).toBe(pools[workId].length);
    }
  });
});

describe('poemTitle', () => {
  it('drops the volume prefix of Lyrical Ballads', () => {
    expect(poemTitle('Volume II · Lucy Gray')).toBe('Lucy Gray');
    expect(poemTitle('Anne Rutledge')).toBe('Anne Rutledge');
  });
});
