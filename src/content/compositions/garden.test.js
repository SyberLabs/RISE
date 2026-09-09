import { describe, expect, it } from 'vitest';
import { OSTENSORIA_PALETTES } from '../../core/visual-style-definitions.js';
import {
  GARDEN_BLOSSOMS,
  GARDEN_BUD_SCALE,
  GARDEN_DURATION_MS,
  GARDEN_SCORE,
  GARDEN_STEM,
  GARDEN_WORDMARK,
  blossomAt,
  groundBreathAt,
  stemAt,
  wordmarkAt
} from './garden.js';

const PALETTE_IDS = new Set(OSTENSORIA_PALETTES.map(item => item.id));

describe('blossomAt', () => {
  const blossom = GARDEN_BLOSSOMS[0];

  it('is nothing at all before its start', () => {
    expect(blossomAt(blossom, blossom.startMs - 1).visible).toBe(false);
    expect(blossomAt(blossom, 0).scale).toBe(0);
  });

  it('opens the plate and swells out of the bud on one clock', () => {
    const early = blossomAt(blossom, blossom.startMs + 10);
    expect(early.visible).toBe(true);
    expect(early.progress).toBeGreaterThan(0);
    expect(early.progress).toBeLessThan(0.05);
    // A bud is small but never nothing, or it would pop into being.
    expect(early.scale).toBeGreaterThanOrEqual(GARDEN_BUD_SCALE);

    const done = blossomAt(blossom, blossom.startMs + blossom.openMs);
    expect(done.progress).toBe(1);
    expect(done.scale).toBe(1);
    expect(done.open).toBe(true);
  });

  it('holds once open rather than continuing to grow', () => {
    const later = blossomAt(blossom, blossom.startMs + blossom.openMs * 3);
    expect(later.progress).toBe(1);
    expect(later.scale).toBe(1);
  });
});

describe('stemAt', () => {
  it('finishes exactly as its blossom begins to open', () => {
    for (const blossom of GARDEN_BLOSSOMS) {
      expect(stemAt(blossom, blossom.startMs), blossom.id).toBe(1);
      expect(stemAt(blossom, blossom.startMs - GARDEN_STEM.leadMs), blossom.id).toBe(0);
    }
  });

  it('is partly grown midway through its lead', () => {
    const blossom = GARDEN_BLOSSOMS[0];
    const half = stemAt(blossom, blossom.startMs - GARDEN_STEM.leadMs / 2);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);
  });
});

describe('wordmarkAt', () => {
  it('brings the letters in one at a time', () => {
    const early = wordmarkAt(GARDEN_WORDMARK.fromMs + 200);
    expect(early.letters[0].alpha).toBeGreaterThan(0);
    expect(early.letters[3].alpha).toBe(0);
    expect(early.resolved).toBe(false);
  });

  it('resolves only once the last letter has landed', () => {
    const last = GARDEN_WORDMARK.fromMs
      + GARDEN_WORDMARK.letterStaggerMs * (GARDEN_WORDMARK.text.length - 1)
      + GARDEN_WORDMARK.letterRevealMs;
    expect(wordmarkAt(last - 1).resolved).toBe(false);
    expect(wordmarkAt(last).resolved).toBe(true);
    expect(wordmarkAt(last).letters.every(letter => letter.scale === 1)).toBe(true);
  });
});

describe('the garden score', () => {
  it('finishes every blossom, and the name, before the last frame', () => {
    for (const blossom of GARDEN_BLOSSOMS) {
      expect(blossom.startMs + blossom.openMs, blossom.id).toBeLessThan(GARDEN_DURATION_MS);
    }
    const resolvedAt = GARDEN_WORDMARK.fromMs
      + GARDEN_WORDMARK.letterStaggerMs * (GARDEN_WORDMARK.text.length - 1)
      + GARDEN_WORDMARK.letterRevealMs;
    expect(resolvedAt).toBeLessThan(GARDEN_DURATION_MS);
    // The last frame is a feed's thumbnail, so the name has to have been
    // standing for a while by the time the clip ends.
    expect(GARDEN_DURATION_MS - resolvedAt).toBeGreaterThan(3_000);
  });

  it('roots every stem below the frame so none begins in mid-air', () => {
    expect(GARDEN_STEM.rootY).toBeGreaterThan(1);
    for (const blossom of GARDEN_BLOSSOMS) {
      expect(blossom.y, blossom.id).toBeLessThan(GARDEN_STEM.rootY);
      expect(blossom.startMs - GARDEN_STEM.leadMs, blossom.id).toBeGreaterThanOrEqual(-1);
    }
  });

  it('names a real palette and an audited variant for every blossom', () => {
    for (const blossom of GARDEN_BLOSSOMS) {
      expect(PALETTE_IDS, blossom.id).toContain(blossom.palette);
      expect(Number.isInteger(blossom.variant), blossom.id).toBe(true);
      expect(blossom.variant, blossom.id).toBeGreaterThanOrEqual(0);
    }
    const ids = GARDEN_BLOSSOMS.map(blossom => blossom.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the wordmark clear of the planting', () => {
    const highest = Math.min(...GARDEN_BLOSSOMS.map(blossom => blossom.y - blossom.size / 2));
    expect(GARDEN_WORDMARK.centerY).toBeLessThan(highest);
  });

  it('breathes the ground without ever dimming it to nothing', () => {
    for (let ms = 0; ms <= GARDEN_DURATION_MS; ms += 500) {
      const breath = groundBreathAt(ms);
      expect(breath).toBeGreaterThan(0.85);
      expect(breath).toBeLessThanOrEqual(1);
    }
  });

  it('exposes one frozen score for the stage to read', () => {
    expect(Object.isFrozen(GARDEN_SCORE)).toBe(true);
    expect(GARDEN_SCORE.blossoms).toBe(GARDEN_BLOSSOMS);
    expect(GARDEN_SCORE.durationMs).toBe(GARDEN_DURATION_MS);
  });
});
