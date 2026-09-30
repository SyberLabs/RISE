/**
 * The Archive's curation — editorial judgement, held as content.
 *
 * A registration loop can say WHERE a file came from. It cannot say why
 * a work is worth a reader's hour, what it does to them, or what else in
 * the corpus it speaks to. That is editorial work, and it belongs in one
 * legible place rather than scattered through provider adapters.
 *
 * Per work (LIBRARY-SPEC §3):
 *   shelf       which collection holds it
 *   why         one or two sentences of judgement, in the Archive's own
 *               voice — not a blurb, not a summary
 *   functions   which resonance functions it serves (RESONANCE_FUNCTIONS)
 *   rhymes      other works here it speaks to. This is what makes an
 *               archive rather than a list.
 *   provenance  translator, edition, year, and the public-domain basis
 *
 * Provenance is required, not decoration. Translations carry their own
 * copyright (e.g. Marcus Aurelius PD vs a modern translation). A work
 * with no entry is unshelved; a test asserts against silent absence.
 */

import { PD_BASIS, RESONANCE_FUNCTIONS as R } from './library-constants.js';
import { LITERATURE_CURATION } from './archive/literature-curation.js';


/**
 * WHAT THE CANON SAYS TO ITSELF.
 *
 * `rhymes` is the field that makes an archive rather than a list, and the
 * generated entries carry none: they were written when the corpus was
 * eighty-eight works, and a pointer into the withheld eighty is filtered away
 * at the door by `curationFor`. So the canon states its own rhymes here,
 * where a hand wrote them, and they are held to works the shelf actually has.
 */
const CANON_RHYMES = Object.freeze({
    'the-iliad': ['metamorphoses', 'paradise-lost', 'oedipus-rex'],
    'metamorphoses': ['the-iliad', 'the-divine-comedy', 'spoon-river-anthology'],
    'the-divine-comedy': ['paradise-lost', 'metamorphoses', 'spoon-river-anthology'],
    'paradise-lost': ['the-divine-comedy', 'the-iliad', 'literary-meditations'],
    'middlemarch': ['the-brothers-karamazov', 'spoon-river-anthology', 'literary-essays-emerson'],
    'the-brothers-karamazov': ['middlemarch', 'literary-meditations', 'the-divine-comedy'],
    'ulysses': ['the-iliad', 'middlemarch', 'the-divine-comedy']
});

const CURATION = Object.freeze({
    ...LITERATURE_CURATION,

    // ── THE WESTERN CANON ───────────────────────────────────────
    'literary-meditations': {
        shelf: 'received',
        division: 'wisdom',
        why: 'A Roman emperor writing to no one but himself, in Greek, at the edge of a war he did not expect to survive. The private register is the point: this is what a mind does when it is not performing.',
        functions: [R.RECURSION, R.STATE],
        rhymes: ['literary-walden', 'literary-letters-young-poet'],
        provenance: { translator: 'George Long', year: 1862, basis: PD_BASIS.AUTHOR_70 }
    },
    'literary-walden': {
        shelf: 'received',
        division: 'essay',
        why: 'Withdrawal as method rather than escape. Thoreau went to the woods to find out what a life reduced to its terms actually contains, and reported back with the accounting intact.',
        functions: [R.STATE, R.PATTERN],
        rhymes: ['literary-meditations', 'literary-essays-emerson'],
        provenance: { year: 1854, basis: PD_BASIS.PRE_1930 }
    },
    'literary-essays-emerson': {
        shelf: 'received',
        division: 'essay',
        why: 'The argument that the authority you are looking for is already seated in you, made by someone who understood how unwelcome that news is.',
        functions: [R.STATE, R.PATTERN],
        rhymes: ['literary-walden', 'literary-meditations'],
        provenance: { year: 1841, basis: PD_BASIS.PRE_1930 }
    },

    // ── THE EASTERN CANON ───────────────────────────────────────
    // Scripture proper is not here at all: the Chapel keeps its own
    // door, and that separation is load-bearing.
    'sacred-tao-te-ching': {
        shelf: 'received',
        division: 'wisdom',
        why: 'Eighty-one chapters that begin by warning you the subject cannot be named, and then name it for eighty-one chapters. The contradiction is the instruction.',
        functions: [R.RECURSION, R.STATE],
        rhymes: ['sacred-zen-koans', 'sacred-i-ching'],
        provenance: { translator: 'James Legge', year: 1891, basis: PD_BASIS.PRE_1930 }
    },

    // ── THE FOUR THAT ARRIVED WITHOUT JUDGEMENT ─────────────────
    // Acquired late, under the Standard Ebooks rule, and registered before
    // anyone had said why they were worth an hour. A work with an edition
    // and no judgement is a file, not a holding.

    'oedipus-rex': {
        shelf: 'received',
        division: 'drama',
        why: 'A man conducts a murder investigation with total competence and discovers he is the murderer, and the audience knows it from the first line. The dread is not in the finding out but in watching intelligence work perfectly toward its own destruction.',
        functions: [R.STATE, R.PATTERN, R.RECURSION],
        rhymes: ['the-iliad', 'literary-meditations', 'the-divine-comedy'],
        provenance: { translator: 'Francis Storr', year: 1912, basis: PD_BASIS.PRE_1930 }
    },

    'lyrical-ballads': {
        shelf: 'received',
        division: 'lyric',
        why: 'Two young men set out to prove that the speech of ordinary people, set down plainly, could carry everything poetry had been using ornament for — and the argument in the Preface is still the argument. What they wrote about was a leech-gatherer, an idiot boy, a ruined cottage, and the mind noticing itself notice.',
        functions: [R.STATE, R.CONNECTION, R.RECURSION],
        rhymes: ['spoon-river-anthology', 'literary-walden', 'literary-essays-emerson'],
        provenance: { edition: 'the 1800 two-volume edition', year: 1800, basis: PD_BASIS.PRE_1930 }
    },

    'spoon-river-anthology': {
        shelf: 'received',
        division: 'lyric',
        why: 'Two hundred and forty-six dead people speak their own epitaphs, and each correction of the record contradicts a neighbour’s. Read singly they are small; read across, the town assembles itself out of what nobody could say while alive.',
        functions: [R.STATE, R.CONNECTION, R.RECURSION],
        rhymes: ['lyrical-ballads', 'the-divine-comedy', 'middlemarch'],
        provenance: { edition: 'the expanded 1916 edition', year: 1916, basis: PD_BASIS.PRE_1930 }
    },

    'confucius-analects': {
        shelf: 'received',
        division: 'wisdom',
        why: 'Not a doctrine but a record of a teacher answering the person in front of him, so the same question gets different answers and the difference is the teaching. Nothing is argued; a great deal is shown, and the book withholds the system a reader keeps expecting.',
        functions: [R.PATTERN, R.CONNECTION, R.RECURSION],
        rhymes: ['sacred-tao-te-ching', 'literary-meditations', 'literary-essays-emerson'],
        provenance: { translator: 'James Legge', year: 1861, basis: PD_BASIS.PRE_1930 }
    },
});

export const ARCHIVE_CURATION = Object.freeze(Object.fromEntries(
    Object.entries(CURATION).map(([id, entry]) => [
        id,
        CANON_RHYMES[id] ? { ...entry, rhymes: CANON_RHYMES[id] } : entry
    ])));

/** The curation for a registered text id, or null when unshelved. */
export function curationFor(textId, isHeld = null) {
    const entry = ARCHIVE_CURATION[textId];
    if (!entry) return null;
    if (typeof isHeld !== 'function' || !entry.rhymes?.length) return entry;
    // A RHYME POINTING AT A WORK THE SHELF NO LONGER HOLDS IS A DEAD END, and
    // the reader is the one who finds it. Curation is written against the
    // whole corpus; the canon is a subset of it, so the pointers are filtered
    // rather than the editorial judgement rewritten.
    const rhymes = entry.rhymes.filter(isHeld);
    return rhymes.length === entry.rhymes.length ? entry : { ...entry, rhymes };
}

/**
 * A work's shelf, or null. Null is meaningful: an unshelved work is
 * held but not yet placed, and the Archive says so rather than filing
 * it somewhere convenient.
 */
export function shelfFor(textId) {
    return ARCHIVE_CURATION[textId]?.shelf || null;
}
