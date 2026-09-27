import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACOUSTIC_SOUNDSCAPES } from './acoustic-pieces.js';

function param(value = 0) {
  return { value, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() };
}
function makeContext() {
  const oscillators = [];
  const ctx = {
    currentTime: 0,
    destination: { connect: vi.fn(), disconnect: vi.fn() },
    createGain() {
      return { gain: param(1), connect: vi.fn(function(target) { return target; }), disconnect: vi.fn() };
    },
    createOscillator() {
      const osc = { type: 'sine', frequency: param(), connect: vi.fn(function(target) { return target; }), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      oscillators.push(osc);
      return osc;
    }
  };
  return { ctx, oscillators };
}

describe('acoustic soundscapes', () => {
  afterEach(() => vi.useRealTimers());

  it('offers six named original keyboard pieces', () => {
    expect(Object.keys(ACOUSTIC_SOUNDSCAPES)).toEqual(['lullaby', 'nocturne', 'waltz', 'blues', 'bossa', 'ragtime']);
    for (const entry of Object.values(ACOUSTIC_SOUNDSCAPES)) {
      expect(entry.name).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(typeof entry.create).toBe('function');
    }
  });

  it('starts every piece with a bounded phrase and stops all active voices immediately', () => {
    for (const piece of Object.values(ACOUSTIC_SOUNDSCAPES)) {
      const { ctx, oscillators } = makeContext();
      const sound = piece.create(ctx, ctx.destination);
      sound.start();
      expect(oscillators.length).toBeGreaterThan(0);
      expect(oscillators.length).toBeLessThanOrEqual(48);
      expect(oscillators.every(osc => osc.start.mock.calls.length === 1)).toBe(true);
      sound.stop(true);
      expect(oscillators.every(osc => osc.stop.mock.calls.length === 2)).toBe(true);
    }
  });

  it('does not schedule a new phrase while mayAdvance is false', () => {
    vi.useFakeTimers();
    let mayAdvance = false;
    const { ctx, oscillators } = makeContext();
    const sound = ACOUSTIC_SOUNDSCAPES.waltz.create(ctx, ctx.destination, { mayAdvance: () => mayAdvance });
    sound.start();
    const heldCount = oscillators.length;
    vi.advanceTimersByTime(5000);
    expect(oscillators).toHaveLength(heldCount);
    mayAdvance = true;
    ctx.currentTime = 10.1;
    vi.advanceTimersByTime(300);
    expect(oscillators.length).toBeGreaterThan(heldCount);
    sound.stop(true);
  });

  it('ramps out and releases every voice after a graceful stop', () => {
    vi.useFakeTimers();
    const { ctx, oscillators } = makeContext();
    const sound = ACOUSTIC_SOUNDSCAPES.nocturne.create(ctx, ctx.destination);
    sound.start();
    sound.stop(false);
    expect(oscillators.every(osc => osc.stop.mock.calls.length === 1)).toBe(true);
    vi.advanceTimersByTime(1600);
    expect(oscillators.every(osc => osc.stop.mock.calls.length === 2)).toBe(true);
  });
});

  it('gives the blues a four-note walking bass and swung offbeat answers', () => {
    vi.useFakeTimers();
    const { ctx, oscillators } = makeContext();
    const sound = ACOUSTIC_SOUNDSCAPES.blues.create(ctx, ctx.destination);
    sound.start();

    const beat = 60 / 82;
    const notesAt = new Map();
    for (const oscillator of oscillators) {
      const [at] = oscillator.start.mock.calls[0];
      if (typeof at !== 'number') continue;
      const notes = notesAt.get(at) || [];
      notes.push(oscillator.frequency.value);
      notesAt.set(at, notes);
    }
    const notesAtBeat = offset => [...notesAt.entries()].find(([at]) => Math.abs(at - (0.06 + offset * beat)) < 0.001)?.[1];
    const midiHz = midi => 440 * 2 ** ((midi - 69) / 12);

    const walkingBass = [0, 1, 2, 3].map(offset => {
      const notes = notesAtBeat(offset);
      return notes ? Math.min(...notes) : null;
    });
    expect(walkingBass).toEqual([41, 45, 48, 49].map(midiHz));
    expect(notesAtBeat(2 / 3)).toBeTruthy();
    expect(notesAtBeat(0.5)).toBeUndefined();
    sound.stop(true);
  });

  it('lets an immediate stop cancel a graceful release already in progress', () => {
    vi.useFakeTimers();
    const { ctx, oscillators } = makeContext();
    const sound = ACOUSTIC_SOUNDSCAPES.nocturne.create(ctx, ctx.destination);
    sound.start();
    sound.stop(false);
    sound.stop(true);

    expect(oscillators.every(osc => osc.stop.mock.calls.length === 2)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
