// Shared prose contract for the Worker, browser, and portable artifacts.
// Single LF line breaks are text; blank lines delimit separate paragraphs.
export function validatePiece(value) {
  if (!value || typeof value.title !== 'string' || !value.title.trim()
    || value.title.length > 80 || value.title !== value.title.trim()
    || /[\r\n]/u.test(value.title)
    || !Array.isArray(value.paragraphs) || value.paragraphs.length < 2 || value.paragraphs.length > 5
    || value.paragraphs.some(p => typeof p !== 'string' || !p.trim() || p.length > 2000
      || p !== p.trim() || /\r|\n[^\S\n]*\n/u.test(p))) throw new Error('The writer returned an invalid piece.');
  const words = value.paragraphs.join(' ').split(/\s+/u).filter(Boolean).length;
  if (words < 80 || words > 220) throw new Error('The writer returned an invalid piece length.');
  return { title: value.title, paragraphs: [...value.paragraphs] };
}
