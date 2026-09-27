// Shared prose contract for the Worker, browser, and portable artifacts.
// Single LF line breaks are text; blank lines delimit separate paragraphs.
// Only LF may break a line: other controls and Unicode separators are refused,
// and the character bound keeps every accepted response under the browser's
// 16 KiB read limit even when JSON escaping doubles each character.
const MAX_PIECE_CHARACTERS = 4000;
const FORBIDDEN = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029]/u;

export function validatePiece(value) {
  if (!value || typeof value.title !== 'string' || !value.title.trim()
    || value.title.length > 80 || value.title !== value.title.trim()
    || /[\r\n]/u.test(value.title)
    || !Array.isArray(value.paragraphs) || value.paragraphs.length < 2 || value.paragraphs.length > 5
    || value.paragraphs.some(p => typeof p !== 'string' || !p.trim() || p.length > 2000
      || p !== p.trim() || /\r|\n[^\S\n]*\n/u.test(p))) throw new Error('The writer returned an invalid piece.');
  if ([value.title, ...value.paragraphs].some(text => FORBIDDEN.test(text))
    || value.title.length + value.paragraphs.reduce((sum, p) => sum + p.length, 0) > MAX_PIECE_CHARACTERS) {
    throw new Error('The writer returned an invalid piece.');
  }
  const words = value.paragraphs.join(' ').split(/\s+/u).filter(Boolean).length;
  if (words < 80 || words > 220) throw new Error('The writer returned an invalid piece length.');
  return { title: value.title, paragraphs: [...value.paragraphs] };
}
