import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GLASS_CONTINUITY, createGlassContinuity } from './glass-continuity.js';

describe('the glass between phrases', () => {
  let dissolve;
  let glass;

  beforeEach(() => {
    vi.useFakeTimers();
    dissolve = vi.fn();
    glass = createGlassContinuity({ now: () => Date.now(), dissolve });
  });

  afterEach(() => {
    glass.destroy();
    vi.useRealTimers();
  });

  it('the first phrase arrives on no glass; the next phrase arrives on the glass already standing', () => {
    expect(glass.words()).toBe(false);
    expect(glass.words()).toBe(true);
    expect(glass.state).toBe('words');
  });

  it('a short silence holds the glass, and the next phrase arrives on it', () => {
    glass.words();
    expect(glass.silence(400)).toBe('hold');
    expect(glass.state).toBe('holding');
    vi.advanceTimersByTime(400);
    expect(glass.words()).toBe(true);
    vi.advanceTimersByTime(GLASS_CONTINUITY.graceMs * 2);
    expect(dissolve).not.toHaveBeenCalled();
  });

  it('a silence that outlasts the grace dissolves the glass once, and the phrase after it arrives on none', () => {
    glass.words();
    expect(glass.silence(null)).toBe('hold');
    vi.advanceTimersByTime(GLASS_CONTINUITY.graceMs - 1);
    expect(dissolve).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(dissolve).toHaveBeenCalledTimes(1);
    expect(glass.state).toBe('clear');
    expect(glass.words()).toBe(false);
  });

  it('a silence known to be long dissolves the glass at once', () => {
    glass.words();
    expect(glass.silence(GLASS_CONTINUITY.holdMs + 1)).toBe('dissolve');
    expect(dissolve).toHaveBeenCalledTimes(1);
    expect(glass.state).toBe('clear');
  });

  it('the time already held counts: a seam, then a hold, dissolves when the two together are long', () => {
    glass.words();
    expect(glass.silence(600)).toBe('hold');
    vi.advanceTimersByTime(600);
    expect(glass.silence(800)).toBe('dissolve');
    expect(dissolve).toHaveBeenCalledTimes(1);
  });

  it('a silence on no glass has nothing to hold', () => {
    expect(glass.silence(200)).toBe('clear');
    vi.advanceTimersByTime(GLASS_CONTINUITY.graceMs * 2);
    expect(dissolve).not.toHaveBeenCalled();
  });

  it('a pause or the end dissolves a held glass, and leaves glass under words where it is', () => {
    glass.words();
    expect(glass.release()).toBe(false);
    expect(glass.state).toBe('words');
    glass.silence(300);
    expect(glass.release()).toBe(true);
    expect(dissolve).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(GLASS_CONTINUITY.graceMs * 2);
    expect(dissolve).toHaveBeenCalledTimes(1);
  });

  it('destroyed, it forgets the glass and never dissolves later', () => {
    glass.words();
    glass.silence(null);
    glass.destroy();
    vi.advanceTimersByTime(GLASS_CONTINUITY.graceMs * 2);
    expect(dissolve).not.toHaveBeenCalled();
    expect(glass.state).toBe('clear');
  });
});
