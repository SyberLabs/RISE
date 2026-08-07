/**
 * Canonical metadata boundary for labels attached to sourced visual works.
 *
 * Providers remain free to expose richer records, but presenters consume one
 * small, immutable shape. Remote metadata is reduced to plain text here so a
 * museum API or Commons HTML fragment never reaches a caption as markup.
 */

const MAX_TEXT = 500;
const REQUIRED_CREDIT = /\bCC[\s-]*BY\b|creative commons attribution/i;

/**
 * LICENCE CLASSES, kept separate because their obligations are opposite.
 *
 * The museum corpus cleared on public domain and CC0, which carry **no
 * attribution obligation at all**. Many of those works are by unknown
 * hands — that is ordinary for a 15th-century woodcut — and they are
 * perfectly displayable with a title alone, or with no label whatever.
 * Any rule that withholds an uncreditable work must therefore ask which
 * licence it is withholding under, or it would empty shelves that were
 * never at risk.
 *
 * `share-alike` is separated from plain `by` even though both require
 * credit: they are different licences, wildlife imagery is a mixture of
 * the two, and a ledger that cannot tell them apart cannot answer a
 * question about derivative works later.
 */
export const LICENCE = Object.freeze({
    /** No obligation. Public domain, CC0, US-government works. */
    OPEN: 'open',
    /** Credit required. */
    BY: 'cc-by',
    /** Credit required, and share-alike governs derivatives. */
    BY_SA: 'cc-by-sa',
    /**
     * Not copyrighted, but acknowledgement is asked for as a condition of
     * use. NASA is the case: its own guidance says content "generally
     * are not subject to copyright in the United States" AND that "NASA
     * should be acknowledged as the source of the material".
     *
     * Calling that `cc-by` would be false — it is not a Creative Commons
     * licence and carries none of its terms — and calling it `open` would
     * drop an obligation the institution actually states. It behaves like
     * BY for display and is labelled for what it is.
     */
    PD_CREDIT: 'public-domain-credit',
    /**
     * Used by written permission, on conditions the grant states.
     *
     * Nine Chapel icons are held this way, and they were classifying as
     * OPEN — so the Icon Museum's stated condition, that its attribution
     * name "Icon Museum and Study Center, Clinton MA", was honoured only
     * because an attribution string happened to exist. A condition
     * honoured by luck is not honoured. Permission behaves like BY.
     */
    PERMISSION: 'permission',
    /**
     * Declared, and declared RESTRICTIVE. NonCommercial, all rights
     * reserved, an explicit copyright line.
     *
     * This class exists because the classifier used to end in
     * `declared ? OPEN : UNDECLARED`, which made "All rights reserved"
     * read as open — and worse, `CC BY-NC 4.0` matched the CC-BY test and
     * came out as plain `cc-by`, dropping the NonCommercial term
     * entirely. A restrictive licence mislabelled as permissive is the
     * one error in this file that could not be undone by noticing later.
     */
    RESTRICTED: 'restricted',
    /** Nothing was declared. Not the same as "open". */
    UNDECLARED: 'undeclared'
});

const OPEN_RIGHTS = /\b(cc0|public[\s-]*domain|no known copyright|us[\s-]*gov)/i;
const SHARE_ALIKE = /\bCC[\s-]*BY[\s-]*SA\b|share[\s-]*alike/i;

/** A grant from a holder, on conditions the grant states. */
const BY_PERMISSION = /\bpermission\b/i;

/**
 * Language that RESTRICTS.
 *
 * Tested before everything else, because every other pattern in this file
 * is looking for a reason to SHOW a work and this is the only one looking
 * for a reason not to.
 *
 * A BARE `nd` IS NOT EVIDENCE — two letters that occur inside ordinary
 * prose cannot decide a licence. But `CC BY-ND` is unambiguous, and
 * leaving it out let NoDerivatives classify as plain attribution, which
 * the test for this rule caught immediately.
 */
const RESTRICTIVE = /\b(?:nc|non[\s-]*commercial|no[\s-]*derivatives?)\b|\bCC[\s-]*BY[\s-]*ND\b|\ball rights reserved\b|©|\(c\)\s*\d{4}|\beducational use only\b/i;

/**
 * Which licence class a provider record declares — determined from the
 * RAW item, before any label is composed.
 *
 * This has to be separable, and that is the whole point. The obligation
 * was previously discovered inside `normalizeArtworkLabel`, which
 * returns `null` when there is nothing to display — so a work that
 * REQUIRED credit and had none arrived at the presenter as `null`,
 * indistinguishable from a work that needed none. The caller could not
 * tell "no metadata, no obligation" from "no metadata, obligation
 * unmet", and showed both.
 */
export function licenceClassOf(item) {
    if (!item || typeof item !== 'object') return LICENCE.UNDECLARED;
    const data = item.data && typeof item.data === 'object' ? item.data : {};
    const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : {};

    const declared = plainArtworkText(
        data.rightsBasis || metadata.rightsBasis
        || data.rights || metadata.rights
        || data.license || metadata.license, 120);

    const explicit = data.creditRequired === true || metadata.creditRequired === true;

    // RESTRICTION IS CHECKED FIRST. `CC BY-NC 4.0` satisfies the CC-BY
    // test, so testing that first classified a NonCommercial licence as
    // plain attribution and dropped the term that mattered.
    if (RESTRICTIVE.test(declared)) return LICENCE.RESTRICTED;
    if (SHARE_ALIKE.test(declared)) return LICENCE.BY_SA;
    if (REQUIRED_CREDIT.test(declared)) return LICENCE.BY;
    // A permission grant carries conditions and therefore owes a credit.
    if (BY_PERMISSION.test(declared)) return LICENCE.PERMISSION;
    // Public domain AND an asked-for acknowledgement is its own thing,
    // and the order matters: this must be tested before plain OPEN or a
    // NASA record would lose its obligation, and before the conservative
    // BY fallback or it would gain terms it does not carry.
    if (OPEN_RIGHTS.test(declared)) return explicit ? LICENCE.PD_CREDIT : LICENCE.OPEN;
    if (explicit) return LICENCE.BY;
    return declared ? LICENCE.OPEN : LICENCE.UNDECLARED;
}

/** Does this record carry an attribution obligation? */
const OWES_CREDIT = new Set([
    LICENCE.BY, LICENCE.BY_SA, LICENCE.PD_CREDIT, LICENCE.PERMISSION
]);

export const creditIsRequired = (item) => OWES_CREDIT.has(licenceClassOf(item));

/**
 * Identify the licence concisely.
 *
 * The djangoplicity feeds declare rights as the full legal title —
 * "Creative Commons Attribution 4.0 International License", 54 characters
 * — and all 120 CC-BY candidates carried it. CC BY 4.0 §3(a)(1)(B) asks
 * that the licence be *identified*, not that its title be quoted in full,
 * and "CC BY 4.0" is the identification the licence's own deed uses.
 *
 * SHARE-ALIKE IS MATCHED FIRST. "Attribution-ShareAlike" contains
 * "Attribution", so the looser pattern would swallow it and relabel a
 * BY-SA work as BY — the exact conflation `LICENCE.BY_SA` exists to stop.
 */
const LICENCE_SHORT = [
    [/creative commons\s+attribution[\s-]*(?:share[\s-]*alike|sa)[\s-]*(\d+(?:\.\d+)?)?/i, 'CC BY-SA'],
    [/creative commons\s+attribution[\s-]*(\d+(?:\.\d+)?)?/i, 'CC BY'],
    [/creative commons\s+zero[\s\S]*?(\d+(?:\.\d+)?)?/i, 'CC0']
];

export function shortLicenceName(text) {
    const value = String(text ?? '').trim();
    for (const [pattern, short] of LICENCE_SHORT) {
        const hit = pattern.exec(value);
        if (hit) return hit[1] ? `${short} ${hit[1]}` : short;
    }
    return value;
}

/**
 * The credit proper, with an appended roster set aside for the Curia.
 *
 * Observatory credits append supplementary sections, and the convention
 * is explicit: ESA/Hubble writes "Credit: … Acknowledgment: …", where the
 * first names those designated to receive attribution and the second
 * thanks contributors. One Westerlund 2 credit ran 723 characters —
 * two full observing teams — which is not a chip, it is a paragraph
 * floating over the passage.
 *
 * THE CUT IS STRUCTURAL, AND THERE IS NO LENGTH FALLBACK. That is the
 * legally load-bearing part. §3(a)(1)(A) requires retaining
 * identification of the creators *and any others designated to receive
 * attribution*, so shortening a list of designated names is the risky
 * operation; dropping a section the provider itself labelled as
 * supplementary thanks is not. Five of the twelve long credits are pure
 * name lists with no marker, they top out at 155 characters, and they are
 * left whole however long they run — a chip that is one line too tall is
 * a smaller problem than a credit naming half a person.
 *
 * CC BY 4.0 §3(a)(3) permits satisfying the condition by link where the
 * medium makes the full text impractical, and §3a already ruled the Curia
 * reader-reachable, so the elided roster has somewhere real to live.
 */
// The marker may follow a closing paren — "(STScI/AURA). Acknowledgment:"
// — and that paren belongs to the NAME. A leading character class here
// swallowed it and shipped "(STScI/AURA" as the credit, so the trailing
// punctuation is cleaned after the cut instead of matched before it.
const ROSTER_MARKER = /\s*\b(?:acknowledge?ments?|acknowledgments?)\s*:/i;
/** A run-on where a feed concatenated two fields with no separator. */
const RUN_ON = /\s*\b(?:the original|follow-up|these)\s+observations\b/i;

/**
 * A field label the feed left on the front of its own value — "Image:
 * European Space Agency & NASA". It names the field, not the creator.
 */
const LEADING_LABEL = /^(?:image|credit|copyright)\s*:\s*/i;

export function creditProper(text) {
    const value = String(text ?? '').trim();
    let head = value.replace(LEADING_LABEL, '');

    let cut = false;
    for (const pattern of [ROSTER_MARKER, RUN_ON]) {
        const hit = pattern.exec(head);
        if (hit && hit.index > 0) { head = head.slice(0, hit.index); cut = true; }
    }

    // Only sentence punctuation left dangling by the cut, never a
    // bracket: a trailing ")" is part of the last affiliation.
    head = head.replace(/[\s.,;:]+$/, '').trim();
    if (!head) return { text: value, elided: false };

    // ELIDED MEANS A ROSTER WAS SET ASIDE — not that a full stop was
    // tidied. Comparing the strings conflated the two, so a credit ending
    // "…and the OPAL team." was flagged as having material in the Curia
    // that does not exist, and a reviewer would have been shown a promise
    // the record could not keep.
    return { text: head, elided: cut };
}

const HTML_ENTITIES = Object.freeze({
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"'
});

function decodeEntity(entity) {
    if (entity[0] === '#') {
        const hex = entity[1]?.toLowerCase() === 'x';
        const value = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isFinite(value) && value > 0 && value <= 0x10ffff
            ? String.fromCodePoint(value)
            : '';
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? '';
}

export function plainArtworkText(value, max = MAX_TEXT) {
    return String(value ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi, (_, entity) => decodeEntity(entity))
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max);
}

function safeSourceUrl(value) {
    try {
        const url = new URL(String(value ?? ''));
        return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch {
        return '';
    }
}

/**
 * @param {Object} item provider result: { name, data, metadata }
 * @returns {Object|null}
 */
export function normalizeArtworkLabel(item) {
    if (!item || typeof item !== 'object') return null;
    const data = item.data && typeof item.data === 'object' ? item.data : {};
    const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : {};

    const title = plainArtworkText(data.title || item.name, 240)
        .replace(/^File:\s*/i, '');
    const artist = plainArtworkText(data.artist || metadata.artist, 200);
    const date = plainArtworkText(data.date || metadata.date, 100);
    const sourceName = plainArtworkText(data.sourceName || metadata.sourceName, 160);
    const sourceUrl = safeSourceUrl(data.sourceUrl || metadata.sourceUrl);
    const rightsBasis = plainArtworkText(
        data.rightsBasis
        || metadata.rightsBasis
        || data.rights
        || metadata.rights
        || data.license
        || metadata.license,
        120
    );
    // SANITISED WITHOUT A LENGTH CAP, because this is the string the
    // Curia promises to hold whole.
    //
    // It was capped at 500 characters and THEN assigned to `fullCredit`,
    // so "the Curia carries the full record" — the sentence that makes
    // the roster elision permissible under CC BY 4.0 §3(a)(3) — was false
    // for exactly the credits long enough to need eliding. The science
    // harvest found one of 723 characters. A 2,359-character credit
    // arrived at the Curia as 500.
    //
    // The cap was doing a display job in a sanitising function. Sanitising
    // strips markup and collapses whitespace; deciding how much fits on a
    // chip is `creditProper`'s work, and it happens below.
    const attribution = plainArtworkText(
        data.attribution || metadata.attribution,
        Number.MAX_SAFE_INTEGER
    );
    const licence = licenceClassOf(item);
    const creditRequired = OWES_CREDIT.has(licence);

    // NOTHING TO SAY AND NOTHING OWED. An open-licence work with no
    // metadata is ordinary — much of the museum corpus is by an unknown
    // hand — and it shows without a chip, exactly as it always has.
    if (!title && !artist && !attribution && !creditRequired) return null;

    const labelText = [title, artist].filter(Boolean).join(' · ');

    // COMPOSITION, NOT SUBSTITUTION. This was `attribution || [...]`, and
    // the `||` short-circuited: a work that SUPPLIED an attribution
    // string showed only that and never named its licence —
    // "ESA/Webb, NASA & CSA, J. Lee" with no "CC BY 4.0" anywhere. CC BY
    // 4.0 §3(a)(1) requires the attribution AND identification of the
    // licence, so the provider's string replaces the NAME fields and the
    // licence is still appended.
    // …unless the provider's string already names it. Some records carry
    // a fully composed credit — "Nebula · Observatory · CC BY 4.0" — and
    // appending the licence again would read as a stutter.
    const names = attribution || [title, artist, sourceName].filter(Boolean).join(' · ');

    // TRIMMING APPLIES ONLY TO THE REQUIRED CREDIT, and that boundary is
    // deliberate: `labelText` is what an open-licence work shows, it is
    // already short, and nothing here may reach the CC0 corpus. A work
    // that owes nothing is composed exactly as it always was.
    const proper = creditRequired ? creditProper(names) : { text: names, elided: false };
    const shortLicence = creditRequired ? shortLicenceName(rightsBasis) : rightsBasis;
    const namesLicence = shortLicence
        && proper.text.toLowerCase().includes(shortLicence.toLowerCase());
    const requiredText = namesLicence
        ? proper.text
        : [proper.text, shortLicence].filter(Boolean).join(' · ');

    return Object.freeze({
        title,
        artist,
        date,
        sourceName,
        sourceUrl,
        rightsBasis,
        attribution,
        licence,
        creditRequired,
        labelText,
        requiredText,
        /**
         * The credit as the provider gave it, kept whole. `requiredText`
         * is the chip's line; this is what the Curia must show, and the
         * reason the elision is permissible at all — §3(a)(3)'s "where
         * practical" only holds if the full text is reachable somewhere.
         */
        fullCredit: names,
        creditElided: proper.elided,
        /**
         * A credit is owed and none can be composed. The presenter must
         * WITHHOLD the work rather than show it bare — the imagery's own
         * law, one clause changed: a work that cannot be credited is
         * absent, never uncredited.
         *
         * The test is on the NAMES, not on `requiredText`. A record with
         * a licence and nothing else composes "CC BY 4.0", which is
         * non-empty and is not a credit: it names the licence and
         * credits nobody. Attribution means naming someone.
         */
        creditUnsatisfied: creditRequired && !names,
        /**
         * Declared restrictive. Not a credit problem — a permission
         * problem, and no amount of attribution answers it.
         */
        restricted: licence === LICENCE.RESTRICTED
    });
}

export function displayedArtworkLabel(label, showOptional = true) {
    if (!label) return '';
    if (label.creditRequired) return label.requiredText || label.labelText;
    return showOptional ? label.labelText : '';
}

/**
 * May this work be shown at all?
 *
 * The ONLY case that refuses is a credit-required work whose credit
 * cannot be composed. Everything else — open licences, undeclared
 * records, works with no metadata — displays exactly as before, which is
 * the point: this rule must not reach the CC0 corpus.
 *
 * `SOURCE-EXPANSION-SPEC` §3 already ruled it in words — "a CC-BY work
 * with no place to show its credit cannot be shown" — and this is that
 * sentence in code.
 */
export function artworkMayBeShown(label) {
    // A RESTRICTIVE DECLARATION FAILS CLOSED, and it is a different
    // refusal from the one below it. An uncreditable work is withheld
    // because an obligation cannot be met; a restricted work is withheld
    // because permission was never given, and a perfect credit would not
    // change that.
    //
    // NOTHING IN THE CORPUS IS RESTRICTED TODAY — all five declared
    // rights strings across every collection classify exactly as they did
    // before this guard existed. It is here for the next harvest, which
    // is the only time it can be added without argument.
    if (label?.restricted) return false;
    return !label?.creditUnsatisfied;
}

/**
 * Apply one label string consistently across Flash and Gallery surfaces.
 * Length is exposed as presentation metadata so CSS can tighten typography
 * without providers or presenters inventing their own thresholds.
 */
export function applyArtworkLabelElement(element, text, creditRequired = false) {
    if (!element) return;
    const value = typeof text === 'string' ? text : '';
    element.textContent = value;
    element.hidden = !value;
    element.dataset.creditRequired = String(!!creditRequired);
    element.dataset.labelLength = value.length > 150
        ? 'very-long'
        : value.length > 72
            ? 'long'
            : 'standard';
    if (value) {
        element.title = value;
    } else {
        element.removeAttribute('title');
    }
}
