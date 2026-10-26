/**
 * Where the maths is in a text, and how a text with maths is said
 * (docs/superpowers/specs/2026-10-26-math-both-channels-design.md §3.1). The
 * chunker reads it on the first load's path, so it stays small: a formula's
 * plain reading and its dwell are math-reading.js.
 *
 * Pure text, no KaTeX: the Worker validates Currents through rise-current.js,
 * and wrangler bundles everything that module reaches, so the typesetter's
 * imports (KaTeX, its stylesheet, its fonts, the speech engine) must stay in
 * math-typeset.js, which only a page that shows a reading loads.
 */

/** Commands that begin maths written with no delimiter. Only these: `C:\Users` and `\n` are prose. */
const BARE = new Set([
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'vartheta', 'iota', 'kappa',
  'lambda', 'mu', 'nu', 'xi', 'pi', 'varpi', 'rho', 'varrho', 'sigma', 'varsigma', 'tau', 'upsilon', 'phi', 'varphi',
  'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega',
  'frac', 'dfrac', 'tfrac', 'sqrt', 'sum', 'prod', 'int', 'iint', 'oint', 'lim', 'infty', 'partial', 'nabla', 'hbar',
  'cdot', 'times', 'pm', 'mp', 'leq', 'geq', 'neq', 'approx', 'equiv', 'propto', 'rightarrow', 'Rightarrow',
  'mathbf', 'mathbb', 'mathcal', 'vec', 'binom', 'ell'
]);

/** A command that makes structure the reader has to take in: each adds to a formula's dwell (§3.7). */
const STRUCTURES = new Set(['frac', 'dfrac', 'tfrac', 'cfrac', 'sqrt', 'sum', 'prod', 'int', 'iint', 'iiint', 'oint', 'lim', 'binom', 'begin']);

const isSpace = ch => ch === undefined || /\s/u.test(ch);
const isDigit = ch => ch !== undefined && /\d/u.test(ch);

/** The end of the brace group opening at `at` (the index after its `}`), or -1. */
export function groupEnd(text, at) {
  let depth = 0;
  for (let i = at; i < text.length; i += 1) {
    if (text[i] === '\\') { i += 1; continue; }
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}' && --depth === 0) return i + 1;
  }
  return -1;
}

/** The end of a command's name at `at` (a backslash): letters, or one other character. */
export function commandEnd(text, at) {
  const name = /^\\([A-Za-z]+)/u.exec(text.slice(at, at + 40));
  return name ? at + name[0].length : at + 2;
}

/** Where a run of bare TeX that begins at `at` ends: its command, groups, scripts and the commands touching it. */
function bareEnd(text, at) {
  let i = commandEnd(text, at);
  for (;;) {
    const ch = text[i];
    if (ch === '{') {
      const end = groupEnd(text, i);
      if (end < 0) return i;
      i = end;
    } else if ((ch === '_' || ch === '^') && !isSpace(text[i + 1])) {
      if (text[i + 1] === '{') {
        const end = groupEnd(text, i + 1);
        if (end < 0) return i;
        i = end;
      } else if (text[i + 1] === '\\') i = commandEnd(text, i + 1);
      else i += 2;
    } else if (ch === '\\' && /[A-Za-z]/u.test(text[i + 1] ?? '')) i = commandEnd(text, i);
    else return i;
  }
}

/** The closing `$` of an inline formula opened at `at`, or -1: the next unescaped one, if it may close. */
function inlineClose(text, at) {
  for (let i = at + 1; i < text.length; i += 1) {
    if (text[i] === '\\') { i += 1; continue; }
    if (text[i] === '\n') return -1;
    if (text[i] !== '$') continue;
    return !isSpace(text[i - 1]) && !isDigit(text[i + 1]) && text[i + 1] !== '$' ? i : -1;
  }
  return -1;
}

/** Money, not maths: a span that starts with a digit and holds no maths sign ("$5, but $"). */
const looksLikeMoney = tex => isDigit(tex[0]) && !/[\\^_=+<>]/u.test(tex);

/**
 * Where each formula of a text is: `{ start, end, value, display }`, `start`
 * and `end` around the formula with its delimiters, `value` the TeX inside.
 * Reads `$$…$$`, `\[…\]`, `$…$` (Pandoc's rule, and never money), `\(…\)`,
 * TeX in backticks, and bare TeX that begins with a known command.
 */
export function mathSpans(text) {
  const spans = [];
  if (typeof text !== 'string' || !text) return spans;
  /** A formula from `start` to `end`; false if its TeX is blank. */
  const math = (start, end, value, display) => {
    const tex = value.trim();
    if (!tex) return false;
    spans.push({ start, end, value: tex, display });
    return true;
  };
  for (let i = 0; i < text.length;) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '$' && next === '$') {
      const close = text.indexOf('$$', i + 2);
      if (close > i + 2 && math(i, close + 2, text.slice(i + 2, close), true)) { i = close + 2; continue; }
      i += 2;
      continue;
    }
    if (ch === '$') {
      const close = isSpace(next) ? -1 : inlineClose(text, i);
      if (close > 0 && !looksLikeMoney(text.slice(i + 1, close)) && math(i, close + 1, text.slice(i + 1, close), false)) { i = close + 1; continue; }
      i += 1;
      continue;
    }
    if (ch === '\\' && (next === '[' || next === '(')) {
      const close = text.indexOf(next === '[' ? '\\]' : '\\)', i + 2);
      if (close > 0 && math(i, close + 2, text.slice(i + 2, close), next === '[')) { i = close + 2; continue; }
    }
    if (ch === '\\' && next === '$') { i += 2; continue; }
    if (ch === '\\') {
      const name = /^\\([A-Za-z]+)/u.exec(text.slice(i, i + 40));
      if (name && BARE.has(name[1])) {
        const end = bareEnd(text, i);
        math(i, end, text.slice(i, end), false);
        i = end;
        continue;
      }
    }
    if (ch === '`') {
      const close = text.indexOf('`', i + 1);
      const inner = close > 0 ? text.slice(i + 1, close) : '';
      if (inner && !inner.includes('\n')) {
        const dollars = /^\s*(\$\$?)([^$]+)\1\s*$/u.exec(inner);
        if (dollars && math(i, close + 1, dollars[2], dollars[1] === '$$')) { i = close + 1; continue; }
        if (/\\[A-Za-z]/u.test(inner) && math(i, close + 1, inner, false)) { i = close + 1; continue; }
      }
    }
    i += 1;
  }
  return spans;
}

/**
 * A text as its words and its maths, in order: `{ kind: 'text', value }` runs
 * and `{ kind: 'math', value, display }` formulas (the TeX without its delimiters).
 */
export function splitMath(text) {
  const parts = [];
  let cursor = 0;
  for (const { start, end, value, display } of mathSpans(text)) {
    if (start > cursor) parts.push({ kind: 'text', value: text.slice(cursor, start) });
    parts.push({ kind: 'math', value, display });
    cursor = end;
  }
  if (typeof text === 'string' && cursor < text.length) parts.push({ kind: 'text', value: text.slice(cursor) });
  return parts;
}

/**
 * Parts back into a text that splits into the same parts: maths between
 * dollars, or between `\(…\)` and `\[…\]` where a dollar beside it would read
 * otherwise (a digit after, a dollar or backslash before, a formula that looks
 * like money).
 */
export function joinMath(parts) {
  let text = '';
  parts.forEach((part, index) => {
    if (part.kind !== 'math') { text += part.value; return; }
    const before = text.at(-1);
    const after = parts[index + 1]?.value?.[0];
    const crowded = before === '$' || before === '\\' || after === '$';
    if (part.display) text += crowded ? `\\[${part.value}\\]` : `$$${part.value}$$`;
    else text += crowded || isDigit(after) || looksLikeMoney(part.value) ? `\\(${part.value}\\)` : `$${part.value}$`;
  });
  return text;
}

/**
 * A text as it is said: each formula replaced by `speak(tex, display)`, and
 * `at(offset)`, where a written place falls in what is said (a place inside a
 * formula falls where its speech begins). A formula on a line of its own, or
 * one with structure, is followed by a pause the voice takes from punctuation:
 * a full stop before a new sentence or at the end, else a comma, unless the
 * text already has one there. `pauses`: where the voice is silent after a
 * formula, after its punctuation, for `pauseMs(tex, display)` (voices/pauses.js).
 */
export function spokenWith(text, speak, { pauseMs = () => 0 } = {}) {
  const spans = mathSpans(text);
  if (!spans.length) return { text: String(text ?? ''), at: offset => offset, pauses: [] };
  let said = '';
  let cursor = 0;
  /** Written and said offsets at each boundary, in order: [written, said] pairs. */
  const marks = [];
  const pauses = [];
  for (const span of spans) {
    said += text.slice(cursor, span.start);
    marks.push([span.start, said.length]);
    said += speak(span.value, span.display);
    const after = text.slice(span.end);
    const written = /^[,.;:!?]+/u.exec(after)?.[0] ?? '';
    if (!written && (span.display || mathStructure(span.value) > 0)) {
      said += !after.trim() || (span.display && /^\s+\p{Lu}/u.test(after)) ? '.' : ',';
    }
    marks.push([span.end, said.length]);
    const ms = pauseMs(span.value, span.display);
    if (ms > 0) pauses.push({ at: said.length + written.length, ms });
    cursor = span.end;
  }
  said += text.slice(cursor);
  const at = offset => {
    let mapped = offset;
    for (let i = 0; i < marks.length; i += 2) {
      const [start, saidStart] = marks[i];
      const [end, saidEnd] = marks[i + 1];
      if (offset < start) return saidStart - (start - offset);
      if (offset < end) return saidStart;
      mapped = saidEnd + (offset - end);
    }
    return mapped;
  };
  return { text: said, at, pauses };
}

/** Whether a text has maths to typeset. */
export function hasMath(text) {
  return splitMath(text).some(part => part.kind === 'math');
}

/** How many structures (fractions, roots, sums, integrals, limits, arrays) a formula has. */
export function mathStructure(tex) {
  let count = 0;
  for (const match of String(tex ?? '').matchAll(/\\([A-Za-z]+)/gu)) if (STRUCTURES.has(match[1])) count += 1;
  return count;
}
