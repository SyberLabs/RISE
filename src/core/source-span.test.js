import { describe, expect, it } from 'vitest';
import { cueForAtom } from './visual-scheduler.js';
import { EXPERIENCE_PROGRAM_SCHEMA } from './experience-program.js';
import { compileSession } from './session-compiler.js';
import { Session } from './models.js';
import {
  assertQuotationAnchorsAgainstSources,
  buildNormalizedSourceIndex,
  compileSourceSpans,
  findInNormalizedIndex,
  locateQuoteSpan,
  resolveSourceSpan,
  snapCharacterRangeToTokens,
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

  it('snaps partial DOM selections outward to complete words', () => {
    const text = 'alpha revelation omega';
    const from = text.indexOf('revelation') + 2;
    const to = text.indexOf('revelation') + 6;
    expect(snapCharacterRangeToTokens(text, from, to)).toMatchObject({
      fromCharacter: text.indexOf('revelation'),
      toCharacter: text.indexOf('revelation') + 'revelation'.length
    });
  });

  it('cuts phrase atoms at every adjacent visual authority boundary', () => {
    const text = [
      'PART ONE PART TWO PART THREE PART FOUR PART FIVE PART SIX PART SEVEN PART EIGHT',
      'PART ONE',
      'Chapter 1 Happy families are all alike; every unhappy family is unhappy in its own way.',
      'Everything was in confusion in the Oblonskys house.'
    ].join('\n\n');
    const tokens = sourceTokens(text);
    const makeClip = (id, fromToken, toToken) => {
      const fromCharacter = tokens[fromToken].start;
      const toCharacter = tokens[toToken - 1].end;
      const selected = text.slice(fromCharacter, toCharacter).replace(/\s+/gu, ' ');
      return {
        id,
        anchor: {
          sourceIds: ['source-1'], fromCharacter, toCharacter,
          quoteStart: selected, quoteEnd: selected
        },
        cue: { kind: 'sourced', collections: [id] }
      };
    };
    const scored = {
      schema: EXPERIENCE_PROGRAM_SCHEMA,
      id: 'adjacent-authorities', authority: 'user', editable: true,
      tracks: [{
        id: 'movements', kind: 'movement',
        clips: [{ id: 'reading', anchor: { sourceIds: ['source-1'] }, data: { index: 0 } }]
      }, {
        id: 'visual-main', kind: 'visual', fallback: { kind: 'still' },
        clips: [
          makeClip('genesis', 0, 12),
          makeClip('fractal', 12, 18),
          makeClip('animals', 18, tokens.length)
        ]
      }]
    };
    const session = compileSession({
      sources: [{ id: 'source-1', name: 'Anna edge', data: text }],
      experienceProgram: scored,
      chunkMode: 'phrase', wpm: 240
    });
    const playable = session.atoms.filter(atom => atom.content);
    expect(playable.every(atom => (atom.sourceSpanIds || [])
      .filter(id => id.startsWith('visual-main:')).length === 1)).toBe(true);
    expect(playable.map(atom => cueForAtom(session.visualProgram, atom).id))
      .toEqual(expect.arrayContaining(['genesis', 'fractal', 'animals']));
    expect(playable.find(atom => atom.content.includes('PART SEVEN'))
      .sourceSpanIds).toEqual(['visual-main:fractal']);
    expect(playable.find(atom => atom.content.includes('Chapter 1'))
      .sourceSpanIds).toEqual(['visual-main:animals']);
  });

  it('reuses one normalized index for repeated quotation scans on a source', () => {
    const index = buildNormalizedSourceIndex(TEXT);
    const once = locateQuoteSpan(TEXT, 'The first few words', 'final few words');
    const reused = locateQuoteSpan(TEXT, 'The first few words', 'final few words', index);
    expect(reused).toEqual(once);
    expect(once.fromCharacter).toBe(FROM);

    const open = findInNormalizedIndex(index, 'The first few words', 0);
    const close = findInNormalizedIndex(index, 'final few words', open.from);
    expect(close.from).toBeGreaterThanOrEqual(open.from);
    expect(TEXT.slice(open.from, close.to)).toMatch(/The first few words[\s\S]*final few words/);
  });

  it('refuses an ambiguous opening quote instead of binding the first hit', () => {
    const text = 'alpha the mark beta gamma the mark delta';
    expect(() => locateQuoteSpan(text, 'the mark', 'delta'))
      .toThrow(expect.objectContaining({
        code: 'SOURCE_SPAN_QUOTE_AMBIGUOUS',
        details: expect.objectContaining({ quoteStart: 'the mark', occurrences: 2 })
      }));
  });

  it('omits ambiguous quotation clips at compile (reader path)', () => {
    const text = 'alpha the mark beta gamma the mark delta';
    const program = {
      tracks: [{
        id: 'visual-main',
        kind: 'visual',
        clips: [{
          id: 'v1',
          anchor: {
            sourceIds: ['s1'],
            quoteStart: 'the mark',
            quoteEnd: 'delta'
          }
        }]
      }]
    };
    const { resolutions, omitted } = compileSourceSpans(
      program,
      [{ id: 's1', raw: text }],
      [{ id: 'a0', sourceId: 's1', position: 0, text: 'alpha', comparable: 'alpha' }]
    );
    expect(resolutions).toHaveLength(0);
    expect(omitted[0]).toMatchObject({
      clipId: 'v1',
      reason: 'SOURCE_SPAN_QUOTE_AMBIGUOUS'
    });
  });

  it('assertQuotationAnchorsAgainstSources refuses only ambiguity', () => {
    const text = 'alpha the mark beta gamma the mark delta';
    const ambiguous = {
      tracks: [{
        id: 'visual-main',
        kind: 'visual',
        clips: [{
          id: 'v1',
          anchor: { sourceIds: ['s1'], quoteStart: 'the mark', quoteEnd: 'delta' }
        }]
      }]
    };
    expect(() => assertQuotationAnchorsAgainstSources(ambiguous, [{ id: 's1', data: text }]))
      .toThrow(expect.objectContaining({ code: 'SOURCE_SPAN_QUOTE_AMBIGUOUS' }));

    const missing = {
      tracks: [{
        id: 'visual-main',
        kind: 'visual',
        clips: [{
          id: 'v1',
          anchor: { sourceIds: ['s1'], quoteStart: 'absent phrase', quoteEnd: 'nowhere' }
        }]
      }]
    };
    expect(assertQuotationAnchorsAgainstSources(missing, [{ id: 's1', data: text }])).toBe(true);
  });
});
