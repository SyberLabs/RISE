/**
 * The plate reader turns a pinned plate catalog into a picture work's
 * units: one per plate, in plate order, named for the plate, holding only
 * what the catalog says of it.
 */
import { describe, expect, it } from 'vitest';
import { readPlates } from './plates.js';

const CATALOG = JSON.stringify({
    plates: [
        { plate: 1, title: 'Phaeodaria', genus: null, organisms: ['Aulosphaera elegantissima, shell', 'Circoporus sexfurcus'], note: null },
        { plate: 2, title: 'Discomedusae', genus: 'Aurelia', organisms: [], note: 'Haeckel named D. annasethe after his wife.' }
    ]
});

describe('readPlates', () => {
    it('makes one unit per plate, its title line, the plate sentence, then its organisms one to a line', () => {
        const read = readPlates(CATALOG, { book: 'Kunstformen der Natur', year: 1904 });
        expect(read.parts.map(part => part.name)).toEqual(['Tafel 1 · Phaeodaria', 'Tafel 2 · Discomedusae']);
        expect(read.parts[0].content).toBe([
            'Tafel 1 · Phaeodaria',
            'Plate 1 of Kunstformen der Natur, 1904.',
            'Aulosphaera elegantissima, shell\nCircoporus sexfurcus'
        ].join('\n\n'));
        expect(read.parts[1].content).toBe([
            'Tafel 2 · Discomedusae · Aurelia',
            'Plate 2 of Kunstformen der Natur, 1904.',
            'Haeckel named D. annasethe after his wife.'
        ].join('\n\n'));
        expect(read.parts.every(part => part.verse === false)).toBe(true);
    });

    it('accounts every catalog word it carries, and drops none', () => {
        const read = readPlates(CATALOG, { book: 'Kunstformen der Natur', year: 1904 });
        expect(read.sourceWords).toBeGreaterThan(0);
        expect(read.importedWords).toBe(read.sourceWords);
        expect(read.dropped).toEqual({});
        expect(read.groups).toEqual([]);
    });

    it('refuses a catalog whose plates are not numbered 1 to n in order', () => {
        const gap = JSON.stringify({ plates: [{ plate: 2, title: 'Discomedusae', organisms: [], note: null }] });
        expect(() => readPlates(gap, { book: 'Kunstformen der Natur', year: 1904 })).toThrow(/plate 1/u);
    });
});
