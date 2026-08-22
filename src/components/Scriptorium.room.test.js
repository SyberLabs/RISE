/**
 * The Scriptorium, driven the way a reader drives it.
 *
 * A reading has more than one entrance, and a test written against the
 * entrance you just built proves only that two things can be wired together.
 * So these mount the room, click its controls, and assert what the reader is
 * left holding: bytes in the store, a clip still in the score, a length the
 * reading will actually keep.
 *
 * Two collaborators are stood in for, both at real seams:
 *   - the Library loader, because these tests are about what the room does
 *     with a resolved work rather than about the archive;
 *   - WorkshopMedia, because jsdom has no IndexedDB. The stub keeps the
 *     reader's File itself, so "the bytes are there" is a claim about the
 *     bytes and not about a call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scriptorium } from './Scriptorium.js';
import { MemoryCore } from '../core/memory.js';
import { WorkshopMedia, WorkshopMediaError } from '../core/workshop-media.js';
import { hydrateSessionSequenceAssets } from '../core/workshop-asset-durability.js';
import { workshopProjectToSessionConfig } from '../core/workshop-project.js';
import { boundarySourceId, isBoundarySource } from '../core/journey-compiler.js';
import {
    MAX_SAFE_TARGET_WORDS,
    READING_LIMITS,
    WORST_MEASURED_DIVISION
} from '../core/reading-limits.js';
import { clampTargetWords, SCRIPTORIUM_LENGTH } from '../core/scriptorium-session.js';
import { resolveProgramLibrarySources } from '../core/scriptorium-resolve.js';

vi.mock('../core/scriptorium-resolve.js', async (importOriginal) => ({
    ...(await importOriginal()),
    resolveProgramLibrarySources: vi.fn()
}));

/**
 * WHICH IDS THE REAL RESOLVER WOULD LOAD.
 *
 * The stub below used to derive them with `.filter(track => track.kind ===
 * 'movement')`, and the real resolver does not filter by kind at all: it walks
 * every track, every clip, and takes `sourceIds` plus `afterSourceId` and
 * `beforeSourceId`, skipping only authored transition boundaries.
 *
 * That difference is not a convenience. The budget the gate spends looks only
 * at movement tracks, and the resolver loads every track's sources — so a score
 * naming a novel on a TRANSITION track is charged nothing and read entire. A
 * stub that filtered by kind asserted the exact assumption that bypass breaks,
 * which meant no test in this file could ever see it: the stub returned one
 * 38-word chapter for a score that reads a 315,261-word novel, and every
 * assertion downstream was made against the wrong answer.
 *
 * So this is programSourceIds' own logic, and the guard below it runs the real
 * resolver on the same programs and requires the same ids — because a mock
 * whose fidelity nothing checks is a second implementation, which is the defect
 * this codebase names first (law 5).
 */
function librarySourceIdsForScore(program) {
    const ids = new Set();
    for (const track of program?.tracks || []) {
        for (const clip of track.clips || []) {
            for (const sourceId of clip.anchor?.sourceIds || []) {
                if (isBoundarySource(sourceId)) continue;
                ids.add(sourceId);
            }
            const after = clip.anchor?.afterSourceId;
            const before = clip.anchor?.beforeSourceId;
            if (after && !isBoundarySource(after)) ids.add(after);
            if (before && !isBoundarySource(before)) ids.add(before);
        }
    }
    return [...ids];
}

/**
 * The stub itself, once, so the guard below checks the thing the room is given.
 *
 * A first attempt had the guard compare `librarySourceIdsForScore` to the real
 * resolver, which a mutation of the stub survived: the guard was checking the
 * helper and the room was using something else. What has to be one function is
 * one function.
 */
const stubResolveProgramLibrarySources = async (program) => {
    const ids = librarySourceIdsForScore(program);
    return {
        sources: ids.map(id => ({
            id,
            name: id,
            providerId: 'archive-ingest',
            type: 'text/plain',
            data: 'Still water reflects the moon, and the moon does not stay.'
        })),
        missing: [],
        refused: []
    };
};

// jsdom decodes no video, so the one measurement an MP4 needs is stood in for.
// Everything else in materials.js is the real thing.
vi.mock('../core/materials.js', async (importOriginal) => ({
    ...(await importOriginal()),
    probeVideoDurationMs: vi.fn(async () => 11_000)
}));

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);

function png(name = 'cliff-at-dusk.png') {
    return new File([PNG_BYTES], name, { type: 'image/png' });
}

/** A store that holds the blob it was handed, so a round trip is a round trip. */
function stubWorkshopMedia() {
    const records = new Map();
    vi.spyOn(WorkshopMedia, 'put').mockImplementation(async ({ id, projectId, data, mimeType }) => {
        const meta = {
            id,
            projectId,
            mimeType: mimeType || data.type,
            byteLength: data.size
        };
        records.set(id, { ...meta, data });
        return meta;
    });
    vi.spyOn(WorkshopMedia, 'get').mockImplementation(async id => records.get(id) || null);
    vi.spyOn(WorkshopMedia, 'has').mockImplementation(async id => records.has(id));
    vi.spyOn(WorkshopMedia, 'delete').mockImplementation(async (id) => { records.delete(id); });
    vi.spyOn(WorkshopMedia, 'resolveObjectUrl').mockImplementation(async (id) => {
        const record = records.get(id);
        if (!record) {
            throw new WorkshopMediaError('WORKSHOP_MEDIA_MISSING', `Workshop media ${id} is missing.`);
        }
        return URL.createObjectURL(record.data);
    });
    return records;
}

function score({ sourceId, assetId = null, id = 'a-photograph-and-a-poem' }) {
    const tracks = [{
        id: 'movements',
        kind: 'movement',
        clips: [{ id: 'm1', anchor: { sourceIds: [sourceId] }, data: { index: 0, title: 'One' } }]
    }];
    if (assetId) {
        tracks.push({
            id: 'visual-main',
            kind: 'visual',
            clips: [{
                id: 'v1',
                anchor: { sourceIds: [sourceId] },
                cue: { kind: 'sourced', collections: [`sequence-asset:${assetId}`] }
            }],
            fallback: { kind: 'still' }
        });
    }
    return JSON.stringify({
        schema: 'rise.experience-program.v1',
        id,
        authority: 'proposed',
        editable: true,
        tracks
    });
}

describe('the Scriptorium as the reader meets it', () => {
    let container;
    let room;
    let onNavigate;
    let onCreateSession;
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
    /** The smallest work the shelf holds, so a default budget covers it. */
    const shortestWork = () => {
        if (!room.context) click('prepare-take');
        return room.context.library
            .filter(entry => Number.isInteger(entry.words))
            .reduce((shortest, entry) => (entry.words < shortest.words ? entry : shortest));
    };

    /**
     * The rung a reader would reach for to hold this work whole.
     *
     * The default was 20,000 words and is now 4,000, so a whole work no
     * longer fits by default — and the shortest work on the shelf is 10,321.
     * A test that wants a whole reading has to ask for the length a reader
     * would have to ask for, which is the ladder doing its job rather than a
     * fixture to work around.
     */
    const lengthHolding = (entry) => {
        const rung = SCRIPTORIUM_LENGTH.rungs.find(words => words >= entry.words);
        expect(rung, `no rung holds ${entry.id} (${entry.words} words)`).toBeTruthy();
        slideTo(rung);
        return rung;
    };

    beforeEach(() => {
        localStorage.clear();
        global.URL.createObjectURL = vi.fn(() => `blob:scriptorium/${Math.random()}`);
        global.URL.revokeObjectURL = vi.fn();
        stubWorkshopMedia();
        globalThis.rise = { settings: { defaultWpm: 220 } };
        created = [];
        onNavigate = vi.fn();
        onCreateSession = vi.fn(project => { created.push(project); });
        container = document.createElement('div');
        room = new Scriptorium(container, { onNavigate, onCreateSession });
        room.mount();
        resolveProgramLibrarySources.mockImplementation(stubResolveProgramLibrarySources);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.rise;
    });

    describe('one click, one action (D8)', () => {
        it('invokes Examine once', () => {
            const examine = vi.spyOn(room, 'examine').mockImplementation(() => {});
            click('examine');
            expect(examine).toHaveBeenCalledTimes(1);
        });

        it('leaves for the Portal once', () => {
            click('back');
            expect(onNavigate).toHaveBeenCalledTimes(1);
        });

        it('keeps one Vault draft for one click on Keep', async () => {
            lengthHolding(shortestWork());
            paste(score({ sourceId: shortestWork().id }));
            click('examine');
            click('keep');
            await vi.waitFor(() => expect(room.status).toMatch(/Kept in the Vault/));
            expect(MemoryCore.getWorkshopBlueprints()).toHaveLength(1);
        });
    });

    describe('the length the reader set (D5, D9, D12)', () => {
        it('offers no length the compiler would refuse', () => {
            const slider = container.querySelector('#scriptorium-length');
            // An atom is not a word: word chunking adds a paragraph-break atom
            // per paragraph, so the atom cap as a word budget was a trap at the
            // top of the travel — accepted at the gate, thrown at Begin.
            // The dial is an index over nine rungs; the budget it reaches is
            // the top rung, which is what must compile.
            expect(Number(slider.max)).toBe(SCRIPTORIUM_LENGTH.rungs.length - 1);
            slideTo(999_999);
            const highest = SCRIPTORIUM_LENGTH.rungs[SCRIPTORIUM_LENGTH.rungs.length - 1];
            expect(room.targetWords).toBe(highest);
            expect(highest).toBeLessThanOrEqual(MAX_SAFE_TARGET_WORDS);

            // AND THE TOP OF THE TRAVEL IS A LENGTH THAT COMPILES, measured
            // against the densest division the shelf actually holds rather
            // than against the cap itself. What stood here was
            // `expect(slider.max).toBeLessThan(READING_LIMITS.maxAtoms)`,
            // which can only fail if a word costs less than an atom — it was
            // true of the 120,000 that threw at Begin, and the line below it
            // was doing all the work.
            const densest = WORST_MEASURED_DIVISION.atoms / WORST_MEASURED_DIVISION.words;
            expect(
                Math.ceil(highest * densest),
                `a reading of ${highest.toLocaleString()} words at the shelf's `
                + 'own worst density does not fit in one session'
            ).toBeLessThanOrEqual(READING_LIMITS.maxAtoms);
        });

        it('quotes the pace the reading will open at', () => {
            const readout = container.querySelector('#scriptorium-length-readout').textContent;
            // The default rung at the reader's 220 wpm, not at a 320 nobody set.
            expect(readout).toContain('220 wpm');
            expect(readout).toContain('18 min');
        });

        it('opens the reading at that same pace', async () => {
            lengthHolding(shortestWork());
            paste(score({ sourceId: shortestWork().id }));
            click('examine');
            click('begin');
            await vi.waitFor(() => expect(created).toHaveLength(1));
            expect(workshopProjectToSessionConfig(created[0]).wpm).toBe(220);
        });

        it('measures the score against the length on the slider', () => {
            // A take prepared at one length, then the slider raised — which is
            // exactly what the old refusal advised the reader to do.
            click('prepare-take');
            const highest = SCRIPTORIUM_LENGTH.rungs[SCRIPTORIUM_LENGTH.rungs.length - 1];
            const long = room.context.library.find(entry =>
                entry.words > SCRIPTORIUM_LENGTH.default && entry.words <= highest);
            expect(long, 'the shelf needs one work above the default rung').toBeTruthy();
            lengthHolding(long);
            paste(score({ sourceId: long.id }));
            click('examine');
            expect(room.verdict.text).toBeNull();
            expect(room.verdict.ok).toBe(true);
        });
    });

    describe('what the reader brought (D2, D3, D16)', () => {
        it('says both the refusal and the re-export, in the panel', async () => {
            await room.addMaterials([
                png('ok.png'),
                new File([new Uint8Array(8)], 'notes.pdf', { type: 'application/pdf' })
            ]);
            const notice = container.querySelector('.scriptorium-material-notice').textContent;
            expect(room.materials).toHaveLength(1);
            expect(notice).toMatch(/notes\.pdf/);
            expect(notice).toMatch(/Take the prompt again/);
            // In the panel the reader was using, not six sections below it.
            expect(container.querySelector('.scriptorium-materials')
                .contains(container.querySelector('.scriptorium-material-notice'))).toBe(true);
        });

        it('has the bytes in the store when the reading opens', async () => {
            const file = png();
            await room.addMaterials([file]);
            const assetId = room.materials[0].id;
            lengthHolding(shortestWork());
            paste(score({ sourceId: shortestWork().id, assetId }));
            click('examine');
            click('begin');
            await vi.waitFor(() => expect(created).toHaveLength(1));

            const held = await WorkshopMedia.get(assetId);
            expect(held?.data).toBe(file);
            expect(held.byteLength).toBe(file.size);

            // The app's own next step, verbatim: hydrate, then compile.
            const sessionInput = await hydrateSessionSequenceAssets(
                workshopProjectToSessionConfig(created[0]));
            expect(sessionInput.missingSequenceAssets).toBeUndefined();
            expect(sessionInput.sequenceVisualAssets).toHaveLength(1);
            expect(URL.createObjectURL).toHaveBeenCalledWith(file);
            const visual = sessionInput.experienceProgram.tracks.find(t => t.kind === 'visual');
            expect(visual.clips).toHaveLength(1);
        });

        it('refuses a video scored as an image by naming the fault (D6)', async () => {
            const clip = new File([PNG_BYTES], 'harbour.mp4', { type: 'video/mp4' });
            await room.addMaterials([clip]);
            const assetId = room.materials[0].id;
            expect(room.materials[0].kind).toBe('video');

            // The prompt teaches no video cue, so this is the score that comes
            // back for an MP4.
            lengthHolding(shortestWork());
            paste(score({ sourceId: shortestWork().id, assetId }));
            click('examine');
            expect(room.verdict.ok).toBe(true);

            click('begin');
            await vi.waitFor(() => expect(room.verdict.ok).toBe(false));
            expect(created).toHaveLength(0);
            // Not "missing" — it is in the panel above.
            expect(room.verdict.text).not.toMatch(/missing/i);
            expect(room.verdict.text).toContain('harbour.mp4');
            expect(room.verdict.text).toContain('that file is a video');
            expect(room.verdict.text).toContain('"kind": "video"');
            expect(room.status).toBe('Refused.');
        });

        it('opens a reading whose video is scored with a video cue (D6)', async () => {
            const clip = new File([PNG_BYTES], 'harbour.mp4', { type: 'video/mp4' });
            await room.addMaterials([clip]);
            const assetId = room.materials[0].id;
            const work = shortestWork();
            const sourceId = work.id;
            lengthHolding(work);
            paste(JSON.stringify({
                schema: 'rise.experience-program.v1',
                id: 'a-harbour',
                authority: 'proposed',
                editable: true,
                tracks: [
                    {
                        id: 'movements',
                        kind: 'movement',
                        clips: [{
                            id: 'm1',
                            anchor: { sourceIds: [sourceId] },
                            data: { index: 0, title: 'One' }
                        }]
                    },
                    {
                        id: 'visual-main',
                        kind: 'visual',
                        clips: [{
                            id: 'v1',
                            anchor: { sourceIds: [sourceId] },
                            cue: {
                                kind: 'video', assetId, timeMode: 'loop',
                                audioPolicy: 'muted', reducedMotion: 'poster'
                            }
                        }],
                        fallback: { kind: 'still' }
                    }
                ]
            }));
            click('examine');
            expect(room.verdict.ok).toBe(true);
            click('begin');
            await vi.waitFor(() => expect(created).toHaveLength(1));
            expect(created[0].assets[0]).toMatchObject({ kind: 'video', durationMs: 11_000 });
            expect((await WorkshopMedia.get(assetId))?.data).toBe(clip);
        });

        it('has the bytes in the store behind a Vault draft', async () => {
            const file = png();
            await room.addMaterials([file]);
            const assetId = room.materials[0].id;
            lengthHolding(shortestWork());
            paste(score({ sourceId: shortestWork().id, assetId }));
            click('examine');
            click('keep');
            await vi.waitFor(() => expect(room.status).toMatch(/Kept in the Vault/));

            const [draft] = MemoryCore.getWorkshopBlueprints();
            expect(draft.assets.map(asset => asset.id)).toEqual([assetId]);
            const held = await WorkshopMedia.get(assetId);
            expect(held?.data).toBe(file);
            expect(held.byteLength).toBe(file.size);
        });
    });

    /**
     * THE ROOM IS A VIEW, AND THAT HAS TO MEAN IT READS THROUGH.
     *
     * scriptorium-session.test.js asserts that fifteen named fields are not own
     * properties of the room. A shadow copy under a sixteenth name defeats that
     * outright, and it is not a theoretical attack — this passed every
     * Scriptorium file:
     *
     *   this.shadowPreview = null;
     *   get preview() {
     *     if (this.session.preview) this.shadowPreview = this.session.preview;
     *     return this.shadowPreview;
     *   }
     *
     * `'preview' in room` is true, `preview` is not an own property name, and
     * the room presents the previous score's chosen works beside a fresh
     * refusal. So absence of a name is the wrong claim. What is worth asserting
     * is that for every field the room reports the session's CURRENT value —
     * including when that value has just become nothing, which is the only
     * moment a cache and a getter tell different stories.
     */
    describe('the room reads every field through to the session', () => {
        /** Exactly the state ScriptoriumSession owns. */
        const SEQUENCE_STATE = Object.freeze([
            'intent', 'targetWords', 'materials', 'swells', 'localWorks',
            'context', 'promptText', 'pasted', 'program', 'operationSet',
            'proposalRows', 'preview', 'rundown', 'verdict', 'projectId', 'status'
        ]);

        it('covers every field the session holds, so the list cannot fall behind', () => {
            // A field added to the session and not to this list would be a
            // field nothing below proves anything about.
            const held = Object.getOwnPropertyNames(room.session)
                .filter(name => !['wpmOverride', 'prepareAssets', 'mintId', 'producer']
                    .includes(name));
            expect([...held].sort()).toEqual([...SEQUENCE_STATE].sort());
        });

        it('reports whatever the session currently holds, and forgets when it does', () => {
            for (const field of SEQUENCE_STATE) {
                const first = { field, generation: 1 };
                const second = { field, generation: 2 };
                room.session[field] = first;
                expect(room[field], `${field} is not read from the session`).toBe(first);
                // NO CACHE. A getter that remembered its first answer passes the
                // line above and fails this one.
                room.session[field] = second;
                expect(room[field], `${field} kept a stale value`).toBe(second);
                // AND NO MEMORY OF A VALUE THE SESSION HAS DROPPED. This is the
                // line the shadow copy fails: `if (this.session.preview)` never
                // fires for null, so the room goes on presenting `second`.
                room.session[field] = null;
                expect(room[field], `${field} survived being cleared on the session`).toBeNull();
            }
        });

        it('holds no copy of the session\'s state under any name', () => {
            // NOT A LIST OF NAMES. The room is driven to an accepted score, the
            // identities the session then holds are captured, the score is
            // refused, and the room is searched for any of them. A shadow field
            // is caught whatever it is called, because what is looked for is the
            // VALUE the session has since discarded.
            lengthHolding(shortestWork());
            paste(score({ sourceId: shortestWork().id }));
            click('examine');
            expect(room.verdict.ok).toBe(true);
            const discarded = new Set([room.program, room.preview, room.rundown, room.verdict]
                .filter(value => value && typeof value === 'object'));
            expect(discarded.size).toBe(4);

            paste('{ "schema": "rise.experience-program.v1"');
            click('examine');
            expect(room.verdict.ok).toBe(false);
            expect(room.program).toBeNull();
            expect(room.preview).toBeNull();
            expect(room.rundown).toBeNull();

            for (const [name, value] of Object.entries(room)) {
                expect(discarded.has(value),
                    `Scriptorium.${name} still holds a value the refusal discarded`).toBe(false);
            }
            for (const value of Object.values(room.session)) {
                expect(discarded.has(value),
                    'the session still holds a value the refusal discarded').toBe(false);
            }
        });

        it('shows the reader a refusal without the last score\'s reading beside it', () => {
            // The reader-facing shape of the same defect, asserted where the
            // reader sees it: section 5 is what the room says the reading holds,
            // and after a refusal it must say nothing about a reading.
            const work = shortestWork();
            paste(score({ sourceId: work.id }));
            click('examine');
            expect(container.textContent).toContain(work.id);

            paste('{ "schema": "rise.experience-program.v1"');
            click('examine');
            const reading = container.querySelector(
                '[aria-labelledby="scriptorium-preview-title"]').textContent;
            expect(reading).not.toContain(work.id);
            expect(reading).toMatch(/appears after a score is accepted/);
            expect(container.querySelector('#scriptorium-refusal')).not.toBeNull();
        });
    });
});

/**
 * THE STUB HAS TO BE THE RESOLVER, or the room is tested against a fiction.
 *
 * The mock above stands in for the Library loader, which is a real seam. What it
 * must not stand in for is the resolver's decision about WHICH ids to load —
 * that decision is where the live budget bypass lives, and a stub that made it
 * differently was a stub that could not see it.
 *
 * The real resolver is imported unmocked here and asked about works no shelf
 * holds, so it reports every id as missing without reading a byte. Its answer
 * and the stub's are then required to be the same set.
 */
/**
 * THE VERDICT TABLE THAT WAS HERE IS NOW IN scriptorium-cli.test.js.
 *
 * It was built here, with pinned codes, while the agreement table over there
 * had none — a stopgap, and honestly labelled as one. Both tables listed
 * substantially the same scores; one vocabulary in two places (law 5), and the
 * weaker of the two could pass alone, which is the arrangement this codebase
 * keeps paying for.
 *
 * That table now pins the code AND the exit status for every case, so these
 * are folded into it: the smuggling shapes, both ordinal spellings, the fence
 * and the budget figure among them. Folded UP rather than down, because that
 * table drives the room and argv both, so each expectation is now asserted at
 * two doors instead of one.
 *
 * WHAT THE FIRST FOLD LOST was the assertion only this side can make.
 * `room.status === 'Refused.'` is a claim about `ScriptoriumSession.isRefusal`
 * — the CLI prints the verdict text and never reads the status — and it went
 * over as one line for one case rather than per case. Deleting a class from
 * `isRefusal` then left the whole suite green while a raw exception with a
 * JSON path reached the reader's status line. It is asserted per refusing case
 * in that table now, where it fails eighteen times instead of not at all, and
 * the claim about the ordinal in the paragraph above is now true of both
 * spellings rather than only of `#0`.
 */
describe('the resolver stub names the ids the real resolver names', () => {
    const clip = (id, anchor) => ({ id, anchor, data: { index: 0, title: id } });
    const PROGRAMS = Object.freeze([
        {
            what: 'a movement track',
            tracks: [{ id: 'm', kind: 'movement', clips: [clip('m1', { sourceIds: ['nowhere-a'] })] }]
        },
        {
            what: 'a novel on a transition track beside a chapter on a movement',
            tracks: [
                { id: 'm', kind: 'movement', clips: [clip('m1', { sourceIds: ['nowhere-a'] })] },
                {
                    id: 't',
                    kind: 'transition',
                    clips: [{
                        id: 't1',
                        anchor: { sourceIds: ['nowhere-novel'], afterSourceId: 'nowhere-a' },
                        data: { fromMovementId: 'm1' },
                        durationMs: 1_000
                    }]
                }
            ]
        },
        {
            what: 'a visual track naming a source of its own',
            tracks: [
                { id: 'm', kind: 'movement', clips: [clip('m1', { sourceIds: ['nowhere-a'] })] },
                {
                    id: 'v',
                    kind: 'visual',
                    fallback: { kind: 'still' },
                    clips: [{
                        id: 'v1',
                        anchor: { sourceIds: ['nowhere-b'] },
                        cue: { kind: 'sourced', collections: ['aic-nothing'] }
                    }]
                }
            ]
        },
        {
            what: 'anchors that name a neighbour rather than a source',
            tracks: [{
                id: 'm',
                kind: 'movement',
                clips: [{
                    id: 'm1',
                    anchor: {
                        sourceIds: ['nowhere-a'],
                        afterSourceId: 'nowhere-before',
                        beforeSourceId: 'nowhere-after'
                    },
                    data: { index: 0, title: 'One' }
                }]
            }]
        },
        {
            what: 'an authored transition boundary, which is not a text',
            tracks: [{
                id: 'm',
                kind: 'movement',
                clips: [clip('m1', { sourceIds: ['nowhere-a', boundarySourceId('to-hero')] })]
            }]
        },
        {
            what: 'the same id named twice',
            tracks: [{
                id: 'm',
                kind: 'movement',
                clips: [clip('m1', { sourceIds: ['nowhere-a'] }), clip('m2', { sourceIds: ['nowhere-a'] })]
            }]
        }
    ]);

    for (const { what, tracks } of PROGRAMS) {
        it(`agrees about ${what}`, async () => {
            const program = {
                schema: 'rise.experience-program.v1',
                id: 'fidelity',
                authority: 'proposed',
                editable: true,
                tracks
            };
            const actual = await vi.importActual('../core/scriptorium-resolve.js');
            const { sources, missing, refused } =
                await actual.resolveProgramLibrarySources(program);
            expect(sources, 'no id here should be on any shelf').toEqual([]);
            const real = [...missing, ...refused].sort();
            expect(real.length).toBeGreaterThan(0);
            // ASKED OF THE STUB, not of the helper behind it. The room is handed
            // this function; a guard that re-derived the ids beside it would be
            // checking its own arithmetic.
            const stubbed = await stubResolveProgramLibrarySources(program);
            expect(
                stubbed.sources.map(source => source.id).sort(),
                `the stub and the resolver disagree about ${what}`
            ).toEqual(real);
        });
    }
});
