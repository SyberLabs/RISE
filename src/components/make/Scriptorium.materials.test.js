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
        // In the panel the reader was using. The status line lives at the foot
        // of a page that scrolls, six sections below the upload control.
        expect(room.container.querySelector('.scriptorium-material-notice').textContent)
            .toMatch(/notes\.pdf/);
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

/**
 * THE DOOR A READER USES.
 *
 * Every test above calls `room.addMaterials([...])` — the method — and all of
 * them passed for the whole life of a defect that made uploading an image do
 * nothing at all. The reader does not call the method. They press Choose
 * files, and the browser fires `change` on a file input.
 *
 * `input.files` is a LIVE FileList, not a snapshot: it is the input's own
 * selection, and clearing the input to make the same file re-choosable empties
 * the very object a handler is holding. The room passed that object on AFTER
 * clearing, so `addMaterials` saw zero files, returned at its own guard, and
 * the panel never changed. No notice, no list entry, no bytes — a reader who
 * chose a photograph got silence.
 *
 * A `File` outlives the FileList it came from; the list does not. So the room
 * copies before it clears, and this suite drives the event rather than the
 * method.
 */
describe('the file input, driven the way a reader drives it', () => {
    let room;

    beforeEach(() => {
        global.URL.createObjectURL = vi.fn((_, n = Math.random()) => `blob:${n}`);
        global.URL.revokeObjectURL = vi.fn();
        room = new Scriptorium(document.createElement('div'), {});
        room.mount();
    });

    /**
     * jsdom will not let a test assign `input.files`, so the selection is stood
     * in with the identity semantics a browser has: one object, held by the
     * input, emptied when the input is cleared. This is not a jsdom quirk being
     * worked around — it is the browser behaviour being reproduced, which is
     * why the bug reproduces here too.
     */
    const chooseFiles = async (input, files) => {
        const list = {
            length: files.length,
            item(i) { return this[i] ?? null; },
            *[Symbol.iterator]() { for (let i = 0; i < this.length; i += 1) yield this[i]; }
        };
        files.forEach((file, i) => { list[i] = file; });
        Object.defineProperty(input, 'files', { configurable: true, get: () => list });
        Object.defineProperty(input, 'value', {
            configurable: true,
            get: () => '',
            set: () => {
                for (let i = 0; i < list.length; i += 1) delete list[i];
                list.length = 0;
            }
        });
        input.dispatchEvent(new Event('change', { bubbles: true }));
        // addMaterials is async and the handler cannot be awaited from here.
        await new Promise(resolve => setTimeout(resolve, 0));
    };

    it('stages the file the reader chose, and says so where they are standing', async () => {
        const input = room.container.querySelector('#scriptorium-materials-input');
        await chooseFiles(input, [png()]);

        expect(room.materials).toHaveLength(1);
        expect(room.materials[0].name).toBe('cliff-at-dusk.png');
        // The bytes, not just the descriptor: this is what reaches the Vault.
        expect(room.materialBlobs.get(room.materials[0].id)).toBeInstanceOf(File);

        const notice = room.container.querySelector('.scriptorium-material-notice');
        expect(notice).toBeTruthy();
        expect(notice.textContent).toMatch(/1 image added/);
        // And the panel is open, so the confirmation is on screen rather than
        // folded away behind a summary.
        expect(room.container.querySelector('.scriptorium-materials').open).toBe(true);
        expect(room.container.querySelector('.scriptorium-material-list strong').textContent)
            .toBe('cliff-at-dusk.png');
    });

    it('takes every file of a multiple selection, not merely the first', async () => {
        const input = room.container.querySelector('#scriptorium-materials-input');
        await chooseFiles(input, [png('one.png'), png('two.png'), png('three.png')]);
        expect(room.materials.map(item => item.name))
            .toEqual(['one.png', 'two.png', 'three.png']);
    });

    it('clears the input, so the same file can be chosen twice', async () => {
        const input = room.container.querySelector('#scriptorium-materials-input');
        await chooseFiles(input, [png('same.png')]);
        // A second choosing reaches a re-rendered input, which is the one the
        // reader would actually press.
        const again = room.container.querySelector('#scriptorium-materials-input');
        await chooseFiles(again, [png('same.png')]);
        expect(room.materials).toHaveLength(2);
    });

    it('carries the reader\'s file into the capability document', async () => {
        const input = room.container.querySelector('#scriptorium-materials-input');
        await chooseFiles(input, [png()]);
        const offered = room.context.visuals.collections
            .filter(id => id.startsWith('sequence-asset:'));
        expect(offered).toHaveLength(1);
        expect(room.promptText).toContain('cliff-at-dusk.png');
    });
});
