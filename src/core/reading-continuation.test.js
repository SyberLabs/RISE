import { describe, expect, it } from 'vitest';
import {
  createLibraryContinuation,
  hasNextLibraryDivision,
  resolveNextLibraryDivision
} from './reading-continuation.js';

const REVISION = `sha256:${'a'.repeat(64)}`;
const descriptor = {
  kind: 'library-division',
  workId: 'anna-karenina',
  editionId: 'anna-karenina:garnett:1901',
  sourceRevision: REVISION,
  entryId: '0',
  entryIndex: 0,
  entryCount: 2,
  noun: 'Chapter'
};
const contents = {
  item: {
    id: 'anna-karenina',
    metadata: {
      workId: 'anna-karenina',
      editionId: 'anna-karenina:garnett:1901',
      sourceRevision: REVISION
    }
  },
  entries: [
    { id: 0, label: 'Chapter 1', content: 'One.' },
    { id: 1, label: 'Chapter 2', content: 'Two.', verse: false }
  ]
};

describe('ordinary Archive reading continuation', () => {
  it('resolves the next division and advances the bounded descriptor', () => {
    const result = resolveNextLibraryDivision(descriptor, contents);
    expect(result.entry.content).toBe('Two.');
    expect(result.continuation.entryIndex).toBe(1);
    expect(result.continuation.entryId).toBe('1');
    expect(hasNextLibraryDivision(result.continuation)).toBe(false);
  });

  it('refuses a changed source revision instead of silently re-anchoring', () => {
    expect(() => resolveNextLibraryDivision(descriptor, {
      ...contents,
      item: { ...contents.item, metadata: { ...contents.item.metadata, sourceRevision: `sha256:${'b'.repeat(64)}` } }
    })).toThrow(/edition changed/i);
  });

  it('rejects unversioned continuation data', () => {
    expect(() => createLibraryContinuation({ ...descriptor, sourceRevision: 'latest' }))
      .toThrow(/sha256/i);
  });
});
