/**
 * Sanitize helpers
 * Escape untrusted strings before interpolating them into innerHTML templates.
 *
 * Anything that originates outside the codebase is untrusted:
 * remote API results (Gutenberg, arXiv, Wikimedia, museum APIs),
 * user-entered titles/journals, and uploaded file names.
 */

const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

/**
 * Escape a value for safe use in HTML text content or attribute values.
 * @param {*} value - coerced to string; null/undefined become ''
 * @returns {string}
 */
export function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

/**
 * A blob: URL belonging to this document (`blob:<origin>/…`).
 * Opaque origins mint `blob:null/`. Model-layer URI checks may stay
 * permissive (`blob:` prefix only); this is the DOM trust boundary.
 */
function isSameDocumentBlobUrl(value) {
    if (typeof location === 'undefined') return false;
    const origin = location.origin && location.origin !== 'null' ? location.origin : 'null';
    return value.toLowerCase().startsWith(`blob:${origin.toLowerCase()}/`);
}

/**
 * Validate a URL for safe use in image/background contexts.
 * Allows http(s), data:image/*, and same-document blob: object URLs
 * (Workshop media hydrate). Anything else returns ''.
 * @param {*} url
 * @returns {string} the original URL if safe, otherwise ''
 */
export function safeUrl(url) {
    if (typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)
      || /^data:image\//i.test(trimmed)
      || isSameDocumentBlobUrl(trimmed)) {
        // Escape quotes/parens so the value cannot break out of url('...') or attributes
        return trimmed.replace(/['"()<>]/g, encodeURIComponent);
    }
    return '';
}
