/**
 * The voice's trace, one console line per journal entry that concerns it, so a
 * reader with DevTools open can copy what happened when the voice and the
 * words parted: when each passage was spoken, held, released, and why the
 * clock stood down. The runtime writes the journal (runtime.js); this only
 * says which entries are the voice's and how each reads as a line.
 */

const VOICE_NOTE = /^(voice|speech)\.|^(hold|interrupt|resume)$|^run\.(failed|finished)$/u;

/** Whether a journal entry is part of the voice's trace. */
export function isVoiceNote(type) {
  return typeof type === 'string' && VOICE_NOTE.test(type);
}

/** One line: the time in seconds, the type, then each field as key=value. */
export function voiceLine(entry) {
  const { at, type, ...rest } = entry;
  const fields = Object.entries(rest)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)}`);
  return [`t=${(Number(at) / 1000).toFixed(3)}s`, type, ...fields].join(' ');
}
