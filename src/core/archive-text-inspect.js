/**
 * Archive text inspect — the same four signals the shelf audit uses.
 *
 * Identity hashes ask whether the bytes are stable. These rates ask whether
 * they are the work: a variorum apparatus, a shredded scan, or publisher
 * furniture folded into the prose. Agent ingestion must reuse this, not
 * invent a faster path around it.
 *
 * Reproduce the shelf audit with `npm run audit:text`.
 */

export const ARCHIVE_TEXT_SAMPLE_CHARS = 240_000;
export const ARCHIVE_TEXT_REFUSE_SCORE = 12;
export const ARCHIVE_TEXT_WATCH_SCORE = 6;

/**
 * A critical-apparatus line. The `]` lemma bracket is the giveaway —
 * it is how every variorum prints a reading, and it is vanishingly rare
 * in prose or verse.
 */
const APPARATUS = [
  /^\s*\d+[.,]\s*\d*[.,]?\s*[^\]]{0,28}\]/,
  /\b(?:Qq|Ff|Q[1-8]|F[1-4])\b/,
  /\bconj\./,
  /\b(?:om\.|edd\.|ed\.)\s/i,
  /\b(?:Capell|Malone|Theobald|Steevens|Warburton|Hanmer|Rowe|Dyce|Collier)\b/
];

/** Publisher furniture that belongs to the page, not the work. */
const FURNITURE = [
  /^\s*\d{1,4}\s+[A-Z][A-Z' .]{3,}\s*[.[]/,
  /^\s*[A-Z][A-Z' .]{3,}\.\s*\d{1,4}\s*$/,
  /^\s*VOL\.\s*[IVXL]+/i,
  /^\s*\d{1,4}\s*$/,
  /^\s*[A-Z]\s*\d?\s*$/
];

const WORD = /[A-Za-z][A-Za-z'’-]*/g;

export function gibberishRate(text) {
  const tokens = text.match(WORD) || [];
  if (!tokens.length) return 1;
  let bad = 0;
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower.length > 3 && !/[aeiouy]/.test(lower)) { bad += 1; continue; }
    if (/[a-z][A-Z]{2,}/.test(token)) { bad += 1; continue; }
    if (token.length === 1 && !/[aAiIoO]/.test(token)) { bad += 1; }
  }
  return bad / tokens.length;
}

export function lineRates(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return { apparatus: 0, furniture: 0, lines: 0 };
  let apparatus = 0;
  let furniture = 0;
  for (const line of lines) {
    if (APPARATUS.some(re => re.test(line))) apparatus += 1;
    else if (FURNITURE.some(re => re.test(line))) furniture += 1;
  }
  return { apparatus: apparatus / lines.length, furniture: furniture / lines.length, lines: lines.length };
}

export function symbolRate(text) {
  const total = text.length || 1;
  const odd = (text.match(/[^\w\s.,;:!?'"()\[\]—–\-’‘“”]/g) || []).length;
  return odd / total;
}

/**
 * @param {string} text
 * @param {{ sampleChars?: number }} [options]
 * @returns {{ apparatus: number, gibberish: number, furniture: number, symbols: number,
 *   score: number, sampleChars: number, lines: number, warnings: string[] }}
 */
export function inspectArchiveText(text, { sampleChars = ARCHIVE_TEXT_SAMPLE_CHARS } = {}) {
  const sample = String(text || '').slice(0, sampleChars);
  const { apparatus, furniture, lines } = lineRates(sample);
  const gibberish = gibberishRate(sample);
  const symbols = symbolRate(sample);
  const score = apparatus * 100 + gibberish * 60 + furniture * 30 + symbols * 40;
  const warnings = [];
  if (apparatus > 0.02) warnings.push('apparatus');
  if (gibberish > 0.05) warnings.push('gibberish');
  if (furniture > 0.02) warnings.push('furniture');
  if (symbols > 0.04) warnings.push('symbols');
  if (score > ARCHIVE_TEXT_WATCH_SCORE) warnings.push('watch');
  if (score > ARCHIVE_TEXT_REFUSE_SCORE) warnings.push('refuse');
  return Object.freeze({
    apparatus,
    gibberish,
    furniture,
    symbols,
    score,
    sampleChars: sample.length,
    lines,
    warnings: Object.freeze(warnings)
  });
}
