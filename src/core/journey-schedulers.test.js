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
    schemaVersion: 'rise.journey.v1',
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
    // Stub only methods AudioEngine actually exposes.
    const engine = () => ({
        startSoundscape: vi.fn(),
        stopSoundscape: vi.fn(),
        setLayerVolume: vi.fn(),
        playSwell: vi.fn()
    });

    it('activates the soundscape of a movement once', () => {
        const e = engine();
        const c = new AudioScheduleController(program().audioProgram, e);
        c.observe(atom('p1'));
        c.observe(atom('p1'));
        expect(e.startSoundscape).toHaveBeenCalledTimes(1);
        expect(e.startSoundscape).toHaveBeenCalledWith('ordered-field');
        // Gain rides on the layer: startSoundscape takes an id and
        // nothing else.
        expect(e.setLayerVolume).toHaveBeenCalledWith('soundscape', 0.55, true);
    });

    it('stops the soundscape at an authored boundary', () => {
        // V1 boundaries fade to silence and back. The engine owns one
        // soundscape handle and stops it before starting another, so an
        // abrupt replacement is not called a crossfade.
        const e = engine();
        const c = new AudioScheduleController(program().audioProgram, e);
        c.observe(atom('p1'));
        c.observe(atom(boundarySourceId('to-hero')));
        expect(e.stopSoundscape).toHaveBeenCalled();
        c.observe(atom('p2'));
        expect(e.startSoundscape).toHaveBeenLastCalledWith('mortal-pulse');
    });

    it('holds rather than substituting when a cue names nothing', () => {
        const e = engine();
        const c = new AudioScheduleController({
            coordinateSpace: 'source',
            segments: [{ id: 's', match: { sourceIds: ['p1'] }, cue: { kind: 'hold' } }],
            fallback: { kind: 'silence', fadeMs: 500 }
        }, e);
        c.observe(atom('p1'));
        expect(e.startSoundscape).not.toHaveBeenCalled();
        expect(e.stopSoundscape).not.toHaveBeenCalled();
    });

    it('lets a reader silence a Journey without rewriting it', () => {
        // §3.3: the user may disable sound. That is not the same as
        // editing the score.
        const e = engine();
        const c = new AudioScheduleController(program().audioProgram, e);
        c.observe(atom('p1'));
        c.setEnabled(false);
        e.startSoundscape.mockClear();
        c.observe(atom('p2'));
        expect(e.startSoundscape).not.toHaveBeenCalled();
        expect(e.stopSoundscape).toHaveBeenCalled();
    });

    it('survives an engine that cannot do what was asked', () => {
        // A runtime playback failure degrades to silence (§8.5); it does
        // not throw into the reading.
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const c = new AudioScheduleController(program().audioProgram, {});
        expect(() => c.observe(atom('p1'))).not.toThrow();
        expect(() => c.silence()).not.toThrow();
        // And it says so. Silence that nobody reported is what this
        // whole exercise was about.
        expect(warn).toHaveBeenCalled();
        expect(warn.mock.calls.flat().join(' ')).toMatch(/startSoundscape/);
        warn.mockRestore();
    });

    it('reports a missing engine method once, not once per atom', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const c = new AudioScheduleController(program().audioProgram, {});
        for (let i = 0; i < 50; i += 1) {
            c.observe(atom(i % 2 ? 'p1' : 'p2'));
        }
        const starts = warn.mock.calls.flat().join(' ').match(/startSoundscape/g) || [];
        expect(starts).toHaveLength(1);
        warn.mockRestore();
    });

    it('restores silence on stop', () => {
        const e = engine();
        const c = new AudioScheduleController(program().audioProgram, e);
        c.observe(atom('p1'));
        c.silence();
        expect(e.stopSoundscape).toHaveBeenCalled();
        expect(c.activeCueId).toBeNull();
    });
});

describe('it only asks the engine for methods the engine has', () => {
    /**
     * Record every property the controller reaches for and check each
     * against the real AudioEngine prototype (stubs cannot catch name
     * mismatches they invent).
     */
    it('checks every command against the real AudioEngine', async () => {
        const { AudioEngine } = await import('../audio/engine.js');
        const asked = new Set();
        const spy = new Proxy({}, {
            get(_, name) {
                if (typeof name !== 'string') return undefined;
                asked.add(name);
                return () => {};
            },
            has: () => true
        });

        const c = new AudioScheduleController(program().audioProgram, spy);
        c.observe(atom('p1'));
        c.observe(atom(boundarySourceId('to-hero')));
        c.observe(atom('p2'));
        c.silence();

        expect(asked.size).toBeGreaterThan(0);
        const available = new Set(Object.getOwnPropertyNames(AudioEngine.prototype));
        for (const name of asked) {
            expect(available.has(name), `AudioEngine has no ${name}()`).toBe(true);
        }
    });
});

describe('multi-lane audio runtime', () => {
    const lanes = () => ({
        coordinateSpace: 'source',
        segments: [
            { id: 'bed', match: { sourceIds: ['p1'] }, cue: { kind: 'tone', presetId: 'deep', fadeMs: 400 }, syncGroup: 'opening' },
            { id: 'event', match: { sourceIds: ['p1'] }, cue: { kind: 'swell', swellId: 'bell', fadeMs: 200 }, syncGroup: 'opening' }
        ],
        fallback: { kind: 'hold', fadeMs: 500 },
        lanes: {
            bed: { coordinateSpace: 'source', segments: [
                { id: 'bed', match: { sourceIds: ['p1'] }, cue: { kind: 'tone', presetId: 'deep', fadeMs: 400 }, syncGroup: 'opening' }
            ], fallback: { kind: 'hold', fadeMs: 500 } },
            swell: { coordinateSpace: 'source', segments: [
                { id: 'event', match: { sourceIds: ['p1'] }, cue: { kind: 'swell', swellId: 'bell', fadeMs: 200 }, syncGroup: 'opening' }
            ], fallback: { kind: 'hold' } }
        }
    });

    it('starts a bed before its co-anchored swell and exposes their sync group', () => {
        const calls = [];
        const controller = new AudioScheduleController(lanes(), {
            stopSoundscape: () => calls.push('stop-soundscape'),
            applyPreset: id => calls.push(`tone:${id}`),
            playSwell: id => calls.push(`swell:${id}`),
            stopSwell: () => calls.push('stop-swell')
        });
        const result = controller.observe(atom('p1'));
        expect(calls.slice(-2)).toEqual(['tone:deep', 'swell:bell']);
        expect(result.syncGroups).toEqual(['opening']);
    });

    it('pauses both lanes and brings both back on resume, and cancels on stop', () => {
        // The overlay lane used to be left behind on resume, on the reasoning
        // that a swell is momentary and replaying one performs it twice. It
        // carries a layer that holds for a whole passage now, so a reader who
        // paused inside that passage came back to it missing. Where the
        // recording resumes FROM is the engine's business, not the schedule's.
        const calls = [];
        const controller = new AudioScheduleController(lanes(), {
            stopSoundscape: () => {},
            applyPreset: id => calls.push(`tone:${id}`),
            playSwell: id => calls.push(`swell:${id}`),
            stopSwell: () => calls.push('stop-swell')
        });
        controller.observe(atom('p1'));
        controller.pause();
        expect(calls).toContain('stop-swell');

        controller.resume();
        expect(calls.filter(call => call === 'swell:bell')).toHaveLength(2);
        expect(calls.filter(call => call === 'tone:deep')).toHaveLength(2);
        expect(controller.activeSwellId).not.toBeNull();

        controller.stop();
        expect(controller.activeBedId).toBeNull();
        expect(controller.activeSwellId).toBeNull();
    });

    it('restores the project atmosphere after an authored bed loses authority', () => {
        const calls = [];
        const controller = new AudioScheduleController(lanes(), {
            stopSoundscape: () => {},
            applyPreset: id => calls.push(id),
            playSwell: () => {},
            stopSwell: () => {}
        }, { defaultCue: { kind: 'tone', presetId: 'focus', fadeMs: 500 } });
        controller.observe(atom('p1'));
        controller.observe(atom('outside'));
        expect(calls).toContain('focus');
        expect(calls.at(-1)).toBe('focus');
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
