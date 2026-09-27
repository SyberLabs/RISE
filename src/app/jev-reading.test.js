import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTextById } from '../content/library.js';
import releaseInventory from '../content/archive/release-inventory.json' with { type: 'json' };
import { resolveJevReading, selectJevDivision } from './jev-reading.js';

vi.mock('../content/library.js', () => ({ getTextById: vi.fn() }));

const released = releaseInventory.middlemarch;
const divisions = {
  divided: true,
  noun: 'Chapter',
  entries: [
    { id: 0, label: 'Chapter I', content: 'The first source text.', words: 4 },
    { id: 1, label: 'Chapter II', content: 'A shorter passage.', words: 3 },
    { id: 2, label: 'Chapter III', content: 'The longest existing passage.', words: 5 }
  ]
};

function decision(config = {}) {
  return {
    workId: released.workId,
    editionId: released.editionId,
    sourceRevision: released.sourceRevision,
    text: 'Model-supplied prose must never reach the reading.',
    config: {
      section: 'first', wpm: 200, curve: 'flat', chunkMode: 'phrase',
      audio: 'aurora', visualMode: 'focals', projection: 'stream',
      revealMode: 'instant', ...config
    }
  };
}

beforeEach(() => {
  vi.mocked(getTextById).mockReset();
  vi.mocked(getTextById).mockReturnValue({
    id: released.workId,
    workId: released.workId,
    provider: 'archive-ingest',
    title: 'Middlemarch',
    editionId: released.editionId,
    sourceRevision: released.sourceRevision,
    provenance: { editionId: released.editionId },
    getDivisions: vi.fn(async () => divisions)
  });
});

describe('Jev reading handoff', () => {
  it('selects the exact released source and maps enums to Chamber input', async () => {
    const input = await resolveJevReading(decision());
    expect(input.text).toBe('The first source text.');
    expect(input.textSource).toBe('Middlemarch · Chapter I');
    expect(input).toMatchObject({
      wpm: 200, curve: 'flat', chunkMode: 'phrase',
      audioPreset: 'silent', soundscape: 'aurora',
      projection: 'stream', revealMode: 'instant',
      visualConfig: { visualMode: 'focals' },
      continuation: {
        workId: released.workId, editionId: released.editionId,
        sourceRevision: released.sourceRevision, entryId: '0',
        entryIndex: 0, entryCount: 3, noun: 'chapter'
      }
    });
  });

  it('rejects unknown options and changed edition identity', async () => {
    await expect(resolveJevReading(decision({ chunkMode: 'script' })))
      .rejects.toThrow('invalid reading plan');
    await expect(resolveJevReading({ ...decision(), sourceRevision: 'other' }))
      .rejects.toThrow('not available');
  });

  it('chooses a real division using the section enum', () => {
    expect(selectJevDivision(divisions, 'shortest').entry.id).toBe(1);
    expect(selectJevDivision(divisions, 'longest').entry.id).toBe(2);
  });
});
