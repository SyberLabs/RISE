/**
 * What counts as "this project", and what happens to an image that stops.
 *
 * A reader imported three pictures, brought in a Library text, and found the
 * pictures still listed in the panel but absent from the passage dropdown
 * with nothing said. The two-tier model is deliberate — a project owns its
 * media, and anything from elsewhere is copied in first — but "elsewhere" is
 * decided purely by `activeBlueprintId`, so a reader's own images change
 * identity the moment that stops matching the sequence they were saved under.
 *
 * The model stays. What changes is that the dropdown no longer goes quiet.
 */
import { describe, expect, it } from 'vitest';
import { buildWorkshopVisualAssetRegistry } from './workshop/workshop-visual-assets.js';
import { editorAssetSupports } from '../core/editor-asset.js';

const IMAGE = { id: 'asset-1', uri: 'blob:local-1', name: 'Musk', color: '#ffffff' };
const spanEntries = (registry) => registry
    .filter(entry => !entry.hidden && editorAssetSupports(entry.asset, 'span'));

describe('project media and shared media are the same picture, differently owned', () => {
    it('belongs to the project while its blueprint is the active one', () => {
        const [entry] = buildWorkshopVisualAssetRegistry({ projectAssets: [IMAGE] })
            .filter(item => item.asset.kind === 'sequence-image');
        expect(entry.group).toBe('project');
        expect(entry.materialization).toBeUndefined();
    });

    it('becomes shared, needing a copy, once the blueprint is another one', () => {
        // This is exactly what `visualAssetEntries` passes: every saved
        // blueprint EXCEPT the active one.
        const [entry] = buildWorkshopVisualAssetRegistry({
            projectAssets: [],
            savedBlueprints: [{ id: 'bp-1', title: 'My sequence', sequenceVisualAssets: [IMAGE] }]
        }).filter(item => item.asset.kind === 'sequence-image');
        expect(entry.group).toBe('shared');
        expect(entry.materialization).toBeTruthy();
        // And it carries the id needed to read the durable copy back.
        expect(entry.asset.provenance.projectAssetId).toBe('asset-1');
    });

    it('offers a shared image rather than dropping it from the passage list', () => {
        // The dropdown filtered on `!entry.materialization`, so the whole
        // Shared media group was unreachable and an image could vanish from
        // the list with no explanation. Both kinds are span-capable and both
        // must be offerable.
        const shared = spanEntries(buildWorkshopVisualAssetRegistry({
            savedBlueprints: [{ id: 'bp-1', title: 'Saved', sequenceVisualAssets: [IMAGE] }]
        })).filter(entry => entry.asset.kind === 'sequence-image');
        expect(shared).toHaveLength(1);
        expect(shared[0].materialization).toBeTruthy();
        expect(editorAssetSupports(shared[0].asset, 'span')).toBe(true);
    });
});
