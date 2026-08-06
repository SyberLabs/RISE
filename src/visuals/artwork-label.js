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
    /** Nothing was declared. Not the same as "open". */
    UNDECLARED: 'undeclared'
});

const OPEN_RIGHTS = /\b(cc0|public[\s-]*domain|no known copyright|us[\s-]*gov)/i;
const SHARE_ALIKE = /\bCC[\s-]*BY[\s-]*SA\b|share[\s-]*alike/i;

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

    if (SHARE_ALIKE.test(declared)) return LICENCE.BY_SA;
    if (REQUIRED_CREDIT.test(declared)) return LICENCE.BY;
    // Public domain AND an asked-for acknowledgement is its own thing,
    // and the order matters: this must be tested before plain OPEN or a
    // NASA record would lose its obligation, and before the conservative
    // BY fallback or it would gain terms it does not carry.
    if (OPEN_RIGHTS.test(declared)) return explicit ? LICENCE.PD_CREDIT : LICENCE.OPEN;
    if (explicit) return LICENCE.BY;
    return declared ? LICENCE.OPEN : LICENCE.UNDECLARED;
}

/** Does this record carry an attribution obligation? */
const OWES_CREDIT = new Set([LICENCE.BY, LICENCE.BY_SA, LICENCE.PD_CREDIT]);

export const creditIsRequired = (item) => OWES_CREDIT.has(licenceClassOf(item));

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
    const attribution = plainArtworkText(
        data.attribution || metadata.attribution,
        500
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
    const namesLicence = rightsBasis
        && names.toLowerCase().includes(rightsBasis.toLowerCase());
    const requiredText = namesLicence
        ? names
        : [names, rightsBasis].filter(Boolean).join(' · ');

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
        creditUnsatisfied: creditRequired && !names
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
