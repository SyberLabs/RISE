import { describe, expect, it } from 'vitest';
import {
  buildJevVisualProgram,
  compileJevAudioProgram
} from './jev-sequence.js';

const input = (visualArc, overrides = {}) => ({
  visualArc,
  arcSplit: 50,
  visualEngine: 'klee',
  middleEngine: 'harmonograph',
  finaleEngine: 'ostensoria',
  colorTheme: 'classic',
  middleTheme: 'amethyst',
  finaleTheme: 'prism',
  audio: 'silent',
  middleAudio: 'aurora',
  finaleAudio: 'faded-signal',
  ...overrides
});

describe('compileJevVisualProgram', () => {
  it('does not create a program for a single visual arc', () => {
    expect(buildJevVisualProgram(input('single'))).toBeNull();
  });

  it.each([[30, 0.3], [50, 0.5], [70, 0.7]])('compiles a dual arc at the requested split %s', (answer, split) => {
    const program = buildJevVisualProgram(input('dual', { arcSplit: answer }));

    expect(program.coordinateSpace).toBe('source');
    expect(program.segments.map(segment => segment.match)).toEqual([
      { sourceIds: ['primary'], fromProgress: 0, toProgress: split },
      { sourceIds: ['primary'], fromProgress: split, toProgress: 1 }
    ]);
    expect(program.segments.map(segment => segment.cue.collections[0]))
      .toEqual(['klee', 'harmonograph']);
    expect(program.segments.map(segment => segment.cue.colorTheme))
      .toEqual(['classic', 'prism']);
  });

  it('compiles a triple arc into the fixed three normalized intervals', () => {
    const program = buildJevVisualProgram(input('triple'));

    expect(program.segments.map(segment => segment.match)).toEqual([
      { sourceIds: ['primary'], fromProgress: 0, toProgress: 0.3 },
      { sourceIds: ['primary'], fromProgress: 0.3, toProgress: 0.7 },
      { sourceIds: ['primary'], fromProgress: 0.7, toProgress: 1 }
    ]);
    expect(program.segments.map(segment => segment.cue.collections[0]))
      .toEqual(['klee', 'harmonograph', 'ostensoria']);
    expect(program.segments.map(segment => segment.cue.colorTheme))
      .toEqual(['classic', 'amethyst', 'prism']);
  });

  it('chooses the next fixed engine when a later answer repeats an earlier one', () => {
    const program = buildJevVisualProgram(input('triple', {
      middleEngine: 'klee',
      finaleEngine: 'klee'
    }));

    expect(program.segments.map(segment => segment.cue.collections[0]))
      .toEqual(['klee', 'turrell', 'fractal']);
  });

  it('bounds unknown arc and engine values without creating malformed segments', () => {
    expect(buildJevVisualProgram(input('quad'))).toBeNull();
    expect(buildJevVisualProgram(input('dual', {
      visualEngine: 'unknown', middleEngine: 'also-unknown'
    }))).toBeNull();
  });

  it('bounds unknown phase themes', () => {
    expect(buildJevVisualProgram(input('triple', { finaleTheme: 'unknown' })))
      .toBeNull();
  });
});

describe('compileJevAudioProgram', () => {
  it('does not create a phase audio schedule for a single arc', () => {
    expect(compileJevAudioProgram(input('single'))).toBeNull();
  });

  it('compiles bounded soundscape cues for a triple arc', () => {
    const program = compileJevAudioProgram(input('triple'));

    expect(program.segments.map(segment => segment.cue)).toEqual([
      { kind: 'silence', fadeMs: 500 },
      { kind: 'soundscape', soundscapeId: 'aurora', fadeMs: 500 },
      { kind: 'soundscape', soundscapeId: 'faded-signal', fadeMs: 500 }
    ]);
    expect(program.fallback).toEqual({ kind: 'silence', fadeMs: 500 });
  });

  it('rejects an unknown phase soundscape', () => {
    expect(compileJevAudioProgram(input('dual', { finaleAudio: 'tone' })))
      .toBeNull();
  });
});
