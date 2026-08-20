/**
 * The Scriptorium takes what the reader brought.
 *
 * Both rooms build the same capability document from the same function, and
 * this one handed it empty arrays: `sources: []` at the top and `assets: []`
 * again where the project is assembled. So a composer working here could name
 * the Library and nothing else, and had no way to arrange a reading around
 * the reader's own images at all.
 *
 * There is no new store behind this. A sequence asset is VALIDATED AGAINST
 * THE ASSETS THE READING CARRIES rather than looked up in a room's registry,
 * so a Scriptorium-only container would have produced scores that refuse at
 * compile — ids naming files the Chamber never received.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Scriptorium } from './Scriptorium.js';

const png = (name = 'cliff-at-dusk.png') =>
    new File([new Uint8Array(64)], name, { type: 'image/png' });

describe('materials staged in the Scriptorium', () => {
    let room;

    beforeEach(() => {
        global.URL.createObjectURL = vi.fn((_, n = Math.random()) => `blob:${n}`);
        global.URL.revokeObjectURL = vi.fn();
        room = new Scriptorium(document.createElement('div'), {});
        room.mount();
    });

    it('are offered to the composer, by id and by name', async () => {
        await room.addMaterials([png()]);
        const offered = room.context.visuals.collections
            .filter(id => id.startsWith('sequence-asset:'));
        expect(offered).toHaveLength(1);
        // Named, because an id a model cannot tell from any other id is a
        // capability it cannot use on purpose.
        expect(room.context.catalog.collections[offered[0]].name).toBe('cliff-at-dusk.png');
        expect(room.promptText).toContain('cliff-at-dusk.png');
    });

    it('start folded away, and open once something is in them', () => {
        expect(room.materialsOpen).toBe(false);
        expect(room.container.querySelector('.scriptorium-materials')).toBeTruthy();
        expect(room.container.querySelector('.scriptorium-materials').open).toBe(false);
    });

    it('state a refusal the reader can act on, and keep what was good', async () => {
        await room.addMaterials([png(), new File([new Uint8Array(8)], 'notes.pdf',
            { type: 'application/pdf' })]);
        expect(room.materials).toHaveLength(1);
        expect(room.status).toMatch(/notes\.pdf/);
    });

    it('rebuild the take, because a copied prompt is stale the moment they change', async () => {
        await room.addMaterials([png()]);
        const withOne = room.promptText;
        room.dropMaterial(room.materials[0].id);
        expect(room.materials).toHaveLength(0);
        expect(room.promptText).not.toBe(withOne);
        expect(room.promptText).not.toContain('cliff-at-dusk.png');
    });

    it('are released when the reader leaves the room', async () => {
        await room.addMaterials([png()]);
        room.destroy();
        expect(URL.revokeObjectURL).toHaveBeenCalled();
        expect(room.materials).toHaveLength(0);
    });
});
