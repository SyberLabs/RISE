/**
 * Quarantine — works withheld until their rights are established.
 *
 * A quarantined text is NOT shown to a reader. It stays in the corpus
 * because the text may be recoverable once traced to a clean edition,
 * and deleting it would destroy that option along with the evidence of
 * what went wrong.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The Archive's rights invariant (LIBRARY-SPEC §4) says every text is
 * public domain with the basis recorded. On 2026-07-28 that invariant
 * was written, enforced by a test, and violated in the same commit: the
 * curation table recorded `translator: 'Traditional'` for texts whose
 * own source files name twentieth-century translators. The provenance
 * was filled in from assumption rather than read from the source.
 *
 * SOL's acquisitions review caught it. The lesson is narrower and worse
 * than "check the rights": the checking was performed, the field was
 * populated, and the value was invented. A field that is required but
 * unverified is more dangerous than one left blank, because it satisfies
 * the test and silences the question.
 *
 * So the quarantine records, per work, what was CLAIMED and what the
 * source actually SAYS. That difference is the finding.
 */

/**
 * @typedef {Object} QuarantineEntry
 * @property {string} claimed    what the Archive said the translation was
 * @property {string} actual     what the source file names
 * @property {string} status     the established rights position
 * @property {string} evidence   how that position was established
 * @property {string} recovery   what would clear it, if anything
 */

export const QUARANTINED = Object.freeze({
    'sacred-heart-sutra': {
        claimed: 'Traditional',
        actual: 'Edward Conze (adapted)',
        status: 'in-copyright',
        evidence: 'Conze died 1979 — 47 years, short of the 70 the basis requires. His Heart Sutra renderings are 1957 and 1973.',
        // Worth recording because it changes what recovery means: the
        // shipped text reads closer to the common liturgical English
        // chanted in Zen centres than to Conze's scholarly version
        // ("Avalokita, the Holy Lord" / "O Sariputra, form is
        // emptiness"). The attribution may be wrong rather than the text
        // infringing. But "probably not Conze" is not a rights basis.
        recovery: 'Trace the text to a named pre-1930 edition, or commission/adopt an attributed public-domain rendering. If it is in fact liturgical common text, establish that with a source, not by inspection.'
    },

    'sacred-gospel-of-thomas': {
        claimed: 'Traditional',
        actual: 'Thomas O. Lambdin',
        status: 'in-copyright',
        evidence: 'Lambdin\'s translation appears in The Nag Hammadi Library in English, © E. J. Brill 1978/1988, whose notice forbids reproduction outside brief quotation.',
        // The structural point SOL makes: the codex was discovered in
        // 1945, so no pre-1930 English edition of this text can exist.
        recovery: 'None by way of an older edition — the Nag Hammadi codices were unearthed in 1945. Only an explicitly PD-dedicated translation would clear it.'
    },

    'sacred-upanishads': {
        claimed: 'Max Müller',
        actual: 'Max Müller / Swami Nikhilananda',
        status: 'mixed',
        evidence: 'Müller (d. 1900, Sacred Books of the East 1879–1884) is clear. Nikhilananda (d. 1973) is not, and the record does not say which sentences are whose.',
        recovery: 'Rebuild from Müller alone, tracing every sentence to the 1884 text. The work returns as soon as it is provably one translator.'
    },

    'sacred-hermetica': {
        claimed: 'G. R. S. Mead',
        actual: 'G.R.S. Mead / Brian Copenhaver',
        status: 'mixed',
        evidence: 'Mead (d. 1933, Thrice-Greatest Hermes 1906) is clear. Copenhaver\'s Hermetica is Cambridge University Press, 1992.',
        recovery: 'Rebuild from Mead alone. Same condition as the Upanishads.'
    },

    'extended-upanishads-full': {
        claimed: '(none recorded)',
        actual: '(none recorded)',
        status: 'unestablished',
        evidence: 'The fallback edition names no translator at all. An anonymous English Upanishads cannot be dated, and an undated translation cannot be cleared.',
        // Surfaced only when the deep edition was withheld — the
        // fallback chain had been hiding it. Worth noting as a pattern:
        // a priority-ordered registry can conceal an unvetted work
        // behind a vetted one.
        recovery: 'Same as the deep edition: rebuild from Müller 1884, or identify the actual translator and date it.'
    },

    'sacred-wheel-of-time': {
        claimed: 'Toltec Tradition, translator "Traditional"',
        actual: 'Carlos Castaneda, Tales of Power (1974) and The Wheel of Time (1998)',
        status: 'in-copyright',
        evidence: 'The verses are verbatim don Juan quotations — "We are perceivers. We are awareness; we are not objects" is Tales of Power, Simon & Schuster 1974. Castaneda died 1998; the material is under copyright.',
        // The deeper problem is the attribution, not only the rights.
        // Castaneda's don Juan is a twentieth-century literary creation
        // whose ethnographic basis is disputed by the scholars of the
        // people it claims to describe. Filing it as "Toltec" would
        // misrepresent a living tradition even if the rights were clean
        // — which is why it cannot simply move to another shelf.
        recovery: 'None. If Mesoamerican material belongs in the Archive it must come from an attributed source, not from Castaneda.'
    },

    'sacred-marcus-aurelius': {
        claimed: 'a distinct work',
        actual: 'the same George Long text the Archive already holds in full',
        status: 'duplicate',
        evidence: 'Both this and literary-meditations are Long’s 1862 translation. The rights are clean; the holding is not. A selection is a ROUTE through a work, not a second copy of it.',
        // Withheld rather than deleted because the selection itself is
        // an editorial judgement worth keeping: it should return as a
        // reading route into the full text once the Archive can express
        // one, which is a feature it does not yet have.
        recovery: 'Reinstate as a named route through literary-meditations once the Archive supports routes. Never as a separate holding.'
    },

});

/** Is this work withheld from readers? */
export function isQuarantined(textId) {
    return Object.prototype.hasOwnProperty.call(QUARANTINED, textId);
}

export function quarantineFor(textId) {
    return QUARANTINED[textId] || null;
}
