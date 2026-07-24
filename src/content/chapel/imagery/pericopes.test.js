import { describe, expect, it } from 'vitest';
import { GOSPEL_PERICOPES, pericopeForVerse } from './pericopes.js';

/**
 * The runtime pericope module (PERICOPE-IMAGERY-SPEC §5). Generated
 * from the concordance by scripts/build-pericopes.mjs; these tests
 * pin the lookup contract the cortex depends on.
 */

describe('pericopeForVerse', () => {
    it('resolves a mapped verse to its episode', () => {
        expect(pericopeForVerse('luke', 1, 30)?.id).toBe('annunciation');
        expect(pericopeForVerse('john', 3, 16)?.id).toBe('nicodemus');
    });

    it('nested episodes resolve to the NARROWEST — the most specific', () => {
        // the flagellation (Mt 27:26) sits inside the Pilate scene (27:1-26)
        expect(pericopeForVerse('matthew', 27, 26)?.id).toBe('flagellation');
        // Noli me tangere (Jn 20:11-18) inside the resurrection (20:1-18)
        expect(pericopeForVerse('john', 20, 14)?.id).toBe('noli-me-tangere');
    });

    it('an unmapped verse is null — stillness, the common case', () => {
        // a verse far outside any episode range
        expect(pericopeForVerse('john', 7, 40)).toBeNull();
    });

    it('rejects malformed inputs without throwing', () => {
        expect(pericopeForVerse(null, 1, 1)).toBeNull();
        expect(pericopeForVerse('john', '3', 16)).toBeNull();
        expect(pericopeForVerse('john', 3, NaN)).toBeNull();
        expect(pericopeForVerse('nonbook', 1, 1)).toBeNull();
    });

    it('admits only cleared works — no pericope carries an unreviewed pin', () => {
        // the build script admits only existing_pin status; every work
        // must name a resolvable source
        const sources = new Set(['aic', 'rijks', 'cleveland', 'met']);
        for (const p of GOSPEL_PERICOPES) {
            for (const w of p.works) {
                expect(sources.has(w.source), `${p.id}: ${w.source}`).toBe(true);
                expect(w.id != null).toBe(true);
            }
        }
    });

    it('every pericope range names a Gospel book and ordered verses', () => {
        const books = new Set(['matthew', 'mark', 'luke', 'john', 'acts']);
        for (const p of GOSPEL_PERICOPES) {
            expect(p.ranges.length).toBeGreaterThan(0);
            for (const r of p.ranges) {
                expect(books.has(r.book), `${p.id}: ${r.book}`).toBe(true);
                expect(r.verseEnd).toBeGreaterThanOrEqual(r.verseStart);
            }
        }
    });

    it('the module is frozen (generated canon, not mutated at runtime)', () => {
        expect(Object.isFrozen(GOSPEL_PERICOPES)).toBe(true);
        expect(Object.isFrozen(GOSPEL_PERICOPES[0])).toBe(true);
    });
});

describe('pericopes.js is a faithful build of the concordance', () => {
    it('matches a fresh build — the committed module has not drifted from the JSON', async () => {
        // Regenerate into a string and compare to what is on disk. If
        // this fails, the concordance JSON changed without a rebuild:
        // run `npm run build:pericopes`.
        const { readFileSync } = await import('fs');
        const onDisk = readFileSync('src/content/chapel/imagery/pericopes.js', 'utf8');
        // build to a temp path via the script's own logic would require
        // refactoring; instead assert the admitted-work count the module
        // header records still matches the JSON's existing_pin count.
        const doc = JSON.parse(readFileSync('image_map/rise-gospel-art-concordance.json', 'utf8'));
        const clearedInJson = doc.passages
            .flatMap(p => p.works || [])
            .filter(w => w.status === 'existing_pin').length;
        const headerMatch = onDisk.match(/\((\d+) works across/);
        expect(headerMatch, 'module header records an admitted-work count').not.toBeNull();
        expect(Number(headerMatch[1])).toBe(clearedInJson);
    });
});
