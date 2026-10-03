import { afterEach, describe, expect, it, vi } from 'vitest';
import { localDateKey, watchLocalDay } from './local-day.js';

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
