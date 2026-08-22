/**
 * The partition, before anything is drawn.
 *
 * The editor is the largest and riskiest piece of the strengthening brief, and
 * its core is pure: a record and a gesture in, a record out. Settling it here
 * means the view is a rendering problem rather than a physics problem — which
 * is the same order that made the local-work record go cleanly.
 *
 * TWO OF THESE CAME FROM A REAL FILE. A book of poems, CRLF, 105 blocks,
 * titles in mixed case. Every fixture in this tree is LF and every one of them
 * agreed with a separator that finds nothing in that file.
 */
import { describe, expect, it } from 'vitest';
import { draftLocalWork, localWorkParts } from './local-works.js';
import {
    describeMagnets,
    joinAt,
    nearestSnap,
    layoutPartition,
    partitionByMagnet,
    placeJoint,
    relabel,
    slideJoint,
    snapPoints
} from './partition.js';
import { countWords } from './chunker.js';

/** Titled blocks, CRLF, as a reader's own file actually arrives. */
const POEMS = [
    'Pyramid', 'a stone set on a stone', 'and the light going',
    '', 'Sycamore', 'the bark peels in strips', 'like a letter opened twice',
    '', 'Railroad', 'sleepers under the rain', 'counting themselves away'
].join('\r\n');

const work = (text = POEMS) => draftLocalWork({ text, sourceName: 'poems.txt' });
const shape = record => localWorkParts(record).map(part => part.label);
const words = record => localWorkParts(record).map(part => countWords(part.content));

describe('what counts as a joint', () => {
    it('sees a blank line in a CRLF file', () => {
        // The separator was `\n[ \t]*\n`, which cannot match `\r\n\r\n` — the
        // carriage return sits between the newlines and is neither space nor
        // tab. It reported zero breaks on a book of 105 poems.
        expect(describeMagnets(POEMS).title).toBe(2);
        expect(snapPoints(POEMS).every(point => point.offset > 0)).toBe(true);
    });

    it('prefers a title over the bare break it sits on', () => {
        for (const point of snapPoints(POEMS)) expect(point.kind).toBe('title');
        // A line that ends in a full stop is prose, not a name.
        const prose = ['One.', 'two three', '', 'A sentence that ends properly.', 'more'].join('\r\n');
        expect(snapPoints(prose).map(p => p.kind)).toEqual(['paragraph']);
    });

    it('offers a sentence start only inside a paragraph too big to be a part', () => {
        const long = `${'word '.repeat(80)}. ${'word '.repeat(80)}. Next one here.`;
        expect(describeMagnets(long, { rungWords: 10_000 }).sentence).toBeUndefined();
        expect(describeMagnets(long, { rungWords: 10 }).sentence).toBeGreaterThan(0);
    });

    it('resolves a pointer to the joint it meant, or to nothing', () => {
        const [first] = snapPoints(POEMS);
        expect(nearestSnap(POEMS, first.offset + 3, { within: 20 }).offset).toBe(first.offset);
        expect(nearestSnap(POEMS, first.offset + 3, { within: 1 })).toBeNull();
    });
});

describe('the three verbs', () => {
    it('place makes one part into two, and the new part reads its opening', () => {
        const [first] = snapPoints(POEMS);
        const cut = placeJoint(work(), first.offset);
        expect(shape(cut)).toEqual(['Reading 1', 'Sycamore']);
        expect(words(cut).every(count => count > 0)).toBe(true);
    });

    it('slide moves ONE number, and two parts change together', () => {
        const points = snapPoints(POEMS);
        const cut = placeJoint(work(), points[0].offset);
        const before = words(cut);
        const slid = slideJoint(cut, 1, points[1].offset);
        const after = words(slid);
        // The start of one part IS the end of the other: what the first part
        // gains, the second loses, and nothing else moves.
        expect(after[0]).toBeGreaterThan(before[0]);
        expect(after[1]).toBeLessThan(before[1]);
        expect(after[0] + after[1]).toBe(before[0] + before[1]);
    });

    it('join removes a joint and keeps the upper name', () => {
        // A reader joining downward is extending the part they were reading,
        // not starting a new one.
        const cut = placeJoint(work(), snapPoints(POEMS)[0].offset);
        const joined = joinAt(cut, 1);
        expect(shape(joined)).toEqual(['Reading 1']);
        expect(countWords(joined.text)).toBe(countWords(work().text));
    });

    it('refuses a gesture that would leave a part without words', () => {
        const record = work();
        // Inside the first word, and past both ends: each returns the record
        // unchanged rather than throwing, because the surface asks on hover.
        expect(placeJoint(record, 2)).toBe(record);
        expect(placeJoint(record, 0)).toBe(record);
        expect(placeJoint(record, record.text.length)).toBe(record);
        expect(slideJoint(record, 9, 10)).toBe(record);
    });
});

describe('names', () => {
    it('never rewrites a label a reader typed', () => {
        const points = snapPoints(POEMS);
        let record = placeJoint(work(), points[0].offset);
        record = relabel(record, 0, 'The stone one');
        record = placeJoint(record, points[1].offset);
        // A renumber ran; the typed name did not move, and the magnet names
        // did not become "Reading 2" either — those words describe the words
        // under them, which did not move when a joint above did.
        expect(shape(record)[0]).toBe('The stone one');
        expect(shape(record)).toContain('Sycamore');
    });

    it('renumbers only the counted form', () => {
        const points = snapPoints(POEMS);
        const cut = placeJoint(placeJoint(work(), points[1].offset), points[0].offset);
        const counted = shape(cut).filter(label => /^Reading \d+$/u.test(label));
        expect(counted).toEqual(['Reading 1']);
    });
});

describe('cutting at every magnet', () => {
    it('turns a book of titled poems into its poems', () => {
        const cut = partitionByMagnet(work(), 'title');
        expect(shape(cut)).toEqual(['Pyramid', 'Sycamore', 'Railroad']);
        // Every word survives the partition, once.
        expect(words(cut).reduce((a, b) => a + b, 0)).toBe(countWords(POEMS));
    });

    it('is the gesture a reader would otherwise make a hundred times', () => {
        // The divider wants ~12,000 words before it divides at all, and lyric
        // verse is far below that: the honest draft is one part, and a hundred
        // manual cuts is transcription rather than review.
        const draft = work();
        expect(draft.labels).toHaveLength(1);
        expect(partitionByMagnet(draft, 'title').labels.length).toBeGreaterThan(1);
    });
});

describe('what a surface is handed', () => {
    it('gives every part its blocks, and only the joints a reader may place', () => {
        const cut = placeJoint(work(), snapPoints(POEMS)[0].offset);
        const [first, second] = layoutPartition(cut);

        // The head of a part is not a joint: there is already one there.
        expect(first.blocks[0].snap).toBeNull();
        expect(second.blocks[0].snap).toBeNull();
        // And the joint that IS placed is not offered a second time.
        expect(first.blocks.every(block => block.offset < cut.cuts[1])).toBe(true);
        expect(second.blocks.map(block => block.snap)).toEqual([null, 'title']);
    });

    it('leaves the view no arithmetic to do', () => {
        const [part] = layoutPartition(work());
        const placeable = part.blocks.filter(block => block.snap);
        // The offset a block carries is the offset placeJoint wants, unchanged.
        for (const block of placeable) {
            expect(placeJoint(work(), block.offset).cuts).toContain(block.offset);
        }
        expect(placeable).toHaveLength(2);
    });

    it('carries the prose itself, split into paragraphs', () => {
        const [part] = layoutPartition(work());
        expect(part.blocks[0].paragraphs[0]).toContain('Pyramid');
        expect(part.words).toBe(countWords(POEMS));
    });
});
