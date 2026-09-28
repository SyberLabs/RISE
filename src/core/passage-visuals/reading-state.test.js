import { describe, expect, it } from 'vitest';
import { permittedSourceDigests } from './reading-state.js';

describe('which sources may be sent to Jev', () => {
  const digests = ['a1', 'b2', 'c3'];

  it('sends nothing without consent or catalog verification', () => {
    expect(permittedSourceDigests({ digests })).toEqual([]);
    expect(permittedSourceDigests({ digests, consent: {} })).toEqual([]);
  });

  it('covers every source of a multi-source reading the reader consented to', () => {
    // Only the first source was permitted when consent kept one digest.
    expect(permittedSourceDigests({ digests, consent: { sourceDigests: [...digests] } })).toEqual(digests);
  });

  it('never extends consent to a source whose text changed', () => {
    expect(permittedSourceDigests({ digests: ['a1', 'zz'], consent: { sourceDigests: ['a1', 'b2'] } }))
      .toEqual(['a1']);
  });

  it('permits every source of a verified catalog reading', () => {
    expect(permittedSourceDigests({ digests, catalogVerified: true })).toEqual(digests);
  });
});
