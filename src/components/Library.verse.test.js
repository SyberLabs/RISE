/**
 * THE DOOR A READER ACTUALLY OPENS.
 *
 * The verse declaration was wired from the ingest to `scriptorium-resolve`,
 * an end-to-end test was written against `scriptorium-resolve`, it passed,
 * and the fix was reported as shipped. But the Scriptorium's resolver serves
 * an authored PROGRAM. A reader opening Tintern Abbey from the Library goes
 *
 *     contents sheet → readEntry → onSelectText(text, source, config)
 *       → app.handleTextSelection → ChamberOrbital.loadText
 *       → beginSession → compileSession
 *
 * and every one of those hops passes an explicit allowlist of fields. The
 * flag was dropped at the first of them, so Mateo re-read the poem after the
 * fix and met the same broken line. The test proved the plumbing I had
 * written and not the path he uses.
 *
 * So this walks that path, from the contents sheet to the compiled atoms.
 */

import { describe, expect, it, vi } from 'vitest';
import { Library } from './Library.js';
import { ingestedArchiveTexts } from '../content/archive/index.js';
import { compileSession } from '../core/session-compiler.js';

/** The reader's own journey, minus the router and the dials in between. */
async function readFromTheShelf(workId, match) {
    const work = ingestedArchiveTexts().find(text => text.id === workId);
    const divisions = await work.getDivisions();
    const entry = divisions.entries.find(candidate => match.test(candidate.label));
    expect(entry, `no division of ${workId} matching ${match}`).toBeTruthy();

    const onSelectText = vi.fn();
    const container = document.createElement('div');
    const library = new Library(container, { onSelectText });
    library._contents = { text: work, divisions };
    library.readEntry(entry.id);

    expect(onSelectText).toHaveBeenCalledTimes(1);
    const [text, source, config] = onSelectText.mock.calls[0];

    // ChamberOrbital.loadText then beginSession, which is where the field
    // has to survive an allowlist rather than a spread.
    const session = compileSession({
        text,
        textSource: source,
        wpm: config.wpm ?? 200,
        chunkMode: 'phrase',
        verseLines: config.verseLines === true,
        audioPreset: 'silent',
        visualConfig: { enabled: false }
    });
    return {
        config,
        atoms: session.atoms
            .filter(atom => atom.content && atom.content.trim())
            .map(atom => atom.content.trim())
    };
}

describe('a poem opened from the Library is read by its lines', () => {
    it('serves Tintern Abbey as Wordsworth set it', async () => {
        const { config, atoms } = await readFromTheShelf('lyrical-ballads', /Tintern/);
        expect(config.verseLines).toBe(true);

        // The exact atoms the shelf served before this path carried the
        // flag. Each is a comma-cut of one line glued to the head of the
        // next, and the capital mid-atom is where the line began.
        expect(atoms).not.toContain('with the length Of five long winters!');
        expect(atoms).not.toContain('and again I hear These waters,');

        expect(atoms.slice(0, 4)).toEqual([
            'Five years have passed; five summers, with the length',
            'Of five long winters! and again I hear',
            'These waters, rolling from their mountain-springs',
            'With a sweet inland murmur.⁠—Once again'
        ]);
    }, 60_000);

    it('leaves prose alone on the same path', async () => {
        // The flag is a fact about one reading, not a default: applied to
        // Walden it drives the coefficient of variation the wrong way.
        const { config } = await readFromTheShelf('literary-walden', /Economy/);
        expect(config.verseLines).toBe(false);
    }, 60_000);
});
