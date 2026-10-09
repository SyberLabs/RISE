/**
 * Build-time only (scripts/build-poem-recitation.mjs): one poem is rendered as
 * ONE performance, so its prosody runs across the lines; this maps the
 * vendor's character timing onto the reader's own atoms (one per verse line)
 * and cuts the performance into one clip per atom in the quiet between lines.
 * Pure, and never shipped to readers.
 *
 * The match is checked letter by letter: the letters and digits the vendor
 * says it spoke must equal the atoms' exactly, or the poem is refused rather
 * than read out of step.
 */
import { splitWords } from '../core/recitation.js';

const skeleton = text => String(text).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** The text sent to the voice: format characters (U+2060 and the like) out, line and stanza breaks kept. */
export function spokenText(content) {
  return String(content).normalize('NFKC').replace(/\p{Cf}/gu, '')
    .split('\n').map(line => line.replace(/[^\S\n]+/gu, ' ').trim()).join('\n').trim();
}

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

/**
 * Consecutive atoms grouped so each group's spoken text (atoms joined by one
 * space) fits the vendor's per-request cap. A whole division is rarely one
 * request; a poem always is. An atom longer than the cap stands alone and is
 * refused by the vendor, never split, so the letter check still holds.
 * @param {string[]} atoms
 * @param {number} maxChars
 * @returns {{ from: number, to: number, text: string }[]} half-open atom ranges
 */
export function groupAtoms(atoms, maxChars) {
  const groups = [];
  let from = 0;
  let length = 0;
  for (let a = 0; a < atoms.length; a++) {
    const next = length ? length + 1 + atoms[a].length : atoms[a].length;
    if (a > from && next > maxChars) {
      groups.push({ from, to: a, text: atoms.slice(from, a).join(' ') });
      from = a;
      length = atoms[a].length;
    } else {
      length = next;
    }
  }
  if (from < atoms.length) groups.push({ from, to: atoms.length, text: atoms.slice(from).join(' ') });
  return groups;
}

const LEAD_MS = 120;
const TAIL_MS = 400;
const GUARD_MS = 30;
const WINDOW_MS = 10;
const STEP_MS = 2;

/** The quietest WINDOW_MS of pcm between lo and hi (ms), as its centre. */
function quietest(pcm, sampleRate, lo, hi) {
  const span = Math.max(1, Math.round(WINDOW_MS * sampleRate / 1000));
  let best = (lo + hi) / 2;
  let bestEnergy = Infinity;
  for (let t = lo; t + WINDOW_MS <= hi; t += STEP_MS) {
    const from = Math.round(t * sampleRate / 1000);
    let energy = 0;
    for (let s = from; s < from + span && s < pcm.length; s++) energy += pcm[s] * pcm[s];
    if (energy < bestEnergy) {
      bestEnergy = energy;
      best = t + WINDOW_MS / 2;
    }
  }
  return best;
}

/** Where to cut, in ms: before the first atom, in the quiet between each pair, after the last. */
export function cutPoints(atoms, pcm, sampleRate) {
  const totalMs = pcm.length / sampleRate * 1000;
  const cuts = [Math.max(0, atoms[0].startMs - LEAD_MS)];
  for (let a = 0; a < atoms.length - 1; a++) {
    const lo = atoms[a].endMs + GUARD_MS;
    const hi = atoms[a + 1].startMs - GUARD_MS;
    cuts.push(hi - lo >= WINDOW_MS ? quietest(pcm, sampleRate, lo, hi) : (atoms[a].endMs + atoms[a + 1].startMs) / 2);
  }
  cuts.push(Math.min(totalMs, atoms.at(-1).endMs + TAIL_MS));
  return cuts;
}

const FADE_MS = 4;

/** One clip per atom: its samples (faded at both ends), duration, onsets from its own start, and peak. */
export function sliceClips(atoms, cuts, pcm, sampleRate) {
  return atoms.map((atom, a) => {
    const from = Math.round(cuts[a] * sampleRate / 1000);
    const to = Math.round(cuts[a + 1] * sampleRate / 1000);
    const samples = pcm.slice(from, to);
    const fade = Math.min(Math.round(FADE_MS * sampleRate / 1000), Math.floor(samples.length / 2));
    for (let i = 0; i < fade; i++) {
      const gain = 0.5 - 0.5 * Math.cos(Math.PI * i / fade);
      samples[i] *= gain;
      samples[samples.length - 1 - i] *= gain;
    }
    const durationMs = samples.length * 1000 / sampleRate;
    const onsetsMs = [];
    for (const onset of atom.onsetsMs) {
      const relative = Math.min(Math.max(0, Math.round(onset - cuts[a])), Math.floor(durationMs) - 1);
      onsetsMs.push(Math.max(relative, onsetsMs.at(-1) ?? 0));
    }
    let peak = 0;
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
    return { text: atom.text, samples, durationMs: Math.round(durationMs), onsetsMs, peak: Math.round(peak * 1000) / 1000 };
  });
}

/** A clip that must not ship gets an error; one a person should hear first gets a suspect note. */
export function checkClip(clip) {
  const words = splitWords(clip.text).length;
  if (clip.onsetsMs.length !== words) return { error: `${clip.onsetsMs.length} onsets for ${words} words` };
  if (clip.durationMs < 200) return { error: 'too short' };
  if (clip.durationMs > 30_000) return { error: 'too long' };
  if (clip.peak >= 0.999) return { error: 'clips' };
  if (clip.peak < 0.02) return { error: 'nearly silent' };
  const letters = skeleton(clip.text).length;
  const perSecond = letters / (clip.durationMs / 1000);
  if (perSecond > 25) return { suspect: `read too fast (${perSecond.toFixed(1)} letters/s)` };
  if (perSecond < 4) return { suspect: `read slowly (${perSecond.toFixed(1)} letters/s)` };
  return {};
}
