/**
 * R.I.S.E. Pacing Engine Test Suite
 * Tests for StateCurve, PacingEngine, and Interleaver
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Modality,
  IntentType,
  StateCurve,
  PacingEngine,
  InterleavePattern,
  Interleaver
} from './pacing.js';

describe('StateCurve', () => {
  describe('flat curve', () => {
    it('returns 1.0 at all positions', () => {
      const curve = StateCurve.flat();

      expect(curve.at(0)).toBe(1.0);
      expect(curve.at(0.5)).toBe(1.0);
      expect(curve.at(1.0)).toBe(1.0);
    });
  });

  describe('induction curve', () => {
    it('starts at 0.8x and increases to 2.0x (settling into receptivity)', () => {
      const curve = StateCurve.induction();

      // Induction: fast start → slow finish (settling into receptive state)
      expect(curve.at(0)).toBe(0.8);
      expect(curve.at(0.5)).toBe(1.4);
      expect(curve.at(1.0)).toBe(2.0);
    });

    it('creates descending tempo (slow down)', () => {
      const curve = StateCurve.induction();

      // Higher multiplier = longer duration = slower
      expect(curve.at(1.0)).toBeGreaterThan(curve.at(0));
    });
  });

  describe('ascent curve', () => {
    it('starts at 1.8x and decreases to 0.5x (building momentum)', () => {
      const curve = StateCurve.ascent();

      // Arousal: slow start → fast finish (building energy and momentum)
      expect(curve.at(0)).toBe(1.8);
      expect(curve.at(0.5)).toBeCloseTo(1.15, 5);
      expect(curve.at(1.0)).toBe(0.5);
    });

    it('creates ascending tempo (speed up)', () => {
      const curve = StateCurve.ascent();

      // Lower multiplier = shorter duration = faster
      expect(curve.at(1.0)).toBeLessThan(curve.at(0));
    });
  });

  describe('wave curve', () => {
    it('oscillates around 1.0', () => {
      const curve = StateCurve.wave(2);

      // At 0, sin(0) = 0, so value is 1.0
      expect(curve.at(0)).toBeCloseTo(1.0, 1);

      // Wave should go above and below 1.0
      const values = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map(p => curve.at(p));
      const hasAbove = values.some(v => v > 1.0);
      const hasBelow = values.some(v => v < 1.0);

      expect(hasAbove).toBe(true);
      expect(hasBelow).toBe(true);
    });

    it('respects frequency parameter', () => {
      const lowFreq = StateCurve.wave(1);
      const highFreq = StateCurve.wave(4);

      // Different frequencies should produce different patterns
      const lowValues = [0.1, 0.2, 0.3].map(p => lowFreq.at(p));
      const highValues = [0.1, 0.2, 0.3].map(p => highFreq.at(p));

      expect(lowValues).not.toEqual(highValues);
    });
  });

  describe('climax curve', () => {
    it('accelerates towards peak then decelerates', () => {
      const curve = StateCurve.climax(0.75);

      const beforePeak = curve.at(0.7);
      const atPeak = curve.at(0.75);
      const afterPeak = curve.at(0.9);

      // Approaching peak = faster (lower multiplier)
      expect(beforePeak).toBeLessThan(curve.at(0));
      // After peak = slower (higher multiplier)
      expect(afterPeak).toBeGreaterThan(atPeak);
    });

    it('respects custom peak position', () => {
      const earlyPeak = StateCurve.climax(0.3);
      const latePeak = StateCurve.climax(0.9);

      // At 0.5:
      // - earlyPeak (0.3): past peak, decelerating → lower multiplier (faster)
      // - latePeak (0.9): before peak, accelerating → higher multiplier (slower)
      expect(earlyPeak.at(0.5)).toBeLessThan(latePeak.at(0.5));
    });
  });

  describe('forIntent', () => {
    it('returns correct curve for each intent type', () => {
      expect(StateCurve.forIntent(IntentType.INDUCTION)).toBeInstanceOf(StateCurve);
      expect(StateCurve.forIntent(IntentType.INSTALLATION)).toBeInstanceOf(StateCurve);
      expect(StateCurve.forIntent(IntentType.INGESTION)).toBeInstanceOf(StateCurve);
      expect(StateCurve.forIntent(IntentType.SYNTHESIS)).toBeInstanceOf(StateCurve);
      expect(StateCurve.forIntent(IntentType.RECURSION)).toBeInstanceOf(StateCurve);
    });

    it('returns flat curve for unknown intent', () => {
      const curve = StateCurve.forIntent('unknown');
      expect(curve.at(0)).toBe(1.0);
      expect(curve.at(1.0)).toBe(1.0);
    });
  });

  describe('position clamping', () => {
    it('clamps positions below 0', () => {
      const curve = StateCurve.ascent();

      expect(curve.at(-0.5)).toBe(curve.at(0));
    });

    it('clamps positions above 1', () => {
      const curve = StateCurve.ascent();

      expect(curve.at(1.5)).toBe(curve.at(1.0));
    });
  });
});

describe('PacingEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new PacingEngine({ baseWpm: 220 });
  });

  describe('computeDuration', () => {
    it('computes duration for text atoms based on WPM', () => {
      const atom = { modality: Modality.TEXT, content: 'word' };
      const duration = engine.computeDuration(atom);

      // 1 word at 220 WPM = 60000/220 = ~273ms
      expect(duration).toBeGreaterThan(200);
      expect(duration).toBeLessThan(400);
    });

    it('scales duration with word count', () => {
      const oneWord = { modality: Modality.TEXT, content: 'one' };
      const threeWords = { modality: Modality.TEXT, content: 'one two three' };

      const oneDuration = engine.computeDuration(oneWord);
      const threeDuration = engine.computeDuration(threeWords);

      expect(threeDuration).toBeGreaterThan(oneDuration * 2);
    });

    it('uses default duration for images', () => {
      const atom = { modality: Modality.IMAGE };
      const duration = engine.computeDuration(atom);

      expect(duration).toBe(2000); // view duration default
    });

    it('respects custom image duration', () => {
      const atom = { modality: Modality.IMAGE, duration: 500 };
      const duration = engine.computeDuration(atom);

      expect(duration).toBe(500);
    });

    it('applies complexity modifier', () => {
      const simple = { modality: Modality.TEXT, content: 'word', complexity: 0 };
      const complex = { modality: Modality.TEXT, content: 'word', complexity: 1 };

      expect(engine.computeDuration(complex)).toBeGreaterThan(engine.computeDuration(simple));
    });

    it('applies weight modifier', () => {
      const light = { modality: Modality.TEXT, content: 'word', weight: 0 };
      const heavy = { modality: Modality.TEXT, content: 'word', weight: 1 };

      expect(engine.computeDuration(heavy)).toBeGreaterThan(engine.computeDuration(light));
    });

    it('applies state curve at position', () => {
      engine.setStateCurve(StateCurve.ascent());

      const atom = { modality: Modality.TEXT, content: 'word' };
      const startDuration = engine.computeDuration(atom, 0);
      const endDuration = engine.computeDuration(atom, 1);

      // Arousal curve: slower at start, faster at end
      expect(startDuration).toBeGreaterThan(endDuration);
    });

    it('respects min duration', () => {
      const engine = new PacingEngine({ baseWpm: 800, minDuration: 100 });
      const atom = { modality: Modality.TEXT, content: 'a' };

      expect(engine.computeDuration(atom)).toBeGreaterThanOrEqual(100);
    });

    it('respects max duration', () => {
      const engine = new PacingEngine({ baseWpm: 10, maxDuration: 5000 });
      const atom = { modality: Modality.TEXT, content: 'word '.repeat(100) };

      expect(engine.computeDuration(atom)).toBeLessThanOrEqual(5000);
    });
  });

  describe('paceAtoms', () => {
    it('applies pacing to array of atoms', () => {
      const atoms = [
        { modality: Modality.TEXT, content: 'one' },
        { modality: Modality.TEXT, content: 'two' },
        { modality: Modality.TEXT, content: 'three' }
      ];

      const paced = engine.paceAtoms(atoms);

      expect(paced.length).toBe(3);
      paced.forEach(atom => {
        expect(atom.duration).toBeGreaterThan(0);
      });
    });

    it('applies position-based curve', () => {
      engine.setStateCurve(StateCurve.ascent());

      const atoms = [
        { modality: Modality.TEXT, content: 'start' },
        { modality: Modality.TEXT, content: 'end' }
      ];

      const paced = engine.paceAtoms(atoms);

      // First atom at position 0, second at position 1
      // Arousal: slower at start, faster at end
      expect(paced[0].duration).toBeGreaterThan(paced[1].duration);
    });

    it('preserves authored chunk timing relationships', () => {
      const atoms = [
        { modality: Modality.TEXT, content: 'word', duration: 250, complexity: 0, weight: 0 },
        { modality: Modality.TEXT, content: 'word.', duration: 375, complexity: 0, weight: 0 }
      ];

      const paced = engine.paceAtoms(atoms);

      expect(paced[1].duration).toBeGreaterThan(paced[0].duration);
      expect(paced[1].duration / paced[0].duration).toBeCloseTo(1.5, 1);
    });

    it('does not rewrite timing-locked markers', () => {
      const paced = engine.paceAtoms([
        { modality: Modality.TEXT, content: '', duration: 50, timingLocked: true, tags: ['FLASH'] },
        { modality: Modality.TEXT, content: '', duration: 2000, timingLocked: true, tags: ['PAUSE'] }
      ]);

      expect(paced.map(atom => atom.duration)).toEqual([50, 2000]);
    });
  });

  describe('setWpm', () => {
    it('changes base WPM', () => {
      const atom = { modality: Modality.TEXT, content: 'word' };

      engine.setWpm(440);
      const fastDuration = engine.computeDuration(atom);

      engine.setWpm(110);
      const slowDuration = engine.computeDuration(atom);

      expect(fastDuration).toBeLessThan(slowDuration);
    });

    it('normalizes malformed and out-of-range WPM', () => {
      engine.setWpm(0);
      expect(engine.baseWpm).toBe(50);
      engine.setWpm('not-a-number');
      expect(engine.baseWpm).toBe(220);
      engine.setWpm(5000);
      expect(engine.baseWpm).toBe(1000);
    });
  });
});

describe('Interleaver', () => {
  let interleaver;
  let textAtoms;
  let imageAtoms;

  beforeEach(() => {
    interleaver = new Interleaver();

    textAtoms = [
      { content: 'T1', modality: 'text' },
      { content: 'T2', modality: 'text' },
      { content: 'T3', modality: 'text' },
      { content: 'T4', modality: 'text' },
      { content: 'T5', modality: 'text' },
      { content: 'T6', modality: 'text' },
      { content: 'T7', modality: 'text' },
      { content: 'T8', modality: 'text' }
    ];

    imageAtoms = [
      { url: 'img1', modality: 'image' },
      { url: 'img2', modality: 'image' }
    ];
  });

  describe('punctuation pattern', () => {
    it('inserts visuals at intervals', () => {
      const result = interleaver.interleave(
        { text: textAtoms, image: imageAtoms },
        InterleavePattern.PUNCTUATION,
        { interval: 4 }
      );

      // Should have: T1 T2 T3 T4 [I1] T5 T6 T7 T8 [I2]
      expect(result.length).toBe(10);
      expect(result[4].modality).toBe('image');
    });
  });

  describe('alternation pattern', () => {
    it('alternates text and images', () => {
      const result = interleaver.interleave(
        { text: textAtoms.slice(0, 4), image: imageAtoms },
        InterleavePattern.ALTERNATION,
        { textPerImage: 2 }
      );

      // T1 T2 [I1] T3 T4 [I2]
      expect(result[2].modality).toBe('image');
      expect(result[5].modality).toBe('image');
    });
  });

  describe('sandwich pattern', () => {
    it('wraps text with images', () => {
      const result = interleaver.interleave(
        { text: textAtoms.slice(0, 3), image: imageAtoms },
        InterleavePattern.SANDWICH
      );

      // [I1] T1 T2 T3 [I2]
      expect(result[0].modality).toBe('image');
      expect(result[result.length - 1].modality).toBe('image');
    });

    it('repeats single image for both bookends', () => {
      const result = interleaver.interleave(
        { text: textAtoms.slice(0, 2), image: [imageAtoms[0]] },
        InterleavePattern.SANDWICH
      );

      expect(result[0]).toBe(result[result.length - 1]);
    });
  });

  describe('fugue pattern', () => {
    it('interleaves multiple sources round-robin', () => {
      const result = interleaver.interleave(
        {
          text: [{ content: 'T1' }, { content: 'T2' }],
          image: [{ url: 'I1' }, { url: 'I2' }]
        },
        InterleavePattern.FUGUE
      );

      // Should alternate: T1 I1 T2 I2
      expect(result.length).toBe(4);
      expect(result[0].content).toBe('T1');
      expect(result[1].url).toBe('I1');
    });

    it('handles uneven source lengths', () => {
      const result = interleaver.interleave(
        {
          text: [{ content: 'T1' }, { content: 'T2' }, { content: 'T3' }],
          image: [{ url: 'I1' }]
        },
        InterleavePattern.FUGUE
      );

      // T1 I1 T2 T3
      expect(result.length).toBe(4);
    });
  });

  describe('unknown pattern', () => {
    it('concatenates all atoms linearly', () => {
      const result = interleaver.interleave(
        { text: textAtoms.slice(0, 2), image: imageAtoms.slice(0, 1) },
        'unknown_pattern'
      );

      expect(result.length).toBe(3);
    });
  });

  describe('empty inputs', () => {
    it('handles empty text array', () => {
      const result = interleaver.interleave(
        { text: [], image: imageAtoms },
        InterleavePattern.PUNCTUATION
      );

      expect(result).toEqual([]);
    });

    it('handles empty image array', () => {
      const result = interleaver.interleave(
        { text: textAtoms, image: [] },
        InterleavePattern.ALTERNATION
      );

      expect(result.length).toBe(textAtoms.length);
    });
  });
});

describe('Constants', () => {
  it('exports Modality types', () => {
    expect(Modality.TEXT).toBe('text');
    expect(Modality.IMAGE).toBe('image');
    expect(Modality.SYMBOL).toBe('symbol');
    expect(Modality.AUDIO).toBe('audio');
    expect(Modality.COMPOSITE).toBe('composite');
  });

  it('exports IntentType values', () => {
    expect(IntentType.INDUCTION).toBe('induction');
    expect(IntentType.INSTALLATION).toBe('installation');
    expect(IntentType.INGESTION).toBe('ingestion');
    expect(IntentType.SYNTHESIS).toBe('synthesis');
    expect(IntentType.RECURSION).toBe('recursion');
  });

  it('exports InterleavePattern values', () => {
    expect(InterleavePattern.PUNCTUATION).toBe('punctuation');
    expect(InterleavePattern.ALTERNATION).toBe('alternation');
    expect(InterleavePattern.SANDWICH).toBe('sandwich');
    expect(InterleavePattern.LAYERED).toBe('layered');
    expect(InterleavePattern.FUGUE).toBe('fugue');
  });
});
