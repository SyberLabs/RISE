import { describe, expect, it } from 'vitest';
import { cueForAtom } from './visual-scheduler.js';
import { EXPERIENCE_PROGRAM_SCHEMA } from './experience-program.js';
import { compileSession } from './session-compiler.js';
import { Session } from './models.js';
import {
  resolveSourceSpan,
  sourceTokens,
  SourceSpanResolutionError
} from './source-span.js';

const TEXT = [
  'Before the selected passage.',
  'The first few words lead across a deliberate line break\nto the final few words.',
  'After the selected passage.'
].join('\n\n');

const FROM = TEXT.indexOf('The first few words');
const TO = TEXT.indexOf('After the selected passage.') - 2;

function program(anchor) {
  return {
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id: 'stable-span-test',
    authority: 'user',
    editable: true,
    tracks: [
      {
        id: 'movements',
        kind: 'movement',
        clips: [{
          id: 'reading',
          anchor: { sourceIds: ['source-1'] },
          data: { index: 0, title: 'Reading' }
        }]
      },
      {
        id: 'visual-main',
        kind: 'visual',
        clips: [
          {
            id: 'broad',
            anchor: { sourceIds: ['source-1'] },
            cue: { kind: 'still' }
          },
          {
            id: 'selected',
            anchor,
            cue: { kind: 'sourced', collections: ['selected-collection'] }
          }
        ],
        fallback: { kind: 'still' }
      }
    ]
  };
}

const characterAnchor = () => ({
  sourceIds: ['source-1'],
  fromCharacter: FROM,
  toCharacter: TO,
  quoteStart: 'The first few words',
  quoteEnd: 'the final few words.'
});

function compile(chunkMode, anchor = characterAnchor(), text = TEXT) {
  return compileSession({
    sources: [{ id: 'source-1', name: 'Source', data: text }],
    experienceProgram: program(anchor),
    chunkMode,
    wpm: 240
  });
}

describe('stable source-span compilation', () => {
  it.each(['word', 'phrase', 'sentence', 'paragraph'])(
    'keeps a character span attached in %s mode',
    chunkMode => {
      const session = compile(chunkMode);
      const selected = session.atoms.filter(atom =>
        cueForAtom(session.visualProgram, atom).id === 'selected');

      expect(selected.length).toBeGreaterThan(0);
      expect(selected.some(atom => atom.content.includes('first')
        || atom.content.includes('final'))).toBe(true);
      expect(selected.every(atom => atom.sourceId === 'source-1')).toBe(true);
      expect(selected.every(atom => Number.isInteger(atom.sourceCharacterStart))).toBe(true);
      expect(selected.every(atom => atom.sourceSpanIds.includes('visual-main:selected'))).toBe(true);
      expect(session.atoms.find(atom => atom.content.includes('Before'))
        && cueForAtom(session.visualProgram,
          session.atoms.find(atom => atom.content.includes('Before'))).id).toBe('broad');
      expect(session.atoms.find(atom => atom.content.includes('After'))
        && cueForAtom(session.visualProgram,
          session.atoms.find(atom => atom.content.includes('After'))).id).toBe('broad');
    }
  );

  it('compiles a whitespace-token range into the same atom coordinate space', () => {
    const tokens = sourceTokens(TEXT);
    const fromToken = tokens.find(token => token.value === 'The').index;
    const toToken = tokens.find(token => token.value === 'words.').index + 1;
    const session = compile('phrase', {
      sourceIds: ['source-1'],
      fromToken,
      toToken,
      quoteStart: 'The first few words',
      quoteEnd: 'the final few words.'
    });

    const selected = session.atoms.filter(atom =>
      cueForAtom(session.visualProgram, atom).id === 'selected');
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.every(atom => Number.isInteger(atom.sourceTokenStart))).toBe(true);
  });

  it('aligns through structural markers and source display profiles', () => {
    const marked = 'Alpha [PAUSE] omega';
    const markedSession = compileSession({
      sources: [{ id: 'source-1', name: 'Marked', data: marked }],
      experienceProgram: program({
        sourceIds: ['source-1'],
        fromCharacter: 0,
        toCharacter: marked.length,
        quoteStart: 'Alpha',
        quoteEnd: 'omega'
      }),
      chunkMode: 'word'
    });
    const pause = markedSession.atoms.find(atom => atom.tags.includes('PAUSE'));
    expect(pause.sourceSpanIds).toContain('visual-main:selected');
    expect(pause.sourceCharacterStart).toBe(marked.indexOf('[PAUSE]'));

    const scripture = '[v 1:1] In the beginning.\n\n[v 1:2] Then came light.';
    const fromCharacter = scripture.indexOf('In the beginning.');
    const scriptureSession = compileSession({
      sources: [{
        id: 'source-1',
        name: 'Scripture',
        data: scripture,
        chunkProfile: 'scripture'
      }],
      experienceProgram: program({
        sourceIds: ['source-1'],
        fromCharacter,
        toCharacter: scripture.length,
        quoteStart: 'In the beginning.',
        quoteEnd: 'Then came light.'
      }),
      chunkMode: 'word'
    });
    expect(scriptureSession.atoms.find(atom => atom.content === 'In').sourceCharacterStart)
      .toBe(fromCharacter);
    expect(scriptureSession.atoms.find(atom => atom.content === 'Then').sourceSpanIds)
      .toContain('visual-main:selected');
  });

  it('normalizes quote whitespace but does not move the authored offsets', () => {
    const resolved = resolveSourceSpan(characterAnchor(), TEXT);
    expect(resolved).toMatchObject({
      kind: 'character',
      fromCharacter: FROM,
      toCharacter: TO,
      quoteStart: 'The first few words',
      quoteEnd: 'the final few words.'
    });
  });

  it('refuses edition drift instead of searching for a plausible replacement', () => {
    const shifted = `Changed. ${TEXT}`;
    expect(() => compile('word', characterAnchor(), shifted)).toThrow(expect.objectContaining({
      name: 'SourceSpanResolutionError',
      code: 'SOURCE_SPAN_QUOTE_START_MISMATCH'
    }));
  });

  it('refuses out-of-edition bounds and Unicode-splitting offsets', () => {
    expect(() => resolveSourceSpan({
      ...characterAnchor(),
      toCharacter: TEXT.length + 1
    }, TEXT)).toThrow(expect.objectContaining({ code: 'SOURCE_SPAN_CHARACTER_BOUNDS' }));

    const unicode = 'A 😀 revelation';
    expect(() => resolveSourceSpan({
      sourceIds: ['source-1'],
      fromCharacter: 3,
      toCharacter: unicode.length,
      quoteStart: '😀',
      quoteEnd: 'revelation'
    }, unicode)).toThrow(expect.objectContaining({ code: 'SOURCE_SPAN_UNICODE_BOUNDARY' }));
  });

  it('survives Session JSON persistence with its compiled atom coordinates', () => {
    const session = compile('sentence');
    const restored = new Session(JSON.parse(JSON.stringify(session)));
    const selected = restored.atoms.find(atom => atom.content.includes('first'));

    expect(restored.experienceProgram).toEqual(session.experienceProgram);
    expect(selected.sourceCharacterStart).toBe(FROM);
    expect(selected.sourceSpanIds).toContain('visual-main:selected');
    expect(cueForAtom(restored.visualProgram, selected).id).toBe('selected');
  });

  it('exposes typed resolution failures', () => {
    expect(() => resolveSourceSpan(characterAnchor(), null))
      .toThrow(SourceSpanResolutionError);
  });
});
