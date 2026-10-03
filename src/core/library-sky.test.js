import { describe, it, expect } from 'vitest';
import { librarySky } from './library-sky.js';
import { jevReleasedWorkIds } from './jev-describe.js';
import { rollTitleOf } from './roll.js';

const sky = librarySky();
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

describe('the library sky', () => {
  it('draws one star for every released work, named as a roll names it', () => {
    expect(sky.stars.map(star => star.workId)).toEqual(jevReleasedWorkIds());
    for (const star of sky.stars) {
      const { title, author } = rollTitleOf(star.workId);
      expect(star).toMatchObject({ title, author });
    }
  });

  it('groups every released classic as verse or prose, and every RISE original as an original', () => {
    for (const star of sky.stars) {
      if (star.author === 'RISE') expect(star.group, star.workId).toBe('originals');
      else expect(['verse', 'prose'], star.workId).toContain(star.group);
    }
  });

  it('names the three groups exactly, with a place for each label', () => {
    expect(sky.groups.map(({ id, label }) => [id, label])).toEqual([
      ['verse', 'Verse and drama'],
      ['prose', 'Prose and wisdom'],
      ['originals', 'RISE originals']
    ]);
    for (const group of sky.groups) {
      expect(group.x).toBeGreaterThanOrEqual(0);
      expect(group.x).toBeLessThanOrEqual(100);
      expect(group.y).toBeGreaterThanOrEqual(0);
      expect(group.y).toBeLessThanOrEqual(100);
    }
  });

  it('keeps every star inside the sky and clear of the text panel', () => {
    for (const star of sky.stars) {
      expect(star.x, star.workId).toBeGreaterThanOrEqual(42);
      expect(star.x, star.workId).toBeLessThanOrEqual(97);
      expect(star.y, star.workId).toBeGreaterThanOrEqual(4);
      expect(star.y, star.workId).toBeLessThanOrEqual(96);
      expect(star.x * 10).toBe(Math.round(star.x * 10));
      expect(star.y * 10).toBe(Math.round(star.y * 10));
    }
  });

  it('keeps every two stars at least 3.5 apart', () => {
    sky.stars.forEach((a, i) => sky.stars.slice(i + 1).forEach(b => {
      expect(distance(a, b), `${a.workId} and ${b.workId}`).toBeGreaterThanOrEqual(3.5);
    }));
  });

  it('leaves room for a 26px target per star in the shortest phone band', () => {
    // Home stretches the stars across a 320px-wide, 220px-tall band; NightSky
    // sizes targets to twice the closest Chebyshev gap, so 13px keeps them 26px.
    const xs = sky.stars.map(s => s.x);
    const x0 = Math.min(...xs);
    const width = 320 * 0.92 / ((Math.max(...xs) - x0) / 100);
    const px = s => [(s.x - x0) / 100 * width, s.y / 100 * 220];
    sky.stars.forEach((a, i) => sky.stars.slice(i + 1).forEach(b => {
      const [ax, ay] = px(a);
      const [bx, by] = px(b);
      expect(Math.max(Math.abs(ax - bx), Math.abs(ay - by)), `${a.workId} and ${b.workId}`).toBeGreaterThanOrEqual(13);
    }));
  });

  it('draws lines only within a group, and joins each group into one constellation', () => {
    for (const [i, j] of sky.links) {
      expect(sky.stars[i].group).toBe(sky.stars[j].group);
    }
    for (const { id } of sky.groups) {
      const members = sky.stars.flatMap((star, index) => star.group === id ? [index] : []);
      const reached = new Set([members[0]]);
      for (let grew = true; grew;) {
        grew = false;
        for (const [i, j] of sky.links) {
          if (reached.has(i) !== reached.has(j)) { reached.add(i); reached.add(j); grew = true; }
        }
      }
      expect([...reached].sort(), id).toEqual([...members].sort());
    }
  });

  it('is the same sky every time, and cannot be changed', () => {
    expect(librarySky()).toBe(sky);
    expect(Object.isFrozen(sky)).toBe(true);
    expect(Object.isFrozen(sky.stars[0])).toBe(true);
    expect(Object.isFrozen(sky.links[0])).toBe(true);
    expect(Object.isFrozen(sky.groups[0])).toBe(true);
  });
});
