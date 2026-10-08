import { describe, expect, it } from 'vitest';
import { SOUND_GROUPS } from './sound-list.js';
import { SOUND_IDS, soundKind } from './sound-ids.js';

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
