/**
 * R.I.S.E. Models Test Suite
 * Tests for Atom, Source, Session, and SessionState classes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Atom, Source, Session, SessionState } from './models.js';

describe('Atom', () => {
  describe('constructor', () => {
    it('creates an atom with default values', () => {
      const atom = new Atom({ content: 'test' });

      expect(atom.content).toBe('test');
      expect(atom.modality).toBe('text');
      expect(atom.duration).toBe(250);
      expect(atom.weight).toBe(0.5);
      expect(atom.complexity).toBe(0.5);
      expect(atom.tags).toEqual([]);
      expect(atom.id).toBeDefined();
    });

    it('creates an atom with custom values', () => {
      const atom = new Atom({
        content: 'hello',
        modality: 'image',
        duration: 1000,
        weight: 0.8,
        complexity: 0.3,
        tags: ['sacred', 'intro'],
        source: 'tao-te-ching'
      });

      expect(atom.content).toBe('hello');
      expect(atom.modality).toBe('image');
      expect(atom.duration).toBe(1000);
      expect(atom.weight).toBe(0.8);
      expect(atom.complexity).toBe(0.3);
      expect(atom.tags).toEqual(['sacred', 'intro']);
      expect(atom.source).toBe('tao-te-ching');
    });

    it('generates unique IDs for each atom', () => {
      const atom1 = new Atom({ content: 'a' });
      const atom2 = new Atom({ content: 'b' });

      expect(atom1.id).not.toBe(atom2.id);
    });
  });

  describe('static factory methods', () => {
    it('creates a text atom', () => {
      const atom = Atom.text('hello world');

      expect(atom.content).toBe('hello world');
      expect(atom.modality).toBe('text');
    });

    it('creates an image atom with default duration', () => {
      const atom = Atom.image('https://example.com/img.png');

      expect(atom.url).toBe('https://example.com/img.png');
      expect(atom.modality).toBe('image');
      expect(atom.duration).toBe(2000);
    });

    it('creates a symbol atom', () => {
      const atom = Atom.symbol('無');

      expect(atom.content).toBe('無');
      expect(atom.modality).toBe('symbol');
      expect(atom.duration).toBe(400);
    });

    it('creates a pause atom', () => {
      const atom = Atom.pause(500);

      expect(atom.content).toBe('');
      expect(atom.duration).toBe(500);
      expect(atom.weight).toBe(0);
    });
  });
});

describe('Source', () => {
  it('creates a source with required fields', () => {
    const source = new Source({
      name: 'Tao Te Ching',
      raw: 'The Tao that can be told...'
    });

    expect(source.name).toBe('Tao Te Ching');
    expect(source.raw).toBe('The Tao that can be told...');
    expect(source.type).toBe('file');
    expect(source.id).toBeDefined();
    expect(source.fetched).toBeInstanceOf(Date);
  });

  it('creates a source with custom type', () => {
    const source = new Source({
      name: 'Generated',
      type: 'generated',
      raw: 'Auto-generated content'
    });

    expect(source.type).toBe('generated');
  });
});

describe('Session', () => {
  let atoms;

  beforeEach(() => {
    atoms = [
      new Atom({ content: 'The', duration: 200 }),
      new Atom({ content: 'way', duration: 200 }),
      new Atom({ content: 'that', duration: 200 }),
      new Atom({ content: 'can', duration: 200 }),
      new Atom({ content: 'be', duration: 200 })
    ];
  });

  it('creates a session with default values', () => {
    const session = new Session({ atoms });

    expect(session.name).toBe('Untitled Session');
    expect(session.wpm).toBe(320);
    expect(session.chunkMode).toBe('word');
    expect(session.curve).toBe('flat');
    expect(session.displayMode).toBe('focal');
    expect(session.audioPreset).toBe('silent');
    expect(session.visualConfig.enabled).toBe(false);
  });

  it('accepts title as alias for name', () => {
    const session = new Session({ title: 'My Session', atoms });

    expect(session.name).toBe('My Session');
  });

  it('calculates total duration', () => {
    const session = new Session({ atoms });

    expect(session.totalDuration).toBe(1000); // 5 * 200ms
  });

  it('returns atom count', () => {
    const session = new Session({ atoms });

    expect(session.atomCount).toBe(5);
  });

  it('handles empty atoms array', () => {
    const session = new Session({ atoms: [] });

    expect(session.totalDuration).toBe(0);
    expect(session.atomCount).toBe(0);
  });
});

describe('SessionState', () => {
  let session;
  let state;

  beforeEach(() => {
    const atoms = [
      new Atom({ content: 'one', duration: 100 }),
      new Atom({ content: 'two', duration: 100 }),
      new Atom({ content: 'three', duration: 100 })
    ];
    session = new Session({ atoms });
    state = new SessionState(session);
  });

  it('initializes with correct defaults', () => {
    expect(state.currentIndex).toBe(0);
    expect(state.state).toBe('idle');
    expect(state.startTime).toBeNull();
    expect(state.elapsedTime).toBe(0);
    expect(state.pausedAt).toBeNull();
  });

  it('returns current atom', () => {
    expect(state.currentAtom.content).toBe('one');
  });

  it('calculates progress correctly', () => {
    expect(state.progress).toBe(0);

    state.advance();
    expect(state.progress).toBeCloseTo(1 / 3, 2);

    state.advance();
    expect(state.progress).toBeCloseTo(2 / 3, 2);
  });

  it('advances through atoms', () => {
    expect(state.currentAtom.content).toBe('one');

    state.advance();
    expect(state.currentAtom.content).toBe('two');

    state.advance();
    expect(state.currentAtom.content).toBe('three');
  });

  it('detects completion', () => {
    expect(state.isComplete).toBe(false);

    state.advance();
    state.advance();
    state.advance();

    expect(state.isComplete).toBe(true);
    expect(state.currentAtom).toBeNull();
  });

  it('does not advance past completion', () => {
    state.advance();
    state.advance();
    state.advance();
    state.advance(); // Extra advance

    expect(state.currentIndex).toBe(3);
  });

  it('resets state correctly', () => {
    state.currentIndex = 2;
    state.state = 'playing';
    state.startTime = Date.now();
    state.elapsedTime = 5000;

    state.reset();

    expect(state.currentIndex).toBe(0);
    expect(state.state).toBe('idle');
    expect(state.startTime).toBeNull();
    expect(state.elapsedTime).toBe(0);
  });

  it('handles empty session', () => {
    const emptySession = new Session({ atoms: [] });
    const emptyState = new SessionState(emptySession);

    expect(emptyState.progress).toBe(0);
    expect(emptyState.isComplete).toBe(true);
    expect(emptyState.currentAtom).toBeNull();
  });
});
