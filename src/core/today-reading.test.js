import { describe, expect, it } from 'vitest';
import { validateJevRecommendation } from '../app/jev-reading.js';
import { todayDecision } from './today-reading.js';
import { todayPoem, todayPool } from './today-poem.js';

describe('todayDecision', () => {
  it('reads every poem of a cycle with a procedural visual, never without one', () => {
    const seen = new Set();
    for (let day = 0; day < todayPool().length; day++) {
      const pick = todayPoem(new Date(2026, 0, 1 + day, 12));
      const decision = todayDecision(pick);
      expect(decision.workId).toBe(pick.workId);
      expect(decision.config.visualMode, pick.seed).not.toBe('off');
      expect(decision.config.visualEngine, pick.seed).toBeTruthy();
      // What the Today backdrop reads to choose its engine.
      const visual = decision.config.visualConfig;
      expect(visual.visualMode).toBe(decision.config.visualMode);
      if (visual.visualMode === 'attractor') expect(visual.attractor.system, pick.seed).toBeTruthy();
      else expect(visual.interlocution.procedural, pick.seed).toEqual([decision.config.visualEngine]);
      seen.add(decision.temper);
    }
    // The day chooses among the vivid tempers only: immersive or psychedelic visuals.
    expect([...seen].sort()).toEqual(['ember', 'revel', 'signal']);
  });

  it('reads a recited day line by line, in the same light and sound', () => {
    for (const day of [3, 4, 7]) {
      const pick = todayPoem(new Date(2026, 9, day, 12));
      const plain = todayDecision(pick);
      const recited = todayDecision(pick, { recited: true });
      expect(recited.temper).toBe(plain.temper);
      expect(recited.config.chunkMode).toBe('phrase');
      for (const field of ['visualConfig', 'audio', 'colors', 'visualEngine', 'visualPalette', 'wpm', 'curve']) {
        expect(recited.config[field], `${pick.seed} ${field}`).toEqual(plain.config[field]);
      }
      expect(() => validateJevRecommendation(recited)).not.toThrow();
    }
  });

  it('is the same all day, and admitted like any roll', () => {
    const morning = todayDecision(todayPoem(new Date(2026, 9, 3, 7)));
    const night = todayDecision(todayPoem(new Date(2026, 9, 3, 23)));
    expect(night.temper).toBe(morning.temper);
    expect(night.config).toEqual(morning.config);
    expect(() => validateJevRecommendation(morning)).not.toThrow();
  });
});
