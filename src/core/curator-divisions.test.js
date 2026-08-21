/**
 * What a curator is told about a work's divisions.
 *
 * It names a division by NUMBER, so anything that mis-states the numbering
 * sends the reading somewhere else entirely — a truncated label list, or a
 * front-matter division offered as the work.
 */
import { describe, expect, it } from 'vitest';
import {
    CURATOR_CONTEXT_LIMITS,
    buildLibraryCatalogue,
    validateCuratorContext
} from './curator-context.js';
import { buildCuratorPrompt } from './curator-prompt.js';
import { resolveLibrarySourceIds } from './scriptorium-resolve.js';
import { countWords } from './chunker.js';
import { ingestedArchiveTexts } from '../content/archive/index.js';
import DIVISION_INDEX from '../content/archive/division-index.json';
import WITHHELD_INDEX from '../content/archive/division-index.withheld.json';

const catalogue = buildLibraryCatalogue();
const find = id => catalogue.find(entry => entry.id === id);

describe('the catalogue names divisions a curator can choose by', () => {
    it('sends labels for every scheme the author wrote', () => {
        // "Essay 12" is the count and the noun again; a name is not.
        expect(find('spoon-river-anthology').divisions.labels[0]).toBe('The Hill');
        // Ovid's parts are named by the edition, so a curator can choose one.
        expect(find('metamorphoses').divisions.labels[0]).toBe('Book I · Creation of the World');
        // The Analects names its books — "Book I: Hsio R" — so all twenty ride.
        expect(find('confucius-analects').divisions.labels).toHaveLength(20);
        expect(find('the-brothers-karamazov').divisions.labels).toHaveLength(96);
        expect(find('the-iliad').divisions.labels).toHaveLength(24);
    });

    it('sends a bare ordinal too, because it is the WORK\'S number', () => {
        // Milton's parts are "Book I" through "Book XII", which was read as
        // the count and the noun restated and sent as nothing at all. It is
        // not restated: a work's own number is exactly what its position in
        // the array is NOT — Dante's Purgatorio Canto I is division 37 — and
        // a curator handed no labels can only count blind.
        expect(find('paradise-lost').divisions.labels).toEqual([
            'Book I', 'Book II', 'Book III', 'Book IV', 'Book V', 'Book VI',
            'Book VII', 'Book VIII', 'Book IX', 'Book X', 'Book XI', 'Book XII'
        ]);
        expect(find('literary-meditations').divisions.labels).toHaveLength(12);
        expect(find('ulysses').divisions.labels[0]).toBe('Part I · Chapter 1');
        // Every served work now names its divisions, so no catalogue entry
        // asks a model to address one by counting.
        expect(catalogue.filter(entry => !entry.divisions?.labels)).toEqual([]);
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

/**
 * ONE GENERATED INDEX.
 *
 * The per-division word counts the gate needs to measure `work#12` against a
 * reader's length lived for a while in a sibling `division-words.json`,
 * written by a second script because the two files could not be regenerated
 * in one change. They can be, so there is one file: two artifacts of one
 * `divideSections` pass could disagree, and a re-ingest that updated only one
 * of them would silently mis-charge every extent in the work.
 *
 * What is left inside the one file is a total beside the parts that make it.
 * That is still two statements of one fact, so it is still asserted.
 */
describe('what a division costs is stated once and agrees everywhere', () => {
    it('states a total its own parts add up to', () => {
        // Both halves of the record. The index is split by shelf state so the
        // eighty withheld works stop riding into a reader's bundle, and a
        // partition is not an excuse to stop checking one side of it.
        for (const [id, entry] of Object.entries({ ...DIVISION_INDEX, ...WITHHELD_INDEX })) {
            const words = entry.divisionWords;
            expect(words, `${id} ships no per-division words`).toBeInstanceOf(Array);
            expect(words, `${id} division count`).toHaveLength(entry.count);
            expect(words.reduce((sum, n) => sum + n, 0), `${id} total`).toBe(entry.words);
        }
    });

    it('states the length the resolver will actually read', async () => {
        // A catalogue number the resolver disagrees with is worse than no
        // number: the gate would admit against one length and read another.
        let checked = 0;
        for (const work of ingestedArchiveTexts()) {
            const shipped = find(work.id)?.divisions?.words;
            expect(shipped, `${work.id} is catalogued without division lengths`).toBeTruthy();
            const scheme = await work.getDivisions();
            const entries = Array.isArray(scheme?.entries) ? scheme.entries : [];
            expect(shipped, `${work.id} division count`).toHaveLength(entries.length);
            entries.forEach((entry, index) => {
                expect(shipped[index], `${work.id}#${index + 1}`)
                    .toBe(countWords(String(entry.content || '').trim()));
            });
            checked += entries.length;
        }
        expect(checked).toBeGreaterThan(900);
    }, 300_000);
});

/**
 * WHAT THE LABEL SAYS, not how many labels there are.
 *
 * Two guards already stood here and neither could see this: divisions.test.js
 * compares count, noun, reason and authored, and structured-provenance.test.js
 * compares `labels.length`. Both agreed with each other and with the artifact
 * while five of the fifteen served works shipped labels the divider no longer
 * produces — Karamazov's ninety-six read "I Fyodor Pavlovitch Karamazov" where
 * the edition says "Book I · Chapter I: Fyodor Pavlovitch Karamazov", so the
 * model was told the chapters carry no book number and the Grand Inquisitor
 * could not be found from the labels alone.
 *
 * The input that fails this test is a stale division-index.json, which is the
 * artifact this whole room reads.
 */
describe('the catalogue says what the divider says', () => {
    it('ships the divider\'s own label for every division of every work', async () => {
        let compared = 0;
        for (const work of ingestedArchiveTexts()) {
            const shipped = find(work.id)?.divisions?.labels;
            expect(shipped, `${work.id} is catalogued without labels`).toBeTruthy();
            const scheme = await work.getDivisions();
            const entries = Array.isArray(scheme?.entries) ? scheme.entries : [];
            expect(shipped, `${work.id} label count`).toHaveLength(entries.length);
            entries.forEach((entry, index) => {
                expect(shipped[index], `${work.id}#${index + 1}`)
                    .toBe(String(entry.label || '').trim());
            });
            compared += entries.length;
        }
        expect(compared).toBeGreaterThan(900);
    }, 300_000);

    it('ships them uncut, and within the one bound that is left', () => {
        // A 60-character cap in the builder cut one label in four of Lyrical
        // Ballads mid-word, and a second cap at 80 in the catalogue re-cut
        // what it was handed. A shortened label reads as the edition's own
        // title. The validator's bound on catalogue text is the only one
        // left, and a work that breaches it must fail here rather than
        // refuse the whole context in front of a reader.
        for (const entry of catalogue) {
            for (const label of entry.divisions?.labels || []) {
                expect(label.length, `${entry.id}: ${label}`)
                    .toBeLessThanOrEqual(CURATOR_CONTEXT_LIMITS.maxDescriptionLength);
                expect(label.endsWith('…'), `${entry.id}: ${label}`).toBe(false);
            }
        }
        expect(find('lyrical-ballads').divisions.labels
            .some(label => label.length > 60)).toBe(true);
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
