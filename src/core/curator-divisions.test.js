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
        expect(find('okakura-book-of-tea').divisions.labels[0])
            .toBe('II. The Schools of Tea.');
        expect(find('montaigne-essays').divisions.labels).toBeUndefined();
        expect(find('extended-bhagavad-gita-full').divisions.labels).toBeUndefined();
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
        expect(find('romance-of-the-three-kingdoms').divisions.bodyFrom).toBe(2);
        expect(find('faust').divisions.bodyFrom).toBe(2);
        expect(find('metamorphoses').divisions.bodyFrom).toBe(2);

        // The work's own opening is never skipped.
        expect(find('extended-bhagavad-gita-full').divisions.bodyFrom).toBeUndefined();
        expect(find('the-kalevala').divisions.bodyFrom).toBeUndefined();
        expect(find('okakura-book-of-tea').divisions.bodyFrom).toBeUndefined();

        // Nine in the index; the ninth is King Lear, withheld and on no shelf.
        expect(catalogue.filter(entry => entry.divisions?.bodyFrom).length).toBe(8);
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
        expect(context.library.find(e => e.id === 'okakura-book-of-tea').divisions.labels)
            .toHaveLength(6);
        expect(context.library.find(e => e.id === 'faust').divisions.bodyFrom).toBe(2);
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
        const labels = find('okakura-book-of-tea').divisions.labels;
        const wanted = labels.indexOf('IV. The Tea-Room') + 1;
        const { sources } = await resolveLibrarySourceIds([`okakura-book-of-tea#${wanted}`]);
        expect(sources[0].name).toBe('The Book of Tea · IV. The Tea-Room');
    }, 120_000);

    it('reads the work rather than the header when bodyFrom is followed', async () => {
        const { bodyFrom } = find('romance-of-the-three-kingdoms').divisions;
        const [header] = (await resolveLibrarySourceIds(
            ['romance-of-the-three-kingdoms#1:200'])).sources;
        const [body] = (await resolveLibrarySourceIds(
            [`romance-of-the-three-kingdoms#${bodyFrom}:200`])).sources;
        // The skipped division is a digital library's export note.
        expect(header.data).toMatch(/digital edition|online library/iu);
        expect(body.data).not.toMatch(/digital edition|online library/iu);
    }, 120_000);
});
