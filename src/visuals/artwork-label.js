/**
 * Canonical metadata boundary for labels attached to sourced visual works.
 *
 * Providers remain free to expose richer records, but presenters consume one
 * small, immutable shape. Remote metadata is reduced to plain text here so a
 * museum API or Commons HTML fragment never reaches a caption as markup.
 */

const MAX_TEXT = 500;
const REQUIRED_CREDIT = /\bCC[\s-]*BY\b|creative commons attribution/i;

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
    const creditRequired = data.creditRequired === true
        || metadata.creditRequired === true
        || REQUIRED_CREDIT.test(rightsBasis);

    if (!title && !artist && !attribution) return null;

    const labelText = [title, artist].filter(Boolean).join(' · ');
    const requiredText = attribution || [
        title,
        artist,
        sourceName,
        rightsBasis
    ].filter(Boolean).join(' · ');

    return Object.freeze({
        title,
        artist,
        date,
        sourceName,
        sourceUrl,
        rightsBasis,
        attribution,
        creditRequired,
        labelText,
        requiredText
    });
}

export function displayedArtworkLabel(label, showOptional = true) {
    if (!label) return '';
    if (label.creditRequired) return label.requiredText || label.labelText;
    return showOptional ? label.labelText : '';
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
