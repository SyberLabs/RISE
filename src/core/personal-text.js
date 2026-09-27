// One text contract for the writer Worker and the browser. A paragraph may keep
// single line breaks (verse); blank lines are reserved as paragraph separators.
export const normalizeTitle = value => value.replace(/\s+/gu, ' ').trim();
export const normalizeParagraph = value => value.replace(/\r\n?/gu, '\n').split('\n')
  .map(line => line.replace(/\s+/gu, ' ').trim()).filter(Boolean).join('\n');
export const countWords = paragraphs => paragraphs.join(' ').split(/\s+/u).filter(Boolean).length;

/** True when the piece is already canonical and inside the shared bounds. */
export function isCanonicalPiece(value) {
  return Boolean(value) && typeof value.title === 'string' && value.title.length >= 1 && value.title.length <= 80
    && value.title === normalizeTitle(value.title)
    && Array.isArray(value.paragraphs) && value.paragraphs.length >= 2 && value.paragraphs.length <= 5
    && value.paragraphs.every(p => typeof p === 'string' && p.length >= 1 && p.length <= 2000 && p === normalizeParagraph(p))
    && countWords(value.paragraphs) >= 80 && countWords(value.paragraphs) <= 220;
}
