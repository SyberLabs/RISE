import { expect, it } from 'vitest';
import { releaseArchiveTexts } from '../content/archive/index.js';
import { todayPoem } from '../core/today-poem.js';
import { todayDecision } from '../core/today-reading.js';
import { todaySession } from './today.js';

it('opens the day\'s exact poem as verse, in the day\'s look, returning Home', async () => {
  for (const date of [new Date(2026, 9, 3, 12), new Date(2026, 9, 4, 12)]) {
    const pick = todayPoem(date);
    const session = await todaySession(date);
    const work = releaseArchiveTexts().find(item => item.id === pick.workId);
    const { entries } = await work.getDivisions();
    expect(session.text).toBe(entries[pick.entryId].content);
    expect(session.verseLines).toBe(true);
    expect(session.visualConfig.visualMode).toBe(todayDecision(pick).config.visualMode);
    expect(session.visualConfig.visualMode).not.toBe('off');
    expect(session.origin).toEqual({ view: 'portal', icon: '✧', name: 'Home', experience: 'today' });
    expect(session.continuation).toMatchObject({ kind: 'library-division', entryId: String(pick.entryId), noun: 'poem' });
  }
});
