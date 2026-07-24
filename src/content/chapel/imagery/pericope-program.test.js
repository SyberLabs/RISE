import { describe, expect, it } from 'vitest';
import {
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
        // before-pilate has no existing_pin works in the current canon
        const segs = compileChapterSegments('matthew', 27);
        const beforePilate = segs.find(s => s.id === 'before-pilate');
        expect(beforePilate.cue.kind).toBe('still');
        // an episode WITH works compiles to a sourced cue
        const crucifixion = segs.find(s => s.id === 'crucifixion');
        expect(crucifixion.cue.kind).toBe('sourced');
        expect(crucifixion.cue.collections[0]).toBe('chapel-gospel-crucifixion');
    });

    it('a chapter with no mapped pericopes compiles to null (no program)', () => {
        expect(compileChapterSegments('john', 7)).toEqual([]);
        expect(compileVisualProgram('john', 7, { kind: 'still' })).toBeNull();
    });

    it('collections include only pericopes with admitted works, keyed by chapel-gospel-*', () => {
        const colls = pericopeCollectionsForChapter('matthew', 27);
        for (const [id, entry] of Object.entries(colls)) {
            expect(id.startsWith('chapel-gospel-')).toBe(true);
            expect(entry.works.length).toBeGreaterThan(0);
        }
        // before-pilate has no works → no collection
        expect(colls[pericopeCollectionId('before-pilate')]).toBeUndefined();
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
