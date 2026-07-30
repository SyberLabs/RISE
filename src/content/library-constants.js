/**
 * Library vocabulary — the shelves and the terms curation speaks in.
 *
 * Kept in its own module because both the registry (library.js) and the
 * curation (library-curation.js) need it, and the registry needs the
 * curation. Without this split those two form a cycle, and a cycle in
 * frozen top-level data does not fail loudly — it evaluates to
 * `undefined` at whichever end loses the race. This module has no
 * imports so it can never be the far side of one.
 */

/**
 * The shelves. Names are deliberately plain and the voice lives in
 * `orientation` — a shelf a visitor cannot predict is one they will not
 * open.
 *
 * TWO AXES, as the Collections panel already does for imagery.
 *
 * A reader browsing a library asks one of two questions: WHERE is this
 * from, or WHAT is it about. Those are not alternatives, and presenting
 * them in one row implies they are — Vitruvius is Western AND a book
 * about form, and a filter row that offers "Western" beside "Form"
 * makes a reader choose between two true answers.
 *
 * So each shelf declares its `axis`. Tradition shelves divide the world
 * by where a work comes from; subject shelves cut across them.
 */
export const LIBRARY_CATEGORIES = [
    {
        id: 'western',
        axis: 'tradition',
        name: 'The Western Canon',
        icon: '⌂',
        description: 'Greece, Rome, and what Europe made of them',
        orientation: 'From the Hermetica and the Stoics through the Christian mystics to the Americans — a long argument that has never stopped being had.'
    },
    {
        id: 'eastern',
        axis: 'tradition',
        name: 'The Eastern Canon',
        icon: '☯',
        description: 'India, China, Persia, Japan',
        orientation: 'Traditions that were old when Greece was young, and are still being read the way they were meant to be read: slowly, and more than once.'
    },
    {
        id: 'indigenous',
        axis: 'tradition',
        name: 'Indigenous Traditions',
        icon: '◈',
        description: 'Held in memory and speech, written down late',
        orientation: 'Stories that lived by being told. Each reached print through a named outsider who collected them — read the tellers first, and the collector as the window they are.'
    },
    {
        // The first SUBJECT shelf. It cuts across the traditions rather
        // than sitting beside them: every work here is also Western,
        // and is filed here because a reader looking for the grammar of
        // made things is asking a different question than a reader
        // looking for the Western canon.
        //
        // Named plainly. "Architectonics" is the precise word and most
        // readers would not recognise it — the same lesson the shelf
        // names themselves taught: obliquity at the door costs more
        // than it earns. The orienting line carries the register.
        id: 'form',
        axis: 'subject',
        name: 'Form & Design',
        icon: '△',
        description: 'How things are made, and how they hold together',
        orientation: 'Structure, proportion, ornament, and colour — the grammar of made things, argued by people who made them.'
    },
    {
        // Not a shelf of found works but of written ones: sequences
        // composed for this system, in its own voice. They are kept
        // distinct because provenance is the Archive's central promise —
        // a reader should always know whether they are meeting a
        // received text or one written here.
        id: 'composed',
        axis: 'subject',
        name: 'Composed',
        icon: '✎',
        description: 'Written for this system, in its own voice',
        orientation: 'Sequences composed here rather than inherited — inductions, installations, and the affirmations that carry the house register.'
    }
];

/**
 * The four resonance functions (LIBRARY-SPEC §1). Recorded per work so
 * curation can be examined rather than merely asserted.
 */
export const RESONANCE_FUNCTIONS = Object.freeze({
    STATE: 'induce-state',             // shifts consciousness through encounter
    PATTERN: 'install-pattern',        // leaves structural residue in the mind
    CONNECTION: 'generate-connection', // rhymes with other works held here
    RECURSION: 'serve-recursion'       // rewards repeated engagement
});

/**
 * Divisions WITHIN a shelf, in reading order: a canon opens with its
 * founding texts, moves through what was written in their light, and
 * ends where it goes quiet and strange.
 *
 * Deliberately the SAME three on every shelf. A reader learns the
 * vocabulary once, and the parallel is itself informative — that every
 * tradition has a classical core, a literature, and an esoteric edge is
 * a claim worth making, and the Archive makes it by structure rather
 * than by saying so.
 *
 * Some fits are looser than others. The Tao Te Ching sits under
 * CLASSICAL because it founds a tradition, not because it resembles
 * Marcus Aurelius; Rumi and Kabir are LITERARY because they are poets,
 * though their subject is devotional. Where a work could go two ways
 * the curation says which and why.
 */
export const DIVISIONS = [
    {
        id: 'classical',
        name: 'Classical',
        description: 'The founding texts, and the commentaries that became texts themselves'
    },
    {
        id: 'literary',
        name: 'Discursive',
        description: 'Essays, letters, criticism, and the long argument after'
    },
    {
        id: 'imaginative',
        name: 'Imaginative',
        description: 'Worlds made in language — epic, drama, fiction, and tale'
    },
    {
        id: 'esoteric',
        name: 'Esoteric',
        description: 'The hidden reading: what a tradition says when it stops explaining'
    }
];

/**
 * Public-domain bases. EVERY text records why we may hold it — the
 * textual analogue of curation-only for imagery (SOURCE-CURATION-SPEC),
 * and non-negotiable for the same reason: the system would rather show
 * nothing than show what it cannot justify holding.
 *
 * A TRANSLATION carries its own copyright. Marcus Aurelius is public
 * domain; a 2003 translation of him is not. The basis always describes
 * the EDITION being shown, never merely the author.
 */
export const PD_BASIS = Object.freeze({
    PRE_1930: 'pre-1930-us',      // published in the US before 1930
    AUTHOR_70: 'author-death-70', // author AND translator died 70+ years ago
    US_GOV: 'us-government-work',
    DEDICATED: 'cc0-or-pd-dedication'
});
