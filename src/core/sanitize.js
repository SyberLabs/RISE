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
 * A blob: URL belonging to THIS document.
 *
 * `URL.createObjectURL` mints `blob:<origin>/<uuid>`, so the origin is
 * checkable and the check is the difference between "we accept our own
 * object URLs" and "we accept any string beginning blob:". The comment
 * here used to claim same-document while the test was a bare `/^blob:/`;
 * a guarantee written down and not performed is the one that gets relied
 * on. An opaque origin (file://, sandboxed frame) mints `blob:null/`.
 *
 * THE MODEL LAYER STAYS PERMISSIVE ON PURPOSE. `sequenceAssetHasUri`,
 * `isSessionImageUri` and their neighbours still test a bare `blob:`
 * prefix, and that is not an oversight to reconcile: they answer "is this
 * a runtime URI at all" in code that runs without a document. This
 * function is the DOM boundary and the only place the question is about
 * trust. Classify broadly, emit narrowly.
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
