import { expect, it } from 'vitest';
import { releaseArchiveTexts } from '../content/archive/index.js';
import { TODAY_WORKS, todayPool } from './today-poem.js';

it('names, for every poem in the pool, a released verse division with that id and label', async () => {
  const pool = todayPool();
  for (const workId of TODAY_WORKS) {
    const work = releaseArchiveTexts().find(item => item.id === workId);
    expect(work, workId).toBeTruthy();
    const { entries } = await work.getDivisions();
    for (const pick of pool.filter(item => item.workId === workId)) {
      const entry = entries.find(candidate => String(candidate.id) === String(pick.entryId));
      expect(entry?.label, `${workId} ${pick.entryId}`).toBe(pick.label);
      expect(entry.verse, pick.label).toBe(true);
      expect(entry.content.trim().length, pick.label).toBeGreaterThan(0);
    }
  }
});
