import { describe, expect, it } from 'vitest';
import { compileSession } from '../session-compiler.js';
import { verifyCatalogReading } from './catalog-identity.js';

const entries = [
  { id: 1, content: 'The first released chapter of the edition, exactly as shipped.' },
  { id: 2, content: 'The second released chapter follows with its own sentences.' }
];
const contents = {
  item: { id: 'work', metadata: { workId: 'work', editionId: 'ed', sourceRevision: 'sha256:' + 'a'.repeat(64) } },
  entries
};
const load = async () => contents;

function session(text, extra = {}) {
  return compileSession({ title: 'Catalog', text, visualConfig: { visualMode: 'off' }, ...extra });
}

const continuation = {
  kind: 'library-division', workId: 'work', editionId: 'ed',
  sourceRevision: 'sha256:' + 'a'.repeat(64), entryId: '1', entryIndex: 0, entryCount: 2
};

describe('catalog eligibility', () => {
  it('accepts an exact released entry reached through its edition identity', async () => {
    expect(await verifyCatalogReading(session(entries[0].content, { continuation }), { loadContents: load })).toBe(true);
  });

  it('accepts the released work read whole', async () => {
    const whole = entries.map(entry => entry.content).join('\n\n');
    expect(await verifyCatalogReading(session(whole, { provenance: { kind: 'library-work', workId: 'work' } }),
      { loadContents: load })).toBe(true);
  });

  it('refuses edited text even under catalog labels', async () => {
    expect(await verifyCatalogReading(session(`${entries[0].content} Edited.`, { continuation }),
      { loadContents: load })).toBe(false);
  });

  it('refuses pasted text with no trusted pointer', async () => {
    expect(await verifyCatalogReading(session(entries[0].content), { loadContents: load })).toBe(false);
  });

  it('refuses a pointer to another edition revision', async () => {
    const stale = { ...continuation, sourceRevision: 'sha256:' + 'b'.repeat(64) };
    expect(await verifyCatalogReading(session(entries[0].content, { continuation: stale }),
      { loadContents: load })).toBe(false);
  });

  it('refuses when the trusted source cannot be loaded', async () => {
    expect(await verifyCatalogReading(session(entries[0].content, { continuation }),
      { loadContents: async () => { throw new Error('offline'); } })).toBe(false);
  });

  it('refuses multi-source readings', async () => {
    const multi = compileSession({
      title: 'Two', visualConfig: { visualMode: 'off' },
      sources: [{ id: 'a', data: entries[0].content }, { id: 'b', data: entries[1].content }],
      continuation
    });
    expect(await verifyCatalogReading(multi, { loadContents: load })).toBe(false);
  });
});
