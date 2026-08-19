/**
 * Which leading divisions are the work, and which are its distributor.
 *
 * `divideSections` labels any preamble over two hundred words "Front matter",
 * so the label alone cannot decide. Reading it as "not the work" told a
 * curator to skip Hawthorne's Custom-House and nine tenths of the Shahnama.
 */
import { describe, expect, it } from 'vitest';
import { firstBodyOrdinal } from './divisions.js';
import { ingestedArchiveTexts } from './index.js';

const entry = (label, content) => ({ label, content, words: content.split(/\s+/).length });

describe('a label is not evidence', () => {
    it('skips a leading division that names its distributor', () => {
        expect(firstBodyOrdinal([
            entry('Front matter', 'About this digital edition This e-book comes from the online library'),
            entry('Chapter I', 'It is a truth universally acknowledged')
        ])).toBe(2);
    });

    it('keeps a leading division that is the author writing', () => {
        // Whitman's inscription and a play's dramatis personae both carry
        // this label, and both are the work.
        expect(firstBodyOrdinal([
            entry('Front matter', 'Come, said my soul, Such verses for my Body let us write'),
            entry('Part 1', 'I celebrate myself, and sing myself')
        ])).toBe(1);
    });

    it('keeps a title block, which is where a work names itself', () => {
        expect(firstBodyOrdinal([
            entry('Front matter', 'BEOWULF By Anonymous Translated by Gummere PRELUDE OF THE FOUNDER'),
            entry('Part 1', 'Lo, praise of the prowess of people-kings')
        ])).toBe(1);
    });

    it('refuses to skip most of a work, because that is a broken scheme', () => {
        // The Shahnama's headings are found so late that 1,006,053 of its
        // 1,099,111 words carry the label. Skipping to them is not a reading
        // of its front matter; it is the scheme having failed.
        const entries = Array.from({ length: 10 }, () =>
            entry('Front matter', 'Produced by Project Gutenberg distributed proofreaders'));
        entries.push(entry('Chapter I', 'the work itself'));
        expect(firstBodyOrdinal(entries)).toBe(1);
    });

    it('says the work begins at one when nothing precedes it', () => {
        expect(firstBodyOrdinal([entry('Chapter I', 'the work')])).toBe(1);
        expect(firstBodyOrdinal([])).toBe(1);
    });
});

describe('against the shelf', () => {
    it('leaves an author\'s own opening reachable', async () => {
        const works = ingestedArchiveTexts();
        const index = (await import('./division-index.json')).default;
        // Each of these opens on something the reader may well want.
        // Withheld works keep their payloads, so the index still describes
        // them and the rule can still be checked against the hard cases.
        for (const id of ['the-scarlet-letter', 'literary-leaves-of-grass',
            'a-doll-s-house', 'beowulf', 'le-morte-darthur', 'the-iliad',
            'paradise-lost', 'literary-meditations']) {
            expect(index[id], id).toBeTruthy();
            expect(index[id].bodyFrom, `${id} must stay reachable from division 1`)
                .toBeUndefined();
        }
        // And the Shahnama is not skipped to its last fortieth.
        expect(index['the-shahnama-of-firdausi'].bodyFrom).toBe(2);
        // The canon's one distributor opening.
        expect(index.metamorphoses.bodyFrom).toBe(2);
        expect(works.length).toBeGreaterThan(0);
    });
});
