/**
 * The Local Files door, walked the way a reader walks it.
 *
 * A reading has more than one entrance, and testing the helper rather than
 * the door is how a verse fix once passed every test and still showed the
 * reader one phrase. So this drives the real Library: a real file object into
 * the real input, the real admit room, the real store, and the shelf that
 * comes back — with only `LocalWorks` sharing a database with the browser.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Library } from './Library.js';
import { LocalWorks } from '../core/local-work-store.js';
import { normalizeReaderText } from '../core/local-works.js';

const POEMS = [
    'Pyramid', 'a stone set on a stone', 'and the light going',
    '', 'Sycamore', 'the bark peels in strips', 'like a letter opened twice',
    '', 'Railroad', 'sleepers under the rain', 'counting themselves away'
].join('\r\n');

/** The poems as a record holds them: intake settles line endings once. */
const TEXT = normalizeReaderText(POEMS);

let container = null;
let library = null;
let onSelectText = null;

const dropped = (text = POEMS, name = 'poems.txt') => ({
    name,
    type: 'text/plain',
    text: async () => text
});

/** Wait for the shelf's IndexedDB round trip to land on the page. */
const settled = async () => {
    for (let i = 0; i < 20; i += 1) await Promise.resolve().then(() => new Promise(r => setTimeout(r, 0)));
};

const admitRoom = () => document.querySelector('.admit-overlay');
const click = selector => admitRoom().querySelector(selector)
    .dispatchEvent(new MouseEvent('click', { bubbles: true }));

beforeEach(async () => {
    await LocalWorks.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    onSelectText = vi.fn();
    library = new Library(container, { onSelectText, onNavigate: () => {} });
    library.currentSection = 'personal';
    library.updateContent();
    library.attachFileUploadEvents();
});

afterEach(() => {
    admitRoom()?.remove();
    // The contents sheet is pinned to document.body, not the Library
    // container. Leaving it up lets the next test see the previous work's
    // table of contents — which is how "a work of one part" failed in CI.
    document.querySelector('.toc-scrim')?.remove();
    container?.remove();
});

describe('dropping a file', () => {
    it('opens the admit room rather than going straight through', async () => {
        await library.handleFileUpload(dropped());
        expect(admitRoom()).not.toBeNull();
        expect(onSelectText).not.toHaveBeenCalled();
    });

    it('still reaches the Chamber in one more tap, with the whole text', async () => {
        // The direct read is a departure from docs/vision/SCRIPTORIUM-STRENGTHENING-SPEC.md
        // §9.1, which deletes it. Kept deliberately: the partition is an
        // addition to what a dropped file could do, not a toll on it.
        await library.handleFileUpload(dropped());
        click('[data-action="read"]');
        expect(onSelectText).toHaveBeenCalledWith(TEXT, 'Local: poems');
    });

    it('refuses a file the picker should not have offered', async () => {
        await library.handleFileUpload(dropped('...', 'notes.pdf'));
        expect(admitRoom()).toBeNull();
        expect(onSelectText).not.toHaveBeenCalled();
    });

    it('refuses an empty file without opening a room over nothing', async () => {
        await library.handleFileUpload(dropped('   \r\n  '));
        expect(admitRoom()).toBeNull();
    });
});

describe('admitting a work', () => {
    it('puts it on the shelf, divided as the reader divided it', async () => {
        await library.handleFileUpload(dropped());
        click('[data-magnet="title"]');
        click('[data-action="admit"]');
        await settled();

        const [work] = await LocalWorks.all();
        expect(work.labels).toEqual(['Pyramid', 'Sycamore', 'Railroad']);
        // And the shelf on the page says what a score can point at.
        const card = container.querySelector('.local-work');
        expect(card.textContent).toContain('3 parts');
        expect(card.textContent).toContain(work.id);
    });

    it('reads a shelved work straight from its stored text', async () => {
        await library.handleFileUpload(dropped());
        click('[data-action="admit"]');
        await settled();

        const id = library.localWorks[0].id;
        await library.handleLocalWork('open-local', id);
        expect(onSelectText).toHaveBeenCalledWith(TEXT, 'poems');
    });

    it('reopens a shelved work on the joints its reader placed', async () => {
        await library.handleFileUpload(dropped());
        click('[data-magnet="title"]');
        click('[data-action="admit"]');
        await settled();

        await library.handleLocalWork('edit-local', library.localWorks[0].id);
        // Not the machine's first guess — which for this file is one part.
        expect(admitRoom().querySelectorAll('.admit-part')).toHaveLength(3);
    });

    it('asks before removing a reader\'s own writing', async () => {
        await library.handleFileUpload(dropped());
        click('[data-action="admit"]');
        await settled();
        const id = library.localWorks[0].id;

        vi.spyOn(window, 'confirm').mockReturnValue(false);
        await library.handleLocalWork('drop-local', id);
        expect(await LocalWorks.all()).toHaveLength(1);

        window.confirm.mockReturnValue(true);
        await library.handleLocalWork('drop-local', id);
        expect(await LocalWorks.all()).toHaveLength(0);
        expect(container.querySelector('.local-work')).toBeNull();
    });
});

describe('when the shelf is unavailable', () => {
    it('still reads the file, rather than losing it', async () => {
        // Private browsing, a storage-blocked browser, a full quota. The work
        // is not lost for being unshelvable.
        vi.spyOn(LocalWorks, 'save').mockRejectedValue(new Error('no room'));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        await library.handleFileUpload(dropped());
        click('[data-action="admit"]');
        await settled();
        expect(onSelectText).toHaveBeenCalledWith(TEXT, 'Local: poems');
        vi.restoreAllMocks();
    });
});

describe('reading a work the reader divided', () => {
    /** Shelve the poems, cut at every title, and come back to the shelf. */
    const shelveDivided = async () => {
        await library.handleFileUpload(dropped());
        click('[data-magnet="title"]');
        click('[data-action="admit"]');
        await settled();
        return library.localWorks[0].id;
    };

    it('opens at its contents rather than handing back the whole book', async () => {
        // The parts are named and addressable by now. Handing back one
        // undifferentiated run would show a reader a book they had already
        // indexed — and would be the only door in this Library that does.
        const id = await shelveDivided();
        await library.handleLocalWork('open-local', id);

        expect(document.querySelector('.toc-scrim')).not.toBeNull();
        expect(onSelectText).not.toHaveBeenCalled();
        const rows = [...document.querySelectorAll('.toc-scrim [data-entry]')];
        expect(rows.length).toBeGreaterThanOrEqual(3);
    });

    it('reads one part, named, when the reader picks it', async () => {
        await shelveDivided();
        await library.handleLocalWork('open-local', library.localWorks[0].id);
        library.readEntry(1);

        const [content, label] = onSelectText.mock.calls[0];
        expect(content).toContain('the bark peels in strips');
        expect(content).not.toContain('Pyramid');
        expect(label).toContain('Sycamore');
    });

    it('still offers the whole work, with every word of it', async () => {
        await shelveDivided();
        await library.handleLocalWork('open-local', library.localWorks[0].id);
        library.readWhole();

        const [content] = onSelectText.mock.calls[0];
        for (const line of ['Pyramid', 'Sycamore', 'Railroad']) {
            expect(content).toContain(line);
        }
    });

    it('counts the words of every part, so the sheet can say how long it is', async () => {
        // An entry without `words` totalled NaN, which renders as a work of
        // no length at all beside a reader's own book.
        await shelveDivided();
        const divisions = await library.localRuntime(library.localWorks[0].id).getDivisions();
        for (const entry of divisions.entries) {
            expect(Number.isFinite(entry.words), entry.label).toBe(true);
            expect(entry.words).toBeGreaterThan(0);
        }
    });

    it('hands back the whole text for a work of one part', async () => {
        // Nothing to index, so no sheet: the contents of a single part is the
        // part, and a sheet with one row is a door in front of a door.
        await library.handleFileUpload(dropped());
        click('[data-action="admit"]');
        await settled();

        await library.handleLocalWork('open-local', library.localWorks[0].id);
        expect(document.querySelector('.toc-scrim')).toBeNull();
        expect(onSelectText).toHaveBeenCalledWith(TEXT, 'poems');
    });
});
