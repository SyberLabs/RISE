/**
 * Import score is a door onto the same gate the Scriptorium stands at, and it
 * offers the reader the whole Library catalogue. These tests drive that door
 * the way a reader does — Project ▸ Import JSON ▸ Paste JSON ▸ Import — and
 * ask what the reading actually holds afterwards.
 *
 * THE DEFECT THEY WERE WRITTEN AGAINST: the gate accepted a score naming
 * `sacred-tao-te-ching#40`, the project was built from the Workshop surface
 * alone, and the movement clip pointed at nothing. The score reached the
 * Vault; the reader was never told.
 *
 * The text is compared against the Archive itself, not against a length. A
 * source of the right size holding the wrong chapter is exactly the failure
 * a word count cannot see.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

if (typeof globalThis.indexedDB === 'undefined') {
    globalThis.indexedDB = { open: () => ({ onsuccess: null, onerror: null, onupgradeneeded: null }) };
}

const { Workshop } = await import('./Workshop.js');
const { WorkshopMedia } = await import('../core/workshop-media.js');
const { MemoryCore } = await import('../core/memory.js');
const { ingestedArchiveTexts } = await import('../content/archive/index.js');
const { EXTENT_OVERSHOOT_LIMIT } = await import('../core/library-extent.js');

const TAO = 'sacred-tao-te-ching';

/** The Archive's own chapter, read here rather than through anything under test. */
async function archiveDivision(workId, ordinal) {
    const work = ingestedArchiveTexts().find(item => item.id === workId);
    if (!work) throw new Error(`${workId} is not on this build's shelf`);
    const scheme = await work.getDivisions();
    const entry = scheme.entries[ordinal - 1];
    if (!entry) throw new Error(`${workId} has no division ${ordinal}`);
    return entry.content.trim();
}

const NOTES = 'A short authored passage the reader typed into the Workshop themselves.';

function scoreNaming(ids) {
    return JSON.stringify({
        schema: 'rise.experience-program.v1',
        id: 'imported-score',
        authority: 'proposed',
        editable: true,
        tracks: [{
            id: 'movements',
            kind: 'movement',
            clips: ids.map((sourceId, index) => ({
                id: `m${index + 1}`,
                anchor: { sourceIds: [sourceId] },
                data: { index, title: sourceId }
            }))
        }]
    });
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

async function waitFor(predicate, label) {
    for (let attempt = 0; attempt < 400; attempt += 1) {
        if (predicate()) return;
        await tick();
    }
    throw new Error(`timed out waiting for ${label}`);
}

function latestOverlay(selector) {
    const overlays = [...document.querySelectorAll('.naming-modal-overlay')];
    return overlays.reverse().find(overlay => overlay.querySelector(selector)) || null;
}

/**
 * Project ▸ Import JSON ▸ Paste JSON ▸ paste ▸ Import.
 *
 * Nothing here reaches into the component: every step is a click a reader
 * makes, which is the only way to prove the door was fixed rather than a
 * helper behind it.
 */
async function importThroughTheDoor(workshop, container, text) {
    container.querySelector('[data-action="import-experience-program"]').click();
    await waitFor(() => latestOverlay('[data-choice="paste"]'), 'the import chooser');
    latestOverlay('[data-choice="paste"]').querySelector('[data-choice="paste"]').click();

    await waitFor(() => latestOverlay('#program-paste-input'), 'the paste modal');
    const paste = latestOverlay('#program-paste-input');
    paste.querySelector('#program-paste-input').value = text;
    paste.querySelector('[data-choice="import"]').click();

    await waitFor(() => workshop.programImportBusy === false, 'the import to finish');
    await tick();
}

function refusalText() {
    const overlay = latestOverlay('#program-refusal-text');
    return overlay ? overlay.querySelector('#program-refusal-text').value : null;
}

let savedProjects;

function makeWorkshop() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const workshop = new Workshop(container, {
        onNavigate: vi.fn(),
        onCreateSession: vi.fn()
    });
    workshop.addSource(
        { id: 'my-notes', name: 'My notes', type: 'text/plain', data: NOTES },
        { id: 'local' }
    );
    return { workshop, container };
}

beforeEach(() => {
    savedProjects = [];
    const toasts = document.createElement('div');
    toasts.id = 'toast-container';
    document.body.appendChild(toasts);

    vi.spyOn(WorkshopMedia, 'put').mockResolvedValue({ id: 'x', projectId: 'p', byteLength: 0 });
    vi.spyOn(WorkshopMedia, 'has').mockResolvedValue(true);
    vi.spyOn(WorkshopMedia, 'resolveObjectUrl').mockImplementation(async (id) => `blob:hydrated-${id}`);
    vi.spyOn(WorkshopMedia, 'delete').mockResolvedValue(undefined);
    vi.spyOn(WorkshopMedia, 'deleteByProject').mockResolvedValue(undefined);
    vi.spyOn(WorkshopMedia, 'revokeObjectUrl').mockImplementation(() => {});

    // The Vault write is watched, not replaced: the defect was a score reaching
    // the Vault with a clip that resolved to nothing, so what was written is
    // the thing under examination.
    const write = MemoryCore.saveWorkshopBlueprintAsync.bind(MemoryCore);
    vi.spyOn(MemoryCore, 'saveWorkshopBlueprintAsync')
        .mockImplementation(async (project, options) => {
            savedProjects.push(project);
            return write(project, options);
        });
});

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.body.innerHTML = '';
});

describe('Import score resolves the Library works it was allowed to name', () => {
    it('loads a division the score names and gives the reader its actual words', async () => {
        const { workshop, container } = makeWorkshop();

        await importThroughTheDoor(workshop, container, scoreNaming(['my-notes', `${TAO}#40`]));

        expect(refusalText()).toBeNull();
        const [project] = savedProjects;
        expect(project).toBeDefined();
        expect(project.sources.map(source => source.id))
            .toEqual(['my-notes', `${TAO}#40`]);

        const chapter = project.sources.find(source => source.id === `${TAO}#40`);
        expect(chapter.data).toBe(await archiveDivision(TAO, 40));
        expect(chapter.name).toContain('Tao Te Ching');
        expect(chapter.name).not.toBe('Tao Te Ching');

        // And the editor the reader is left in front of holds it too.
        expect(workshop.sessionData.sources.map(source => source.id))
            .toEqual(['my-notes', `${TAO}#40`]);
        expect(workshop.sessionData.sources[1].data).toBe(await archiveDivision(TAO, 40));
    });

    it('loads an extent, and an extent shorter than the ask is the whole division', async () => {
        const { workshop, container } = makeWorkshop();

        await importThroughTheDoor(workshop, container, scoreNaming([`${TAO}#40:200`]));

        expect(refusalText()).toBeNull();
        const chapter = savedProjects[0].sources.find(source => source.id === `${TAO}#40:200`);
        expect(chapter).toBeDefined();
        expect(chapter.data).toBe(await archiveDivision(TAO, 40));
    });

    it('loads a whole work the score names', async () => {
        const { workshop, container } = makeWorkshop();

        await importThroughTheDoor(workshop, container, scoreNaming([TAO]));

        expect(refusalText()).toBeNull();
        const work = savedProjects[0].sources.find(source => source.id === TAO);
        expect(work).toBeDefined();
        expect(work.name).toBe('Tao Te Ching');
        // Not a length check: the fortieth chapter's own words must be inside
        // the whole work, and so must the first and the last.
        for (const ordinal of [1, 40, 81]) {
            expect(work.data).toContain(await archiveDivision(TAO, ordinal));
        }
    });

    it('keeps the reader\'s own copy of a source the score names', async () => {
        const { workshop, container } = makeWorkshop();
        // A Scriptorium draft reopened here carries its extents as ordinary
        // sources; importing a score that names one must not shelve a second.
        workshop.addSource(
            { id: `${TAO}#40`, name: 'Tao Te Ching · my edition', type: 'text/plain',
                data: 'The reader\'s own transcription of the fortieth chapter.' },
            { id: 'local' }
        );

        await importThroughTheDoor(workshop, container, scoreNaming([`${TAO}#40`]));

        expect(refusalText()).toBeNull();
        const { sources } = savedProjects[0];
        expect(sources.filter(source => source.id === `${TAO}#40`)).toHaveLength(1);
        expect(sources.find(source => source.id === `${TAO}#40`).data)
            .toBe('The reader\'s own transcription of the fortieth chapter.');
    });
});

describe('Import score refuses out loud rather than dropping a work', () => {
    it('names the work, the reason and the way out when a cut cannot be honoured', async () => {
        const { workshop, container } = makeWorkshop();

        // `ulysses#18` is 24,058 words and its first sentence boundary is
        // 5,714 words in, so an opening of 200 has no honest boundary inside
        // the overshoot cap. The catalogue cannot know that, so the gate admits
        // it and the refusal can only happen once the text is read.
        await importThroughTheDoor(workshop, container, scoreNaming(['ulysses#18:200']));

        const refusal = refusalText();
        expect(refusal).toContain('ulysses#18:200');
        expect(refusal).toContain('Ulysses');
        // THE MULTIPLE THE READER IS TOLD IS THE ONE THAT GOVERNED THE CUT.
        // This asserted the literal '1.6', which is the drift the export of
        // EXTENT_OVERSHOOT_LIMIT was made to end: change the constant and the
        // refusal would go on being checked against the number it no longer
        // says. The cap is quoted as a multiple, so `${limit}×` is the shape.
        expect(refusal).toContain(`${EXTENT_OVERSHOOT_LIMIT}×`);
        expect(refusal).toContain('"ulysses#18"');

        // Refused means refused: no Vault draft, and the surface untouched.
        expect(savedProjects).toEqual([]);
        expect(workshop.sessionData.sources.map(source => source.id)).toEqual(['my-notes']);
    });

    it('imports nothing at all when one of several works will not load', async () => {
        const { workshop, container } = makeWorkshop();

        await importThroughTheDoor(
            workshop, container, scoreNaming([`${TAO}#40`, 'ulysses#18:200'])
        );

        expect(refusalText()).toContain('ulysses#18:200');
        expect(savedProjects).toEqual([]);
        expect(MemoryCore.getWorkshopBlueprints()).toEqual([]);
        expect(workshop.sessionData.sources.map(source => source.id)).toEqual(['my-notes']);
        expect(workshop.sessionData.experienceProgram ?? null).toBeNull();
    });

    it('still refuses a work no session can hold, before a byte of it is read', async () => {
        const { workshop, container } = makeWorkshop();

        await importThroughTheDoor(workshop, container, scoreNaming(['middlemarch']));

        const refusal = refusalText();
        expect(refusal).toContain('PROGRAM_IO_ATOM_CEILING');
        expect(refusal).toContain('315,261');
        expect(savedProjects).toEqual([]);
        expect(workshop.sessionData.sources.map(source => source.id)).toEqual(['my-notes']);
    });
});
