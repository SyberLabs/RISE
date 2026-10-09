import { describe, expect, it } from 'vitest';
import { SOUND_GROUPS } from './sound-list.js';
import { PARKED_SOUNDS, SOUND_IDS, soundKind, standInSound } from './sound-ids.js';

describe('the sound ids a composition may name', () => {
  it('are exactly the sounds the reader’s list offers, kind for kind', () => {
    const listed = SOUND_GROUPS.flatMap(group => group.entries).map(entry => [entry.id, entry.kind]);
    const ids = Object.entries(SOUND_IDS).flatMap(([kind, list]) => list.map(id => [id, kind]));
    expect(ids.sort()).toEqual(listed.sort());
  });

  it('say their kind, and nothing for a sound RISE does not have', () => {
    expect(soundKind('starlight')).toBe('soundscape');
    expect(soundKind('focus')).toBe('tone');
    expect(soundKind('none')).toBe('silence');
    expect(soundKind('airhorn')).toBeNull();
  });
});

describe('the parked Feelings sounds', () => {
  const FEELINGS = ['wonder', 'mystery', 'triumph', 'chase', 'haunted',
    'sad', 'angry', 'happy', 'excited', 'thrilling', 'scary'];

  it('are no sound a composition may name', () => {
    for (const id of FEELINGS) expect(soundKind(id), id).toBeNull();
    expect(Object.keys(PARKED_SOUNDS).sort()).toEqual([...FEELINGS].sort());
  });

  it('each stand in as an offered soundscape, so a saved one still sounds', () => {
    for (const id of FEELINGS) expect(soundKind(standInSound(id)), id).toBe('soundscape');
    expect(standInSound('chase')).toBe('night-drive');
    expect(standInSound('aurora')).toBe('aurora');
    expect(standInSound('none')).toBe('none');
    expect(standInSound('constructor')).toBe('constructor');
  });
});
