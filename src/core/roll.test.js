import { describe, it, expect } from 'vitest';
import {
  JEV_SPELLING, ROLL_LOOKS, ROLL_RANGES, VIVID_LOOKS, rollReading, composeRoll, rollTitleOf
} from './roll.js';
import { LOOKS } from './looks.js';
import { resolveJevChamberConfig } from './jev-config.js';
import { getTextById } from '../content/library.js';
import { validateJevRecommendation } from '../app/jev-reading.js';
import { jevReleasedWorkIds, summarizeJevPlan } from './jev-describe.js';

/** A seeded generator, so a failing roll can be replayed. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SECTIONS = ['first', 'middle', 'last', 'shortest', 'longest'];
const ids = looks => looks.map(look => look.id);

describe('a roll', () => {
  it('draws only from works RISE has released', () => {
    const released = new Set(jevReleasedWorkIds());
    const random = seeded(1);
    for (let i = 0; i < 200; i += 1) {
      expect(released.has(rollReading({ random }).decision.workId)).toBe(true);
    }
  });

  it('is admitted by the same gate as a Jev answer, for every look, its rhythms and paces, every work and section', () => {
    let turn = 0;
    for (const { id: look } of ROLL_LOOKS) {
      for (const rhythm of ROLL_RANGES[look].rhythms) {
        for (const pace of ROLL_RANGES[look].paces) {
          for (const workId of jevReleasedWorkIds()) {
            const section = SECTIONS[turn++ % SECTIONS.length];
            const decision = composeRoll({ look, workId, section, rhythm, pace, random: seeded(turn) });
            expect(() => validateJevRecommendation(decision), `${look} × ${rhythm} × ${pace} × ${workId}`).not.toThrow();
          }
        }
      }
    }
  });

  it('stays admitted across many random draws', () => {
    const random = seeded(7);
    for (let i = 0; i < 1000; i += 1) {
      expect(() => validateJevRecommendation(rollReading({ random }).decision)).not.toThrow();
    }
  });

  it('says it is a roll, composed here, and never claims to be Jev', () => {
    const { decision } = rollReading({ random: seeded(3) });
    expect(decision.model).toBe('rise/roll-1');
    expect(decision.provider).toBe('RISE');
    expect(decision.requestId).toMatch(/^roll-/u);
  });

  it('carries the look it was composed in', () => {
    const random = seeded(17);
    for (let i = 0; i < 50; i += 1) {
      const rolled = rollReading({ random });
      expect(rolled.decision.look).toBe(rolled.look);
    }
  });

  it('never repeats the previous work or look', () => {
    const random = seeded(11);
    let previous = rollReading({ random });
    for (let i = 0; i < 300; i += 1) {
      const next = rollReading({ random, previous });
      expect(next.decision.workId).not.toBe(previous.decision.workId);
      expect(next.look).not.toBe(previous.look);
      previous = next;
    }
  });

  it('never repeats the previous section', () => {
    const sectionOf = roll => roll.decision.config.section;
    const random = seeded(37);
    let previous = rollReading({ random });
    for (let i = 0; i < 300; i += 1) {
      const next = rollReading({ random, previous });
      expect(sectionOf(next)).not.toBe(sectionOf(previous));
      previous = next;
    }
  });

  it('plays one sound and one visual for the whole reading', () => {
    const random = seeded(5);
    for (let i = 0; i < 200; i += 1) {
      const { config } = rollReading({ random }).decision;
      expect(config.visualArc).toBe('single');
      expect(config.middleAudio).toBe(config.audio);
      expect(config.finaleAudio).toBe(config.audio);
    }
  });

  it('reaches every look it may draw, and every rhythm and pace inside each look', () => {
    const random = seeded(13);
    const drawn = new Map();
    for (let i = 0; i < 800; i += 1) {
      const { look, decision } = rollReading({ random });
      const seen = drawn.get(look) ?? { rhythms: new Set(), paces: new Set() };
      seen.rhythms.add(decision.config.chunkMode);
      seen.paces.add(decision.config.wpm);
      drawn.set(look, seen);
    }
    expect([...drawn.keys()].sort()).toEqual(ids(ROLL_LOOKS).sort());
    for (const [look, { rhythms, paces }] of drawn) {
      expect([...rhythms].sort(), look).toEqual([...ROLL_RANGES[look].rhythms].sort());
      expect([...paces].sort((a, b) => a - b), look).toEqual([...ROLL_RANGES[look].paces].sort((a, b) => a - b));
    }
  });
});

describe('the looks a roll draws', () => {
  it('are every look but Gallery and Flame, whose fields are not on Jev\'s menu, and Inlay, held back until five readers are observed', () => {
    expect(ids(ROLL_LOOKS)).toEqual(['plain', 'nocturne', 'garden', 'signal', 'iris', 'revel', 'vigil']);
  });

  it('are the registry\'s own entries, so a look is tuned in one place', () => {
    for (const look of ROLL_LOOKS) expect(LOOKS).toContain(look);
  });

  it('refuses a look a roll cannot draw', () => {
    for (const look of ['gallery', 'flame', 'inlay', 'ember']) {
      expect(() => composeRoll({ look, workId: jevReleasedWorkIds()[0], section: 'first' }), look).toThrow(TypeError);
    }
  });
});

describe('the spelling table', () => {
  it('names each look value Jev\'s menu spells another way', () => {
    expect(JEV_SPELLING).toEqual({
      soundscape: { none: 'silent' },
      galleryCadence: { 0.15: 'slow', 0.5: 'balanced', 0.85: 'lively' }
    });
  });

  it('is the inverse of how Jev\'s plan is resolved', () => {
    const plan = { chunkMode: 'phrase', visualMode: 'interlocution', visualEngine: 'turrell', visualStyle: 'gentle', fontSize: 'large', colorTheme: 'classic', wordFill: 'plain' };
    for (const [soundscape, audio] of Object.entries(JEV_SPELLING.soundscape)) {
      expect(resolveJevChamberConfig({ ...plan, audio, galleryCadence: 'slow' }).soundscape).toBe(soundscape);
    }
    for (const [cadence, name] of Object.entries(JEV_SPELLING.galleryCadence)) {
      expect(resolveJevChamberConfig({ ...plan, audio: 'aurora', galleryCadence: name })
        .visualConfig.interlocution.galleryCadence).toBe(Number(cadence));
    }
  });
});

describe('what a look leaves to its theme', () => {
  const draws = (look, random) => composeRoll({ look, workId: jevReleasedWorkIds()[0], section: 'first', random }).config;

  it('signal names no filament palette: white, so the theme\'s row mounts', () => {
    for (const random of [() => 0, () => 0.5, () => 0.999]) expect(draws('signal', random).visualPalette).toBe('white');
  });

  it('garden names no Genesis preset: random, so the theme\'s preset mounts', () => {
    for (const random of [() => 0, () => 0.5, () => 0.999]) expect(draws('garden', random).kleePreset).toBe('random');
  });
});

describe('the rhythm and pace a roll reads at', () => {
  it('comes from each look\'s own range, the one its temper had, centre first', () => {
    expect(ROLL_RANGES).toEqual({
      plain: { rhythms: ['sentence'], paces: [150, 200] },
      nocturne: { rhythms: ['phrase'], paces: [150, 200] },
      garden: { rhythms: ['phrase'], paces: [150, 200] },
      signal: { rhythms: ['phrase'], paces: [250, 300] },
      iris: { rhythms: ['phrase'], paces: [200, 250] },
      revel: { rhythms: ['phrase'], paces: [300, 400] },
      vigil: { rhythms: ['sentence', 'phrase'], paces: [100, 150] }
    });
    expect(Object.keys(ROLL_RANGES).sort()).toEqual(ids(ROLL_LOOKS).sort());
  });

  it('is never a word at a time: Word stays a choice in Reader setup', () => {
    for (const [look, { rhythms }] of Object.entries(ROLL_RANGES)) expect(rhythms, look).not.toContain('word');
  });

  it('is the rhythm and pace it was given inside the look\'s range, with an even curve', () => {
    for (const { id } of ROLL_LOOKS) {
      const { rhythms, paces } = ROLL_RANGES[id];
      const rhythm = rhythms.at(-1), pace = paces.at(-1);
      const { config } = composeRoll({ look: id, workId: jevReleasedWorkIds()[0], section: 'first', rhythm, pace });
      expect([config.chunkMode, config.wpm, config.curve], id).toEqual([rhythm, pace, 'flat']);
    }
  });

  it('is the look\'s centre when none is given', () => {
    for (const { id } of ROLL_LOOKS) {
      const { config } = composeRoll({ look: id, workId: jevReleasedWorkIds()[0], section: 'first' });
      expect([config.chunkMode, config.wpm], id).toEqual([ROLL_RANGES[id].rhythms[0], ROLL_RANGES[id].paces[0]]);
    }
  });

  it('refuses a rhythm or a pace outside the look\'s range', () => {
    const roll = overrides => () => composeRoll({ workId: jevReleasedWorkIds()[0], section: 'first', ...overrides });
    expect(roll({ look: 'revel', pace: 150 })).toThrow(TypeError);
    expect(roll({ look: 'revel', rhythm: 'sentence' })).toThrow(TypeError);
    expect(roll({ look: 'vigil', rhythm: 'word' })).toThrow(TypeError);
    expect(roll({ look: 'plain', rhythm: 'phrase' })).toThrow(TypeError);
  });
});

describe('a vivid roll', () => {
  it('names the looks whose visuals are immersive or psychedelic', () => {
    expect(ids(VIVID_LOOKS)).toEqual(['signal', 'iris', 'revel']);
  });

  it('draws only vivid looks, and never the previous one', () => {
    const random = seeded(53);
    const vivid = new Set(ids(VIVID_LOOKS));
    const seen = new Set();
    let previous = rollReading({ random, vivid: true });
    for (let i = 0; i < 300; i += 1) {
      const next = rollReading({ random, previous, vivid: true });
      expect(vivid.has(next.look), next.look).toBe(true);
      expect(next.look).not.toBe(previous.look);
      expect(next.decision.config.visualMode).not.toBe('off');
      expect(next.decision.config.chunkMode).toBe('phrase');
      seen.add(next.look);
      previous = next;
    }
    expect([...seen].sort()).toEqual([...vivid].sort());
  });
});

describe('a roll names its reading', () => {
  it('carries the title and author of every released work, as the Library has them', () => {
    for (const workId of jevReleasedWorkIds()) {
      const held = getTextById(workId);
      expect(rollTitleOf(workId), workId).toEqual({ title: held.title, author: held.author });
    }
  });

  it('puts them on the decision, and still passes admission', () => {
    const random = seeded(21);
    for (let i = 0; i < 100; i += 1) {
      const { decision } = rollReading({ random });
      expect(decision.title).toBe(rollTitleOf(decision.workId).title);
      expect(decision.author).toBe(rollTitleOf(decision.workId).author);
      expect(() => validateJevRecommendation(decision)).not.toThrow();
    }
  });

  it('knows no title for a work that is not released', () => {
    expect(rollTitleOf('a-doll-s-house')).toBeNull();
  });
});

describe('the plan line', () => {
  const plan = (look, overrides = {}) => composeRoll({
    look, workId: jevReleasedWorkIds()[0], section: 'first', random: () => 0, ...overrides
  }).config;

  it('names pace and unit, imagery, sound and type, from the plan itself', () => {
    const parts = summarizeJevPlan(plan('plain'));
    expect(parts).toHaveLength(4);
    expect(parts[1]).toBe('no imagery');
    expect(parts[2]).toBe('silence');
  });

  it('follows the plan when the plan changes', () => {
    const nocturne = plan('nocturne', { pace: 200 });
    expect(summarizeJevPlan(nocturne)).toEqual(['steady phrases', 'soft atmospheric light', 'soft rain', 'literary serif']);
  });
});
