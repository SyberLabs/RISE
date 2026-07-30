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
import { LITERATURE_CURATION } from './archive/literature-curation.js';

export const ARCHIVE_CURATION = Object.freeze({
    ...LITERATURE_CURATION,

    // ── FORM ────────────────────────────────────────────────────
    'vitruvius-architecture': {
        shelf: 'form',
        division: 'classical',
        why: 'The only architectural treatise to survive antiquity, written by a working engineer who had built artillery for Caesar. It treats a building as a compact between proportion, material, climate, acoustics, water and civic life — form here is not appearance but an agreement between unlike kinds of knowledge.',
        functions: [R.PATTERN, R.CONNECTION, R.RECURSION],
        rhymes: ['literary-meditations', 'sacred-emerald-tablet'],
        provenance: { translator: 'Morris Hicky Morgan', year: 1914, basis: PD_BASIS.PRE_1930 }
    },

    'dow-composition': {
        shelf: 'form',
        division: 'literary',
        why: 'Dow taught that a picture is built the way music is — from line, dark-light, and colour arranged in relation — and taught it to Georgia O’Keeffe, who said it gave her something of her own to say. The exercises are the argument.',
        functions: [R.PATTERN, R.RECURSION],
        rhymes: ['ross-pure-design', 'crane-line-and-form'],
        provenance: { year: 1913, basis: PD_BASIS.PRE_1930 }
    },
    'ross-pure-design': {
        shelf: 'form',
        division: 'literary',
        why: 'An attempt to state the grammar of order itself — harmony, balance, rhythm — before any question of subject arises. Ross wanted design to be teachable the way harmony is teachable, and the book is dry in exactly the way that ambition requires.',
        functions: [R.PATTERN, R.CONNECTION],
        rhymes: ['dow-composition', 'vitruvius-architecture'],
        provenance: { year: 1907, basis: PD_BASIS.PRE_1930 }
    },
    'crane-line-and-form': {
        shelf: 'form',
        division: 'literary',
        why: 'Crane treats line not as contour but as a force that travels — from a leaf to a figure to the edge of the page. It is a grammar of continuity, and unusually useful where text and image share one field.',
        functions: [R.PATTERN, R.CONNECTION, R.RECURSION],
        rhymes: ['dow-composition', 'dresser-decorative-design'],
        provenance: { year: 1900, basis: PD_BASIS.AUTHOR_70 }
    },
    'kandinsky-spiritual-in-art': {
        shelf: 'form',
        division: 'esoteric',
        why: 'Written while he was making the first abstract paintings and needed to explain to himself why colour could carry meaning without depicting anything. The argument is strange and in earnest; he is not theorising after the fact.',
        functions: [R.STATE, R.PATTERN],
        rhymes: ['ross-pure-design', 'literary-poems-blake'],
        provenance: { translator: 'Michael T. H. Sadler', year: 1914, basis: PD_BASIS.PRE_1930 }
    },
    'dresser-decorative-design': {
        shelf: 'form',
        division: 'literary',
        why: 'Dresser keeps asking whether an ornament tells the truth about the material and the use beneath it. A sugar bowl becomes a test of attention, without pretending that usefulness abolishes delight.',
        functions: [R.PATTERN, R.CONNECTION],
        rhymes: ['crane-line-and-form', 'vitruvius-architecture'],
        provenance: { year: 1873, basis: PD_BASIS.PRE_1930 }
    },
    'epictetus-encheiridion': {
        shelf: 'western',
        division: 'classical',
        why: 'A former slave teaching that the one thing nobody can take is your judgement about what happens to you. Long’s translation is the same English the Archive’s Marcus Aurelius speaks, which lets you hear the master behind the emperor.',
        functions: [R.RECURSION, R.PATTERN],
        rhymes: ['literary-meditations', 'boethius-consolation'],
        provenance: { translator: 'George Long', year: 1890, basis: PD_BASIS.AUTHOR_70 }
    },
    'montaigne-essays': {
        shelf: 'western',
        division: 'literary',
        why: 'He invented the essay by refusing to pretend he had finished thinking. A hundred and two attempts to catch a mind in motion, including its contradictions, which he leaves standing.',
        functions: [R.RECURSION, R.STATE],
        rhymes: ['literary-essays-emerson', 'literary-meditations'],
        provenance: { translator: 'Charles Cotton', year: 1877, basis: PD_BASIS.PRE_1930 }
    },
    'okakura-book-of-tea': {
        shelf: 'eastern',
        division: 'literary',
        why: 'Written in English for Western readers in 1906, it uses the tea ceremony to argue that attention to small things is not smallness. The chapter on flowers is a quiet indictment of how we treat what we admire.',
        functions: [R.STATE, R.RECURSION],
        rhymes: ['sacred-tao-te-ching', 'literary-walden'],
        provenance: { year: 1906, basis: PD_BASIS.PRE_1930 }
    },
    'boethius-consolation': {
        shelf: 'western',
        division: 'classical',
        why: 'Written in a cell while awaiting execution, and it does not console by denying the situation. Philosophy arrives as a woman who has come to argue, and the argument is what steadies him.',
        functions: [R.STATE, R.RECURSION],
        rhymes: ['epictetus-encheiridion', 'julian-revelations'],
        provenance: { translator: 'H. R. James', year: 1897, basis: PD_BASIS.PRE_1930 }
    },
    'julian-revelations': {
        shelf: 'western',
        division: 'esoteric',
        why: 'The first book written in English by a woman, composed after a near-fatal illness in which she saw sixteen showings and spent twenty years asking what they meant. “All shall be well” is a conclusion she works for, not a comfort she assumes.',
        functions: [R.STATE, R.RECURSION],
        rhymes: ['boethius-consolation', 'sacred-rumi'],
        provenance: { year: 1901, basis: PD_BASIS.PRE_1930 }
    },
    'kabir-songs': {
        shelf: 'eastern',
        division: 'literary',
        why: 'A fifteenth-century weaver who belonged to neither the Hindus nor the Muslims claiming him, and said so in poems that mock both. Tagore’s English keeps the plainness that makes the mockery land.',
        functions: [R.STATE, R.CONNECTION],
        rhymes: ['sacred-rumi', 'literary-poems-blake'],
        provenance: { translator: 'Rabindranath Tagore', year: 1915, basis: PD_BASIS.PRE_1930 }
    },
    // ── INDIGENOUS TRADITIONS ───────────────────────────────────
    // These are COLLECTED works: a named outsider stands between the
    // reader and a living tradition, and the editorial line says so.
    // The collector is named in the author field, never presented as
    // the author.
    //
    // These four sat under "The Recurrence" until 2026-07-28, beside
    // the Hermetica and the I Ching, under a heading meaning "the same
    // intuition where there was no contact." That framing made living
    // traditions into evidence for a thesis — exactly what SOL's
    // dossier warned against, and the caveat was written into the
    // curation while the shelf that caused it was left standing.
    'parker-australian-tales': {
        shelf: 'indigenous',
        division: 'classical',
        why: 'Yuwaalaraay stories written down by a settler woman who grew up beside the people she was recording, and whose framing is visible on every page. Read them for the law and country inside the tales, and read Parker as the window she is — including the period language of her title.',
        functions: [R.CONNECTION, R.RECURSION],
        rhymes: ['rasmussen-eskimo-tales', 'mooney-cherokee-myths'],
        provenance: { year: 1896, basis: PD_BASIS.AUTHOR_70 }
    },
    'rasmussen-eskimo-tales': {
        shelf: 'indigenous',
        division: 'classical',
        why: 'Greenland Inuit tales gathered by a man raised among Kalaallit speakers, then carried into English through his Danish. Hunger, weather, kinship and the instability between human and animal are not symbols laid over these stories; they are the conditions under which a world holds.',
        functions: [R.STATE, R.CONNECTION, R.RECURSION],
        rhymes: ['parker-australian-tales', 'beckwith-anansi-stories'],
        provenance: { translator: 'W. J. Alexander Worster', year: 1921, basis: PD_BASIS.PRE_1930 }
    },
    'mooney-cherokee-myths': {
        shelf: 'indigenous',
        division: 'classical',
        why: 'Recorded from Cherokee speakers in the 1880s, a generation after the removal, by an ethnographer who learned the language. The cosmology is intact and so is the grief; the volume was published by the government that caused it.',
        functions: [R.CONNECTION, R.RECURSION],
        rhymes: ['parker-australian-tales', 'rasmussen-eskimo-tales'],
        provenance: { year: 1900, basis: PD_BASIS.US_GOV }
    },
    'beckwith-anansi-stories': {
        shelf: 'indigenous',
        division: 'classical',
        why: 'The West African spider who crossed the Atlantic in the memory of enslaved people and kept telling his stories in Jamaica. Beckwith names her tellers and their parishes, which is why this collection is worth more than its archetypes.',
        functions: [R.CONNECTION, R.STATE],
        rhymes: ['rasmussen-eskimo-tales', 'mooney-cherokee-myths'],
        provenance: { year: 1924, basis: PD_BASIS.PRE_1930 }
    },

    'sacred-yoga-sutras': {
        shelf: 'eastern',
        division: 'classical',
        why: 'A technical manual for the mind, compressed to the point where a teacher was assumed present. Vivekananda’s 1896 commentary is what makes it readable without one — he is arguing with the reader, not glossing.',
        functions: [R.PATTERN, R.RECURSION],
        rhymes: ['extended-bhagavad-gita-full', 'literary-meditations'],
        // Corrected: this was recorded as Charles Johnston, which the
        // source never said. Vivekananda died 1902 — the text was
        // always clear; the provenance was the defect.
        provenance: { translator: 'Swami Vivekananda', year: 1896, basis: PD_BASIS.AUTHOR_70 }
    },
    // ── THE WESTERN CANON ───────────────────────────────────────
    'literary-meditations': {
        shelf: 'western',
        division: 'classical',
        why: 'A Roman emperor writing to no one but himself, in Greek, at the edge of a war he did not expect to survive. The private register is the point: this is what a mind does when it is not performing.',
        functions: [R.RECURSION, R.STATE],
        rhymes: ['literary-walden', 'literary-letters-young-poet'],
        provenance: { translator: 'George Long', year: 1862, basis: PD_BASIS.AUTHOR_70 }
    },
    'literary-walden': {
        shelf: 'western',
        division: 'literary',
        why: 'Withdrawal as method rather than escape. Thoreau went to the woods to find out what a life reduced to its terms actually contains, and reported back with the accounting intact.',
        functions: [R.STATE, R.PATTERN],
        rhymes: ['literary-meditations', 'literary-essays-emerson'],
        provenance: { year: 1854, basis: PD_BASIS.PRE_1930 }
    },
    'literary-essays-emerson': {
        shelf: 'western',
        division: 'literary',
        why: 'The argument that the authority you are looking for is already seated in you, made by someone who understood how unwelcome that news is.',
        functions: [R.STATE, R.PATTERN],
        rhymes: ['literary-walden', 'literary-meditations'],
        provenance: { year: 1841, basis: PD_BASIS.PRE_1930 }
    },
    'literary-letters-young-poet': {
        shelf: 'western',
        division: 'literary',
        why: 'Ten letters to a stranger who asked whether his poems were any good. Rilke declines to answer and addresses the harder question underneath it.',
        functions: [R.STATE, R.RECURSION],
        rhymes: ['literary-meditations', 'literary-poems-dickinson'],
        provenance: { translator: 'M. D. Herter Norton', year: 1929, basis: PD_BASIS.PRE_1930 }
    },

    // ── THE WESTERN CANON, continued ────────────────────────────
    'literary-poems-dickinson': {
        shelf: 'western',
        division: 'literary',
        why: 'She wrote about death from what reads like the far side of it, in a private punctuation nobody had used before. The dashes are load-bearing.',
        functions: [R.STATE, R.RECURSION],
        rhymes: ['literary-poems-blake', 'literary-letters-young-poet'],
        provenance: { year: 1890, basis: PD_BASIS.PRE_1930 }
    },
    'literary-poems-blake': {
        shelf: 'western',
        division: 'esoteric',
        why: 'Blake believed he was transcribing rather than composing. Whatever the truth of that, the poems behave like transcription — plain surfaces over something that does not resolve.',
        functions: [R.STATE, R.CONNECTION],
        rhymes: ['literary-poems-dickinson', 'literary-leaves-of-grass'],
        provenance: { year: 1794, basis: PD_BASIS.PRE_1930 }
    },
    'literary-thus-spoke-zarathustra': {
        shelf: 'western',
        division: 'literary',
        why: 'Philosophy that refuses the essay and takes scripture’s form instead — partly to mock it, partly because the argument would not fit anywhere else.',
        functions: [R.STATE, R.PATTERN],
        rhymes: ['literary-leaves-of-grass', 'literary-poems-blake'],
        provenance: { translator: 'Thomas Common', year: 1909, basis: PD_BASIS.PRE_1930 }
    },
    'literary-leaves-of-grass': {
        shelf: 'western',
        division: 'literary',
        why: 'Whitman kept revising one book for thirty-six years. The catalogues are not padding; they are an argument that nothing is too ordinary to be included.',
        functions: [R.STATE, R.CONNECTION],
        rhymes: ['literary-poems-blake', 'literary-thus-spoke-zarathustra'],
        provenance: { year: 1855, basis: PD_BASIS.PRE_1930 }
    },

    // ── THE EASTERN CANON ───────────────────────────────────────
    // Scripture proper is not here at all: the Chapel keeps its own
    // door, and that separation is load-bearing.
    'sacred-tao-te-ching': {
        shelf: 'eastern',
        division: 'classical',
        why: 'Eighty-one chapters that begin by warning you the subject cannot be named, and then name it for eighty-one chapters. The contradiction is the instruction.',
        functions: [R.RECURSION, R.STATE],
        rhymes: ['sacred-zen-koans', 'sacred-i-ching'],
        provenance: { translator: 'James Legge', year: 1891, basis: PD_BASIS.PRE_1930 }
    },
    'sacred-zen-koans': {
        shelf: 'eastern',
        division: 'esoteric',
        why: 'Questions built so that answering them correctly is the failure. They work on the part of the mind that wants to resolve things.',
        functions: [R.RECURSION, R.PATTERN],
        rhymes: ['extended-dhammapada-full', 'sacred-tao-te-ching'],
        provenance: { translator: 'Various', basis: PD_BASIS.AUTHOR_70 }
    },
    'sacred-rumi': {
        shelf: 'eastern',
        division: 'literary',
        why: 'Love poetry that is not metaphorically about God. Rumi means it literally, which is what makes the poems uncomfortable rather than merely beautiful.',
        functions: [R.STATE, R.RECURSION],
        rhymes: ['literary-poems-blake', 'sacred-tao-te-ching'],
        provenance: { translator: 'Reynold A. Nicholson', year: 1926, basis: PD_BASIS.PRE_1930 }
    },
    'extended-dhammapada-full': {
        shelf: 'eastern',
        division: 'classical',
        why: 'The teaching compressed to aphorism, arranged so that reading it straight through is itself a kind of practice.',
        functions: [R.RECURSION, R.PATTERN],
        rhymes: ['sacred-tao-te-ching', 'sacred-zen-koans'],
        provenance: { translator: 'Max Müller', year: 1881, basis: PD_BASIS.PRE_1930 }
    },

    // ── THE EASTERN CANON, continued ────────────────────────────
    'extended-bhagavad-gita-full': {
        shelf: 'eastern',
        division: 'classical',
        why: 'A conversation held between two armies about whether to fight. That the setting is a battlefield and the subject is duty makes it the least abstract of the great philosophical texts.',
        functions: [R.STATE, R.RECURSION],
        rhymes: ['literary-meditations', 'epictetus-encheiridion'],
        provenance: { translator: 'Edwin Arnold', year: 1885, basis: PD_BASIS.PRE_1930 }
    },

    // ── THE WESTERN CANON — the Hermetic line ───────────────────
    // Greek-Egyptian texts that the Renaissance built a cosmology on.
    'sacred-corpus-hermeticum': {
        shelf: 'western',
        division: 'esoteric',
        why: 'The fuller collection behind the Hermetica. Read it for how much of later European thought is already sitting here, waiting to be rediscovered.',
        functions: [R.CONNECTION, R.PATTERN],
        rhymes: ['sacred-emerald-tablet', 'sacred-i-ching'],
        provenance: { translator: 'G. R. S. Mead', year: 1906, basis: PD_BASIS.PRE_1930 }
    },
    'sacred-emerald-tablet': {
        shelf: 'western',
        division: 'esoteric',
        why: 'A few lines that the entire alchemical tradition treated as its foundation. "As above, so below" is here, before it became a slogan.',
        functions: [R.CONNECTION, R.PATTERN],
        rhymes: ['sacred-corpus-hermeticum', 'sacred-i-ching'],
        provenance: { translator: 'Isaac Newton', year: 1680, basis: PD_BASIS.PRE_1930 }
    },
    'sacred-i-ching': {
        shelf: 'eastern',
        division: 'classical',
        why: 'A system for reading situations as configurations rather than events. Whether or not you consult it, the structural claim — that change has a grammar — is the interesting part.',
        functions: [R.PATTERN, R.RECURSION],
        rhymes: ['sacred-tao-te-ching', 'sacred-corpus-hermeticum'],
        provenance: { translator: 'James Legge', year: 1882, basis: PD_BASIS.PRE_1930 }
    },
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
