/**
 * A score may not name an asset the reader does not have.
 *
 * `cueIdsFromProgram` collected collections, engines, soundscapes, swells and
 * tones, and video arrived carrying a sixth kind of id it did not read. The
 * consequence was not an unchecked capability — `validateSequenceAssetReferences`
 * still refuses at compile — but a refusal that lands as a toast when the
 * reader presses Begin instead of a copyable one at the gate.
 */
import { describe, expect, it } from 'vitest';
import {
    CURATOR_CONTEXT_SCHEMA,
    validateCuratorContext
} from './curator-context.js';
import { EXPERIENCE_PROGRAM_SCHEMA } from './experience-program.js';
import { assertProgramWithinContext, describeImportFailure } from './experience-program-io.js';
import { SEQUENCE_ASSET_PREFIX } from './visual-score-lane.js';

const scoreWithVideo = (assetId) => ({
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id: 'plays-a-video',
    authority: 'proposed',
    editable: true,
    tracks: [
        {
            id: 'movements',
            kind: 'movement',
            clips: [{ id: 'm1', anchor: { sourceIds: ['work'] }, data: { index: 0, title: 'One' } }]
        },
        {
            id: 'visuals',
            kind: 'visual',
            fallback: { kind: 'still' },
            clips: [{
                id: 'v1',
                cue: {
                    kind: 'video',
                    assetId,
                    timeMode: 'loop',
                    audioPolicy: 'muted',
                    reducedMotion: 'poster'
                },
                anchor: { sourceIds: ['work'] }
            }]
        }
    ]
});

const context = (collections = []) => validateCuratorContext({
    schema: CURATOR_CONTEXT_SCHEMA,
    id: 'asset-gate',
    sources: [{ id: 'work', title: 'A Work', words: 500 }],
    visuals: { collections },
    audio: {}
});

describe('a video cue is checked like every other named capability', () => {
    it('refuses one the context does not list', () => {
        expect(() => assertProgramWithinContext(scoreWithVideo('missing'), context()))
            .toThrow(/sequence asset missing absent from curator context/);
    });

    it('accepts one the context does list', () => {
        // An asset travels in a context as a collection id; that is the only
        // vocabulary it has there, so it is the whole of the check.
        expect(assertProgramWithinContext(
            scoreWithVideo('reel'),
            context([`${SEQUENCE_ASSET_PREFIX}reel`])
        )).toBe(true);
    });

    it('refuses every video when no assets travel at all', () => {
        // The Scriptorium exports no assets, because no bytes leave the
        // building. So a curated score cannot name a video, and it is refused
        // by the general rule rather than by a case written for that room.
        expect(() => assertProgramWithinContext(scoreWithVideo('anything'), context()))
            .toThrow(/absent from curator context/);
    });

    it('explains the refusal in terms a curator can act on', () => {
        let refusal = '';
        try {
            assertProgramWithinContext(scoreWithVideo('missing'), context());
        } catch (error) {
            refusal = describeImportFailure(error);
        }
        expect(refusal).toMatch(/plays a video from sequence asset "missing"/);
        expect(refusal).toMatch(/none travel in a capability document/);
        expect(refusal).toMatch(/procedural engine or a museum collection/);
        expect(refusal).toMatch(/PROGRAM_IO_UNKNOWN_ASSET/);
    });

    it('still explains the compile-time refusal, which remains reachable', () => {
        // The gate answers "may this program name this id"; the compiler
        // answers "is it the right kind of asset". Both are needed, so both
        // must read as something other than a raw code.
        const explained = describeImportFailure({
            code: 'VISUAL_SCORE_ASSET_NOT_FOUND',
            message: 'Visual clip v1 names missing sequence video reel.',
            details: {}
        });
        expect(explained).toMatch(/a video clip\s+needs a video/);
    });
});
