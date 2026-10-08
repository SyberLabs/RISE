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
    'piano', 'jazz', 'lullaby', 'nocturne', 'waltz', 'blues', 'bossa', 'ragtime',
    'wonder', 'mystery', 'triumph', 'chase', 'haunted', 'sad', 'angry', 'happy', 'excited', 'thrilling', 'scary'
  ]),
  tone: Object.freeze(['focus', 'deep', 'gateway'])
});

/** The kind of a sound id, or null when RISE offers no such sound. */
export function soundKind(id) {
  for (const [kind, ids] of Object.entries(SOUND_IDS)) if (ids.includes(id)) return kind;
  return null;
}
