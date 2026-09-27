import { describe, expect, it } from 'vitest';
import { buildJevVisualProgram } from './jev-sequence.js';

const input = (visualArc, overrides = {}) => ({
  visualArc,
  arcSplit: 50,
  visualEngine: 'klee',
  middleEngine: 'harmonograph',
  finaleEngine: 'ostensoria',
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
});
