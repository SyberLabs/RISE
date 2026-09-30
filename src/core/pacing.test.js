/**
 * RISE Pacing Engine Test Suite
 * Tests for StateCurve and PacingEngine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Modality,
  StateCurve,
  PacingEngine
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

    it('semantic texture is OFF by default — authored duration is the contract', () => {
      const simple = { modality: Modality.TEXT, content: 'word', duration: 300, complexity: 0 };
      const complex = { modality: Modality.TEXT, content: 'word', duration: 300, complexity: 1 };

      expect(engine.computeDuration(simple)).toBe(engine.computeDuration(complex));
    });

    it('opt-in texture is zero-mean: neutral atoms are untouched, range is bounded', () => {
      const textured = new PacingEngine({ baseWpm: 320, semanticTexture: true });
      textured.setStateCurve(StateCurve.flat());

      const neutral = { modality: Modality.TEXT, content: 'word', duration: 300, complexity: 0.5, weight: 0.5 };
      expect(textured.computeDuration(neutral, 0.5)).toBe(300);

      const dense = { modality: Modality.TEXT, content: 'word', duration: 300, complexity: 1, weight: 1 };
      const light = { modality: Modality.TEXT, content: 'word', duration: 300, complexity: 0, weight: 0 };
      expect(textured.computeDuration(dense, 0.5)).toBe(360);  // ×1.2 ceiling
      expect(textured.computeDuration(light, 0.5)).toBe(240);  // ×0.8 floor
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

    it('evaluates the curve at cumulative authored time, not atom index', () => {
      // A curve's climax must land at the reading's temporal midpoint:
      // one long atom followed by two short ones puts the short atoms
      // near the END of the reading, not at indices 0.5 and 1.0.
      const positions = [];
      engine.setStateCurve({ at: position => { positions.push(position); return 1; } });

      engine.paceAtoms([
        { modality: Modality.TEXT, content: 'long', duration: 8000 },
        { modality: Modality.TEXT, content: 'short', duration: 100 },
        { modality: Modality.TEXT, content: 'short', duration: 100 }
      ]);

      // Temporal midpoints over 8200ms total
      expect(positions[0]).toBeCloseTo(4000 / 8200, 5);
      expect(positions[1]).toBeCloseTo(8050 / 8200, 5);
      expect(positions[2]).toBeCloseTo(8150 / 8200, 5);
    });

    it('falls back to index spacing when atoms carry no durations', () => {
      const positions = [];
      engine.setStateCurve({ at: position => { positions.push(position); return 1; } });

      engine.paceAtoms([
        { modality: Modality.TEXT, content: 'a' },
        { modality: Modality.TEXT, content: 'b' },
        { modality: Modality.TEXT, content: 'c' }
      ]);

      expect(positions).toEqual([0, 0.5, 1]);
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
      expect(engine.baseWpm).toBe(320);
      engine.setWpm(5000);
      expect(engine.baseWpm).toBe(1000);
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
});
