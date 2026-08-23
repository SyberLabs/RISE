/**
 * The Workshop's own `.txt` door, which used to be a different door.
 *
 * The Library divided a dropped file, named its parts and shelved it where a
 * score could point at `local-…#4`. This room — the one built for authoring —
 * read the same file into a flat blob named after a timestamp. The better door
 * was the one outside the workshop, so the two are now one door
 * (SCRIPTORIUM-STRENGTHENING-SPEC §5).
 *
 * What is guarded here is mostly the seam: that a work shelved from this room
 * and the source added to the project are ONE identity, that the offsets in
 * the record index the same string the project holds, and that the reserved
 * `local-` prefix is not minted into by anything that is not a local work.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Workshop } from './Workshop.js';
import { LocalWorks } from '../core/local-work-store.js';
import { localWorkParts } from '../core/local-works.js';

const POEMS = [
    'Pyramid', 'a stone set on a stone', 'and the light going',
    '', 'Sycamore', 'the bark peels in strips', 'like a letter opened twice',
    '', 'Railroad', 'sleepers under the rain', 'counting themselves away'
].join('\r\n');

let container = null;
let studio = null;

const admitRoom = () => document.querySelector('.admit-overlay');
const click = selector => admitRoom().querySelector(selector)
    .dispatchEvent(new MouseEvent('click', { bubbles: true }));
const sources = () => studio.sessionData.sources;

/** The real handler, driven with the file object the input would hand it. */
const drop = async (text = POEMS, name = 'poems.txt') => {
    const reads = [];
    vi.stubGlobal('FileReader', class {
        constructor() { reads.push(this); }
        readAsText() { this.onload({ target: { result: text } }); }
    });
    await studio.handleFileUpload({
        target: { files: [{ name, type: 'text/plain', size: text.length }], value: '' }
    });
    vi.unstubAllGlobals();
};

beforeEach(async () => {
    await LocalWorks.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    studio = new Workshop(container, { onNavigate: () => {} });
    studio.showToast = vi.fn();
});

afterEach(() => {
    admitRoom()?.remove();
    container?.remove();
    vi.restoreAllMocks();
});

describe('importing a text', () => {
    it('opens the admit room instead of swallowing the file whole', async () => {
        await drop();
        expect(admitRoom()).not.toBeNull();
        expect(sources()).toHaveLength(0);
    });

    it('says what the direct exit does HERE, where nothing is read', async () => {
        await drop();
        const direct = admitRoom().querySelector('[data-action="read"]');
        expect(direct.textContent.trim()).toBe('Use here only');
    });

    it('adds one source and shelves nothing when used here only', async () => {
        await drop();
        click('[data-action="read"]');
        expect(sources()).toHaveLength(1);
        expect(await LocalWorks.all()).toHaveLength(0);
    });

    it('never mints into the reserved prefix for a work it did not shelve', async () => {
        // `local-` is reserved so that an id cannot mean two things. A source
        // that is not a local work has no claim on that namespace, and the old
        // `local-${Date.now()}` was borrowing it by coincidence of naming.
        await drop();
        click('[data-action="read"]');
        expect(sources()[0].id.startsWith('local-')).toBe(false);
        expect(sources()[0].id.startsWith('imported-')).toBe(true);
    });
});

describe('admitting from the Workshop', () => {
    it('shelves the work and adds it under the SAME id', async () => {
        await drop();
        click('[data-magnet="title"]');
        click('[data-action="admit"]');
        await vi.waitFor(() => expect(sources()).toHaveLength(1));

        const [work] = await LocalWorks.all();
        expect(work.labels).toEqual(['Pyramid', 'Sycamore', 'Railroad']);
        // One identity, not two names for the same prose.
        expect(sources()[0].id).toBe(work.id);
    });

    it('gives the project the string the record measured', async () => {
        // THE WHOLE REASON INTAKE NORMALISES. A cut is an offset into the
        // record's text; a passage span is an offset into the source's. If the
        // project held CRLF and the record LF, every joint would sit one
        // character per line adrift — and a Windows .txt is the ordinary case.
        await drop();
        click('[data-magnet="title"]');
        click('[data-action="admit"]');
        await vi.waitFor(() => expect(sources()).toHaveLength(1));

        const [work] = await LocalWorks.all();
        expect(sources()[0].data).toBe(work.text);
        expect(sources()[0].data).not.toContain('\r');
        for (const part of localWorkParts(work)) {
            expect(sources()[0].data).toContain(part.content);
        }
    });

    it('keeps the text in the project when the shelf refuses it', async () => {
        vi.spyOn(LocalWorks, 'save').mockRejectedValue(new Error('no room'));
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        await drop();
        click('[data-action="admit"]');
        await vi.waitFor(() => expect(sources()).toHaveLength(1));
        expect(studio.showToast).toHaveBeenCalled();
    });

    it('refuses to add the same shelved work to one project twice', async () => {
        await drop();
        click('[data-action="admit"]');
        await vi.waitFor(() => expect(sources()).toHaveLength(1));
        await drop();
        click('[data-action="admit"]');
        await vi.waitFor(() => expect(studio.showToast).toHaveBeenCalled());
        // A project rejects duplicate source ids outright; catching it here
        // means a sentence rather than a refusal from the normaliser.
        expect(sources()).toHaveLength(1);
    });
});
