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
        expect(find('the-storm-of-steel').divisions.labels[0]).toBe('Orainville (1/4)');
        expect(find('literary-meditations').divisions.labels[0]).toBe('Opening (1/2)');
        // "Essay 12" is the count and the noun again, so Montaigne sends none.
        expect(find('montaigne-essays').divisions.labels).toBeUndefined();
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
        // Ovid arrives through Perseus, whose repository header opens the file.
        expect(find('metamorphoses').divisions.bodyFrom).toBe(2);

        // The work's own opening is never skipped: a title block, a
        // translator's preface and a play's dramatis personae all carry the
        // label "Front matter". See front-matter.test.js.
        expect(find('the-iliad').divisions.bodyFrom).toBeUndefined();
        expect(find('paradise-lost').divisions.bodyFrom).toBeUndefined();
        expect(find('literary-meditations').divisions.bodyFrom).toBeUndefined();

        // One work in the canon carries a distributor's opening.
        expect(catalogue.filter(entry => entry.divisions?.bodyFrom).length).toBe(1);
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
        expect(context.library.find(e => e.id === 'the-storm-of-steel').divisions.labels)
            .toHaveLength(48);
        expect(context.library.find(e => e.id === 'metamorphoses').divisions.bodyFrom).toBe(2);
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
        const labels = find('the-storm-of-steel').divisions.labels;
        const wanted = labels.indexOf('Orainville (3/4)') + 1;
        const { sources } = await resolveLibrarySourceIds([`the-storm-of-steel#${wanted}`]);
        expect(sources[0].name).toBe('The Storm of Steel · Orainville (3/4)');
    }, 120_000);

    it('reads the work rather than the header when bodyFrom is followed', async () => {
        const { bodyFrom } = find('metamorphoses').divisions;
        const [header] = (await resolveLibrarySourceIds(['metamorphoses#1:200'])).sources;
        const [body] = (await resolveLibrarySourceIds(
            [`metamorphoses#${bodyFrom}:200`])).sources;
        // The skipped division names the repository rather than Ovid.
        expect(header.data).toMatch(/perseus/iu);
        expect(body.data).not.toMatch(/perseus/iu);
    }, 120_000);
});
