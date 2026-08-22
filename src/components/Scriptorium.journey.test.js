/**
 * THE WHOLE PATH A READER WALKS, with the real Library behind it.
 *
 * Scriptorium.room.test.js mocks resolveProgramLibrarySources, so the extent
 * grammar is never actually asked to produce bytes there — every assertion in
 * that file is about what the room does with a source it was handed. This
 * file drives the same room with nothing standing in on the Library side:
 * upload, slider, prompt, paste, examine, begin, compile, and then the words
 * the reader ends up reading.
 *
 * That is the difference the budget promise needs. The gate charges a score
 * from the CATALOGUE, before a byte is loaded; the cut happens later against
 * the real text. A test that mocks the second half can only prove the two
 * halves are wired together, never that the second stays inside the first.
 *
 * Only WorkshopMedia is stood in for (jsdom has no IndexedDB), and the stub
 * keeps the reader's File itself, so "the bytes are there" is a claim about
 * bytes and not about a call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scriptorium } from './Scriptorium.js';
import { clampTargetWords, SCRIPTORIUM_LENGTH } from '../core/scriptorium-session.js';
import { WorkshopMedia, WorkshopMediaError } from '../core/workshop-media.js';
import { hydrateSessionSequenceAssets } from '../core/workshop-asset-durability.js';
import { workshopProjectToSessionConfig } from '../core/workshop-project.js';
import { compileSession } from '../core/session-compiler.js';
import { countWords } from '../core/chunker.js';
import { createCuratorSourceReader } from '../core/curator-context.js';
import { MAX_WORDS_TO_ATOMS } from '../core/reading-limits.js';
import { ingestedArchiveTexts } from '../content/archive/index.js';

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);

function stubWorkshopMedia() {
    const records = new Map();
    vi.spyOn(WorkshopMedia, 'put').mockImplementation(async ({ id, projectId, data, mimeType }) => {
        const meta = { id, projectId, mimeType: mimeType || data.type, byteLength: data.size };
        records.set(id, { ...meta, data });
        return meta;
    });
    vi.spyOn(WorkshopMedia, 'get').mockImplementation(async id => records.get(id) || null);
    vi.spyOn(WorkshopMedia, 'has').mockImplementation(async id => records.has(id));
    vi.spyOn(WorkshopMedia, 'delete').mockImplementation(async (id) => { records.delete(id); });
    vi.spyOn(WorkshopMedia, 'resolveObjectUrl').mockImplementation(async (id) => {
        const record = records.get(id);
        if (!record) throw new WorkshopMediaError('WORKSHOP_MEDIA_MISSING', `missing ${id}`);
        return `blob:hydrated/${id}`;
    });
    return records;
}

/** The words the archive itself holds for a division, read independently. */
async function archiveDivision(workId, ordinal) {
    const work = ingestedArchiveTexts().find(item => item.id === workId);
    const scheme = await work.getDivisions();
    return scheme.entries[ordinal - 1];
}

describe('one reader, one path, real Library', () => {
    let container;
    let room;
    let created;

    const paste = (text) => {
        const field = container.querySelector('#scriptorium-paste');
        field.value = text;
        field.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const click = (action) => container.querySelector(`[data-action="${action}"]`).click();
    /** The reader moves a nine-stop dial; the session stores the rung's words. */
    const slideTo = (words) => {
        const slider = container.querySelector('#scriptorium-length');
        slider.value = String(SCRIPTORIUM_LENGTH.rungs.indexOf(clampTargetWords(words)));
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true }));
    };

    beforeEach(() => {
        localStorage.clear();
        global.URL.createObjectURL = vi.fn(file => `blob:staged/${file?.name || 'x'}`);
        global.URL.revokeObjectURL = vi.fn();
        stubWorkshopMedia();
        globalThis.rise = { settings: { defaultWpm: 220 } };
        created = [];
        container = document.createElement('div');
        room = new Scriptorium(container, {
            onNavigate: vi.fn(),
            onCreateSession: vi.fn(project => { created.push(project); })
        });
        room.mount();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.rise;
    });

    it('carries an image and two extents from upload to compiled atoms', async () => {
        // ---- 1. upload an image -------------------------------------------
        const file = new File([PNG_BYTES], 'cliff-at-dusk.png', { type: 'image/png' });
        await room.addMaterials([file]);
        const assetId = room.materials[0].id;
        // A still carries no `kind` — createSequenceVisualAsset names only video.
        expect(room.materials[0].mimeType).toBe('image/png');
        expect(room.materials[0].kind).toBeUndefined();

        // ---- 2. a SHORT length --------------------------------------------
        slideTo(1000);
        expect(room.targetWords).toBe(1000);

        // ---- 3. the prompt, built from the live context --------------------
        click('prepare-take');
        expect(room.promptText).toContain('cliff-at-dusk.png');
        expect(room.promptText).toMatch(/about 1,?000 words/);
        expect(room.context.constraints.targetWords).toBe(1000);
        expect(room.context.catalog.collections[`sequence-asset:${assetId}`])
            .toMatchObject({ mediaKind: 'image' });

        // ---- 4. a score naming the asset AND two extent ids ----------------
        const WHOLE_DIVISION = 'sacred-tao-te-ching#40';
        const OPENING = 'oedipus-rex#1:200';
        paste(JSON.stringify({
            schema: 'rise.experience-program.v1',
            id: 'cliff-and-two-openings',
            authority: 'proposed',
            editable: true,
            tracks: [
                {
                    id: 'movements',
                    kind: 'movement',
                    clips: [
                        { id: 'm1', anchor: { sourceIds: [WHOLE_DIVISION] }, data: { index: 0, title: 'Tao XL' } },
                        { id: 'm2', anchor: { sourceIds: [OPENING] }, data: { index: 1, title: 'Oedipus, opening' } }
                    ]
                },
                {
                    id: 'visual-main',
                    kind: 'visual',
                    fallback: { kind: 'still' },
                    clips: [{
                        id: 'v1',
                        anchor: { sourceIds: [WHOLE_DIVISION] },
                        cue: { kind: 'sourced', collections: [`sequence-asset:${assetId}`] }
                    }]
                }
            ]
        }));

        // ---- 5. examine: the gate --------------------------------------
        click('examine');
        expect(room.verdict.text).toBeNull();
        expect(room.verdict.ok).toBe(true);

        // WHAT THE GATE CHARGED, from the same reader the gate used.
        const read = createCuratorSourceReader(room.context);
        const charged = [WHOLE_DIVISION, OPENING].map(id => read(id).words);
        expect(charged.every(Number.isInteger)).toBe(true);
        const chargedTotal = charged.reduce((a, b) => a + b, 0);
        expect(chargedTotal).toBeLessThanOrEqual(1000);

        // ---- 6. begin: real resolution, real bytes -------------------------
        click('begin');
        await vi.waitFor(() => {
            expect(room.verdict.ok, `refused at Begin: ${room.verdict.text}`).toBe(true);
            expect(created).toHaveLength(1);
        }, { timeout: 20_000 });

        const project = created[0];

        // ---- the image ------------------------------------------------------
        const held = await WorkshopMedia.get(assetId);
        expect(held?.data).toBe(file);
        expect(held.byteLength).toBe(file.size);

        const sessionInput = await hydrateSessionSequenceAssets(
            workshopProjectToSessionConfig(project));
        expect(sessionInput.missingSequenceAssets).toBeUndefined();
        expect(sessionInput.sequenceVisualAssets).toHaveLength(1);
        expect(sessionInput.sequenceVisualAssets[0].uri).toBe(`blob:hydrated/${assetId}`);
        const visualTrack = sessionInput.experienceProgram.tracks.find(t => t.kind === 'visual');
        expect(visualTrack.clips).toHaveLength(1);
        expect(visualTrack.clips[0].cue.collections).toEqual([`sequence-asset:${assetId}`]);

        // ---- THE RIGHT WORDS -----------------------------------------------
        const bySource = new Map(project.sources.map(s => [s.id, s]));
        expect([...bySource.keys()].sort()).toEqual([OPENING, WHOLE_DIVISION].sort());

        const tao40 = await archiveDivision('sacred-tao-te-ching', 40);
        expect(bySource.get(WHOLE_DIVISION).data.trim()).toBe(tao40.content.trim());
        expect(bySource.get(WHOLE_DIVISION).data).toMatch(/movement of the Tao/i);
        expect(bySource.get(WHOLE_DIVISION).name).toContain('Chapter XL');

        const oedipus = await archiveDivision('oedipus-rex', 1);
        const openingText = bySource.get(OPENING).data;
        // An OPENING: a real prefix of the division, not the whole of it,
        // and not some other division's text.
        expect(oedipus.content.trim().startsWith(openingText.trim().slice(0, 120))).toBe(true);
        expect(openingText.length).toBeLessThan(oedipus.content.length);
        expect(bySource.get(OPENING).name).toMatch(/opening/);

        // ---- THE PROMISE THE BUDGET MADE ------------------------------------
        const actual = project.sources.map(s => countWords(s.data));
        const actualTotal = actual.reduce((a, b) => a + b, 0);
        for (const [index, source] of project.sources.entries()) {
            expect(
                actual[index],
                `${source.id} reads ${actual[index]} words; the gate charged ${read(source.id).words}`
            ).toBeLessThanOrEqual(read(source.id).words);
        }
        expect(actualTotal).toBeLessThanOrEqual(chargedTotal);
        expect(actualTotal).toBeLessThanOrEqual(1000);

        // ---- and it actually compiles ---------------------------------------
        const session = compileSession(sessionInput);
        expect(session.atoms.length).toBeGreaterThan(0);
        // The same ratio the reading ceiling is built on, spent on a real
        // reading rather than asserted about the shelf in the abstract.
        expect(session.atoms.length)
            .toBeLessThanOrEqual(Math.ceil(chargedTotal * MAX_WORDS_TO_ATOMS));
    }, 60_000);

    /**
     * THE SLIDER'S COMMIT REBUILDS WHAT THE READER IS ABOUT TO COPY.
     *
     * Nothing else in the suite can see this listener. examine() rebuilds the
     * take when the budget no longer matches the slider, and prepare-take
     * rebuilds unconditionally, so deleting the body of the `change` handler
     * leaves every other test passing. The reader it fails is the one who
     * moves the slider and presses Copy prompt without pressing Prepare again
     * — they hand the model a length they can no longer see on screen, and
     * the score that comes back is then refused against the length they DID
     * set. Which is the refusal that used to advise them to raise it.
     */
    it('rebuilds the prompt the reader copies when the slider commits', () => {
        click('prepare-take');
        expect(room.promptText).toMatch(/about 4,?000 words/);
        slideTo(1000);
        // No second press of Prepare. This is the Copy prompt button's text.
        expect(room.promptText).toMatch(/about 1,?000 words/);
        expect(room.context.constraints.targetWords).toBe(1000);
    });
});
