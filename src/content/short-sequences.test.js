import { describe, expect, it } from 'vitest';
import { compileSession } from '../core/session-compiler.js';
import { cueForAtom } from '../core/visual-scheduler.js';
import { SHORT_SEQUENCES, shortSequenceSession } from './short-sequences.js';

describe('short sequence experience', () => {
  it.each(SHORT_SEQUENCES)('$id plays as a timed audiovisual reading with three visual movements', sequence => {
    const session = compileSession(shortSequenceSession(sequence));
    expect(session.atoms.length).toBeGreaterThan(3);
    expect(session.visualConfig.interlocution.presentation).toBe('continuous');
    expect(session.visualProgram.segments).toHaveLength(3);
    expect([0.2, 0.5, 0.8].map(sourceProgress =>
      cueForAtom(session.visualProgram, { sourceId: 'primary', sourceProgress }).cue.collections[0]
    )).toEqual(sequence.engines);
    expect(session.soundscape).toBe(sequence.soundscape);
    expect(session.origin).toEqual({ view: 'short-sequences', sequenceId: sequence.id });
  });

  it('lets the reader turn sound off before entering', () => {
    const session = compileSession(shortSequenceSession(SHORT_SEQUENCES[0], { sound: false }));
    expect(session.soundscape).toBe('none');
    expect(session.audioPreset).toBe('silent');
  });
});
