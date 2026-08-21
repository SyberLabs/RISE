/**
 * The canon, and why everything else is withheld.
 *
 * See ARCHIVE-CANON-SPEC.md. The short of it: sixty of the eighty-eight works
 * pass every detector we own, and that is not a certification — it is the
 * absence of evidence from an instrument we know to be incomplete. Each defect
 * class we found was found by inventing a new detector, so "every detector
 * reports zero" gets weaker the more we learn.
 *
 * So the Library is small on purpose. Each canonical work is re-sourced from a
 * structured edition, ingested without flattening what that edition marked,
 * and compared end to end against a reference before it is served.
 *
 * WITHHELD IS NOT DELETED. The payload stays on disk and git keeps the
 * decision reversible; the work is simply not offered. Every withholding
 * states a reason, which is the rule that already governed the three
 * Shakespeares and is why nothing can go quietly off the shelf.
 */

/**
 * Chosen so each work is also an ACCEPTANCE FIXTURE for a textual form the
 * reading system must handle. A canon of favourites would prove nothing about
 * the instrument; a canon of forms proves it.
 */
/**
 * Works acquired from an edition that marks its own parts.
 *
 * Their divisions are read, never re-derived — see `declaredScheme` in
 * divisions.js and ARCHIVE-CANON-SPEC §4.
 */
export const STRUCTURED_IDS = Object.freeze(new Set([
  'oedipus-rex',
  'literary-essays-emerson',
  'confucius-analects',
  'lyrical-ballads',
  'spoon-river-anthology',
  'literary-walden',
  'middlemarch',
  'the-brothers-karamazov',
  'literary-meditations',
  'sacred-tao-te-ching',
  'the-iliad',
  'the-divine-comedy',
  'metamorphoses',
  'paradise-lost',
  'ulysses'
]));

export const CANON = Object.freeze([
  { id: 'middlemarch', form: 'long prose novel' },
  { id: 'the-brothers-karamazov', form: 'long novel in translation' },
  { id: 'literary-meditations', form: 'short philosophical work' },
  { id: 'sacred-tao-te-ching', form: 'aphoristic scripture' },
  { id: 'the-iliad', form: 'epic in books' },
  { id: 'the-divine-comedy', form: 'structured verse epic' },
  { id: 'metamorphoses', form: 'classical narrative verse' },
  { id: 'spoon-river-anthology', form: 'poetry collection · 244 addressable poems' },
  { id: 'oedipus-rex', form: 'drama' },
  { id: 'literary-walden', form: 'natural prose' },
  { id: 'ulysses', form: 'unusually structured' },

  { id: 'paradise-lost', form: 'English blank-verse epic' },

  // The two fixtures the Standard Ebooks rule cost us, restored from within
  // it. Montaigne was the only test of a short complete PROSE argument, and
  // the Dhammapada the only test of a numbered verse inside a chapter.
  { id: 'literary-essays-emerson', form: 'essay · 21 complete prose arguments' },
  { id: 'confucius-analects', form: 'scriptural verse · 499 addressable sayings' },
  { id: 'lyrical-ballads', form: 'lyric and ballad · 101 poems' }
]);

export const CANON_IDS = Object.freeze(new Set(CANON.map(entry => entry.id)));

/**
 * A work is canonical when it has been certified, not when it appears above.
 *
 * The list names what we INTEND to certify. Until a work has a chosen edition,
 * a structure-preserving ingest and an end-to-end comparison recorded against
 * it, it is a candidate — and this flag is what a card may honestly claim.
 * Nothing here is certified yet; the campaign starts from the list, not from
 * an assertion that the list is already true.
 */
export { CERTIFIED_IDS } from './certification.js';

/**
 * The standing reason, for a work withheld only because it is not in the
 * canon. Works with a KNOWN defect say that instead — a reason a reader or a
 * future curator can act on beats a category every time.
 */
/** Since 2026-08-18 RISE serves Standard Ebooks editions and nothing else. */
const NOT_SE = 'Standard Ebooks does not carry it, and RISE hosts Standard '
  + 'Ebooks editions only (ARCHIVE-CANON-SPEC §6). ';

const NOT_IN_CANON = 'Not in the launch canon. The edition is inherited from a '
  + 'transcription project with no stated fidelity, and RISE has not verified '
  + 'it against a reference. Payload retained for re-sourcing '
  + '(ARCHIVE-CANON-SPEC.md §8).';

/**
 * Defects we have measured, kept against each work they were found in.
 *
 * These are not the only faults on the shelf — they are the ones with
 * evidence. A work absent from this map is withheld for want of verification,
 * which is a different statement from "we found something wrong with it".
 */
const MEASURED = Object.freeze({
  'the-storm-of-steel': 'Jünger died in 1998 and no structured public-domain '
    + `edition exists. ${NOT_SE}The war Journey that read it is on ice.`,
  'extended-dhammapada-full': `Max Müller's Sacred Books of the East. ${NOT_SE}`
    + 'The Analects carries the verse-inside-chapter form in its place.',
  'montaigne-essays': `Cotton's translation, ed. Hazlitt. ${NOT_SE}`
    + "Emerson's Essays carries the essay form in its place.",
  'the-oedipus-trilogy': 'RISE now serves Sophocles as the separate plays the '
    + 'editions publish; Oedipus Rex is canonical and the other two are '
    + `candidates. ${NOT_SE}`,
  'literary-poems-blake': 'The 1901 R. Brimley Johnson edition, which modernized '
    + "Blake — Tyger Tyger becomes Tiger, tiger — and arrives undivided, so its "
    + 'forty-seven poems cannot be named. Standard Ebooks declines to produce '
    + 'Blake at all: his integration of word and engraving yields a series of '
    + 'images rather than parseable text. He needs a source class RISE is not '
    + 'building before release (ARCHIVE-CLEANSING-SPEC §2h).',
  hamlet: 'Cambridge 1863 variorum — 32.3% critical apparatus. Re-source.',
  'king-lear': 'Cambridge 1863 variorum — 39.0% critical apparatus. Re-source.',
  'the-tempest': 'Cambridge 1863 variorum — 11.1% critical apparatus. Re-source.',
  'sacred-rumi': 'Verse lineation destroyed by PDF extraction: 14,110 words in '
    + '35 lines. Needs a text source rather than a scanned PDF.',
  'sacred-corpus-hermeticum': 'Division scheme is built from a works-cited '
    + 'list — 244 divisions named for bibliography entries rather than '
    + 'tractates. Re-divide, or re-source.',
  'literary-letters-young-poet': '14 U+FFFD replacement characters and 89 '
    + 'undecoded HTML entities. A decoding failure upstream of the ingest.',
  'the-shahnama-of-firdausi': 'Heading scheme found so late that 1,006,053 of '
    + '1,099,111 words fall outside it. The scheme is broken, not the text.',
  'literary-poems-dickinson': 'Lineation restored 2026-08-18, but the division '
    + 'scheme is still ordinal and unverified against a reference.',
  'kabir-songs': 'Lineation restored 2026-08-18; the work remains undivided, so '
    + 'its hundred poems cannot be named.',
  'literary-leaves-of-grass': 'Heading detection matches ordinary verse lines: '
    + '11,359 of 121,712 words were consumed as division titles and deleted '
    + 'from the body. Re-source (ARCHIVE-CLEANSING-SPEC §2j).'
});

/**
 * Every work not in the canon, mapped to the reason it is not served.
 *
 * @param {string[]} shelvedIds every work id the archive can build
 * @returns {Readonly<Record<string, string>>}
 */
export function withheldWorks(shelvedIds = []) {
  const withheld = {};
  for (const id of shelvedIds) {
    if (CANON_IDS.has(id)) continue;
    withheld[id] = MEASURED[id] || NOT_IN_CANON;
  }
  // A measured defect stands even for a work no longer built, so a future
  // re-ingest cannot quietly land without answering it.
  for (const [id, reason] of Object.entries(MEASURED)) {
    if (!CANON_IDS.has(id)) withheld[id] = reason;
  }
  return Object.freeze(withheld);
}
