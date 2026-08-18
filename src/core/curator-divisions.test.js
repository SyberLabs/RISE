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

    it('says where the work begins when an edition put something first', () => {
        // Thirty-three of the ingests open on a Gutenberg header or a contents
        // page, so a curator asking blindly for division 1 reads boilerplate.
        expect(find('extended-bhagavad-gita-full').divisions.bodyFrom).toBe(2);
        expect(find('the-kalevala').divisions.bodyFrom).toBe(4);
        expect(find('okakura-book-of-tea').divisions.bodyFrom).toBeUndefined();
        expect(catalogue.filter(entry => entry.divisions?.bodyFrom).length)
            .toBeGreaterThan(20);
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
        expect(context.library.find(e => e.id === 'the-kalevala').divisions.bodyFrom).toBe(4);
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
        const { bodyFrom } = find('extended-bhagavad-gita-full').divisions;
        const [header] = (await resolveLibrarySourceIds(
            ['extended-bhagavad-gita-full#1:200'])).sources;
        const [body] = (await resolveLibrarySourceIds(
            [`extended-bhagavad-gita-full#${bodyFrom}:200`])).sources;
        expect(header.name).toContain('Front matter');
        expect(body.name).not.toContain('Front matter');
    }, 120_000);
});
