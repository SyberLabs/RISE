/**
 * A reader's own words about their own file, from the field to the composer.
 *
 * The composer used to be told a filename and nothing else, which is enough to
 * put an image in a gallery and never enough to place one. A description is
 * the only thing in the panel that is not a measurement: name, kind, size and
 * duration are facts RISE read off the file, and "the cliff path above the
 * harbour" is the reader saying where it belongs.
 *
 * THE THREE PLACES IT USED TO DIE, each tested here:
 *   1. `createSequenceVisualAsset` rebuilds its result from an allow-list.
 *   2. `sequenceAssetForPersistence` rebuilds it again for the durable shape.
 *   3. The prompt never printed the catalogue description, so a description
 *      that survived both would still not reach the model that acts on it.
 *
 * AND ONE THING IT MUST NOT BECOME. `provenance` already survives the round
 * trip, which makes it the tempting field to reuse. Provenance answers "where
 * did this come from" and the archive leans on that answer; a description
 * answers "what is this". Test 'keeps provenance out of it' is the guard.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scriptorium } from './Scriptorium.js';
import { sequenceAssetForPersistence } from '../core/visual-score-lane.js';
import { READING_LIMITS } from '../core/reading-limits.js';

const png = (name = 'cliff-at-dusk.png') =>
    new File([new Uint8Array(64)], name, { type: 'image/png' });

const WORDS = 'The cliff path above the harbour, the morning after the storm.';

describe('describing a file the reader added', () => {
    let room;

    beforeEach(() => {
        global.URL.createObjectURL = vi.fn(() => `blob:${location.origin}/staged-${Math.random()}`);
        global.URL.revokeObjectURL = vi.fn();
        // ATTACHED. A detached element cannot hold focus, and the whole point
        // of the focus test below is that the reader's caret stays put.
        const host = document.createElement('div');
        document.body.append(host);
        room = new Scriptorium(host, {});
        room.mount();
    });

    afterEach(() => { room.container.remove(); });

    /** The control itself, not the method behind it. */
    const type = (id, text, { commit = true } = {}) => {
        const input = room.container.querySelector(`[data-action="describe-material"][data-id="${id}"]`);
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (commit) input.dispatchEvent(new Event('change', { bubbles: true }));
        return input;
    };

    describe('the invitation', () => {
        it('offers a field under every staged file, and demands nothing', async () => {
            await room.addMaterials([png('a.png'), png('b.png')]);
            const fields = room.container
                .querySelectorAll('[data-action="describe-material"]');
            expect(fields).toHaveLength(2);
            // Optional in the panel's own words as well as in its behaviour: a
            // reader who wants a gallery image owes nothing.
            for (const field of fields) {
                expect(field.hasAttribute('required')).toBe(false);
                expect(field.value).toBe('');
            }
            const label = room.container.querySelector('.scriptorium-material-describe');
            expect(label.textContent.toLowerCase()).toContain('optional');
        });

        it('says plainly what a description buys', async () => {
            await room.addMaterials([png()]);
            const prose = room.container
                .querySelector('.scriptorium-materials').textContent.replace(/\s+/gu, ' ');
            expect(prose).toMatch(/placed where the reading touches what you described/);
            expect(prose).toMatch(/Saying nothing costs nothing/);
        });

        it('takes the prompt without one, exactly as before', async () => {
            await room.addMaterials([png()]);
            expect(room.promptText).toContain('cliff-at-dusk.png');
            expect(room.context.catalog.collections[
                `sequence-asset:${room.materials[0].id}`].description)
                .toBe('An image the reader added to this project.');
        });
    });

    describe('the field', () => {
        it('does not take focus away mid-sentence', async () => {
            await room.addMaterials([png()]);
            const input = room.container
                .querySelector('[data-action="describe-material"]');
            input.focus();
            expect(document.activeElement).toBe(input);
            input.value = 'The cliff';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            // A full render() rebuilds this room's whole DOM — the defect the
            // length slider above carries a comment about. The same node must
            // still be in the document, still focused, still holding the text.
            expect(document.activeElement).toBe(input);
            expect(room.container.contains(input)).toBe(true);
            expect(input.value).toBe('The cliff');
        });

        it('keeps what is typed before the field is ever left', async () => {
            await room.addMaterials([png()]);
            type(room.materials[0].id, WORDS, { commit: false });
            // Cheap and invisible, so it happens per keystroke: a reader who
            // types and then clicks Remove on a different file must not lose
            // the sentence to the re-render that follows.
            expect(room.materials[0].description).toBe(WORDS);
            // The capability document is neither, so it waits for the commit.
            expect(room.promptText).not.toContain(WORDS);
        });

        it('keeps the field the reader tabbed INTO when the last one commits', async () => {
            await room.addMaterials([png('a.png'), png('b.png')]);
            const [first, second] = room.container
                .querySelectorAll('[data-action="describe-material"]');
            first.value = WORDS;
            first.dispatchEvent(new Event('input', { bubbles: true }));
            second.focus();
            // Tabbing out of the first field is what fires its `change`. A
            // render here would destroy the field the reader is now typing in.
            first.dispatchEvent(new Event('change', { bubbles: true }));
            expect(room.container.contains(second)).toBe(true);
            expect(document.activeElement).toBe(second);
            // …and the commit still happened.
            expect(room.promptText).toContain(WORDS);
        });

        it('holds what the reader typed across a re-render', async () => {
            await room.addMaterials([png()]);
            type(room.materials[0].id, WORDS);
            room.render();
            expect(room.container
                .querySelector('[data-action="describe-material"]').value).toBe(WORDS);
        });

        it('lets a reader take it back', async () => {
            const id = (await room.addMaterials([png()]), room.materials[0].id);
            type(id, WORDS);
            expect(room.materials[0].description).toBe(WORDS);
            type(room.materials[0].id, '');
            expect(room.materials[0].description).toBeUndefined();
        });

        it('tells the reader the take is stale, where they are standing', async () => {
            await room.addMaterials([png()]);
            type(room.materials[0].id, WORDS);
            const notice = room.container.querySelector('.scriptorium-material-notice');
            expect(notice.textContent).toMatch(/Take the prompt again/);
            expect(notice.querySelector('.scriptorium-material-taken')).toBeTruthy();
        });
    });

    describe('what the composer is told', () => {
        it('replaces the sentence RISE would have written', async () => {
            await room.addMaterials([png()]);
            type(room.materials[0].id, WORDS);
            const entry = room.context.catalog
                .collections[`sequence-asset:${room.materials[0].id}`];
            expect(entry.description).toBe(WORDS);
            // The attribution does not go with it: the entry still says whose
            // file this is, and still says what kind of thing it is.
            expect(entry.kind).toBe('sequence-asset');
            expect(entry.mediaKind).toBe('image');
        });

        it('prints the reader\'s words in the prompt, under the file', async () => {
            await room.addMaterials([png()]);
            type(room.materials[0].id, WORDS);
            const lines = room.promptText.split('\n');
            const at = lines.findIndex(line => line.includes('cliff-at-dusk.png'));
            expect(at).toBeGreaterThan(-1);
            expect(lines[at + 1]).toContain(WORDS);
            // Quoted, so the model can tell the reader's voice from RISE's.
            expect(lines[at + 1].trim()).toBe(`"${WORDS}"`);
        });

        it('keeps the attribution that makes a description worth having', async () => {
            await room.addMaterials([png()]);
            type(room.materials[0].id, WORDS);
            expect(room.promptText).toContain("THE READER'S OWN");
            expect(room.promptText)
                .toContain("These are the reader's own, not the Library's");
            expect(room.promptText)
                .toMatch(/quoted line under a file is the reader's own description/);
        });

        it('says nothing extra when the reader said nothing', async () => {
            await room.addMaterials([png()]);
            expect(room.promptText).not.toContain('An image the reader added to this project.');
            expect(room.promptText).not.toMatch(/quoted line under a file/);
        });
    });

    describe('the trust boundary', () => {
        it('refuses a web address, beside the field rather than at Prepare prompt', async () => {
            await room.addMaterials([png()]);
            const id = room.materials[0].id;
            type(id, 'see https://example.com/cliff.png');
            expect(room.materials[0].description).toBeUndefined();
            const notice = room.container.querySelector('.scriptorium-material-notice');
            expect(notice.querySelector('.scriptorium-material-refused').textContent)
                .toMatch(/prose, not a link/);
            // And the document is still buildable, which is the point of
            // catching it here: a URI reaching boundedText throws.
            expect(() => room.session.take()).not.toThrow();
        });

        it('bounds what a reader can write at the same number the document does',
            async () => {
                await room.addMaterials([png()]);
                type(room.materials[0].id, 'x'.repeat(5_000));
                expect(room.materials[0].description)
                    .toHaveLength(READING_LIMITS.maxMaterialDescriptionChars);
                // The ceiling the descriptor applies IS the ceiling the
                // capability document applies, so a bounded description can
                // never fail the document for length.
                expect(() => room.session.take()).not.toThrow();
                expect(room.context.catalog
                    .collections[`sequence-asset:${room.materials[0].id}`].description)
                    .toHaveLength(READING_LIMITS.maxMaterialDescriptionChars);
            });

        it('escapes it back into the field rather than into the markup', async () => {
            await room.addMaterials([png()]);
            type(room.materials[0].id, '"><img onerror=alert(1) src=x>');
            room.render();
            const input = room.container.querySelector('[data-action="describe-material"]');
            expect(input.value).toBe('"><img onerror=alert(1) src=x>');
            expect(room.container.querySelectorAll('img[onerror]')).toHaveLength(0);
        });
    });

    describe('what survives the trip to the Vault', () => {
        it('carries the description into the durable shape', async () => {
            await room.addMaterials([png()]);
            type(room.materials[0].id, WORDS);
            const persisted = sequenceAssetForPersistence(room.materials[0]);
            expect(persisted.description).toBe(WORDS);
            // The blob: URL is stripped on purpose; the words are not.
            expect(persisted.uri).toBeUndefined();
        });

        it('keeps provenance out of it', async () => {
            await room.addMaterials([png()]);
            type(room.materials[0].id, WORDS);
            // "Where this came from" is a different question from "what this
            // is", and the archive depends on being able to ask the first one.
            expect(room.materials[0].provenance).toBeUndefined();
            expect(sequenceAssetForPersistence(room.materials[0]).provenance)
                .toBeUndefined();
        });

        it('survives a round trip through persistence unchanged', async () => {
            await room.addMaterials([png()]);
            type(room.materials[0].id, WORDS);
            const once = sequenceAssetForPersistence(room.materials[0]);
            expect(sequenceAssetForPersistence(once).description).toBe(WORDS);
        });
    });
});
