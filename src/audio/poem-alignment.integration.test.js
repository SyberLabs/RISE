import { expect, it } from 'vitest';
import { resolveJevReading } from '../app/jev-reading.js';
import { releaseArchiveTexts } from '../content/archive/index.js';
import { splitWords } from '../core/recitation.js';
import { compileSession } from '../core/session-compiler.js';
import { todayPool } from '../core/today-poem.js';
import { todayDecision } from '../core/today-reading.js';
import { mapAlignment, spokenText } from './poem-alignment.js';
import { normalizeVoiceText } from './voice-pack-key.js';

/** What a vendor that read the text faithfully would return: a time for every character sent. */
const faithful = text => ({
  characters: [...text],
  character_start_times_seconds: [...text].map((_, i) => i * 0.05),
  character_end_times_seconds: [...text].map((_, i) => i * 0.05 + 0.05)
});

it('maps a faithful reading of every poem in the pool onto the atoms a recited day reads', async () => {
  const failures = [];
  for (const item of todayPool()) {
    const work = releaseArchiveTexts().find(record => record.id === item.workId);
    const { entries } = await work.getDivisions();
    const input = await resolveJevReading(todayDecision({ ...item, seed: 'recitation' }),
      { entryId: item.entryId, label: item.label });
    const atoms = compileSession(input).atoms.map(atom => normalizeVoiceText(atom)).filter(Boolean);
    const result = mapAlignment({ atoms, alignment: faithful(spokenText(entries[item.entryId].content)) });
    if (!result.ok) failures.push(`${item.workId}:${item.entryId} ${item.label}: ${result.reason}`);
    else {
      for (const atom of result.atoms) expect(atom.onsetsMs).toHaveLength(splitWords(atom.text).length);
    }
  }
  expect(failures).toEqual([]);
}, 120_000);

it('cuts every look\'s recited reading into the same atoms', async () => {
  const [item] = todayPool();
  const atomsFor = async seed => {
    const input = await resolveJevReading(todayDecision({ ...item, seed }), { entryId: item.entryId, label: item.label });
    return compileSession(input).atoms.map(atom => normalizeVoiceText(atom)).filter(Boolean);
  };
  const looks = new Map();
  for (let day = 1; day < 40 && looks.size < 3; day++) {
    const seed = `2026-10-${String(day).padStart(2, '0')}`;
    looks.set(todayDecision({ ...item, seed }).look, await atomsFor(seed));
  }
  expect(looks.size).toBe(3);
  const [first, ...rest] = [...looks.values()];
  for (const atoms of rest) expect(atoms).toEqual(first);
});
