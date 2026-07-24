import { describe, expect, it, vi } from 'vitest';
import { cueForAtom, VisualScheduleController } from './visual-scheduler.js';

/**
 * The generic scheduler (PERICOPE-IMAGERY-SPEC §6.3). Domain-agnostic:
 * it follows coordinate-tagged atoms and emits cues. It knows nothing
 * of pericopes — every test here uses a hand-built program.
 */

const program = {
    coordinateSpace: 'scripture',
    enabled: true,
    segments: [
        { id: 'a', match: { chapter: 1, verseStart: 1, verseEnd: 5 },
          cue: { kind: 'sourced', collections: ['coll-a'] } },
        { id: 'b', match: { chapter: 1, verseStart: 6, verseEnd: 10 },
          cue: { kind: 'sourced', collections: ['coll-b'] } }
    ],
    fallback: { kind: 'still' }
};

const atom = (chapter, verse) => ({ chapter, verse, content: 'x' });

describe('cueForAtom', () => {
    it('matches an atom to its segment', () => {
        expect(cueForAtom(program, atom(1, 3)).id).toBe('a');
        expect(cueForAtom(program, atom(1, 8)).id).toBe('b');
    });

    it('an unmapped verse falls to the fallback', () => {
        expect(cueForAtom(program, atom(1, 20)).id).toBe('__fallback__');
    });

    it('a disabled program is entirely fallback (the icon lock)', () => {
        const locked = { ...program, enabled: false };
        expect(cueForAtom(locked, atom(1, 3)).id).toBe('__fallback__');
    });
});

describe('VisualScheduleController', () => {
    it('emits one cue per boundary crossed, not per atom', () => {
        const onCue = vi.fn();
        const ctrl = new VisualScheduleController(program, onCue);
        for (let v = 1; v <= 10; v++) for (let i = 0; i < 3; i++) ctrl.observe(atom(1, v));
        // segment a (1-5) then b (6-10): exactly two activations
        expect(onCue).toHaveBeenCalledTimes(2);
        expect(onCue.mock.calls[0][0].collections).toEqual(['coll-a']);
        expect(onCue.mock.calls[1][0].collections).toEqual(['coll-b']);
    });

    it('the generation advances on every cue change', () => {
        const gens = [];
        const ctrl = new VisualScheduleController(program, (_, meta) => gens.push(meta.generation));
        ctrl.observe(atom(1, 1));
        ctrl.observe(atom(1, 8));
        ctrl.observe(atom(1, 20)); // fallback
        expect(gens).toEqual([1, 2, 3]);
    });

    it('structural silence (no coordinate) holds the cue, never thrashes', () => {
        const onCue = vi.fn();
        const ctrl = new VisualScheduleController(program, onCue);
        ctrl.observe(atom(1, 3));                 // → a
        ctrl.observe({ content: '', tags: ['paragraph-break'] }); // no coordinate
        ctrl.observe(atom(1, 4));                 // still a — no re-emit
        expect(onCue).toHaveBeenCalledTimes(1);
        expect(ctrl.activeCueId).toBe('a');
    });

    it('rewind across a boundary restores the previous cue', () => {
        const seen = [];
        const ctrl = new VisualScheduleController(program, (_, meta) => seen.push(meta.cueId));
        ctrl.observe(atom(1, 3));  // a
        ctrl.observe(atom(1, 8));  // b (forward)
        ctrl.observe(atom(1, 3));  // a again (rewound) — a fresh activation
        expect(seen).toEqual(['a', 'b', 'a']);
    });

    it('a jump directly into the middle resolves correctly', () => {
        const ctrl = new VisualScheduleController(program, () => {});
        const first = ctrl.observe(atom(1, 8)); // straight into b
        expect(first.id).toBe('b');
    });

    it('reset re-emits on the next atom', () => {
        const onCue = vi.fn();
        const ctrl = new VisualScheduleController(program, onCue);
        ctrl.observe(atom(1, 3));
        ctrl.observe(atom(1, 3)); // same — no emit
        expect(onCue).toHaveBeenCalledTimes(1);
        ctrl.reset();
        ctrl.observe(atom(1, 3)); // re-emits after reset
        expect(onCue).toHaveBeenCalledTimes(2);
    });
});
