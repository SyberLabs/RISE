import { describe, expect, it } from 'vitest';
import { validateJevRecommendation } from '../app/jev-reading.js';
import { ROLL_RANGES, VIVID_LOOKS } from './roll.js';
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
      seen.add(decision.look);
    }
    // The day chooses among the vivid looks only: immersive or psychedelic visuals.
    expect([...seen].sort()).toEqual(VIVID_LOOKS.map(look => look.id).sort());
  });

  it('reads in phrases on every date, never a word at a time, at a pace inside the day\'s look', () => {
    const paces = new Map();
    for (let day = 0; day < todayPool().length; day++) {
      const pick = todayPoem(new Date(2026, 0, 1 + day, 12));
      const { look, config } = todayDecision(pick);
      expect(config.chunkMode, pick.seed).toBe('phrase');
      paces.set(look, (paces.get(look) ?? new Set()).add(config.wpm));
    }
    for (const [look, drawn] of paces) {
      expect([...drawn].sort((a, b) => a - b), look).toEqual([...ROLL_RANGES[look].paces].sort((a, b) => a - b));
    }
  });

  it('is the same all day, and admitted like any roll', () => {
    const morning = todayDecision(todayPoem(new Date(2026, 9, 3, 7)));
    const night = todayDecision(todayPoem(new Date(2026, 9, 3, 23)));
    expect(night.look).toBe(morning.look);
    expect(night.config).toEqual(morning.config);
    expect(() => validateJevRecommendation(morning)).not.toThrow();
  });
});
