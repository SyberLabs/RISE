import { describe, expect, it } from 'vitest';
import { splitWords } from '../core/recitation.js';
import { checkClip, cutPoints, mapAlignment, sliceClips, spokenText } from './poem-alignment.js';

// Lines from Spoon River (Lyman King, Sam Hookey), with the edition's word
// joiner before an em-dash, a lone dash token, curly quotes and a stanza break.
const CONTENT = [
  'You may think, passer-by, that Fate',
  'Is a pit-fall outside of yourself,',
  'And wisdom.',
  'Thus you believe, viewing the lives of other men,',
  '',
  'And the floral tributes were many⁠—',
  'It was “Robespierre” — after all!'
].join('\n');

// What the chunker gives in phrase mode with verse lines: one atom per line,
// a line under three words joined to the next.
const ATOMS = [
  'You may think, passer-by, that Fate',
  'Is a pit-fall outside of yourself,',
  'And wisdom. Thus you believe, viewing the lives of other men,',
  'And the floral tributes were many⁠—',
  'It was “Robespierre” — after all!'
];

/** A vendor-shaped alignment: 60 ms a character, a pause at each line end, a longer one between stanzas. */
function alignmentFor(text, { dropFrom = null } = {}) {
  const characters = [];
  const starts = [];
  const ends = [];
  let t = 0.2;
  for (let i = 0; i < text.length; i++) {
    if (dropFrom !== null && text.startsWith(dropFrom, i)) {
      i += dropFrom.length - 1;
      continue;
    }
    const ch = text[i];
    characters.push(ch);
    starts.push(t);
    t += 0.06;
    ends.push(t);
    if (ch === '\n') t += text[i + 1] === '\n' ? 0.9 : 0.3;
  }
  return { characters, character_start_times_seconds: starts, character_end_times_seconds: ends };
}

/** Synthetic PCM: tone wherever a letter is spoken, near-silence elsewhere. */
function pcmFor(alignment, sampleRate = 8000) {
  const total = alignment.character_end_times_seconds.at(-1) + 1;
  const pcm = new Float32Array(Math.ceil(total * sampleRate)).fill(0.001);
  alignment.characters.forEach((ch, i) => {
    if (!/\p{L}/u.test(ch)) return;
    const a = Math.floor(alignment.character_start_times_seconds[i] * sampleRate);
    const b = Math.floor(alignment.character_end_times_seconds[i] * sampleRate);
    for (let s = a; s < b; s++) pcm[s] = 0.5 * Math.sin(s / 3);
  });
  return pcm;
}

describe('spokenText', () => {
  it('drops format characters and runs of spaces, and keeps the line and stanza breaks', () => {
    const spoken = spokenText(CONTENT);
    expect(spoken).not.toMatch(/⁠/u);
    expect(spoken).toContain('many—\nIt was');
    expect(spoken).toContain('other men,\n\nAnd the floral');
    expect(spokenText('  a  b \n c  ')).toBe('a b\nc');
  });
});

describe('mapAlignment', () => {
  const alignment = alignmentFor(spokenText(CONTENT));

  it('gives every atom its span and one onset per word the Chamber reveals', () => {
    const result = mapAlignment({ atoms: ATOMS, alignment });
    expect(result.ok).toBe(true);
    result.atoms.forEach((atom, a) => {
      expect(atom.text).toBe(ATOMS[a]);
      expect(atom.onsetsMs).toHaveLength(splitWords(ATOMS[a]).length);
      expect(atom.startMs).toBe(atom.onsetsMs[0]);
      expect(atom.endMs).toBeGreaterThan(atom.startMs);
      for (let i = 1; i < atom.onsetsMs.length; i++) expect(atom.onsetsMs[i]).toBeGreaterThanOrEqual(atom.onsetsMs[i - 1]);
      if (a > 0) expect(atom.startMs).toBeGreaterThan(result.atoms[a - 1].endMs);
    });
    // A lone dash has no letters; it takes the next word's onset.
    const last = result.atoms.at(-1);
    const dash = splitWords(ATOMS.at(-1)).findIndex(w => w.text === '—');
    expect(last.onsetsMs[dash]).toBe(last.onsetsMs[dash + 1]);
  });

  it('refuses a performance that skipped a word, and names where', () => {
    const result = mapAlignment({ atoms: ATOMS, alignment: alignmentFor(spokenText(CONTENT), { dropFrom: 'floral ' }) });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/atom 4/u);
    expect(result.reason).toMatch(/floral/u);
  });

  it('refuses times that run backwards', () => {
    const bad = alignmentFor(spokenText(CONTENT));
    const i = bad.characters.indexOf('I', 40);
    bad.character_start_times_seconds[i] = 0;
    expect(mapAlignment({ atoms: ATOMS, alignment: bad }).ok).toBe(false);
  });
});

describe('cutting the performance into line clips', () => {
  const sampleRate = 8000;
  const alignment = alignmentFor(spokenText(CONTENT));
  const pcm = pcmFor(alignment, sampleRate);
  const { atoms } = mapAlignment({ atoms: ATOMS, alignment });

  it('cuts in the quiet between lines, never through a word', () => {
    const cuts = cutPoints(atoms, pcm, sampleRate);
    expect(cuts).toHaveLength(atoms.length + 1);
    for (let a = 0; a < atoms.length - 1; a++) {
      expect(cuts[a + 1]).toBeGreaterThan(atoms[a].endMs);
      expect(cuts[a + 1]).toBeLessThan(atoms[a + 1].startMs);
    }
    expect(cuts[0]).toBeLessThanOrEqual(atoms[0].startMs);
    expect(cuts.at(-1)).toBeGreaterThanOrEqual(atoms.at(-1).endMs);
  });

  it('gives each clip its own audio, duration, onsets from its start, and peak', () => {
    const cuts = cutPoints(atoms, pcm, sampleRate);
    const clips = sliceClips(atoms, cuts, pcm, sampleRate);
    const total = clips.reduce((sum, clip) => sum + clip.durationMs, 0);
    expect(Math.abs(total - (cuts.at(-1) - cuts[0]))).toBeLessThan(clips.length + 1);
    clips.forEach((clip, a) => {
      expect(clip.text).toBe(ATOMS[a]);
      expect(clip.samples.length).toBe(Math.round(clip.durationMs * sampleRate / 1000));
      expect(clip.onsetsMs[0]).toBeGreaterThanOrEqual(0);
      expect(clip.onsetsMs.at(-1)).toBeLessThan(clip.durationMs);
      expect(clip.peak).toBeGreaterThan(0.4);
      // Faded in and out, so a cut never clicks.
      expect(Math.abs(clip.samples[0])).toBeLessThan(0.01);
      expect(Math.abs(clip.samples.at(-1))).toBeLessThan(0.01);
      expect(checkClip(clip).error).toBeUndefined();
    });
  });

  it('fails a clip that is too short, clipped or silent, and flags one read too fast', () => {
    const ok = { text: 'And the floral tributes', durationMs: 1800, onsetsMs: [0, 300, 700, 1200], peak: 0.7 };
    expect(checkClip(ok)).toEqual({});
    expect(checkClip({ ...ok, durationMs: 150 }).error).toMatch(/short/u);
    expect(checkClip({ ...ok, peak: 1 }).error).toMatch(/clips/u);
    expect(checkClip({ ...ok, peak: 0.005 }).error).toMatch(/silent/u);
    expect(checkClip({ ...ok, onsetsMs: [0, 300] }).error).toMatch(/onsets/u);
    expect(checkClip({ ...ok, durationMs: 600 }).suspect).toMatch(/fast/u);
  });
});
