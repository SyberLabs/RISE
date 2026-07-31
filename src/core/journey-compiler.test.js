/**
 * The Journey compiler's contracts.
 *
 * Two of these matter more than the rest. A Journey that cannot be
 * compiled must REFUSE rather than compile partially — a movement
 * quietly dropped is an argument silently altered, and the whole point
 * of authoring above the runtime is that the runtime does not get a
 * vote. And an authored boundary must be distinguishable from a
 * paragraph break, or a scored transition and incidental whitespace
 * become the same event.
 */
import { describe, expect, it } from 'vitest';
import {
    compileJourney, JourneyCompileError, cueForSource, movementForSource,
    boundarySourceId, isBoundarySource
} from './journey-compiler.js';

const movement = (id, passageIds, extra = {}) => ({
    id,
    title: `Movement ${id}`,
    segments: passageIds.map(passageId => ({ passageId, role: 'proposition' })),
    ...extra
});

const journey = (movements, extra = {}) => ({
    schemaVersion: 'rise.journey.v1',
    id: 'journey-war',
    title: 'War',
    movements,
    ...extra
});

describe('lowering an argument into cues', () => {
    it('gives every movement its sources, in order', () => {
        const { movementProgram } = compileJourney(journey([
            movement('war-heaven', ['pass-paradise-lost-war-heaven']),
            movement('war-hero', ['pass-iliad-hector-household', 'pass-iliad-hector-death'])
        ]));

        expect(movementProgram.journeyId).toBe('journey-war');
        expect(movementProgram.movements.map(m => m.id)).toEqual(['war-heaven', 'war-hero']);
        expect(movementProgram.movements[0].index).toBe(0);
        expect(movementProgram.movements[1].sourceIds).toEqual([
            'pass-iliad-hector-household', 'pass-iliad-hector-death'
        ]);
    });

    it('binds each movement\'s imagery and audio to its own sources', () => {
        const { visualProgram, audioProgram } = compileJourney(journey([
            movement('war-heaven', ['p1'], {
                presentation: {
                    visual: { kind: 'sourced', collections: ['journey-war-celestial-geometry'] },
                    audio: { kind: 'soundscape', soundscapeId: 'war-ordered-field', gain: 0.55, fadeMs: 1200 }
                }
            }),
            movement('war-steel', ['p2'], {
                presentation: {
                    visual: { kind: 'sourced', collections: ['journey-war-trench'] },
                    audio: { kind: 'soundscape', soundscapeId: 'war-pressure-field', gain: 0.4 }
                }
            })
        ]));

        expect(cueForSource(visualProgram, 'p1'))
            .toEqual({ kind: 'sourced', collections: ['journey-war-celestial-geometry'] });
        expect(cueForSource(visualProgram, 'p2'))
            .toEqual({ kind: 'sourced', collections: ['journey-war-trench'] });
        expect(cueForSource(audioProgram, 'p1'))
            .toMatchObject({ kind: 'soundscape', soundscapeId: 'war-ordered-field', gain: 0.55 });
    });
});

describe('an authored boundary is not a paragraph break', () => {
    it('gives a transition its own source, cue, and time', () => {
        // A break inside a movement carries that movement's sourceId and
        // therefore holds its cue. A boundary carries a different one and
        // therefore changes it — which is what stops incidental
        // whitespace and a scored transition being the same event.
        const { movementProgram, visualProgram, audioProgram } = compileJourney(journey([
            movement('war-heaven', ['p1'], {
                presentation: { visual: { kind: 'sourced', collections: ['c1'] } },
                transitionOut: {
                    id: 'war-heaven-to-hero',
                    durationMs: 1600,
                    visual: { kind: 'still' },
                    audio: { kind: 'silence', fadeMs: 300 }
                }
            }),
            movement('war-hero', ['p2'])
        ]));

        const id = boundarySourceId('war-heaven-to-hero');
        expect(isBoundarySource(id)).toBe(true);
        expect(isBoundarySource('p1')).toBe(false);

        expect(movementProgram.boundaries[0]).toMatchObject({
            sourceId: id, fromMovementId: 'war-heaven', toMovementId: 'war-hero', durationMs: 1600
        });
        expect(cueForSource(visualProgram, id)).toEqual({ kind: 'still' });
        expect(cueForSource(audioProgram, id)).toEqual({ kind: 'silence', fadeMs: 300 });
        // The movement's own cue is untouched by its boundary.
        expect(cueForSource(visualProgram, 'p1')).toEqual({ kind: 'sourced', collections: ['c1'] });
    });

    it('keeps a coda after the last movement, naming no destination', () => {
        const { movementProgram } = compileJourney(journey([
            movement('war-steel', ['p1'], {
                transitionOut: { id: 'war-coda', durationMs: 7000, audio: { kind: 'silence' } }
            })
        ]));
        expect(movementProgram.boundaries).toHaveLength(1);
        expect(movementProgram.boundaries[0].toMovementId).toBeNull();
    });

    it('belongs to no movement', () => {
        const { movementProgram } = compileJourney(journey([
            movement('m1', ['p1'], { transitionOut: { id: 't1' } }),
            movement('m2', ['p2'])
        ]));
        expect(movementForSource(movementProgram, 'p1').id).toBe('m1');
        expect(movementForSource(movementProgram, boundarySourceId('t1'))).toBeNull();
    });
});

describe('it refuses rather than approximating', () => {
    it('rejects a manifest with no movements', () => {
        expect(() => compileJourney(journey([]))).toThrow(JourneyCompileError);
        expect(() => compileJourney({ id: 'x' })).toThrow(/at least one movement/);
    });

    it('rejects a movement that names no passages', () => {
        // Compiling it as an empty movement would drop a step of the
        // argument and leave the Journey looking complete.
        expect(() => compileJourney(journey([movement('m1', [])])))
            .toThrow(/names no passages/);
    });

    it('rejects two movements sharing an id', () => {
        // Restart and completion reporting address movements by id; two
        // under one id makes both non-deterministic.
        expect(() => compileJourney(journey([movement('m1', ['p1']), movement('m1', ['p2'])])))
            .toThrow(/share the id/);
    });

    it('rejects an unknown schema rather than guessing', () => {
        expect(() => compileJourney(journey([movement('m1', ['p1'])], { schemaVersion: 'v99' })))
            .toThrow(/Unknown Journey schema/);
    });

    it('rejects a missing id', () => {
        expect(() => compileJourney({ movements: [movement('m1', ['p1'])] })).toThrow(/needs an id/);
        expect(() => compileJourney(null)).toThrow(JourneyCompileError);
    });
});

describe('cues are bounded before they reach the runtime', () => {
    it('reads stillness for a sourced cue that names no pool', () => {
        // Otherwise the cortex shows whatever was last loaded, which is
        // the stale-pool failure the Chapel already paid for.
        const { visualProgram } = compileJourney(journey([
            movement('m1', ['p1'], { presentation: { visual: { kind: 'sourced', collections: [] } } })
        ]));
        expect(cueForSource(visualProgram, 'p1')).toEqual({ kind: 'still' });
    });

    it('holds rather than substituting when a soundscape is unnamed', () => {
        const { audioProgram } = compileJourney(journey([
            movement('m1', ['p1'], { presentation: { audio: { kind: 'soundscape' } } })
        ]));
        expect(cueForSource(audioProgram, 'p1')).toEqual({ kind: 'hold' });
    });

    it('clamps gain, fade, and duration', () => {
        const { movementProgram, audioProgram } = compileJourney(journey([
            movement('m1', ['p1'], {
                presentation: { audio: { kind: 'soundscape', soundscapeId: 's', gain: 99, fadeMs: 1e9 } },
                transitionOut: { id: 't', durationMs: 1e9 }
            }),
            movement('m2', ['p2'])
        ]));
        const cue = cueForSource(audioProgram, 'p1');
        expect(cue.gain).toBe(1);
        expect(cue.fadeMs).toBeLessThanOrEqual(10_000);
        expect(movementProgram.boundaries[0].durationMs).toBeLessThanOrEqual(60_000);
    });

    it('rejects an unknown cue kind by falling to a safe one', () => {
        const { visualProgram, audioProgram } = compileJourney(journey([
            movement('m1', ['p1'], {
                presentation: { visual: { kind: 'explode' }, audio: { kind: 'airhorn' } }
            })
        ]));
        expect(cueForSource(visualProgram, 'p1')).toEqual({ kind: 'still' });
        expect(cueForSource(audioProgram, 'p1')).toEqual({ kind: 'hold' });
    });

    it('falls back for a source it was never told about', () => {
        const { visualProgram, audioProgram } = compileJourney(journey([movement('m1', ['p1'])]));
        expect(cueForSource(visualProgram, 'unknown')).toEqual({ kind: 'still' });
        expect(cueForSource(audioProgram, 'unknown')).toEqual({ kind: 'silence', fadeMs: 500 });
    });

    it('reads nothing from a scripture-coordinate program', () => {
        // The coordinate spaces are separate contracts; a mixed read
        // would silently match the wrong axis.
        expect(cueForSource({ coordinateSpace: 'scripture', segments: [] }, 'p1')).toBeNull();
    });
});

describe('a flat playlist still compiles', () => {
    it('reads an existing Atrium Journey as one movement', () => {
        // Eighty flat records must not have to be rewritten for the
        // first authored one to exist.
        const { movementProgram } = compileJourney({
            id: 'seq-hist-declaration-claim',
            title: 'Declaring the People',
            segments: [
                { passageId: 'pass-us-declaration', role: 'proposition' },
                { passageId: 'pass-rights-man', role: 'response' }
            ]
        });
        expect(movementProgram.movements).toHaveLength(1);
        expect(movementProgram.movements[0].sourceIds).toEqual([
            'pass-us-declaration', 'pass-rights-man'
        ]);
        expect(movementProgram.boundaries).toEqual([]);
    });
});

describe('a procedural cue names its engines', () => {
    it('carries collections, as a sourced cue does', () => {
        // They were dropped for every kind but `sourced`, which left a
        // movement asking for "some procedural" and getting whatever
        // the cortex last had. Milton's Book VI needs its OWN engines —
        // the Chariot of Paternal Deity is that book's climax.
        const { visualProgram } = compileJourney(journey([
            movement('m1', ['p1'], {
                presentation: { visual: { kind: 'procedural', collections: ['paradise-lost'] } }
            })
        ]));
        expect(cueForSource(visualProgram, 'p1'))
            .toEqual({ kind: 'procedural', collections: ['paradise-lost'] });
    });

    it('still falls to stillness when it names none', () => {
        const { visualProgram } = compileJourney(journey([
            movement('m1', ['p1'], { presentation: { visual: { kind: 'procedural' } } })
        ]));
        expect(cueForSource(visualProgram, 'p1')).toEqual({ kind: 'still' });
    });
});

describe('figures lower a movement cue onto places in a passage', () => {
    // Ten lines, one word each: line N begins at word N.
    const metrics = { wordsBeforeLine: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], totalWords: 10 };
    const manifest = (figures) => ({
        id: 'j',
        movements: [{
            id: 'm',
            segments: [{ passageId: 'p', figures }],
            presentation: { visual: { kind: 'procedural', collections: ['paradise-lost'] } }
        }]
    });

    it('runs each figure from its own line to the next', () => {
        const { visualProgram } = compileJourney(manifest([
            { id: 'a', fromLine: 2, engines: ['flaming_sword'] },
            { id: 'b', fromLine: 6, engines: ['chariot_deity'] }
        ]), { passageMetrics: { p: metrics } });

        const figures = visualProgram.segments.filter(s => s.id.includes('figure'));
        expect(figures).toHaveLength(2);
        expect(figures[0].match).toEqual({ sourceIds: ['p'], fromProgress: 0.2, toProgress: 0.6 });
        // The last runs to the end of the passage.
        expect(figures[1].match.toProgress).toBe(1);
        // The family is inherited, never restated.
        expect(figures[0].cue).toEqual({
            kind: 'procedural', collections: ['paradise-lost'], engines: ['flaming_sword']
        });
    });

    it('keeps the movement-wide cue beside the figures', () => {
        // It is what holds wherever nothing finer was authored.
        const { visualProgram } = compileJourney(manifest([
            { id: 'a', fromLine: 2, engines: ['flaming_sword'] }
        ]), { passageMetrics: { p: metrics } });
        const broad = visualProgram.segments.find(s => s.id === 'm-visual');
        expect(broad.match.fromProgress).toBeUndefined();
        expect(broad.cue.engines).toBeUndefined();
    });

    it('emits nothing for a declared gap', () => {
        // A figure with no engine is Book VI asking for one that does not
        // exist yet. It must not be filled with a wrong engine, and it
        // must not silently become a range that draws nothing.
        const { visualProgram } = compileJourney(manifest([
            { id: 'gap', fromLine: 0, engines: [], wanted: 'heaven-in-order' },
            { id: 'sword', fromLine: 5, engines: ['flaming_sword'] }
        ]), { passageMetrics: { p: metrics } });
        const figures = visualProgram.segments.filter(s => s.id.includes('figure'));
        expect(figures).toHaveLength(1);
        expect(figures[0].id).toContain('sword');
        // And the gap's stretch is left to the movement cue.
        expect(figures[0].match.fromProgress).toBe(0.5);
    });

    it('places no figure without metrics, and still compiles', () => {
        // The compiler is pure; only the handoff holds the text. A line
        // is not a place until someone has the passage.
        const { visualProgram } = compileJourney(manifest([
            { id: 'a', fromLine: 2, engines: ['flaming_sword'] }
        ]));
        expect(visualProgram.segments.filter(s => s.id.includes('figure'))).toHaveLength(0);
        expect(visualProgram.segments.find(s => s.id === 'm-visual')).toBeTruthy();
    });

    it('sorts figures by line rather than trusting the author\'s order', () => {
        const { visualProgram } = compileJourney(manifest([
            { id: 'late', fromLine: 8, engines: ['dark_ocean_chaos'] },
            { id: 'early', fromLine: 1, engines: ['flaming_sword'] }
        ]), { passageMetrics: { p: metrics } });
        const figures = visualProgram.segments.filter(s => s.id.includes('figure'));
        expect(figures.map(f => f.match.fromProgress)).toEqual([0.1, 0.8]);
    });

    it('ignores figures on a movement whose cue is not procedural', () => {
        const { visualProgram } = compileJourney({
            id: 'j',
            movements: [{
                id: 'm',
                segments: [{ passageId: 'p', figures: [{ id: 'a', fromLine: 2, engines: ['x'] }] }],
                presentation: { visual: { kind: 'sourced', collections: ['atr-attic-vases'] } }
            }]
        }, { passageMetrics: { p: metrics } });
        expect(visualProgram.segments.filter(s => s.id.includes('figure'))).toHaveLength(0);
    });
});
