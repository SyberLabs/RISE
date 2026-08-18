/**
 * A reader's own audio, sounding under the whole reading.
 *
 * A personal recording was only ever offered as a swell — a momentary event
 * that fires once when its span is entered and that pause ends for good. A
 * reader who assigns their file across an entire text is asking for an
 * atmosphere, and that is the bed lane. The file is now offered as both.
 *
 * A personal bed is a soundscape whose voice is theirs, which is the shape
 * chant beds already established: same handle, same layer, same teardown.
 */
import { describe, expect, it } from 'vitest';
import { AudioScheduleController } from './journey-schedulers.js';
import {
    PERSONAL_BED_PREFIX,
    personalBedEditorAsset,
    personalSwellEditorAsset,
    audioScoreAssetFromId
} from './workshop-audio.js';

const RECORDING = { id: 'never-see-me-again', name: 'Never See Me Again' };

const bedProgram = (soundscapeId) => ({
    lanes: {
        bed: {
            coordinateSpace: 'source',
            fallback: { kind: 'silence', fadeMs: 500 },
            segments: [{
                id: 'b1',
                match: { sourceIds: ['s1'], fromProgress: 0, toProgress: 1 },
                cue: { kind: 'soundscape', soundscapeId, fadeMs: 500 }
            }]
        },
        swell: { coordinateSpace: 'source', segments: [], fallback: { kind: 'hold' } }
    }
});

const atom = () => ({ sourceId: 's1', sourceProgress: 0.2 });

describe('a personal recording can be an event or an atmosphere', () => {
    it('offers the same file on both lanes', () => {
        expect(personalSwellEditorAsset(RECORDING).lane).toBe('swell');
        expect(personalBedEditorAsset(RECORDING).lane).toBe('audio');
        // The bed cue is a soundscape, so every bed rule already covers it.
        expect(personalBedEditorAsset(RECORDING).cueTemplate).toMatchObject({
            kind: 'soundscape',
            soundscapeId: `${PERSONAL_BED_PREFIX}${RECORDING.id}`
        });
    });

    it('resolves a bed asset back from its id', () => {
        const asset = audioScoreAssetFromId(`personal-bed:${RECORDING.id}`, [RECORDING]);
        expect(asset.lane).toBe('audio');
        expect(asset.name).toContain('bed');
    });

    it('holds under the reading and returns after a pause', () => {
        const calls = [];
        const controller = new AudioScheduleController(
            bedProgram(`${PERSONAL_BED_PREFIX}${RECORDING.id}`), {
                startSoundscape: id => calls.push(`start:${id}`),
                stopSoundscape: () => calls.push('stop'),
                applyPreset: () => {},
                playSwell: () => calls.push('swell'),
                stopSwell: () => calls.push('stop-swell')
            });

        controller.observe(atom());
        expect(calls).toContain(`start:${PERSONAL_BED_PREFIX}${RECORDING.id}`);

        // The thing a swell could not do: come back.
        controller.pause();
        controller.resume();
        expect(calls.filter(call => call.startsWith('start:'))).toHaveLength(2);
        // And it is a bed, so no swell was ever fired for it.
        expect(calls).not.toContain('swell');
    });
});
