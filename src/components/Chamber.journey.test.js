/**
 * The Chamber follows a Journey without knowing what one means.
 *
 * Two things are being guarded. The ORDER of §8.4 — movement, visual,
 * audio, recitation, display — because a reader must never see text
 * before the world it belongs to, and because the movement is what
 * explains the cues that follow it. And the Chamber's ignorance: it
 * receives labels and bounded commands, and if it ever starts
 * interpreting them the three-layer law is gone and nobody will notice
 * until a second Journey behaves differently from the first.
 *
 * These exercise the wiring through the real controllers rather than
 * through the Chamber's DOM, because the ordering is a property of the
 * handler and the DOM is the part jsdom is worst at.
 */
import { describe, expect, it, vi } from 'vitest';
import { compileJourney, boundarySourceId } from '../core/journey-compiler.js';
import {
    MovementScheduleController, AudioScheduleController
} from '../core/journey-schedulers.js';
import { VisualScheduleController } from '../core/visual-scheduler.js';
import { Chamber } from './Chamber.js';
import { visualCortex } from '../visuals/visual-cortex.js';

const MANIFEST = {
    schemaVersion: 'rise.journey.v1',
    id: 'journey-war',
    movements: [
        {
            id: 'war-heaven',
            title: 'War in Heaven',
            segments: [{ passageId: 'p1' }],
            presentation: {
                visual: { kind: 'procedural', collections: ['paradise-lost'] },
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
            segments: [{ passageId: 'p2' }],
            presentation: {
                visual: { kind: 'sourced', collections: ['atr-attic-vases'] },
                audio: { kind: 'soundscape', soundscapeId: 'mortal-pulse', gain: 0.48 }
            }
        }
    ]
};

/**
 * The Chamber's atom handler, reduced to the part under test: the five
 * steps of §8.4 in the order it fixes them.
 */
function makeHandler(programs, log) {
    const movement = new MovementScheduleController(
        programs.movementProgram,
        (position) => log.push(`movement:${position.kind === 'boundary'
            ? position.boundary.id : position.movement.id}`));
    const visual = new VisualScheduleController(
        programs.visualProgram,
        (cue) => log.push(`visual:${cue.kind}`));
    const audio = new AudioScheduleController(programs.audioProgram, {
        // AudioEngine's real surface. These fakes previously carried
        // `setSoundscape` and `fadeSoundscapeOut`, which the engine has
        // never had — so they agreed with a caller that was talking to
        // itself, and War read in silence with every test green.
        startSoundscape: (id) => log.push(`audio:play:${id}`),
        stopSoundscape: () => log.push('audio:silence'),
        setLayerVolume: () => {}
    });

    return (atom) => {
        movement.observe(atom);
        visual.observe(atom);
        audio.observe(atom);
        const isBoundary = atom?.tags?.includes('authored-boundary') === true;
        if (!isBoundary && atom.content) log.push(`speak:${atom.content}`);
        log.push(`display:${atom.content || '∅'}`);
    };
}

const atom = (sourceId, content, tags = []) => ({ sourceId, content, tags });

describe('the order of §8.4', () => {
    it('announces the movement before the cues, and paints last', () => {
        const log = [];
        const handle = makeHandler(compileJourney(MANIFEST), log);
        handle(atom('p1', 'Of Man\'s first disobedience'));

        expect(log).toEqual([
            'movement:war-heaven',
            'visual:procedural',
            'audio:play:ordered-field',
            'speak:Of Man\'s first disobedience',
            'display:Of Man\'s first disobedience'
        ]);
    });

    it('holds everything through the rest of a movement', () => {
        // One announcement per world, not one per atom.
        const log = [];
        const handle = makeHandler(compileJourney(MANIFEST), log);
        handle(atom('p1', 'first'));
        log.length = 0;
        handle(atom('p1', 'second'));
        handle(atom('p1', 'third'));
        expect(log).toEqual([
            'speak:second', 'display:second',
            'speak:third', 'display:third'
        ]);
    });
});

describe('a boundary owns its time and says nothing', () => {
    it('speaks nothing and reveals nothing', () => {
        const log = [];
        const handle = makeHandler(compileJourney(MANIFEST), log);
        handle(atom('p1', 'heaven'));
        log.length = 0;
        handle(atom(boundarySourceId('to-hero'), '', ['source-break', 'authored-boundary']));

        expect(log).toEqual([
            'movement:to-hero',
            'visual:still',
            'audio:silence',
            'display:∅'
        ]);
        expect(log.some(entry => entry.startsWith('speak:'))).toBe(false);
    });

    it('is not skipped even when it carries text by accident', () => {
        // The boundary atom is empty, so nothing WOULD be spoken. The
        // tag is checked anyway, so that emptiness stays a decision
        // rather than a coincidence a later change could undo.
        const log = [];
        const handle = makeHandler(compileJourney(MANIFEST), log);
        handle(atom(boundarySourceId('to-hero'), 'stray', ['authored-boundary']));
        expect(log.some(entry => entry.startsWith('speak:'))).toBe(false);
        expect(log).toContain('display:stray');
    });

    it('clears the previous movement\'s imagery before the next enters', () => {
        // §8.2: a boundary's `still` cue must clear sourced imagery, or
        // Milton's procedurals would still be running under Homer's
        // first line.
        const log = [];
        const handle = makeHandler(compileJourney(MANIFEST), log);
        handle(atom('p1', 'heaven'));
        handle(atom(boundarySourceId('to-hero'), '', ['authored-boundary']));
        handle(atom('p2', 'hector'));

        const visuals = log.filter(e => e.startsWith('visual:'));
        expect(visuals).toEqual(['visual:procedural', 'visual:still', 'visual:sourced']);
    });
});

describe('the Chamber interprets nothing', () => {
    it('passes the movement through as a label, not a meaning', () => {
        const seen = [];
        const controller = new MovementScheduleController(
            compileJourney(MANIFEST).movementProgram,
            (position) => seen.push(position)
        );
        controller.observe(atom('p1', 'x'));

        // What the Chamber gets is a title and an id. Nothing tells it
        // this movement is metaphysical, and nothing should.
        expect(Object.keys(seen[0].movement).sort())
            .toEqual(['id', 'index', 'sourceIds', 'title']);
        expect(seen[0].movement.title).toBe('War in Heaven');
    });

    it('sends the engine commands it already understands', () => {
        const engine = {
            startSoundscape: vi.fn(), stopSoundscape: vi.fn(), setLayerVolume: vi.fn()
        };
        const controller = new AudioScheduleController(
            compileJourney(MANIFEST).audioProgram, engine);
        controller.observe(atom('p1', 'x'));

        // A soundscape id and nothing else — no cue objects, no Journey
        // vocabulary, nothing the engine would have to learn.
        expect(engine.startSoundscape).toHaveBeenCalledTimes(1);
        const args = engine.startSoundscape.mock.calls[0];
        expect(args).toHaveLength(1);
        expect(typeof args[0]).toBe('string');
        // Gain travels on the layer, which the engine already owns.
        expect(engine.setLayerVolume)
            .toHaveBeenCalledWith('soundscape', expect.any(Number), true);
    });
});

describe('nothing outlives the reading', () => {
    it('silences the score when the reading pauses', () => {
        const engine = {
            startSoundscape: vi.fn(), stopSoundscape: vi.fn(), setLayerVolume: vi.fn()
        };
        const controller = new AudioScheduleController(
            compileJourney(MANIFEST).audioProgram, engine);
        controller.observe(atom('p1', 'x'));
        engine.stopSoundscape.mockClear();

        controller.silence();   // what onStateChange('paused') calls
        expect(engine.stopSoundscape).toHaveBeenCalled();
        expect(controller.activeCueId).toBeNull();
    });

    it('re-cues after a pause rather than staying silent', () => {
        // silence() clears the active cue id, so the next atom of the
        // same movement re-emits. Without that, resuming would leave a
        // Journey playing nothing for the rest of its movement.
        const engine = {
            startSoundscape: vi.fn(), stopSoundscape: vi.fn(), setLayerVolume: vi.fn()
        };
        const controller = new AudioScheduleController(
            compileJourney(MANIFEST).audioProgram, engine);
        controller.observe(atom('p1', 'x'));
        controller.silence();
        engine.startSoundscape.mockClear();

        controller.observe(atom('p1', 'y'));
        expect(engine.startSoundscape).toHaveBeenCalledWith('ordered-field');
    });
});

describe('Gallery pause authority', () => {
    const shell = (authored) => {
        const chamber = Object.create(Chamber.prototype);
        chamber.container = document.createElement('div');
        chamber._visualSchedule = authored ? {} : null;
        chamber._authoredGalleryPaused = false;
        chamber._audioSchedule = null;
        chamber.voice = null;
        chamber.kleeField = null;
        return chamber;
    };

    it('holds and resumes a Gallery bound to an authored program', () => {
        const pause = vi.spyOn(visualCortex, 'pauseContinuousField').mockReturnValue(true);
        const resume = vi.spyOn(visualCortex, 'resumeContinuousField').mockReturnValue(true);
        const chamber = shell(true);

        chamber.onStateChange({ state: 'paused' });
        expect(pause).toHaveBeenCalledOnce();
        chamber.onStateChange({ state: 'playing' });
        expect(resume).toHaveBeenCalledOnce();
        vi.restoreAllMocks();
    });

    it('suspends the audio clock with the reading and lets it run again', () => {
        // The suspension is what silences a pause, so a bed keeps its position
        // instead of coming back at its first second.
        const engine = { pause: vi.fn(), unpause: vi.fn() };
        window.rise = { ...(window.rise || {}), audioEngine: engine };
        const chamber = shell(false);
        chamber._audioSchedule = { pause: vi.fn(), resume: vi.fn(), stop: vi.fn() };

        chamber.onStateChange({ state: 'paused' });
        expect(engine.pause).toHaveBeenCalledOnce();
        expect(chamber._audioSchedule.pause).toHaveBeenCalledOnce();

        chamber.onStateChange({ state: 'playing' });
        expect(engine.unpause).toHaveBeenCalledOnce();

        // A finished reading ends its audio outright; there is no position left
        // to keep.
        chamber.onStateChange({ state: 'complete' });
        expect(chamber._audioSchedule.stop).toHaveBeenCalledOnce();
        expect(engine.pause).toHaveBeenCalledOnce();
    });

    it('leaves an unbound ambient Gallery drifting', () => {
        const pause = vi.spyOn(visualCortex, 'pauseContinuousField').mockReturnValue(true);
        const chamber = shell(false);
        chamber.onStateChange({ state: 'paused' });
        expect(pause).not.toHaveBeenCalled();
        vi.restoreAllMocks();
    });
});

describe('scheduled field authority', () => {
    it('routes one cue to the field lifecycle and the generic cortex', () => {
        const chamber = Object.create(Chamber.prototype);
        chamber._visualFieldDirector = { applyCue: vi.fn() };
        const applyCortex = vi.spyOn(visualCortex, 'applyCue').mockImplementation(() => {});
        const cue = {
            kind: 'field', renderer: 'attractor',
            config: { system: 'thomas', palette: 'gold' }
        };

        chamber.applyScheduledVisualCue(cue, { cueId: 'passage-field' });

        expect(chamber._visualFieldDirector.applyCue).toHaveBeenCalledWith(
            cue, { transitionMs: 320 });
        expect(applyCortex).toHaveBeenCalledWith(cue, {
            cueId: 'passage-field', transitionMs: 320
        });
        vi.restoreAllMocks();
    });

    it('adapts the legacy focal cue into the same dynamic field lifecycle', () => {
        const chamber = Object.create(Chamber.prototype);
        chamber._visualFieldDirector = { applyCue: vi.fn() };
        vi.spyOn(visualCortex, 'applyCue').mockImplementation(() => {});

        chamber.applyScheduledVisualCue({ kind: 'focal', focal: { standardGlyph: 'star' } });

        expect(chamber._visualFieldDirector.applyCue).toHaveBeenCalledWith({
            kind: 'field', renderer: 'focal', config: { standardGlyph: 'star' }
        }, { transitionMs: 320 });
        vi.restoreAllMocks();
    });
});
