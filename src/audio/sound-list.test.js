/**
 * The one sound list (RDR-024): every soundscape and every reader-facing tone,
 * each exactly once, in five groups, and every look's sound among them.
 */
import { describe, expect, it } from 'vitest';
import { SOUND_GROUPS, soundOf } from './sound-list.js';
import { SOUNDSCAPES } from './soundscapes.js';
import { LAYER_PRESETS } from './engine.js';
import { WORKSHOP_AUDIO_ASSETS } from '../core/workshop-audio.js';
import { LOOKS } from '../core/looks.js';

const entries = SOUND_GROUPS.flatMap(group => group.entries);
const idsOf = kind => entries.filter(entry => entry.kind === kind).map(entry => entry.id);
const TONE_IDS = WORKSHOP_AUDIO_ASSETS
  .filter(asset => asset.kind === 'tone' && asset.value !== 'silent')
  .map(asset => asset.value);

describe('the one sound list', () => {
  it('groups Silence, Atmospheres, Music, Feelings and Tones, in that order', () => {
    expect(SOUND_GROUPS.map(group => group.label))
      .toEqual(['Silence', 'Atmospheres', 'Music', 'Feelings', 'Tones']);
    expect(SOUND_GROUPS[0].entries).toEqual([{ id: 'none', kind: 'silence', name: 'Silence' }]);
    expect(SOUND_GROUPS[1].entries.map(entry => entry.id))
      .toEqual(['aurora', 'faded-signal', 'soft-rain', 'starlight', 'night-drive']);
    expect(SOUND_GROUPS[2].entries.map(entry => entry.id))
      .toEqual(['piano', 'jazz', 'lullaby', 'nocturne', 'waltz', 'blues', 'bossa', 'ragtime']);
    expect(SOUND_GROUPS[3].entries.map(entry => entry.id).slice(0, 5))
      .toEqual(['wonder', 'mystery', 'triumph', 'chase', 'haunted']);
    expect(SOUND_GROUPS[4].entries.map(entry => entry.id)).toEqual(['focus', 'deep', 'gateway']);
  });

  it('holds every soundscape exactly once, and names none that does not exist', () => {
    const soundscapes = idsOf('soundscape');
    expect(soundscapes).toHaveLength(24);
    expect(new Set(soundscapes).size).toBe(soundscapes.length);
    expect(new Set(soundscapes)).toEqual(new Set(Object.keys(SOUNDSCAPES)));
  });

  it('holds the three tones exactly once, each one the engine can play', () => {
    const tones = idsOf('tone');
    expect(tones).toEqual(TONE_IDS);
    expect(tones).toHaveLength(3);
    tones.forEach(id => expect(LAYER_PRESETS).toHaveProperty(id));
  });

  it('never offers one id twice, and names every entry from its definition', () => {
    const ids = entries.map(entry => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    entries.filter(entry => entry.kind === 'soundscape')
      .forEach(entry => expect(entry.name).toBe(SOUNDSCAPES[entry.id].name));
    entries.filter(entry => entry.kind === 'tone')
      .forEach(entry => expect(entry.name).toBe(LAYER_PRESETS[entry.id].name));
  });

  it('holds the sound of every look', () => {
    for (const look of LOOKS) {
      const { soundscape = 'none', audioPreset = 'silent' } = look.config;
      const id = soundscape !== 'none' ? soundscape : audioPreset !== 'silent' ? audioPreset : 'none';
      expect(soundOf(id), look.id).not.toBeNull();
    }
  });

  it('finds an entry by id, and nothing for an id it does not offer', () => {
    expect(soundOf('deep')).toEqual({ id: 'deep', kind: 'tone', name: 'Deep' });
    expect(soundOf('drift')).toBeNull();
    expect(soundOf('chant-gregorian')).toBeNull();
  });
});
