import { expect, it } from 'vitest';
import { resolveJevReading } from '../app/jev-reading.js';
import { releaseArchiveTexts } from '../content/archive/index.js';
import { TODAY_WORKS, todayPoem, todayPool } from './today-poem.js';
import { todayDecision } from './today-reading.js';

it('opens the day\'s exact poem, as verse, with the day\'s visual and sound', async () => {
  for (const date of [new Date(2026, 9, 3, 12), new Date(2026, 9, 4, 12), new Date(2026, 9, 9, 12)]) {
    const pick = todayPoem(date);
    const decision = todayDecision(pick);
    const input = await resolveJevReading(decision, { entryId: pick.entryId, label: pick.label });
    const work = releaseArchiveTexts().find(item => item.id === pick.workId);
    const { entries } = await work.getDivisions();
    expect(input.text).toBe(entries[pick.entryId].content);
    expect(input.verseLines).toBe(true);
    expect(input.visualConfig.visualMode, pick.seed).not.toBe('off');
    expect(input.visualConfig.visualMode).toBe(decision.config.visualMode);
    expect(input.continuation.entryId).toBe(String(pick.entryId));
  }
});

it('refuses a division whose label is not the one the day named', async () => {
  const pick = todayPoem(new Date(2026, 9, 3, 12));
  await expect(resolveJevReading(todayDecision(pick), { entryId: pick.entryId, label: 'Someone else' }))
    .rejects.toThrow(/changed/u);
});

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
