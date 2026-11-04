import { describe, expect, it } from 'vitest';
import { splitWords } from '../core/recitation.js';
import { mapAlignment } from './poem-alignment.js';

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

describe('mapAlignment', () => {
  const alignment = alignmentFor(CONTENT);

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
    const result = mapAlignment({ atoms: ATOMS, alignment: alignmentFor(CONTENT, { dropFrom: 'floral ' }) });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/atom 4/u);
    expect(result.reason).toMatch(/floral/u);
  });

  it('refuses times that run backwards', () => {
    const bad = alignmentFor(CONTENT);
    const i = bad.characters.indexOf('I', 40);
    bad.character_start_times_seconds[i] = 0;
    expect(mapAlignment({ atoms: ATOMS, alignment: bad }).ok).toBe(false);
  });
});
