import { describe, expect, it } from 'vitest';
import { AudioScheduleController } from './journey-schedulers.js';

const atom = (sourceId, progress = 0) => ({ sourceId, sourceProgress: progress });

/** A whole-reading personal recording, plus one authored passage. */
const program = () => ({
    coordinateSpace: 'source',
    segments: [
        { id: 'passage', match: { sourceIds: ['s'], fromProgress: 0.2, toProgress: 0.4 },
          cue: { kind: 'soundscape', soundscapeId: 'personal:kanye', fadeMs: 500 } },
        { id: 'layer', match: { sourceIds: ['s'], fromProgress: 0.6, toProgress: 0.8 },
          cue: { kind: 'swell', swellId: 'kanye', fadeMs: 200 } }
    ],
    fallback: { kind: 'silence', fadeMs: 500 },
    lanes: {
        bed: { coordinateSpace: 'source', segments: [
            { id: 'passage', match: { sourceIds: ['s'], fromProgress: 0.2, toProgress: 0.4 },
              cue: { kind: 'soundscape', soundscapeId: 'personal:kanye', fadeMs: 500 } }
        ], fallback: { kind: 'silence', fadeMs: 500 } },
        swell: { coordinateSpace: 'source', segments: [
            { id: 'layer', match: { sourceIds: ['s'], fromProgress: 0.6, toProgress: 0.8 },
              cue: { kind: 'swell', swellId: 'kanye', fadeMs: 200 } }
        ], fallback: { kind: 'hold' } }
    }
});

function spyEngine(calls) {
    return {
        startSoundscape: id => calls.push(`start:${id}`),
        stopSoundscape: () => calls.push('stop-soundscape'),
        applyPreset: id => calls.push(`tone:${id}`),
        setLayerVolume: () => {},
        playSwell: id => calls.push(`play:${id}`),
        stopSwell: () => calls.push('stop-swell')
    };
}

describe('a personal recording must not restart while it plays', () => {
    it('does not restart the whole-reading bed when the same bed is re-asserted', () => {
        const calls = [];
        const controller = new AudioScheduleController(program(), spyEngine(calls), {
            defaultCue: { kind: 'soundscape', soundscapeId: 'personal:kanye', fadeMs: 500 }
        });
        // The project atmosphere is this recording, already sounding.
        controller.observe(atom('s', 0.10));
        calls.length = 0;

        // The authored passage names the very same recording, so there is
        // nothing to change. Stopping and starting it would send the reader's
        // song back to its first second — which a procedural soundscape hides
        // and a recording cannot.
        controller.observe(atom('s', 0.25));
        expect(calls).toEqual([]);

        controller.observe(atom('s', 0.50));
        expect(calls.filter(call => call === 'start:personal:kanye')).toHaveLength(0);
    });

    it('holds the layer instead of stopping and replaying it', () => {
        const calls = [];
        const controller = new AudioScheduleController(program(), spyEngine(calls), {});
        controller.observe(atom('s', 0.65));
        expect(calls).toContain('play:kanye');
        // `hold` is the swell lane's fallback and means the lane keeps what it
        // is sounding. A structural atom outside the span must not end it, and
        // returning must not start it over.
        controller.observe(atom('s', 0.90));
        controller.observe(atom('s', 0.70));
        expect(calls.filter(call => call === 'play:kanye')).toHaveLength(1);
    });
});

describe('a flash that hands the reading straight back is not a fresh start', () => {
    // The player emits `playing` again whenever a visual interlocution ends,
    // and the Chamber answers every one of those with resume().
    it('leaves both lanes alone when nothing was paused', () => {
        const calls = [];
        const controller = new AudioScheduleController(program(), spyEngine(calls), {
            defaultCue: { kind: 'soundscape', soundscapeId: 'personal:kanye', fadeMs: 500 }
        });
        controller.observe(atom('s', 0.65));
        controller.observe(atom('s', 0.30));
        calls.length = 0;

        controller.resume();
        controller.resume();
        expect(calls).toEqual([]);
    });
});

describe('a pause reaches its own lanes and no further', () => {
    it('ends both lanes and brings both back', () => {
        const calls = [];
        const controller = new AudioScheduleController(program(), spyEngine(calls), {
            defaultCue: { kind: 'soundscape', soundscapeId: 'personal:kanye', fadeMs: 500 }
        });
        controller.observe(atom('s', 0.65));
        calls.length = 0;

        controller.pause();
        expect(calls).toContain('stop-swell');

        controller.resume();
        expect(calls).toContain('play:kanye');
    });

    it('still refuses to advance cues while paused', () => {
        const calls = [];
        const controller = new AudioScheduleController(program(), spyEngine(calls), {});
        controller.observe(atom('s', 0.65));
        controller.pause();
        calls.length = 0;
        expect(controller.observe(atom('s', 0.25))).toBeNull();
        expect(calls).toEqual([]);
    });

    it('tears everything down when the reading ends', () => {
        const calls = [];
        const controller = new AudioScheduleController(program(), spyEngine(calls), {
            defaultCue: { kind: 'soundscape', soundscapeId: 'personal:kanye', fadeMs: 500 }
        });
        controller.observe(atom('s', 0.65));
        calls.length = 0;
        controller.stop();
        expect(calls).toContain('stop-swell');
        expect(controller.activeBedId).toBeNull();
        expect(controller.activeSwellId).toBeNull();
    });
});
