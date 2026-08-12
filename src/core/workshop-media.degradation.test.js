/**
 * What happens when a stored image is not there any more.
 *
 * Hydration used to throw on the first unresolvable asset, and app.js
 * caught that and returned — so one evicted blob out of twenty-four
 * withheld the whole reading. This codebase states the opposite rule in
 * five places, about exactly this situation:
 *
 *     a work that will not resolve is absent, never a broken frame.
 *
 * The text is never withheld for a missing picture. The reader is told.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { READING_LIMITS } from './reading-limits.js';
import { safeUrl } from './sanitize.js';
import { validateWorkshopProject, workshopEditorDataToProject } from './workshop-project.js';
import {
    SEQUENCE_ASSET_STORAGE_IDB,
    createSequenceVisualAsset,
    sequenceAssetForPersistence
} from './visual-score-lane.js';
import { WorkshopMedia, WorkshopMediaError } from './workshop-media.js';
import {
    ensureWorkshopAssetsDurable,
    hydrateSessionSequenceAssets,
    hydrateWorkshopAssets,
    pruneProgramAssetReferences
} from './workshop-asset-durability.js';

const OBJECT_URL = `blob:${location.origin}/8f2c1e40-present`;

const idbAsset = (id, name) => sequenceAssetForPersistence(createSequenceVisualAsset({
    id, name, storage: SEQUENCE_ASSET_STORAGE_IDB, mimeType: 'image/png', byteLength: 128
}));

const sessionWithTwoAssets = () => ({
    sequenceVisualAssets: [idbAsset('asset-present', 'Present'), idbAsset('asset-evicted', 'Evicted')],
    visualScoreAssignments: [
        { assetId: 'asset-present', spanStart: 0, spanEnd: 4 },
        { assetId: 'asset-evicted', spanStart: 5, spanEnd: 9 }
    ]
});

const missingOnly = (missingId) => vi.spyOn(WorkshopMedia, 'resolveObjectUrl')
    .mockImplementation(async (id) => {
        if (id === missingId) {
            throw new WorkshopMediaError('WORKSHOP_MEDIA_MISSING', 'gone', { id });
        }
        return OBJECT_URL;
    });

describe('a missing image is absent, and the reading opens', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('drops only what it cannot resolve, and reports it', () => {
        missingOnly('asset-evicted');
        return hydrateSessionSequenceAssets(sessionWithTwoAssets()).then((hydrated) => {
            expect(hydrated.sequenceVisualAssets.map(a => a.id)).toEqual(['asset-present']);
            expect(hydrated.customVisuals).toEqual([OBJECT_URL]);
            // Reported, so the reader can be told rather than left to notice.
            expect(hydrated.missingSequenceAssets.map(a => a.id)).toEqual(['asset-evicted']);
        });
    });

    it('resolves a durable personal focal id to the hydrated runtime URL', async () => {
        missingOnly('asset-evicted');
        const session = sessionWithTwoAssets();
        session.visualConfig = {
            visualMode: 'focals',
            focals: { type: 'personal', personalAssetId: 'asset-present', personalImage: null }
        };
        const hydrated = await hydrateSessionSequenceAssets(session);
        expect(hydrated.visualConfig.focals).toMatchObject({
            type: 'personal', personalAssetId: 'asset-present', personalImage: OBJECT_URL
        });
    });

    it('falls back to the standard focal when personal focal bytes are missing', async () => {
        missingOnly('asset-evicted');
        const session = sessionWithTwoAssets();
        session.visualConfig = {
            visualMode: 'focals',
            focals: { type: 'personal', personalAssetId: 'asset-evicted', personalImage: null }
        };
        const hydrated = await hydrateSessionSequenceAssets(session);
        expect(hydrated.visualConfig.focals).toMatchObject({
            type: 'standard', standardGlyph: 'breath', personalImage: null
        });
    });

    it('takes the clips that named it with it', async () => {
        // WITHOUT THIS THE FIX IS COSMETIC. compileSession runs
        // validateSequenceAssetReferences, which refuses a program naming
        // an asset the session does not carry — so dropping the image
        // alone would move the failure to the compiler, later and with a
        // worse message.
        missingOnly('asset-evicted');
        const session = sessionWithTwoAssets();
        session.experienceProgram = {
            schema: 'rise.experience-program.v1', id: 'program-1',
            authority: 'user', editable: true,
            tracks: [{
                id: 'track-visual', kind: 'visual', clips: [
                    { id: 'clip-present', cue: { kind: 'sourced', collections: ['sequence-asset:asset-present'] } },
                    { id: 'clip-evicted', cue: { kind: 'sourced', collections: ['sequence-asset:asset-evicted'] } }
                ]
            }]
        };

        const hydrated = await hydrateSessionSequenceAssets(session);
        expect(hydrated.experienceProgram.tracks[0].clips.map(c => c.id)).toEqual(['clip-present']);
        expect(hydrated.visualScoreAssignments.map(a => a.assetId)).toEqual(['asset-present']);
    });

    it('takes a personal focal field clip with its missing backing image', async () => {
        missingOnly('asset-evicted');
        const session = sessionWithTwoAssets();
        session.visualScoreAssignments = [{
            assetId: 'surface:focal',
            cue: {
                kind: 'field', renderer: 'focal',
                config: { type: 'personal', personalAssetId: 'asset-evicted' }
            }
        }];
        session.experienceProgram = {
            schema: 'rise.experience-program.v1', id: 'program-focal',
            authority: 'user', editable: true,
            tracks: [{
                id: 'track-visual', kind: 'visual', clips: [{
                    id: 'clip-focal',
                    cue: {
                        kind: 'field', renderer: 'focal',
                        config: { type: 'personal', personalAssetId: 'asset-evicted' }
                    }
                }]
            }]
        };

        const hydrated = await hydrateSessionSequenceAssets(session);
        expect(hydrated.experienceProgram.tracks).toEqual([]);
        expect(hydrated.visualScoreAssignments).toEqual([]);
    });

    it('drops a visual track emptied of every clip', async () => {
        // An authority over an empty lane has no fallback to offer, and
        // lowering one would make the runtime choose silently.
        const program = {
            schema: 'rise.experience-program.v1', id: 'p', authority: 'user', editable: true,
            tracks: [
                { id: 'v', kind: 'visual', clips: [
                    { id: 'c', cue: { kind: 'sourced', collections: ['sequence-asset:gone'] } }
                ] },
                { id: 'a', kind: 'audio', clips: [] }
            ]
        };
        const pruned = pruneProgramAssetReferences(program, new Set(['gone']));
        expect(pruned.tracks.map(t => t.id)).toEqual(['a']);
    });

    it('leaves a program alone when nothing is missing', () => {
        const program = { tracks: [{ id: 'v', kind: 'visual', clips: [] }] };
        expect(pruneProgramAssetReferences(program, new Set())).toBe(program);
    });

    it('proceeds when IndexedDB is unavailable outright', async () => {
        vi.spyOn(WorkshopMedia, 'resolveObjectUrl').mockRejectedValue(
            new WorkshopMediaError('WORKSHOP_MEDIA_UNAVAILABLE', 'IndexedDB is unavailable.')
        );
        const hydrated = await hydrateSessionSequenceAssets(sessionWithTwoAssets());
        expect(hydrated.sequenceVisualAssets).toEqual([]);
        expect(hydrated.missingSequenceAssets).toHaveLength(2);
    });

    it('still raises anything that is not a media error', async () => {
        // Failing open is for ABSENCE. A programming error must not be
        // swallowed by the rule that tolerates a missing file.
        vi.spyOn(WorkshopMedia, 'resolveObjectUrl').mockRejectedValue(new TypeError('boom'));
        await expect(hydrateSessionSequenceAssets(sessionWithTwoAssets())).rejects.toThrow(TypeError);
    });

    it('keeps the entry in the authoring view rather than shortening the list', async () => {
        // An author whose image went missing needs to see the entry that
        // wants attention. A reader does not.
        vi.spyOn(WorkshopMedia, 'resolveObjectUrl').mockRejectedValue(
            new WorkshopMediaError('WORKSHOP_MEDIA_MISSING', 'gone', {})
        );
        const kept = await hydrateWorkshopAssets(sessionWithTwoAssets().sequenceVisualAssets,
            { onMissing: 'keep' });
        expect(kept.map(a => a.id)).toEqual(['asset-present', 'asset-evicted']);
        expect(kept.every(asset => !asset.uri)).toBe(true);
    });

    it('lets a project save even when its bytes were evicted', async () => {
        // Safari discards IndexedDB after seven days without a visit.
        // Refusing the save would mean an author returning late could not
        // save ANY of their work.
        vi.spyOn(WorkshopMedia, 'has').mockResolvedValue(false);
        const durable = await ensureWorkshopAssetsDurable(
            'project-1', sessionWithTwoAssets().sequenceVisualAssets, null
        );
        expect(durable.map(asset => asset.id)).toEqual(['asset-present', 'asset-evicted']);
    });
});

describe('the two image-URI ceilings keep their relationship', () => {
    it('never lets a project persist an asset it could not later carry', () => {
        // They measure the same dimension at two moments with two budgets.
        // The inline ceiling exceeding the runtime one would let a project
        // be saved and then refuse to load.
        expect(READING_LIMITS.maxInlineProjectImageUriChars)
            .toBeLessThanOrEqual(READING_LIMITS.maxSequenceAssetUriChars);
    });

    it('is refused from the shared authority, not from a literal', () => {
        expect(READING_LIMITS.maxInlineProjectImageUriChars).toBe(64 * 1024);
        const base = workshopEditorDataToProject({
            name: 'Inline', sources: [{
                id: 'source-1', name: 'S', providerId: 'local', type: 'text/plain', data: 'text'
            }]
        }, { id: 'inline-huge' });
        expect(() => validateWorkshopProject({
            ...base,
            assets: [{
                id: 'too-big', name: 'Too big', color: '#7fd4a4', storage: 'inline',
                uri: `data:image/png;base64,${'A'.repeat(READING_LIMITS.maxInlineProjectImageUriChars)}`
            }]
        })).toThrow(expect.objectContaining({ code: 'WORKSHOP_PROJECT_INLINE_TOO_LARGE' }));
    });
});

describe("safeUrl accepts this document's object URLs and no others", () => {
    it('takes one this document could have minted', () => {
        const url = `blob:${location.origin}/8f2c1e40-0000`;
        expect(safeUrl(url)).toBe(url);
    });

    it('refuses a blob URL belonging to somewhere else', () => {
        // The comment claimed same-document while the test was a bare
        // /^blob:/. A guarantee written down and not performed is the one
        // that gets relied on.
        expect(safeUrl('blob:https://evil.example/8f2c1e40-0000')).toBe('');
        expect(safeUrl('blob:not-a-url')).toBe('');
        expect(safeUrl('blob:')).toBe('');
    });

    it('still takes http(s) and data:image, and still refuses the rest', () => {
        expect(safeUrl('https://example.org/a.png')).toBe('https://example.org/a.png');
        expect(safeUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
        expect(safeUrl('javascript:alert(1)')).toBe('');
        expect(safeUrl('data:text/html,<script>')).toBe('');
    });
});
