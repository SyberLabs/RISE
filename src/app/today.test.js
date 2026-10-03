import { expect, it } from 'vitest';
import { releaseArchiveTexts } from '../content/archive/index.js';
import { jevReleasedEdition } from '../core/jev-describe.js';
import { compileSession } from '../core/session-compiler.js';
import { SEQUENCE_CAPABILITIES } from '../core/sequence-capabilities.js';
import { todayPoem } from '../core/today-poem.js';
import { todayDecision } from '../core/today-reading.js';
import { poemRecitation, todaySession } from './today.js';

const DAY = new Date(2026, 9, 3, 12);
const PACK = '/audio/recitation/el_reader/0123456789abcdef.json';
const indexFor = (pick, sourceRevision = jevReleasedEdition(pick.workId).sourceRevision) => ({
  schema: 'rise.poem-recitation.v1',
  voiceId: 'el_reader',
  poems: { [`${pick.workId}:${pick.entryId}`]: { sourceRevision, pack: PACK } }
});

it('reads the day\'s poem aloud, line by line, when this release carries its recitation', async () => {
  const pick = todayPoem(DAY);
  const session = await todaySession(DAY, indexFor(pick));
  expect(poemRecitation(pick, indexFor(pick))).toEqual({ voiceId: 'el_reader', pack: PACK });
  expect(session.capabilities).toEqual([SEQUENCE_CAPABILITIES.RECITATION_AUDIO]);
  expect(session.recitation).toEqual({ enabled: true, pack: PACK });
  expect(session.voiceId).toBe('el_reader');
  expect(session.chunkMode).toBe('phrase');
  expect(session.revealMode).toBe('progressive');
  // The day's light and sound are the same with or without the voice.
  const plain = await todaySession(DAY, { poems: {} });
  expect(session.visualConfig).toEqual(plain.visualConfig);
  expect(session.soundscape).toEqual(plain.soundscape);
  expect(session.presentation.colors).toEqual(plain.presentation.colors);
  // And the compiled reading keeps the pack.
  expect(compileSession(session).recitation).toEqual({ enabled: true, pack: PACK });
});

it('reads silently as before when the poem has no recitation, or it was made from another edition', async () => {
  const pick = todayPoem(DAY);
  const plain = await todaySession(DAY, { poems: {} });
  expect(plain.recitation).toEqual({ enabled: false });
  expect(plain.capabilities).toBeUndefined();
  expect(await todaySession(DAY, indexFor(pick, 'sha256:another-edition'))).toEqual(plain);
  expect(poemRecitation(pick, indexFor(pick, 'sha256:another-edition'))).toBeNull();
});

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
