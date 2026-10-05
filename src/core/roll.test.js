import { describe, it, expect } from 'vitest';
import { TEMPERS, VISUAL_TEMPERS, rollReading, composeRoll, rollTitleOf } from './roll.js';
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

describe('a roll', () => {
  it('draws only from works RISE has released', () => {
    const released = new Set(jevReleasedWorkIds());
    const random = seeded(1);
    for (let i = 0; i < 200; i += 1) {
      expect(released.has(rollReading({ random }).decision.workId)).toBe(true);
    }
  });

  it('is admitted by the same gate as a Jev answer, for every temper, work and section', () => {
    for (const temper of TEMPERS) {
      for (const workId of jevReleasedWorkIds()) {
        for (const section of ['first', 'middle', 'last', 'shortest', 'longest']) {
          const decision = composeRoll({ temper, workId, section, random: seeded(workId.length + section.length) });
          expect(() => validateJevRecommendation(decision), `${temper.id} × ${workId} × ${section}`).not.toThrow();
        }
      }
    }
  });

  it('stays admitted across many random draws inside each temper', () => {
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

  it('never repeats the previous work or temper', () => {
    const random = seeded(11);
    let previous = rollReading({ random });
    for (let i = 0; i < 300; i += 1) {
      const next = rollReading({ random, previous });
      expect(next.decision.workId).not.toBe(previous.decision.workId);
      expect(next.temper).not.toBe(previous.temper);
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

  it('reaches every temper', () => {
    const random = seeded(13);
    const seen = new Set();
    for (let i = 0; i < 400; i += 1) seen.add(rollReading({ random }).temper);
    expect([...seen].sort()).toEqual(TEMPERS.map(temper => temper.id).sort());
  });
});

describe('the rhythm a roll reads in', () => {
  it('is never a word at a time: Word stays a choice in Reader setup', () => {
    for (const temper of TEMPERS) expect(temper.chunkMode, temper.id).not.toContain('word');
  });
});

describe('a vivid roll', () => {
  it('names the tempers whose visuals are immersive or psychedelic', () => {
    expect(VISUAL_TEMPERS.map(item => item.id).sort()).toEqual(['ember', 'revel', 'signal']);
  });

  it('draws only vivid tempers, and never the previous one', () => {
    const random = seeded(53);
    const vivid = new Set(VISUAL_TEMPERS.map(item => item.id));
    const seen = new Set();
    let previous = rollReading({ random, vivid: true });
    for (let i = 0; i < 300; i += 1) {
      const next = rollReading({ random, previous, vivid: true });
      expect(vivid.has(next.temper), next.temper).toBe(true);
      expect(next.temper).not.toBe(previous.temper);
      expect(next.decision.config.visualMode).not.toBe('off');
      seen.add(next.temper);
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
  const plan = overrides => composeRoll({
    temper: TEMPERS.find(temper => temper.id === 'plainsong'), workId: jevReleasedWorkIds()[0],
    section: 'first', random: () => 0, ...overrides
  }).config;

  it('names pace and unit, imagery, sound and type, from the plan itself', () => {
    const parts = summarizeJevPlan(plan());
    expect(parts).toHaveLength(4);
    expect(parts[1]).toBe('no imagery');
    expect(parts[2]).toBe('silence');
  });

  it('follows the plan when the plan changes', () => {
    const nocturne = composeRoll({
      temper: TEMPERS.find(temper => temper.id === 'nocturne'), workId: jevReleasedWorkIds()[0],
      section: 'first', random: () => 0
    }).config;
    const [pace, imagery, sound] = summarizeJevPlan(nocturne);
    expect(pace).toBe(`${nocturne.wpm === 150 ? 'slow' : 'steady'} phrases`);
    expect(imagery).toBe('soft atmospheric light');
    expect(sound).toBe(nocturne.audio.replace(/-/gu, ' '));
  });
});
