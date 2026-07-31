/**
 * A Journey, compiled all the way down to atoms.
 *
 * The unit tests above prove each layer in isolation. This one proves
 * the seam they meet at, which is where the argument either survives or
 * quietly stops being one: an authored transition must become a real
 * atom, in the right place, carrying a source id that makes the visual
 * and audio programs change cue there and nowhere else.
 *
 * If that seam is wrong, everything still passes and the reader gets a
 * three-beat pause where a scored silence should be.
 */
import { describe, expect, it } from 'vitest';
import { compileSession } from './session-compiler.js';
import { compileJourney, boundarySourceId } from './journey-compiler.js';
import { cueForAtom } from './visual-scheduler.js';
import { MovementScheduleController, AudioScheduleController } from './journey-schedulers.js';

const MANIFEST = {
    id: 'journey-war',
    movements: [
        {
            id: 'war-heaven',
            title: 'War in Heaven',
            segments: [{ passageId: 'pass-heaven' }],
            presentation: {
                visual: { kind: 'sourced', collections: ['celestial'] },
                audio: { kind: 'soundscape', soundscapeId: 'ordered-field', gain: 0.55 }
            },
            transitionOut: {
                id: 'to-hero', durationMs: 1600,
                visual: { kind: 'still' }, audio: { kind: 'silence', fadeMs: 300 }
            }
        },
        {
            id: 'war-hero',
            title: 'The Hero Under Heaven',
            segments: [{ passageId: 'pass-hector' }],
            presentation: {
                visual: { kind: 'sourced', collections: ['bronze'] },
                audio: { kind: 'soundscape', soundscapeId: 'mortal-pulse', gain: 0.48 }
            }
        }
    ]
};

const words = (n, w) => Array.from({ length: n }, () => w).join(' ');

function buildSession() {
    const { movementProgram, visualProgram, audioProgram, boundaries } = compileJourney(MANIFEST);
    const session = compileSession({
        name: 'War',
        wpm: 200,
        chunkMode: 'sentence',
        sources: [
            { id: 'pass-heaven', name: 'Paradise Lost VI', raw: words(120, 'heaven') + '.' },
            { id: 'pass-hector', name: 'Iliad XXII', raw: words(120, 'hector') + '.' }
        ],
        sourceBoundaries: boundaries.map(b => ({
            id: b.id,
            sourceId: b.sourceId,
            afterSourceId: 'pass-heaven',
            beforeSourceId: 'pass-hector',
            kind: 'movement',
            durationMs: b.durationMs
        }))
    });
    return { session, movementProgram, visualProgram, audioProgram };
}

describe('an authored transition becomes an atom', () => {
    it('replaces the generic break between exactly the pair it names', () => {
        const { session } = buildSession();
        const breaks = session.atoms.filter(a => a.tags?.includes('source-break'));
        expect(breaks).toHaveLength(1);

        const boundary = breaks[0];
        expect(boundary.tags).toContain('authored-boundary');
        expect(boundary.tags).toContain('boundary:to-hero');
        expect(boundary.sourceId).toBe(boundarySourceId('to-hero'));
        // The authored duration, not three beats of the reading's pace.
        expect(boundary.duration).toBe(1600);
        expect(boundary.timingLocked).toBe(true);
        expect(boundary.content).toBe('');
    });

    it('sits between the two movements, not beside them', () => {
        const { session } = buildSession();
        const index = session.atoms.findIndex(a => a.tags?.includes('authored-boundary'));
        expect(session.atoms[index - 1].sourceId).toBe('pass-heaven');
        expect(session.atoms[index + 1].sourceId).toBe('pass-hector');
    });

    it('leaves an unmatched pair on the generic break', () => {
        // A Journey's transitions are the only thing that changes; two
        // ordinary sources still get three beats.
        const session = compileSession({
            name: 'Plain', wpm: 200, chunkMode: 'sentence',
            sources: [
                { id: 'a', name: 'A', raw: words(60, 'alpha') + '.' },
                { id: 'b', name: 'B', raw: words(60, 'beta') + '.' }
            ],
            sourceBoundaries: [{
                id: 'x', sourceId: 'journey-boundary:x',
                afterSourceId: 'somewhere', beforeSourceId: 'else', durationMs: 5000
            }]
        });
        const brk = session.atoms.find(a => a.tags?.includes('source-break'));
        expect(brk.tags).not.toContain('authored-boundary');
        expect(brk.duration).toBe(Math.round((60_000 / 200) * 3));
    });

    it('clamps a duration that would stall the reading', () => {
        const session = compileSession({
            name: 'Clamp', wpm: 200, chunkMode: 'sentence',
            sources: [
                { id: 'a', name: 'A', raw: words(60, 'alpha') + '.' },
                { id: 'b', name: 'B', raw: words(60, 'beta') + '.' }
            ],
            sourceBoundaries: [{
                id: 'x', sourceId: 'journey-boundary:x',
                afterSourceId: 'a', beforeSourceId: 'b', durationMs: 1e9
            }]
        });
        const brk = session.atoms.find(a => a.tags?.includes('authored-boundary'));
        expect(brk.duration).toBeLessThanOrEqual(30_000);
    });
});

describe('walking the compiled session', () => {
    it('changes cue at the boundary and nowhere else', () => {
        const { session, visualProgram } = buildSession();
        const seen = [];
        let last = null;
        for (const atom of session.atoms) {
            const { cue } = cueForAtom(visualProgram, atom);
            const key = JSON.stringify(cue);
            if (key !== last) { seen.push(cue); last = key; }
        }
        // Exactly three worlds, in order: heaven, the scored silence,
        // then the mortal one. Not a flicker per paragraph.
        expect(seen).toEqual([
            { kind: 'sourced', collections: ['celestial'] },
            { kind: 'still' },
            { kind: 'sourced', collections: ['bronze'] }
        ]);
    });

    it('announces two movements and one boundary', () => {
        const { session, movementProgram } = buildSession();
        const announced = [];
        const controller = new MovementScheduleController(movementProgram,
            (pos) => announced.push(pos.kind === 'boundary' ? `~${pos.boundary.id}` : pos.movement.id));
        for (const atom of session.atoms) controller.observe(atom);
        expect(announced).toEqual(['war-heaven', '~to-hero', 'war-hero']);
    });

    it('scores the audio once per world', () => {
        const { session, audioProgram } = buildSession();
        const calls = [];
        const engine = {
            setSoundscape: (id) => calls.push(`play:${id}`),
            fadeSoundscapeOut: () => calls.push('silence')
        };
        const controller = new AudioScheduleController(audioProgram, engine);
        for (const atom of session.atoms) controller.observe(atom);
        expect(calls).toEqual(['play:ordered-field', 'silence', 'play:mortal-pulse']);
    });

    it('speaks nothing at the boundary', () => {
        // §8.4: a boundary atom speaks nothing and reveals no text. Its
        // emptiness is what makes that automatic rather than a rule the
        // Chamber has to remember.
        const { session } = buildSession();
        const boundary = session.atoms.find(a => a.tags?.includes('authored-boundary'));
        expect(boundary.content.trim()).toBe('');
        expect(boundary.weight).toBe(0);
    });
});

describe('the programs survive the Session', () => {
    it('carries a Journey\'s three programs as launch identity', async () => {
        // §7.5: they must survive the Chamber's destroy/recreate cycle.
        // A Journey that recompiled on every Chamber construction would
        // be a different Journey each time.
        const { Session } = await import('./models.js');
        const { movementProgram, audioProgram, visualProgram } = compileJourney(MANIFEST);
        const session = new Session({
            name: 'War', atoms: [], sources: [],
            movementProgram, audioProgram, visualProgram
        });
        expect(session.movementProgram.movements.map(m => m.id))
            .toEqual(['war-heaven', 'war-hero']);
        expect(session.movementProgram.boundaries[0].sourceId)
            .toBe(boundarySourceId('to-hero'));
        expect(session.audioProgram.segments.length).toBeGreaterThan(0);
    });

    it('serializes without executable values', async () => {
        const { Session } = await import('./models.js');
        const { movementProgram, audioProgram } = compileJourney(MANIFEST);
        const session = new Session({ name: 'War', atoms: [], sources: [], movementProgram, audioProgram });
        const round = JSON.parse(JSON.stringify({
            movementProgram: session.movementProgram,
            audioProgram: session.audioProgram
        }));
        expect(round.movementProgram).toEqual(session.movementProgram);
        expect(round.audioProgram).toEqual(session.audioProgram);
    });

    it('refuses a malformed program rather than half-loading it', async () => {
        const { Session } = await import('./models.js');
        const session = new Session({
            name: 'x', atoms: [], sources: [],
            movementProgram: { schema: 'something-else', movements: [{ id: 'a' }] },
            audioProgram: { coordinateSpace: 'scripture', segments: [] }
        });
        expect(session.movementProgram).toBeNull();
        expect(session.audioProgram).toBeNull();
    });
});

describe('the programs survive normalization, not only serialization', () => {
    it('keeps a source-coordinate visual program', async () => {
        // It was rejected outright: the normalizer accepted only
        // `scripture`, so a Journey's program came out null and the
        // Chamber built no visual controller. No error, no warning —
        // the movement schedule announced itself, the audio schedule
        // announced itself, and the line between them was simply absent
        // from the log while a reader watched an empty field.
        const { Session } = await import('./models.js');
        const { visualProgram } = compileJourney(MANIFEST);
        const session = new Session({ name: 'War', atoms: [], sources: [], visualProgram });

        expect(session.visualProgram).not.toBeNull();
        expect(session.visualProgram.coordinateSpace).toBe('source');
        expect(session.visualProgram.segments.length).toBe(visualProgram.segments.length);
    });

    it('keeps a procedural cue\'s engines through the Session', async () => {
        const { Session } = await import('./models.js');
        const { visualProgram } = compileJourney(MANIFEST);
        const session = new Session({ name: 'War', atoms: [], sources: [], visualProgram });

        // The fixture above is `sourced`; War's first movement is not,
        // so the procedural path needs a program of its own.
        const procedural = compileJourney({
            id: 'j',
            movements: [
                {
                    id: 'm', segments: [{ passageId: 'p' }],
                    presentation: { visual: { kind: 'procedural', collections: ['paradise-lost'] } }
                },
                { id: 'm2', segments: [{ passageId: 'p2' }] }
            ]
        }).visualProgram;
        const kept = new Session({
            name: 'x', atoms: [], sources: [], visualProgram: procedural
        });
        const cue = cueForAtom(kept.visualProgram, { sourceId: 'p' }).cue;
        expect(cue).toEqual({ kind: 'procedural', collections: ['paradise-lost'] });
    });

    it('still rejects a malformed or unknown coordinate space', async () => {
        const { Session } = await import('./models.js');
        const a = new Session({ name: 'x', atoms: [], sources: [],
            visualProgram: { coordinateSpace: 'galactic', segments: [{ id: 'a' }] } });
        const b = new Session({ name: 'x', atoms: [], sources: [],
            visualProgram: { coordinateSpace: 'source', segments: [{ id: '', match: {} }] } });
        expect(a.visualProgram).toBeNull();
        expect(b.visualProgram).toBeNull();
    });
});
