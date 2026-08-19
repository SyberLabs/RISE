/**
 * The text is the text it claims to be.
 *
 * Every integrity guarantee in this Archive answers one question — did
 * these bytes change since we fetched them? — and none of them answers
 * the other one: are they the right bytes?
 *
 * "The House of Atreus" shipped Conrad Aiken's "The House of Dust: A
 * Symphony". The dossier recorded Project Gutenberg #1246 as its
 * source; #1246 is the Aiken. The fetch was faithful, the source digest
 * matched, the payload checksum matched, and the rights evidence read
 * "the source record identifies Morshead and all three plays —
 * Agamemnon, The Libation-Bearers, and The Furies", which is a sentence
 * about a book nobody opened. A title-similarity slip, propagated by an
 * evidence field written from assumption, and invisible to every
 * checksum in the pipeline.
 *
 * So this test reads the prose. A work whose own title and author
 * appear nowhere in its opening pages is not thereby wrong — front
 * matter varies, translators are named where authors are not, and a
 * facsimile may open mid-page — but it is UNVERIFIED, and the
 * difference between those two states is the whole lesson of the
 * quarantine file.
 */
import { describe, expect, it } from 'vitest';

/** Works acquired from an edition that declares its own structure. */
const STRUCTURED = new Set(['spoon-river-anthology', 'literary-walden', 'middlemarch', 'the-brothers-karamazov',
    'literary-meditations', 'sacred-tao-te-ching', 'the-iliad', 'the-divine-comedy',
    'metamorphoses', 'paradise-lost', 'ulysses', 'literary-essays-emerson', 'confucius-analects', 'lyrical-ballads']);
import { LIBRARY_TEXTS } from '../library.js';

/** Words too common to identify anything. */
const STOP = new Set([
    'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'from', 'by',
    'book', 'books', 'story', 'stories', 'tale', 'tales', 'poems', 'poem',
    'complete', 'full', 'selected', 'other', 'works', 'first', 'series',
    'his', 'her', 'its', 'their', 'with', 'for', 'de', 'la', 'le'
]);

const tokens = (s) => String(s || '')
    .toLowerCase()
    // Fold diacritics: the Rámáyan titles itself "RÁMÁYAN" and would
    // never match a search for "ramayan".
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP.has(w));

/**
 * Works whose opening pages genuinely do not name themselves, checked
 * by hand. Listed rather than skipped silently, because an exemption
 * nobody can see is how the original error survived.
 */
const UNNAMED_IN_FRONT_MATTER = new Set([
    // Each of these was opened and read on 2026-07-30. They are the
    // right book; their payload simply begins past the title page.
    'crane-line-and-form',      // opens at its table of contents
    'montaigne-essays',         // opens at Essay I.1, "THAT MEN BY VARIOUS WAYS…"
    'okakura-book-of-tea',      // opens at "Tea is a work of art…"
    'kabir-songs',              // opens at "O servant, where dost thou seek Me?"
    'parker-australian-tales',  // opens at "Dinewan the emu…"
    'rasmussen-eskimo-tales',   // opens at "Once there were two men…"
    'the-song-of-roland',       // opens at "Charles the King, our Lord and Sovereign"
    'king-lear',                // opens at "KING LEAR. DRAMATIS PERSONAE"

    // Exempt: title-page / apparatus naming only; opening prose does not
    // carry author/title. Guard stays on the opening window (widening
    // to the whole payload would pass on residual furniture). Successor:
    // ARCHIVE-CLEANSING-SPEC §1b per-division vocabulary check.
    'sacred-zen-koans',         // Suzuki's name was on the Luzac title page
    'the-iliad',                // "Homer" appeared only on the Macmillan title page
    'the-odyssey',              // named in Butler's preface, which was the translator's
    'a-doll-s-house',           // opens at DRAMATIS PERSONAE; Ibsen is never in the dialogue
    'paradise-lost',            // opens at "Of Man's first disobedience"
    'moby-dick-or-the-whale',   // opens at Melville's own ETYMOLOGY, which does not name him
    'middlemarch',              // opens at CHAPTER I; the town is named later, not here
    'crime-and-punishment',     // opens at CHAPTER I, the biography having been withdrawn
    'war-and-peace',            // opens at CHAPTER I
    'the-storm-of-steel'        // Jünger's name was on the Phoenix Library title page
]);

describe('a work names itself in its own pages', () => {
    it('finds the title or author inside the text it serves', async () => {
        const unverified = [];

        for (const text of LIBRARY_TEXTS) {
            if (typeof text.getSequences !== 'function') continue;
            // RISE's own compositions have no external identity to match.
            if (text.provider === 'local' || /^starter-/.test(text.id)) continue;

            // THE PAYLOAD, NOT THE DISPLAY.
            //
            // `getSequences` is a reader-facing selection: it drops a
            // work's contents page so nobody opens Tolstoy at the index,
            // folds mis-cut fragments, and refuses a scheme it cannot
            // verify. Identity is a question about the bytes we HOLD,
            // and it must not become answerable differently because the
            // shelf changed how it presents them.
            //
            // Reading the divisions made this invariant fail for
            // Moby-Dick, Middlemarch, War and Peace and the Dhammapada
            // on the day the index stopped being served — a true
            // statement about the display and a false one about the
            // holding. `getSections` is the unmodified payload.
            let sequences;
            try {
                sequences = typeof text.getSections === 'function'
                    ? await text.getSections()
                    : await text.getSequences();
            } catch { continue; }
            // Folded the same way the tokens are, or "RÁMÁYAN" in the
            // text will never match "ramayan" from the title.
            const opening = sequences.map(s => s.content || '').join('\n')
                .slice(0, 12000).toLowerCase()
                .normalize('NFD').replace(/[̀-ͯ]/g, '');
            if (!opening.trim()) continue;

            // A SHARED COMMON WORD IS NOT AN IDENTIFICATION. The first
            // version of this test passed "The House of Atreus" while it
            // served "The House of Dust", because both are houses. The
            // author's name, and title words long enough to be specific,
            // are what actually identify a book.
            const GENERIC = /^(anonymous|traditional|collected|various|unknown|attributed)$/;
            const author = tokens(text.author).filter(w => !GENERIC.test(w));
            const distinctive = tokens(text.title).filter(w => w.length >= 6);
            const wanted = [...author, ...distinctive];
            if (!wanted.length) continue;

            // A CLEAN EDITION DOES NOT PUT ITS TITLE PAGE IN THE READING.
            //
            // This guard exists because of the Mahabharata: a payload that was
            // a different work than its card claimed. Looking for the title
            // inside the text is a good proxy when the source is an
            // undifferentiated download, and the wrong instrument when the
            // source declares its own structure — Standard Ebooks keeps the
            // title in metadata and opens the bodymatter on the first poem,
            // which is better rather than worse.
            //
            // Those works answer the same question with stronger evidence: a
            // digest per source file and a recorded part count, checked in
            // structured-provenance.test.js. Skipping them here is a change of
            // instrument, not an exemption.
            if (STRUCTURED.has(text.id)) continue;
            const found = wanted.some(w => opening.includes(w));

            if (!found && !UNNAMED_IN_FRONT_MATTER.has(text.id)) {
                unverified.push(`${text.id} (looked for: ${wanted.slice(0, 4).join(', ')})`);
            }
        }

        expect(unverified, `these works never name themselves in their own opening pages:\n  ${unverified.join('\n  ')}`)
            .toEqual([]);
    }, 180000);
});
