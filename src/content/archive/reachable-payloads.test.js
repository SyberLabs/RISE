/**
 * THE CATALOGUE LINKS ONLY WHAT A READER CAN REACH.
 *
 * `WORKS` filters the withheld out at runtime, and for a long time that looked
 * like enough. It is not: a filter runs when the page runs, and the bundler
 * has already been and gone. Every entry carried `load: () => import(...)`,
 * Rollup could not prove the filter would drop it, and so it emitted a chunk
 * for all of them — including a fifteen-megabyte Mahabharata that no reader
 * could open, built and deployed on every push.
 *
 *     dist/assets   100 MB → 19 MB
 *     chunks        228 → 148
 *     89% of the payload bytes on the shelf were unreachable
 *
 * So a withheld work now carries its metadata, its provenance and its stated
 * reason, and no loader. The payload stays on disk and in git, exactly as
 * ARCHIVE-CANON-SPEC §8 requires — withheld, never deleted — and a test that
 * needs one imports it directly, which is the honest line: the BUILD ships
 * what a reader can reach; a TEST reads what is on disk.
 *
 * This asserts the correspondence in both directions, because either half
 * failing is silent. A missing loader on a shelved work is a book that will
 * not open. A loader on a withheld work is eighty megabytes nobody asked for.
 */
import { describe, expect, it } from 'vitest';
import { LITERATURE_WORKS } from './literature-catalog.js';
import { LEGACY_REINGESTED_WORKS } from './legacy-catalog.js';
import { CORE_WORKS, WITHHELD_WORKS, ingestedArchiveTexts } from './index.js';

const ALL = [...CORE_WORKS, ...LEGACY_REINGESTED_WORKS, ...LITERATURE_WORKS];
const idOf = work => work.meta?.id ?? work.id ?? '';

describe('a payload is linked when a reader can reach it, and not otherwise', () => {
    it('every shelved work can open', () => {
        const shelved = new Set(ingestedArchiveTexts().map(text => text.id));
        expect(shelved.size).toBeGreaterThan(0);
        for (const work of ALL) {
            if (!shelved.has(idOf(work))) continue;
            expect(typeof work.load, `${idOf(work)} is on the shelf and has no loader`)
                .toBe('function');
        }
    });

    it('no withheld work is built', () => {
        for (const work of ALL) {
            if (!Object.hasOwn(WITHHELD_WORKS, idOf(work))) continue;
            expect(work.load, `${idOf(work)} is withheld and still links its payload`)
                .toBeUndefined();
        }
    });

    it('a withheld work keeps everything except the link', () => {
        // Withheld is not deleted. The record has to stay legible enough for a
        // future curator to act on, which is the whole reason the reason is
        // required in the first place.
        const withheld = ALL.filter(work => Object.hasOwn(WITHHELD_WORKS, idOf(work)));
        expect(withheld.length).toBeGreaterThan(50);
        for (const work of withheld) {
            expect(work.meta?.title, `${idOf(work)} lost its title`).toBeTruthy();
            expect(work.meta?.edition, `${idOf(work)} lost its edition`).toBeTruthy();
            expect(work.meta?.basis, `${idOf(work)} lost its rights basis`).toBeTruthy();
            expect(WITHHELD_WORKS[idOf(work)], `${idOf(work)} lost its reason`).toBeTruthy();
        }
    });
});
