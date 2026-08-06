import { describe, expect, it } from 'vitest';
import {
    allPericopeCollections,
    compileChapterSegments,
    compileVisualProgram,
    pericopeCollectionsForChapter,
    pericopeCollectionId
} from './pericope-program.js';
import { GOSPEL_PERICOPES } from './pericopes.js';

/**
 * The compile layer (PERICOPE-IMAGERY-SPEC §6.1-6.2): the concordance
 * flattens into a disjoint, ordered, auditable session schedule.
 */

describe('pericope schedule compilation', () => {
    it('overlapping ranges flatten narrowest-wins into disjoint segments', () => {
        // Matthew 27: before-pilate (1-26) contains flagellation (26-26)
        const segs = compileChapterSegments('matthew', 27);
        const byId = Object.fromEntries(segs.map(s => [s.id, s.match]));
        expect(byId['before-pilate'].verseEnd).toBe(25);   // yielded verse 26
        expect(byId['flagellation'].verseStart).toBe(26);
        expect(byId['flagellation'].verseEnd).toBe(26);
    });

    it('the resurrection umbrella yields to Noli me tangere at 20:11', () => {
        const segs = compileChapterSegments('john', 20);
        const byId = Object.fromEntries(segs.map(s => [s.id, s.match]));
        expect(byId['resurrection'].verseEnd).toBe(10);
        expect(byId['noli-me-tangere'].verseStart).toBe(11);
    });

    it('output segments are ordered and never overlap', () => {
        for (const [book, chapter] of [['matthew', 27], ['john', 20], ['luke', 22], ['john', 18]]) {
            const segs = compileChapterSegments(book, chapter);
            let prevEnd = 0;
            for (const s of segs) {
                expect(s.match.verseStart, `${book} ${chapter} order`).toBeGreaterThan(prevEnd);
                prevEnd = s.match.verseEnd === Infinity ? 9999 : s.match.verseEnd;
            }
        }
    });

    it('a mapped episode with no admitted works compiles to explicit stillness', () => {
        // the arrest (Mt 26:47-56) has no retained work — it stills,
        // per "stillness outranks substitution"
        const segs = compileChapterSegments('matthew', 26);
        const arrest = segs.find(s => s.id === 'betrayal-arrest');
        expect(arrest.cue.kind).toBe('still');
        // an episode WITH works compiles to a sourced cue
        const crucifixion = compileChapterSegments('matthew', 27)
            .find(s => s.id === 'crucifixion');
        expect(crucifixion.cue.kind).toBe('sourced');
        expect(crucifixion.cue.collections[0]).toBe('chapel-gospel-crucifixion');
    });

    it('a chapter with no mapped pericopes compiles to null (no program)', () => {
        expect(compileChapterSegments('john', 7)).toEqual([]);
        expect(compileVisualProgram('john', 7, { kind: 'still' })).toBeNull();
    });

    it('collections include only pericopes with admitted works, keyed by chapel-gospel-*', () => {
        const colls = pericopeCollectionsForChapter('matthew', 26);
        for (const [id, entry] of Object.entries(colls)) {
            expect(id.startsWith('chapel-gospel-')).toBe(true);
            expect(entry.works.length).toBeGreaterThan(0);
        }
        // the arrest has no works → no collection
        expect(colls[pericopeCollectionId('betrayal-arrest')]).toBeUndefined();
    });

    it('keeps every admitted pericope pin recoverable after launch state is lost', () => {
        const catalog = allPericopeCollections();
        expect(catalog['chapel-gospel-before-pilate'].works.length).toBeGreaterThan(0);
        expect(catalog['chapel-gospel-flagellation'].works.length).toBeGreaterThan(0);
        expect(catalog['chapel-gospel-crucifixion'].works.length).toBeGreaterThan(0);
        expect(catalog['chapel-gospel-entombment'].works.length).toBeGreaterThan(0);
        expect(catalog['chapel-gospel-betrayal-arrest']).toBeUndefined();
    });

    it('the compiled program is coordinate-space scripture with a fallback', () => {
        const program = compileVisualProgram('luke', 1, { kind: 'focal', focal: { type: 'rose' } });
        expect(program.coordinateSpace).toBe('scripture');
        expect(program.fallback.kind).toBe('focal');
        expect(program.enabled).toBe(true);
    });

    it('AUDIT: every executable segment names a real concordance pericope', () => {
        const known = new Set(GOSPEL_PERICOPES.map(p => p.id));
        for (const book of ['matthew', 'mark', 'luke', 'john']) {
            for (let ch = 1; ch <= 28; ch++) {
                for (const s of compileChapterSegments(book, ch)) {
                    expect(known.has(s.id), `${book} ${ch}: ${s.id}`).toBe(true);
                }
            }
        }
    });

    it('AUDIT: no sourced cue names a collection with unadmitted works', () => {
        // every sourced collection resolves to a pericope whose works
        // are all admitted (existing_pin was the build filter)
        const worksById = Object.fromEntries(GOSPEL_PERICOPES.map(p => [p.id, p.works]));
        for (const book of ['matthew', 'mark', 'luke', 'john']) {
            for (let ch = 1; ch <= 28; ch++) {
                for (const s of compileChapterSegments(book, ch)) {
                    if (s.cue.kind !== 'sourced') continue;
                    expect(worksById[s.id].length).toBeGreaterThan(0);
                }
            }
        }
    });
});

/**
 * THE READER'S ACTUAL REQUIREMENT: as a chapter moves from one episode to
 * the next, the imagery must move with it.
 *
 * Every test above this point checks that segments are disjoint IN VERSES.
 * None of them checks that the segments differ IN IMAGERY — and a chapter
 * that pinned the same painting to all seven of its episodes would pass
 * every one of them while showing a reader the same picture from Pilate
 * to the tomb. Verse disjointness is the mechanism; distinct imagery is
 * the point, and only the point is worth guaranteeing.
 */
describe('each section of a chapter carries its own imagery', () => {
    it('no work is pinned to two pericopes anywhere in the concordance', () => {
        // Measured 2026-08-05: 108 distinct works across 50 pericopes with
        // zero repeats. True by the curator's hand and, until now, by
        // nothing else — a single copied pin would put the same painting
        // in consecutive episodes and read as the program having stalled,
        // which is exactly the failure Matthew 27 was once reported for.
        const owners = new Map();
        for (const pericope of GOSPEL_PERICOPES) {
            for (const work of pericope.works) {
                const key = `${work.source}:${work.id}`;
                if (!owners.has(key)) owners.set(key, []);
                owners.get(key).push(pericope.id);
            }
        }
        const shared = [...owners.entries()]
            .filter(([, pericopes]) => pericopes.length > 1)
            .map(([work, pericopes]) => `${work} in ${pericopes.join(' + ')}`);
        expect(shared).toEqual([]);
    });

    // Named chapters rather than only the corpus sweep: these two are the
    // Nativity and the Passion, the most-read chapters in the building,
    // and Matthew 27 carries a regression history of its own.
    for (const [book, chapter, expected] of [['luke', 2, 6], ['matthew', 27, 7]]) {
        it(`${book} ${chapter} gives each of its ${expected} episodes a distinct pool`, () => {
            const program = compileVisualProgram(book, chapter, null, true);
            const segments = program?.segments || [];
            expect(segments).toHaveLength(expected);

            const collections = allPericopeCollections();
            const seen = [];
            for (const segment of segments) {
                const id = segment.cue.collections?.[0];
                expect(id, `${segment.id} names no collection`).toBeTruthy();
                // A collection named twice would show one pool across two
                // episodes even with the pins all distinct.
                expect(seen, `${id} is scheduled twice`).not.toContain(id);
                seen.push(id);
                expect(collections[id]?.works?.length,
                    `${id} is an empty shelf`).toBeGreaterThan(0);
            }

            // …and consecutive episodes must not merely differ by id.
            for (let i = 1; i < seen.length; i++) {
                const previous = collections[seen[i - 1]].works.map(w => `${w.source}:${w.id}`);
                const current = collections[seen[i]].works.map(w => `${w.source}:${w.id}`);
                expect(current.filter(w => previous.includes(w)),
                    `${seen[i - 1]} → ${seen[i]} repeats a work`).toEqual([]);
            }
        });
    }
});
