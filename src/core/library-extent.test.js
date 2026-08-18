import { describe, expect, it } from 'vitest';
import {
  EXTENT_MIN_WORDS,
  countWords,
  extentSourceName,
  libraryExtentId,
  parseLibraryExtent,
  sentenceAlignedPrefix
} from './library-extent.js';

const sentences = (n, wordsEach = 10) => Array.from({ length: n }, (_, i) =>
  `${['Alpha', 'Beta', 'Gamma', 'Delta'][i % 4]} ${Array.from({ length: wordsEach - 2 },
    (_, w) => `w${i}x${w}`).join(' ')} end${i}.`).join(' ');

describe('an extent rides in the source id', () => {
  it('reads a whole work, a division, and a division opening', () => {
    expect(parseLibraryExtent('montaigne-essays'))
      .toEqual({ workId: 'montaigne-essays', division: null, words: null });
    expect(parseLibraryExtent('montaigne-essays#42'))
      .toEqual({ workId: 'montaigne-essays', division: 42, words: null });
    expect(parseLibraryExtent('montaigne-essays#42:200'))
      .toEqual({ workId: 'montaigne-essays', division: 42, words: 200 });
  });

  it('round-trips', () => {
    for (const id of ['w', 'w#1', 'w#42:200']) {
      const { workId, division, words } = parseLibraryExtent(id);
      expect(libraryExtentId(workId, division, words)).toBe(id);
    }
  });

  it('treats a malformed extent as an ordinary id rather than guessing', () => {
    // A work whose own id contains a hash must still resolve as itself, and a
    // nonsense ordinal must not silently become division one.
    for (const id of ['w#0', 'w#-1', 'w#abc', `w#1:${EXTENT_MIN_WORDS - 1}`, 'w#1:0']) {
      expect(parseLibraryExtent(id).division).toBeNull();
      expect(parseLibraryExtent(id).workId).toBe(id);
    }
  });
});

describe('an opening is cut at a real boundary', () => {
  it('takes the boundary nearest the asked-for length, not the one before it', () => {
    const text = sentences(20, 10);
    const cut = sentenceAlignedPrefix(text, 96);
    // 100 words (ten sentences) is nearer to 96 than 90 is.
    expect(cut.words).toBe(100);
    expect(cut.boundary).toBe('sentence');
    expect(cut.text.endsWith('end9.')).toBe(true);
  });

  it('never cuts inside a sentence', () => {
    const text = sentences(30, 10);
    for (const target of [40, 55, 70, 130, 199]) {
      const cut = sentenceAlignedPrefix(text, target);
      expect(cut.words % 10).toBe(0);
      expect(text.startsWith(cut.text)).toBe(true);
    }
  });

  it('returns the whole thing when it already fits', () => {
    const text = sentences(3, 10);
    expect(sentenceAlignedPrefix(text, 500)).toMatchObject({ words: 30, boundary: 'whole' });
  });

  it('falls to a stanza break where verse has no full stops', () => {
    const stanza = Array.from({ length: 8 },
      (_, s) => Array.from({ length: 4 },
        (_, l) => `line ${s} ${l} word word word`).join('\n')).join('\n\n');
    const cut = sentenceAlignedPrefix(stanza, 60);
    expect(cut.boundary).toBe('paragraph');
    expect(cut.text.includes('\n\n')).toBe(true);
    // A stanza is not split down its middle.
    expect(cut.text.trimEnd().endsWith('word')).toBe(true);
  });

  it('will not return a whole division because it held no boundary', () => {
    // The cap is what stops "round to the nearest sentence" from meaning
    // "read all eleven thousand words of it".
    const unbroken = Array.from({ length: 3000 }, (_, i) => `w${i}`).join(' ');
    const cut = sentenceAlignedPrefix(unbroken, 200);
    expect(cut.words).toBeLessThanOrEqual(Math.round(200 * 1.6));
    expect(cut.words).toBeGreaterThanOrEqual(EXTENT_MIN_WORDS);
  });

  it('yields the cap to the first boundary rather than breaking a sentence', () => {
    // One enormous opening sentence: there is no honest cut before it ends,
    // so the overshoot cap gives way. Something must be returned, and a
    // half-sentence is not a candidate.
    const long = `${Array.from({ length: 400 }, (_, i) => `w${i}`).join(' ')}. Next one here.`;
    const cut = sentenceAlignedPrefix(long, 200);
    expect(cut.words).toBe(400);
    expect(cut.boundary).toBe('sentence');
    expect(long.startsWith(cut.text)).toBe(true);
  });

  it('counts words the way the library reports them', () => {
    const text = sentences(5, 10);
    expect(countWords(text)).toBe(50);
    expect(countWords('')).toBe(0);
  });
});

describe('the name says which part', () => {
  it('locates a division, titled or numbered, and marks an opening', () => {
    expect(extentSourceName({ workTitle: 'Essays' })).toBe('Essays');
    expect(extentSourceName({ workTitle: 'Essays', noun: 'Essay', ordinal: 42 }))
      .toBe('Essays · Essay 42');
    expect(extentSourceName({ workTitle: 'Essays', noun: 'Essay', ordinal: 42, opening: true }))
      .toBe('Essays · Essay 42, opening');
    expect(extentSourceName({
      workTitle: 'The Book of Tea', ordinal: 1, divisionTitle: 'The Cup of Humanity'
    })).toBe('The Book of Tea · The Cup of Humanity');
  });
});
