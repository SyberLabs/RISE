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
 * The four shelves (LIBRARY-SPEC §2). Organized by RESONANCE, not
 * genre: a work earns its place by what it does to a reader, not by
 * which shelf a bookshop would file it on.
 *
 * Names are deliberately plain and the voice lives in `orientation` — a
 * shelf a visitor cannot predict is a shelf they will not open.
 */
export const LIBRARY_CATEGORIES = [
    {
        id: 'form',
        name: 'Form',
        icon: '△',
        description: 'How things are made, and how they hold together',
        orientation: 'Structure, proportion, the grammar of things — read for the sense that form is legible.'
    },
    {
        id: 'interior',
        name: 'The Interior',
        icon: '◎',
        description: 'The self, and the keeping of it',
        orientation: 'The inner fortress and the practices that maintain it. Read slowly; these were written slowly.'
    },
    {
        id: 'limit',
        name: 'The Limit',
        icon: '○',
        description: 'Where knowing runs out',
        orientation: 'Texts that arrive at the edge of what language holds, and go on speaking carefully anyway.'
    },
    {
        id: 'recurrence',
        name: 'The Recurrence',
        icon: '◈',
        description: 'What keeps returning, across cultures that never met',
        orientation: 'The same intuition surfacing in places with no contact between them. Read for the rhyme.'
    },
    {
        // Not a shelf of found works but of written ones: sequences
        // composed for this system, in its own voice. They are kept
        // distinct because provenance is the Archive's central promise —
        // a reader should always know whether they are meeting a
        // received text or one written here.
        id: 'composed',
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
