/**
 * A COMPOSED WORK IS ONE READING, HOWEVER MANY PIECES BUILT IT.
 *
 * registerStarterTexts splits a starter's prose on blank lines, names the
 * pieces "Segment 1..N", and set chapterCount to how many it found. That is
 * the composition's own bookkeeping, and it reached the shelf: Creator
 * Affirmations offered itself as "16 readings", which is sixteen things a
 * reader could enter. There is one.
 *
 * The pieces are not removed — the runtime still receives every one of them
 * through getSequences. What changes is that they stop being counted as
 * readings, which is the count the Library, the parts browser, and the card's
 * verb all read from.
 */
import { describe, expect, it } from 'vitest';
import { getAllTexts, getTextById } from './library.js';

const composed = () => getAllTexts().filter(text => text.category === 'composed');

describe('composed readings keep their identity', () => {
    it('treats a composed sequence as one reader-facing reading', () => {
        const affirmations = getTextById('starter-creator-affirmations');
        expect(affirmations, 'the work is on the shelf').toBeTruthy();
        expect(affirmations.category).toBe('composed');
        expect(affirmations.chapterCount).toBe(1);
        // And says so in the Archive's word for a thing a reader enters,
        // rather than falling through to 'verse'.
        expect(affirmations.chapterNoun).toBe('reading');
    });

    it('keeps every internal segment for the runtime', () => {
        const affirmations = getTextById('starter-creator-affirmations');
        const segments = affirmations.getSequences();
        // The pieces the composition is built from are still all here.
        expect(segments.length).toBeGreaterThan(1);
        expect(affirmations.segmentCount).toBe(segments.length);
        expect(segments.every(part => typeof part.content === 'string' && part.content.trim()))
            .toBe(true);
    });

    it('does the same for every composed work, not one title', () => {
        expect(composed().length).toBeGreaterThan(1);
        for (const text of composed()) {
            expect(text.chapterCount, `${text.title} is one reading`).toBe(1);
            expect(text.segmentCount, `${text.title} keeps its segments`)
                .toBeGreaterThanOrEqual(1);
        }
    });

    it('retains the real reading count for ordinary collections', () => {
        // A found work's divisions ARE readings: entering one is entering a
        // different part of the book. Nothing here may flatten those.
        const others = getAllTexts().filter(text => text.category !== 'composed');
        const divided = others.filter(text => Number(text.chapterCount) > 1);
        expect(divided.length, 'ordinary multi-division works still exist').toBeGreaterThan(0);
        for (const text of divided) {
            expect(text.chapterCount).toBe(text.verses?.length ?? text.chapterCount);
        }
    });
});
