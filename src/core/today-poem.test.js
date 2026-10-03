import { afterEach, describe, expect, it, vi } from 'vitest';
import DIVISION_INDEX from '../content/archive/division-index.json' with { type: 'json' };
import {
  TODAY_MAX_WORDS, TODAY_WORKS, dayNumber, localDateKey, poemTitle, todayPoem, todayPool, watchLocalDay
} from './today-poem.js';

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

  it('is shuffled the same way every time, interleaving the works', () => {
    expect(todayPool()).toEqual(todayPool());
    expect(todayPool().slice(0, 40).some(p => p.workId === 'lyrical-ballads')).toBe(true);
  });
});

describe('the day', () => {
  it('counts local calendar days', () => {
    expect(localDateKey(new Date(2026, 9, 3, 23, 59))).toBe('2026-10-03');
    expect(dayNumber(new Date(2026, 9, 4, 0, 1)) - dayNumber(new Date(2026, 9, 3, 23, 59))).toBe(1);
    expect(dayNumber(new Date(2026, 9, 3, 0, 0))).toBe(dayNumber(new Date(2026, 9, 3, 23, 59)));
  });

  it('gives everyone on one local date the same poem, and the next poem tomorrow', () => {
    const pool = todayPool();
    const morning = todayPoem(new Date(2026, 9, 3, 7));
    expect(todayPoem(new Date(2026, 9, 3, 22))).toEqual(morning);
    const next = todayPoem(new Date(2026, 9, 4, 7));
    const at = p => pool.findIndex(q => q.workId === p.workId && q.entryId === p.entryId);
    expect(at(next)).toBe((at(morning) + 1) % pool.length);
    expect(morning.seed).toBe('2026-10-03');
  });

  it('repeats no poem within one cycle', () => {
    const seen = new Set();
    for (let i = 0; i < todayPool().length; i++) {
      const p = todayPoem(new Date(2026, 0, 1 + i, 12));
      seen.add(`${p.workId}:${p.entryId}`);
    }
    expect(seen.size).toBe(todayPool().length);
  });
});

describe('poemTitle', () => {
  it('drops the volume prefix of Lyrical Ballads', () => {
    expect(poemTitle('Volume II · Lucy Gray')).toBe('Lucy Gray');
    expect(poemTitle('Anne Rutledge')).toBe('Anne Rutledge');
  });
});

describe('watchLocalDay', () => {
  afterEach(() => vi.useRealTimers());

  it('calls back once at local midnight, and again the next midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 3, 23, 59, 0));
    const onNewDay = vi.fn();
    const stop = watchLocalDay(onNewDay);
    vi.advanceTimersByTime(30_000);
    expect(onNewDay).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(onNewDay).toHaveBeenCalledOnce();
    expect(localDateKey(onNewDay.mock.calls[0][0])).toBe('2026-10-04');
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(onNewDay).toHaveBeenCalledTimes(2);
    stop();
  });

  it('notices a new day when the tab comes back, as after a sleep', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 3, 22, 0));
    const onNewDay = vi.fn();
    const stop = watchLocalDay(onNewDay);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onNewDay).not.toHaveBeenCalled();
    vi.setSystemTime(new Date(2026, 9, 4, 7, 0));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onNewDay).toHaveBeenCalledOnce();
    stop();
    vi.setSystemTime(new Date(2026, 9, 5, 7, 0));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onNewDay).toHaveBeenCalledOnce();
  });
});
