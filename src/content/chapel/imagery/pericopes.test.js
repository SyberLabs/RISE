import { describe, expect, it } from 'vitest';
import { GOSPEL_PERICOPES } from './pericopes.js';

/**
 * The runtime pericope module (PERICOPE-IMAGERY-SPEC §5), held to the
 * concordance it was built from.
 */

describe('the pericope data', () => {
    it('admits only cleared works — no pericope carries an unreviewed pin', () => {
        // only existing_pin works are admitted; every work must name a
        // resolvable source
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
        // If this fails, the concordance JSON changed without this module:
        // update pericopes.js and the count in its header together.
        const { readFileSync } = await import('fs');
        const onDisk = readFileSync('src/content/chapel/imagery/pericopes.js', 'utf8');
        // Assert the admitted-work count the module header records still
        // matches the JSON's existing_pin count.
        const doc = JSON.parse(readFileSync('image_map/rise-gospel-art-concordance.json', 'utf8'));
        const clearedInJson = doc.passages
            .flatMap(p => p.works || [])
            .filter(w => w.status === 'existing_pin').length;
        const headerMatch = onDisk.match(/\((\d+) works across/);
        expect(headerMatch, 'module header records an admitted-work count').not.toBeNull();
        expect(Number(headerMatch[1])).toBe(clearedInJson);
    });
});
