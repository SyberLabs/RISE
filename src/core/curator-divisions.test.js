/**
 * What a curator is told about a work's divisions.
 *
 * It names a division by NUMBER, so anything that mis-states the numbering
 * sends the reading somewhere else entirely — a truncated label list, or a
 * front-matter division offered as the work.
 */
import { describe, expect, it } from 'vitest';
import { buildLibraryCatalogue, validateCuratorContext } from './curator-context.js';
import { buildCuratorPrompt } from './curator-prompt.js';
import { resolveLibrarySourceIds } from './scriptorium-resolve.js';

const catalogue = buildLibraryCatalogue();
const find = id => catalogue.find(entry => entry.id === id);

describe('the catalogue names divisions a curator can choose by', () => {
    it('sends labels only where they say more than a number', () => {
        // "Essay 12" is the count and the noun again; a name is not.
        expect(find('spoon-river-anthology').divisions.labels[0]).toBe('The Hill');
        // Ovid's parts are named by the edition, so a curator can choose one.
        expect(find('metamorphoses').divisions.labels[0]).toBe('Creation of the World');
        // "Book I" is the count and the noun again, so Homer sends none.
        expect(find('the-brothers-karamazov').divisions.labels).toBeUndefined();
        expect(find('the-iliad').divisions.labels).toBeUndefined();
    });

    it('sends every label or none, so a position always names its division', () => {
        for (const entry of catalogue) {
            const { labels, count } = entry.divisions || {};
            if (!labels) continue;
            expect(labels, `${entry.id} label count`).toHaveLength(count);
            expect(labels.every(label => typeof label === 'string' && label.trim())).toBe(true);
        }
    });

    it('says where the work begins when a DISTRIBUTOR put something first', () => {
        // Only when the leading division names its distributor. Thirty-two
        // works open on something labelled "Front matter", and most of those
        // are the work: a title block, a translator's preface, Hawthorne's
        // Custom-House. See front-matter.test.js.
        // NO CANON WORK CARRIES A DISTRIBUTOR'S OPENING ANY MORE. Ovid's
        // Perseus header went with the re-sourcing; an edition that declares
        // its own parts has no boilerplate to skip past.
        for (const id of ['metamorphoses', 'the-iliad', 'paradise-lost',
            'literary-meditations', 'ulysses']) {
            expect(find(id).divisions.bodyFrom, id).toBeUndefined();
        }
        expect(catalogue.filter(entry => entry.divisions?.bodyFrom).length).toBe(0);
    });

    it('survives its own validator', () => {
        const context = validateCuratorContext({
            schema: 'rise.curator-context.v1',
            id: 'ctx',
            sources: [],
            visuals: { collections: [], engines: [] },
            audio: { soundscapes: [], tones: [], swells: [] },
            library: catalogue
        });
        expect(context.library.find(e => e.id === 'spoon-river-anthology').divisions.labels)
            .toHaveLength(246);
        expect(context.library.find(e => e.id === 'metamorphoses').divisions.labels)
            .toHaveLength(147);
    });

    it('refuses a label list that does not cover the divisions it describes', () => {
        // A short list would read as the whole scheme and send a curator past
        // the end of the work.
        expect(() => validateCuratorContext({
            schema: 'rise.curator-context.v1',
            id: 'ctx',
            sources: [],
            visuals: { collections: [], engines: [] },
            audio: { soundscapes: [], tones: [], swells: [] },
            library: [{ id: 'w', title: 'W', divisions: { count: 3, labels: ['a', 'b'] } }]
        })).toThrow(/one label per division/u);
    });

    it('teaches the curator to read both', () => {
        const prompt = buildCuratorPrompt({
            context: { schema: 'rise.curator-context.v1', constraints: { targetWords: 400 } }
        });
        expect(prompt).toMatch(/divisions\.labels/u);
        expect(prompt).toMatch(/divisions\.bodyFrom/u);
        expect(prompt).toMatch(/Never name a division below it/u);
    });
});

describe('a label names the division it is beside', () => {
    it('resolves to the work the label promised', async () => {
        const labels = find('spoon-river-anthology').divisions.labels;
        const wanted = labels.indexOf('Lucinda Matlock') + 1;
        const { sources } = await resolveLibrarySourceIds([`spoon-river-anthology#${wanted}`]);
        expect(sources[0].name).toBe('Spoon River Anthology · Lucinda Matlock');
    }, 120_000);

    it('has no distributor opening left to skip', () => {
        // Every canon work now comes from an edition that declares its own
        // parts, so none of them opens on a repository header. The rule is
        // still tested against the corpus in front-matter.test.js, where the
        // withheld payloads keep the hard cases alive.
        expect(catalogue.filter(entry => entry.divisions?.bodyFrom)).toEqual([]);
    });
});
