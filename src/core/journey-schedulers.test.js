/**
 * The Journey controllers follow; they do not drive.
 *
 * The assertions that matter are about restraint. Neither controller
 * may own a clock, emit on an atom that changed nothing, or let a
 * command from a movement the reader has left publish into the one they
 * are in. Those are the failures that make a scored transition drift
 * away from the reading it belongs to.
 */
import { describe, expect, it, vi } from 'vitest';
import { MovementScheduleController, AudioScheduleController } from './journey-schedulers.js';
import { compileJourney, boundarySourceId } from './journey-compiler.js';
import { cueForAtom } from './visual-scheduler.js';

const program = () => compileJourney({
    id: 'journey-war',
    movements: [
        {
            id: 'war-heaven',
            title: 'War in Heaven',
            segments: [{ passageId: 'p1' }],
            presentation: {
                visual: { kind: 'sourced', collections: ['celestial'] },
                audio: { kind: 'soundscape', soundscapeId: 'ordered-field', gain: 0.55, fadeMs: 1200 }
            },
            transitionOut: {
                id: 'to-hero', durationMs: 1600,
                visual: { kind: 'still' }, audio: { kind: 'silence', fadeMs: 300 }
            }
        },
        {
            id: 'war-hero',
            title: 'The Hero Under Heaven',
            segments: [{ passageId: 'p2' }, { passageId: 'p3' }],
            presentation: {
                visual: { kind: 'sourced', collections: ['bronze'] },
                audio: { kind: 'soundscape', soundscapeId: 'mortal-pulse', gain: 0.48 }
            }
        }
    ]
});

const atom = (sourceId) => ({ sourceId, content: 'word' });

describe('the movement controller announces once per movement', () => {
    it('emits on entry and holds through the movement', () => {
        const seen = [];
        const c = new MovementScheduleController(program().movementProgram,
            (pos, meta) => seen.push([pos.kind, pos.movement?.id ?? pos.boundary.id, meta.generation]));

        c.observe(atom('p1'));
        c.observe(atom('p1'));
        c.observe(atom('p1'));
        expect(seen).toEqual([['movement', 'war-heaven', 1]]);

        c.observe(atom('p2'));
        c.observe(atom('p3'));   // same movement, two passages
        expect(seen).toHaveLength(2);
        expect(seen[1]).toEqual(['movement', 'war-hero', 2]);
    });

    it('reports a boundary distinctly from a movement', () => {
        const seen = [];
        const c = new MovementScheduleController(program().movementProgram, (pos) => seen.push(pos.kind));
        c.observe(atom('p1'));
        c.observe(atom(boundarySourceId('to-hero')));
        c.observe(atom('p2'));
        expect(seen).toEqual(['movement', 'boundary', 'movement']);
    });

    it('holds through structural silence', () => {
        // A paragraph break carries no sourceId. It is a pause inside
        // the movement, not a movement change, and announcing one would
        // flicker the title every other atom.
        const c = new MovementScheduleController(program().movementProgram, () => {});
        c.observe(atom('p1'));
        expect(c.observe({ content: '' })?.movement?.id).toBe('war-heaven');
        expect(c.generation).toBe(1);
    });

    it('holds through a source the Journey never named', () => {
        const c = new MovementScheduleController(program().movementProgram, () => {});
        c.observe(atom('p1'));
        c.observe(atom('a-source-from-somewhere-else'));
        expect(c.current.movement.id).toBe('war-heaven');
        expect(c.generation).toBe(1);
    });

    it('re-emits after a reset, for restart', () => {
        const seen = [];
        const c = new MovementScheduleController(program().movementProgram, (p) => seen.push(p.movement?.id));
        c.observe(atom('p1'));
        c.reset();
        c.observe(atom('p1'));
        expect(seen).toEqual(['war-heaven', 'war-heaven']);
        expect(c.generation).toBe(2);
    });
});

describe('the audio controller sends bounded commands', () => {
    const engine = () => ({
        setSoundscape: vi.fn(),
        fadeSoundscapeOut: vi.fn(),
        playSwell: vi.fn()
    });

    it('activates a movement\'s soundscape once', () => {
        const e = engine();
        const c = new AudioScheduleController(program().audioProgram, e);
        c.observe(atom('p1'));
        c.observe(atom('p1'));
        expect(e.setSoundscape).toHaveBeenCalledTimes(1);
        expect(e.setSoundscape).toHaveBeenCalledWith('ordered-field',
            expect.objectContaining({ gain: 0.55, fadeMs: 1200 }));
    });

    it('fades to silence at an authored boundary', () => {
        // V1 boundaries fade to silence and back. The engine owns one
        // soundscape handle and stops it before starting another, so an
        // abrupt replacement is not called a crossfade.
        const e = engine();
        const c = new AudioScheduleController(program().audioProgram, e);
        c.observe(atom('p1'));
        c.observe(atom(boundarySourceId('to-hero')));
        expect(e.fadeSoundscapeOut).toHaveBeenCalledWith(300);
        c.observe(atom('p2'));
        expect(e.setSoundscape).toHaveBeenLastCalledWith('mortal-pulse',
            expect.objectContaining({ gain: 0.48 }));
    });

    it('holds rather than substituting when a cue names nothing', () => {
        const e = engine();
        const c = new AudioScheduleController({
            coordinateSpace: 'source',
            segments: [{ id: 's', match: { sourceIds: ['p1'] }, cue: { kind: 'hold' } }],
            fallback: { kind: 'silence', fadeMs: 500 }
        }, e);
        c.observe(atom('p1'));
        expect(e.setSoundscape).not.toHaveBeenCalled();
        expect(e.fadeSoundscapeOut).not.toHaveBeenCalled();
    });

    it('lets a reader silence a Journey without rewriting it', () => {
        // §3.3: the user may disable sound. That is not the same as
        // editing the score.
        const e = engine();
        const c = new AudioScheduleController(program().audioProgram, e);
        c.observe(atom('p1'));
        c.setEnabled(false);
        e.setSoundscape.mockClear();
        c.observe(atom('p2'));
        expect(e.setSoundscape).not.toHaveBeenCalled();
        expect(e.fadeSoundscapeOut).toHaveBeenCalled();
    });

    it('survives an engine that cannot do what was asked', () => {
        // A runtime playback failure degrades to silence (§8.5); it does
        // not throw into the reading.
        const c = new AudioScheduleController(program().audioProgram, {});
        expect(() => c.observe(atom('p1'))).not.toThrow();
        expect(() => c.silence()).not.toThrow();
    });

    it('restores silence on stop', () => {
        const e = engine();
        const c = new AudioScheduleController(program().audioProgram, e);
        c.observe(atom('p1'));
        c.silence();
        expect(e.fadeSoundscapeOut).toHaveBeenCalled();
        expect(c.activeCueId).toBeNull();
    });
});

describe('the visual scheduler reads the source coordinate', () => {
    it('matches a movement and a boundary by sourceId', () => {
        const { visualProgram } = program();
        expect(cueForAtom(visualProgram, atom('p1')).cue)
            .toEqual({ kind: 'sourced', collections: ['celestial'] });
        expect(cueForAtom(visualProgram, atom(boundarySourceId('to-hero'))).cue)
            .toEqual({ kind: 'still' });
    });

    it('falls back for a source outside the Journey', () => {
        const { visualProgram } = program();
        expect(cueForAtom(visualProgram, atom('elsewhere')).cue).toEqual({ kind: 'still' });
    });

    it('leaves the scripture coordinate alone', () => {
        // The two coordinate spaces are separate contracts. A source
        // program must not match a verse, or a Chapel reading would
        // pick up a Journey's cue.
        const { visualProgram } = program();
        expect(cueForAtom(visualProgram, { chapter: 1, verse: 1 }).cue).toEqual({ kind: 'still' });
    });
});
