/**
 * The ids of every sound RISE offers, by kind, with nothing else: what a
 * composition may name (beats.js) and what the Worker admits, without the
 * sound library itself behind it. sound-list.js is the list the reader sees;
 * sound-ids.test.js holds the two to the same ids.
 */
export const SOUND_IDS = Object.freeze({
  silence: Object.freeze(['none']),
  soundscape: Object.freeze([
    'aurora', 'faded-signal', 'soft-rain', 'starlight', 'night-drive',
    'piano', 'jazz', 'lullaby', 'nocturne', 'waltz', 'blues', 'bossa', 'ragtime'
  ]),
  tone: Object.freeze(['focus', 'deep', 'gateway'])
});

/**
 * The Feelings soundscapes, parked until a quality rework and an owner
 * listening pass bring them back (docs/product/discussions/
 * 2026-10-09-feelings-sounds-parked.md). Nothing may offer or name one; each
 * maps to the offered soundscape a saved reading that named it now plays.
 */
export const PARKED_SOUNDS = Object.freeze({
  wonder: 'aurora', mystery: 'faded-signal', triumph: 'starlight', chase: 'night-drive',
  haunted: 'faded-signal', sad: 'faded-signal', angry: 'night-drive', happy: 'starlight',
  excited: 'night-drive', thrilling: 'night-drive', scary: 'aurora'
});

/** The kind of a sound id, or null when RISE offers no such sound. */
export function soundKind(id) {
  for (const [kind, ids] of Object.entries(SOUND_IDS)) if (ids.includes(id)) return kind;
  return null;
}

/** A saved sound id as RISE plays it now: a parked one is its stand-in. */
export const standInSound = id => Object.hasOwn(PARKED_SOUNDS, id) ? PARKED_SOUNDS[id] : id;
