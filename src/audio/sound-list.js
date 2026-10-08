/**
 * The one list a reader chooses sound from (RDR-024): Silence, the
 * soundscapes in three groups, and the tones. Names come from the
 * definitions; sound-list.test.js holds the groups to SOUNDSCAPES and the
 * tone definitions, each id exactly once.
 */
import { SOUNDSCAPES } from './soundscapes.js';
import { WORKSHOP_AUDIO_ASSETS } from '../core/workshop-audio.js';

const TONES = WORKSHOP_AUDIO_ASSETS.filter(asset => asset.kind === 'tone');

const entry = (id, kind, name) => Object.freeze({ id, kind, name });
const soundscapes = ids => ids.map(id => entry(id, 'soundscape', SOUNDSCAPES[id]?.name));
const group = (id, label, entries) => Object.freeze({ id, label, entries: Object.freeze(entries) });

/** @type {readonly {id: string, label: string, entries: readonly {id: string, kind: 'silence'|'soundscape'|'tone', name: string}[]}[]} */
export const SOUND_GROUPS = Object.freeze([
  group('silence', 'Silence', [entry('none', 'silence', TONES.find(tone => tone.value === 'silent').name)]),
  group('atmospheres', 'Atmospheres', soundscapes(['aurora', 'faded-signal', 'soft-rain', 'starlight', 'night-drive'])),
  group('music', 'Music', soundscapes(['piano', 'jazz', 'lullaby', 'nocturne', 'waltz', 'blues', 'bossa', 'ragtime'])),
  group('feelings', 'Feelings', soundscapes(['wonder', 'mystery', 'triumph', 'chase', 'haunted',
    'sad', 'angry', 'happy', 'excited', 'thrilling', 'scary'])),
  group('tones', 'Tones', TONES.filter(tone => tone.value !== 'silent')
    .map(tone => entry(tone.value, 'tone', tone.name)))
]);

const BY_ID = new Map(SOUND_GROUPS.flatMap(({ entries }) => entries).map(sound => [sound.id, sound]));

/** The list's entry for an id, or null when the list does not offer it. */
export const soundOf = id => BY_ID.get(id) || null;
