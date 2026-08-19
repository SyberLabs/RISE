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
 * The two shelves, and they are the only two: a work is one RISE received
 * from someone else, or one written here.
 *
 * THERE IS NO LONGER A TRADITION AXIS. It divided the Archive into a Western
 * canon and an Eastern one, which was a defensible cut across eighty-eight
 * inherited works and an indefensible one across fifteen chosen ones — it put
 * thirteen books on one shelf and two on the other, and a shelf of two is not
 * a shelf. Worse, it was the wrong question. It filed the Meditations away
 * from the Tao Te Ching and the Analects on the grounds of a map, when what
 * those three share is the thing a reader actually meets: precept, stated
 * without argument, meant to be reread. Provenance is the distinction the
 * Archive promises to keep; where a work was written is a fact about it, not
 * a shelf to put it on.
 */
export const LIBRARY_CATEGORIES = [
    {
        id: 'received',
        name: 'Received',
        icon: '⌂',
        description: 'Inherited works, each in a named edition',
        orientation: 'Every one of these came from somewhere, and says where: a chosen edition, its translator, and the grounds on which it may be held. Nothing here was written for this system.'
    },
    {
        // Kept distinct because provenance is the Archive's central promise —
        // a reader should always know whether they are meeting a received
        // text or one written here.
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
 * Divisions WITHIN the received shelf: what KIND of thing a work is.
 *
 * Form is chosen over period or tradition because form is what decides the
 * reading. A verse line is met differently from a paragraph, an aphorism
 * differently from a chapter, a speech differently from a narrator — and RISE
 * is a system about the act of reading rather than about literary history. A
 * reader who knows a work is an epic knows what the next hour will be like;
 * one who knows it is thirteenth-century does not.
 *
 * In reading order, oldest form first: what was sung, then what was staged,
 * then what was sung alone, then what was taught, then what was argued, then
 * what was told at length.
 *
 * The composed shelf has its own divisions, which are the sequence categories
 * declared in `starters.js` and are not restated here.
 */
export const DIVISIONS = [
    {
        id: 'epic',
        shelf: 'received',
        name: 'Epic',
        description: 'Heroic narrative at the scale of a world'
    },
    {
        id: 'drama',
        shelf: 'received',
        name: 'Drama',
        description: 'Written to be spoken, by people who are not the author'
    },
    {
        id: 'lyric',
        shelf: 'received',
        name: 'Lyric',
        description: 'The poem as a single utterance, and the books that collect them'
    },
    {
        id: 'wisdom',
        shelf: 'received',
        name: 'Wisdom',
        description: 'Precept rather than argument — read slowly, and more than once'
    },
    {
        id: 'essay',
        shelf: 'received',
        name: 'Essay',
        description: 'A mind working in prose, at the length the thought takes'
    },
    {
        id: 'novel',
        shelf: 'received',
        name: 'Novel',
        description: 'One long invented life, or several'
    },
    {
        id: 'tale',
        shelf: 'received',
        name: 'Tale',
        description: 'Stories told before they were written, and the books that gathered them'
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
