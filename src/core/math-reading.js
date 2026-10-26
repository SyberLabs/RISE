/**
 * A formula read without KaTeX, for the eye and the ear, and how long a shown
 * one stays (docs/superpowers/specs/2026-10-26-math-both-channels-design.md §3.1, §3.7).
 *
 * Apart from math-text.js: the chunker, on the first load's path, finds maths
 * through math-text.js, and these tables are needed only once a reading is
 * compiled or shown.
 */

import { commandEnd, groupEnd, mathSpans, mathStructure } from './math-text.js';

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

// ─── ClearSpeak, said as a person says it ──────────────────────────────

const OPEN = '\u0001';
const CLOSE = '\u0002';
const INNERMOST = new RegExp(`${OPEN} ?([^${OPEN}${CLOSE}]*?) ?${CLOSE}`, 'u');

/**
 * The speech engine's ClearSpeak (run with brackets spoken), said as a person
 * says it: a bracket that groups a sum is "the quantity", with a pause after
 * it when more follows; one that groups anything else is silent (f of x); a
 * limit is "the limit as x approaches 0 of".
 */
export function asSaid(speech) {
  let text = String(speech ?? '').replace(/\bopen paren\b/gu, OPEN).replace(/\bclose paren\b/gu, CLOSE);
  for (let match = INNERMOST.exec(text); match; match = INNERMOST.exec(text)) {
    const inside = match[1].trim();
    const after = text.slice(match.index + match[0].length);
    const sum = /\b(?:plus|minus)\b/u.test(inside);
    const more = after.trim() && !after.trimStart().startsWith(CLOSE) && !after.trimStart().startsWith(',');
    text = `${text.slice(0, match.index)}${sum ? `the quantity ${inside}${more ? ',' : ''}` : inside}${after}`;
  }
  return text
    .replaceAll(OPEN, 'open paren').replaceAll(CLOSE, 'close paren')
    .replace(/\blimit over (.+?) right arrow (.+?) of\b/gu, 'the limit as $1 approaches $2 of')
    .replace(/\s+,/gu, ',').replace(/\s+/gu, ' ').trim();
}

/** Units as `[plural, singular]`, by the symbol a formula writes them with. */
const UNITS = {
  m: ['meters', 'meter'], km: ['kilometers', 'kilometer'], cm: ['centimeters', 'centimeter'], mm: ['millimeters', 'millimeter'],
  nm: ['nanometers', 'nanometer'], s: ['seconds', 'second'], ms: ['milliseconds', 'millisecond'], min: ['minutes', 'minute'],
  h: ['hours', 'hour'], kg: ['kilograms', 'kilogram'], g: ['grams', 'gram'], J: ['joules', 'joule'], N: ['newtons', 'newton'],
  W: ['watts', 'watt'], Hz: ['hertz', 'hertz'], eV: ['electron volts', 'electron volt'], K: ['kelvin', 'kelvin'],
  mol: ['moles', 'mole'], A: ['amperes', 'ampere'], V: ['volts', 'volt'], C: ['coulombs', 'coulomb'], Pa: ['pascals', 'pascal'],
  L: ['liters', 'liter']
};

/**
 * A unit written as text (`\text{ m/s}`) in words, its denominator in the
 * singular ("meters per second"); null for any text that is not wholly units.
 */
export function unitWords(text) {
  const halves = String(text ?? '').trim().split('/');
  if (!halves[0] || halves.length > 2) return null;
  const said = halves.map((half, index) => half.trim().split(/[\s·⋅*]+/u).map(token => {
    const unit = /^([A-Za-z]+)(?:\^?([23]))?$/u.exec(token);
    const names = unit && Object.hasOwn(UNITS, unit[1]) ? UNITS[unit[1]] : null;
    if (!names) return null;
    return `${names[index === 0 ? 0 : 1]}${unit[2] === '2' ? ' squared' : unit[2] === '3' ? ' cubed' : ''}`;
  }));
  return said.some(words => words.includes(null)) ? null : said.map(words => words.join(' ')).join(' per ');
}

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
