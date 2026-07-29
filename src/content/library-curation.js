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
 * PROVENANCE IS NOT DECORATION. Every text records why we may hold it,
 * exactly as pinned imagery records its accession. A translation carries
 * its own copyright — Marcus Aurelius is public domain; a 2003
 * translation of him is not — so the basis always describes the EDITION.
 * A work with no entry here is unshelved and unexplained, which a test
 * asserts against: silent absence is the failure this codebase is most
 * prone to.
 */

import { PD_BASIS, RESONANCE_FUNCTIONS as R } from './library-constants.js';

export const ARCHIVE_CURATION = Object.freeze({

    // ── FORM ────────────────────────────────────────────────────
    'vitruvius-architecture': {
        shelf: 'form',
        why: 'The only architectural treatise to survive antiquity, written by a working engineer who had built artillery for Caesar. It treats a building as a compact between proportion, material, climate, acoustics, water and civic life — form here is not appearance but an agreement between unlike kinds of knowledge.',
        functions: [R.PATTERN, R.CONNECTION, R.RECURSION],
        rhymes: ['literary-meditations', 'sacred-emerald-tablet'],
        provenance: { translator: 'Morris Hicky Morgan', year: 1914, basis: PD_BASIS.PRE_1930 }
    },

    // ── THE INTERIOR ────────────────────────────────────────────
    'literary-meditations': {
        shelf: 'interior',
        why: 'A Roman emperor writing to no one but himself, in Greek, at the edge of a war he did not expect to survive. The private register is the point: this is what a mind does when it is not performing.',
        functions: [R.RECURSION, R.STATE],
        rhymes: ['literary-walden', 'literary-letters-young-poet'],
        provenance: { translator: 'George Long', year: 1862, basis: PD_BASIS.AUTHOR_70 }
    },
    'literary-walden': {
        shelf: 'interior',
        why: 'Withdrawal as method rather than escape. Thoreau went to the woods to find out what a life reduced to its terms actually contains, and reported back with the accounting intact.',
        functions: [R.STATE, R.PATTERN],
        rhymes: ['literary-meditations', 'literary-essays-emerson'],
        provenance: { year: 1854, basis: PD_BASIS.PRE_1930 }
    },
    'literary-essays-emerson': {
        shelf: 'interior',
        why: 'The argument that the authority you are looking for is already seated in you, made by someone who understood how unwelcome that news is.',
        functions: [R.STATE, R.PATTERN],
        rhymes: ['literary-walden', 'literary-meditations'],
        provenance: { year: 1841, basis: PD_BASIS.PRE_1930 }
    },
    'literary-letters-young-poet': {
        shelf: 'interior',
        why: 'Ten letters to a stranger who asked whether his poems were any good. Rilke declines to answer and addresses the harder question underneath it.',
        functions: [R.STATE, R.RECURSION],
        rhymes: ['literary-meditations', 'literary-poems-dickinson'],
        provenance: { translator: 'M. D. Herter Norton', year: 1929, basis: PD_BASIS.PRE_1930 }
    },

    // ── THE LIMIT ───────────────────────────────────────────────
    'literary-poems-dickinson': {
        shelf: 'limit',
        why: 'She wrote about death from what reads like the far side of it, in a private punctuation nobody had used before. The dashes are load-bearing.',
        functions: [R.STATE, R.RECURSION],
        rhymes: ['literary-poems-blake', 'literary-letters-young-poet'],
        provenance: { year: 1890, basis: PD_BASIS.PRE_1930 }
    },
    'literary-poems-blake': {
        shelf: 'limit',
        why: 'Blake believed he was transcribing rather than composing. Whatever the truth of that, the poems behave like transcription — plain surfaces over something that does not resolve.',
        functions: [R.STATE, R.CONNECTION],
        rhymes: ['literary-poems-dickinson', 'literary-leaves-of-grass'],
        provenance: { year: 1794, basis: PD_BASIS.PRE_1930 }
    },
    'literary-thus-spoke-zarathustra': {
        shelf: 'limit',
        why: 'Philosophy that refuses the essay and takes scripture’s form instead — partly to mock it, partly because the argument would not fit anywhere else.',
        functions: [R.STATE, R.PATTERN],
        rhymes: ['literary-leaves-of-grass', 'literary-poems-blake'],
        provenance: { translator: 'Thomas Common', year: 1909, basis: PD_BASIS.PRE_1930 }
    },
    'literary-leaves-of-grass': {
        shelf: 'limit',
        why: 'Whitman kept revising one book for thirty-six years. The catalogues are not padding; they are an argument that nothing is too ordinary to be included.',
        functions: [R.STATE, R.CONNECTION],
        rhymes: ['literary-poems-blake', 'literary-thus-spoke-zarathustra'],
        provenance: { year: 1855, basis: PD_BASIS.PRE_1930 }
    },

    // ── THE LIMIT — the apophatic traditions ────────────────────
    // These sit here rather than under a "sacred" heading because the
    // shelf asks what a text DOES. What these do is arrive at the edge
    // of what language holds and go on speaking carefully anyway.
    // Scripture proper is not here at all: the Chapel keeps its own
    // door, and that separation is load-bearing.
    'sacred-tao-te-ching': {
        shelf: 'limit',
        why: 'Eighty-one chapters that begin by warning you the subject cannot be named, and then name it for eighty-one chapters. The contradiction is the instruction.',
        functions: [R.RECURSION, R.STATE],
        rhymes: ['sacred-zen-koans', 'sacred-i-ching'],
        provenance: { translator: 'James Legge', year: 1891, basis: PD_BASIS.PRE_1930 }
    },
    'sacred-zen-koans': {
        shelf: 'limit',
        why: 'Questions built so that answering them correctly is the failure. They work on the part of the mind that wants to resolve things.',
        functions: [R.RECURSION, R.PATTERN],
        rhymes: ['extended-dhammapada-full', 'sacred-tao-te-ching'],
        provenance: { translator: 'Various', basis: PD_BASIS.AUTHOR_70 }
    },
    'sacred-rumi': {
        shelf: 'limit',
        why: 'Love poetry that is not metaphorically about God. Rumi means it literally, which is what makes the poems uncomfortable rather than merely beautiful.',
        functions: [R.STATE, R.RECURSION],
        rhymes: ['literary-poems-blake', 'sacred-tao-te-ching'],
        provenance: { translator: 'Reynold A. Nicholson', year: 1926, basis: PD_BASIS.PRE_1930 }
    },
    'extended-dhammapada-full': {
        shelf: 'limit',
        why: 'The teaching compressed to aphorism, arranged so that reading it straight through is itself a kind of practice.',
        functions: [R.RECURSION, R.PATTERN],
        rhymes: ['sacred-tao-te-ching', 'sacred-zen-koans'],
        provenance: { translator: 'Max Müller', year: 1881, basis: PD_BASIS.PRE_1930 }
    },

    // ── THE INTERIOR ────────────────────────────────────────────
    'sacred-marcus-aurelius': {
        shelf: 'interior',
        why: 'A shorter selection from the same private notebook the Meditations comes from. Read this if you want the argument without the repetition; read the full text if you want to feel him repeating it to himself.',
        functions: [R.RECURSION],
        rhymes: ['literary-meditations', 'literary-walden'],
        provenance: { translator: 'George Long', year: 1862, basis: PD_BASIS.AUTHOR_70 }
    },
    'extended-bhagavad-gita-full': {
        shelf: 'interior',
        why: 'A conversation held between two armies about whether to fight. That the setting is a battlefield and the subject is duty makes it the least abstract of the great philosophical texts.',
        functions: [R.STATE, R.RECURSION],
        rhymes: ['literary-meditations', 'sacred-marcus-aurelius'],
        provenance: { translator: 'Edwin Arnold', year: 1885, basis: PD_BASIS.PRE_1930 }
    },

    // ── THE RECURRENCE ──────────────────────────────────────────
    // The same intuition surfacing where there was no contact.
    'sacred-corpus-hermeticum': {
        shelf: 'recurrence',
        why: 'The fuller collection behind the Hermetica. Read it for how much of later European thought is already sitting here, waiting to be rediscovered.',
        functions: [R.CONNECTION, R.PATTERN],
        rhymes: ['sacred-emerald-tablet', 'sacred-i-ching'],
        provenance: { translator: 'G. R. S. Mead', year: 1906, basis: PD_BASIS.PRE_1930 }
    },
    'sacred-emerald-tablet': {
        shelf: 'recurrence',
        why: 'A few lines that the entire alchemical tradition treated as its foundation. "As above, so below" is here, before it became a slogan.',
        functions: [R.CONNECTION, R.PATTERN],
        rhymes: ['sacred-corpus-hermeticum', 'sacred-i-ching'],
        provenance: { translator: 'Isaac Newton', year: 1680, basis: PD_BASIS.PRE_1930 }
    },
    'sacred-i-ching': {
        shelf: 'recurrence',
        why: 'A system for reading situations as configurations rather than events. Whether or not you consult it, the structural claim — that change has a grammar — is the interesting part.',
        functions: [R.PATTERN, R.RECURSION],
        rhymes: ['sacred-tao-te-ching', 'sacred-corpus-hermeticum'],
        provenance: { translator: 'James Legge', year: 1882, basis: PD_BASIS.PRE_1930 }
    },
    'sacred-wheel-of-time': {
        shelf: 'recurrence',
        why: 'Toltec material of contested transmission. Held here for the pattern it shares with traditions it never met, and read with that provenance in view rather than hidden.',
        functions: [R.CONNECTION],
        rhymes: ['sacred-i-ching', 'sacred-corpus-hermeticum'],
        provenance: { translator: 'Traditional', basis: PD_BASIS.AUTHOR_70 }
    }
});

/** The curation for a registered text id, or null when unshelved. */
export function curationFor(textId) {
    return ARCHIVE_CURATION[textId] || null;
}

/**
 * A work's shelf, or null. Null is meaningful: an unshelved work is
 * held but not yet placed, and the Archive says so rather than filing
 * it somewhere convenient.
 */
export function shelfFor(textId) {
    return ARCHIVE_CURATION[textId]?.shelf || null;
}
