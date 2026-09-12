import { describe, expect, it } from 'vitest';
import { OSTENSORIA_PALETTES } from '../../core/visual-style-definitions.js';
import {
  GARDEN_ANNOUNCEMENT,
  GARDEN_BLOSSOMS,
  GARDEN_CLOSE,
  GARDEN_BUD_SCALE,
  GARDEN_DURATION_MS,
  GARDEN_GRAIN,
  GARDEN_GROUND,
  GARDEN_SEED,
  GARDEN_SCORE,
  GARDEN_STEM,
  GARDEN_WORDMARK,
  blossomAt,
  groundBreathAt,
  revealAt,
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

  it('holds once open, right up until the garden begins to close', () => {
    const later = blossomAt(blossom, blossom.startMs + blossom.openMs * 2);
    expect(later.progress).toBe(1);
    expect(later.scale).toBe(1);
    // The hold ends at one known moment now, rather than running forever.
    const atClose = blossomAt(blossom, GARDEN_CLOSE.fromMs);
    expect(atClose.openness).toBe(1);
    expect(atClose.scale).toBe(1);
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

describe('the garden closing', () => {
  const at = ms => GARDEN_BLOSSOMS.map(b => blossomAt(b, ms).openness);
  const stems = ms => GARDEN_BLOSSOMS.map(b => stemAt(b, ms));

  it('closes every flower on one clock', () => {
    // The bed fills a flower at a time; it empties as one gesture.
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      const ms = GARDEN_CLOSE.fromMs + GARDEN_CLOSE.foldMs * fraction;
      expect(new Set(at(ms)).size, `openness at ${ms}`).toBe(1);
    }
  });

  it('withdraws every stem on one clock, from the middle of the fold', () => {
    const { fromMs, foldMs, recedeMs, recedeAtFold } = GARDEN_CLOSE;
    const recedeFrom = fromMs + foldMs * recedeAtFold;
    // Nothing moves early: the flowers are seen to close before the
    // ground begins taking them.
    expect(new Set(stems(recedeFrom))).toEqual(new Set([1]));
    for (const fraction of [0.25, 0.5, 0.75, 1]) {
      const ms = recedeFrom + recedeMs * fraction;
      expect(new Set(stems(ms)).size, `stems at ${ms}`).toBe(1);
    }
  });

  it('runs the end of the fold into the start of the recession', () => {
    // THE TWO HALVES OF ONE GESTURE, NOT TWO GESTURES. Waiting for the
    // last flower to shut before moving a stem left a held beat with the
    // bed full of closed buds standing still.
    const { fromMs, foldMs, recedeAtFold } = GARDEN_CLOSE;
    const blossom = GARDEN_BLOSSOMS[0];
    const overlapFrom = fromMs + foldMs * recedeAtFold;

    // Through the first half of the fold, only the flowers move.
    expect(stemAt(blossom, overlapFrom)).toBe(1);
    expect(blossomAt(blossom, overlapFrom).openness).toBeCloseTo(0.5, 2);

    // Through the second half, both do.
    const mid = overlapFrom + (foldMs * (1 - recedeAtFold)) / 2;
    expect(blossomAt(blossom, mid).openness).toBeGreaterThan(0);
    expect(stemAt(blossom, mid)).toBeLessThan(1);

    // The stem is still on its way down when the last petal shuts, so
    // there is no moment of stillness between the two.
    const shut = fromMs + foldMs;
    expect(blossomAt(blossom, shut).openness).toBe(0);
    expect(stemAt(blossom, shut)).toBeGreaterThan(0);
    expect(stemAt(blossom, shut)).toBeLessThan(1);
  });

  it('takes a flower back down the way it came', () => {
    const blossom = GARDEN_BLOSSOMS[0];
    expect(blossomAt(blossom, GARDEN_CLOSE.fromMs).openness).toBe(1);

    const half = blossomAt(blossom, GARDEN_CLOSE.fromMs + GARDEN_CLOSE.foldMs / 2);
    // Eased at both ends, so half the time is half the fold — not the
    // opening's curve, which had it 87% shut by now.
    expect(half.openness).toBeCloseTo(0.5, 2);
    // The plate's reveal follows openness, so the petals un-draw.
    expect(half.progress).toBe(half.openness);

    const shut = blossomAt(blossom, GARDEN_CLOSE.fromMs + GARDEN_CLOSE.foldMs);
    expect(shut.openness).toBe(0);
    expect(shut.closed).toBe(true);
  });

  it('withdraws a stem at the same measured pace', () => {
    const blossom = GARDEN_BLOSSOMS[0];
    const from = GARDEN_CLOSE.fromMs + GARDEN_CLOSE.foldMs * GARDEN_CLOSE.recedeAtFold;
    expect(stemAt(blossom, from)).toBe(1);
    expect(stemAt(blossom, from + GARDEN_CLOSE.recedeMs / 2)).toBeCloseTo(0.5, 2);
    expect(stemAt(blossom, from + GARDEN_CLOSE.recedeMs)).toBe(0);
  });

  it('leaves the bed bare before the card has finished arriving', () => {
    const bare = GARDEN_CLOSE.fromMs
      + Math.max(GARDEN_CLOSE.foldMs, GARDEN_CLOSE.foldMs * GARDEN_CLOSE.recedeAtFold + GARDEN_CLOSE.recedeMs);
    expect(bare).toBeLessThan(GARDEN_DURATION_MS);
    for (const blossom of GARDEN_BLOSSOMS) {
      expect(blossomAt(blossom, bare).openness, blossom.id).toBe(0);
      expect(stemAt(blossom, bare), blossom.id).toBe(0);
    }
  });
});

describe('the dark field', () => {
  const luma = hex => {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
  };

  it('grains deeply enough to break a contour, lightly enough to stay unseen', () => {
    // The whole card spans about six 8-bit levels. Under two, the grain
    // cannot straddle a level boundary and the rings stay; over five it
    // stops being dither and starts being texture on the flowers.
    expect(GARDEN_GRAIN.levels).toBeGreaterThanOrEqual(2);
    expect(GARDEN_GRAIN.levels).toBeLessThanOrEqual(5);
    expect(GARDEN_SCORE.grain).toBe(GARDEN_GRAIN);
  });

  it('sinks the pill to the floor, which is where its bands are narrowest', () => {
    // Counter-intuitive and worth pinning: the FAINTEST pill is the one
    // that rings, because six levels spread over the feather band every
    // twenty pixels. Taking the well all the way down crosses three
    // times as many levels in the same distance, and a five-pixel band
    // is one the grain can hide.
    const pill = GARDEN_ANNOUNCEMENT.message.pill;
    expect(pill.opacity).toBe(1);
    for (const ground of [GARDEN_GROUND.topColor, GARDEN_GROUND.earthColor]) {
      expect(luma(pill.color), ground).toBeLessThanOrEqual(luma(ground));
    }
  });
});

describe('the wordmark flame', () => {
  // The fill is drawn at half the frame's width in height.
  const pixels = GARDEN_SCORE.viewport.width * Math.round(GARDEN_SCORE.viewport.width * 0.5);

  it('draws enough samples for the chaos game to resolve', () => {
    // THE DEFECT THIS PINS. The first version drew 900_000 samples over
    // 583_200 pixels — one and a half each — and a chaos game at that
    // density is not a flame, it is confetti, which is what the letters
    // were filled with. Density is the whole difference between the two.
    const perPixel = GARDEN_WORDMARK.flame.iterations / pixels;
    expect(perPixel).toBeGreaterThan(40);
  });

  it('holds a brightness that suits that density', () => {
    // The two are inverse: samples pile up in the same bins, so raising
    // the count without lowering the gain only clips the letters white.
    expect(GARDEN_WORDMARK.flame.brightness).toBeLessThan(4);
    expect(GARDEN_WORDMARK.flame.brightness).toBeGreaterThan(0);
  });

  it('names the flame it was auditioned into, and not a derived seed', () => {
    // Every other seed here hangs off GARDEN_SEED because what it picks
    // is arbitrary. This one picks the artwork, so it is a constant and
    // changing it is a change to the piece — including, deliberately,
    // that it does NOT follow GARDEN_SEED if that is ever retuned.
    expect(GARDEN_WORDMARK.seed).toBe('rise-flame-25');
    expect(GARDEN_WORDMARK.seed.includes(GARDEN_SEED)).toBe(false);
  });
});

describe('the release card', () => {
  const pieces = () => [
    GARDEN_ANNOUNCEMENT.message,
    GARDEN_ANNOUNCEMENT.mark,
    GARDEN_ANNOUNCEMENT.credit
  ];

  it('arrives in reading order: the message, then the mark, then whose it is', () => {
    const [message, mark, credit] = pieces();
    expect(message.fromMs).toBeLessThan(mark.fromMs);
    expect(mark.fromMs).toBeLessThan(credit.fromMs);
  });

  it('waits for the wordmark to have resolved before saying anything', () => {
    const resolvedAt = GARDEN_WORDMARK.fromMs
      + GARDEN_WORDMARK.letterStaggerMs * (GARDEN_WORDMARK.text.length - 1)
      + GARDEN_WORDMARK.letterRevealMs;
    expect(GARDEN_ANNOUNCEMENT.message.fromMs).toBeGreaterThan(resolvedAt);
  });

  it('is fully landed and held before the last frame', () => {
    for (const piece of pieces()) {
      const landed = piece.fromMs + piece.revealMs;
      expect(landed).toBeLessThan(GARDEN_DURATION_MS);
      expect(revealAt(piece, landed)).toBe(1);
      expect(revealAt(piece, piece.fromMs)).toBe(0);
      expect(revealAt(piece, GARDEN_DURATION_MS)).toBe(1);
    }
    const last = Math.max(...pieces().map(p => p.fromMs + p.revealMs));
    // Long enough that the closing frame is the card, not its arrival.
    expect(GARDEN_DURATION_MS - last).toBeGreaterThan(2_000);
  });

  it('stacks down the frame without colliding with the wordmark', () => {
    const [message, mark, credit] = pieces();
    expect(GARDEN_WORDMARK.centerY).toBeLessThan(message.centerY);
    expect(message.centerY).toBeLessThan(mark.centerY);
    expect(mark.centerY).toBeLessThan(credit.centerY);
    expect(credit.centerY).toBeLessThan(1);
  });
});
