import { describe, it, expect } from 'vitest';
import { TEMPERS, rollReading, composeRoll, rollTitleOf } from './roll.js';
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

describe('a roll keeps the parts it is given', () => {
  const sectionOf = roll => roll.decision.config.section;

  it('keeps a given work, temper and section exactly', () => {
    const random = seeded(31);
    for (let i = 0; i < 100; i += 1) {
      const roll = rollReading({ random, workId: 'oedipus-rex', temper: 'revel', section: 'last' });
      expect(roll.decision.workId).toBe('oedipus-rex');
      expect(roll.temper).toBe('revel');
      expect(sectionOf(roll)).toBe('last');
      expect(() => validateJevRecommendation(roll.decision)).not.toThrow();
    }
  });

  it('picks a star: keeps the work and draws the rest', () => {
    const random = seeded(33);
    const tempers = new Set();
    for (let i = 0; i < 200; i += 1) {
      const roll = rollReading({ random, workId: 'the-iliad' });
      expect(roll.decision.workId).toBe('the-iliad');
      tempers.add(roll.temper);
    }
    expect(tempers.size).toBe(TEMPERS.length);
  });

  it('redraws one part and keeps the other two, never repeating the part it redraws', () => {
    const random = seeded(35);
    let previous = rollReading({ random });
    for (let i = 0; i < 300; i += 1) {
      const text = rollReading({ random, previous, temper: previous.temper, section: sectionOf(previous) });
      expect(text.temper).toBe(previous.temper);
      expect(sectionOf(text)).toBe(sectionOf(previous));
      expect(text.decision.workId).not.toBe(previous.decision.workId);

      const mood = rollReading({ random, previous: text, workId: text.decision.workId, section: sectionOf(text) });
      expect(mood.decision.workId).toBe(text.decision.workId);
      expect(sectionOf(mood)).toBe(sectionOf(text));
      expect(mood.temper).not.toBe(text.temper);

      const passage = rollReading({ random, previous: mood, workId: mood.decision.workId, temper: mood.temper });
      expect(passage.decision.workId).toBe(mood.decision.workId);
      expect(passage.temper).toBe(mood.temper);
      expect(sectionOf(passage)).not.toBe(sectionOf(mood));
      previous = passage;
    }
  });

  it('never repeats the previous section when it draws one', () => {
    const random = seeded(37);
    let previous = rollReading({ random });
    for (let i = 0; i < 300; i += 1) {
      const next = rollReading({ random, previous });
      expect(sectionOf(next)).not.toBe(sectionOf(previous));
      previous = next;
    }
  });

  it('refuses a part it does not know, in plain words', () => {
    expect(() => rollReading({ temper: 'jolly' })).toThrow(TypeError);
    expect(() => rollReading({ temper: 'jolly' })).toThrow('jolly is not a temper.');
    expect(() => rollReading({ workId: 'a-doll-s-house' })).toThrow('a-doll-s-house is not a released reading.');
    expect(() => rollReading({ section: 'second' })).toThrow('second is not a section.');
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
