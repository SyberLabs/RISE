/**
 * Ingested works — the promises that must survive lazy loading.
 *
 * The metadata in index.js is a COPY of what each generated module
 * declares, kept there so a browsing reader does not download every
 * book to see a card. A copy is a second thing to keep true, and this
 * Archive has already shipped one provenance record that drifted from
 * the text it described. So the copy is checked against the source.
 */
import { describe, expect, it } from 'vitest';
import { INGESTED_META, ingestedArchiveTexts } from './index.js';
import { PD_BASIS } from '../library-constants.js';

const BASES = new Set(Object.values(PD_BASIS));

describe('ingested works', () => {
    it('declares metadata that matches each generated payload', async () => {
        // The generated module is the authority: it was written by the
        // ingest that read the artifact. If these disagree, the card is
        // lying about the book behind it.
        for (const meta of INGESTED_META) {
            const mod = await import(`./works/${meta.id}.js`);
            const key = `${meta.id.toUpperCase().replace(/-/g, '_')}_META`;
            const source = mod[key];
            expect(source, `${meta.id} exports no ${key}`).toBeTruthy();
            expect(source.title, `${meta.id} title drifted`).toBe(meta.title);
            expect(source.author, `${meta.id} author drifted`).toBe(meta.author);
            expect(source.shelf, `${meta.id} shelf drifted`).toBe(meta.shelf);
            expect(source.rights.basis, `${meta.id} rights basis drifted`).toBe(meta.basis);
            expect(source.edition.year, `${meta.id} edition year drifted`).toBe(meta.edition.year);
            expect(source.edition.translator ?? undefined,
                `${meta.id} translator drifted`).toBe(meta.edition.translator ?? undefined);
        }
    }, 60_000);

    it('carries a valid rights basis and real evidence', async () => {
        for (const meta of INGESTED_META) {
            expect(BASES.has(meta.basis), `${meta.id} has no valid basis`).toBe(true);
            const mod = await import(`./works/${meta.id}.js`);
            const source = mod[`${meta.id.toUpperCase().replace(/-/g, '_')}_META`];
            // Evidence must name the edition, which takes more words
            // than an assertion does.
            expect(source.rights.evidence.length,
                `${meta.id} evidence is too thin to be checkable`).toBeGreaterThan(80);
            // A STRUCTURED EDITION IS MANY FILES, so it records a digest for
            // each rather than one for a single download. Both shapes are the
            // same promise: this is the artifact the world served us.
            if (Array.isArray(source.source.files)) {
                expect(source.source.files.length,
                    `${meta.id} records no source files`).toBeGreaterThan(0);
                for (const entry of source.source.files) {
                    expect(entry, `${meta.id} file digest`).toMatch(/ [0-9a-f]{64}$/);
                }
            } else {
                expect(source.source.sha256, `${meta.id} records no source digest`)
                    .toMatch(/^[0-9a-f]{64}$/);
            }
        }
    }, 60_000);

    it('loads its text only when asked', async () => {
        // The registry record must be usable — title, edition, rights —
        // without the payload. That is the whole point of the split.
        for (const text of ingestedArchiveTexts()) {
            expect(text.title).toBeTruthy();
            expect(text.provenance.basis).toBeTruthy();
            expect(typeof text.getSequences).toBe('function');
        }
    });

    it('resolves sections that begin and end on the work itself', async () => {
        const texts = ingestedArchiveTexts();
        for (const text of texts) {
            const seqs = await text.getSequences();
            expect(seqs.length, `${text.id} resolved no sections`).toBeGreaterThan(0);
            for (const s of seqs) {
                // A DECLARED DIVISION MAY BE SHORT, because the edition said
                // where it ends. Ovid's Brazen Age is three lines and 120
                // characters; the 200 this asked for was only ever met
                // because the divider used to re-derive the scheme and merge
                // short episodes into their neighbours.
                //
                // Set BELOW the shortest reading on the shelf, so it fails on
                // a new stub rather than re-litigating a real short poem.
                expect(s.content.length, `${text.id}/${s.name} is suspiciously short`)
                    .toBeGreaterThan(80);
                // The dossier requires front matter, notes, and image
                // anchors to remain addressable. Only the distributor's
                // wrapper is categorically outside the edition.
                expect(s.content).not.toMatch(
                    /\*{3}\s*(START|END) OF (THE )?PROJECT GUTENBERG|Project Gutenberg License/i
                );
            }
        }
    }, 60_000);
});
