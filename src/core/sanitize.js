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
 * Validate a URL for safe use in image/background contexts.
 * Allows http(s) and data:image/* only; anything else returns ''.
 * @param {*} url
 * @returns {string} the original URL if safe, otherwise ''
 */
export function safeUrl(url) {
    if (typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed)) {
        // Escape quotes/parens so the value cannot break out of url('...') or attributes
        return trimmed.replace(/['"()<>]/g, encodeURIComponent);
    }
    return '';
}
