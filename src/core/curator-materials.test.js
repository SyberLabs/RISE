/**
 * WHAT THE READER BROUGHT, named.
 *
 * The Library is what RISE holds and answers for. Materials are the reader's
 * own — text, images, video, audio — which RISE describes rather than
 * certifies. Both reach the composer through the same capability document, and
 * for a long time the materials reached it as ids with nothing said about
 * them: every uploaded image under one constant sentence, and a personal swell
 * under no entry at all, because the registry lookup missed and the miss was
 * skipped. A capability a model cannot tell from another is one it cannot use
 * on purpose.
 */
import { describe, expect, it } from 'vitest';
import { exportCuratorContext, validateCuratorContext } from './curator-context.js';

const surface = (extra) => validateCuratorContext(exportCuratorContext({
    id: 'materials',
    sources: [],
    includeLibrary: false,
    ...extra
}));

describe('materials arrive with their names', () => {
    it('an uploaded asset is named, and a clip is not called a picture', () => {
        const context = surface({
            assets: [
                { id: 'a1', name: 'cliff-at-dusk.png', kind: 'image' },
                {
                    id: 'a2', name: 'wye-valley.mp4', kind: 'video',
                    mimeType: 'video/mp4', durationMs: 42_000
                }
            ]
        });
        const entry = context.catalog.collections['sequence-asset:a1'];
        expect(entry.name).toBe('cliff-at-dusk.png');
        expect(entry.kind).toBe('sequence-asset');
        expect(entry.mediaKind).toBe('image');
        // The same importer accepts video/mp4, and both used to arrive under
        // one sentence — so a reader's clip was described as a picture, and
        // the duration measured at upload was told to nobody.
        const clip = context.catalog.collections['sequence-asset:a2'];
        expect(clip.name).toBe('wye-valley.mp4');
        expect(clip.mediaKind).toBe('video');
        expect(clip.durationMs).toBe(42_000);
        expect(clip.description).not.toMatch(/image/i);
    });

    it('a personal swell is described at all', () => {
        const context = surface({ swells: [{ id: 'swell_1', name: 'Rain on the roof' }] });
        expect(context.audio.swells).toContain('swell_1');
        const entry = context.catalog.swells.swell_1;
        expect(entry).toBeTruthy();
        expect(entry.name).toBe('Rain on the roof');
        expect(entry.kind).toBe('personal-audio');
    });

    it('an id nobody declared as personal audio is not called personal audio', () => {
        // A guess about what an unknown id is would be the same
        // label-without-evidence this document refuses everywhere else.
        const context = surface({ swellIds: [], extraCollections: [] });
        for (const [id, entry] of Object.entries({
            ...(context.catalog.soundscapes || {}), ...(context.catalog.swells || {})
        })) {
            expect(entry.kind, `${id} was claimed as the reader's`).not.toBe('personal-audio');
        }
    });

    it('names never widen what a program may name', () => {
        // Membership is decided against the flat id lists and never against
        // the catalogue, so an asset carrying a name is still just an id.
        const context = surface({ assets: [{ id: 'a1', name: 'anything at all' }] });
        expect(context.visuals.collections).toContain('sequence-asset:a1');
        expect(context.visuals.collections).not.toContain('anything at all');
    });
});
