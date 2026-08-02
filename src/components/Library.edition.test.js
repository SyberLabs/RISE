/**
 * The edition statement, as a reader sees it.
 *
 * `tradition` holds the edition, and for two works it holds a sourcing
 * memo written for a provenance ledger — markdown links, scan URLs, and
 * a backticked rights basis — which the card printed verbatim because
 * escapeHtml renders markup literally rather than resolving it. A
 * 96-character URL with no break in it then pushed the Library's grid
 * wider than the viewport.
 */
import { describe, expect, it } from 'vitest';
import { contentsNoun, editionStatement } from './Library.js';

describe('an edition statement is for a reader', () => {
    const ROMANCE = 'trans. C. H. Brewitt-Taylor, Kelly & Walsh, Shanghai, 2 vols., 1925; '
        + 'scan-backed Wikisource [vol. I](https://en.wikisource.org/wiki/File:'
        + 'Romance_of_the_Three_Kingdoms_-_tr._Brewitt-Taylor_-_Volume_1.djvu) and '
        + '[vol. II](https://en.wikisource.org/wiki/File:'
        + 'Romance_of_the_Three_Kingdoms_-_tr._Brewitt-Taylor_-_Volume_2.djvu); `author-death-70`';

    it('keeps the link text and drops the URL', () => {
        const shown = editionStatement(ROMANCE);
        expect(shown).toContain('vol. I');
        expect(shown).toContain('vol. II');
        expect(shown).not.toContain('http');
        expect(shown).not.toContain('.djvu');
    });

    it('keeps every credit the edition owes', () => {
        // §"every text says which edition you are reading". The
        // translator, publisher and year are the point of the field and
        // none of them may be lost to tidying.
        const shown = editionStatement(ROMANCE);
        expect(shown).toContain('C. H. Brewitt-Taylor');
        expect(shown).toContain('Kelly & Walsh');
        expect(shown).toContain('1925');
    });

    it('drops the rights basis, which is not a credit', () => {
        // `author-death-70` is machine vocabulary. Provenance holds it,
        // the invariant tests check it, and a reader has no use for it.
        expect(editionStatement(ROMANCE)).not.toContain('author-death-70');
        expect(editionStatement(ROMANCE)).not.toContain('`');
    });

    it('leaves a clean statement exactly as written', () => {
        // Eighty of eighty-eight works are already right. Tidying must
        // be a no-op for them or it is rewriting the catalog.
        for (const clean of [
            'trans. Andrew Lang, Walter Leaf, and Ernest Myers, 1883',
            'trans. Bayard Taylor, 2 vols., 1870–71; Boston/New York Houghton Mifflin reissue, 1912',
            'trans. Samuel Butler, Longmans, Green, 1900'
        ]) {
            expect(editionStatement(clean)).toBe(clean);
        }
    });

    it('strips a bare URL that has no link text to keep', () => {
        expect(editionStatement('ed. Someone, 1900; https://example.org/scan.djvu'))
            .toBe('ed. Someone, 1900');
    });

    it('survives nothing at all', () => {
        expect(editionStatement(null)).toBe('');
        expect(editionStatement(undefined)).toBe('');
        expect(editionStatement('')).toBe('');
    });

    it('shortens the two memos substantially', () => {
        expect(editionStatement(ROMANCE).length).toBeLessThan(ROMANCE.length / 2);
    });
});

describe('a contents sheet opens for every work on the shelf', () => {
    /**
     * `divisions.noun` is null for a titled scheme, deliberately — the
     * divider will not invent "Chapter" for a work that never said it.
     * The sheet called `.toLowerCase()` on it and threw, so ELEVEN works
     * could not be opened at all and a reader got nothing:
     *
     *   [Library] Could not open work: ross-pure-design
     *   TypeError: Cannot read properties of null (reading 'toLowerCase')
     *
     * Nothing caught it because nothing had ever asked a titled work for
     * its contents. This asks all of them.
     */
    it('names the units of a counting scheme in the work\u2019s own word', () => {
        expect(contentsNoun({ noun: 'Book' }))
            .toEqual({ one: 'book', many: 'books', find: 'Find a book…' });
        expect(contentsNoun({ noun: 'Reading' }).many).toBe('readings');
    });

    it('invents no noun for a titled scheme', () => {
        // "11 chapters" would claim something false about Ross. "11
        // entries" counts rows in a list this Archive built and claims
        // nothing about his structure.
        for (const divisions of [{ noun: null }, { noun: '' }, { noun: '  ' }, {}, null]) {
            const noun = contentsNoun(divisions);
            expect(noun.many).toBe('entries');
            expect(noun.find).toBe('Find a title…');
            expect(noun.one).toBe('entry');
        }
    });

    it('survives every divided work in the Archive', async () => {
        const { ingestedArchiveTexts } = await import('../content/archive/index.js');
        const bare = [];
        for (const work of ingestedArchiveTexts()) {
            const divisions = await work.getDivisions();
            if (!divisions?.divided) continue;
            const noun = contentsNoun(divisions);
            // Every field the sheet interpolates must be a usable string.
            for (const key of ['one', 'many', 'find']) {
                expect(typeof noun[key], `${work.id}.${key}`).toBe('string');
                expect(noun[key].length, `${work.id}.${key} is empty`).toBeGreaterThan(0);
            }
            if (!divisions.noun) bare.push(work.id);
        }
        // Recorded rather than asserted away: these are the titled works,
        // and a shrinking list would mean the divider had started
        // inventing nouns again.
        expect(bare.length).toBeGreaterThan(5);
        expect(bare).toContain('the-storm-of-steel');
        expect(bare).toContain('ross-pure-design');
    }, 240000);
});
