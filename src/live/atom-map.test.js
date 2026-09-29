/**
 * Atoms, read back against the words they came from.
 *
 * The invariants are the ones the speech clock leans on: inside a segment the
 * ranges tile the text exactly with no gap or overlap and never run backwards,
 * every atom is accounted for, and a seam belongs to the segment it precedes.
 */
import { describe, expect, it } from 'vitest';
import { compileRiseCurrent } from '../core/rise-current.js';
import { BLACK_HOLES } from './fixtures/black-holes.js';
import { mapAtoms } from './atom-map.js';

const compile = segments => compileRiseCurrent({
    schema: 'rise.current.v1',
    id: 'map-1',
    title: 'Map',
    origin: { kind: 'human', name: 'Tester' },
    segments: segments.map(({ id, text }) => ({ id, text }))
});

const segmentsOf = count => BLACK_HOLES.segments.slice(0, count).map(({ id, text }) => ({ id, text }));

describe('reading atoms against the compiled Session', () => {
    it('maps every atom, and puts a seam before every segment but the first', () => {
        const segments = segmentsOf(4);
        const session = compile(segments);
        const map = mapAtoms(session.atoms, segments);
        expect(map).toHaveLength(session.atoms.length);
        const seams = map.filter(e => e.seam);
        expect(seams).toHaveLength(3);
        for (const seam of seams) {
            const next = map[seam.index + 1];
            expect(next.seam).toBe(false);
            expect(seam.segmentId).toBe(next.segmentId);
        }
        expect(map[0].seam).toBe(false);
    });

    it('tiles each segment: the first atom starts at 0, each ends where the next begins, the last ends at the length', () => {
        const segments = segmentsOf(6);
        const map = mapAtoms(compile(segments).atoms, segments);
        for (const segment of segments) {
            const mine = map.filter(e => !e.seam && e.segmentId === segment.id);
            expect(mine.length).toBeGreaterThan(0);
            expect(mine[0].start).toBe(0);
            for (let i = 1; i < mine.length; i += 1) expect(mine[i].start).toBe(mine[i - 1].end);
            expect(mine.at(-1).end).toBe(segment.text.length);
            for (const e of mine) expect(e.end).toBeGreaterThan(e.start);
        }
    });

    it('places each atom over its own words', () => {
        const segments = segmentsOf(2);
        const session = compile(segments);
        const map = mapAtoms(session.atoms, segments);
        const first = map.find(e => !e.seam);
        const text = segments[0].text.slice(first.start, first.end).trim();
        expect(text).toBe(session.atoms[first.index].content.trim());
    });

    it('is a prefix of itself as segments are added (committed atoms never move)', () => {
        const all = segmentsOf(6);
        let previous = [];
        for (let n = 1; n <= all.length; n += 1) {
            const segments = all.slice(0, n);
            const map = mapAtoms(compile(segments).atoms, segments);
            expect(map.slice(0, previous.length)).toEqual(previous);
            previous = map;
        }
    });

    it('falls back to proportion, still tiling, when the words are not in the text', () => {
        const atoms = [
            { content: 'Completely different words', sourceId: 'a' },
            { content: 'that were normalised', sourceId: 'a' },
            { content: 'away from the source', sourceId: 'a' }
        ];
        const text = 'x'.repeat(300);
        const map = mapAtoms(atoms, [{ id: 'a', text }]);
        expect(map[0].start).toBe(0);
        expect(map[1].start).toBe(map[0].end);
        expect(map[2].start).toBe(map[1].end);
        expect(map[2].end).toBe(300);
        expect(map.every(e => e.end > e.start)).toBe(true);
    });

    it('gives an atom of a segment it does not know an empty range rather than throwing', () => {
        const map = mapAtoms([{ content: 'orphan', sourceId: 'ghost' }], []);
        expect(map).toEqual([{ index: 0, segmentId: 'ghost', seam: false, start: 0, end: 0 }]);
    });

    it('handles a trailing seam that has nothing after it', () => {
        const map = mapAtoms([{ content: 'a b', sourceId: 'a' }, { content: '', seam: { label: 'x' } }], [{ id: 'a', text: 'a b' }]);
        expect(map[1]).toMatchObject({ seam: true, segmentId: null });
    });
});
