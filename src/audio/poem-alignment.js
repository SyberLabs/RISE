/**
 * Maps a voice vendor's character timing onto the reader's own atoms, for the
 * Plus voice (worker/plus.mjs). Pure.
 *
 * The match is checked letter by letter: the letters and digits the vendor
 * says it spoke must equal the atoms' exactly, or the poem is refused rather
 * than read out of step.
 */
import { splitWords } from '../core/recitation.js';

const skeleton = text => String(text).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * @param {{ atoms: string[], alignment: { characters: string[], character_start_times_seconds: number[], character_end_times_seconds: number[] } }} input
 * @returns {{ ok: true, atoms: { text: string, startMs: number, endMs: number, onsetsMs: number[] }[] } | { ok: false, reason: string }}
 */
export function mapAlignment({ atoms, alignment }) {
  const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } = alignment;
  const timeline = [];
  characters.forEach((character, i) => {
    for (const ch of skeleton(character)) timeline.push({ ch, t0: starts[i] * 1000, t1: ends[i] * 1000 });
  });
  const words = atoms.map(text => splitWords(text).map(word => word.text));

  // Letter by letter: name the first word the performance does not match.
  let k = 0;
  for (let a = 0; a < atoms.length; a++) {
    for (const word of words[a]) {
      const letters = skeleton(word);
      for (let j = 0; j < letters.length; j++) {
        if (timeline[k + j]?.ch !== letters[j]) {
          return { ok: false, reason: `the performance differs at atom ${a + 1}, word “${word}”` };
        }
      }
      k += letters.length;
    }
  }
  if (k !== timeline.length) return { ok: false, reason: 'the performance has letters after the last atom' };

  k = 0;
  const mapped = [];
  for (let a = 0; a < atoms.length; a++) {
    const onsets = [];
    const wordEnds = [];
    for (const word of words[a]) {
      const n = skeleton(word).length;
      if (!n) {
        onsets.push(null);
        wordEnds.push(null);
        continue;
      }
      onsets.push(timeline[k].t0);
      wordEnds.push(timeline[k + n - 1].t1);
      k += n;
    }
    if (!onsets.some(onset => onset !== null)) return { ok: false, reason: `atom ${a + 1} has no letters` };
    // A word with no letters (a lone "—") starts with the next word, else ends with the last.
    for (let i = 0; i < onsets.length; i++) {
      if (onsets[i] !== null) continue;
      const next = onsets.slice(i + 1).find(onset => onset !== null);
      const previous = wordEnds.slice(0, i).reverse().find(end => end !== null);
      onsets[i] = next ?? previous;
    }
    const endMs = wordEnds.filter(end => end !== null).at(-1);
    for (let i = 1; i < onsets.length; i++) {
      if (onsets[i] < onsets[i - 1]) return { ok: false, reason: `times run backwards in atom ${a + 1}` };
    }
    if (endMs <= onsets[0]) return { ok: false, reason: `atom ${a + 1} ends before it starts` };
    if (a > 0 && onsets[0] < mapped[a - 1].startMs) return { ok: false, reason: `atom ${a + 1} starts before atom ${a}` };
    mapped.push({ text: atoms[a], startMs: onsets[0], endMs, onsetsMs: onsets });
  }
  return { ok: true, atoms: mapped };
}
