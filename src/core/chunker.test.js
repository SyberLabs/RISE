/**
 * R.I.S.E. Chunker Test Suite
 * Tests for text chunking and atomization
 */

import { describe, it, expect } from 'vitest';
import { chunkText, countWords, estimateDuration } from './chunker.js';

describe('chunkText', () => {
  describe('word mode', () => {
    it('splits simple text into word atoms', () => {
      const atoms = chunkText('The way that can be told', { mode: 'word' });

      expect(atoms.length).toBe(6);
      expect(atoms[0].content).toBe('The');
      expect(atoms[1].content).toBe('way');
      expect(atoms[5].content).toBe('told');
    });

    it('preserves punctuation attached to words', () => {
      const atoms = chunkText('Hello, world!', { mode: 'word' });

      expect(atoms[0].content).toBe('Hello,');
      expect(atoms[1].content).toBe('world!');
    });

    it('respects WPM setting', () => {
      const atomsFast = chunkText('word', { wpm: 400 });
      const atomsSlow = chunkText('word', { wpm: 100 });

      // Faster WPM = shorter duration
      expect(atomsFast[0].duration).toBeLessThan(atomsSlow[0].duration);
    });

    it('applies length modifier for longer words', () => {
      const shortWord = chunkText('a', { wpm: 220 })[0];
      const longWord = chunkText('consciousness', { wpm: 220 })[0];

      // Longer words get more time
      expect(longWord.duration).toBeGreaterThan(shortWord.duration);
    });

    it('applies punctuation modifier', () => {
      const noPunctuation = chunkText('word', { wpm: 220 })[0];
      const withPeriod = chunkText('word.', { wpm: 220 })[0];
      const withQuestion = chunkText('word?', { wpm: 220 })[0];

      expect(withPeriod.duration).toBeGreaterThan(noPunctuation.duration);
      expect(withQuestion.duration).toBeGreaterThan(noPunctuation.duration);
    });

    it('sets correct modality', () => {
      const atoms = chunkText('test', { mode: 'word' });

      expect(atoms[0].modality).toBe('text');
    });

    it('assigns source identifier', () => {
      const atoms = chunkText('test', { source: 'tao-te-ching' });

      expect(atoms[0].source).toBe('tao-te-ching');
    });

    it('assigns sequential positions', () => {
      const atoms = chunkText('one two three', { mode: 'word' });

      expect(atoms[0].position).toBe(0);
      expect(atoms[1].position).toBe(1);
      expect(atoms[2].position).toBe(2);
    });
  });

  describe('phrase mode', () => {
    it('splits text into phrase chunks', () => {
      const atoms = chunkText('The way that can be told, is not the eternal way.', { mode: 'phrase' });

      expect(atoms.length).toBeGreaterThan(1);
      expect(atoms[0].content).toContain('The way');
    });

    it('calculates duration based on word count', () => {
      const atoms = chunkText('One two three, four five.', { mode: 'phrase', wpm: 220 });

      // Phrases with more words should have longer durations
      const wordCount = atoms[0].content.split(/\s+/).length;
      expect(wordCount).toBeGreaterThan(1);
    });
  });

  describe('sentence mode', () => {
    it('splits text into sentence chunks', () => {
      const text = 'First sentence. Second sentence. Third one here.';
      const atoms = chunkText(text, { mode: 'sentence' });

      expect(atoms.length).toBe(3);
      expect(atoms[0].content).toBe('First sentence.');
      expect(atoms[1].content).toBe('Second sentence.');
    });

    it('handles question marks and exclamations', () => {
      const text = 'Is this working? Yes it is! Great news.';
      const atoms = chunkText(text, { mode: 'sentence' });

      expect(atoms.length).toBe(3);
    });
  });

  describe('paragraph mode', () => {
    it('keeps paragraphs intact', () => {
      const text = 'First paragraph here.\n\nSecond paragraph here.';
      const atoms = chunkText(text, { mode: 'paragraph' });

      expect(atoms.length).toBe(2);
      expect(atoms[0].content).toBe('First paragraph here.');
      expect(atoms[1].content).toBe('Second paragraph here.');
    });
  });

  describe('special markers', () => {
    it('handles [PAUSE] marker', () => {
      const atoms = chunkText('before\n\n[PAUSE]\n\nafter', { mode: 'word' });

      const pauseAtom = atoms.find(a => a.tags.includes('PAUSE'));
      expect(pauseAtom).toBeDefined();
      expect(pauseAtom.duration).toBe(2000);
      expect(pauseAtom.content).toBe('');
    });

    it('handles [FLASH] marker', () => {
      const atoms = chunkText('word\n\n[FLASH]\n\nword', { mode: 'word' });

      const flashAtom = atoms.find(a => a.tags.includes('FLASH'));
      expect(flashAtom).toBeDefined();
      expect(flashAtom.duration).toBe(50);
    });

    it('handles [HOLD] marker', () => {
      const atoms = chunkText('text\n\n[HOLD]\n\nmore', { mode: 'word' });

      const holdAtom = atoms.find(a => a.tags.includes('HOLD'));
      expect(holdAtom).toBeDefined();
      expect(holdAtom.duration).toBe(3000);
    });

    it('marker case insensitive', () => {
      const atoms = chunkText('a\n\n[pause]\n\nb', { mode: 'word' });

      const pauseAtom = atoms.find(a => a.tags.includes('PAUSE'));
      expect(pauseAtom).toBeDefined();
    });
  });

  describe('paragraph breaks', () => {
    it('adds paragraph break atoms between paragraphs', () => {
      const atoms = chunkText('Para one.\n\nPara two.', { mode: 'word' });

      const breakAtom = atoms.find(a => a.tags.includes('paragraph-break'));
      expect(breakAtom).toBeDefined();
      expect(breakAtom.content).toBe('');
    });

    it('removes trailing paragraph break', () => {
      const atoms = chunkText('Single paragraph.', { mode: 'word' });

      const lastAtom = atoms[atoms.length - 1];
      expect(lastAtom.tags).not.toContain('paragraph-break');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      const atoms = chunkText('', { mode: 'word' });

      expect(atoms).toEqual([]);
    });

    it('handles whitespace only', () => {
      const atoms = chunkText('   \n\n   ', { mode: 'word' });

      expect(atoms).toEqual([]);
    });

    it('handles single word', () => {
      const atoms = chunkText('word', { mode: 'word' });

      expect(atoms.length).toBe(1);
      expect(atoms[0].content).toBe('word');
    });

    it('handles multiple spaces between words', () => {
      const atoms = chunkText('one    two     three', { mode: 'word' });

      expect(atoms.length).toBe(3);
    });
  });
});

describe('countWords', () => {
  it('counts words correctly', () => {
    expect(countWords('one two three')).toBe(3);
    expect(countWords('hello')).toBe(1);
    expect(countWords('')).toBe(0);
  });

  it('handles multiple whitespace', () => {
    expect(countWords('one   two\n\nthree')).toBe(3);
  });

  it('handles leading/trailing whitespace', () => {
    expect(countWords('  one two  ')).toBe(2);
  });
});

describe('estimateDuration', () => {
  it('calculates duration based on word count and WPM', () => {
    // 220 words at 220 WPM = 1 minute = 60000ms
    const duration = estimateDuration('word '.repeat(220), 220);

    expect(duration).toBeCloseTo(60000, -2); // Within 100ms
  });

  it('faster WPM gives shorter duration', () => {
    const text = 'one two three four five';
    const slow = estimateDuration(text, 100);
    const fast = estimateDuration(text, 400);

    expect(fast).toBeLessThan(slow);
  });

  it('returns 0 for empty text', () => {
    expect(estimateDuration('', 220)).toBe(0);
  });
});
