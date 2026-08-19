import { describe, expect, it } from 'vitest';
import { LIBRARY_TEXTS } from '../../content/library.js';
import { ArchiveTextProvider } from './archive.js';

describe('ArchiveTextProvider', () => {
    it('mirrors the authoritative Library registry without eagerly loading books', async () => {
        const provider = new ArchiveTextProvider();
        const items = await provider.list({ limit: 250 });

        expect(items).toHaveLength(LIBRARY_TEXTS.length);
        expect(items.every(item => item.data === null)).toBe(true);
        expect(provider.getFacets().shelves.every(shelf => shelf.count > 0)).toBe(true);

        const ingested = items.find(item => item.metadata.rightsBasis);
        expect(ingested).toMatchObject({
            providerId: 'library-archive',
            type: 'text',
            metadata: {
                shelf: expect.any(String),
                holdings: expect.any(String),
                rightsBasis: expect.any(String)
            }
        });
    });

    it('searches current registry metadata and respects the two-axis shelf model', async () => {
        const provider = new ArchiveTextProvider();
        const joyce = await provider.search('Joyce');
        const eastern = await provider.list({ category: 'eastern', limit: 250 });

        expect(joyce.some(item => item.name === 'Ulysses')).toBe(true);
        expect(eastern.length).toBeGreaterThan(0);
        expect(eastern.every(item => {
            const text = LIBRARY_TEXTS.find(record => record.id === item.id);
            return item.metadata.shelfId === 'eastern'
                || text?.traditionShelf === 'eastern'
                || text?.subjectShelves?.includes('eastern');
        })).toBe(true);
    });

    it('loads a selected work lazily through its registry sequence contract', async () => {
        const provider = new ArchiveTextProvider();
        const starter = LIBRARY_TEXTS.find(text => text.provider === 'starters');
        const item = await provider.get(starter.id);

        expect(item.data.length).toBeGreaterThan(0);
        expect(item.data.every(section => typeof section === 'string')).toBe(true);
        expect(item.metadata.author).toBe(starter.author);
    });

    it('exposes the same chapter divisions as the Library and returns one stable chapter source', async () => {
        const provider = new ArchiveTextProvider();
        const workId = 'the-iliad';
        const contents = await provider.getContents(workId);
        const chapter = await provider.getEntry(workId, contents.entries[0].id);

        expect(contents).toMatchObject({ divided: true, entries: expect.any(Array) });
        expect(contents.entries.length).toBeGreaterThan(1);
        expect(chapter).toMatchObject({
            id: `${workId}::${contents.entries[0].id}`,
            type: 'text',
            providerId: 'library-archive',
            metadata: {
                parentWorkId: workId,
                divisionLabel: contents.entries[0].label
            }
        });
        expect(chapter.data).toBe(contents.entries[0].content);
    });
});
