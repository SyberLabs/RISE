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

    'sacred-yoga-sutras': {
        claimed: 'Charles Johnston',
        actual: 'Swami Vivekananda (1896)',
        status: 'clear-but-misattributed',
        evidence: 'Vivekananda died 1902 and Raja Yoga is 1896, so the TEXT is public domain. The Archive simply named the wrong translator.',
        // Quarantined for honesty rather than rights: a provenance that
        // is wrong is not provenance, even when the answer it gets to
        // happens to be safe.
        recovery: 'Correct the attribution to Vivekananda, 1896. No rights obstacle.'
    }
});

/** Is this work withheld from readers? */
export function isQuarantined(textId) {
    return Object.prototype.hasOwnProperty.call(QUARANTINED, textId);
}

export function quarantineFor(textId) {
    return QUARANTINED[textId] || null;
}
