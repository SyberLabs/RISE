/**
 * The v2 contract's limits must be honoured by everything beneath the
 * validator: a Current the validator accepts must compile. The first Claude
 * reading in the field (2026-10-08, 17 beats) validated, then failed in the
 * compiler on a movement-track cap of 16 that nobody had raised with the beats.
 */
import { describe, expect, it } from 'vitest';
import { BEAT_LIMITS } from './beats.js';
import { EXPERIENCE_PROGRAM_LIMITS } from './experience-program.js';
import { compileRiseCurrent, validateRiseCurrent } from './rise-current.js';

const current = beats => ({
  schema: 'rise.current.v2',
  id: 'long',
  title: 'A long lesson',
  origin: { kind: 'model', name: 'Claude', provider: 'Anthropic' },
  scenes: [{ id: 'field', engine: 'attractor' }],
  beats
});

describe('a Current as long as the contract allows', () => {
  it('compiles with as many beats as beats.js admits, one movement each', () => {
    const beats = Array.from({ length: BEAT_LIMITS.beats }, (_, i) => (i % 4 === 3 ? { hold: { ms: 500 } } : { say: `Beat ${i} says one short thing.` }));
    const long = current([{ ...beats[0], scene: 'field' }, ...beats.slice(1)]);
    expect(validateRiseCurrent(long).segments).toHaveLength(BEAT_LIMITS.beats);
    const session = compileRiseCurrent(long);
    expect(session.atoms.filter(atom => atom.sourceId === `beat-${BEAT_LIMITS.beats - 1}`).length).toBeGreaterThan(0);
  });

  it('keeps the score’s movement cap at or above the beat cap, so the two cannot drift apart again', () => {
    expect(EXPERIENCE_PROGRAM_LIMITS.maxMovements).toBeGreaterThanOrEqual(BEAT_LIMITS.beats);
  });
});
