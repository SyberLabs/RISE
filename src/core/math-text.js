/**
 * Where the maths is in a shown text: `$…$` inline and `$$…$$` on its own.
 *
 * Pure text, no KaTeX: the Worker validates Currents through rise-current.js,
 * and wrangler bundles everything that module reaches, so the typesetter's
 * imports (KaTeX, its stylesheet, its fonts) must stay in math-typeset.js,
 * which only the card loads.
 */

const MATH = /\$\$([^$]+?)\$\$|\$([^$\n]+?)\$/gu;

/** Whether a text has maths to typeset. */
export function hasMath(text) {
  return typeof text === 'string' && /\$[^$\n]+\$/u.test(text);
}

/**
 * A text as its words and its maths, in order: `{ kind: 'text', value }` runs
 * and `{ kind: 'math', value, display }` formulas (the TeX without its dollars).
 */
export function splitMath(text) {
  const parts = [];
  if (typeof text !== 'string' || !text) return parts;
  let cursor = 0;
  MATH.lastIndex = 0;
  for (let match = MATH.exec(text); match !== null; match = MATH.exec(text)) {
    if (match.index > cursor) parts.push({ kind: 'text', value: text.slice(cursor, match.index) });
    parts.push({ kind: 'math', value: (match[1] ?? match[2]).trim(), display: match[1] !== undefined });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push({ kind: 'text', value: text.slice(cursor) });
  return parts;
}
