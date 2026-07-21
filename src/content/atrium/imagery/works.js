/**
 * Atrium Imagery — the resolved-work contract.
 *
 * A "work" is a specific artwork pinned by identifier in a named museum
 * collection, resolved to the institution's own catalog record. Every
 * field a reader sees comes from that record; nothing here is asserted
 * by us in a comment.
 *
 * This is the replacement for keyword-matched Wikimedia categories,
 * which are filing rather than curation — see ATRIUM-IMAGERY-SPEC.md.
 */

/**
 * Rights normalized across institutions. Only public-domain-equivalent
 * values are eligible for display; anything else, including UNKNOWN,
 * is withheld exactly like an Atrium text that fails its rights gate.
 */
export const RIGHTS = Object.freeze({
    CC0: 'CC0',
    PUBLIC_DOMAIN: 'PUBLIC_DOMAIN',
    CC_BY: 'CC-BY',
    CC_BY_SA: 'CC-BY-SA',
    UNKNOWN: 'UNKNOWN'
});

const DISPLAYABLE_RIGHTS = new Set([RIGHTS.CC0, RIGHTS.PUBLIC_DOMAIN]);

/**
 * A work may be displayed only when its rights are established as
 * public-domain-equivalent. Absence of a stated restriction is NOT
 * permission — adapters must map their institution's own field.
 */
export function isDisplayable(work) {
    return !!work && DISPLAYABLE_RIGHTS.has(work.rights) && !!work.imageUrl;
}

const text = (value, max = 300) => {
    if (typeof value !== 'string') return '';
    return value.replace(/<[^>]*>/g, '').trim().slice(0, max);
};

/**
 * Normalize an adapter's raw record into the shared work shape.
 *
 * Returns null when the record cannot support a citation: a work with
 * no image, no source page, or unestablished rights is not a work we
 * can honestly display, and skipping is always correct — a collection
 * that loses a work degrades like any thin source, while a substituted
 * work reintroduces exactly the problem this service removes.
 *
 * @param {Object} raw
 * @returns {Object|null}
 */
export function normalizeWork(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const id = text(raw.id, 120);
    const imageUrl = text(raw.imageUrl, 2000);
    const sourceUrl = text(raw.sourceUrl, 2000);
    if (!id || !imageUrl || !sourceUrl) return null;

    const rights = DISPLAYABLE_RIGHTS.has(raw.rights) ? raw.rights : RIGHTS.UNKNOWN;

    const work = Object.freeze({
        id,
        title: text(raw.title, 240) || 'Untitled',
        artist: text(raw.artist, 160),
        artistBio: text(raw.artistBio, 200),
        date: text(raw.date, 80),
        medium: text(raw.medium, 160),
        rights,
        imageUrl,
        fullImageUrl: text(raw.fullImageUrl, 2000) || imageUrl,
        sourceName: text(raw.sourceName, 120),
        sourceUrl
    });

    return isDisplayable(work) ? work : null;
}

/**
 * One-line attribution for display beneath an image, built only from
 * fields the institution supplied.
 */
export function attributionLine(work) {
    if (!work) return '';
    const parts = [work.title];
    if (work.artist) parts.push(work.artist);
    if (work.date) parts.push(work.date);
    if (work.sourceName) parts.push(work.sourceName);
    return parts.filter(Boolean).join(' · ');
}
