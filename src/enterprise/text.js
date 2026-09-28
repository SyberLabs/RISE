/**
 * Shared tokenization for prepare-time overlap and live matching.
 *
 * Prefixes exist so a partial transcript can hit an entity before the
 * recognizer finishes the word. They are not used while building the program:
 * a slide earns a card on whole tokens only.
 */

const STOP = new Set([
    'a', 'an', 'the', 'and', 'or', 'to', 'of', 'for', 'in', 'on', 'at', 'by',
    'with', 'from', 'that', 'this', 'is', 'are', 'was', 'be', 'it', 'we', 'our',
    'show', 'walk', 'through', 'let', 'us', 'lets'
]);

export function tokenize(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/['’]/g, '')
        .split(/[^a-z0-9.]+/)
        .filter(token => token && token.length > 1 && !STOP.has(token));
}

export function covers(term, token) {
    if (term === token) return true;
    return token.length >= 4 && term.startsWith(token);
}

export function sentences(text) {
    return String(text ?? '')
        .split(/(?<=[.!?])\s+/u)
        .map(sentence => sentence.trim())
        .filter(Boolean);
}
