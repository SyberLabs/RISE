/**
 * Reader text becomes a Library work with addressable parts.
 *
 * Before this, there was no path at all: Library upload read the file into
 * the Chamber and forgot it, `buildLibraryCatalogue` walked the archive only,
 * and `resolveLibrarySourceIds` loaded from `ingestedArchiveTexts`. The extent
 * grammar has always been able to say `local-april-diary#4`; nothing has ever
 * been able to answer.
 *
 * These drive the sequence a reader drives — admit, take, examine, read —
 * because the four helpers each passing in isolation is exactly what a
 * four-hop allowlist looked like the last time one of them dropped a field.
 */
import { describe, expect, it } from 'vitest';
import { relabel } from './partition.js';
import { createScriptoriumSession } from './scriptorium-session.js';
import {
    draftLocalWork,
    localWorkCatalogue,
    localWorkParts,
    LOCAL_WORK_PREFIX,
    validateLocalWork
} from './local-works.js';
import { ingestedArchiveTexts } from '../content/archive/index.js';
import { countWords } from './chunker.js';

/** Long enough that the divider divides: it wants roughly 12,000 words. */
const BOOK = Array.from({ length: 8 }, (unused, n) =>
    `CHAPTER ${n + 1}\n\n` + Array.from({ length: 60 }, (ignored, i) =>
        `Paragraph ${i} of chapter ${n + 1}. ` + 'word '.repeat(28)).join('\n\n')).join('\n\n');

const admit = (session, text = BOOK, sourceName = 'a-book.md') =>
    session.addLocalWork(draftLocalWork({ text, sourceName }));

describe('the record', () => {
    it('partitions the text — every word once, no gaps', () => {
        const work = draftLocalWork({ text: BOOK, sourceName: 'a-book.md' });
        const parts = localWorkParts(work);
        expect(parts.length).toBeGreaterThan(1);
        // The joints span the text and ascend; the parts are what lies between.
        expect(work.cuts[0]).toBe(0);
        expect(work.cuts[work.cuts.length - 1]).toBe(BOOK.length);
        const rejoined = parts.map(part => part.content).join('\n');
        expect(countWords(rejoined)).toBe(countWords(BOOK));
    });

    it('says whose scheme it is by looking at the names', () => {
        // The prompt reads this: a measured work is one the model should point
        // at by progress rather than name as "Reading 4". A book whose own
        // sections are titled is `titled` — the divider read the names, it did
        // not invent them — and only a person typing makes it `reader`.
        const wall = draftLocalWork({ text: 'a '.repeat(400), sourceName: 'wall.txt' });
        expect(wall.labels).toEqual(['Reading 1']);
        expect(wall).toMatchObject({ authored: false, reason: 'measured' });

        const book = draftLocalWork({ text: BOOK, sourceName: 'a-book.md' });
        expect(book).toMatchObject({ authored: true, reason: 'titled' });

        const named = relabel(book, 0, 'What I called it');
        expect(named).toMatchObject({ authored: true, reason: 'reader' });
    });

    it('refuses a partition that does not cover the text', () => {
        const work = draftLocalWork({ text: BOOK, sourceName: 'a-book.md' });
        expect(() => validateLocalWork({ ...work, cuts: [0, 10] }))
            .toThrow(/span the whole text/);
        expect(() => validateLocalWork({ ...work, labels: work.labels.slice(1) }))
            .toThrow(/named exactly once/);
        expect(() => validateLocalWork({ ...work, text: '   ' })).toThrow(/no text/);
    });

    it('sends the catalogue what the gate needs, and no prose', () => {
        const entry = localWorkCatalogue(draftLocalWork({ text: BOOK, sourceName: 'a-book.md' }));
        // `words` and `labels` are whole-or-nothing against `count`: a short
        // array reads as the work's complete scheme.
        expect(entry.divisions.words).toHaveLength(entry.divisions.count);
        expect(entry.divisions.labels).toHaveLength(entry.divisions.count);
        expect(entry.divisions.words.reduce((a, b) => a + b, 0)).toBe(entry.words);
        expect(JSON.stringify(entry)).not.toContain('Paragraph 3 of chapter');
    });
});

describe('admit, take, examine, read', () => {
    const score = (sourceId) => JSON.stringify({
        schema: 'rise.experience-program.v1',
        id: 'reads-my-book',
        authority: 'proposed',
        editable: true,
        tracks: [{
            id: 'movements',
            kind: 'movement',
            clips: [{ id: 'm1', anchor: { sourceIds: [sourceId] }, data: { index: 0, title: 'Three' } }]
        }]
    });

    it('offers the reader’s work first, and never its bytes', () => {
        const session = createScriptoriumSession({ mintId: () => 'fixed' });
        const work = admit(session);
        const { context } = session.take();
        // First because it is why the reader opened the door; the shelf is
        // still there next time and their file may not be.
        expect(context.library[0].id).toBe(work.id);
        expect(JSON.stringify(context)).not.toContain('Paragraph 3 of chapter');
    });

    it('accepts an extent on a local work and loads the right part', async () => {
        const session = createScriptoriumSession({ mintId: () => 'fixed' });
        const work = admit(session);
        session.setTargetWords(2000);
        session.take();

        const verdict = session.examine(score(`${work.id}#3`));
        expect(verdict.ok, verdict.text || '').toBe(true);

        const project = await session.read();
        const [source] = project.sources;
        expect(source.id).toBe(`${work.id}#3`);
        expect(source.data.startsWith('CHAPTER 3')).toBe(true);
        // A reading the reader brought says so, so a saved project can be
        // told apart from one built on an edition RISE answers for.
        expect(source.providerId).toBe('local-work');
    }, 60_000);

    it('refuses a division the work has not', () => {
        const session = createScriptoriumSession({ mintId: () => 'fixed' });
        const work = admit(session);
        session.take();
        const verdict = session.examine(score(`${work.id}#99`));
        expect(verdict.ok).toBe(false);
        expect(verdict.code).toBe('PROGRAM_IO_UNKNOWN_DIVISION');
    });

    it('rebuilds the take, because a copied prompt is stale the moment it changes', () => {
        const session = createScriptoriumSession({ mintId: () => 'fixed' });
        session.take();
        expect(session.context.library.some(entry => entry.id.startsWith(LOCAL_WORK_PREFIX)))
            .toBe(false);
        const work = admit(session);
        expect(session.context.library[0].id).toBe(work.id);
        session.dropLocalWork(work.id);
        expect(session.context.library.some(entry => entry.id === work.id)).toBe(false);
    });
});

describe('the reserved prefix', () => {
    it('is not minted by the shelf', () => {
        // The overlay is asked AFTER the archive, so an archive work under
        // this prefix would be silently shadowed by a reader's file. The
        // reservation is what makes that impossible rather than unlikely.
        for (const work of ingestedArchiveTexts()) {
            expect(work.id.startsWith(LOCAL_WORK_PREFIX),
                `${work.id} claims the reserved local prefix`).toBe(false);
        }
    });

    it('is required of a local work', () => {
        const work = draftLocalWork({ text: BOOK, sourceName: 'a-book.md' });
        expect(work.id.startsWith(LOCAL_WORK_PREFIX)).toBe(true);
        expect(() => validateLocalWork({ ...work, id: 'middlemarch' }))
            .toThrow(/begins with/);
    });
});
