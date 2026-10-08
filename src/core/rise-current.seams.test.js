/**
 * A Current is one piece. The session compiler names the seam between two
 * sources after the piece the reader is arriving in, which is right for a
 * reading stitched from works and wrong inside one answer: every passage of
 * the first field reading (17 beats, 2026-10-08) was announced with a title
 * card, "WHY THE SKY IS BLUE · 9", then the next, which the owner saw as
 * flashing. A Current's passages carry no name, so no seam is named and the
 * boundary stays the silence it is.
 */
import { describe, expect, it } from 'vitest';
import { compileRiseCurrent } from './rise-current.js';

const origin = { kind: 'model', name: 'Claude', provider: 'Anthropic' };

const V2 = {
  schema: 'rise.current.v2',
  id: 'sky',
  title: 'Why the sky is blue',
  origin,
  scenes: [{ id: 'field', engine: 'attractor' }],
  beats: [
    { say: 'Sunlight looks white, but it is every colour at once.', scene: 'field' },
    { hold: { ms: 1500 } },
    { say: 'Each colour is a wave, and each has its own wavelength.' },
    { show: 'Short waves scatter most.', hold: { ms: 2000 } }
  ]
};

const V1 = {
  schema: 'rise.current.v1',
  id: 'sky-v1',
  title: 'Why the sky is blue',
  origin,
  segments: [
    { id: 'first', text: 'Sunlight looks white, but it is every colour at once.' },
    { id: 'second', text: 'Each colour is a wave, and each has its own wavelength.' }
  ]
};

describe('the boundaries inside one Current', () => {
  it('name no seam between the beats of a v2 Current, and keep the boundary the voice and the beats time by', () => {
    const { atoms } = compileRiseCurrent(V2);
    const breaks = atoms.filter(atom => atom.tags?.includes('source-break'));
    expect(breaks.length).toBeGreaterThan(0);
    // The seam stays (atom-map.js and timeBeats recognise a boundary by it) with nothing to show.
    expect(breaks.every(atom => atom.seam && atom.seam.label === '' && atom.seam.name === '')).toBe(true);
    expect(atoms.filter(atom => atom.seam?.label)).toEqual([]);
  });

  it('name no seam between the passages of a v1 Current either', () => {
    const { atoms } = compileRiseCurrent(V1);
    expect(atoms.filter(atom => atom.seam?.label)).toEqual([]);
    expect(atoms.filter(atom => atom.tags?.includes('source-break')).every(atom => atom.seam)).toBe(true);
  });
});
