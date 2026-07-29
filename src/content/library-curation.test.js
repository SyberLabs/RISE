/**
 * The Archive's promises, enforced.
 *
 * Two of these are invariants rather than preferences: every text is
 * public domain with the basis recorded, and no work is shelved
 * somewhere the UI cannot show it. Both protect against the failure this
 * codebase is most prone to — something disappearing quietly.
 */
import { describe, expect, it } from 'vitest';
import { LIBRARY_TEXTS, LIBRARY_CATEGORIES } from './library.js';
import { ARCHIVE_CURATION, curationFor, shelfFor } from './library-curation.js';
import { PD_BASIS, RESONANCE_FUNCTIONS } from './library-constants.js';

const SHELVES = new Set(LIBRARY_CATEGORIES.map(c => c.id));
const BASES = new Set(Object.values(PD_BASIS));
const FUNCTIONS = new Set(Object.values(RESONANCE_FUNCTIONS));

describe('the Archive shelves every text it holds', () => {
    it('no text sits on a shelf the reader cannot reach', () => {
        // A category with no matching shelf renders nowhere: the text is
        // registered, counted, and invisible. That is exactly how the
        // retired `microscopy` collection hid for months.
        for (const text of LIBRARY_TEXTS) {
            expect(SHELVES.has(text.category), `'${text.id}' is on unknown shelf '${text.category}'`)
                .toBe(true);
        }
    });

    it('every shelf a work claims exists', () => {
        for (const [id, entry] of Object.entries(ARCHIVE_CURATION)) {
            expect(SHELVES.has(entry.shelf), `${id} claims unknown shelf '${entry.shelf}'`)
                .toBe(true);
        }
    });
});

describe('provenance — the public-domain invariant', () => {
    it('every curated work records why we may hold it', () => {
        // The textual analogue of curation-only for imagery: the system
        // would rather hold nothing than what it cannot justify holding.
        for (const [id, entry] of Object.entries(ARCHIVE_CURATION)) {
            expect(entry.provenance, `${id} records no provenance`).toBeTruthy();
            expect(BASES.has(entry.provenance.basis), `${id} has no valid PD basis`)
                .toBe(true);
        }
    });

    it('a translated work names its translator', () => {
        // A translation carries its own copyright. Marcus Aurelius is
        // public domain; a 2003 translation of him is not. Naming the
        // translator is what makes the basis checkable rather than
        // merely asserted.
        for (const [id, entry] of Object.entries(ARCHIVE_CURATION)) {
            if (entry.provenance.basis !== PD_BASIS.AUTHOR_70) continue;
            expect(entry.provenance.translator, `${id} claims author-death-70 without naming a translator`)
                .toBeTruthy();
        }
    });

    it('holds no text from a translation known to be in copyright', () => {
        // Four starter sequences reproduced Calvino (Weaver 1968),
        // Borges, Flusser (Roth 2011), and Klee (Moholy-Nagy 1953,
        // renewal RE090004) verbatim. They are retired, and must not
        // return by way of a later corpus import.
        const RETIRED = ['calvino', 'borges', 'flusser', 'klee-on-the-line'];
        for (const text of LIBRARY_TEXTS) {
            for (const marker of RETIRED) {
                expect(text.id.includes(marker), `'${text.id}' reproduces an in-copyright translation`)
                    .toBe(false);
            }
        }
    });
});

describe('curation is editorial, and says so', () => {
    it('every curated work explains itself in the Archive voice', () => {
        for (const [id, entry] of Object.entries(ARCHIVE_CURATION)) {
            expect(typeof entry.why, `${id} has no editorial line`).toBe('string');
            // Long enough to be a judgement rather than a label.
            expect(entry.why.length, `${id}'s line is too thin to be judgement`)
                .toBeGreaterThan(60);
        }
    });

    it('names only resonance functions that exist', () => {
        for (const [id, entry] of Object.entries(ARCHIVE_CURATION)) {
            expect(Array.isArray(entry.functions), `${id} declares no functions`).toBe(true);
            for (const fn of entry.functions) {
                expect(FUNCTIONS.has(fn), `${id} names unknown function '${fn}'`).toBe(true);
            }
        }
    });

    it('rhymes point at works the Archive actually holds', () => {
        // A rhyme is what makes this an archive rather than a list. One
        // pointing at nothing is a dead end the reader discovers, not us.
        const held = new Set(LIBRARY_TEXTS.map(t => t.id));
        for (const [id, entry] of Object.entries(ARCHIVE_CURATION)) {
            for (const rhyme of entry.rhymes || []) {
                expect(held.has(rhyme), `${id} rhymes with '${rhyme}', which is not held`)
                    .toBe(true);
                expect(rhyme, `${id} rhymes with itself`).not.toBe(id);
            }
        }
    });

    it('curation reaches the registered text', () => {
        // registerText applies curation centrally so a new source cannot
        // arrive unshelved by forgetting to ask.
        const walden = LIBRARY_TEXTS.find(t => t.id === 'literary-walden');
        expect(walden.category).toBe('interior');
        expect(walden.why).toBeTruthy();
        expect(walden.provenance.basis).toBe(PD_BASIS.PRE_1930);
        expect(shelfFor('literary-walden')).toBe('interior');
        expect(curationFor('nothing-of-the-kind')).toBeNull();
    });
});

describe('the retired shelves are gone', () => {
    it('holds nothing under declassified or research', () => {
        // Gateway Process and an ArXiv abstract feed were the clearest
        // instances of a register the system has outgrown.
        for (const text of LIBRARY_TEXTS) {
            expect(['declassified', 'research']).not.toContain(text.category);
            expect(text.id.startsWith('cia-'), `'${text.id}' is a retired document`).toBe(false);
            expect(text.id.startsWith('arxiv-'), `'${text.id}' is a retired feed`).toBe(false);
        }
    });
});
