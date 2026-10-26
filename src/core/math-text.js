/**
 * Where the maths is in a text, and a plain reading of it for the eye and the
 * ear when KaTeX cannot give one (docs/superpowers/specs/2026-10-26-math-both-channels-design.md §3.1).
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
function groupEnd(text, at) {
  let depth = 0;
  for (let i = at; i < text.length; i += 1) {
    if (text[i] === '\\') { i += 1; continue; }
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}' && --depth === 0) return i + 1;
  }
  return -1;
}

/** The end of a command's name at `at` (a backslash): letters, or one other character. */
function commandEnd(text, at) {
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
 * text already has one there.
 */
export function spokenWith(text, speak) {
  const spans = mathSpans(text);
  if (!spans.length) return { text: String(text ?? ''), at: offset => offset };
  let said = '';
  let cursor = 0;
  /** Written and said offsets at each boundary, in order: [written, said] pairs. */
  const marks = [];
  for (const span of spans) {
    said += text.slice(cursor, span.start);
    marks.push([span.start, said.length]);
    said += speak(span.value, span.display);
    const after = text.slice(span.end);
    if (!/^[,.;:!?]/u.test(after) && (span.display || mathStructure(span.value) > 0)) {
      said += !after.trim() || (span.display && /^\s+\p{Lu}/u.test(after)) ? '.' : ',';
    }
    marks.push([span.end, said.length]);
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
  return { text: said, at };
}

/** Whether a text has maths to typeset. */
export function hasMath(text) {
  return splitMath(text).some(part => part.kind === 'math');
}

/**
 * How long a shown formula stays (the owner's ruling, 2026-10-26): as long as it takes to say, at an unhurried
 * speaking pace, and 300 ms more for each structure, that extra at most 2.5 s.
 */
export const MATH_DWELL = Object.freeze({ msPerSpokenChar: 65, msPerStructure: 300, maxStructureMs: 2_500 });

/** The least time a text's formulas need on screen; 0 for a text without maths. */
export function mathDwellMs(text) {
  let ms = 0;
  for (const span of mathSpans(text)) {
    ms += fallbackMath(span.value).speech.length * MATH_DWELL.msPerSpokenChar
      + Math.min(MATH_DWELL.maxStructureMs, mathStructure(span.value) * MATH_DWELL.msPerStructure);
  }
  return ms;
}

/** How many structures (fractions, roots, sums, integrals, limits, arrays) a formula has. */
export function mathStructure(tex) {
  let count = 0;
  for (const match of String(tex ?? '').matchAll(/\\([A-Za-z]+)/gu)) if (STRUCTURES.has(match[1])) count += 1;
  return count;
}

// ─── a plain reading, for the eye and for the ear ──────────────────────

const GREEK = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ',
  vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'ϖ', rho: 'ρ',
  varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω'
};

/** Symbols as `[shown, said, spaced]`: `spaced` sets a relation or operator apart on screen. */
const SYMBOLS = {
  hbar: ['ℏ', 'h bar'], ell: ['ℓ', 'ell'], infty: ['∞', 'infinity'], partial: ['∂', 'partial'], nabla: ['∇', 'nabla'],
  cdot: ['·', 'times', true], times: ['×', 'times', true], div: ['÷', 'divided by', true], pm: ['±', 'plus or minus', true],
  mp: ['∓', 'minus or plus', true], leq: ['≤', 'is less than or equal to', true], le: ['≤', 'is less than or equal to', true],
  geq: ['≥', 'is greater than or equal to', true], ge: ['≥', 'is greater than or equal to', true],
  neq: ['≠', 'is not equal to', true], ne: ['≠', 'is not equal to', true], approx: ['≈', 'is approximately', true],
  equiv: ['≡', 'is equivalent to', true], sim: ['∼', 'is similar to', true], propto: ['∝', 'is proportional to', true],
  to: ['→', 'to', true], rightarrow: ['→', 'to', true], leftarrow: ['←', 'from', true], Rightarrow: ['⇒', 'implies', true],
  Leftrightarrow: ['⇔', 'if and only if', true], mapsto: ['↦', 'maps to', true], in: ['∈', 'in', true],
  notin: ['∉', 'not in', true], subset: ['⊂', 'a subset of', true], subseteq: ['⊆', 'a subset of', true],
  cup: ['∪', 'union', true], cap: ['∩', 'intersect', true], forall: ['∀', 'for all'], exists: ['∃', 'there exists'],
  emptyset: ['∅', 'the empty set'], ldots: ['…', 'and so on'], cdots: ['⋯', 'and so on'], dots: ['…', 'and so on'],
  sum: ['∑', 'the sum of'], prod: ['∏', 'the product of'], int: ['∫', 'the integral of'], iint: ['∬', 'the double integral of'],
  oint: ['∮', 'the contour integral of'], lim: ['lim', 'the limit of'], circ: ['∘', 'composed with', true],
  prime: ['′', 'prime'], vert: ['|', 'bar'], Vert: ['‖', 'norm'], mid: ['|', 'such that', true], langle: ['⟨', ''], rangle: ['⟩', ''],
  sin: ['sin', 'sine'], cos: ['cos', 'cosine'], tan: ['tan', 'tangent'], log: ['log', 'log'], ln: ['ln', 'the natural log of'],
  exp: ['exp', 'exp'], max: ['max', 'max'], min: ['min', 'min'], det: ['det', 'the determinant of']
};

/** Characters as `[shown, said, spaced]`. */
const CHARACTERS = {
  '=': ['=', 'equals', true], '+': ['+', 'plus', true], '-': ['−', 'minus', true], '<': ['<', 'is less than', true],
  '>': ['>', 'is greater than', true], '/': ['/', 'over'], '!': ['!', 'factorial'], "'": ['′', 'prime'], '|': ['|', 'bar'],
  ',': [',', ','], '(': ['(', ''], ')': [')', ''], '[': ['[', ''], ']': [']', '']
};

const SUPERSCRIPT = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', T: 'ᵀ' };
const SUBSCRIPT = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '−': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ' };
/** Accents as `[combining mark, said, said before the letter]`. */
const ACCENTS = { vec: ['\u20D7', 'vector', true], hat: ['\u0302', 'hat'], bar: ['\u0304', 'bar'], overline: ['\u0305', 'bar'], dot: ['\u0307', 'dot'], ddot: ['\u0308', 'double dot'], tilde: ['\u0303', 'tilde'] };
const WORDS = new Set(['text', 'mathrm', 'textrm', 'textbf', 'operatorname', 'mbox']);
const STYLES = new Set(['mathbf', 'mathit', 'mathsf', 'mathtt', 'boldsymbol', 'mathcal', 'mathfrak']);
const BLACKBOARD = { R: ['ℝ', 'the real numbers'], N: ['ℕ', 'the natural numbers'], Z: ['ℤ', 'the integers'], Q: ['ℚ', 'the rationals'], C: ['ℂ', 'the complex numbers'] };
const SPACES = new Set([',', ';', ':', '!', ' ', 'quad', 'qquad', 'left', 'right', 'big', 'Big', 'bigg', 'Bigg', 'bigl', 'bigr', 'Bigl', 'Bigr', 'displaystyle', 'textstyle', 'limits', 'nolimits']);
const FRACTIONS = new Set(['frac', 'dfrac', 'tfrac', 'cfrac']);
const ENCLOSED = { pmatrix: ['(', ')'], bmatrix: ['[', ']'], vmatrix: ['|', '|'] };

/** TeX as tokens: `{ cmd }` commands, `{ group }` brace groups, `{ ch }` characters. Spaces only separate. */
function tokenize(tex) {
  const tokens = [];
  for (let i = 0; i < tex.length;) {
    const ch = tex[i];
    if (/\s/u.test(ch)) { i += 1; continue; }
    if (ch === '\\') {
      const end = commandEnd(tex, i);
      tokens.push({ cmd: tex.slice(i + 1, end) });
      i = end;
    } else if (ch === '{') {
      const end = groupEnd(tex, i);
      const inner = end < 0 ? tex.slice(i + 1) : tex.slice(i + 1, end - 1);
      tokens.push({ group: tokenize(inner), source: inner });
      i = end < 0 ? tex.length : end;
    } else if (ch === '}') i += 1;
    else { tokens.push({ ch }); i += 1; }
  }
  return tokens;
}

/** A piece of a reading: what is shown, what is said, and whether it stands apart on screen. */
const piece = (text, said, spaced = false) => ({ text, said, spaced });

function joinText(pieces) {
  return pieces.map(p => (p.spaced ? ` ${p.text} ` : p.text)).join('').replace(/\s+/gu, ' ').trim();
}

function joinSaid(pieces) {
  return pieces.map(p => p.said).filter(Boolean).join(' ').replace(/\s+,/gu, ',').replace(/\s+/gu, ' ').trim();
}

/** Whether a shown reading is one thing (a letter, a number, a symbol, a letter with its accent) that needs no brackets. */
const single = text => /^(?:\p{L}[\u0300-\u036F\u20D0-\u20FF]?|[\d.]+|[^\s\p{L}\d])$/u.test(text) || /^\p{L}+$/u.test(text) && text.length === 1;
const bracket = text => (single(text) ? text : `(${text})`);

function scriptOf(map, text) {
  const chars = [...text.replace(/ /gu, '')];
  return chars.length && chars.every(ch => map[ch] !== undefined) ? chars.map(ch => map[ch]).join('') : null;
}

const powerSaid = said => (said === '2' ? 'squared' : said === '3' ? 'cubed' : `to the power ${said}`);

/** Tokens read into pieces. */
function read(tokens) {
  const pieces = [];
  let at = 0;
  const arg = () => {
    const token = tokens[at];
    if (token === undefined) return null;
    at += 1;
    return read(token.group ?? [token]);
  };
  const optional = () => {
    if (tokens[at]?.ch !== '[') return null;
    const close = tokens.findIndex((token, index) => index > at && token.ch === ']');
    if (close < 0) return null;
    const inner = read(tokens.slice(at + 1, close));
    at = close + 1;
    return inner;
  };
  const sourceArg = () => (tokens[at]?.group ? tokens[at++].source.trim() : '');
  while (at < tokens.length) {
    const token = tokens[at++];
    if (token.group) { pieces.push(...read(token.group)); continue; }
    if (token.ch === '^' || token.ch === '_') {
      const body = arg();
      if (!body) continue;
      const text = joinText(body);
      const said = joinSaid(body);
      if (token.ch === '^') pieces.push(piece(scriptOf(SUPERSCRIPT, text) ?? `^(${text})`, powerSaid(said)));
      else pieces.push(piece(scriptOf(SUBSCRIPT, text) ?? `(${text})`, `sub ${said}`));
      continue;
    }
    if (token.ch === '&') { pieces.push(piece(' ', '')); continue; }
    if (token.ch !== undefined) {
      const last = pieces.at(-1);
      const known = CHARACTERS[token.ch];
      if (known) pieces.push(piece(known[0], known[1], known[2]));
      else if (/\d/u.test(token.ch) && last?.number) { last.text += token.ch; last.said += token.ch; }
      else if (/\d/u.test(token.ch)) pieces.push({ ...piece(token.ch, token.ch), number: true });
      else if (token.ch === '.' && last?.number) { last.text += '.'; last.said += ' point '; }
      else pieces.push(piece(token.ch, /\p{L}/u.test(token.ch) ? token.ch : ''));
      continue;
    }
    const { cmd } = token;
    if (cmd === '\\') { pieces.push(piece('; ', ',')); continue; }
    if (cmd === '{' || cmd === '}') { pieces.push(piece(cmd, '')); continue; }
    if (SPACES.has(cmd)) continue;
    if (cmd === 'begin' || cmd === 'end') {
      const enclosure = ENCLOSED[sourceArg()];
      if (enclosure) pieces.push(piece(enclosure[cmd === 'begin' ? 0 : 1], ''));
      continue;
    }
    if (GREEK[cmd]) {
      const name = cmd.replace(/^var/u, '').toLowerCase();
      pieces.push(piece(GREEK[cmd], /^[A-Z]/u.test(cmd) ? `capital ${name}` : name));
      continue;
    }
    if (SYMBOLS[cmd]) { const [text, said, spaced] = SYMBOLS[cmd]; pieces.push(piece(text, said, spaced)); continue; }
    if (FRACTIONS.has(cmd)) {
      const top = arg();
      const bottom = arg();
      if (!top) continue;
      if (!bottom) { pieces.push(...top); continue; }
      pieces.push(piece(`${bracket(joinText(top))}⁄${bracket(joinText(bottom))}`, `${joinSaid(top)} over ${joinSaid(bottom)}`));
      continue;
    }
    if (cmd === 'binom') {
      const top = arg();
      const bottom = arg();
      if (top && bottom) pieces.push(piece(`(${joinText(top)} choose ${joinText(bottom)})`, `${joinSaid(top)} choose ${joinSaid(bottom)}`));
      continue;
    }
    if (cmd === 'sqrt') {
      const index = optional();
      const body = arg();
      if (!body) continue;
      const root = index ? joinText(index) : '';
      const sign = root === '3' ? '∛' : root === '4' ? '∜' : `${root ? scriptOf(SUPERSCRIPT, root) ?? '' : ''}√`;
      const named = !root ? 'the square root of' : root === '3' ? 'the cube root of' : `the ${joinSaid(index)} root of`;
      pieces.push(piece(`${sign}${bracket(joinText(body))}`, `${named} ${joinSaid(body)}`));
      continue;
    }
    if (ACCENTS[cmd]) {
      const body = arg();
      if (!body) continue;
      const [mark, said, before] = ACCENTS[cmd];
      const text = joinText(body);
      pieces.push(piece(/^\p{L}$/u.test(text) ? `${text}${mark}` : text, before ? `${said} ${joinSaid(body)}` : `${joinSaid(body)} ${said}`));
      continue;
    }
    if (WORDS.has(cmd)) {
      const body = sourceArg().replace(/[\\{}$^_&]/gu, ' ').replace(/\s+/gu, ' ').trim();
      if (body) pieces.push(piece(body, body));
      continue;
    }
    if (STYLES.has(cmd)) { const body = arg(); if (body) pieces.push(...body); continue; }
    if (cmd === 'mathbb') {
      const body = arg();
      const named = body ? BLACKBOARD[joinText(body)] : undefined;
      if (named) pieces.push(piece(named[0], named[1]));
      else if (body) pieces.push(...body);
      continue;
    }
    if (/^[A-Za-z]+$/u.test(cmd)) pieces.push(piece(`${cmd} `, cmd));
  }
  return pieces;
}

/**
 * A formula as `{ text, speech }` without KaTeX: Unicode for the eye and plain
 * words for the ear. Never a backslash, a brace or a dollar in either.
 */
export function fallbackMath(tex) {
  const pieces = read(tokenize(String(tex ?? '')));
  const text = joinText(pieces).replace(/[\\{}$]/gu, '');
  const speech = joinSaid(pieces).replace(/[\\{}$^_&]/gu, ' ').replace(/\s+/gu, ' ').trim();
  return { text, speech };
}
