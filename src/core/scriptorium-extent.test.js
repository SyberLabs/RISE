/**
 * Reading part of a real work from the real archive.
 *
 * library-extent.test.js holds the cutting to its rules on synthetic text.
 * This asks the actual library for a division and for a division's opening,
 * because the shape of the division scheme is the thing that would drift.
 */
import { describe, expect, it } from 'vitest';
import { resolveLibrarySourceIds } from './scriptorium-resolve.js';
import { ingestedArchiveTexts } from '../content/archive/index.js';

const WORK = 'middlemarch';

describe('a movement may read part of a work', () => {
    it('still reads a whole work when the id names no extent', async () => {
        const meta = ingestedArchiveTexts().find(work => work.id === WORK);
        const { sources, missing, refused } = await resolveLibrarySourceIds([WORK]);
        expect({ missing, refused }).toEqual({ missing: [], refused: [] });
        expect(sources[0].name).toBe(meta.title);
        expect(sources[0].words).toBe(meta.wordCount);
    }, 120_000);

    it('reads one named division, and says which', async () => {
        const { sources, missing, refused } = await resolveLibrarySourceIds([`${WORK}#2`]);
        expect({ missing, refused }).toEqual({ missing: [], refused: [] });
        const [source] = sources;
        expect(source.id).toBe(`${WORK}#2`);
        expect(source.name).toContain('·');
        expect(source.name).toMatch(/II$/u);
        expect(source.metadata).toMatchObject({ workId: WORK, division: 2 });
        expect(source.words).toBeGreaterThan(0);
        expect(source.data.length).toBeGreaterThan(0);
    }, 120_000);

    it('reads a division opening at about the asked-for length', async () => {
        const [whole] = (await resolveLibrarySourceIds([`${WORK}#2`])).sources;
        const [opening] = (await resolveLibrarySourceIds([`${WORK}#2:200`])).sources;

        expect(opening.words).toBeLessThan(whole.words);
        expect(opening.words).toBeGreaterThanOrEqual(40);
        expect(opening.words).toBeLessThanOrEqual(320);
        // It is the opening, so the division begins with it.
        expect(whole.data.startsWith(opening.data)).toBe(true);
        expect(opening.name).toMatch(/, opening$/u);
        expect(opening.metadata.opening).toBe(true);
        // And the words it reports are the words it carries.
        expect(opening.data.split(/\s+/u).filter(Boolean)).toHaveLength(opening.words);
    }, 120_000);

    it('refuses a division the work does not have rather than nearing it', async () => {
        const { sources, refused } = await resolveLibrarySourceIds([`${WORK}#99999`]);
        expect(sources).toEqual([]);
        expect(refused).toEqual([`${WORK}#99999`]);
    }, 120_000);

    it('reports a work it does not hold as missing, extent or not', async () => {
        const { missing } = await resolveLibrarySourceIds(['no-such-work#3:200']);
        expect(missing).toEqual(['no-such-work#3:200']);
    }, 120_000);
});

describe('an ordinal is a position, not a field', () => {
    // About half the library's schemes carry no `ordinal` on their entries,
    // and one begins at two. Reading that field refused a division most works
    // have; the count the model is given is the entry array's length.
    it('resolves division one of a scheme whose entries carry no ordinal', async () => {
        const { sources, refused } = await resolveLibrarySourceIds(['metamorphoses#1']);
        expect(refused).toEqual([]);
        expect(sources[0].words).toBeGreaterThan(0);
        // The scheme's own label names it, rather than a number we invented.
        expect(sources[0].name).toBe('Metamorphoses · Book I · Creation of the World');
    }, 120_000);

    it('resolves every division the catalogue promises, across the library', async () => {
        const works = ingestedArchiveTexts();
        const ids = works.map(work => `${work.id}#1:200`);
        const { sources, missing, refused } = await resolveLibrarySourceIds(ids);
        expect(missing).toEqual([]);
        expect(refused).toEqual([]);
        expect(sources).toHaveLength(works.length);
        for (const source of sources) {
            // The floor governs CUTTING an opening. A division shorter than it
            // is read whole, because it is a whole division.
            expect(source.words).toBeGreaterThan(0);
            // A division whose first sentence runs past the cap cannot be cut
            // shorter without breaking it, so the cap yields to the boundary.
            expect(source.words).toBeLessThanOrEqual(1_000);
            expect(source.data.trim().length).toBeGreaterThan(0);
            expect(source.name).toContain('·');
        }
    }, 300_000);
});

describe('a reading carries the edition’s own statement that it is verse', () => {
    /**
     * The chunker splits verse on the poet's line when it is told there is
     * one. Nothing told it: `verseLines` was only ever set by the Journey
     * path, so the Library served Tintern Abbey as prose and the phrase
     * splitter cut at Wordsworth's commas and glued the pieces across his
     * line ends — "with the length Of five long winters!", a capital mid-atom
     * where a line began.
     *
     * The knowledge existed three times over and never arrived: the edition
     * declared it, the ingest read it, and a reader-time heuristic guessed it
     * back. This carries the declaration instead (PHRASE-CHUNKING-STUDY §8).
     */
    it('sets verseLines from what the ingest read, for verse and not for prose', async () => {
        const { sources } = await resolveLibrarySourceIds([
            'lyrical-ballads#20', 'oedipus-rex', 'literary-walden#1', 'middlemarch#1'
        ]);
        const verseOf = new Map(sources.map(source => [source.id, source.verseLines]));
        // Wordsworth's blank verse, and Storr's Sophocles — whose lines live
        // two levels down inside a table cell.
        expect(verseOf.get('lyrical-ballads#20')).toBe(true);
        expect(verseOf.get('oedipus-rex')).toBe(true);
        // Thoreau quotes verse inside prose; Eliot opens on a verse epigraph.
        // Weighed in words, neither reading is verse.
        expect(verseOf.get('literary-walden#1')).toBe(false);
        expect(verseOf.get('middlemarch#1')).toBe(false);
    });
});
