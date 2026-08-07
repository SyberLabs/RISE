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
 * Licence classes, kept separate because obligations differ.
 *
 * Open / CC0 carry no attribution duty; many works have unknown hands
 * and display with a title alone or no label. Withholding must ask which
 * class applies, or open shelves would be emptied wrongly.
 *
 * Share-alike is separate from plain BY: both require credit, but
 * derivative obligations differ.
 */
export const LICENCE = Object.freeze({
    /** No obligation. Public domain, CC0, US-government works. */
    OPEN: 'open',
    /** Credit required. */
    BY: 'cc-by',
    /** Credit required, and share-alike governs derivatives. */
    BY_SA: 'cc-by-sa',
    /**
     * Not copyrighted, but acknowledgement is asked for (e.g. NASA).
     * Not CC-BY terms; not plain OPEN either. Behaves like BY for display.
     */
    PD_CREDIT: 'public-domain-credit',
    /**
     * Written permission on stated conditions. Behaves like BY: credit
     * is owed because the grant says so, not because a string happened
     * to be present.
     */
    PERMISSION: 'permission',
    /**
     * Declared restrictive (NC, ND, all rights reserved, etc.).
     * Mislabeling as permissive is fail-open on the one question that
     * must fail closed.
     */
    RESTRICTED: 'restricted',
    /**
     * Something was declared and the vocabulary does not recognise it.
     * Distinct from UNDECLARED (nothing stated — tolerated). Treating
     * an unrecognised declaration as OPEN is a permissive guess; that
     * fails closed instead.
     */
    UNKNOWN_DECLARED: 'unknown-declared',
    /** Nothing was declared. Not the same as "open". */
    UNDECLARED: 'undeclared'
});

/**
 * Open-declaration vocabulary. Underscore and hyphen both count so
 * forms like `PUBLIC_DOMAIN` match, not only spaced/hyphenated prose.
 */
const OPEN_RIGHTS = /\b(cc0|public[\s_-]*domain|no known copyright|us[\s_-]*gov|pd)\b/i;
const SHARE_ALIKE = /\bCC[\s-]*BY[\s-]*SA\b|share[\s-]*alike/i;

/** A grant from a holder, on conditions the grant states. */
const BY_PERMISSION = /\bpermission\b/i;

/**
 * Restrictive language — tested first. Every other pattern looks for a
 * reason to show; this is the reason not to. Bare `nd` is not evidence;
 * `CC BY-ND` is.
 */
const RESTRICTIVE = /\b(?:nc|non[\s-]*commercial|no[\s-]*derivatives?)\b|\bCC[\s-]*BY[\s-]*ND\b|\ball rights reserved\b|©|\(c\)\s*\d{4}|\beducational use only\b/i;

/**
 * Licence class from the raw item, before any label is composed.
 *
 * Separable from normalizeArtworkLabel (which returns null when there
 * is nothing to display): obligation must be knowable even when there
 * is no chip, so "no metadata, no duty" is not confused with "duty unmet".
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

    // Restriction first: CC BY-NC also matches plain CC-BY.
    if (RESTRICTIVE.test(declared)) return LICENCE.RESTRICTED;
    if (SHARE_ALIKE.test(declared)) return LICENCE.BY_SA;
    if (REQUIRED_CREDIT.test(declared)) return LICENCE.BY;
    // Permission grant carries conditions → owes credit.
    if (BY_PERMISSION.test(declared)) return LICENCE.PERMISSION;
    // PD + explicit acknowledgement before plain OPEN / BY fallback.
    if (OPEN_RIGHTS.test(declared)) return explicit ? LICENCE.PD_CREDIT : LICENCE.OPEN;
    if (explicit) return LICENCE.BY;
    // Unrecognised declaration is not open; undeclared stays tolerated.
    if (declared) return LICENCE.UNKNOWN_DECLARED;
    return LICENCE.UNDECLARED;
}

/** Does this record carry an attribution obligation? */
const OWES_CREDIT = new Set([
    LICENCE.BY, LICENCE.BY_SA, LICENCE.PD_CREDIT, LICENCE.PERMISSION
]);

export const creditIsRequired = (item) => OWES_CREDIT.has(licenceClassOf(item));

/**
 * Concise licence identification (deed short form, not full legal title).
 * Share-alike matched first — "Attribution-ShareAlike" contains
 * "Attribution".
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
 * Credit proper for the chip; supplementary "Acknowledgment:" roster
 * set aside for the Curia. Cut is structural — no length fallback.
 * Shortening designated names risks §3(a)(1)(A); dropping a provider-
 * labelled thanks section does not. Marker-less name lists stay whole.
 * Full text remains reachable via Curia (§3(a)(3)).
 */
// Trailing punctuation cleaned after the cut so a closing paren on the
// last affiliation (e.g. "(STScI/AURA). Acknowledgment:") is kept.
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

    // Sentence punctuation only; trailing ")" stays with the affiliation.
    head = head.replace(/[\s.,;:]+$/, '').trim();
    if (!head) return { text: value, elided: false };

    // elided = roster set aside, not merely a trimmed full stop.
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
    // Uncapped: Curia must hold the full credit (§3(a)(3)); chip length
    // is creditProper's job below.
    const attribution = plainArtworkText(
        data.attribution || metadata.attribution,
        Number.MAX_SAFE_INTEGER
    );
    const licence = licenceClassOf(item);
    const creditRequired = OWES_CREDIT.has(licence);

    // Open work, nothing to say → no chip.
    if (!title && !artist && !attribution && !creditRequired) return null;

    const labelText = [title, artist].filter(Boolean).join(' · ');

    // Attribution replaces name fields; licence still appended unless
    // the provider string already names it (§3(a)(1)).
    const names = attribution || [title, artist, sourceName].filter(Boolean).join(' · ');

    // Trim only when credit is required; open / CC0 composition untouched.
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
         * Credit owed but none composable → withhold (absent, never
         * uncredited). Test is on names, not requiredText: a licence
         * alone is not a credit.
         */
        creditUnsatisfied: creditRequired && !names,
        /**
         * Restrictive or unrecognised declaration — permission problem,
         * not a credit problem.
         */
        restricted: licence === LICENCE.RESTRICTED || licence === LICENCE.UNKNOWN_DECLARED
    });
}

export function displayedArtworkLabel(label, showOptional = true) {
    if (!label) return '';
    if (label.creditRequired) return label.requiredText || label.labelText;
    return showOptional ? label.labelText : '';
}

/**
 * May this work be shown? Refuse restricted / unknown-declared, and
 * credit-required works whose credit cannot be composed. Open and
 * undeclared records stay displayable (SOURCE-EXPANSION-SPEC §3).
 */
export function artworkMayBeShown(label) {
    // Restricted / unknown-declared fail closed (permission never given).
    // Uncreditable credit-required works fail separately (duty unmet).
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
