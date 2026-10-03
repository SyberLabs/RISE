import { expect, it } from 'vitest';
import OPENINGS from '../content/archive/today-openings.json' with { type: 'json' };
import { buildTodayOpenings } from '../../scripts/build-today-openings.mjs';
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
