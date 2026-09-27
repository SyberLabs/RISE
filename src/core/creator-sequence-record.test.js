import { describe, expect, it } from 'vitest';
import {
  requireApprovedCreatorSequenceRecord,
  validateCreatorSequenceRecord
} from './creator-sequence-record.js';

const record = () => ({
  schema: 'rise.creator-sequence.v1',
  id: 'marcus-opening',
  version: 1,
  creator: { id: 'maker-1', credit: 'Sequence by A Maker', permission: 'granted' },
  source: {
    title: 'Meditations',
    author: 'Marcus Aurelius',
    edition: 'George Long translation, 1862',
    passage: { start: 'Book 1.1', end: 'Book 1.3' },
    fingerprint: 'a'.repeat(64),
    rights: 'Public domain source text; edition verified by curator'
  },
  program: { id: 'rise-meditations', version: 2 },
  allowedVariations: [],
  approval: { state: 'approved' }
});

describe('creator sequence record', () => {
  it('admits an approved, precisely anchored version as immutable data', () => {
    const input = record();
    const admitted = requireApprovedCreatorSequenceRecord(input);
    expect(admitted).toEqual(input);
    expect(admitted).not.toBe(input);
    expect(Object.isFrozen(admitted)).toBe(true);
    expect(Object.isFrozen(admitted.source.passage)).toBe(true);
    input.source.passage.start = 'Book 2.1';
    expect(admitted.source.passage.start).toBe('Book 1.1');
  });

  it.each([
    ['creator credit', value => { delete value.creator.credit; }],
    ['creator permission', value => { delete value.creator.permission; }],
    ['source edition', value => { delete value.source.edition; }],
    ['passage start', value => { delete value.source.passage.start; }],
    ['passage end', value => { delete value.source.passage.end; }],
    ['source fingerprint', value => { value.source.fingerprint = 'not-a-sha256'; }],
    ['source rights', value => { delete value.source.rights; }],
    ['program identity', value => { delete value.program.id; }],
    ['program version', value => { value.program.version = 0; }],
    ['record version', value => { value.version = 0; }],
    ['variation permission', value => { value.allowedVariations = ['pace']; }],
    ['unknown field', value => { value.creator.fakeApproval = true; }]
  ])('rejects missing or invalid %s', (_name, change) => {
    const input = record();
    change(input);
    expect(() => validateCreatorSequenceRecord(input)).toThrow();
  });

  it('retains withdrawn state for inspection but rejects it for admission', () => {
    const input = record();
    input.approval.state = 'withdrawn';
    expect(validateCreatorSequenceRecord(input).approval.state).toBe('withdrawn');
    expect(() => requireApprovedCreatorSequenceRecord(input)).toThrow();
  });

  it('rejects a creator permission withdrawal even with stale approved state', () => {
    const input = record();
    input.creator.permission = 'withdrawn';
    expect(() => requireApprovedCreatorSequenceRecord(input)).toThrow();
  });

  it('rejects ambiguous or forged record shapes', () => {
    expect(() => validateCreatorSequenceRecord(null)).toThrow();
    const input = record();
    input.allowedVariations = ['pace', 'pace'];
    expect(() => validateCreatorSequenceRecord(input)).toThrow();
  });
});
