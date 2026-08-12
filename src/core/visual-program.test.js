import { describe, expect, it } from 'vitest';
import {
  deserializeVisualProgram,
  normalizeVisualProgram,
  serializeVisualProgram,
  visualFallbackCueFromConfig
} from './visual-program.js';
import { compileSession } from './session-compiler.js';
import { VisualScheduleController } from './visual-scheduler.js';

const program = {
  coordinateSpace: 'scripture',
  enabled: true,
  segments: [{
    id: 'entombment',
    match: { chapter: 27, verseStart: 57, verseEnd: Infinity },
    cue: { kind: 'sourced', collections: ['chapel-gospel-entombment'] }
  }],
  fallback: { kind: 'still' }
};

describe('visual program persistence boundary', () => {
  it('round-trips an end-of-chapter range through JSON without losing Infinity', () => {
    const json = JSON.stringify(serializeVisualProgram(program));
    expect(json).not.toContain('"verseEnd":null');

    const restored = deserializeVisualProgram(JSON.parse(json));
    expect(restored.segments[0].match.verseEnd).toBe(Infinity);
    expect(restored.segments[0].cue.collections).toEqual(['chapel-gospel-entombment']);
  });

  it('bounds and rejects malformed executable programs', () => {
    expect(normalizeVisualProgram({ coordinateSpace: 'screen', segments: [] })).toBeNull();
    expect(normalizeVisualProgram({
      coordinateSpace: 'scripture',
      segments: [{ id: 'bad', match: { chapter: 27, verseStart: 5, verseEnd: 2 } }]
    })).toBeNull();
  });

  it('persists visual fields and lowers legacy whole-reading defaults to cues', () => {
    const fieldProgram = {
      coordinateSpace: 'source',
      segments: [{
        id: 'genesis', match: { sourceIds: ['source-1'] },
        cue: { kind: 'field', renderer: 'genesis', config: { preset: 'harmonic', glass: false } }
      }],
      fallback: { kind: 'field', renderer: 'attractor', config: { system: 'thomas' } }
    };
    expect(deserializeVisualProgram(JSON.parse(JSON.stringify(
      serializeVisualProgram(fieldProgram)
    )))).toEqual(fieldProgram);
    expect(visualFallbackCueFromConfig({
      visualMode: 'focals', focals: { standardGlyph: 'star' }
    })).toEqual({
      kind: 'field', renderer: 'focal', config: { standardGlyph: 'star' }
    });
  });

  it('round-trips bounded procedural styles without carrying unknown fields', () => {
    const styled = {
      coordinateSpace: 'source',
      segments: [{
        id: 'klee-harmonic', match: { sourceIds: ['source-1'] },
        cue: {
          kind: 'procedural', collections: ['klee'],
          config: { preset: 'harmonic', injected: true }
        }
      }],
      fallback: { kind: 'still' }
    };
    expect(deserializeVisualProgram(JSON.parse(JSON.stringify(
      serializeVisualProgram(styled)
    ))).segments[0].cue).toEqual({
      kind: 'procedural', collections: ['klee'], config: { preset: 'harmonic' }
    });
  });

  it('continues through compilation and activates the restored final episode', () => {
    const restored = deserializeVisualProgram(JSON.parse(
      JSON.stringify(serializeVisualProgram(program))
    ));
    const session = compileSession({
      text: '[v 27:57] And when it was evening, there came a certain rich man.',
      textSource: 'The Chapel · Matthew 27',
      chunkProfile: 'scripture',
      chunkMode: 'phrase',
      visualProgram: restored
    });
    const verseAtom = session.atoms.find(atom => atom.chapter === 27 && atom.verse === 57);
    const seen = [];
    const schedule = new VisualScheduleController(
      session.visualProgram,
      cue => seen.push(cue)
    );

    schedule.observe(verseAtom);

    expect(session.visualProgram.segments[0].match.verseEnd).toBe(Infinity);
    expect(seen).toEqual([
      { kind: 'sourced', collections: ['chapel-gospel-entombment'] }
    ]);
  });
});
