/**
 * The Archive's promises, enforced.
 *
 * Two of these are invariants rather than preferences: every text is
 * public domain with the basis recorded, and no work is shelved
 * somewhere the UI cannot show it. Both protect against the failure this
 * codebase is most prone to — something disappearing quietly.
 */
import { describe, expect, it } from 'vitest';
import { LITERATURE_WORKS } from './archive/literature-catalog.js';
import { LIBRARY_TEXTS, LIBRARY_CATEGORIES } from './library.js';
import { ARCHIVE_CURATION, curationFor, shelfFor } from './library-curation.js';
import { PD_BASIS, RESONANCE_FUNCTIONS, DIVISIONS } from './library-constants.js';
import { QUARANTINED, isQuarantined } from './library-quarantine.js';

const SHELVES = new Set(LIBRARY_CATEGORIES.map(c => c.id));
const BASES = new Set(Object.values(PD_BASIS));
const FUNCTIONS = new Set(Object.values(RESONANCE_FUNCTIONS));

/**
 * The curation table is written against the whole corpus; the shelf is the
 * canon, a subset of it (ARCHIVE-CANON-SPEC). A withheld work's entry cannot
 * reach a reader, so these sweeps ask about what is served.
 */
const servedCuration = () => Object.entries(ARCHIVE_CURATION)
    .filter(([id]) => LIBRARY_TEXTS.some(text => text.id === id));

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
        for (const [id, entry] of servedCuration()) {
            expect(SHELVES.has(entry.shelf), `${id} claims unknown shelf '${entry.shelf}'`)
                .toBe(true);
        }
    });
});

describe('divisions within a shelf', () => {
    const DIV_IDS = new Set(DIVISIONS.map(d => d.id));

    it('every curated work is placed within its canon', () => {
        // A work with no division falls into the panel's "Other" bucket
        // — visible, but filed under nothing a reader recognises. The
        // same standard the shelves themselves are held to.
        for (const [id, entry] of servedCuration()) {
            expect(DIV_IDS.has(entry.division), `${id} has no usable division '${entry.division}'`)
                .toBe(true);
        }
    });

    it('the division reaches the registered text', () => {
        const tao = LIBRARY_TEXTS.find(t => t.id === 'sacred-tao-te-ching');
        expect(tao.division).toBe('classical');
        const dhammapada = LIBRARY_TEXTS.find(t => t.id === 'extended-dhammapada-full');
        expect(dhammapada.division).toBe('classical');
    });

    it('no shelf is a single division alone, except where that is true', () => {
        // Indigenous Traditions is deliberately all-classical: four
        // collected oral corpora, with no literature written in their
        // light and no esoteric commentary that the Archive holds. The
        // panel renders a lone division as a flat list rather than
        // labelling the obvious, so this records the intent.
        const byShelf = {};
        for (const entry of Object.values(ARCHIVE_CURATION)) {
            (byShelf[entry.shelf] ||= new Set()).add(entry.division);
        }
        expect([...byShelf.western].sort())
            .toEqual(['classical', 'esoteric', 'imaginative', 'literary']);
        expect([...byShelf.eastern].sort())
            .toEqual(['classical', 'esoteric', 'imaginative', 'literary']);
        expect([...byShelf.indigenous]).toEqual(['classical']);
    });
});

describe('provenance — the public-domain invariant', () => {
    it('every curated work records why we may hold it', () => {
        // The textual analogue of curation-only for imagery: the system
        // would rather hold nothing than what it cannot justify holding.
        for (const [id, entry] of servedCuration()) {
            expect(entry.provenance, `${id} records no provenance`).toBeTruthy();
            expect(BASES.has(entry.provenance.basis), `${id} has no valid PD basis`)
                .toBe(true);
        }
    });

    it('a work dated only by a death names whose death it is', () => {
        // A translation carries its own copyright. Marcus Aurelius is
        // public domain; a 2003 translation of him is not. So when the
        // basis is a death date, the record must say WHOSE — the
        // translator's where one exists, the author's where the work
        // was written in English.
        //
        // Both are legitimate: Crane wrote Line and Form himself and
        // died in 1915, so there is no translator to name and demanding
        // one would be asking for a fiction. What must never happen is
        // a death-dated basis with nobody attached to it.
        for (const [id, entry] of servedCuration()) {
            if (entry.provenance.basis !== PD_BASIS.AUTHOR_70) continue;
            // The author is looked up from the CATALOG rather than the
            // shelf. A withheld work still has provenance to answer for
            // — withholding a bad edition of Hamlet does not stop
            // Shakespeare having died in 1616 — and resolving this
            // against the shelf alone made the invariant collapse the
            // moment anything was held back.
            const named = entry.provenance.translator
                || LIBRARY_TEXTS.find(t => t.id === id)?.author
                || LITERATURE_WORKS.find(w => w.meta.id === id)?.meta?.author;
            expect(named, `${id} claims author-death-70 with no person named`).toBeTruthy();
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
        for (const [id, entry] of servedCuration()) {
            expect(typeof entry.why, `${id} has no editorial line`).toBe('string');
            // Long enough to be a judgement rather than a label.
            expect(entry.why.length, `${id}'s line is too thin to be judgement`)
                .toBeGreaterThan(60);
        }
    });

    it('names only resonance functions that exist', () => {
        for (const [id, entry] of servedCuration()) {
            expect(Array.isArray(entry.functions), `${id} declares no functions`).toBe(true);
            for (const fn of entry.functions) {
                expect(FUNCTIONS.has(fn), `${id} names unknown function '${fn}'`).toBe(true);
            }
        }
    });

    it('rhymes point at works the Archive actually holds', () => {
        // A rhyme is what makes this an archive rather than a list. One
        // pointing at nothing is a dead end the reader discovers, not us.
        // Read from the REGISTERED text rather than the table: curationFor
        // drops a rhyme pointing at a withheld work as it registers, so this
        // asks what a reader can actually follow.
        const held = new Set(LIBRARY_TEXTS.map(t => t.id));
        for (const entry of LIBRARY_TEXTS) {
            const id = entry.id;
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
        expect(walden.category).toBe('western');
        expect(walden.why).toBeTruthy();
        expect(walden.provenance.basis).toBe(PD_BASIS.PRE_1930);
        expect(shelfFor('literary-walden')).toBe('western');
        expect(curationFor('nothing-of-the-kind')).toBeNull();
    });
});

describe('quarantine — works withheld until rights are established', () => {
    it('no quarantined work reaches a reader', () => {
        // Enforced at registerText, which is the only path into the
        // Archive. A render-time filter would leave the text reachable
        // by anything that walked LIBRARY_TEXTS directly.
        for (const id of Object.keys(QUARANTINED)) {
            expect(LIBRARY_TEXTS.some(t => t.id === id), `'${id}' is quarantined but still registered`)
                .toBe(false);
        }
    });

    it('a quarantined work carries evidence and a recovery path', () => {
        // The quarantine is a record, not a bin. Each entry says what
        // was CLAIMED, what the source actually SAYS, and what would
        // clear it — that difference is the finding.
        for (const [id, entry] of Object.entries(QUARANTINED)) {
            expect(entry.claimed, `${id} does not record what was claimed`).toBeTruthy();
            expect(entry.actual, `${id} does not record what the source says`).toBeTruthy();
            expect(entry.evidence.length, `${id} has no real evidence`).toBeGreaterThan(40);
            expect(entry.recovery.length, `${id} has no recovery path`).toBeGreaterThan(20);
        }
    });

    it('curation makes no claim about a withheld work', () => {
        // A `why` for a text nobody can read is a claim we are not
        // entitled to make, and it would quietly re-enter if the
        // quarantine were lifted without re-checking provenance.
        for (const id of Object.keys(ARCHIVE_CURATION)) {
            expect(isQuarantined(id), `'${id}' is curated but withheld`).toBe(false);
        }
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
