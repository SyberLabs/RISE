/**
 * The Scriptorium's side of the Library door.
 *
 * The session already accepts an overlay of a reader's own works; what is
 * tested here is that a browser actually hands it one, that a failure in
 * either store cannot silence the other, and that a reader can SEE their
 * texts are on the table — a shelf nobody knows about is composed from by
 * nobody.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scriptorium } from './Scriptorium.js';
import { LocalWorks } from '../core/local-work-store.js';
import { PersonalSwells } from '../core/personal-swells.js';
import { draftLocalWork } from '../core/local-works.js';

const POEMS = 'Pyramid\r\na stone set on a stone\r\n\r\nSycamore\r\nthe bark peels in strips';

let container = null;
let room = null;

const open = async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    room = new Scriptorium(container, { onNavigate: () => {} });
    room.render();
    await room.loadMaterials();
    return room;
};

beforeEach(async () => {
    await LocalWorks.clear();
    vi.spyOn(PersonalSwells, 'getAll').mockResolvedValue([]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    container?.remove();
    vi.restoreAllMocks();
});

describe('a reader who has admitted their own text', () => {
    it('finds it on the table, named, with what a score can point at', async () => {
        await LocalWorks.save(draftLocalWork({ text: POEMS, title: 'Samay' }));
        await open();

        expect(room.localWorks.map(work => work.title)).toEqual(['Samay']);
        expect(container.textContent).toContain('Your own texts are on the table');
        expect(container.textContent).toContain('Samay');
    });

    it('carries it into the prompt the composer is given', async () => {
        await LocalWorks.save(draftLocalWork({ text: POEMS, title: 'Samay' }));
        await open();
        room.session.take();

        const shelved = room.context.library.find(work => work.id === 'local-samay');
        expect(shelved).toBeTruthy();
        expect(shelved.words).toBeGreaterThan(0);
    });

    it('says nothing at all when there is nothing to say', async () => {
        await open();
        expect(container.textContent).not.toContain('Your own texts');
    });
});

describe('when a store fails', () => {
    it('loses only that store', async () => {
        // Two early returns in one try block is how a swell failure would
        // silently take the shelf with it, leaving nothing to say why the
        // reader's poems had vanished from the room.
        await LocalWorks.save(draftLocalWork({ text: POEMS, title: 'Samay' }));
        PersonalSwells.getAll.mockRejectedValue(new Error('no audio store'));
        await open();

        expect(room.localWorks).toHaveLength(1);
        expect(container.textContent).toContain('Samay');
    });

    it('opens the room at all when the shelf is unreachable', async () => {
        vi.spyOn(LocalWorks, 'all').mockRejectedValue(new Error('no IndexedDB'));
        await open();
        expect(room.localWorks).toHaveLength(0);
        expect(container.querySelector('.scriptorium')).not.toBeNull();
    });

    it('skips one bad record rather than the rest of the shelf', async () => {
        await LocalWorks.save(draftLocalWork({ text: POEMS, title: 'Samay' }));
        const good = await LocalWorks.all();
        vi.spyOn(LocalWorks, 'all').mockResolvedValue([
            { ...good[0], id: 'local-ruined', cuts: [0] },
            ...good
        ]);
        await open();
        expect(room.localWorks.map(work => work.id)).toEqual(['local-samay']);
    });
});
