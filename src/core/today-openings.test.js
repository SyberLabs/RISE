import { expect, it } from 'vitest';
import OPENINGS from '../content/archive/today-openings.json' with { type: 'json' };
import { buildTodayOpenings } from '../../scripts/build-today-openings.mjs';
import { openingOf } from '../app/jev-reading.js';
import { divideSections } from '../content/archive/divisions.js';
import { TODAY_WORKS, todayPool } from './today-poem.js';

it('agrees with the works it was built from (re-run scripts/build-today-openings.mjs after an ingest)', async () => {
  expect(OPENINGS).toEqual(await buildTodayOpenings());
});

it('gives every poem in the pool its title, poet and opening passage', () => {
  for (const workId of TODAY_WORKS) {
    expect(OPENINGS.works[workId].title, workId).toBeTruthy();
    expect(OPENINGS.works[workId].author, workId).toBeTruthy();
  }
  for (const { workId, entryId } of todayPool()) {
    expect(OPENINGS.openings[workId][entryId]?.trim(), `${workId} ${entryId}`).toBeTruthy();
  }
  expect(OPENINGS.openings['spoon-river-anthology'][1].split('\n')[0]).toBe('Here I lie close to the grave');
  expect(OPENINGS.openings['spoon-river-anthology'][1].split('\n').length).toBeGreaterThan(1);
});

it('holds each opening to the preview a reader sees: the division opened, cut at 240 characters', async () => {
  for (const workId of TODAY_WORKS) {
    const module = await import(`../content/archive/works/${workId}.js`);
    const entries = divideSections(Object.values(module).find(Array.isArray), { declared: true }).entries;
    expect(OPENINGS.openings[workId]).toHaveLength(entries.length);
    entries.forEach((entry, index) => {
      const opening = OPENINGS.openings[workId][index];
      const firstLine = entry.content.split('\n').find(line => line.trim())?.trim() ?? '';
      expect(opening, `${workId} ${index}`).toBe(openingOf(entry.content, 240));
      expect(opening.length, `${workId} ${index}`).toBeLessThanOrEqual(240);
      // Starts with the division's first line, or is that line cut short.
      expect(opening.trim().startsWith(firstLine) || firstLine.startsWith(opening.replace(/…$/u, '').trim()),
        `${workId} ${index}`).toBe(true);
    });
  }
});
