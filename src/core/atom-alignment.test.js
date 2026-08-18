/**
 * Passage authoring against ordinary pasted prose.
 *
 * A reader pasted a news article, assigned images to passages, and Run
 * refused with SOURCE_SPAN_ATOM_ALIGNMENT. The text contained
 * `fiction — to turn science fiction to science fact`: word chunking drops a
 * mark standing alone, the raw source stream keeps it, and every atom after
 * the dash disagreed with the text it came from.
 *
 * The two sides now share one declaration of what is dropped
 * (`isDroppedWordToken`) rather than each carrying its own idea.
 */
import { describe, expect, it } from 'vitest';
import { chunkText, isDroppedWordToken } from './chunker.js';
import { alignSourceAtoms } from './source-span.js';

const MODES = ['word', 'phrase', 'sentence', 'paragraph'];
const chunk = (text, mode) => chunkText(text, { mode, wpm: 320, sourceId: 's1' });

describe('compiled atoms align with the text they came from', () => {
    it('survives a spaced em-dash in every chunk mode', () => {
        const text = '"Not just fiction — to turn science fiction to science fact." '
            + 'That\'s the glorious, exciting part.';
        for (const mode of MODES) {
            expect(() => alignSourceAtoms(text, chunk(text, mode)), mode).not.toThrow();
        }
    });

    it('survives every mark that can stand alone in prose', () => {
        // Each of these was a hard failure: the aligner expected a token the
        // word chunker had already discarded.
        for (const mark of ['—', '–', '-', '--', '...', '…', '*', '"', "'", '·', '§', '¶', '/', '&', '+', '№', '|']) {
            const text = `alpha ${mark} beta gamma`;
            for (const mode of MODES) {
                expect(() => alignSourceAtoms(text, chunk(text, mode)),
                    `${JSON.stringify(mark)} in ${mode}`).not.toThrow();
            }
        }
    });

    it('keeps a mark that a phrase atom carries inside its own text', () => {
        // The skip must be conditional. Stepping over the dash unconditionally
        // would desynchronise phrase mode, where the atom does contain it.
        const text = 'alpha — beta';
        const [atom] = chunk(text, 'phrase');
        expect(atom.content).toContain('—');
        const aligned = alignSourceAtoms(text, chunk(text, 'phrase'));
        expect(aligned[0].sourceCharacterStart).toBe(0);
        expect(aligned[0].sourceCharacterEnd).toBe(text.length);
    });

    it('does not delete words out of the reader’s text', () => {
        // `SYNTHESIS` and `BARRIER` were discarded as labels from a feature
        // that no longer exists, so a text using either word simply lost it.
        const words = chunk('the SYNTHESIS of a BARRIER', 'word')
            .map(atom => String(atom.content).trim());
        expect(words).toEqual(['the', 'SYNTHESIS', 'of', 'a', 'BARRIER']);
    });

    it('drops a lone mark and keeps punctuation attached to a word', () => {
        expect(isDroppedWordToken('—')).toBe(true);
        expect(isDroppedWordToken('&')).toBe(true);
        expect(isDroppedWordToken('fact.')).toBe(false);
        expect(isDroppedWordToken('"Not')).toBe(false);
        expect(isDroppedWordToken('...')).toBe(false);
    });
});
